/**
 * LyricParser — Multi-format lyric parser
 *
 * Supports: LRC / YRC (dynamic/karaoke) / unsynced text
 * Auto-merges original + translation + romaji by timestamp.
 *
 * Ported from refined-now-playing-netease-next libLyric.
 *
 * @module lyrics/LyricParser
 */

import type { LyricLine, LyricData, DynamicLyricWord } from "./types";

// ── Regex ──

const LRC_TIME_RE = /\u005B(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\u005D/g;
const LRC_TAG_ONLY_RE = /^\u005B(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\u005D\s*$/;
const META_TIME_REGEX = /^\u005B(offset|ti|ar|al|by|la|ve|re):/i;

// YRC format: (lineTime,duration)word1(word1Time,duration,flag)word2...
const YRC_LINE_REGEX = /^\((\d+),(\d+)\)/;
const YRC_WORD_TIME_REGEX = /\((\d+),(\d+),(\d*)\)([^()]*)/g;

// ── Helpers ──

function parseTimeTag(mm: string, ss: string, ms?: string): number {
  const m = parseInt(mm, 10);
  const s = parseInt(ss, 10);
  const c = ms ? parseInt(ms.padEnd(3, "0"), 10) / 1000 : 0;
  return m * 60 + s + c;
}

const simularityCache: Record<string, number> = {};
function calcSimularity(a: string, b: string): number {
  if (typeof a === "undefined") a = "";
  if (typeof b === "undefined") b = "";
  const key = a + "::" + b;
  if (simularityCache[key] !== undefined) return simularityCache[key];
  const m = a.length, n = b.length;
  const d: number[][] = [];
  for (let i = 0; i <= m; i++) { d[i] = []; d[i][0] = i; }
  for (let j = 0; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      d[i][j] = a[i - 1] === b[j - 1] ? d[i - 1][j - 1] : Math.min(d[i - 1][j - 1] + 1, d[i][j - 1] + 1, d[i - 1][j] + 1);
  simularityCache[key] = d[m][n];
  return d[m][n];
}

function isEnglishSentence(str: string): boolean {
  return str.replace(/[\p{P}\p{S}]/gu, "").match(/^[\s\w\u00C0-\u024F]+$/u) !== null;
}

function replaceChineseSymbolsToEnglish(str: string): string {
  return str.replace(/[\u2018\u2019\u2032]/g, "'")
    .replace(/[\u201C\u201D\u2033]/g, '"')
    .replace(/\uFF08/g, "(").replace(/\uFF09/g, ")")
    .replace(/\uFF0C/g, ",").replace(/\uFF01/g, "!")
    .replace(/\uFF1F/g, "?").replace(/\uFF1A/g, ":")
    .replace(/\uFF1B/g, ";");
}

const findLast = <T>(items: T[], predicate: (item: T, index: number, items: T[]) => boolean): T | null => {
  for (let i = items.length - 1; i >= 0; i--)
    if (predicate(items[i], i, items)) return items[i];
  return null;
};


// ── Bilingual smart-split helpers (local LRC) ──

/** Detect if a character is CJK (Chinese/Japanese/Korean) */
function isCJKChar(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x4E00 && cp <= 0x9FFF) ||
    (cp >= 0x3400 && cp <= 0x4DBF) ||
    (cp >= 0x3000 && cp <= 0x303F) ||
    (cp >= 0xFF00 && cp <= 0xFFEF) ||
    (cp >= 0xAC00 && cp <= 0xD7AF) ||
    (cp >= 0x3040 && cp <= 0x309F) ||
    (cp >= 0x30A0 && cp <= 0x30FF);
}

/** Detect if character is Latin alphabet */
function isLatinChar(ch: string): boolean {
  const cp = ch.codePointAt(0)!;
  return (cp >= 0x41 && cp <= 0x5A) || (cp >= 0x61 && cp <= 0x7A) ||
    (cp >= 0xC0 && cp <= 0x24F);
}

/** Count CJK chars vs Latin chars in a string */
function countCharTypes(text: string): { cjk: number; latin: number; other: number; total: number } {
  let cjk = 0, latin = 0, other = 0;
  for (const ch of text) {
    if (isCJKChar(ch)) cjk++;
    else if (isLatinChar(ch)) latin++;
    else if (ch.trim()) other++;
  }
  return { cjk, latin, other, total: cjk + latin + other };
}

/** Check if text is dominantly CJK */
function isDominantlyCJK(text: string): boolean {
  const { cjk, latin } = countCharTypes(text);
  return cjk > latin && cjk > 0;
}

/** Check if text is dominantly Latin */
function isDominantlyLatin(text: string): boolean {
  const { cjk, latin } = countCharTypes(text);
  return latin > cjk && latin > 0;
}

/** Check if text contains Japanese kana (hiragana or katakana) */
function hasJapaneseKana(text: string): boolean {
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if ((cp >= 0x3040 && cp <= 0x309F) || (cp >= 0x30A0 && cp <= 0x30FF)) {
      return true;
    }
  }
  return false;
}

/** Check if a single line contains mixed bilingual content */
function isMixedBilingual(text: string): boolean {
  const { cjk, latin } = countCharTypes(text);
  return cjk >= 2 && latin >= 2;
}

/** Try to split a mixed bilingual line into original + translation */
function splitBilingualLine(text: string): { original: string; translation?: string } {
  if (!isMixedBilingual(text)) return { original: text };

  const delimiters = [' // ', ' || ', ' | ', ' / ', ' \\ ', '//', '||', '|', '/', '\\'];
  for (const sep of delimiters) {
    const idx = text.indexOf(sep);
    if (idx > 0 && idx + sep.length < text.length) {
      const a = text.substring(0, idx).trim();
      const b = text.substring(idx + sep.length).trim();
      if (!a || !b) continue;
      if (isDominantlyCJK(a) && isDominantlyLatin(b)) return { original: a, translation: b };
      if (isDominantlyLatin(a) && isDominantlyCJK(b)) return { original: b, translation: a };
    }
  }

  // Scan character-type segments
  let segments: { start: number; end: number; type: string }[] = [];
  let segStart = 0;
  let segType: string | null = null;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    let chType = 'other';
    if (isCJKChar(ch)) chType = 'cjk';
    else if (isLatinChar(ch)) chType = 'latin';

    if (chType === 'cjk' || chType === 'latin') {
      if (segType === null) { segType = chType; segStart = i; }
      else if (segType !== chType) {
        segments.push({ start: segStart, end: i, type: segType });
        segType = chType; segStart = i;
      }
    } else if (ch.trim() && segType !== null) {
      segments.push({ start: segStart, end: i, type: segType });
      segType = null;
    }
  }
  if (segType !== null) segments.push({ start: segStart, end: text.length, type: segType });

  if (segments.length >= 2) {
    const merged: typeof segments = [];
    for (const seg of segments) {
      const last = merged[merged.length - 1];
      if (last && last.type === seg.type && (seg.start - last.end) <= 3) last.end = seg.end;
      else merged.push(seg);
    }
    if (merged.length === 2 && merged[0].type !== merged[1].type) {
      const a = text.substring(merged[0].start, merged[0].end).trim();
      const b = text.substring(merged[1].start, merged[1].end).trim();
      if (a && b) {
        if (merged[0].type === 'cjk') return { original: a, translation: b };
        return { original: b, translation: a };
      }
    }
  }
  return { original: text };
}

