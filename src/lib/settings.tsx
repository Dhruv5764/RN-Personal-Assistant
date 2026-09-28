import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useState, type PropsWithChildren } from 'react';

import type { VoiceId } from '@/constants/voices';

export type Settings = {
  onboarded: boolean;
  paName: string;
  voiceId: VoiceId;
};

const STORAGE_KEY = 'settings.v1';

const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  paName: 'Aria',
  voiceId: 'amy',
};

function loadSettings(): Settings {
  try {
    const raw = Storage.getItemSync(STORAGE_KEY);
    return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

type SettingsContextValue = {
  settings: Settings;
  updateSettings: (patch: Partial<Settings>) => void;
};

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: PropsWithChildren) {
  const [settings, setSettings] = useState(loadSettings);

  const updateSettings = (patch: Partial<Settings>) => {
    const next = { ...settings, ...patch };
    setSettings(next);
    Storage.setItemSync(STORAGE_KEY, JSON.stringify(next));
  };

  return <SettingsContext value={{ settings, updateSettings }}>{children}</SettingsContext>;
}

export function useSettings() {
  const value = use(SettingsContext);
  if (!value) throw new Error('useSettings must be used inside SettingsProvider');
  return value;
}
