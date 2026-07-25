const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeTheme } = require("electron");
const fs = require("fs");
const path = require("path");
const { execSync, spawnSync } = require("child_process");
const https = require("https");
const { PythonBridge } = require("./python-bridge");
const { cloudsearch, lyric } = require("NeteaseCloudMusicApi");

let mainWindow = null;
let pythonBridge = null;
let dotnetBridge = null;
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

  // Python bridge - system.info + music.* routed to .NET when available (Phase 2)
  ipcMain.handle("python:call", async (_event, method, params) => {
    const dotnetMethods = ["system.info", "music.scan", "music.get_metadata", "music.save_tags",
      "music.extract_cover", "music.apply_cover", "music.remove_cover", "music.read_cover_file",
      "music.save_cover_file", "music.rename", "music.get_lyrics"];
    if (dotnetMethods.includes(method) && dotnetBridge?.isRunning) {
      try { return await dotnetBridge.call(method, params); }
      catch (e) { console.warn("[.NET Bridge]", method, "failed:", e.message); }
    }
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


// ── Fuzzy matching helper ──
// ── Chinese normalization: Traditional → Simplified (lightweight, ~150 pairs) ──
const CN_S2T_MAP = {
  '張':'张','學':'学','陳':'陈','劉':'刘','鄧':'邓','麗':'丽','後':'后','來':'来',
  '說':'说','愛':'爱','夢':'梦','聽':'听','見':'见','體':'体','會':'会','過':'过',
  '爲':'为','麼':'么','這':'这','樣':'样','對':'对','時':'时','間':'间',
  '國':'国','風':'风','開':'开','關':'关','機':'机','電':'电','無':'无','線':'线',
  '頭':'头','髮':'发','門':'门','馬':'马','魚':'鱼','鳥':'鸟','龍':'龙','鳳':'凤',
  '紅':'红','綠':'绿','藍':'蓝','長':'长','飛':'飞','聲':'声','響':'响','輕':'轻',
  '萬':'万','與':'与','書':'书','畫':'画','話':'话','讀':'读','寫':'写','買':'买',
  '賣':'卖','隻':'只','雙':'双','條':'条','塊':'块','點':'点','帶':'带','幫':'帮',
  '動':'动','處':'处','實':'实','寶':'宝','邊':'边','變':'变','讓':'让','認':'认',
  '識':'识','還':'还','給':'给','從':'从','當':'当','將':'将','總':'总','別':'别',
  '卻':'却','設':'设','計':'计','問':'问','題':'题','進':'进','發':'发','現':'现',
  '離':'离','結':'结','束':'束','始':'始','繼':'继','續':'续','爾':'尔','羅':'罗',
  '亞':'亚','歐':'欧','蘇':'苏','葉':'叶','雲':'云','陽':'阳','陰':'阴','樂':'乐',
  '節':'节','歡':'欢','舊':'旧','歷':'历','歸':'归','樹':'树','藥':'药','衛':'卫',
  '選':'选','險':'险','靜':'静','領':'领','顧':'顾','顯':'显','滿':'满','準':'准',
  '剛':'刚','歲':'岁','戰':'战','戲':'戏','擊':'击','權':'权','數':'数','轉':'转',
  '達':'达','運':'运','遠':'远','連':'连','臺':'台','灣':'湾','龍':'龙','聖':'圣',
  '園':'园','圓':'圆','團':'团','圖':'图','場':'场','報':'报','夠':'够',
};

function normalizeChinese(s) {
  if (!s) return "";
  let out = "";
  for (const ch of s) {
    out += CN_S2T_MAP[ch] || ch;
  }
  return out;
}

// ── Strip parenthetical/bracket content (feat., remix, live, etc.) ──
function stripBrackets(s) {
  if (!s) return "";
  return s.replace(/[\(\)()\[\]]/g, " ")
    .replace(/\bfeat\.?\s+[^ ]+/gi, "")
    .replace(/\bft\.?\s+[^ ]+/gi, "")
    .replace(/\bremix\b/gi, "")
    .replace(/\blive\b/gi, "")
    .replace(/\bacoustic\b/gi, "")
    .replace(/\bversion\b/gi, "")
    .replace(/\bver\.?\b/gi, "")
    .replace(/\bedit\b/gi, "")
    .replace(/\bradio\s+edit\b/gi, "")
    .replace(/\boriginal\s+mix\b/gi, "")
    .replace(/\bextended\b/gi, "")
    .replace(/\binstrumental\b/gi, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

// ── Levenshtein distance ──
function levenshteinDistance(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) dp[i][j] = dp[i - 1][j - 1];
      else dp[i][j] = 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// ── Chinese 2-gram character overlap (for CJK-heavy strings) ──
function chinese2gramOverlap(a, b) {
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = new Set();
  for (let i = 0; i < b.length - 1; i++) bigrams.add(b.slice(i, i + 2));
  let hits = 0, total = 0;
  for (let i = 0; i < a.length - 1; i++) {
    total++;
    if (bigrams.has(a.slice(i, i + 2))) hits++;
  }
  return total > 0 ? hits / total : 0;
}

function scoreMatch(songName, songArtists, queryTitle, queryArtist) {
  const toLower = (s) => (s || "").toLowerCase().replace(/\s+/g, " ").trim();

  // Normalize: strip brackets + normalize Chinese
  const snRaw = toLower(normalizeChinese(stripBrackets(songName || "")));
  const qtRaw = toLower(normalizeChinese(stripBrackets(queryTitle || "")));
  const sn = toLower(normalizeChinese(songName || ""));
  const qt = toLower(normalizeChinese(queryTitle || ""));
  const qa = toLower(normalizeChinese(queryArtist || ""));

  let score = 0;

  // Title exact match (raw or stripped)
  if (sn === qt || snRaw === qtRaw) score += 0.5;
  // Title contains query or vice versa
  else if (sn.includes(qt) || qt.includes(sn) || snRaw.includes(qtRaw) || qtRaw.includes(snRaw)) score += 0.38;
  // Levenshtein + Chinese 2-gram + word overlap
  else {
    const maxLen = Math.max(sn.length, qt.length);
    if (maxLen > 3) {
      const dist = levenshteinDistance(sn, qt);
      const ratio = 1 - dist / maxLen;
      if (ratio > 0.8) score += 0.25;
      else if (ratio > 0.6) score += 0.12;
    }
    // Chinese 2-gram overlap
    const c2g = chinese2gramOverlap(sn, qt);
    if (c2g > 0.4) score += 0.18 * c2g;
    // Word overlap (Latin languages)
    const snWords = new Set(sn.split(" "));
    const qtWords = new Set(qt.split(" "));
    let overlap = 0;
    for (const w of qtWords) { if (snWords.has(w)) overlap++; }
    if (overlap > 0) score += 0.12 * (overlap / Math.max(qtWords.size, 1));
  }

  // Artist matching (with Chinese normalization)
  if (qa && songArtists && songArtists.length > 0) {
    const artistNames = songArtists.map(a => toLower(normalizeChinese(typeof a === "string" ? a : a.name || "")));
    for (const an of artistNames) {
      if (an === qa) { score += 0.4; break; }
      else if (an.includes(qa) || qa.includes(an)) { score += 0.28; break; }
    }
  } else if (!qa) {
    score += 0.2;
  }

  return score;
}

// ── General HTTPS request helper (for non-QQ services) ──
function httpRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const parsed = typeof url === "string" ? new URL(url) : url;
    const req = https.request({
      hostname: parsed.hostname,
      path: parsed.pathname + (parsed.search || ""),
      method: options.method || "GET",
      headers: {
        "User-Agent": options.userAgent || "CodeXaStudio/1.3",
        "Accept": "application/json",
        ...(options.headers || {}),
        "Content-Type": options.body ? "application/json" : undefined,
      },
      timeout: options.timeout || 12000,
    }, (res) => {
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        if ((options._redirectDepth || 0) > 2) {
          reject(new Error("Too many redirects"));
          return;
        }
        resolve(httpRequest(res.headers.location, { ...options, _redirectDepth: (options._redirectDepth || 0) + 1 }));
        return;
      }
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        const encoding = res.headers["content-encoding"];
        let body;
        if (encoding === "gzip" || encoding === "deflate") {
          try { body = require("zlib").gunzipSync(raw).toString("utf-8"); } catch { body = raw.toString("utf-8"); }
        } else {
          body = raw.toString("utf-8");
        }
        resolve(body);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (options.body) req.write(typeof options.body === "string" ? options.body : JSON.stringify(options.body));
    req.end();
  });
}

// ── QQ Music helper: simple HTTPS request ──
function qqRequest(urlOrOptions, postData) {
  return new Promise((resolve, reject) => {
    const opts = typeof urlOrOptions === "string" ? new URL(urlOrOptions) : urlOrOptions;
    const req = https.request({
      hostname: opts.hostname,
      path: opts.pathname + (opts.search || ""),
      method: postData ? "POST" : "GET",
      headers: {
        "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
        "Referer": "https://i.y.qq.com/",
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Content-Type": postData ? "application/json" : undefined,
      },
      timeout: 15000,
    }, (res) => {
      const chunks = [];
      res.on("data", (d) => chunks.push(d));
      res.on("end", () => {
        const raw = Buffer.concat(chunks);
        // Gunzip if needed
        const encoding = res.headers["content-encoding"];
        let body;
        if (encoding === "gzip" || encoding === "deflate") {
          try { body = require("zlib").gunzipSync(raw).toString("utf-8"); } catch { body = raw.toString("utf-8"); }
        } else {
          body = raw.toString("utf-8");
        }
        resolve(body);
      });
    });
    req.on("error", reject);
    req.on("timeout", () => { req.destroy(); reject(new Error("Request timeout")); });
    if (postData) req.write(JSON.stringify(postData));
    req.end();
  });
}

// ── QQ Music lyrics search & fetch ──
async function searchQQMusicLyrics(title, artist) {
  const query = artist ? `${title} ${artist}` : title;
  const searchBody = {
    req_0: {
      module: "music.search.SearchCgiService",
      method: "DoSearchForQQMusicDesktop",
      param: { search_type: 0, query, page_num: 1, num_per_page: 20 },
    },
  };

  const searchText = await qqRequest("https://u.y.qq.com/cgi-bin/musicu.fcg", searchBody);
  const searchJson = JSON.parse(searchText);
  const songList = searchJson?.req_0?.data?.body?.song?.list;
  if (!songList || songList.length === 0) return null;

  // Score and pick best match
  let best = null;
  let bestScore = -1;
  for (const s of songList) {
    const score = scoreMatch(s.name, s.singer, title, artist);
    if (score > bestScore) { bestScore = score; best = s; }
  }
  if (!best || bestScore < 0.25) return null;

  const songmid = best.mid || best.songmid;
  if (!songmid) return null;

  // Fetch lyrics
  const lyricUrl = `https://c.y.qq.com/lyric/fcgi-bin/fcg_query_lyric_new.fcg?songmid=${songmid}&g_tk=5381&format=json&inCharset=utf8&outCharset=utf-8`;
  let lyricText = await qqRequest(lyricUrl);
  // Strip JSONP wrapper
  lyricText = lyricText.replace(/^\s*\w+\(/, "").replace(/\)\s*;?\s*$/, "");
  const lyricJson = JSON.parse(lyricText);
  const lrc = lyricJson?.lyric;
  if (!lrc) return null;
  return lrc;
}


// ── LRCLIB lyrics search ──
async function searchLrclibLyrics(title, artist, album, duration) {
  try {
    // Build search URL with track_name + artist_name
    const params = new URLSearchParams();
    params.set("track_name", title);
    if (artist) params.set("artist_name", artist);
    if (album) params.set("album_name", album);
    if (duration && duration > 0) params.set("duration", String(Math.round(duration)));

    const url = `https://lrclib.net/api/search?${params.toString()}`;
    const respText = await httpRequest(url, {
      userAgent: "CodeXaStudio/1.3 (https://github.com/YOU5A/CodeXa-Studio)",
      timeout: 10000,
    });

    const results = JSON.parse(respText);
    if (!Array.isArray(results) || results.length === 0) {
      console.log("[Lyrics:LRCLIB] No results for", title, "-", artist);
      return null;
    }

    // Score results to find best match
    let best = null;
    let bestScore = -1;
    for (const r of results) {
      const artists = r.artistName ? [{ name: r.artistName }] : [];
      const score = scoreMatch(r.trackName, artists, title, artist);
      if (score > bestScore) { bestScore = score; best = r; }
    }

    if (!best || bestScore < 0.25) {
      console.log(`[Lyrics:LRCLIB] Best score ${bestScore.toFixed(2)} < 0.25`);
      return null;
    }

    // Prefer synced lyrics, fallback to plain
    const lrc = best.syncedLyrics || best.plainLyrics;
    if (lrc) {
      console.log(`[Lyrics:LRCLIB] Found lyrics (${best.syncedLyrics ? "synced" : "plain"}), score=${bestScore.toFixed(2)}`);
      return lrc;
    }
    return null;
  } catch (e) {
    console.log("[Lyrics:LRCLIB] Error:", e.message);
    return null;
  }
}

// ── Multi-query lyrics search helper: try different query formulations ──
async function searchLyricsMultiQuery(title, artist, searchFn) {
  // Build query variants: stripped versions without brackets/feat
  const strippedTitle = stripBrackets(title);
  const strippedArtist = artist ? stripBrackets(artist) : "";

  const queries = [];
  if (artist) queries.push({ title, artist });
  queries.push({ title, artist: "" });
  if (strippedTitle !== title && artist) queries.push({ title: strippedTitle, artist: strippedArtist || artist });
  if (strippedTitle !== title) queries.push({ title: strippedTitle, artist: "" });

  // Deduplicate queries
  const seen = new Set();
  const unique = [];
  for (const q of queries) {
    const key = q.title + "|" + (q.artist || "");
    if (!seen.has(key)) { seen.add(key); unique.push(q); }
  }

  for (const q of unique) {
    try {
      const result = await searchFn(q.title, q.artist);
      if (result) return result;
    } catch {}
  }
  return null;
}

// ── Music: Online Lyrics Search (LRCLIB → Netease → QQ) ──
ipcMain.handle("music:searchLyrics", async (_event, title, artist, lyricSource) => {
  const searchNetease = async (t, a) => {
    try {
      const keywords = a ? `${t} ${a}` : t;
      const searchRes = await cloudsearch({ keywords, type: 1, limit: 20 });
      const songs = searchRes?.body?.result?.songs;
      if (!songs || songs.length === 0) return null;

      let best = null;
      let bestScore = -1;
      for (const s of songs) {
        const score = scoreMatch(s.name, s.ar, t, a);
        if (score > bestScore) { bestScore = score; best = s; }
      }

      if (!best || bestScore < 0.3) return null;

      const lyricRes = await lyric({ id: best.id });
      const lrc = lyricRes?.body?.lrc?.lyric;
      if (lrc) {
        console.log(`[Lyrics:Netease] Found, score=${bestScore.toFixed(2)}, id=${best.id}`);
        return { text: lrc, source: "netease" };
      }
      return null;
    } catch (e) {
      console.log("[Lyrics:Netease] Error:", e.message);
      return null;
    }
  };

  const searchQQ = async (t, a) => {
    const lrc = await searchQQMusicLyrics(t, a);
    return lrc ? { text: lrc, source: "qq" } : null;
  };

  const searchLrclib = async (t, a) => {
    const lrc = await searchLrclibLyrics(t, a);
    return lrc ? { text: lrc, source: "lrclib" } : null;
  };

  try {
    const src = lyricSource || "auto";
    console.log("[Lyrics] Source mode:", src);

    // Helper: try a specific source with multi-query
    const trySource = async (name, fn) => {
      console.log("[Lyrics] Trying " + name + "...");
      const result = await searchLyricsMultiQuery(title, artist, fn);
      if (result) return result;
      // Single-query fallback
      const direct = await fn(title, artist);
      return direct ? { text: direct.text, source: direct.source } : null;
    };

    if (src === "lrclib") {
      const r = await trySource("LRCLIB", searchLrclib);
      if (r) return { lyrics_text: r.text, source: r.source };
      return { lyrics_text: null, source: "none" };
    }
    if (src === "netease") {
      const r = await trySource("Netease", searchNetease);
      if (r) return { lyrics_text: r.text, source: r.source };
      return { lyrics_text: null, source: "none" };
    }
    if (src === "qq") {
      const r = await trySource("QQ", searchQQ);
      if (r) return { lyrics_text: r.text, source: r.source };
      return { lyrics_text: null, source: "none" };
    }

    // "auto" — try all sources in priority order
    // 1. LRCLIB (multi-query)
    const lrclibResult = await searchLyricsMultiQuery(title, artist, searchLrclib);
    if (lrclibResult) return { lyrics_text: lrclibResult.text, source: lrclibResult.source };

    // 2. Netease (multi-query)
    const neteaseResult = await searchLyricsMultiQuery(title, artist, searchNetease);
    if (neteaseResult) return { lyrics_text: neteaseResult.text, source: neteaseResult.source };

    // 3. QQ (multi-query)
    const qqResult = await searchLyricsMultiQuery(title, artist, searchQQ);
    if (qqResult) return { lyrics_text: qqResult.text, source: qqResult.source };

    // 4. Last-ditch single queries
    console.log("[Lyrics] All multi-query failed, trying single fallback...");
    const lrclibDirect = await searchLrclib(title, artist);
    if (lrclibDirect) return { lyrics_text: lrclibDirect.text, source: lrclibDirect.source };
    const neteaseDirect = await searchNetease(title, artist);
    if (neteaseDirect) return { lyrics_text: neteaseDirect.text, source: neteaseDirect.source };
    const qqDirect = await searchQQ(title, artist);
    if (qqDirect) return { lyrics_text: qqDirect.text, source: qqDirect.source };

    return { lyrics_text: null, source: "none" };
  } catch (e) {
    console.error("[Music:SearchLyrics]", e.message);
    return { lyrics_text: null, source: "none", error: e.message };
  }
});

// ── Cover Search: Netease ──
ipcMain.handle("music:searchCoverNetease", async (_event, title, artist, album) => {
  try {
    const keywords = [title, artist, album].filter(Boolean).join(" ");
    const searchRes = await cloudsearch({ keywords, type: 1, limit: 20 });
    const songs = searchRes?.body?.result?.songs;
    if (!songs || songs.length === 0) return { results: [] };

    const seen = new Set();
    const results = [];
    for (const s of songs) {
      const picUrl = s?.al?.picUrl;
      if (!picUrl || seen.has(picUrl)) continue;
      const songArtists = (s.ar || []).map(a => a.name || "");
      const score = scoreMatch(s.name, songArtists, title, artist);
      if (score < 0.3) continue;
      seen.add(picUrl);
      results.push({
        source: "netease",
        title: s.name || "",
        artist: songArtists.join(", "),
        album: s?.al?.name || "",
        coverUrl: picUrl,
        songId: s.id,
        _score: score,
      });
    }
    // Sort by score descending and limit to 10
    results.sort((a, b) => b._score - a._score);
    const clean = results.slice(0, 10).map(({ _score, ...r }) => r);
    return { results: clean };
  } catch (e) {
    console.error("[Cover:Netease]", e.message);
    return { results: [], error: e.message };
  }
});

// ── Cover Search: QQ Music ──
ipcMain.handle("music:searchCoverQQ", async (_event, title, artist, album) => {
  try {
    const query = [title, artist, album].filter(Boolean).join(" ");
    const searchBody = {
      req_0: {
        module: "music.search.SearchCgiService",
        method: "DoSearchForQQMusicDesktop",
        param: { search_type: 0, query, page_num: 1, num_per_page: 20 },
      },
    };
    const searchText = await qqRequest("https://u.y.qq.com/cgi-bin/musicu.fcg", searchBody);
    const searchJson = JSON.parse(searchText);
    const songList = searchJson?.req_0?.data?.body?.song?.list;
    if (!songList || songList.length === 0) return { results: [] };

    const seen = new Set();
    const results = [];
    for (const s of songList) {
      const albumMid = s?.album?.mid;
      if (!albumMid || seen.has(albumMid)) continue;
      const songArtists = (s.singer || []).map(si => si.name || "");
      const score = scoreMatch(s.name || s.title, songArtists, title, artist);
      if (score < 0.3) continue;
      seen.add(albumMid);
      const coverUrl = `https://y.qq.com/music/photo_new/T002R800x800M000${albumMid}.jpg`;
      results.push({
        source: "qq",
        title: s.name || s.title || "",
        artist: songArtists.join(", "),
        album: s?.album?.name || "",
        coverUrl,
        albumMid,
        _score: score,
      });
    }
    results.sort((a, b) => b._score - a._score);
    const clean = results.slice(0, 10).map(({ _score, ...r }) => r);
    return { results: clean };
  } catch (e) {
    console.error("[Cover:QQ]", e.message);
    return { results: [], error: e.message };
  }
});

// ── Cover Search: iTunes ──
ipcMain.handle("music:searchCoverITunes", async (_event, title, artist, album) => {
  try {
    const query = encodeURIComponent([title, artist, album].filter(Boolean).join(" "));
    const url = `https://itunes.apple.com/search?term=${query}&entity=song&limit=20`;
    const respText = await httpRequest(url, {
      userAgent: "CodeXaStudio/1.3",
      timeout: 10000,
    });
    const data = JSON.parse(respText);
    if (!data?.results || data.results.length === 0) return { results: [] };

    const seen = new Set();
    const results = [];
    for (const r of data.results) {
      const artUrl = r.artworkUrl100;
      if (!artUrl || seen.has(artUrl)) continue;
      const songArtists = [{ name: r.artistName || "" }];
      const score = scoreMatch(r.trackName, songArtists, title, artist);
      if (score < 0.25) continue;
      seen.add(artUrl);
      // Replace 100x100 with 600x600 for higher quality
      const coverUrl = artUrl.replace(/100x100bb/, "600x600bb");
      results.push({
        source: "itunes",
        title: r.trackName || "",
        artist: r.artistName || "",
        album: r.collectionName || "",
        coverUrl,
        trackId: r.trackId,
        _score: score,
      });
    }
    results.sort((a, b) => b._score - a._score);
    const clean = results.slice(0, 10).map(({ _score, ...r }) => r);
    return { results: clean };
  } catch (e) {
    console.error("[Cover:iTunes]", e.message);
    return { results: [], error: e.message };
  }
});

// ── Download image helper ──
function _downloadImage(url, depth = 0) {
  if (depth > 2) return Promise.resolve({ data: null, error: "Too many redirects" });
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": parsed.origin,
        },
        timeout: 20000,
      }, (res) => {
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            resolve(_downloadImage(redirectUrl, depth + 1));
            return;
          }
        }
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const b64 = buf.toString("base64");
          const ct = res.headers["content-type"] || "image/jpeg";
          resolve({ data: `data:${ct};base64,${b64}`, error: null });
        });
      }).on("error", (e) => resolve({ data: null, error: e.message }))
        .on("timeout", function() { this.destroy(); resolve({ data: null, error: "timeout" }); });
    } catch (e) {
      resolve({ data: null, error: e.message });
    }
  });
}

