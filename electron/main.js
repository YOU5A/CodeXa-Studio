const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const { PythonBridge } = require("./python-bridge");
const { cloudsearch, lyric } = require("NeteaseCloudMusicApi");

let mainWindow = null;
let pythonBridge = null;
let tray = null;
let isQuitting = false;

const isDev = !app.isPackaged;

// 禁用 Electron 安全警告（webSecurity / allowRunningInsecureContent / CSP）
process.env['ELECTRON_DISABLE_SECURITY_WARNINGS'] = 'true';

// Fix GPU cache permission errors by setting a custom cache path
app.setPath("userData", path.join(app.getPath("appData"), "CodeXaStudio"));

// ---- Settings file (Electron-side) ----
const SETTINGS_PATH = path.join(app.getPath("userData"), "electron-settings.json");

const defaultElectronSettings = {
  autoStart: false,
  closeToTray: false,
  rememberSize: true,
  rememberPosition: true,
  windowBounds: null, // { x, y, width, height }
};

function loadElectronSettings() {
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      return { ...defaultElectronSettings, ...JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8")) };
    }
  } catch (e) {
    console.error("[Settings] Load failed:", e.message);
  }
  return { ...defaultElectronSettings };
}

function saveElectronSettings(settings) {
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf-8");
  } catch (e) {
    console.error("[Settings] Save failed:", e.message);
  }
}

let electronSettings = loadElectronSettings();

// Apply auto-start on launch
if (electronSettings.autoStart) {
  app.setLoginItemSettings({ openAtLogin: true, path: process.execPath });
}


// ---- Auto-Elevation (Admin Privileges) ----
function ensureAdmin() {
  if (process.platform !== "win32") return;

  try {
    execSync("net session", { stdio: "ignore" });
    return; // Already admin
  } catch {}

  // Not admin: elevate via PowerShell with Base64 encoding
  try {
    const electronPath = process.execPath.replace(/'/g, "''");
    let psCmd;
    if (app.isPackaged) {
      psCmd = "Start-Process -FilePath '" + electronPath + "' -Verb RunAs";
    } else {
      const workDir = process.cwd().replace(/'/g, "''");
      psCmd = "Start-Process -FilePath '" + electronPath + "' -ArgumentList '.' -WorkingDirectory '" + workDir + "' -Verb RunAs";
    }
    const encoded = Buffer.from(psCmd, "utf16le").toString("base64");
    const result = spawnSync("powershell", ["-NoProfile", "-EncodedCommand", encoded], {
      stdio: "pipe",
      windowsHide: true,
      encoding: "utf-8",
    });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(result.stderr.trim() || "Exit code " + result.status);
  } catch (err) {
    console.error("[Admin] Elevation failed:", err.message);
    if (err.stderr) console.error("[Admin] stderr:", err.stderr.toString().trim());
  }
  app.quit();
}
ensureAdmin();

// ---- Window creation ----
function createWindow() {
  // Restore saved window bounds (respect rememberSize / rememberPosition)
  const bounds = electronSettings.windowBounds;
  const windowOptions = {
    width: (electronSettings.rememberSize && bounds?.width) ? bounds.width : 1280,
    height: (electronSettings.rememberSize && bounds?.height) ? bounds.height : 860,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    transparent: true,
    backgroundColor: "#00000000",
    titleBarStyle: "hidden",
    shadow: false,
    icon: path.join(__dirname, "..", "icon.ico"),
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: false,
    },
  };

  // Restore position if enabled and available
  if (electronSettings.rememberPosition && bounds?.x !== undefined && bounds?.y !== undefined) {
    windowOptions.x = bounds.x;
    windowOptions.y = bounds.y;
  }

  mainWindow = new BrowserWindow(windowOptions);

  

  mainWindow.once("ready-to-show", () => { mainWindow.show(); });

  if (isDev) {
    mainWindow.loadURL("http://localhost:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });

  // Hide Chromium default yellow focus ring early
  mainWindow.webContents.insertCSS("*:focus, *:focus-visible { outline: none !important; }");
  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }

  // Save bounds on move/resize for "remember position/size"
  let saveBoundsTimeout = null;
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized()) return;
    const bounds = electronSettings.windowBounds || {};
    if (electronSettings.rememberPosition) {
      const [x, y] = mainWindow.getPosition();
      bounds.x = x;
      bounds.y = y;
    }
    if (electronSettings.rememberSize) {
      const [width, height] = mainWindow.getSize();
      bounds.width = width;
      bounds.height = height;
    }
    electronSettings.windowBounds = bounds;
    // Debounce saves
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(() => saveElectronSettings(electronSettings), 500);
  };

  mainWindow.on("resize", saveBounds);
  mainWindow.on("move", saveBounds);

  // Handle close - hide to tray instead of closing if enabled
  mainWindow.on("close", (event) => {
    if (!isQuitting && electronSettings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    // Save bounds on final close
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized()) {
      const [x, y] = mainWindow.getPosition();
      const [width, height] = mainWindow.getSize();
      electronSettings.windowBounds = { x, y, width, height };
      saveElectronSettings(electronSettings);
    }
  });

  mainWindow.on("closed", () => { mainWindow = null; });
}

