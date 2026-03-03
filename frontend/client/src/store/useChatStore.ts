import { create } from 'zustand';
import { apiClient } from '@/api/client';
import { ChatMessage } from '@/types';
import { toast } from '@/hooks/use-toast';

interface ChatState {
  chatSessions: any[];
  currentSessionId: string | null;
  chatMessages: ChatMessage[];
  isChatLoading: boolean;

  // Actions
  setChatMessages: (messages: ChatMessage[]) => void;
  setCurrentSessionId: (id: string | null) => void;
  
  // Async Actions
  fetchChatSessions: () => Promise<void>;
  selectSession: (sessionId: string) => Promise<void>;
  createNewChat: () => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  clearChat: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  chatSessions: [],
  currentSessionId: localStorage.getItem("currentSessionId"),
  chatMessages: [],
  isChatLoading: false,

  setChatMessages: (messages) => set({ chatMessages: messages }),
  
  setCurrentSessionId: (id) => {
    if (id) localStorage.setItem("currentSessionId", id);
    else localStorage.removeItem("currentSessionId");
    set({ currentSessionId: id });
  },

  fetchChatSessions: async () => {
    try {
      const res = await apiClient.get("/chat/sessions");
      set({ chatSessions: res.data });
    } catch (e) {
      console.error("Failed to fetch chat sessions", e);
    }
  },

  selectSession: async (sessionId: string) => {
    try {
      set({ isChatLoading: true });
      const res = await apiClient.get(`/chat/sessions/${sessionId}`);
      set({ 
        chatMessages: res.data.messages || [],
        currentSessionId: sessionId,
        isChatLoading: false
      });
      localStorage.setItem("currentSessionId", sessionId);
    } catch (e) {
      set({ isChatLoading: false });
      toast({ title: "Error", description: "Failed to load chat history.", variant: "destructive" });
    }
  },

  createNewChat: async () => {
    try {
      const model = localStorage.getItem("ai_model") || "qwen2.5:0.5b";
      const res = await apiClient.post("/chat/sessions", { model });
      const { session_id } = res.data;
      
      set({ 
        currentSessionId: session_id,
        chatMessages: []
      });
      localStorage.setItem("currentSessionId", session_id);
      get().fetchChatSessions();
    } catch (e) {
      toast({ title: "Error", description: "Failed to create new chat.", variant: "destructive" });
    }
  },

  deleteSession: async (sessionId: string) => {
    try {
      await apiClient.delete(`/chat/sessions/${sessionId}`);
      const { currentSessionId } = get();
      if (currentSessionId === sessionId) {
        set({ currentSessionId: null, chatMessages: [] });
        localStorage.removeItem("currentSessionId");
      }
      get().fetchChatSessions();
    } catch (e) {
      toast({ title: "Error", description: "Failed to delete chat.", variant: "destructive" });
    }
  },

  clearChat: () => set({ chatMessages: [] })
}));