/** Detect if text looks like Japanese romaji */
function looksLikeRomaji(text: string): boolean {
  if (!isDominantlyLatin(text)) return false;
  const words = text.split(/\s+/);
  if (words.length === 0) return false;
  const romajiPattern = /^[a-z]{1,4}$/;
  let romajiWords = 0;
  for (const w of words) if (romajiPattern.test(w.toLowerCase())) romajiWords++;
  return romajiWords >= words.length * 0.6;
}

/**
 * Merge lines that share the same timestamp (common in bilingual LRC files).
 * Intelligently separates original / translation / romaji content.
 */
function mergeSameTimeLines(lines: LyricPureLine[]): LyricPureLine[] {
  if (lines.length <= 1) return lines;

  const groups: Map<number, LyricPureLine[]> = new Map();
  for (const line of lines) {
    const existing = groups.get(line.time);
    if (existing) existing.push(line);
    else groups.set(line.time, [line]);
  }

  const result: LyricPureLine[] = [];

  for (const [time, group] of groups) {
    if (group.length === 1) {
      const line = group[0];
      if (isMixedBilingual(line.lyric)) {
        const split = splitBilingualLine(line.lyric);
        if (split.translation) {
          result.push({ time: line.time, lyric: split.original, originalLyric: split.original, translatedLyric: split.translation, unsynced: line.unsynced });
          continue;
        }
      }
      result.push(line);
      continue;
    }

    let originalLine: string | null = null;
    let translationLine: string | null = null;
    let romanLine: string | null = null;
    const unsynced = group.some((l: LyricPureLine) => l.unsynced);

    for (const l of group) {
      if (looksLikeRomaji(l.lyric)) { romanLine = l.lyric; break; }
    }

    const remaining = group.filter((l: LyricPureLine) => l.lyric !== romanLine);
    const cjkLines = remaining.filter((l: LyricPureLine) => isDominantlyCJK(l.lyric));
    const latinLines = remaining.filter((l: LyricPureLine) => isDominantlyLatin(l.lyric));

    if (cjkLines.length > 0 && latinLines.length > 0) {
      originalLine = cjkLines.map((l: LyricPureLine) => l.lyric).join(' / ');
      translationLine = latinLines.map((l: LyricPureLine) => l.lyric).join(' / ');
    } else if (cjkLines.length >= 2) {
      originalLine = cjkLines[0].lyric;
      translationLine = cjkLines.slice(1).map((l: LyricPureLine) => l.lyric).join(' / ');
    } else if (latinLines.length >= 2) {
      originalLine = latinLines[0].lyric;
      translationLine = latinLines.slice(1).map((l: LyricPureLine) => l.lyric).join(' / ');
    } else if (remaining.length === 0 && romanLine) {
      originalLine = romanLine; romanLine = null;
    } else if (remaining.length > 0) {
      const first = remaining[0].lyric;
      if (isMixedBilingual(first)) {
        const split = splitBilingualLine(first);
        originalLine = split.original;
        if (split.translation) translationLine = split.translation;
      } else {
        originalLine = remaining.map((l: LyricPureLine) => l.lyric).join(' / ');
      }
    }

    if (originalLine) {
      result.push({ time, lyric: originalLine, originalLyric: originalLine, translatedLyric: translationLine || undefined, romanLyric: romanLine || undefined, unsynced });
    }
  }

  return result.sort((a, b) => a.time - b.time);
}


