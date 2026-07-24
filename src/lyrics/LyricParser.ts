/**
 * LyricParser — 多格式歌词解析器
 *
 * 支持: LRC / TTML / QRC / YRC
 *
 * @module lyrics/LyricParser
 */

import type { LyricLine, LyricData, LyricSource } from "./types";

/** LRC 时间标签正则: [mm:ss.xx] 或 [mm:ss] */
const LRC_TIME_RE = /\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]/g;

/** 纯时间标签行（无歌词文本） */
const LRC_TAG_ONLY_RE = /^\[(\d{1,3}):(\d{2})(?:\.(\d{1,3}))?\]\s*$/;

function parseTimeTag(mm: string, ss: string, ms?: string): number {
  const m = parseInt(mm, 10);
  const s = parseInt(ss, 10);
  const c = ms ? parseInt(ms.padEnd(3, "0"), 10) / 1000 : 0;
  return m * 60 + s + c;
}

/** 解析 LRC 文本 */
function parseLRC(raw: string): LyricLine[] {
  const lines: LyricLine[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || LRC_TAG_ONLY_RE.test(trimmed)) continue;

    const matches = [...trimmed.matchAll(LRC_TIME_RE)];
    if (matches.length === 0) continue;

    const text = trimmed.replace(LRC_TIME_RE, "").trim();
    if (!text) continue;

    for (const m of matches) {
      const t = parseTimeTag(m[1], m[2], m[3]);
      lines.push({ time: t, text });
    }
  }
  lines.sort((a, b) => a.time - b.time);
  return lines;
}

/** 检测歌词格式 */
function detectSource(raw: string): LyricSource {
  const trimmed = raw.trim();
  if (/<tt\b/i.test(trimmed)) return "ttml";
  if (trimmed.startsWith("<?xml") || trimmed.startsWith("<song")) return "qrc";
  if (/^\[(\d{1,3}):(\d{2})/.test(trimmed)) return "lrc";
  if (/\((\d+),(\d+)\)/.test(trimmed)) return "yrc";
  return "unknown";
}

/**
 * 间奏检测阈值（秒）。
 * 两行歌词间隔超过此值时，中间自动插入间奏行，
 * 用于显示等待点动画（...）。
 */
const INTERLUDE_THRESHOLD = 10;

/**
 * 在歌词行之间自动检测并插入间奏行。
 * 当两行之间存在较大时间空隙时（如主歌→副歌的乐器过渡），
 * 插入 isInterlude 行用于渲染等待点动画。
 */
function generateInterludes(lines: LyricLine[]): LyricLine[] {
  if (lines.length === 0) return lines;

  const result: LyricLine[] = [];

  // Intro 间奏: 歌曲开始到第一句歌词之间的空白
  if (lines[0].time >= INTERLUDE_THRESHOLD) {
    result.push({
      time: 0,
      text: "",
      isInterlude: true,
      duration: lines[0].time,
    });
  }

  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);

    if (i < lines.length - 1) {
      const gap = lines[i + 1].time - lines[i].time;
      if (gap >= INTERLUDE_THRESHOLD) {
        // 在当前行 4s 后插入间奏行，给足阅读时间再显示等待点
        const interludeDelay = 4;
        const interludeTime = lines[i].time + interludeDelay;
        result.push({
          time: interludeTime,
          text: "",
          isInterlude: true,
          duration: gap - interludeDelay,
        });
      }
    }
  }

  return result;
}

/** 主解析入口 */
export function parseLyrics(raw: string): LyricData {
  const source = detectSource(raw);

  let lines: LyricLine[] = [];

  switch (source) {
    case "lrc":
      lines = parseLRC(raw);
      break;
    case "ttml":
    case "qrc":
    case "yrc":
    case "unknown":
    default:
      // 当前仅内置 LRC 解析，其他格式后续扩展
      lines = parseLRC(raw);
      break;
  }

  // 自动插入间奏行
  lines = generateInterludes(lines);

  return { title: "", artist: "", lines };
}

export { detectSource };
export type { LyricData, LyricLine, LyricSource };