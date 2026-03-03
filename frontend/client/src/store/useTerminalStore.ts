import { create } from 'zustand';
import { apiClient } from '@/api/client';

interface TerminalState {
  terminalSessions: string[];
  activeTerminal: string;

  // Actions
  setTerminalSessions: (sessions: string[]) => void;
  setActiveTerminal: (id: string) => void;
  
  // Async Actions
  createTerminal: () => Promise<void>;
}

export const useTerminalStore = create<TerminalState>((set, get) => ({
  terminalSessions: [],
  activeTerminal: '',

  setTerminalSessions: (sessions) => set({ terminalSessions: sessions }),
  setActiveTerminal: (id) => set({ activeTerminal: id }),

  createTerminal: async () => {
    try {
        const response = await apiClient.post('/terminals');
        const { session_id } = response.data;
        const { terminalSessions } = get();
        set({ 
            terminalSessions: [...terminalSessions, session_id],
            activeTerminal: session_id
        });
    } catch (e) {
        console.error("Failed to create terminal", e);
    }
  }
}));
