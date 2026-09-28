import { Directory, DownloadTask, File, Paths, type DownloadPauseState } from 'expo-file-system';
import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { extractArchive } from 'react-native-sherpa-onnx/extraction';

import { SETUP_ASSETS, SETUP_TOTAL_BYTES, type SetupAsset } from '@/lib/setup/assets';

/**
 * First-launch downloads: the speech recognizer, the voices and the language model are fetched
 * once into the app's documents folder, one after another. The app is usable once all are ready.
 */
export type SetupState =
  | { status: 'idle' | 'paused'; received: number; current: SetupAsset | null }
  | { status: 'downloading' | 'unpacking'; received: number; current: SetupAsset }
  | { status: 'error'; received: number; current: SetupAsset | null; message: string }
  | { status: 'ready'; received: number; current: null };

const PAUSE_KEY = 'setup.download.paused.v1';
const READY_MARKER = '.ready';

const root = new Directory(Paths.document, 'models');
const llmDir = new Directory(root, 'llm');

/** Absolute filesystem path (native code wants a plain path, not a file:// URI). */
function pathOf(entry: File | Directory) {
  return decodeURIComponent(entry.uri.replace(/^file:\/\//, '')).replace(/\/$/, '');
}

function finalFile(asset: SetupAsset) {
  return asset.kind === 'file' ? new File(llmDir, asset.fileName) : new File(root, `${asset.folder}.tar.bz2`);
}

// Downloads land in a .part file and are only renamed once the size matches, so a half-written
// file is never mistaken for a usable one.
function partFile(asset: SetupAsset) {
  const target = finalFile(asset);
  return new File(target.parentDirectory, `${target.name}.part`);
}

export function isAssetReady(asset: SetupAsset) {
  if (asset.kind === 'file') {
    const file = finalFile(asset);
    return file.exists && file.size === asset.bytes;
  }
  return new File(root, asset.folder, READY_MARKER).exists;
}

/** Absolute path of an unpacked model folder, for sherpa-onnx `{ type: 'file' }` model paths. */
export function modelFolderPath(asset: SetupAsset) {
  if (asset.kind !== 'archive') throw new Error(`${asset.id} is not an unpacked model`);
  return pathOf(new Directory(root, asset.folder));
}

/** file:// URI of a downloaded single-file model (the GGUF). */
export function modelFileUri(asset: SetupAsset) {
  return finalFile(asset).uri;
}

type Saved = { assetId: string; state: DownloadPauseState };

function readSaved(): Saved | null {
  try {
    const raw = Storage.getItemSync(PAUSE_KEY);
    return raw ? (JSON.parse(raw) as Saved) : null;
  } catch {
    return null;
  }
}

function writeSaved(value: Saved | null) {
  if (value) Storage.setItemSync(PAUSE_KEY, JSON.stringify(value));
  else Storage.removeItemSync(PAUSE_KEY);
}

function readyBytes() {
  return SETUP_ASSETS.filter(isAssetReady).reduce((sum, asset) => sum + asset.bytes, 0);
}

function initialState(): SetupState {
  const received = readyBytes();
  if (SETUP_ASSETS.every(isAssetReady)) return { status: 'ready', received, current: null };
  const saved = readSaved();
  const current = SETUP_ASSETS.find((asset) => asset.id === saved?.assetId) ?? null;
  const partial = current && partFile(current).exists ? partFile(current).size : 0;
  return { status: saved ? 'paused' : 'idle', received: received + partial, current };
}

removeStaleFiles();
let state: SetupState = initialState();
let task: DownloadTask | null = null;
let running = false;
const listeners = new Set<() => void>();

function set(next: SetupState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** Remove language models from an earlier model choice; they are hundreds of MB to GBs each. */
function removeStaleFiles() {
  if (!llmDir.exists) return;
  const keep = new Set(
    SETUP_ASSETS.filter((asset) => asset.kind === 'file').flatMap((asset) => [finalFile(asset).uri, partFile(asset).uri])
  );
  for (const entry of llmDir.list()) {
    if (entry instanceof File && !keep.has(entry.uri)) entry.delete();
  }
}

class Paused extends Error {}

/** Download one asset into its .part file; resumes from saved pause data when there is some. */
async function download(asset: SetupAsset, doneBefore: number) {
  const part = partFile(asset);
  part.parentDirectory.create({ intermediates: true, idempotent: true });
  const onProgress = ({ bytesWritten }: { bytesWritten: number }) => {
    if (state.status === 'downloading' && state.current.id === asset.id) {
      set({ status: 'downloading', received: doneBefore + bytesWritten, current: asset });
    }
  };

  const saved = readSaved();
  let result: File | null;
  if (saved?.assetId === asset.id && part.exists) {
    task = DownloadTask.fromSavable(saved.state, { onProgress });
    try {
      result = await task.resumeAsync();
    } catch (error) {
      if (isCancel(error)) throw error;
      // Resume data can go stale (server changed, file cleared); start this file over.
      writeSaved(null);
      part.delete();
      return download(asset, doneBefore);
    }
  } else {
    writeSaved(null);
    if (part.exists) part.delete();
    task = File.createDownloadTask(asset.url, part, { onProgress });
    result = await task.downloadAsync();
  }
  task = null;
  if (!result) throw new Paused();

  writeSaved(null);
  if (!part.exists || part.size !== asset.bytes) {
    if (part.exists) part.delete();
    throw new Error(`${asset.label} download was incomplete. Try again.`);
  }
  const target = finalFile(asset);
  if (target.exists) target.delete();
  part.rename(target.name);
}

async function unpack(asset: SetupAsset & { kind: 'archive' }) {
  const archive = finalFile(asset);
  const folder = new Directory(root, asset.folder);
  if (folder.exists) folder.delete();
  // The archive's entries start with its folder name, so unpacking into models/ yields models/<folder>.
  const result = await extractArchive(
    { modelId: asset.folder, archivePath: pathOf(archive), format: 'tar.bz2', fileSize: asset.bytes },
    pathOf(root),
    { showNotificationsEnabled: false }
  );
  if (!result.success || !new File(folder, 'tokens.txt').exists) {
    if (folder.exists) folder.delete();
    archive.delete();
    throw new Error(`Couldn't unpack ${asset.label}. Try again.`);
  }
  new File(folder, READY_MARKER).create();
  archive.delete();
}

async function run() {
  running = true;
  try {
    for (const asset of SETUP_ASSETS) {
      if (isAssetReady(asset)) continue;
      const doneBefore = readyBytes();
      set({ status: 'downloading', received: doneBefore, current: asset });
      // A finished archive can be left over if the app closed while unpacking; a single-file
      // model that exists here failed the size check and is fetched again.
      if (asset.kind === 'file' && finalFile(asset).exists) finalFile(asset).delete();
      if (!finalFile(asset).exists) await download(asset, doneBefore);
      if (asset.kind === 'archive') {
        set({ status: 'unpacking', received: doneBefore + asset.bytes, current: asset });
        await unpack(asset);
      }
    }
    set({ status: 'ready', received: SETUP_TOTAL_BYTES, current: null });
  } catch (error) {
    task = null;
    if (error instanceof Paused || isCancel(error)) return;
    set({
      status: 'error',
      received: readyBytes(),
      current: state.current,
      message: error instanceof Error ? error.message : String(error),
    });
  } finally {
    running = false;
  }
}

function isCancel(error: unknown) {
  return /cancel|abort/i.test(error instanceof Error ? `${error.name} ${error.message}` : String(error));
}

export const setupDownloads = {
  totalBytes: SETUP_TOTAL_BYTES,
  getState: () => state,
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => listeners.delete(listener);
  },

  /** Start, or continue after a pause, an error or an app restart. */
  start() {
    if (running || state.status === 'ready') return;
    root.create({ intermediates: true, idempotent: true });
    run();
  },

  /** Pause the current file download (unpacking is short and finishes first). */
  async pause() {
    if (!task || state.status !== 'downloading') return;
    const current = task;
    const { received, current: asset } = state;
    await current.pauseAsync();
    writeSaved({ assetId: asset.id, state: current.savable() });
    set({ status: 'paused', received, current: asset });
  },
};

// Android stops transfers when a backgrounded app is closed, and a transfer that was never paused
// cannot be resumed. Pausing on background saves resume data, so the download picks up where it
// stopped instead of starting over.
let pausedForBackground = false;
AppState.addEventListener('change', (next) => {
  if (next === 'background' && state.status === 'downloading') {
    pausedForBackground = true;
    setupDownloads.pause().catch(() => {});
  } else if (next === 'active' && pausedForBackground) {
    pausedForBackground = false;
    if (state.status === 'paused') setupDownloads.start();
  }
});

export function useSetupDownloads() {
  return useSyncExternalStore(setupDownloads.subscribe, setupDownloads.getState);
}
