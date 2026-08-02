const { contextBridge, ipcRenderer } = require("electron");

const api = {
  window: {
    minimize: () => ipcRenderer.invoke("window:minimize"),
    maximize: () => ipcRenderer.invoke("window:maximize"),
    close: () => ipcRenderer.invoke("window:close"),
    isMaximized: () => ipcRenderer.invoke("window:isMaximized"),
    onMaximizeChange: (callback) => {
      const listener = (_event, maximized) => callback(maximized);
      ipcRenderer.on("window:maximizeChange", listener);
      return () => ipcRenderer.removeListener("window:maximizeChange", listener);
    },
    setOpacity: (opacity) => ipcRenderer.invoke("window:setOpacity", opacity),
    getPosition: () => ipcRenderer.invoke("window:getPosition"),
    getSize: () => ipcRenderer.invoke("window:getSize"),
    setPosition: (x, y) => ipcRenderer.invoke("window:setPosition", x, y),
    toggleFullscreen: (force) => ipcRenderer.invoke("window:toggleFullscreen", force),
    onFullscreenChange: (callback) => {
      const listener = (_event, fullscreen) => callback(fullscreen);
      ipcRenderer.on("window:fullscreenChange", listener);
      return () => ipcRenderer.removeListener("window:fullscreenChange", listener);
    },
  },
  settings: {
    get: (key) => ipcRenderer.invoke("settings:get", key),
    set: (key, value) => ipcRenderer.invoke("settings:set", key, value),
    getAll: () => ipcRenderer.invoke("settings:getAll"),
    resetBounds: () => ipcRenderer.invoke("settings:resetBounds"),
  },
  bridge: {
    // Convert local file path to playable URL via custom protocol
    getFileUrl: (filepath) => 'file:///' + filepath.replace(/\\/g, '/'),

    call: (method, params) => ipcRenderer.invoke("bridge:call", method, params),
    status: () => ipcRenderer.invoke("bridge:status"),
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke("dialog:openFolder"),
    openFile: (filters) => ipcRenderer.invoke("dialog:openFile", filters),
    saveFile: (options) => ipcRenderer.invoke("dialog:saveFile", options),
  },
  shell: {
    openPath: (filePath) => ipcRenderer.invoke("shell:openPath", filePath),
    openExternal: (url) => ipcRenderer.invoke("shell:openExternal", url),
  },

  music: {
    searchLyrics: (title, artist, album, source) => ipcRenderer.invoke("music:searchLyrics", title, artist, album || "", source || "auto"),
    searchCoverNetease: (title, artist, album) => ipcRenderer.invoke("music:searchCoverNetease", title, artist, album),
    searchCoverQQ: (title, artist, album) => ipcRenderer.invoke("music:searchCoverQQ", title, artist, album),
    searchCoverITunes: (title, artist, album) => ipcRenderer.invoke("music:searchCoverITunes", title, artist, album),
    downloadCoverImage: (url) => ipcRenderer.invoke("music:downloadCoverImage", url),
  },
  app: {
    getPath: (name) => ipcRenderer.invoke("app:getPath", name),
  },
};

contextBridge.exposeInMainWorld("electronAPI", api);
