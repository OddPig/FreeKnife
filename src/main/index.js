'use strict'

import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import * as fs from 'fs'
import * as path from 'path'
import { format as formatUrl } from 'url'
import { UnofficialCricutDevice, ListDevices } from './UnofficialCricutDevice';

const isDevelopment = process.env.NODE_ENV !== 'production';

const prefs = {
  showLog: isDevelopment,
  keys: false,
  warningAccepted: false
};


// global reference to mainWindow (necessary to prevent window from being garbage collected)
let mainWindow

function createMainWindow() {
  const window = new BrowserWindow({ width: 1500, height: 900, webPreferences: { nodeIntegration: true } })

  if (isDevelopment) {
    window.webContents.openDevTools()
  }

  if (isDevelopment) {
    window.loadURL(`http://localhost:${process.env.ELECTRON_WEBPACK_WDS_PORT}`)
  }
  else {
    window.loadURL(formatUrl({
      pathname: path.join(__dirname, 'index.html'),
      protocol: 'file',
      slashes: true
    }))
  }

  window.on('closed', () => {
    mainWindow = null
  })

  window.webContents.on('devtools-opened', () => {
    window.focus()
    setImmediate(() => {
      window.focus()
    })
  })

  return window
}

// quit application when all windows are closed
app.on('window-all-closed', () => {
  // on macOS it is common for applications to stay open until the user explicitly quits
  if (process.platform !== 'darwin') {
    app.quit()
  }
});

app.on('activate', () => {
  // on macOS it is common to re-create a window even after all windows have been closed
  if (mainWindow === null) {
    mainWindow = createMainWindow()
  }
});

// create main BrowserWindow when electron is ready
app.on('ready', () => {
  mainWindow = createMainWindow()
});


/******PREFS STUFF********/

function loadPrefs() {
  try {
    console.log("Looking for config at " + path.join(app.getPath("userData"), 'config.json'));
    var data = fs.readFileSync(path.join(app.getPath("userData"), 'config.json'));
    data = JSON.parse(data);
    return Object.assign(prefs, data);
  } catch (err) {
    if (err.code === 'ENOENT') {
      return prefs;
    } else {
      //todo alert user
      console.log("Failed to load config due to error: " + err);
      return prefs
    }
  }
}

function savePrefs() {
  fs.writeFileSync(path.join(app.getPath("userData"), 'config.json'), JSON.stringify(prefs));
}

ipcMain.on('loadPrefs', (event, arg) => {
  loadPrefs();
  event.reply('loadPrefs', prefs);
});


ipcMain.on('updatePrefs', (event, arg) => {
  Object.assign(prefs, arg);
  savePrefs();
});

/******MISC IPC********/

ipcMain.on('openBrowserTo', (event, arg) => {
  shell.openExternal(arg);
});

ipcMain.on('browseFile', (event, arg) => {
  dialog.showOpenDialog({
    properties: ['openFile'],
    filters: [
      { name: 'SVG', extensions: ['svg'] },
      { name: 'All Files', extensions: ['*'] }
    ]
  }).then(function (files) {
    if (files.filePaths && files.filePaths.length) {
      console.log("REPLY");
      event.reply('browseFiles', files.filePaths);
    }
  });
});

/******LOGGING********/

function log(msg) {
  if (mainWindow) {
    mainWindow.webContents.send('log', { msg: msg, severity: "SERVER" });
  }
  //TODO handle this
}

ipcMain.on('appendLog', (event, arg) => {
  fs.appendFile(path.join(app.getPath("userData"), 'log.txt'), arg);
});

/****DEVICE STUFF*****/
ipcMain.on('beginJob', (event, arg) => {
  console.log(arg)

  let device;
  try {
    device = new UnofficialCricutDevice(arg.path, {
      verbose: true,
      log: log,
      use0x5eEscape: arg.use0x5eEscape,
      useTwoByteLength: arg.useTwoByteLength,
      width: arg.width,
      height: arg.height,
      key: arg.key
    });
    event.reply('deviceStatus', "Handshake");
    device.handshake();
  } catch (error) {
    event.reply('deviceStatus', "Err: " + error);
    throw error;
  }

  device.on('statusChange', async (status) => {
    if (status == "waitingForMaterial") {
      event.reply('deviceStatus', "Waiting For Material");
    } else if (status == "ready") {
      event.reply('deviceStatus', "Ready");
      await device.draw(arg.segments);
    } else {
      event.reply('deviceStatus', status.charAt(0).toUpperCase() + status.slice(1));
    }
  });

  device.on('ready', async () => {
    event.reply('deviceStatus', "Drawing");
    event.reply('deviceStatus', "Done");
  });
});

ipcMain.on('listDevices', (event, arg) => {
  ListDevices().then(function (data) {
    event.reply('listDevices', data)
  });
});