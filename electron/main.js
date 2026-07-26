const { app, BrowserWindow, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawnSync, exec } = require("child_process");

const mainWindow = { current: null };
const pythonBridge = { current: null };
const dotnetBridge = { current: null };
const quittingRef = { current: false };

const isDev = !app.isPackaged;

// ?? Electron ?????webSecurity / allowRunningInsecureContent / CSP?
process.env["ELECTRON_DISABLE_SECURITY_WARNINGS"] = "true";

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
function elevateViaPowerShell() {
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

function ensureAdmin() {
  if (process.platform !== "win32") return;

  // Async admin check ? avoids blocking Electron startup (~344ms saved)
  exec("net session", { stdio: "ignore" }, (err) => {
    if (err) elevateViaPowerShell();
  });
}
ensureAdmin();

const { createWindow } = require("./window");
const { setupIPC } = require("./ipc-setup");
const { setupBridges } = require("./bridge-manager");
const { createTray } = require("./tray");

// ---- App lifecycle ----
app.whenReady().then(() => {
  setupIPC({ mainWindow, electronSettings, quittingRef, saveElectronSettings, pythonBridge, dotnetBridge });
  setupBridges({ isDev, dotnetBridge, pythonBridge, app });
  mainWindow.current = createWindow({ electronSettings, saveElectronSettings, isQuittingRef: quittingRef, mainWindowRef: mainWindow });
  createTray({ isDev, mainWindowRef: mainWindow, quittingRef });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow.current = createWindow({ electronSettings, saveElectronSettings, isQuittingRef: quittingRef, mainWindowRef: mainWindow });
    } else if (mainWindow.current) {
      mainWindow.current.show();
      mainWindow.current.focus();
    }
  });

  if (mainWindow.current) {
    mainWindow.current.on("maximize", () => {
      mainWindow.current?.webContents.send("window:maximizeChange", true);
    });
    mainWindow.current.on("unmaximize", () => {
      mainWindow.current?.webContents.send("window:maximizeChange", false);
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
  quittingRef.current = true;
});

// On second instance, show the existing window
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    if (mainWindow.current) {
      if (mainWindow.current.isMinimized()) mainWindow.current.restore();
      mainWindow.current.show();
      mainWindow.current.focus();
    }
  });
}