// ---- IPC Handlers ----
function setupIPC() {
  // Window controls
    ipcMain.handle("window:minimize", () => mainWindow?.minimize());

  ipcMain.handle("window:maximize", () => {
    if (mainWindow?.isMaximized()) { mainWindow.unmaximize(); return false; }
    else { mainWindow?.maximize(); return true; }
  });

  ipcMain.handle("window:close", () => {
    if (electronSettings.closeToTray && mainWindow && !isQuitting) {
      mainWindow.hide();
    } else {
      isQuitting = true;
      mainWindow?.close();
    }
  });

  ipcMain.handle("window:isMaximized", () => mainWindow?.isMaximized());
  ipcMain.handle("window:setOpacity", (_e, opacity) => { mainWindow?.setOpacity(opacity); });
  ipcMain.handle("window:getPosition", () => mainWindow?.getPosition());
  ipcMain.handle("window:getSize", () => mainWindow?.getSize());
  ipcMain.handle("window:setPosition", (_e, x, y) => { mainWindow?.setPosition(x, y); });


  // Electron settings (autoStart, minimizeToTray, closeToTray)
  ipcMain.handle("settings:get", (_e, key) => {
    return electronSettings[key];
  });

  ipcMain.handle("settings:set", (_e, key, value) => {
    electronSettings[key] = value;
    saveElectronSettings(electronSettings);

    // Apply autoStart change immediately
    if (key === "autoStart") {
      app.setLoginItemSettings({ openAtLogin: value, path: process.execPath });
    }

    return true;
  });

  ipcMain.handle("settings:resetBounds", () => {
    electronSettings.windowBounds = null;
    saveElectronSettings(electronSettings);
    if (mainWindow && !mainWindow.isDestroyed()) {
      const defaultWidth = 1280;
      const defaultHeight = 860;
      if (mainWindow.isMaximized()) mainWindow.unmaximize();
      mainWindow.setSize(defaultWidth, defaultHeight);
      mainWindow.center();
      console.log("[Settings] Window bounds reset to default:", defaultWidth, "x", defaultHeight);
    }
    return true;
  });


  ipcMain.handle("settings:getAll", () => {
    return { ...electronSettings };
  });

  // Python bridge
  ipcMain.handle("python:call", async (_event, method, params) => {
    if (!pythonBridge) return { error: "Python bridge not ready" };
    try { return await pythonBridge.call(method, params); }
    catch (e) { return { error: e.message }; }
  });
  ipcMain.handle("python:status", () => pythonBridge?.isRunning ?? false);

  // Dialogs
  ipcMain.handle("dialog:openFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:openFile", async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ["openFile"],
      filters: filters ? [filters] : [],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:saveFile", async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow, options);
    return result.canceled ? null : result.filePath;
  });

  // Shell
  ipcMain.handle("shell:openPath", async (_event, filePath) => shell.openPath(filePath));
  ipcMain.handle("shell:openExternal", async (_event, url) => shell.openExternal(url));
  ipcMain.handle("app:getPath", async (_event, name) => app.getPath(name));
}

  // ---- Music: Online Lyrics Search (Netease) ----
  ipcMain.handle("music:searchLyrics", async (_event, title, artist) => {
    try {
      const keywords = artist ? `${title} ${artist}` : title;
      const searchRes = await cloudsearch({ keywords, type: 1, limit: 5 });
      const songs = searchRes?.body?.result?.songs;
      if (!songs || songs.length === 0) {
        return { lyrics_text: null, source: "netease" };
      }
      const songId = songs[0].id;
      const lyricRes = await lyric({ id: songId });
      const lrc = lyricRes?.body?.lrc?.lyric;
      if (!lrc) {
        return { lyrics_text: null, source: "netease" };
      }
      return { lyrics_text: lrc, source: "netease" };
    } catch (e) {
      console.error("[Music:SearchLyrics]", e.message);
      return { lyrics_text: null, source: "netease", error: e.message };
    }
  });


// ---- Python Bridge ----
function startPythonBridge() {
  const bridgePath = isDev
    ? path.join(__dirname, "..", "bridge", "server.py")
    : path.join(process.resourcesPath, "bridge", "server.py");
  pythonBridge = new PythonBridge(bridgePath);
  pythonBridge.start();
  app.on("before-quit", () => { pythonBridge?.stop(); });
}

// ---- Tray ----
function createTray() {
  const iconPath = isDev
    ? path.join(__dirname, "..", "icon.ico")
    : path.join(process.resourcesPath, "icon.ico");

  tray = new Tray(iconPath);

  const showWindow = () => {
    if (!mainWindow) return;
    if (mainWindow.isMinimized()) mainWindow.restore();
    if (!mainWindow.isVisible()) mainWindow.show();
    mainWindow.focus();
  };

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show CodeXa Studio",
      click: () => showWindow(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        app.quit();
      },
    },
  ]);

  tray.setToolTip("CodeXa Studio");
  tray.setContextMenu(contextMenu);

  // Single-click tray icon to toggle window visibility
  tray.on("click", () => {
    if (!mainWindow) return;
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ---- App lifecycle ----
app.whenReady().then(() => {

  setupIPC();
  startPythonBridge();
  createWindow();
  createTray();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
    else if (mainWindow) {
      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (mainWindow) {
    mainWindow.on("maximize", () => {
      mainWindow?.webContents.send("window:maximizeChange", true);
    });
    mainWindow.on("unmaximize", () => {
      mainWindow?.webContents.send("window:maximizeChange", false);
    });
  }
});

// Prevent app from quitting when all windows are closed (tray support)
app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    if (!electronSettings.closeToTray) app.quit();
  }
});

// Ensure clean quit
app.on("before-quit", () => {
  isQuitting = true;
});

// On second instance, show the existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}
