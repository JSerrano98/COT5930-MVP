const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('echo', {
  // Session management
  startSession: () => ipcRenderer.invoke('session:start'),
  stopSession: () => ipcRenderer.invoke('session:stop'),
  sessionStatus: () => ipcRenderer.invoke('session:status'),

  // Event listeners (renderer ← main)
  onSessionStopped: (cb) => ipcRenderer.on('session:stopped', (_e, ...args) => cb(...args)),
  onBackendLog: (cb) => ipcRenderer.on('backend:log', (_e, line) => cb(line)),

  // Scripts
  runScript: (name) => ipcRenderer.invoke('scripts:run', name),
});
