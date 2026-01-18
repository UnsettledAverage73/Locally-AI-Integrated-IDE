
import { useEffect, useState } from 'react';
import { PluginManager } from './PluginManager';

export function usePlugins(setCommands: React.Dispatch<React.SetStateAction<Map<string, () => void>>>) {
  const [pluginManager] = useState(() => new PluginManager(setCommands));

  useEffect(() => {
    const loadAndActivate = async () => {
      await pluginManager.loadPlugins();
      pluginManager.activatePlugins();
    };
    loadAndActivate();
  }, [pluginManager]);

  return pluginManager;
}
