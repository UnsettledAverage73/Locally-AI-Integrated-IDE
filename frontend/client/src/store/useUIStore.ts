import { create } from 'zustand';

type SidebarView = 'explorer' | 'git' | 'system' | 'search' | 'browser';

interface UIState {
  activeView: SidebarView;
  isSidebarVisible: boolean;
  isPanelVisible: boolean;
  isSettingsOpen: boolean;
  isBooting: boolean;

  // Actions
  setActiveView: (view: SidebarView) => void;
  toggleSidebar: () => void;
  togglePanel: () => void;
  setIsSettingsOpen: (open: boolean) => void;
  setIsBooting: (booting: boolean) => void;
  handleViewChange: (view: SidebarView) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeView: 'explorer',
  isSidebarVisible: true,
  isPanelVisible: true,
  isSettingsOpen: false,
  isBooting: true,

  setActiveView: (view) => set({ activeView: view }),
  
  toggleSidebar: () => set((state) => ({ isSidebarVisible: !state.isSidebarVisible })),
  
  togglePanel: () => set((state) => ({ isPanelVisible: !state.isPanelVisible })),
  
  setIsSettingsOpen: (open) => set({ isSettingsOpen: open }),
  
  setIsBooting: (booting) => set({ isBooting: booting }),

  handleViewChange: (view) => {
    const { activeView, isSidebarVisible } = get();
    if (activeView === view && isSidebarVisible) {
        set({ isSidebarVisible: false });
    } else {
        set({ activeView: view, isSidebarVisible: true });
    }
  }
}));