// ── Pure LRC parser ──

interface LyricPureLine {
  time: number;
  lyric: string;
  originalLyric?: string;
  translatedLyric?: string;
  romanLyric?: string;
  unsynced?: boolean;
}

function parsePureLyric(raw: string): LyricPureLine[] {
  let result: LyricPureLine[] = [];
  let unsynced = false;

  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (META_TIME_REGEX.test(trimmed)) continue;

    const matches = [...trimmed.matchAll(LRC_TIME_RE)];
    if (matches.length === 0) {
      // Unsynced text
      unsynced = true;
      result.push({ time: 999999999, lyric: trimmed, unsynced: true });
      continue;
    }

    const text = trimmed.replace(LRC_TIME_RE, "").trim();
    if (!text) continue;

    for (const m of matches) {
      const t = parseTimeTag(m[1], m[2], m[3]);
      result.push({ time: t, lyric: text });
    }
  }

  // Merge same-timestamp lines (bilingual LRC support)
  result = mergeSameTimeLines(result);

  result.sort((a, b) => a.time - b.time);

  // Insert unsynced indicator
  if (unsynced && result.length > 0) {
    result.unshift({ time: 0, lyric: "歌词不支持滚动", unsynced: true });
  }

  return result;
}

// ── YRC Dynamic parser ──

