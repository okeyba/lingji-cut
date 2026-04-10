import fs from 'node:fs/promises';
import path from 'node:path';
import type { AISettings } from '../src/types/ai';

export interface GlobalSettingsFile {
  aiSettings: AISettings;
}

const SETTINGS_FILE = 'settings.json';

export async function loadGlobalSettings(
  userDataPath: string,
): Promise<GlobalSettingsFile | null> {
  try {
    const raw = await fs.readFile(
      path.join(userDataPath, SETTINGS_FILE),
      'utf-8',
    );
    return JSON.parse(raw) as GlobalSettingsFile;
  } catch {
    return null;
  }
}

export async function saveGlobalSettings(
  userDataPath: string,
  settings: GlobalSettingsFile,
): Promise<void> {
  await fs.mkdir(userDataPath, { recursive: true });
  await fs.writeFile(
    path.join(userDataPath, SETTINGS_FILE),
    JSON.stringify(settings, null, 2),
    'utf-8',
  );
}
