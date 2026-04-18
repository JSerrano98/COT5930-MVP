import { app, BrowserWindow } from 'electron'
import process from 'process'

const isDev = process.env.NODE_ENV === 'development'

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
  } else {
    win.loadFile('dist/index.html')
  }
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})