function parsePureDynamicLyric(raw: string): LyricLine[] {
  const result: LyricLine[] = [];
  for (const line of raw.trim().split(/\r?\n/)) {
    let tmp = line.trim();
    const lineMatch = tmp.match(YRC_LINE_REGEX);
    if (!lineMatch) continue;

    const time = parseInt(lineMatch[1] || "0");
    const duration = parseInt(lineMatch[2] || "0");
    tmp = tmp.slice(lineMatch[0].length);

    const words: DynamicLyricWord[] = [];
    let wordMatch: RegExpExecArray | null;
    YRC_WORD_TIME_REGEX.lastIndex = 0;
    while ((wordMatch = YRC_WORD_TIME_REGEX.exec(tmp)) !== null) {
      const wordTime = parseInt(wordMatch[1] || "0");
      const wordDuration = parseInt(wordMatch[2] || "0");
      const flag = parseInt(wordMatch[3] || "0");
      const word = (wordMatch[4] || "").trimStart();
      const splitedWords = word.split(/\s+/).filter((v: string) => v.trim().length > 0);
      if (splitedWords.length > 0) {
        const splitedDuration = wordDuration / splitedWords.length;
        splitedWords.forEach((subWord: string, i: number) => {
          words.push({
            time: wordTime + i * splitedDuration,
            duration: splitedDuration,
            flag,
            word: subWord.trimStart(),
          });
        });
      }
    }

    result.push({
      time,
      duration,
      originalLyric: words.map((v) => v.word).join(""),
      text: words.map((v) => v.word).join(""),
      dynamicLyric: words,
      dynamicLyricTime: time,
    });
  }
  return result.sort((a, b) => a.time - b.time);
}

// ── Pure music line ──

const PURE_MUSIC_LYRIC_LINE: LyricLine[] = [{
  time: 0,
  duration: 5940000,
  originalLyric: "纯音乐，请欣赏",
  text: "纯音乐，请欣赏",
}];

// ── Process logic ──

/**
 * Post-process parsed lyrics: merge short interlude gaps, strip leading/trailing
 * empty lines, insert intro interlude, fix English punctuation.
 */
function processLyric(lyric: LyricLine[]): LyricLine[] {
  if (lyric.length > 0 && lyric[lyric.length - 1].time === 5940000 && lyric[lyric.length - 1].duration === 0) {
    return PURE_MUSIC_LYRIC_LINE;
  }

  const result: LyricLine[] = [];
  let isSpace = false;

  lyric.forEach((thisLyric, i, arr) => {
    if ((thisLyric.originalLyric || "").trim().length === 0) {
      const nextLyric = arr[i + 1];
      if (nextLyric && nextLyric.time - thisLyric.time > 1500 && !isSpace) {
        result.push(thisLyric);
        isSpace = true;
      }
    } else {
      isSpace = false;
      result.push(thisLyric);
    }
  });

  // Strip leading empty lines
  while (result[0] && (result[0].originalLyric || "").length === 0) {
    result.shift();
  }

  // Insert intro interlude if song starts >5s
  if (result[0] && result[0].time > 5000) {
    result.unshift({
      time: 500,
      duration: result[0].time - 500,
      originalLyric: "",
      text: "",
      isInterlude: true,
    });
  }

  // Fix Chinese punctuation in English sentences
  for (const thisLine of result) {
    if (!isEnglishSentence(thisLine?.originalLyric)) continue;
    if (thisLine.dynamicLyric) {
      for (const word of thisLine.dynamicLyric) {
        word.word = replaceChineseSymbolsToEnglish(word.word);
      }
    }
    if (thisLine.originalLyric) {
      thisLine.originalLyric = replaceChineseSymbolsToEnglish(thisLine.originalLyric);
      thisLine.text = thisLine.originalLyric;
    }
  }

  return result;
}

// ── Main API ──

/**
 * Parse lyrics from separate source strings.
 * Merges original, translated, roman, and dynamic lyrics by timestamp.
 */
