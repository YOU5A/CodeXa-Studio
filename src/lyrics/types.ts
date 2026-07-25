/**
 * Lyrics Module — Core Type Definitions
 *
 * @module lyrics/types
 */

/** 逐词歌词单词 */
export interface DynamicLyricWord {
  time: number;
  duration: number;
  flag: number;
  word: string;
  isCJK?: boolean;
  endsWithSpace?: boolean;
  trailing?: boolean;
}

/** 单行歌词（扩展版：支持原文/翻译/罗马音/逐词） */
export interface LyricLine {
  time: number; // 秒
  /** 原文歌词文本（兼容旧 text 字段） */
  text: string;
  /** 原文歌词（同 text，语义化命名） */
  originalLyric: string;
  /** 翻译歌词（来自 tlyric/ytlrc/ttlrc） */
  translatedLyric?: string;
  /** 罗马音歌词（来自 romalrc/yromalrc） */
  romanLyric?: string;
  /** 原始 LRC 行（保留原始格式） */
  rawLyric?: string;
  /** 是否为间奏行（由解析器自动生成） */
  isInterlude?: boolean;
  /** 行持续时间（秒），间奏行时 = 间隔时长，普通行时 = 到下一行的时间 */
  duration: number;
  /** 逐词歌词时间（毫秒） */
  dynamicLyricTime?: number;
  /** 逐词歌词单词数组 */
  dynamicLyric?: DynamicLyricWord[];
  /** 是否为 unsynced 歌词（不支持滚动） */
  unsynced?: boolean;
}

/** 完整歌词数据（统一格式） */
export interface LyricData {
  title: string;
  artist: string;
  lines: LyricLine[];
  /** 是否包含翻译 */
  hasTranslation?: boolean;
  /** 是否包含罗马音 */
  hasRomaji?: boolean;
  /** 是否包含逐词歌词 */
  hasKaraoke?: boolean;
  /** 是否为 unsynced 歌词 */
  isUnsynced?: boolean;
}

/** 在线歌词搜索结果 */
export interface OnlineLyricResult {
  /** 原版 LRC 文本 */
  lyrics_text?: string | null;
  /** 翻译歌词文本 */
  translated_text?: string | null;
  /** 罗马音歌词文本 */
  roman_text?: string | null;
  /** 逐词歌词文本 */
  dynamic_text?: string | null;
  /** 来源标识 */
  source?: string;
  /** 错误信息 */
  error?: string;
}

/** 歌词来源 */
export type LyricSource = "lrc" | "ttml" | "qrc" | "yrc" | "unknown";

/** 词库源选项 */
export type LyricSourceOption = "auto" | "netease" | "lrc";

/** 歌词窗口状态 */
export interface LyricWindowState {
  visible: boolean;
  x: number;
  y: number;
}

/** 歌词显示设置值 */
export interface LyricsSettingsValues {
  enableScale: boolean;
  enableBlur: boolean;
  enableGlow: boolean;
  enableStagger: boolean;
  fontBold: boolean;
  fontSize: number;
  romajiFontSize: number;
  translationFontSize: number;
  alignmentPercentage: number;
  animationTiming: "smooth" | "sharp" | "easeout" | "lazy";
  lyricSource: LyricSourceOption;
  showTranslation: boolean;
  showRomaji: boolean;
  globalOffset: number;
}

export const DEFAULT_LYRICS_SETTINGS: LyricsSettingsValues = {
  enableScale: true,
  enableBlur: true,
  enableGlow: true,
  enableStagger: true,
  fontBold: true,
  fontSize: 20,
  romajiFontSize: 0.6,
  translationFontSize: 1.0,
  alignmentPercentage: 50,
  animationTiming: "smooth",
  lyricSource: "auto",
  showTranslation: true,
  showRomaji: true,
  globalOffset: 0,
};

const LYRICS_SETTINGS_KEY = "lyricsSettings";

export function loadLyricsSettings(): LyricsSettingsValues {
  try {
    const raw = localStorage.getItem(LYRICS_SETTINGS_KEY);
    if (raw) return { ...DEFAULT_LYRICS_SETTINGS, ...JSON.parse(raw) };
  } catch { /* ignore */ }
  return { ...DEFAULT_LYRICS_SETTINGS };
}

export function saveLyricsSettings(values: LyricsSettingsValues): void {
  try {
    localStorage.setItem(LYRICS_SETTINGS_KEY, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("lyricsSettingsChanged"));
  } catch { /* ignore */ }
}