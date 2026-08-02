// ── Japanese romaji generation ──────────────────────────────────────────
// 当网易云歌词缺少 romalrc 时，用 kuroshiro + kuromoji 在本地生成罗马音。
// 仅对包含假名的日文歌词生成，避免中文/英文歌词被错误转写。

const Kuroshiro = require("kuroshiro").default;
const KuromojiAnalyzer = require("kuroshiro-analyzer-kuromoji");

const LRC_TIME_RE = /\[(\d{1,3}):(\d{1,2})(?:[.:](\d{1,3}))?\]/g;
const KANA_RE = /[\u3040-\u309F\u30A0-\u30FF]/;
// 跳过作词/作曲/编曲等开头信息行（不需要音译）
const CREDIT_RE =
  /^\s*(?:作词|作曲|编曲|作詞|作曲|編曲|翻唱|制作人|制作|混音|录音|監修|原唱|演唱|OP|SP|出品)[:：]/;

let kuroshiroPromise = null;

function getKuroshiro() {
  if (!kuroshiroPromise) {
    kuroshiroPromise = (async () => {
      const kuroshiro = new Kuroshiro();
      await kuroshiro.init(new KuromojiAnalyzer());
      return kuroshiro;
    })();
  }
  return kuroshiroPromise;
}

const romajiCache = new Map();

/** 剥离行内“日文原文 （中文翻译）”里的中文翻译，仅转换日文部分 */
function splitInlineTranslation(text) {
  const groups = [...text.matchAll(/[（(]([^（）()]*)[）)]/g)];
  const translationParts = [];
  for (const g of groups) {
    const content = g[1].trim();
    if (/(?:间奏|前奏|尾奏|对白|独白|旁白|音效|演奏)/.test(content)) continue;
    if (content.length >= 2 && !KANA_RE.test(content) && /[\u4E00-\u9FFF]/.test(content)) {
      translationParts.push(g[0]);
    }
  }
  if (translationParts.length === 0) return null;
  let original = text;
  for (const part of translationParts) original = original.replace(part, " ");
  return { original: original.replace(/\s+/g, " ").trim() };
}

async function convertLine(text) {
  if (romajiCache.has(text)) return romajiCache.get(text);
  const kuroshiro = await getKuroshiro();
  let out = await kuroshiro.convert(text, {
    to: "romaji",
    mode: "spaced",
    romajiSystem: "hepburn",
  });
  // 清理：合并连续空格、标点/引号前不留空格
  out = out
    .replace(/\s+/g, " ")
    .replace(/\s+([、。，．！？!?.,;:])/g, "$1")
    .replace(/\s+(["'“”])/g, "$1")
    .replace(/(["'“”])\s+/g, "$1")
    .trim();
  // 防御：清除 kuroshiro 无法转写的残留汉字（如部分纯中文字符）
  out = out.replace(/[\u4E00-\u9FFF\u3400-\u4DBF]+/g, " ").replace(/\s+/g, " ").trim();
  romajiCache.set(text, out);
  return out;
}

/**
 * 将日文 LRC 歌词逐行转为罗马音 LRC（保留原时间戳）。
 * 无假名的歌词（中文/英文）或无可转换行时返回空字符串。
 */
async function toRomajiLrc(lrcText) {
  if (!lrcText || !KANA_RE.test(lrcText)) return "";
  const lines = lrcText.split(/\r?\n/);
  const out = [];
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("{")) continue; // 跳过 JSON 信息行
    const matches = [...line.matchAll(LRC_TIME_RE)];
    if (matches.length === 0) continue;
    const text = line.replace(LRC_TIME_RE, "").trim();
    if (!text || CREDIT_RE.test(text)) continue;
    // 行内“日文 （中文翻译）”只转日文部分
    const inline = splitInlineTranslation(text);
    const convertText = inline ? inline.original : text;
    if (!KANA_RE.test(convertText) && !inline) continue;
    const romaji = await convertLine(convertText);
    const tags = matches.map((m) => m[0]).join("");
    out.push(`${tags}${romaji}`);
  }
  return out.join("\n");
}

module.exports = { toRomajiLrc };