export function parseLyric(
  original: string,
  translated: string = "",
  roman: string = "",
  dynamic: string = "",
): LyricLine[] {
  if (dynamic.trim().length === 0) {
    // ── No dynamic lyrics: merge original + translation + romaji by time ──
    const result: LyricLine[] = parsePureLyric(original).map((v) => ({
      time: v.time,
      originalLyric: v.originalLyric || v.lyric,
      text: v.originalLyric || v.lyric,
      translatedLyric: v.translatedLyric,
      romanLyric: v.romanLyric,
      duration: 0,
      ...(v.unsynced ? { unsynced: true } : {}),
    }));

    parsePureLyric(translated).forEach((line) => {
      const target = result.find((v) => v.time === line.time);
      if (target) target.translatedLyric = line.lyric;
    });

    parsePureLyric(roman).forEach((line) => {
      const target = result.find((v) => v.time === line.time);
      if (target) target.romanLyric = line.lyric;
    });

    result.sort((a, b) => a.time - b.time);

    const processed = processLyric(result);

    // Mark empty lines as interlude
    for (const line of processed) {
      if ((line.originalLyric || "").trim() === "") {
        line.isInterlude = true;
      }
    }

    for (let i = 0; i < processed.length; i++) {
      if (i < processed.length - 1) {
        processed[i].duration = processed[i + 1].time - processed[i].time;
      }
    }

    return processed;
  } else {
    // ── Has dynamic lyrics: use YRC as base, attach originals ──
    const processed = parsePureDynamicLyric(dynamic);
    const originalLyrics = parsePureLyric(original);

    // Determine matching mode: equal-time vs closest
    let attachMatchingMode: "equal" | "closest" = "equal";
    const lyricTimeSet = new Set(processed.map((v) => v.time));
    const originalLyricTimeSet = new Set(originalLyrics.map((v) => v.time));
    const intersection = new Set([...lyricTimeSet].filter((v) => originalLyricTimeSet.has(v)));
    if (intersection.size / lyricTimeSet.size < 0.1) {
      attachMatchingMode = "closest";
    }

    originalLyrics.forEach((line) => {
      let target: LyricPureLine | null = null;
      if (attachMatchingMode === "equal") {
        target = findLast(originalLyrics, (v) => Math.abs(v.time - line.time) < 20);
      } else {
        for (const v of originalLyrics) {
          if (!target || Math.abs(target.time - line.time) > Math.abs(v.time - line.time)) {
            target = v;
          }
        }
      }
      if (target) {
        const dynLine = processed.find((v) => v.time === target!.time);
        if (dynLine) {
          dynLine.originalLyric = line.lyric;
          dynLine.text = line.lyric;
        }
      }
    });

    // Attach translation and romaji
    const translations = parsePureLyric(translated);
    translations.forEach((line) => {
      const target = findLast(processed, (v) => Math.abs(v.time - line.time) < 20);
      if (target && !target.translatedLyric) target.translatedLyric = line.lyric;
    });

    const romans = parsePureLyric(roman);
    romans.forEach((line) => {
      const target = findLast(processed, (v) => Math.abs(v.time - line.time) < 20);
      if (target && !target.romanLyric) target.romanLyric = line.lyric;
    });

    const finalResult = processLyric(processed);

    // Mark empty lines as interlude
    for (const line of finalResult) {
      if ((line.originalLyric || "").trim() === "") {
        line.isInterlude = true;
      }
    }

    for (let i = 0; i < finalResult.length; i++) {
      if (i < finalResult.length - 1) {
        finalResult[i].duration = finalResult[i + 1].time - finalResult[i].time;
      }
    }

    return finalResult;
  }
}

/**
 * Parse lyrics into LyricData with metadata detection.
 */
export function parseLyricData(
  raw: string,
  translatedRaw?: string,
  romanRaw?: string,
  dynamicRaw?: string,
): LyricData {
  const lines = parseLyric(raw, translatedRaw || "", romanRaw || "", dynamicRaw || "");

  // Suppress same-script translations (e.g., Chinese original + Chinese "translation")
  // Allow cross-CJK translations (e.g., Japanese original + Chinese translation)
  for (const line of lines) {
    if (line.translatedLyric && line.originalLyric) {
      const origIsCJK = isDominantlyCJK(line.originalLyric);
      const transIsCJK = isDominantlyCJK(line.translatedLyric);
      if (origIsCJK === transIsCJK) {
        if (origIsCJK) {
          // Both CJK: only suppress if same language sub-family
          if (hasJapaneseKana(line.originalLyric) === hasJapaneseKana(line.translatedLyric)) {
            line.translatedLyric = undefined;
          }
        } else {
          // Both non-CJK (e.g., both Latin): suppress
          line.translatedLyric = undefined;
        }
      }
    }
  }

  const hasTranslation = lines.some((l) => !!l.translatedLyric);
  const hasRomaji = lines.some((l) => !!l.romanLyric);
  const hasKaraoke = lines.some((l) => !!l.dynamicLyric && l.dynamicLyric.length > 0);
  const isUnsynced = lines.some((l) => l.unsynced);

  return { title: "", artist: "", lines, hasTranslation, hasRomaji, hasKaraoke, isUnsynced };
}

export { parsePureLyric, parsePureDynamicLyric, processLyric, PURE_MUSIC_LYRIC_LINE };