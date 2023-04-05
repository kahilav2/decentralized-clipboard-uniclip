const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('uniclip', {
  finish: (json) => ipcRenderer.send('finished', json)
});
