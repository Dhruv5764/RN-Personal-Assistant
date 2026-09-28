import { initLlama, type LlamaContext } from 'llama.rn';

import { LLM_ASSET } from '@/lib/setup/assets';
import { modelFileUri, setupDownloads } from '@/lib/setup/downloads';

// Llama 3 end-of-turn markers; stop there so the model never writes the user's next line.
const STOP = ['<|eot_id|>', '<|end_of_text|>', '<|start_header_id|>'];

let context: Promise<LlamaContext> | null = null;

/** Load the downloaded GGUF once; later calls reuse the same context. */
export function loadModel() {
  if (setupDownloads.getState().status !== 'ready') {
    return Promise.reject(new Error('The language model is not downloaded yet.'));
  }
  if (!context) {
    const created = initLlama({
      model: modelFileUri(LLM_ASSET),
      // Room for the stable, growing history reply.ts keeps (up to 16 turns) so prefix reuse holds.
      n_ctx: 4096,
      // Larger batches read the prompt faster on CPU.
      n_batch: 512,
      // Phone CPUs have 2–4 performance cores; more threads than that slows decoding down.
      n_threads: 4,
      use_mlock: false,
      use_mmap: true,
      n_gpu_layers: 0,
      // No CPU_REPACK weight buffers: on some ARM phones llama.cpp aborts the whole app while
      // building the graph ("pre-allocated tensor … in a buffer (CPU_REPACK) that cannot run the
      // operation"). Costs a little decode speed, but the model always loads.
      no_extra_bufts: true,
    });
    context = created;
    created.catch(() => {
      if (context === created) context = null;
    });
  }
  return context;
}

export type ChatMessage = { role: 'system' | 'user' | 'assistant'; content: string };

/**
 * Stream a chat reply. `onText` receives each new piece of text as it is generated.
 * Resolves with the full reply.
 */
export async function chat(messages: ChatMessage[], onText: (piece: string) => void) {
  const llama = await loadModel();
  const result = await llama.completion(
    {
      messages,
      n_predict: 200,
      temperature: 0.7,
      top_p: 0.9,
      penalty_repeat: 1.1,
      stop: STOP,
    },
    (data) => {
      if (data.token) onText(data.token);
    }
  );
  return (result.content || result.text).trim();
}

/**
 * Read the system prompt ahead of time. llama.rn keeps the evaluated prefix, and every later
 * prompt starts with the same system message, so the first real answer skips that work.
 */
export async function warmUp(system: string) {
  const llama = await loadModel();
  await llama.completion({ messages: [{ role: 'system', content: system }], n_predict: 1, stop: STOP });
}

/** Stop the reply being generated (the pending chat() resolves with what it has so far). */
export async function stopChat() {
  const llama = context ? await context.catch(() => null) : null;
  await llama?.stopCompletion();
}
