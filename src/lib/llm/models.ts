import * as Device from 'expo-device';

export type LlmModel = {
  id: 'llama-3.2-3b' | 'llama-3.2-1b';
  /** Short technical label for headers, e.g. "llama-3.2-3b · q4_k_m". */
  label: string;
  fileName: string;
  url: string;
  bytes: number;
};

// Llama 3.2 Instruct, Q4_K_M GGUF. Sizes are the exact published byte counts; a finished
// download must match them.
const MODELS: Record<LlmModel['id'], LlmModel> = {
  'llama-3.2-3b': {
    id: 'llama-3.2-3b',
    label: 'llama-3.2-3b · q4_k_m',
    fileName: 'Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-3B-Instruct-GGUF/resolve/main/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
    bytes: 2_019_377_696,
  },
  'llama-3.2-1b': {
    id: 'llama-3.2-1b',
    label: 'llama-3.2-1b · q4_k_m',
    fileName: 'Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    url: 'https://huggingface.co/bartowski/Llama-3.2-1B-Instruct-GGUF/resolve/main/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    bytes: 807_694_464,
  },
};

/**
 * The model the app downloads and runs. Conversation (voice and Q&A) uses 1B: on phone CPUs it
 * starts answering 2–3× sooner than 3B, which matters more than depth for spoken replies.
 * 3B stays in the catalog for the command/JSON layer (spec: 6 GB+ RAM), which needs its accuracy;
 * see `canRunLargeModel`.
 */
export function pickModel(): LlmModel {
  return MODELS['llama-3.2-1b'];
}

const SIX_GB = 6 * 1024 ** 3 * 0.9; // devices report a little under their marketed RAM

/** Whether this phone has the RAM the spec requires for the 3B model. */
export function canRunLargeModel() {
  return (Device.totalMemory ?? 0) >= SIX_GB;
}

export function formatBytes(bytes: number) {
  if (bytes >= 1024 ** 3) return `${(bytes / 1024 ** 3).toFixed(1)} GB`;
  return `${Math.round(bytes / 1024 ** 2)} MB`;
}
