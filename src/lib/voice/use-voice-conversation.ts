import { useEffect, useRef, useState } from 'react';
import { useSharedValue, withTiming } from 'react-native-reanimated';

import type { VoiceId } from '@/constants/voices';
import { getReply, systemPrompt, type Turn } from '@/lib/assistant/reply';
import { stopChat, warmUp } from '@/lib/llm/engine';
import { ensureMicPermission, listen, preloadSpeechRecognizer, type ListenSession } from '@/lib/voice/stt';
import { preloadVoice, speakStream, type Speech } from '@/lib/voice/tts';

export type VoicePhase = 'loading' | 'listening' | 'thinking' | 'speaking' | 'no-permission' | 'error';

export type VoiceTurn = { id: number; role: 'user' | 'assistant'; text: string };

type Options = { voiceId: VoiceId; paName: string };

/**
 * Turn-taking voice loop: listen until the speaker pauses, reply, speak the reply, listen again.
 * The mic is off while the assistant speaks (no echo cancellation yet), so interrupting is a tap.
 */
export function useVoiceConversation({ voiceId, paName }: Options) {
  const [phase, setPhase] = useState<VoicePhase>('loading');
  const [muted, setMuted] = useState(false);
  const [turns, setTurns] = useState<VoiceTurn[]>([]);
  const [partial, setPartial] = useState('');
  const [error, setError] = useState<string | null>(null);
  /** Mic loudness 0–1 for the orb; eased so it doesn't jitter. */
  const level = useSharedValue(0);

  const session = useRef<ListenSession | null>(null);
  const speech = useRef<Speech | null>(null);
  const alive = useRef(true);
  const mutedRef = useRef(false);
  const nextId = useRef(1);
  // Mirror of `turns` for building the model prompt without waiting for a re-render.
  const history = useRef<Turn[]>([]);

  const addTurn = (role: VoiceTurn['role'], text: string) => {
    const id = nextId.current++;
    setTurns((prev) => [...prev, { id, role, text }]);
    history.current.push({ role, text });
    return id;
  };

  const updateTurn = (id: number, text: string) => {
    setTurns((prev) => prev.map((turn) => (turn.id === id ? { ...turn, text } : turn)));
    history.current[history.current.length - 1].text = text;
  };

  const fail = (message: string) => {
    if (!alive.current) return;
    setError(message);
    setPhase('error');
    level.set(withTiming(0));
  };

  const startListening = async () => {
    if (!alive.current) return;
    setPhase('listening');
    setPartial('');
    if (mutedRef.current) return;
    try {
      session.current = await listen({
        onPartial: (text) => alive.current && setPartial(text),
        onLevel: (value) => {
          level.set(withTiming(value, { duration: 90 }));
        },
        onFinal: (text) => {
          session.current = null;
          respond(text);
        },
        onError: fail,
      });
      // Muted or left while the mic was starting.
      if (!alive.current || mutedRef.current) await stopListening();
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  };

  const stopListening = async () => {
    const current = session.current;
    session.current = null;
    level.set(withTiming(0));
    await current?.stop();
  };

  const respond = async (text: string) => {
    if (!alive.current) return;
    level.set(withTiming(0));
    setPartial('');
    addTurn('user', text);
    setPhase('thinking');
    const timing = startTiming();
    try {
      // The reply is spoken sentence by sentence while the model is still writing it.
      const stream = await speakStream(voiceId);
      if (!alive.current) {
        await stream.stop();
        return;
      }
      speech.current = stream;
      stream.started.then(() => {
        timing.mark('first audio');
        if (alive.current && speech.current === stream) setPhase('speaking');
      });

      const prompt = [...history.current];
      const replyId = addTurn('assistant', '');
      let written = '';
      await getReply({
        history: prompt,
        paName,
        onText: (piece) => {
          if (!written) timing.mark('first token');
          written += piece;
          stream.push(piece);
          if (alive.current) updateTurn(replyId, written.trimStart());
        },
      });
      stream.end();
      if (!written.trim()) {
        // Cancelled before any words: drop the empty reply from the transcript and the prompt.
        setTurns((prev) => prev.filter((turn) => turn.id !== replyId));
        history.current.pop();
      }
      timing.mark('reply written');
      await stream.finished;
      timing.mark('done speaking');
      timing.report();
      speech.current = null;
      startListening();
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
    }
  };

  /** Ask for the mic, load both models, then start the first turn. State starts as 'loading'. */
  const boot = async () => {
    if (!(await ensureMicPermission())) {
      if (alive.current) setPhase('no-permission');
      return;
    }
    try {
      await Promise.all([
        preloadSpeechRecognizer(),
        preloadVoice(voiceId),
        warmUp(systemPrompt(paName)),
      ]);
    } catch (e) {
      fail(e instanceof Error ? e.message : String(e));
      return;
    }
    startListening();
  };

  useEffect(() => {
    alive.current = true;
    boot();
    return () => {
      alive.current = false;
      session.current?.stop();
      speech.current?.stop();
      stopChat();
    };
    // Runs once per screen visit; voice and name changes apply next time.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    phase,
    muted,
    turns,
    partial,
    error,
    level,
    /** Stop the assistant mid-sentence and go back to listening. */
    interrupt: () => {
      stopChat();
      speech.current?.stop();
    },
    toggleMute: () => {
      const next = !mutedRef.current;
      mutedRef.current = next;
      setMuted(next);
      if (next) stopListening();
      else if (phase === 'listening') startListening();
    },
    retry: () => {
      setError(null);
      setPhase('loading');
      boot();
    },
  };
}

/** Dev-only latency log per turn, measured from the end of the user's speech. */
function startTiming() {
  const start = Date.now();
  const marks: string[] = [];
  return {
    mark: (label: string) => {
      if (__DEV__) marks.push(`${label} ${Date.now() - start}ms`);
    },
    report: () => {
      if (__DEV__) console.log(`[voice] ${marks.join(' · ')}`);
    },
  };
}