// ── Download image as base64 (in main process to avoid CORS) ──
ipcMain.handle("music:downloadCoverImage", async (_event, url) => {
  return new Promise((resolve) => {
    try {
      const parsed = new URL(url);
      https.get({
        hostname: parsed.hostname,
        path: parsed.pathname + (parsed.search || ""),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
          "Referer": parsed.origin,
        },
        timeout: 20000,
      }, (res) => {
        // Follow redirects (up to 3)
        if ([301, 302, 307, 308].includes(res.statusCode)) {
          const redirectUrl = res.headers.location;
          if (redirectUrl) {
            resolve(_downloadImage(redirectUrl).then(resolve));
            return;
          }
        }
        const chunks = [];
        res.on("data", (d) => chunks.push(d));
        res.on("end", () => {
          const buf = Buffer.concat(chunks);
          const b64 = buf.toString("base64");
          const ct = res.headers["content-type"] || "image/jpeg";
          resolve({ data: `data:${ct};base64,${b64}`, error: null });
        });
      }).on("error", (e) => resolve({ data: null, error: e.message }))
        .on("timeout", function() { this.destroy(); resolve({ data: null, error: "timeout" }); });
    } catch (e) {
      resolve({ data: null, error: e.message });
    }
  });
});



// ---- .NET Bridge (Phase 1: system.info) ----
function startDotNetBridge() {
  const exePath = isDev
    ? path.join(__dirname, "..", "dotnet-bridge", "publish2", "CodeXaBridge.exe")
    : path.join(process.resourcesPath, "dotnet-bridge", "CodeXaBridge.exe");
  const dataDir = isDev
    ? path.join(__dirname, "..", "data")
    : path.join(process.resourcesPath, "data");

  if (!fs.existsSync(exePath)) {
    console.warn("[.NET Bridge] Executable not found at", exePath, "- using Python fallback");
    return;
  }

  try {
    const { spawn } = require("child_process");
    dotnetBridge = new PythonBridge(exePath);

    // Override start() to use .NET exe instead of Python script
    const originalStart = dotnetBridge.start.bind(dotnetBridge);
    dotnetBridge.start = () => {
      const proc = spawn(exePath, [dataDir], { stdio: ["pipe", "pipe", "pipe"] });
      dotnetBridge.process = proc;
      dotnetBridge._isRunning = true;

      proc.stdout?.on("data", (data) => {
        dotnetBridge.buffer += data.toString("utf-8");
        dotnetBridge.processBuffer();
      });

      proc.stderr?.on("data", (data) => {
        console.error("[.NET Bridge]", data.toString("utf-8"));
      });

      proc.on("close", (code) => {
        console.log("[.NET Bridge] Exited with code", code);
        dotnetBridge._isRunning = false;
        dotnetBridge.process = null;
        for (const [id, call] of dotnetBridge.pending) {
          clearTimeout(call.timer);
          call.reject(new Error(".NET bridge disconnected"));
          dotnetBridge.pending.delete(id);
        }
        if (!dotnetBridge._stopping) {
          dotnetBridge.restartTimer = setTimeout(() => dotnetBridge.start(), 2000);
        }
      });

      proc.on("error", (err) => {
        console.error("[.NET Bridge] Failed to start:", err.message);
        dotnetBridge._isRunning = false;
        dotnetBridge.process = null;
      });
    };

    dotnetBridge.start();
    app.on("before-quit", () => { dotnetBridge?.stop(); });
    console.log("[.NET Bridge] Started successfully");
  } catch (err) {
    console.warn("[.NET Bridge] Init failed:", err.message);
  }
}
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
  startDotNetBridge();
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