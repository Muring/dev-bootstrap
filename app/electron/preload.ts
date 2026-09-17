import { contextBridge, ipcRenderer } from 'electron';
contextBridge.exposeInMainWorld('bootstrap', {
  snapshot: () => ipcRenderer.invoke('snapshot'),
  catalog: () => ipcRenderer.invoke('catalog'),
  save: (config: unknown) => ipcRenderer.invoke('save', config),
  inspect: () => ipcRenderer.invoke('inspect'),
  prepare: () => ipcRenderer.invoke('prepare'),
  install: () => ipcRenderer.invoke('install'),
  run: (step?: string) => ipcRenderer.invoke('run', step),
  stop: () => ipcRenderer.invoke('stop'),
  login: (tool: string) => ipcRenderer.invoke('login', tool),
  shutdown: () => ipcRenderer.invoke('shutdown'),
  reboot: () => ipcRenderer.invoke('reboot'),
  logs: () => ipcRenderer.invoke('logs'),
});
