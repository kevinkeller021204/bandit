import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('bandit', {
  send: (channel, data) => ipcRenderer.send(channel, data),
  on:   (channel, handler) => ipcRenderer.on(channel, (_e, ...args) => handler(...args))
});
