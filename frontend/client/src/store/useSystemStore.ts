import { create } from 'zustand';
import { State } from '@/lib/language-client';
import { llm, git } from '@/api/client';

interface SystemState {
  ollamaAvailable: boolean;
  hasCheckedOllama: boolean;
  ollamaModels: string[];
  lspStatus: State;
  currentBranch: string;

  // Actions
  setOllamaAvailable: (available: boolean) => void;
  setHasCheckedOllama: (checked: boolean) => void;
  setOllamaModels: (models: string[]) => void;
  setLspStatus: (status: State) => void;
  setCurrentBranch: (branch: string) => void;
  
  // Async Actions
  checkOllama: () => Promise<void>;
  fetchModels: () => Promise<void>;
  fetchBranch: () => Promise<void>;
}

export const useSystemStore = create<SystemState>((set, get) => ({
  ollamaAvailable: false,
  hasCheckedOllama: false,
  ollamaModels: [],
  lspStatus: State.Stopped,
  currentBranch: '...',

  setOllamaAvailable: (available) => set({ ollamaAvailable: available }),
  setHasCheckedOllama: (checked) => set({ hasCheckedOllama: checked }),
  setOllamaModels: (models) => set({ ollamaModels: models }),
  setLspStatus: (status) => set({ lspStatus: status }),
  setCurrentBranch: (branch) => set({ currentBranch: branch }),

  checkOllama: async () => {
    try {
      const status = await llm.check();
      set({ ollamaAvailable: status.available, hasCheckedOllama: true });
      if (status.available) {
        get().fetchModels();
      }
    } catch (e) {
      set({ ollamaAvailable: false, hasCheckedOllama: true });
    }
  },

  fetchModels: async () => {
    try {
      const { models } = await llm.models();
      set({ ollamaModels: models });
    } catch (e) {
      console.error("Failed to fetch models", e);
    }
  },

  fetchBranch: async () => {
    try {
        const { branch } = await git.getBranch();
        set({ currentBranch: branch });
    } catch (e) {
        set({ currentBranch: "offline" });
    }
  }
}));
