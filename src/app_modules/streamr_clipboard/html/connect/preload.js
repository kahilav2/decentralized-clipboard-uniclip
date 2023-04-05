const { contextBridge, ipcRenderer } = require('electron');

const config = new Promise((resolve, _) => {
  ipcRenderer.on('config', (event, cfg) => {
    cfg.streamId = cfg.streamUrl.split('/')[1];
    resolve(cfg);
  });
});

contextBridge.exposeInMainWorld('uniclip', {
  finish: (json) => ipcRenderer.send('finished', json),
  getConfig: () => config
});
