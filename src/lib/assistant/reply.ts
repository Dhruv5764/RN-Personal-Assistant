import { chat, type ChatMessage } from '@/lib/llm/engine';

export type Turn = { role: 'user' | 'assistant'; text: string };

// llama.rn reuses the evaluated prompt prefix between turns, so the history must stay stable:
// it only grows, and is trimmed in one big step (not by one turn every time) when it gets long.
const MAX_TURNS = 16;
const KEEP_AFTER_TRIM = 6;

function windowed(history: Turn[]) {
  if (history.length <= MAX_TURNS) return history;
  const overflow = history.length - MAX_TURNS;
  const trimBlocks = Math.ceil(overflow / (MAX_TURNS - KEEP_AFTER_TRIM));
  return history.slice(trimBlocks * (MAX_TURNS - KEEP_AFTER_TRIM));
}

export function systemPrompt(paName: string) {
  const today = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return [
    `You are ${paName}, a warm, concise personal assistant that runs entirely on the user's phone, with no internet access.`,
    'This is a spoken conversation: answer in one to three short, natural sentences.',
    'Never use lists, headings, markdown, emoji or symbols; write numbers and times the way you would say them.',
    "If a question needs live information (news, weather, prices), say you can't look that up offline.",
    "You can't change the calendar, reminders or files yet; if asked, say that is coming soon.",
    `Today is ${today}.`,
  ].join(' ');
}

/**
 * Produce the assistant's answer to the latest user turn, streaming text through `onText`
 * as it is generated. Resolves with the full reply.
 */
export async function getReply({
  history,
  paName,
  onText,
}: {
  /** Conversation so far, ending with the user's new turn. */
  history: Turn[];
  paName: string;
  onText: (piece: string) => void;
}): Promise<string> {
  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt(paName) },
    ...windowed(history).map((turn) => ({ role: turn.role, content: turn.text })),
  ];
  return chat(messages, onText);
}
