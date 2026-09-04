const { ipcMain, dialog, shell, app, screen } = require("electron");
const https = require("https");
const { cloudsearch, lyric } = require("./netease-eapi");
const { toRomajiLrc } = require("./romaji");



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

// ── Full-width → half-width normalization (handles Japanese/Chinese punctuation) ──
function normalizeFullwidth(s) {
  if (!s) return "";
  let out = "";
  for (const ch of s) {
    const cp = ch.codePointAt(0);
    // Full-width ASCII punctuation, digits, letters: U+FF01–U+FF5E → U+0021–U+007E
    if (cp >= 0xFF01 && cp <= 0xFF5E) {
      out += String.fromCodePoint(cp - 0xFEE0);
    }
    // Full-width space U+3000 → U+0020
    else if (cp === 0x3000) {
      out += " ";
    }
    else {
      out += ch;
    }
  }
  return out;
}

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

// 将多艺术家字段拆成可比较的独立名称。网易云搜索会把逗号、斜杠、× 等
// 当作关键词，拆分后才能正确识别“Daoko,米津玄師”这类协作艺人。
function splitArtistTokens(value) {
  const normalized = normalizeFullwidth(String(value || ""))
    .replace(/[，、；;|/／&＆+＋×]/g, ",")
    .replace(/\s+\b(?:feat\.?|ft\.?|with)\b\s+/gi, ",")
    .replace(/\s+x\s+/gi, ",");
  return normalized
    .split(",")
    .map((item) => stripBrackets(item).trim())
    .filter(Boolean);
}

function normalizeMatchKey(value) {
  return normalizeFullwidth(normalizeChinese(stripBrackets(value || "")))
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+/gi, "");
}

// 版本/翻唱标记不是目标曲目的歌词版本，匹配时降低其优先级，避免
// “环境音/Remix”因同时包含多个艺人名而压过原曲。
function candidateVersionPenalty(songName, songAlbum, queryTitle) {
  const normalizeVersionKey = (value) => normalizeFullwidth(normalizeChinese(value || ""))
    .toLowerCase()
    .replace(/[^a-z0-9\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff]+/gi, "");
  const haystack = normalizeVersionKey(`${songName || ""} ${songAlbum || ""}`);
  const query = normalizeVersionKey(queryTitle);
  const markers = [
    "cover", "翻唱", "翻自", "remix", "mix", "acoustic", "live", "piano",
    "instrumental", "伴奏", "纯音乐", "环境音", "口琴", "吉他", "钢琴", "粤语", "中文版",
  ];
  let penalty = 0;
  for (const marker of markers) {
    const key = normalizeVersionKey(marker);
    if (key && haystack.includes(key) && !query.includes(key)) {
      penalty += marker === "remix" || marker === "mix" || marker === "环境音" ? 0.28 : 0.16;
    }
  }
  return Math.min(penalty, 0.5);
}

function hasUsableLyrics(lrc) {
  if (typeof lrc !== "string" || !lrc.trim()) return false;
  const meaningful = [];
  for (const rawLine of lrc.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;
    let text = line;
    if (line.startsWith("{")) {
      try {
        const json = JSON.parse(line);
        text = Array.isArray(json.c) ? json.c.map((part) => part?.tx || "").join("") : "";
      } catch {
        text = "";
      }
    } else {
      text = text.replace(/^\[\d{1,3}:\d{2}(?:\.\d{1,3})?\]\s*/, "");
      text = text.replace(/^\[[^\]]+\]\s*/, "");
    }
    text = text.trim();
    if (!text || /^(?:作词|作曲|编曲|作詞|編曲|制作人|制作|混音|录音|監修|原唱|演唱|OP|SP|出品)[:：]/i.test(text)) continue;
    meaningful.push(text);
  }
  if (meaningful.length === 0) return false;
  return meaningful.some((text) => !/^(?:纯音乐(?:，请欣赏)?|instrumental(?:\s+music)?|伴奏|inst\.?|音乐)$/i.test(text));
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

