import React, { createContext, useState, useContext, ReactNode, useEffect } from 'react';

export type AIMode = 'local' | 'enterprise';

interface Settings {
  aiMode: AIMode;
  setAiMode: (mode: AIMode) => void;
  enterpriseHost: string;
  setEnterpriseHost: (host: string) => void;
}

const SettingsContext = createContext<Settings | undefined>(undefined);

export const SettingsProvider = ({ children }: { children: ReactNode }) => {
  const [aiMode, setAiModeState] = useState<AIMode>(() => (localStorage.getItem('ai_mode') as AIMode) || 'local');
  const [enterpriseHost, setEnterpriseHostState] = useState<string>(() => localStorage.getItem('ai_enterprise_host') || '');

  const setAiMode = (mode: AIMode) => {
    localStorage.setItem('ai_mode', mode);
    setAiModeState(mode);
  };

  const setEnterpriseHost = (host: string) => {
    localStorage.setItem('ai_enterprise_host', host);
    setEnterpriseHostState(host);
  };

  return (
    <SettingsContext.Provider value={{ aiMode, setAiMode, enterpriseHost, setEnterpriseHost }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = () => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
