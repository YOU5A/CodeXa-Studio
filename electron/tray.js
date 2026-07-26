const { Tray, Menu } = require("electron");
const path = require("path");

function createTray({ isDev, mainWindowRef, quittingRef }) {
  const iconPath = isDev
    ? path.join(__dirname, "..", "icon.ico")
    : path.join(process.resourcesPath, "icon.ico");

  const tray = new Tray(iconPath);

  const showWindow = () => {
    if (!mainWindowRef.current) return;
    if (mainWindowRef.current.isMinimized()) mainWindowRef.current.restore();
    if (!mainWindowRef.current.isVisible()) mainWindowRef.current.show();
    mainWindowRef.current.focus();
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
        quittingRef.current = true;
        require("electron").app.quit();
      },
    },
  ]);

  tray.setToolTip("CodeXa Studio");
  tray.setContextMenu(contextMenu);

  // Single-click tray icon to toggle window visibility
  tray.on("click", () => {
    if (!mainWindowRef.current) return;
    if (mainWindowRef.current.isVisible()) {
      mainWindowRef.current.hide();
    } else {
      if (mainWindowRef.current.isMinimized()) mainWindowRef.current.restore();
      mainWindowRef.current.show();
      mainWindowRef.current.focus();
    }
  });

  return tray;
}

module.exports = { createTray };
