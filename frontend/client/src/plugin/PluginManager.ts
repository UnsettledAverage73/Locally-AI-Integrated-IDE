
import { fs } from "@/api/client";

export interface PluginManifest {
  name: string;
  version: string;
  main: string;
}

export class PluginManager {
  private workers: { [pluginName: string]: Worker } = {};
  private setCommands: React.Dispatch<React.SetStateAction<Map<string, () => void>>>;

  constructor(setCommands: React.Dispatch<React.SetStateAction<Map<string, () => void>>>) {
    this.setCommands = setCommands;
  }

  async loadPlugins() {
    try {
      const entries = await fs.getFileTree("plugins");
      for (const entry of entries) {
        if (entry.isDirectory) {
          const pluginPath = entry.path;
          try {
            const manifestContent = await fs.readFile(`${pluginPath}/plugin.json`);
            const manifest = JSON.parse(manifestContent.content) as PluginManifest;

            const worker = new Worker(new URL('./plugin-host.js', import.meta.url), { type: 'module' });
            this.workers[manifest.name] = worker;

            worker.onmessage = (event) => {
              const { type, payload } = event.data;
              if (type === 'registerCommand') {
                this.setCommands(prevCommands => {
                  const newCommands = new Map(prevCommands);
                  newCommands.set(payload.id, () => worker.postMessage({ type: 'executeCommand', payload: { id: payload.id } }));
                  return newCommands;
                });
              }
            };
            
            worker.postMessage({
              type: 'load',
              payload: {
                path: `${pluginPath}/${manifest.main}`
              }
            });

          } catch (error) {
            console.error(`Failed to load plugin from ${pluginPath}`, error);
          }
        }
      }
    } catch (error) {
      console.error("Failed to scan plugins directory:", error);
    }
  }

  activatePlugins() {
    for (const worker of Object.values(this.workers)) {
      worker.postMessage({ type: 'activate' });
    }
  }
}

