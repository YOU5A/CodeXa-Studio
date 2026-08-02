// ── NetEase EAPI request module ──────────────────────────────────────────
// 独立实现网易云 EAPI 加密请求，协议参考（GPL-3.0，与本项目 AGPL-3.0 兼容）:
// - BetterNCM/LibEAPIRequest: https://github.com/BetterNCM/LibEAPIRequest
// - Steve-xmh/LibLyric: https://github.com/Steve-xmh/LibLyric
// 两个参考库为 BetterNCM 插件（依赖网易云客户端运行时），此处移植其请求协议:
// 搜索 /api/cloudsearch/pc、歌词 /api/song/lyric/v1（LibLyric getLyricData 同款参数）。
// 仅使用 Node 内置 https/crypto，无第三方依赖。

const https = require("https");
const crypto = require("crypto");

const EAPI_KEY = "e82ckenh8dichen8";
const API_HOST = "interface.music.163.com";
const REQUEST_TIMEOUT_MS = 15000;
const USER_AGENT =
  "Mozilla/5.0 (Windows NT 10.0; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Safari/537.36 Chrome/91.0.4472.164 NeteaseMusicDesktop/3.0.18.203152";

// EAPI 加密: md5("nobody${uri}use${text}md5forencrypt") →
// "${uri}-36cd479b6b5-${text}-36cd479b6b5-${digest}" → AES-128-ECB(PKCS7) → 大写 hex
function eapiEncrypt(uri, data) {
  const text = JSON.stringify(data);
  const digest = crypto
    .createHash("md5")
    .update(`nobody${uri}use${text}md5forencrypt`)
    .digest("hex");
  const payload = `${uri}-36cd479b6b5-${text}-36cd479b6b5-${digest}`;
  const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(EAPI_KEY), null);
  return Buffer.concat([cipher.update(payload, "utf8"), cipher.final()])
    .toString("hex")
    .toUpperCase();
}

function buildHeader() {
  return {
    os: "pc",
    appver: "3.0.18.203152",
    osver: "10.0.19045",
    deviceId: crypto.randomBytes(16).toString("hex"),
    requestId: `${Date.now()}_${Math.floor(Math.random() * 1000)
      .toString()
      .padStart(4, "0")}`,
    __csrf: "",
    channel: "",
    versioncode: "140",
    buildver: Date.now().toString().slice(0, 10),
    resolution: "1920x1080",
  };
}

// POST https://interface.music.163.com/eapi/<path>，body 为表单 params=<hex>
// 返回解析后的 JSON body；HTTP 或业务 code 非 200 视为失败并抛错。
function eapiRequest(uri, data) {
  const payload = { ...data, header: buildHeader(), e_r: false };
  const params = eapiEncrypt(uri, payload);
  const body = `params=${params}`;
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: API_HOST,
        path: `/eapi${uri.replace(/^\/api/, "")}`,
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "Content-Length": Buffer.byteLength(body),
          "User-Agent": USER_AGENT,
          Referer: "https://music.163.com/",
        },
        timeout: REQUEST_TIMEOUT_MS,
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          let parsed;
          try {
            parsed = JSON.parse(Buffer.concat(chunks).toString("utf8"));
          } catch (e) {
            reject(new Error(`EAPI invalid JSON response (HTTP ${res.statusCode})`));
            return;
          }
          if (res.statusCode !== 200 || parsed.code !== 200) {
            reject(
              new Error(`EAPI request failed (HTTP ${res.statusCode}, code ${parsed.code})`)
            );
            return;
          }
          resolve(parsed);
        });
      }
    );
    req.on("timeout", () => {
      req.destroy(new Error("EAPI request timeout"));
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// 歌曲搜索（与旧 cloudsearch 模块同端点/同数据）
function cloudsearch({ keywords, type = 1, limit = 30, offset = 0 } = {}) {
  return eapiRequest("/api/cloudsearch/pc", {
    s: keywords,
    type,
    limit,
    offset,
    total: true,
  });
}

// 歌词（LibLyric getLyricData 同款参数）
function lyric({ id }) {
  return eapiRequest("/api/song/lyric/v1", {
    id,
    cp: false,
    tv: 0,
    lv: 0,
    rv: 0,
    kv: 0,
    yv: 0,
    ytv: 0,
    yrv: 0,
  });
}

module.exports = { cloudsearch, lyric, eapiRequest, eapiEncrypt };
