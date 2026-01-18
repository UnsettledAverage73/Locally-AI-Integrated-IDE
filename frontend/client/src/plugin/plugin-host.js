
const localdev = {
  commands: {
    registerCommand: (id, command) => {
      self.postMessage({
        type: 'registerCommand',
        payload: { id },
      });
      self.addEventListener('message', (event) => {
        if (event.data.type === 'executeCommand' && event.data.payload.id === id) {
          command();
        }
      });
    },
  },
};

self.onmessage = async (event) => {
  const { type, payload } = event.data;

  if (type === 'load') {
    try {
      const { content } = await fetch(`http://localhost:8000/files/read?path=${payload.path}`).then(res => res.json());
      const pluginModule = (new Function(content + '; return module.exports;'))();
      self.plugin = pluginModule;
      self.postMessage({ type: 'loaded' });
    } catch (error) {
      console.error('Failed to load plugin:', error);
      self.postMessage({ type: 'loadFailed', payload: { error: error.message } });
    }
  }

  if (type === 'activate') {
    if (self.plugin && self.plugin.activate) {
      try {
        self.plugin.activate(localdev);
        self.postMessage({ type: 'activated' });
      } catch (error) {
        console.error('Failed to activate plugin:', error);
        self.postMessage({ type: 'activationFailed', payload: { error: error.message } });
      }
    }
  }
};
