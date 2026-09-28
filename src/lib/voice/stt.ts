import { getRecordingPermissionsAsync, requestRecordingPermissionsAsync } from 'expo-audio';
import { createPcmLiveStream } from 'react-native-sherpa-onnx/audio';
import { createStreamingSTT, type StreamingSttEngine } from 'react-native-sherpa-onnx/stt';

import { STT_ASSET } from '@/lib/setup/assets';
import { modelFolderPath } from '@/lib/setup/downloads';

const SAMPLE_RATE = 16000;

let engine: Promise<StreamingSttEngine> | null = null;

function getEngine() {
  if (!engine) {
    const created = createStreamingSTT({
      modelPath: { type: 'file', path: modelFolderPath(STT_ASSET) },
      modelType: 'transducer',
      enableEndpoint: true,
      // Treat ~0.6 s of silence after speech as the end of a turn; cap a turn at 20 s.
      endpointConfig: {
        rule1: { mustContainNonSilence: false, minTrailingSilence: 2.4, minUtteranceLength: 0 },
        rule2: { mustContainNonSilence: true, minTrailingSilence: 0.6, minUtteranceLength: 0 },
        rule3: { mustContainNonSilence: false, minTrailingSilence: 0, minUtteranceLength: 20 },
      },
      numThreads: 1,
    });
    engine = created;
    created.catch(() => {
      if (engine === created) engine = null;
    });
  }
  return engine;
}

export function preloadSpeechRecognizer() {
  return getEngine().then(() => undefined);
}

export async function ensureMicPermission() {
  const current = await getRecordingPermissionsAsync();
  if (current.granted) return true;
  if (!current.canAskAgain) return false;
  return (await requestRecordingPermissionsAsync()).granted;
}

type ListenHandlers = {
  /** Live transcript of the current turn; updates as words are recognized. */
  onPartial: (text: string) => void;
  /** Fired once when the speaker pauses long enough to end the turn. Listening stops. */
  onFinal: (text: string) => void;
  /** Mic loudness, 0–1, roughly 10 times a second. */
  onLevel: (level: number) => void;
  onError: (message: string) => void;
};

export type ListenSession = { stop: () => Promise<void> };

/** Start the mic and transcribe one turn. Call `stop()` to end early without a final result. */
export async function listen(handlers: ListenHandlers): Promise<ListenSession> {
  const recognizer = await getEngine();
  const stream = await recognizer.createStream();
  const mic = createPcmLiveStream({ sampleRate: SAMPLE_RATE, channelCount: 1 });

  let closed = false;
  let lastText = '';
  // Chunks are decoded one at a time; the mic keeps delivering while a decode is in flight.
  let queue = Promise.resolve();

  const close = async () => {
    if (closed) return;
    closed = true;
    removeData();
    removeError();
    await mic.stop().catch(() => {});
    await queue.catch(() => {});
    await stream.release().catch(() => {});
  };

  const removeData = mic.onData((samples) => {
    if (closed) return;
    handlers.onLevel(levelOf(samples));
    queue = queue.then(async () => {
      if (closed) return;
      const { result, isEndpoint } = await stream.processAudioChunk(samples, SAMPLE_RATE);
      if (closed) return;
      const text = tidy(result.text);
      if (text !== lastText) {
        lastText = text;
        handlers.onPartial(text);
      }
      // An endpoint with nothing recognized is just silence; keep listening.
      if (isEndpoint && text) {
        // Not awaited: close() waits for this queue entry to finish.
        close();
        handlers.onFinal(text);
      } else if (isEndpoint) {
        await stream.reset();
      }
    });
    queue.catch((error: Error) => {
      if (closed) return;
      close();
      handlers.onError(error.message);
    });
  });

  const removeError = mic.onError((message) => {
    close();
    handlers.onError(message);
  });

  await mic.start();
  return { stop: close };
}

/** RMS of the chunk mapped to 0–1 on a log scale, so quiet speech still moves the orb. */
function levelOf(samples: Float32Array) {
  if (samples.length === 0) return 0;
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  const rms = Math.sqrt(sum / samples.length);
  const db = 20 * Math.log10(rms + 1e-6); // ~ -60 dB silence … 0 dB full scale
  return Math.min(1, Math.max(0, (db + 55) / 45));
}

/** Streaming English models emit bare upper-case words; make them read like a sentence. */
function tidy(raw: string) {
  const text = raw.trim().replace(/\s+/g, ' ');
  if (!text || text !== text.toUpperCase()) return text;
  const lower = text.toLowerCase().replace(/\bi\b/g, 'I');
  return lower.charAt(0).toUpperCase() + lower.slice(1);
}
