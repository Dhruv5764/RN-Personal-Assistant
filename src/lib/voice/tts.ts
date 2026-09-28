import { DeviceEventEmitter } from 'react-native';
import { createStreamingTTS, type StreamingTtsEngine } from 'react-native-sherpa-onnx/tts';

import type { VoiceId } from '@/constants/voices';
import { VOICE_ASSETS } from '@/lib/setup/assets';
import { modelFolderPath } from '@/lib/setup/downloads';

// One Piper engine is kept loaded at a time; switching voice releases the previous one.
let loaded: { voiceId: VoiceId; engine: Promise<StreamingTtsEngine> } | null = null;
let active: Speech | null = null;
// Bumped by every stop; a speech that was still loading when stopped never starts playing.
let epoch = 0;

// Cancelling a stream only flags the native generation thread; it keeps running inside the model
// until its next check and then emits `ttsStreamEnd`. Starting another stream on that engine, or
// destroying it, before then crashes natively (two threads in one model / a freed model). So each
// engine is tracked as busy until its thread reports the end.
const busy = new Map<string, { done: Promise<void>; resolve: () => void }>();

function markBusy(instanceId: string) {
  let resolve!: () => void;
  const done = new Promise<void>((r) => {
    resolve = r;
  });
  busy.set(instanceId, { done, resolve });
}

function markIdle(instanceId?: string) {
  const ids = instanceId ? [instanceId] : [...busy.keys()];
  for (const id of ids) {
    busy.get(id)?.resolve();
    busy.delete(id);
  }
}

function whenIdle(instanceId: string) {
  return busy.get(instanceId)?.done ?? Promise.resolve();
}

DeviceEventEmitter.addListener('ttsStreamEnd', (event?: { instanceId?: string }) => markIdle(event?.instanceId));
DeviceEventEmitter.addListener('ttsStreamError', (event?: { instanceId?: string }) => markIdle(event?.instanceId));

function getEngine(voiceId: VoiceId) {
  if (loaded?.voiceId === voiceId) return loaded.engine;

  const previous = loaded;
  const engine = createStreamingTTS({
    modelPath: { type: 'file', path: modelFolderPath(VOICE_ASSETS[voiceId]) },
    modelType: 'vits',
    numThreads: 2,
  });
  loaded = { voiceId, engine };
  // A failed load must not stay cached, or every later call would reuse the rejection.
  engine.catch(() => {
    if (loaded?.engine === engine) loaded = null;
  });
  // Only free the previous voice once its generation thread has fully stopped.
  previous?.engine
    .then(async (old) => {
      await whenIdle(old.instanceId);
      await old.destroy();
    })
    .catch(() => {});
  return engine;
}

/** Load a voice ahead of time so the first sentence starts without the model load delay. */
export function preloadVoice(voiceId: VoiceId) {
  return getEngine(voiceId).then(() => undefined);
}

export type Speech = {
  /** Resolves once all audio has played (or speech was stopped). Rejects if synthesis fails. */
  finished: Promise<void>;
  /** Resolves when the first audio reaches the speaker (or speech ends without any). */
  started: Promise<void>;
  stop: () => Promise<void>;
};

export type SpeechStream = Speech & {
  /** Append text as it arrives; each complete sentence is spoken as soon as it is ready. */
  push: (text: string) => void;
  /** No more text is coming; speak whatever is left. */
  end: () => void;
};

const SILENT: SpeechStream = {
  finished: Promise.resolve(),
  started: Promise.resolve(),
  stop: async () => {},
  push: () => {},
  end: () => {},
};

/**
 * Open a speech stream in the given Piper voice. Text can be pushed incrementally (e.g. while the
 * LLM is still generating): sentences are synthesized one after another into a single player, so
 * speaking starts after the first sentence instead of after the whole reply.
 * Only one speech plays at a time; opening a new one stops the current one.
 */
