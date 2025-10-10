const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bandit', {
  send: (ch, data) => ipcRenderer.send(ch, data),
  on:   (ch, fn)   => ipcRenderer.on(ch, (_e, ...args) => fn(...args)),
});
