const { app, BrowserWindow } = require('electron');
const { spawn } = require('child_process');
const path = require('path');

// If the app is NOT packaged (exe/dmg/appimage), then we are in Dev mode.
const isDev = !app.isPackaged;

let pythonProcess = null;

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js') // Assuming you might add a preload script
    },
  });

  // Load the React app
  if (isDev) {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools(); // Open DevTools in development mode
  } else {
    win.loadFile(path.join(__dirname, '../dist/public/index.html'));
  }
}

function startPythonBackend() {
  let scriptPath;
  if (isDev) {
    // In development, assume the PyInstaller output is in resources/api relative to project root
    scriptPath = path.join(__dirname, '..', 'resources', 'api', 'localdev-api');
  } else {
    // In production, the executable is bundled in the resources path of the app
    scriptPath = path.join(process.resourcesPath, 'api', 'localdev-api');
  }

  console.log(`Attempting to start Python backend from: ${scriptPath}`);

  pythonProcess = spawn(scriptPath);

  pythonProcess.stdout.on('data', (data) => {
    console.log(`python stdout: ${data}`);
  });

  pythonProcess.stderr.on('data', (data) => {
    console.error(`python stderr: ${data}`);
  });

  pythonProcess.on('close', (code) => {
    console.log(`python process exited with code ${code}`);
    pythonProcess = null;
  });
}

function killPythonBackend() {
  if (pythonProcess) {
    console.log('Killing Python backend process...');
    pythonProcess.kill();
    pythonProcess = null;
  }
}

app.whenReady().then(() => {
  startPythonBackend();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('will-quit', killPythonBackend);
