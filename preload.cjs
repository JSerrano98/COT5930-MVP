const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('echo', {
  startSession: () => ipcRenderer.invoke('session:start'),
  stopSession: () => ipcRenderer.invoke('session:stop'),
  sessionStatus: () => ipcRenderer.invoke('session:status'),

  getStartupStatus: () => ipcRenderer.invoke('startup:status'),
  onStartupStatus: (cb) => ipcRenderer.on('startup:status', (_e, msg) => cb(msg)),
  onStartupReady: (cb) => ipcRenderer.on('startup:ready', (_e, info) => cb(info)),

  onSessionStopped: (cb) => ipcRenderer.on('session:stopped', (_e, ...args) => cb(...args)),
  onBackendLog: (cb) => ipcRenderer.on('backend:log', (_e, line) => cb(line)),

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