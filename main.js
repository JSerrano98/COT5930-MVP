import { app, BrowserWindow, ipcMain, Menu, dialog } from 'electron'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import process from 'process'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const preload = path.join(__dirname, 'preload.cjs')
const backendDir = path.join(__dirname, 'backend')

let win = null
let splashWin = null
let backendProc = null
let sessionRunning = false
let startupDone = false   // prevent re-running startup on HMR reloads

// Startup Helpers
// =========================

function sendStartupStatus(msg) {
  splashWin?.webContents?.send('splash:status', msg)
}

async function waitForBackend(retries = 40, delayMs = 500) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await fetch('http://127.0.0.1:8000/health')
      if (res.ok) return true
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, delayMs))
  }
  return false
}

async function runStartup() {
  if (startupDone) {
    win?.webContents?.send('startup:ready', { sessionRunning })
    return
  }

  sendStartupStatus('Starting backend…')
  const up = await waitForBackend()
  if (!up) {
    sendStartupStatus('Backend failed to start')
    return
  }

  sendStartupStatus('Starting session…')
  try {
    const res = await fetch('http://127.0.0.1:8000/session/start', { method: 'POST' })
    const body = await res.json()
    if (body.ok) {
      sessionRunning = true
    }
  } catch (e) {
    sendStartupStatus(`Session error: ${e.message}`)
  }

  // Keep sensor launch scripts manual-only; do not auto-run dev tools on app start.
  startupDone = true
  win?.webContents?.send('startup:ready', { sessionRunning })
}


// Backend Process Management
// =========================

function startBackend() {
  if (backendProc) return

  let cmd, args, cwd
  if (isDev) {
    const python = process.platform === 'win32' ? 'python' : 'python3'
    cmd  = python
    args = ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8000']
    cwd  = backendDir
  } else {
    const ext = process.platform === 'win32' ? '.exe' : ''
    cmd  = path.join(process.resourcesPath, 'backend', 'session', `session${ext}`)
    args = []
    cwd  = path.join(process.resourcesPath, 'backend', 'session')
  }

  const userDataDir = app.getPath('userData')

  backendProc = spawn(cmd, args, {
    cwd,
    env: { ...process.env, APP_USER_DATA: userDataDir },
  })

  const sendLog = (line) => {
    const text = line.toString().trim()
    if (!text) return
    process.stderr.write(`[backend] ${text}\n`)
    win?.webContents?.send('backend:log', text)
  }

  backendProc.stdout.on('data', sendLog)
  backendProc.stderr.on('data', sendLog)

  backendProc.on('exit', (code) => {
    win?.webContents?.send('backend:log', `[backend exited with code ${code}]`)
    backendProc = null
    if (sessionRunning) {
      sessionRunning = false
      win?.webContents?.send('session:stopped')
    }
  })
}

function stopBackend() {
  if (!backendProc) return
  backendProc.kill()
  backendProc = null
  sessionRunning = false
  startupDone = false
}


// Script Management
// =========================

const SCRIPTS = {
  'Start All Sensors':       path.join(backendDir, 'sensors', 'start_all_sensors.py'),
  'Start Dummy Sensors Only': path.join(backendDir, 'sensors', 'start_all_dummy.py'),
}

let scriptProcs = {}

function runScript(name) {
  if (scriptProcs[name]) return { ok: false, error: 'Already running' }
  const scriptPath = SCRIPTS[name]
  if (!scriptPath) return { ok: false, error: 'Unknown script' }

  const python = process.platform === 'win32' ? 'python' : 'python3'
  const proc = spawn(python, [scriptPath], {
    cwd: backendDir,
    env: { ...process.env, PYTHONPATH: backendDir },
  })

  const sendLog = (line) => {
    const text = line.toString().trim()
    if (!text) return
    win?.webContents?.send('backend:log', `[${name}] ${text}`)
  }

  proc.stdout.on('data', sendLog)
  proc.stderr.on('data', sendLog)
  proc.on('exit', () => { delete scriptProcs[name] })

  scriptProcs[name] = proc
  return { ok: true }
}


// Application Menu
// =========================

function buildMenu() {
  const scriptItems = Object.keys(SCRIPTS).map((name) => ({
    label: name,
    click: () => runScript(name),
  }))

  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Scripts',
          submenu: scriptItems,
        },
        { type: 'separator' },
        { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    { role: 'viewMenu' },
    { role: 'windowMenu' },
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}


// IPC Handlers
// =========================

