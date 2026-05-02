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
let backendProc = null
let sessionRunning = false
let startupDone = false   // prevent re-running startup on HMR reloads

// Send a startup status line to the renderer (if it's ready)
function sendStartupStatus(msg) {
  win?.webContents?.send('startup:status', msg)
}

// Wait until GET /health returns 200
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

// Full startup sequence: backend → session
async function runStartup() {
  if (startupDone) {
    // HMR reload — session is already running, just tell the renderer
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

  sendStartupStatus('Starting sensors…')
  runScript('Start All Sensors')

  startupDone = true
  win?.webContents?.send('startup:ready', { sessionRunning })
}

// ─── Backend process management ──────────────────────────────────────────────

function startBackend() {
  if (backendProc) return

  const python = process.platform === 'win32' ? 'python' : 'python3'
  backendProc = spawn(python, ['-m', 'uvicorn', 'app:app', '--host', '127.0.0.1', '--port', '8000'], {
    cwd: backendDir,
    env: { ...process.env },
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

// ─── Scripts ──────────────────────────────────────────────────────────────────

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

// ─── Native menu ──────────────────────────────────────────────────────────────

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

// ─── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('session:start', async () => {
  // Called manually (e.g. after a stop). Startup sequence handles the initial start.
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

// ─── Window ───────────────────────────────────────────────────────────────────

const VITE_URL = 'http://localhost:5173'

function buildNativeSplashHtml() {
  return `<!doctype html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>ECHO</title>
    <style>
      :root { color-scheme: light; }
      html, body {
        margin: 0;
        width: 100%;
        height: 100%;
        background: #f5f5f4;
      }
      body {
        display: flex;
        align-items: center;
        justify-content: center;
        font-family: "Segoe UI", Arial, sans-serif;
      }
      .wrap {
        display: flex;
        flex-direction: column;
        align-items: center;
      }
      .title {
        margin: 0;
        font-size: 88px;
        letter-spacing: 0.08em;
        color: #1c1917;
        font-family: "Bebas Neue", Impact, sans-serif;
      }
      .subtitle {
        margin: 4px 0 22px;
        font-size: 11px;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: #78716c;
      }
      .spinner {
        width: 34px;
        height: 34px;
        border: 2px solid rgba(255, 122, 0, 0.25);
        border-top-color: #FF7A00;
        border-radius: 9999px;
        animation: spin 0.8s linear infinite;
      }
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    </style>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Bebas+Neue&display=swap" rel="stylesheet" />
  </head>
  <body>
    <div class="wrap">
      <h1 class="title">ECHO</h1>
      <p class="subtitle">Enhanced Cognitive Human Operations</p>
      <div class="spinner"></div>
    </div>
  </body>
</html>`
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

const createWindow = () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    backgroundColor: '#f5f5f4',
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  // Show splash immediately while backend/session/sensors initialize.
  const splashHtml = buildNativeSplashHtml()
  win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(splashHtml)}`)
}

app.whenReady().then(() => {
  buildMenu()
  startBackend()   // start backend immediately — no need to wait for window
  createWindow()
  runStartup().finally(() => loadRenderer())

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
      if (startupDone) {
        loadRenderer()
      } else {
        runStartup().finally(() => loadRenderer())
      }
    }
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  Object.values(scriptProcs).forEach((p) => p.kill())
  if (process.platform !== 'darwin') app.quit()
})