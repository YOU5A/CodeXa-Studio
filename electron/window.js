const { BrowserWindow } = require("electron");
const path = require("path");

function createWindow({ electronSettings, saveElectronSettings, isQuittingRef, mainWindowRef, fullscreenStateRef }) {
  const isDev = !require("electron").app.isPackaged;
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
  if (electronSettings.rememberPosition && bounds?.x !== undefined && bounds?.y !== undefined) {
    windowOptions.x = bounds.x;
    windowOptions.y = bounds.y;
  }
  const mainWindow = new BrowserWindow(windowOptions);
  mainWindow.once("ready-to-show", () => { mainWindow.show(); });
  if (isDev) {
    mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
    mainWindow.webContents.insertCSS("*:focus, *:focus-visible { outline: none !important; }");
  // Diagnostic: check if Windows sends WM_DROPFILES to the window
  if (process.platform === "win32") {
    mainWindow.hookWindowMessage(0x0233, () => {
      console.log("[Drag] WM_DROPFILES received by window!");
    });
  }

  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("file://")) event.preventDefault();
  });
  mainWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
    if (permission === "openExternal") callback(true);
    else callback(false);
  });

  } else {
    mainWindow.loadFile(path.join(__dirname, "..", "dist", "index.html"));
  }
  let saveBoundsTimeout = null;
  const saveBounds = () => {
    if (!mainWindow || mainWindow.isMaximized() || mainWindow.isMinimized() || mainWindow.isFullScreen() || fullscreenStateRef.current || fullscreenStateRef.animating) return;
    const b = electronSettings.windowBounds || {};
    if (electronSettings.rememberPosition) {
      const [x, y] = mainWindow.getPosition();
      b.x = x; b.y = y;
    }
    if (electronSettings.rememberSize) {
      const [w, h] = mainWindow.getSize();
      b.width = w; b.height = h;
    }
    electronSettings.windowBounds = b;
    clearTimeout(saveBoundsTimeout);
    saveBoundsTimeout = setTimeout(() => saveElectronSettings(electronSettings), 500);
  };
  mainWindow.on("resize", saveBounds);
  mainWindow.on("move", saveBounds);
  mainWindow.on("close", (event) => {
    if (!isQuittingRef.current && electronSettings.closeToTray) {
      event.preventDefault();
      mainWindow.hide();
      return;
    }
    if (!mainWindow.isMaximized() && !mainWindow.isMinimized() && !mainWindow.isFullScreen() && !fullscreenStateRef.current && !fullscreenStateRef.animating) {
      const [x, y] = mainWindow.getPosition();
      const [w, h] = mainWindow.getSize();
      electronSettings.windowBounds = { x, y, width: w, height: h };
      saveElectronSettings(electronSettings);
    }
  });
  mainWindow.on("closed", () => { mainWindowRef.current = null; });
  return mainWindow;
}

module.exports = { createWindow };
