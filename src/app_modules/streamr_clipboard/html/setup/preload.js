const { contextBridge, ipcRenderer } = require('electron');

const settings = new Promise((resolve, reject) => {
  ipcRenderer.on('settings', (event, settings) => {
    if (settings.appModuleConfig) {
      settings.appModuleConfig.streamId = settings.appModuleConfig.streamUrl?.split('/')[1]; //TODO: align naming with streamr-client (streamId vs streamUrl)
    }
    resolve(settings);
  });
});

contextBridge.exposeInMainWorld('uniclip', {
  finish: (json) => ipcRenderer.send('finished', json),
  getSettings: () => settings,
  setOpenAtLogin: (openAtLogin) => ipcRenderer.send('setOpenAtLogin', openAtLogin)
});
