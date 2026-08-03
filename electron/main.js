const { app, BrowserWindow, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const { spawnSync, exec } = require("child_process");

const mainWindow = { current: null };
const dotnetBridge = { current: null };
const quittingRef = { current: false };
// NowPlaying 全屏状态（工作区补间全屏）：current = 是否全屏；animating = 过渡中
const fullscreenStateRef = { current: false, animating: false };

const isDev = !app.isPackaged;

// 禁用 Electron 安全警告（webSecurity / allowRunningInsecureContent / CSP）
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
  var ps1Path = null;
  try {
    // Escape single-quotes for PowerShell single-quoted strings
    var escapePs = function(s) { return s.replace(/'/g, "''"); };

    var psScript;
    if (app.isPackaged) {
      psScript = "Start-Process -FilePath '" + escapePs(process.execPath) + "' -Verb RunAs";
    } else {
      psScript = "Start-Process -FilePath '" + escapePs(process.execPath) + "' -ArgumentList '.' -WorkingDirectory '" + escapePs(process.cwd()) + "' -Verb RunAs";
    }

    // Write to temp .ps1 file to avoid PowerShell string-escaping pitfalls
    // (backtick, $, and double-quote are irrelevant inside single-quoted PS strings,
    //  but the file-based approach future-proofs against path chars like [ ] { } ;)
    ps1Path = path.join(app.getPath("temp"), "codexa-elevate.ps1");
    fs.writeFileSync(ps1Path, psScript, "utf-8");

    var result = spawnSync("powershell", [
      "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", ps1Path,
    ], {
      stdio: "pipe",
      windowsHide: true,
      encoding: "utf-8",
    });

    // Cleanup temp file
    try { fs.unlinkSync(ps1Path); } catch (e) {}

    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error((result.stderr || "").trim() || "Exit code " + result.status);
  } catch (err) {
    console.error("[Admin] Elevation failed:", err.message);
    if (err.stderr) console.error("[Admin] stderr:", err.stderr.toString().trim());
    // Best-effort cleanup
    if (ps1Path) { try { fs.unlinkSync(ps1Path); } catch (e) {} }
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
const { setupBridge } = require("./bridge-manager");
const { createTray } = require("./tray");

// ---- App lifecycle ----
app.whenReady().then(() => {
  setupIPC({ mainWindow, electronSettings, quittingRef, saveElectronSettings, dotnetBridge, fullscreenStateRef });
  setupBridge({ isDev, dotnetBridge, app });
  mainWindow.current = createWindow({ electronSettings, saveElectronSettings, isQuittingRef: quittingRef, mainWindowRef: mainWindow, fullscreenStateRef });
  createTray({ isDev, mainWindowRef: mainWindow, quittingRef });

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      mainWindow.current = createWindow({ electronSettings, saveElectronSettings, isQuittingRef: quittingRef, mainWindowRef: mainWindow, fullscreenStateRef });
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
    mainWindow.current.on("enter-full-screen", () => {
      mainWindow.current?.webContents.send("window:fullscreenChange", true);
    });
    mainWindow.current.on("leave-full-screen", () => {
      mainWindow.current?.webContents.send("window:fullscreenChange", false);
    });
    // Windows 无边框窗口 enter/leave-full-screen 事件可能不触发，
    // 用 resize 兜底同步真实全屏状态（重复发送同值无害）
    mainWindow.current.on("resize", () => {
      mainWindow.current?.webContents.send("window:fullscreenChange", fullscreenStateRef.current);
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