ipcMain.handle('session:start', async () => {
  try {
    const res = await fetch('http://127.0.0.1:8000/session/start', { method: 'POST' })
    const body = await res.json()
    if (body.ok) { sessionRunning = true; return { ok: true } }
    return { ok: false, error: body.detail ?? 'Failed to start session' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('startup:status', () => ({
  done: startupDone,
  sessionRunning,
}))

ipcMain.handle('session:stop', async () => {
  try {
    await fetch('http://127.0.0.1:8000/session/stop', { method: 'POST' })
  } catch { /* ignore if already down */ }
  sessionRunning = false
  return { ok: true }
})

ipcMain.handle('session:status', () => ({ running: sessionRunning }))

ipcMain.handle('scripts:run', (_e, name) => runScript(name))

ipcMain.handle('dialog:pickFile', async (_e, { defaultPath, filters } = {}) => {
  const target = BrowserWindow.getFocusedWindow() ?? win
  const result = await dialog.showOpenDialog(target, {
    title: 'Choose File',
    defaultPath: defaultPath ?? app.getPath('documents'),
    properties: ['openFile'],
    filters: filters ?? [{ name: 'All Files', extensions: ['*'] }],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('dialog:pickFolder', async (_e, defaultPath) => {
  const target = BrowserWindow.getFocusedWindow() ?? win
  const result = await dialog.showOpenDialog(target, {
    title: 'Choose Recording Folder',
    defaultPath: defaultPath ?? app.getPath('documents'),
    properties: ['openDirectory', 'createDirectory'],
  })
  return result.canceled ? null : result.filePaths[0]
})

ipcMain.handle('recording:defaultPath', () => {
  const p = path.join(app.getPath('documents'), 'ECHO', 'Session Recordings')
  try { fs.mkdirSync(p, { recursive: true }) } catch { /* ignore */ }
  return p
})

ipcMain.handle('models:defaultPath', () => {
  const p = path.join(app.getPath('documents'), 'ECHO', 'Trained Models')
  try { fs.mkdirSync(p, { recursive: true }) } catch { /* ignore */ }
  return p
})

ipcMain.handle('cleaned:defaultPath', () => {
  const p = path.join(app.getPath('documents'), 'ECHO', 'Cleaned Datasets')
  try { fs.mkdirSync(p, { recursive: true }) } catch { /* ignore */ }
  return p
})

ipcMain.handle('workspaces:defaultPath', () => {
  const p = path.join(app.getPath('documents'), 'ECHO', 'Dashboard Workspaces')
  try { fs.mkdirSync(p, { recursive: true }) } catch { /* ignore */ }
  return p
})

ipcMain.handle('workspace:save', async (_e, { directory, name, workspace }) => {
  try {
    const baseDir = (directory && String(directory).trim())
      ? String(directory).trim()
      : path.join(app.getPath('documents'), 'ECHO', 'Dashboard Workspaces')
    fs.mkdirSync(baseDir, { recursive: true })

    const safeName = (String(name || 'workspace').trim() || 'workspace')
      .replace(/[<>:"/\\|?*]/g, '_')
      .replace(/\s+/g, '_')
    const fileName = safeName.toLowerCase().endsWith('.json') ? safeName : `${safeName}.json`
    const filePath = path.join(baseDir, fileName)

    const payload = {
      version: 1,
      savedAt: new Date().toISOString(),
      ...workspace,
    }
    fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
    return { ok: true, path: filePath }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('workspace:load', async (_e, filePath) => {
  try {
    const p = String(filePath || '').trim()
    if (!p) return { ok: false, error: 'Missing workspace file path' }
    const text = fs.readFileSync(p, 'utf-8')
    const data = JSON.parse(text)
    return { ok: true, path: p, workspace: data }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('recording:start', async (_e, { filePath, format }) => {
  try {
    const res = await fetch('http://127.0.0.1:8000/record/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file_path: filePath, format }),
    })
    return await res.json()
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('recording:stop', async () => {
  try {
    const res = await fetch('http://127.0.0.1:8000/record/stop', { method: 'POST' })
    return await res.json()
  } catch (e) {
    return { ok: false, error: e.message }
  }
})


// Window Boot
// =========================

const VITE_URL = 'http://localhost:5173'

function createSplashWindow() {
  splashWin = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1c1917',
    frame: false,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  })
  const splashPath = isDev
    ? path.join(__dirname, 'public', 'splash.html')
    : path.join(__dirname, 'dist', 'splash.html')
  splashWin.loadFile(splashPath)
}

function createMainWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#1c1917',
    show: false,
    icon: path.join(__dirname, 'public', 'favicon.ico'),
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })
}

function loadRenderer() {
  if (!win || win.isDestroyed()) return

  if (isDev) {
    const tryLoadVite = () => {
      win.loadURL(VITE_URL).catch(() => {
        if (!win.isDestroyed()) setTimeout(tryLoadVite, 300)
      })
    }
    tryLoadVite()
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

function dismissSplash() {
  if (!splashWin || splashWin.isDestroyed()) return
  splashWin.close()
  splashWin = null
}

app.whenReady().then(() => {
  buildMenu()
  startBackend()

  // Splash shows immediately; main window loads React hidden in background.
  // When BOTH startup is done AND React has painted its first frame, swap them.
  createSplashWindow()
  createMainWindow()
  loadRenderer()

  const reactReady = new Promise(resolve => win.once('ready-to-show', resolve))

  Promise.all([runStartup(), reactReady]).then(() => {
    dismissSplash()
    win.show()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow()
      loadRenderer()
      if (startupDone) {
        win.show()
      } else {
        Promise.all([
          runStartup(),
          new Promise(resolve => win.once('ready-to-show', resolve)),
        ]).then(() => win.show())
      }
    }
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  Object.values(scriptProcs).forEach((p) => p.kill())
  if (process.platform !== 'darwin') app.quit()
})