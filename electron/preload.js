// This file is intentionally left blank.
// It is used as a preload script for the Electron browser window.
const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('fileSystem', {
  //Invoke Native "open folder" dialog
  selectFolder: () => ipcRenderer.invoke('dialog:openFolder'),

  // Invoke Native "open files" dialog
  selectFiles: () => ipcRenderer.invoke('dialog:openFiles'),

  // Invoke Native "save file" dialog
  saveFile: (defaultName, content) => ipcRenderer.invoke('dialog:saveFile', defaultName, content),

  // Listen for Menu Commands (eg File -> save)
  onSaveCommand: (callback) => ipcRenderer.on('menu:save', callback)
});


