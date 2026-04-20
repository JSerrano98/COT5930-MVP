import { app, BrowserWindow, ipcMain, Menu } from 'electron'
import { spawn } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import process from 'process'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const isDev = process.env.NODE_ENV === 'development'
const preload = path.join(__dirname, 'preload.cjs')
const backendDir = path.join(__dirname, 'backend')

let win = null
let backendProc = null
let sessionRunning = false

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
  // Poll until the backend is ready (it may still be starting up)
  for (let i = 0; i < 10; i++) {
    try {
      const h = await fetch('http://127.0.0.1:8000/health')
      if (h.ok) break
    } catch { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 500))
  }
  try {
    const res = await fetch('http://127.0.0.1:8000/session/start', { method: 'POST' })
    const body = await res.json()
    if (body.ok) { sessionRunning = true; return { ok: true } }
    return { ok: false, error: body.detail ?? 'Failed to start session' }
  } catch (e) {
    return { ok: false, error: e.message }
  }
})

ipcMain.handle('session:stop', async () => {
  try {
    await fetch('http://127.0.0.1:8000/session/stop', { method: 'POST' })
  } catch { /* ignore if already down */ }
  sessionRunning = false
  return { ok: true }
})

ipcMain.handle('session:status', () => ({ running: sessionRunning }))

ipcMain.handle('scripts:run', (_e, name) => runScript(name))

// ─── Window ───────────────────────────────────────────────────────────────────

const createWindow = () => {
  win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      preload,
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile(path.join(__dirname, 'dist', 'index.html'))
  }
}

app.whenReady().then(() => {
  buildMenu()
  createWindow()
  startBackend()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  Object.values(scriptProcs).forEach((p) => p.kill())
  if (process.platform !== 'darwin') app.quit()
})