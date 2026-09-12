const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('tiktokKite', {
  startConnection: (username) => ipcRenderer.send('start-connection', username),
  changeGame: (url) => ipcRenderer.send('change-game', url),
  changeVolume: (volume) => ipcRenderer.send('change-volume', volume),
  sendOverlayConfig: (data) => ipcRenderer.send('overlay-config', data),
  sendTestEvent: (type) => ipcRenderer.send('test-event', type),
  onConnectionStatus: (callback) => {
    ipcRenderer.on('connection-status', (_event, data) => callback(data));
  }
});
