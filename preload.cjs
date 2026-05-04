const { contextBridge, ipcRenderer } = require('electron');

const on = (channel, cb) => {
  const wrapped = (_e, ...args) => cb(...args);
  ipcRenderer.on(channel, wrapped);
  return () => ipcRenderer.removeListener(channel, wrapped);
};

contextBridge.exposeInMainWorld('echo', {
  startSession: () => ipcRenderer.invoke('session:start'),
  stopSession: () => ipcRenderer.invoke('session:stop'),
  sessionStatus: () => ipcRenderer.invoke('session:status'),

  getStartupStatus: () => ipcRenderer.invoke('startup:status'),
  onStartupStatus: (cb) => on('startup:status', (msg) => cb(msg)),
  onStartupReady: (cb) => on('startup:ready', (info) => cb(info)),

  onSessionStopped: (cb) => on('session:stopped', (...args) => cb(...args)),
  onBackendLog: (cb) => on('backend:log', (line) => cb(line)),

  runScript: (name) => ipcRenderer.invoke('scripts:run', name),

  pickFile: (opts) => ipcRenderer.invoke('dialog:pickFile', opts),
  pickFolder: (defaultPath) => ipcRenderer.invoke('dialog:pickFolder', defaultPath),
  getDefaultRecordingPath: () => ipcRenderer.invoke('recording:defaultPath'),
  getDefaultModelPath: () => ipcRenderer.invoke('models:defaultPath'),
  getDefaultCleanedPath: () => ipcRenderer.invoke('cleaned:defaultPath'),
  getDefaultWorkspacePath: () => ipcRenderer.invoke('workspaces:defaultPath'),
  saveDashboardWorkspace: (opts) => ipcRenderer.invoke('workspace:save', opts),
  loadDashboardWorkspace: (filePath) => ipcRenderer.invoke('workspace:load', filePath),
  startRecording: (opts) => ipcRenderer.invoke('recording:start', opts),
  stopRecording: () => ipcRenderer.invoke('recording:stop'),
});