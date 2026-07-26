const { ipcMain, dialog, shell, app } = require("electron");
const https = require("https");
const { cloudsearch, lyric } = require("NeteaseCloudMusicApi");



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
  const toLower = (s) => normalizeFullwidth((s || "").toLowerCase()).replace(/\s+/g, " ").trim();

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

  // ★ Bonus for raw (unstripped) title match — helps distinguish song versions
  // When stripBrackets removes version info, exact raw match breaks the tie
  if (sn !== snRaw && qt !== qtRaw) {
    if (sn === qt) score += 0.15;
    else if (sn.includes(qt) || qt.includes(sn)) score += 0.10;
    // 2-gram overlap on raw strings for version-specific matching
    else {
      const raw2g = chinese2gramOverlap(sn, qt);
      if (raw2g > 0.5) score += 0.08 * raw2g;
    }
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

  // Album matching — helps distinguish different versions of the same song
  if (queryAlbum && songAlbum) {
    const qal = toLower(normalizeChinese(queryAlbum || ""));
    const sal = toLower(normalizeChinese(songAlbum || ""));
    if (qal && sal) {
      if (qal === sal) score += 0.3;
      else if (qal.includes(sal) || sal.includes(qal)) score += 0.18;
      else {
        const maxLen = Math.max(qal.length, sal.length);
        if (maxLen > 3) {
          const dist = levenshteinDistance(qal, sal);
          const ratio = 1 - dist / maxLen;
          if (ratio > 0.7) score += 0.10;
        }
      }
    }
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
// ── Multi-query lyrics search helper: try different query formulations ──
async function searchLyricsMultiQuery(title, artist, album, searchFn) {
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
      const result = await searchFn(q.title, q.artist, album);
      if (result) return result;
    } catch {}
  }
  return null;
}

// ── Music: Online Lyrics Search (Netease) ──
function setupIPC({ mainWindow, electronSettings, quittingRef, saveElectronSettings, pythonBridge, dotnetBridge }) {
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

  // All RPC methods routed to .NET bridge, with Python + JS fallback
  let _callMethod = null;
  function getCallMethod() {
    if (!_callMethod) {
      try { _callMethod = require("./rpc/index").callMethod; }
      catch (e) { console.warn("[RPC] Failed to load JS routing:", e.message); }
    }
    return _callMethod;
  }

  ipcMain.handle("python:call", async (_event, method, params) => {
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
    if (pythonBridge.current?.isRunning) {
      try { return await pythonBridge.current.call(method, params); }
      catch (e) { console.warn("[Python Bridge]", method, "failed:", e.message); }
    }
    // Fallback to Node.js routing (electron/rpc/)
    const callMethod = getCallMethod();
    if (callMethod) {
      try { return await callMethod(method, params); }
      catch (e) { return { error: e.message }; }
    }
    return { error: "No bridge or JS fallback available" };
  });
  ipcMain.handle("python:status", () => pythonBridge.current?.isRunning ?? false);

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
      const searchRes = await cloudsearch({ keywords, type: 1, limit: 50 });
      const songs = searchRes?.body?.result?.songs;
      if (!songs || songs.length === 0) return null;

      let best = null;
      let bestScore = -1;
      let bestRawDist = Infinity;
      for (const s of songs) {
        const score = scoreMatch(s.name, s.ar, t, a, al, s.al?.name);
        // Tie-breaking: when scores are very close, prefer the song whose
        // raw (unstripped) title is closest to the query — this resolves
        // version conflicts (e.g., "2017 Mix" vs "10 years after Ver.")
        if (score > bestScore + 0.02) {
          bestScore = score;
          best = s;
          bestRawDist = levenshteinDistance(
            normalizeFullwidth(s.name.toLowerCase()),
            normalizeFullwidth((t || "").toLowerCase())
          );
        } else if (Math.abs(score - bestScore) <= 0.02 && best) {
          const rawDist = levenshteinDistance(
            normalizeFullwidth(s.name.toLowerCase()),
            normalizeFullwidth((t || "").toLowerCase())
          );
          if (rawDist < bestRawDist) {
            best = s;
            bestRawDist = rawDist;
          }
        }
      }

      if (!best || bestScore < 0.3) return null;

      const lyricRes = await lyric({ id: best.id });
      const body = lyricRes?.body;
      const lrc = body?.lrc?.lyric;
      const tlyric = body?.tlyric?.lyric;
      const romalrc = body?.romalrc?.lyric;
      const yrc = body?.yrc?.lyric;
      if (lrc) {
        console.log(`[Lyrics:Netease] Found, score=${bestScore.toFixed(2)}, id=${best.id}, album="${best.al?.name || ""}", hasTrans=${!!tlyric}, hasRoma=${!!romalrc}, hasDyn=${!!yrc}`);
        return { text: lrc, translated_text: tlyric || "", roman_text: romalrc || "", dynamic_text: yrc || "", source: "netease" };
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
    const keywords = [title, artist, album].filter(Boolean).join(" ");
    const searchRes = await cloudsearch({ keywords, type: 1, limit: 50 });
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


}

module.exports = { setupIPC };
