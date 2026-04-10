import { create } from 'zustand';
import {
  createPersistedAIState,
  selectCoverCandidate,
  toggleCardEnabledInResult,
  updateCardInResult,
} from '../lib/ai-persistence';
import { migrateToProviders } from '../lib/llm/provider-utils';
import type { AIAnalysisResult, AICard, AISettings, CoverCandidate } from '../types/ai';
import type { SaveStatus } from './timeline';
import { getCurrentProjectDir } from './timeline';

export type WorkflowStep =
  | 'idle'
  | 'tts_generating'
  | 'tts_done'
  | 'ai_analyzing'
  | 'cover_generating'
  | 'arranging'
  | 'done'
  | 'error';

export interface WorkflowState {
  step: WorkflowStep;
  progress: number;
  stepLabel: string;
  error: string | null;
  canCancel: boolean;
}

export const DEFAULT_WORKFLOW: WorkflowState = {
  step: 'idle',
  progress: 0,
  stepLabel: '',
  error: null,
  canCancel: false,
};

const AI_SETTINGS_LEGACY_KEY = 'podcast-editor-ai-settings';

export type AITab = 'cards' | 'cover';

export interface AIStore {
  analysisResult: AIAnalysisResult | null;
  isAnalyzing: boolean;
  analysisError: string | null;
  coverCandidates: CoverCandidate[];
  isGeneratingCovers: boolean;
  activeTab: AITab;
  setAnalysisResult: (result: AIAnalysisResult) => void;
  setAnalyzing: (analyzing: boolean) => void;
  setAnalysisError: (error: string | null) => void;
  toggleCardEnabled: (cardId: string) => void;
  updateCard: (cardId: string, updates: Partial<AICard>) => void;
  setCoverCandidates: (candidates: CoverCandidate[]) => void;
  selectCover: (candidateId: string) => void;
  setGeneratingCovers: (generating: boolean) => void;
  setActiveTab: (tab: AITab) => void;
  clearAnalysis: () => void;
  workflow: WorkflowState;
  setWorkflow: (updates: Partial<WorkflowState>) => void;
  resetWorkflow: () => void;
}

export const useAIStore = create<AIStore>((set) => ({
  analysisResult: null,
  isAnalyzing: false,
  analysisError: null,
  coverCandidates: [],
  isGeneratingCovers: false,
  activeTab: 'cards',
  setAnalysisResult: (result) => set({ analysisResult: result, analysisError: null }),
  setAnalyzing: (analyzing) => set({ isAnalyzing: analyzing }),
  setAnalysisError: (error) => set({ analysisError: error, isAnalyzing: false }),
  toggleCardEnabled: (cardId) =>
    set((state) => ({
      analysisResult: toggleCardEnabledInResult(state.analysisResult, cardId),
    })),
  updateCard: (cardId, updates) =>
    set((state) => ({
      analysisResult: updateCardInResult(state.analysisResult, cardId, updates),
    })),
  setCoverCandidates: (candidates) => set({ coverCandidates: candidates }),
  selectCover: (candidateId) =>
    set((state) => ({
      coverCandidates: selectCoverCandidate(state.coverCandidates, candidateId),
    })),
  setGeneratingCovers: (generating) => set({ isGeneratingCovers: generating }),
  setActiveTab: (tab) => set({ activeTab: tab }),
  clearAnalysis: () => set({ analysisResult: null, analysisError: null, coverCandidates: [] }),
  workflow: { ...DEFAULT_WORKFLOW },
  setWorkflow: (updates) =>
    set((state) => ({
      workflow: { ...state.workflow, ...updates },
    })),
  resetWorkflow: () => set({ workflow: { ...DEFAULT_WORKFLOW } }),
}));