function scoreMatch(songName, songArtists, queryTitle, queryArtist, queryAlbum, songAlbum) {
  const toLower = (value) => normalizeFullwidth((value || "").toLowerCase()).replace(/\s+/g, " ").trim();
  const snRaw = toLower(normalizeChinese(stripBrackets(songName || "")));
  const qtRaw = toLower(normalizeChinese(stripBrackets(queryTitle || "")));
  const sn = toLower(normalizeChinese(songName || ""));
  const qt = toLower(normalizeChinese(queryTitle || ""));
  let score = 0;

  // 标题优先：原曲通常是精确标题，翻唱/混音会在标题中附加版本标记。
  if (sn === qt || snRaw === qtRaw) score += 0.5;
  else if (sn.includes(qt) || qt.includes(sn) || snRaw.includes(qtRaw) || qtRaw.includes(snRaw)) score += 0.38;
  else {
    const maxLen = Math.max(sn.length, qt.length);
    if (maxLen > 3) {
      const dist = levenshteinDistance(sn, qt);
      const ratio = 1 - dist / maxLen;
      if (ratio > 0.8) score += 0.25;
      else if (ratio > 0.6) score += 0.12;
    }
    const c2g = chinese2gramOverlap(sn, qt);
    if (c2g > 0.4) score += 0.18 * c2g;
    const snWords = new Set(sn.split(" "));
    const qtWords = new Set(qt.split(" "));
    let overlap = 0;
    for (const word of qtWords) if (word && snWords.has(word)) overlap++;
    if (overlap > 0) score += 0.12 * (overlap / Math.max(qtWords.size, 1));
  }

  // 原始标题精确匹配奖励，用于区分同名的不同版本。
  if (sn !== snRaw && qt !== qtRaw) {
    if (sn === qt) score += 0.15;
    else if (sn.includes(qt) || qt.includes(sn)) score += 0.10;
    else {
      const raw2g = chinese2gramOverlap(sn, qt);
      if (raw2g > 0.5) score += 0.08 * raw2g;
    }
  }

  // 多艺术家按 token 匹配，不再把“Daoko,米津玄師”当成一个整体字符串。
  const queryArtists = splitArtistTokens(queryArtist).map(normalizeMatchKey).filter(Boolean);
  const songArtistKeys = (songArtists || [])
    .map((artist) => normalizeMatchKey(typeof artist === "string" ? artist : artist?.name || ""))
    .filter(Boolean);
  if (queryArtists.length && songArtistKeys.length) {
    let matched = 0;
    for (const queryArtistKey of queryArtists) {
      if (songArtistKeys.some((songArtistKey) => songArtistKey === queryArtistKey || songArtistKey.includes(queryArtistKey) || queryArtistKey.includes(songArtistKey))) matched++;
    }
    if (matched === queryArtists.length) score += 0.4;
    else if (matched > 0) score += 0.28 * (matched / queryArtists.length);
  } else if (!queryArtists.length) {
    score += 0.2;
  }

  if (queryAlbum && songAlbum) {
    const qal = toLower(normalizeChinese(queryAlbum));
    const sal = toLower(normalizeChinese(songAlbum));
    if (qal && sal) {
      if (qal === sal) score += 0.3;
      else if (qal.includes(sal) || sal.includes(qal)) score += 0.18;
      else {
        const maxLen = Math.max(qal.length, sal.length);
        if (maxLen > 3 && 1 - levenshteinDistance(qal, sal) / maxLen > 0.7) score += 0.10;
      }
    }
  }

  return Math.max(0, score - candidateVersionPenalty(songName, songAlbum, queryTitle));
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
// ── Multi-query lyrics search helper: try different query formulations ──
async function searchLyricsMultiQuery(title, artist, album, searchFn) {
  // 标题优先，再用拆分后的艺人名补充查询。把所有艺人拼成一个关键词会
  // 把网易云结果推向“环境音/混音”等包含多个名字的错误版本。
  const strippedTitle = stripBrackets(title);
  const strippedArtist = artist ? stripBrackets(artist) : "";
  const artistTokens = splitArtistTokens(artist);
  const queries = [{ title, artist: "" }];
  for (const token of artistTokens) queries.push({ title, artist: token });
  if (artist) queries.push({ title, artist });
  if (strippedTitle !== title) {
    queries.push({ title: strippedTitle, artist: "" });
    for (const token of splitArtistTokens(strippedArtist || artist)) queries.push({ title: strippedTitle, artist: token });
    if (artist) queries.push({ title: strippedTitle, artist: strippedArtist || artist });
  }

  const seen = new Set();
  const unique = [];
  for (const q of queries) {
    const key = `${q.title}|${q.artist || ""}`.toLowerCase();
    if (!seen.has(key)) { seen.add(key); unique.push(q); }
  }
  let bestResult = null;
  let bestScore = -Infinity;
  for (const q of unique) {
    try {
      const result = await searchFn(q.title, q.artist, album);
      if (result) {
        const score = Number.isFinite(result._score) ? result._score : 0;
        if (!bestResult || score > bestScore) {
          bestResult = result;
          bestScore = score;
        }
        // 精确标题 + 艺人已得到高置信结果时无需继续请求剩余查询，
        // 避免多艺术家文件产生过多网易云歌词请求。
        if (bestScore >= 0.9) break;
      }
    } catch {}
  }
  return bestResult;
}

// ── Music: Online Lyrics Search (Netease) ──
function setupIPC({ mainWindow, electronSettings, quittingRef, saveElectronSettings, dotnetBridge, fullscreenStateRef }) {
  // Window controls
    ipcMain.handle("window:minimize", () => mainWindow.current?.minimize());

  ipcMain.handle("window:maximize", () => {
    if (mainWindow.current?.isMaximized()) { mainWindow.current.unmaximize(); return false; }
    else { mainWindow.current?.maximize(); return true; }
  });

  ipcMain.handle("window:close", () => {
    if (electronSettings.closeToTray && mainWindow && !quittingRef.current) {
      mainWindow.current.hide();
    } else {
      quittingRef.current = true;
      mainWindow.current?.close();
    }
  });

  ipcMain.handle("window:isMaximized", () => mainWindow.current?.isMaximized());
  ipcMain.handle("window:setOpacity", (_e, opacity) => { mainWindow.current?.setOpacity(opacity); });
  ipcMain.handle("window:getPosition", () => mainWindow.current?.getPosition());
  ipcMain.handle("window:getSize", () => mainWindow.current?.getSize());
  ipcMain.handle("window:setPosition", (_e, x, y) => { mainWindow.current?.setPosition(x, y); });

  // 全屏：不依赖 OS setFullScreen（Windows 透明无边框窗口退出不可靠，曾出现窗口卡全屏、
  // 只有字号在切换）。改为在工作区内做边界平滑补间 + 自定义状态事件，从根上消除状态错位。
  let preFullscreenBounds = null;
  let fullscreenAnimTimer = null;
  const FULLSCREEN_ANIM_MS = 260;
  const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);

  const animateWindowBounds = (win, from, to, onDone) => {
    const start = Date.now();
    const step = () => {
      if (win.isDestroyed() || win.webContents.isDestroyed()) { onDone?.(); return; }
      const t = Math.min(1, (Date.now() - start) / FULLSCREEN_ANIM_MS);
      const e = easeOutCubic(t);
      win.setBounds({
        x: Math.round(from.x + (to.x - from.x) * e),
        y: Math.round(from.y + (to.y - from.y) * e),
        width: Math.max(1, Math.round(from.width + (to.width - from.width) * e)),
        height: Math.max(1, Math.round(from.height + (to.height - from.height) * e)),
      }, false);
      if (t < 1) {
        fullscreenAnimTimer = setTimeout(step, 16);
      } else {
        onDone?.();
      }
    };
    step();
  };

  // 单次补间执行体：next 与当前目标不同才真正动画，同向重复请求直接短路
  const runFullscreenTransition = (win, next) => new Promise((resolve) => {
    if (win.isDestroyed()) { resolve(false); return; }
    if (next === fullscreenStateRef.current) { resolve(next); return; }
    const from = win.getBounds();
    const display = screen.getDisplayMatching(from);
    const fullBounds = {
      x: display.workArea.x, y: display.workArea.y,
      width: display.workArea.width, height: display.workArea.height,
    };
    if (next) {
      preFullscreenBounds = from;
    } else if (!preFullscreenBounds) {
      preFullscreenBounds = from;
    }
    const to = next ? fullBounds : preFullscreenBounds;
    fullscreenStateRef.current = next;
    fullscreenStateRef.animating = true;
    // 先同步渲染层状态：字号/圆角/布局随窗口补间一起过渡
    if (!win.webContents.isDestroyed()) win.webContents.send("window:fullscreenChange", next);
    animateWindowBounds(win, from, to, () => {
      fullscreenStateRef.animating = false;
      fullscreenAnimTimer = null;
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        if (!next) preFullscreenBounds = null;
        // 结束校准一次，防止 Windows 圆角吸附等造成几像素残留
        const cur = win.getBounds();
        if (Math.abs(cur.x - to.x) > 2 || Math.abs(cur.y - to.y) > 2 ||
            Math.abs(cur.width - to.width) > 2 || Math.abs(cur.height - to.height) > 2) {
          win.setBounds(to);
        }
        win.webContents.send("window:fullscreenChange", next);
      }
      resolve(next);
    });
  });

  // 全屏请求串行链：动画期间到达的相反请求（如进入中点击关闭）排队等待，完成后继续执行
  let fullscreenChain = Promise.resolve();
  ipcMain.handle("window:toggleFullscreen", (_e, force) => {
    const win = mainWindow.current;
    if (!win || win.isDestroyed()) return Promise.resolve(false);
    const requested = typeof force === "boolean" ? force : !fullscreenStateRef.current;
    // 串行执行：进入/退出/关闭期间的相反请求都会排队，最终状态与最后一次请求一致
    fullscreenChain = fullscreenChain.then(() => runFullscreenTransition(win, requested));
    return fullscreenChain;
  });
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
    if (mainWindow.current && !mainWindow.current.isDestroyed()) {
      const defaultWidth = 1280;
      const defaultHeight = 860;
      if (mainWindow.current.isMaximized()) mainWindow.current.unmaximize();
      mainWindow.current.setSize(defaultWidth, defaultHeight);
      mainWindow.current.center();
      console.log("[Settings] Window bounds reset to default:", defaultWidth, "x", defaultHeight);
    }
    return true;
  });

  ipcMain.handle("settings:getAll", () => {
    return { ...electronSettings };
  });

  // All RPC methods routed to .NET bridge, with JS fallback
  let _callMethod = null;
  function getCallMethod() {
    if (!_callMethod) {
      try { _callMethod = require("./rpc/index").callMethod; }
      catch (e) { console.warn("[RPC] Failed to load JS routing:", e.message); }
    }
    return _callMethod;
  }

  ipcMain.handle("bridge:call", async (_event, method, params) => {
    // GPU name tools are also available in the JS router so they work while an older
    // published .NET bridge is still present (for example during development).
    if (["gpu.detect", "gpu.write_name", "gpu.backup.create", "gpu.backup.list", "gpu.backup.restore", "gpu.backup.delete", "gpu.backup.clear"].includes(method)) {
      const gpuRegistry = require("./rpc/registry");
      if (method === "gpu.detect") return gpuRegistry.detectGpuAsync();
      if (method === "gpu.write_name") return gpuRegistry.writeGpuName(params || {});
      if (method === "gpu.backup.create") return gpuRegistry.gpuBackupCreate();
      if (method === "gpu.backup.list") return gpuRegistry.gpuBackupList();
      if (method === "gpu.backup.delete") return gpuRegistry.gpuBackupDelete(params?.filename);
      if (method === "gpu.backup.clear") return gpuRegistry.gpuBackupClear();
      return gpuRegistry.gpuBackupRestore(params?.filepath);
    }
    // NCM methods handled natively (no bridge needed)
    if (method === "ncm.list") {
      const { listNcm } = require("./rpc/ncm");
      return await listNcm(params);
    }
    if (method === "ncm.get_info") {
      const { getInfo } = require("./rpc/ncm");
      return await getInfo(params);
    }
    if (method === "ncm.decode") {
      const { decode } = require("./rpc/ncm");
      return await decode(params);
    }
    if (method === "ncm.batch_decode") {
      const { batchDecode } = require("./rpc/ncm");
      return await batchDecode(params);
    }

    if (dotnetBridge.current?.isRunning) {
      try { return await dotnetBridge.current.call(method, params); }
      catch (e) { console.warn("[.NET Bridge]", method, "failed:", e.message); }
    }
    // Fallback to Node.js routing (electron/rpc/)
    const callMethod = getCallMethod();
    if (callMethod) {
      try { return await callMethod(method, params); }
      catch (e) { return { error: e.message }; }
    }
    return { error: "No bridge or JS fallback available" };
  });
  ipcMain.handle("bridge:status", () => dotnetBridge.current?.isRunning ?? false);

  // Dialogs
  ipcMain.handle("dialog:openFolder", async () => {
    const result = await dialog.showOpenDialog(mainWindow.current, { properties: ["openDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:openFile", async (_event, filters) => {
    const result = await dialog.showOpenDialog(mainWindow.current, {
      properties: ["openFile"],
      filters: filters ? [filters] : [],
    });
    return result.canceled ? null : result.filePaths[0];
  });
  ipcMain.handle("dialog:saveFile", async (_event, options) => {
    const result = await dialog.showSaveDialog(mainWindow.current, options);
    return result.canceled ? null : result.filePath;
  });

  // Shell
  ipcMain.handle("shell:openPath", async (_event, filePath) => shell.openPath(filePath));
  ipcMain.handle("shell:openExternal", async (_event, url) => shell.openExternal(url));
  ipcMain.handle("app:getPath", async (_event, name) => app.getPath(name));

  // Music / Cover / Lyrics search (online)
  ipcMain.handle("music:searchLyrics", async (_event, title, artist, album, lyricSource) => {
  const searchNetease = async (t, a, al) => {
    try {
      const keywords = a ? `${t} ${a}` : t;
      const searchRes = await cloudsearch({ keywords, type: 1, limit: 100 });
      const songs = searchRes?.result?.songs;
      if (!songs || songs.length === 0) return null;

      const ranked = songs
        .map((song) => ({ song, score: scoreMatch(song.name, song.ar, t, a, al, song.al?.name) }))
        .sort((left, right) => {
          if (Math.abs(right.score - left.score) > 0.02) return right.score - left.score;
          const leftDist = levenshteinDistance(normalizeFullwidth((left.song.name || "").toLowerCase()), normalizeFullwidth((t || "").toLowerCase()));
          const rightDist = levenshteinDistance(normalizeFullwidth((right.song.name || "").toLowerCase()), normalizeFullwidth((t || "").toLowerCase()));
          return leftDist - rightDist;
        });

      // 只检查排名靠前的少量候选；纯音乐/环境音没有可同步歌词时继续尝试，
      // 防止它们因标题中包含艺人名而截断后续正确结果。
      for (const { song: candidate, score } of ranked.slice(0, 8)) {
        if (score < 0.2) continue;
        let body;
        try {
          body = await lyric({ id: candidate.id });
        } catch {
          continue;
        }
        const lrc = body?.lrc?.lyric;
        if (!hasUsableLyrics(lrc)) continue;
        const tlyric = body?.tlyric?.lyric;
        let romalrc = body?.romalrc?.lyric;
        const yrc = body?.yrc?.lyric;
        // 缺少 romalrc 时本地生成罗马音（仅日文歌词）
        if (!romalrc && lrc) {
          try {
            const generated = await toRomajiLrc(lrc);
            if (generated) {
              romalrc = generated;
              console.log(`[Lyrics:Netease] Generated romaji, id=${candidate.id}`);
            }
          } catch (e) {
            console.warn("[Lyrics:Romaji]", e.message);
          }
        }
        console.log(`[Lyrics:Netease] Found, score=${score.toFixed(2)}, id=${candidate.id}, album="${candidate.al?.name || ""}", hasTrans=${!!tlyric}, hasRoma=${!!romalrc}, hasDyn=${!!yrc}`);
        return { text: lrc, translated_text: tlyric || "", roman_text: romalrc || "", dynamic_text: yrc || "", source: "netease", _score: score };
      }
      return null;
    } catch (e) {
      console.log("[Lyrics:Netease] Error:", e.message);
      return null;
    }
  };

  try {
    const src = lyricSource || "auto";
    console.log("[Lyrics] Source mode:", src);

    // Both "auto" and "netease": try Netease with multi-query + single fallback
    const result = await searchLyricsMultiQuery(title, artist, album, searchNetease);
    if (result) return { lyrics_text: result.text, translated_text: result.translated_text || "", roman_text: result.roman_text || "", dynamic_text: result.dynamic_text || "", source: result.source };

    // Single-query fallback
    console.log("[Lyrics] Multi-query failed, trying single fallback...");
    const direct = await searchNetease(title, artist, album);
    if (direct) return { lyrics_text: direct.text, translated_text: direct.translated_text || "", roman_text: direct.roman_text || "", dynamic_text: direct.dynamic_text || "", source: direct.source };

    return { lyrics_text: null, translated_text: null, roman_text: null, dynamic_text: null, source: "none" };
  } catch (e) {
    console.error("[Music:SearchLyrics]", e.message);
    return { lyrics_text: null, translated_text: null, roman_text: null, dynamic_text: null, source: "none", error: e.message };
  }
});

// ── Cover Search: Netease ──
ipcMain.handle("music:searchCoverNetease", async (_event, title, artist, album) => {
  try {
    const keywords = title;
    const searchRes = await cloudsearch({ keywords, type: 1, limit: 100 });
    const songs = searchRes?.result?.songs;
    if (!songs || songs.length === 0) return { results: [] };

    const seen = new Set();
    const results = [];
    for (const s of songs) {
      const picUrl = s?.al?.picUrl;
      if (!picUrl || seen.has(picUrl)) continue;
      const songArtists = (s.ar || []).map(a => a.name || "");
      const score = scoreMatch(s.name, songArtists, title, "");
      if (score < 0.05) continue;
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
    const query = title;
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
      const score = scoreMatch(s.name || s.title, songArtists, title, "");
      if (score < 0.05) continue;
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
    const query = encodeURIComponent(title);
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
      const score = scoreMatch(r.trackName, songArtists, title, "");
      if (score < 0.05) continue;
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


}

module.exports = {
  setupIPC,
  // 保留纯函数导出供离线回归测试使用，不改变运行时 IPC API。
  __test: { splitArtistTokens, normalizeMatchKey, candidateVersionPenalty, hasUsableLyrics, scoreMatch, searchLyricsMultiQuery },
};
