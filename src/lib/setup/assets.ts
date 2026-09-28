import type { VoiceId } from '@/constants/voices';
import { pickModel } from '@/lib/llm/models';

/**
 * Everything the app downloads on first launch. Nothing ships inside the app binary.
 * Sizes are the exact published byte counts; a download must match before it is used.
 */
export type SetupAsset = {
  id: string;
  /** Shown in the setup list. */
  label: string;
  detail: string;
  url: string;
  bytes: number;
} & (
  | { kind: 'archive'; /** Folder the .tar.bz2 unpacks to, under models/. */ folder: string }
  | { kind: 'file'; fileName: string }
);

const SHERPA = 'https://github.com/k2-fsa/sherpa-onnx/releases/download';

function voice(id: VoiceId, name: string, folder: string, bytes: number): SetupAsset {
  return {
    id: `voice-${id}`,
    label: `${name} voice`,
    detail: 'piper · onnx',
    kind: 'archive',
    folder,
    url: `${SHERPA}/tts-models/${folder}.tar.bz2`,
    bytes,
  };
}

export const STT_ASSET: SetupAsset = {
  id: 'stt',
  label: 'Speech recognition',
  detail: 'zipformer-en · streaming',
  kind: 'archive',
  folder: 'sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06',
  url: `${SHERPA}/asr-models/sherpa-onnx-streaming-zipformer-en-kroko-2025-08-06.tar.bz2`,
  bytes: 57_267_600,
};

export const VOICE_ASSETS: Record<VoiceId, SetupAsset> = {
  amy: voice('amy', 'Amy', 'vits-piper-en_US-amy-medium-int8', 21_028_122),
  ryan: voice('ryan', 'Ryan', 'vits-piper-en_US-ryan-medium-int8', 21_083_446),
  alba: voice('alba', 'Alba', 'vits-piper-en_GB-alba-medium-int8', 21_104_326),
  alan: voice('alan', 'Alan', 'vits-piper-en_GB-alan-medium-int8', 21_103_831),
};

const llm = pickModel();
export const LLM_ASSET: SetupAsset = {
  id: 'llm',
  label: 'Language model',
  detail: llm.label,
  kind: 'file',
  fileName: llm.fileName,
  url: llm.url,
  bytes: llm.bytes,
};

/** Download order: small speech pieces first, so failures surface early; the big model last. */
export const SETUP_ASSETS: SetupAsset[] = [STT_ASSET, ...Object.values(VOICE_ASSETS), LLM_ASSET];

export const SETUP_TOTAL_BYTES = SETUP_ASSETS.reduce((sum, asset) => sum + asset.bytes, 0);