export async function loadAISettings(): Promise<AISettings | null> {
  // 优先从 Electron 全局存储读取
  if (typeof window !== 'undefined' && window.electronAPI?.loadGlobalSettings) {
    try {
      const raw = await window.electronAPI.loadGlobalSettings();
      if (raw) {
        const file = JSON.parse(raw) as { aiSettings: AISettings };
        const hadProviders =
          Array.isArray(file.aiSettings.llmProviders) &&
          file.aiSettings.llmProviders.length > 0;
        const settings: AISettings = {
          ...file.aiSettings,
          llmProviders: file.aiSettings.llmProviders ?? [],
          defaultProviderId: file.aiSettings.defaultProviderId ?? null,
          defaultModel: file.aiSettings.defaultModel ?? null,
          enableThinking: file.aiSettings.enableThinking ?? true,
          minimaxApiKey: file.aiSettings.minimaxApiKey ?? '',
          minimaxVoiceId: file.aiSettings.minimaxVoiceId ?? 'male-qn-qingse',
          minimaxSpeed: file.aiSettings.minimaxSpeed ?? 1.0,
          minimaxVol: file.aiSettings.minimaxVol ?? 1.0,
          minimaxPitch: file.aiSettings.minimaxPitch ?? 0,
          minimaxEmotion: file.aiSettings.minimaxEmotion ?? '',
          minimaxModel: file.aiSettings.minimaxModel ?? 'speech-2.8-hd',
        };
        const migrated = migrateToProviders(settings);
        // 迁移产生了新 provider，持久化
        if (!hadProviders && migrated.llmProviders.length > 0) {
          void saveAISettings(migrated);
        }
        return migrated;
      }
    } catch {
      // fallthrough to legacy
    }
  }

  // 兼容：从 localStorage 读取旧数据并自动迁移
  if (typeof window !== 'undefined' && typeof window.localStorage !== 'undefined') {
    const rawValue = window.localStorage.getItem(AI_SETTINGS_LEGACY_KEY);
    if (rawValue) {
      try {
        const parsed = JSON.parse(rawValue) as AISettings;
        const raw: AISettings = {
          ...parsed,
          llmProviders: parsed.llmProviders ?? [],
          defaultProviderId: parsed.defaultProviderId ?? null,
          defaultModel: parsed.defaultModel ?? null,
          enableThinking: parsed.enableThinking ?? true,
          minimaxApiKey: parsed.minimaxApiKey ?? '',
          minimaxVoiceId: parsed.minimaxVoiceId ?? 'male-qn-qingse',
          minimaxSpeed: parsed.minimaxSpeed ?? 1.0,
          minimaxVol: parsed.minimaxVol ?? 1.0,
          minimaxPitch: parsed.minimaxPitch ?? 0,
          minimaxEmotion: parsed.minimaxEmotion ?? '',
          minimaxModel: parsed.minimaxModel ?? 'speech-2.8-hd',
        };
        const settings = migrateToProviders(raw);
        // 自动迁移到 Electron 全局存储
        await saveAISettings(settings);
        window.localStorage.removeItem(AI_SETTINGS_LEGACY_KEY);
        return settings;
      } catch {
        return null;
      }
    }
  }

  return null;
}

export async function saveAISettings(settings: AISettings): Promise<void> {
  if (typeof window !== 'undefined' && window.electronAPI?.saveGlobalSettings) {
    const file = { aiSettings: settings };
    await window.electronAPI.saveGlobalSettings(JSON.stringify(file));
  }
}

// ─── AI Save Status ──────────────────────────────────────────────────────────

let currentAISaveStatus: SaveStatus = 'idle';
const aiSaveStatusListeners = new Set<(status: SaveStatus) => void>();

function emitAISaveStatus(status: SaveStatus): void {
  currentAISaveStatus = status;
  for (const listener of aiSaveStatusListeners) {
    listener(status);
  }
}

export function getCurrentAISaveStatus(): SaveStatus {
  return currentAISaveStatus;
}

export function subscribeToAISaveStatus(listener: (status: SaveStatus) => void): () => void {
  aiSaveStatusListeners.add(listener);
  listener(currentAISaveStatus);
  return () => {
    aiSaveStatusListeners.delete(listener);
  };
}

// ─── Auto-save subscription ──────────────────────────────────────────────────

let aiSaveTimer: ReturnType<typeof setTimeout> | null = null;

if (typeof window !== 'undefined') {
  useAIStore.subscribe((state, prevState) => {
    if (
      state.analysisResult === prevState.analysisResult &&
      state.coverCandidates === prevState.coverCandidates
    ) {
      return;
    }

    const projectDir = getCurrentProjectDir();
    if (!projectDir || !window.electronAPI?.saveProjectSection) {
      return;
    }

    emitAISaveStatus('saving');
    if (aiSaveTimer) {
      clearTimeout(aiSaveTimer);
    }

    aiSaveTimer = setTimeout(() => {
      const persistedState = createPersistedAIState(
        state.analysisResult,
        state.coverCandidates,
      );
      void window.electronAPI
        .saveProjectSection(projectDir, 'aiAnalysis', JSON.stringify(persistedState))
        .then(() => {
          emitAISaveStatus('saved');
        })
        .catch((error) => {
          console.error('保存 AI 分析数据失败:', error);
          emitAISaveStatus('error');
        });
    }, 300);
  });
}
