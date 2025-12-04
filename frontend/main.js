
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const { spawn } = require('child_process')

let backendProcess

const startBackend = () => {
  const backendPath = path.join(__dirname, '..', "backend")
  backendProcess = spawn('python', ["-m", "uvicorn", "main:app", "--reload"], {
    cwd: backendPath,
    stdio: 'inherit',
  })

  backendProcess.on('error', (err) => {
    console.error('Failed to start backend process:', err)
  })

  backendProcess.on('exit', (code) => {
    console.log(`Backend process exited with code ${code}`)
  })
}

const stopBackend = () => {
  if (backendProcess) {
    console.log('Stopping backend process...')
    backendProcess.kill()
  }
}

const createWindow = () => {
  const win = new BrowserWindow({
    width: 800,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js')
    }
  })

  win.loadFile('index.html')
}

app.whenReady().then(() => {
  startBackend()
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopBackend()
  if (process.platform !== 'darwin') app.quit()
})
