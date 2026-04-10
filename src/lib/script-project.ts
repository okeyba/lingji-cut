import type { WorkspaceFilesState } from '../store/script';

export function createBlankScriptProjectState(projectDir: string): {
  projectDir: string;
  currentStep: 0;
  originalText: string;
  scriptText: string;
  selectedTemplate: 'news-broadcast';
  annotations: [];
  workspaceFiles: WorkspaceFilesState;
  reviewState: 'idle';
  scriptDocVersion: 0;
} {
  return {
    projectDir,
    currentStep: 0,
    originalText: '',
    scriptText: '',
    selectedTemplate: 'news-broadcast',
    annotations: [],
    workspaceFiles: {
      hasOriginalFile: false,
      hasScriptFile: false,
    },
    reviewState: 'idle',
    scriptDocVersion: 0,
  };
}
