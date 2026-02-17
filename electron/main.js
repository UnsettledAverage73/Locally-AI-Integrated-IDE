const { app, BrowserWindow } = require('electron');
const net = require('net');
app.disableHardwareAcceleration(); // Add this line
const { spawn } = require('child_process');
const path = require('path');
const url = require('url');
const { dialog, ipcMain } = require('electron');
const fs = require('fs');

// If the app is NOT packaged (exe/dmg/appimage), then we are in Dev mode.
const isDev = !app.isPackaged;

let pythonProcess = null;
let pythonLspProcess = null;

function checkFrontendReady(win) {
  const port = 5173;
  const host = 'localhost';
  const tryConnect = () => {
    const socket = net.createConnection(port, host, () => {
      console.log('Frontend server is up. Loading URL.');
      win.loadURL('http://localhost:5173');
      socket.end();
    });

    socket.on('error', (error) => {
      console.log('Frontend server not up yet. Retrying in 1 second...');
      setTimeout(tryConnect, 1000);
    });
  };

  tryConnect();
}

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
    checkFrontendReady(win);
    win.webContents.openDevTools(); // Open DevTools in development mode
  } else {
    win.loadURL(url.format({
      pathname: path.join(__dirname, '../public/index.html'),
      protocol: 'file:',
      slashes: true
    }));
  }
}

function startPythonBackend() {
  if (isDev) {
    console.log('In Dev mode: Skipping Python backend spawn (handled by npm script)');
    return;
  }

  let scriptPath;
  // In production, the executable is bundled in the resources path of the app
  scriptPath = path.join(process.resourcesPath, 'api', 'localdev-api');

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

function startLsp() {
  if (isDev) {
    console.log('In Dev mode: Skipping LSP spawn (handled by npm script)');
    return;
  }

  let scriptPath;
  scriptPath = path.join(process.resourcesPath, 'api', 'localdev-lsp');

  console.log(`Attempting to start LSP from: ${scriptPath}`);

  pythonLspProcess = spawn(scriptPath);

  pythonLspProcess.stdout.on('data', (data) => {
    console.log(`lsp stdout: ${data}`);
  });

  pythonLspProcess.stderr.on('data', (data) => {
    console.error(`lsp stderr: ${data}`);
  });

  pythonLspProcess.on('close', (code) => {
    console.log(`lsp process exited with code ${code}`);
    pythonLspProcess = null;
  });
}

function killLsp() {
  if (pythonLspProcess) {
    console.log('Killing LSP process...');
    pythonLspProcess.kill();
    pythonLspProcess = null;
  }
}

app.whenReady().then(() => {
  startPythonBackend();
  startLsp();
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // if (process.platform !== 'darwin') {
  //   app.quit();
  // }
});

// handle everts from preload.js for file/folder management
ipcMain.handle('dialog:openFolder', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  if (canceled) return null;
  return filePaths[0] //return the selected path string
})

ipcMain.handle('dialog:openFiles', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ['openFile', 'multiSelections']
  });
  if (canceled) return null;
  return filePaths;
})

ipcMain.handle('dialog:saveFile', async (event, defaultName, content) => {
  const { canceled, filePath } = await dialog.showSaveDialog({
    defaultPath: defaultName
  });
  if (canceled) {
    return { success: false, error: 'Dialog canceled' };
  }
  try {
    fs.writeFileSync(filePath, content);
    return { success: true, path: filePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});
app.on('will-quit', () => {
  killPythonBackend();
  killLsp();
});
