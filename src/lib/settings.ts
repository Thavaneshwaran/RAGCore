import { AppSettings, Mode, RemoteProviderConfig } from '@/types/settings';

const SETTINGS_KEY = 'app-settings';

const DEFAULT_SETTINGS: AppSettings = {
  mode: 'local',
  chunkCount: 5,
  chunkOverlap: 10, // 10% default overlap
  chunkSize: 500, // Default 500 characters per chunk
};

export function loadSettings(): AppSettings {
  try {
    const stored = localStorage.getItem(SETTINGS_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.error('Failed to load settings:', error);
  }
  return DEFAULT_SETTINGS;
}

export function saveSettings(settings: AppSettings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function updateMode(mode: Mode): void {
  const settings = loadSettings();
  settings.mode = mode;
  saveSettings(settings);
}

export function updateRemoteConfig(config: RemoteProviderConfig): void {
  const settings = loadSettings();
  settings.remoteConfig = config;
  saveSettings(settings);
}

export function updateChunkCount(count: number): void {
  const settings = loadSettings();
  settings.chunkCount = count;
  saveSettings(settings);
}

export function updateChunkOverlap(overlap: number): void {
  const settings = loadSettings();
  settings.chunkOverlap = overlap;
  saveSettings(settings);
}

export function updateChunkSize(size: number): void {
  const settings = loadSettings();
  settings.chunkSize = size;
  saveSettings(settings);
}
