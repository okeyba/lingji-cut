// src/lib/script-persistence.ts
import type { Annotation, ScriptStep } from '../store/script';

export interface PersistedScriptState {
  version: 1;
  currentStep: ScriptStep;
  templateId: string;
  annotations: Annotation[];
  createdAt: string;
  updatedAt: string;
}

export function createPersistedScriptState(
  currentStep: ScriptStep,
  templateId: string,
  annotations: Annotation[],
  createdAt?: string,
): PersistedScriptState {
  return {
    version: 1,
    currentStep,
    templateId,
    annotations,
    createdAt: createdAt ?? new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export function parsePersistedScriptState(raw: unknown): PersistedScriptState | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  if (typeof obj.currentStep !== 'number') return null;

  return {
    version: 1,
    currentStep: obj.currentStep as ScriptStep,
    templateId: (obj.templateId as string) ?? 'news-broadcast',
    annotations: Array.isArray(obj.annotations) ? (obj.annotations as Annotation[]) : [],
    createdAt: (obj.createdAt as string) ?? new Date().toISOString(),
    updatedAt: (obj.updatedAt as string) ?? new Date().toISOString(),
  };
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;

export function debouncedSaveFile(
  projectDir: string,
  filename: string,
  content: string,
  delayMs = 1000,
): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    void window.electronAPI.saveScriptFile(projectDir, filename, content);
  }, delayMs);
}

export async function saveScriptState(
  projectDir: string,
  state: PersistedScriptState,
): Promise<void> {
  await window.electronAPI.saveScriptState(projectDir, JSON.stringify(state, null, 2));
}

export async function loadScriptState(
  projectDir: string,
): Promise<PersistedScriptState | null> {
  const raw = await window.electronAPI.loadScriptState(projectDir);
  if (!raw) return null;

  try {
    return parsePersistedScriptState(JSON.parse(raw));
  } catch {
    return null;
  }
}