export async function speakStream(voiceId: VoiceId): Promise<SpeechStream> {
  await stopSpeaking();
  const mine = epoch;
  const engine = await getEngine(voiceId);
  const sampleRate = await engine.getSampleRate();
  if (mine !== epoch) return SILENT;
  await engine.startPcmPlayer(sampleRate, 1);

  let stopped = false;
  let ended = false;
  let generating = false;
  let buffer = '';
  const sentences: string[] = [];
  let cancelCurrent: (() => Promise<void>) | null = null;

  let settle!: { resolve: () => void; reject: (error: Error) => void };
  const finished = new Promise<void>((resolve, reject) => {
    settle = { resolve, reject };
  });
  // Callers that care about failures await `finished`; don't report it as unhandled otherwise.
  finished.catch(() => {});
  let markStarted!: () => void;
  const started = new Promise<void>((resolve) => {
    markStarted = resolve;
  });

  // The native player drops queued audio when stopped, so track when the last written sample
  // will have played (the queue restarts from "now" whenever synthesis falls behind playback).
  let playbackEndsAt = 0;
  let drainTimer: ReturnType<typeof setTimeout> | undefined;

  const release = async () => {
    clearTimeout(drainTimer);
    await engine.stopPcmPlayer().catch(() => {});
    if (active === speech) active = null;
    markStarted();
  };

  const fail = async (error: Error) => {
    stopped = true;
    await release();
    settle.reject(error);
  };

  const drain = () => {
    const remaining = Math.max(0, playbackEndsAt - Date.now()) + 150;
    drainTimer = setTimeout(() => {
      release().then(() => settle.resolve());
    }, remaining);
  };

  // Synthesize queued sentences one at a time (the engine allows a single stream). The next
  // sentence starts generating while the previous one is still playing, so there is no gap.
  const pump = async () => {
    if (stopped || generating) return;
    const sentence = sentences.shift();
    if (sentence === undefined) {
      if (ended) drain();
      return;
    }
    generating = true;
    try {
      // The previous sentence (or a cancelled speech on this engine) may still be winding down.
      await whenIdle(engine.instanceId);
      if (stopped) return;
      markBusy(engine.instanceId);
      const controller = await engine.generateSpeechStream(sentence, undefined, {
        onChunk: (chunk) => {
          if (stopped || chunk.samples.length === 0) return;
          const chunkMs = (chunk.samples.length / chunk.sampleRate) * 1000;
          playbackEndsAt = Math.max(playbackEndsAt, Date.now()) + chunkMs;
          engine.writePcmChunk(chunk.samples).catch(() => {});
          markStarted();
        },
        onEnd: () => {
          generating = false;
          cancelCurrent = null;
          pump();
        },
        onError: (event) => {
          fail(new Error(event.message));
        },
      });
      cancelCurrent = () => controller.cancel();
    } catch (error) {
      // Rejected before a native thread started, so no end event will come.
      markIdle(engine.instanceId);
      fail(error instanceof Error ? error : new Error(String(error)));
    }
  };

  const enqueue = (text: string) => {
    const clean = forSpeech(text);
    if (clean) sentences.push(clean);
  };

  const speech: SpeechStream = {
    finished,
    started,
    push: (text) => {
      if (stopped || ended) return;
      buffer += text;
      // A sentence is complete once its end punctuation is followed by whitespace. Very short
      // fragments ("Sure.") wait for more text so the voice doesn't sound choppy.
      for (let cut = sentenceEnd(buffer); cut > 0; cut = sentenceEnd(buffer)) {
        enqueue(buffer.slice(0, cut));
        buffer = buffer.slice(cut);
      }
      pump();
    },
    end: () => {
      if (stopped || ended) return;
      ended = true;
      enqueue(buffer);
      buffer = '';
      pump();
    },
    stop: async () => {
      if (stopped) return;
      stopped = true;
      await cancelCurrent?.().catch(() => {});
      await release();
      settle.resolve();
    },
  };
  active = speech;
  if (mine !== epoch) await speech.stop();
  return speech;
}

/** Speak a complete piece of text. */
export async function speak(voiceId: VoiceId, text: string): Promise<Speech> {
  const stream = await speakStream(voiceId);
  stream.push(text);
  stream.end();
  return stream;
}

export async function stopSpeaking() {
  epoch++;
  await active?.stop();
}

/** Index just past the first sentence end (punctuation + whitespace) at least 12 chars in, or -1. */
function sentenceEnd(text: string) {
  const ends = /[.!?…:;]+\s+/g;
  for (let m = ends.exec(text); m; m = ends.exec(text)) {
    if (text.slice(0, m.index).trim().length >= 12) return m.index + m[0].length;
  }
  return -1;
}

/** Strip markdown and symbols the voice would otherwise read out literally. */
function forSpeech(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[*_#`>~|]+/g, ' ')
    .replace(/^\s*[-•]\s+/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
}
