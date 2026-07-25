/**
 * Lyrics Module - Unified exports
 *
 * @module lyrics
 */

export { parseLyric, parseLyricData, parsePureLyric, parsePureDynamicLyric, processLyric, PURE_MUSIC_LYRIC_LINE } from "./LyricParser";
export { useLyricManager } from "./LyricManager";
export { default as LyricWindow } from "./LyricWindow";
export { default as LyricDisplay } from "./LyricDisplay";
export { default as LyricBlock } from "./LyricBlock";
export { scaleByOffset, blurByOffset, opacityByOffset, estimateCharUnits } from "./LyricBlock";
export { default as InterludeDots, INTERLUDE_ROW_HEIGHT } from "./InterludeDots";
export { default as LyricsSettingsPanel } from "./LyricsSettingsPanel";
export {
  DEFAULT_LYRICS_SETTINGS,
  loadLyricsSettings,
  saveLyricsSettings,
} from "./types";
export type { LyricsSettingsValues } from "./types";
export type {
  LyricLine,
  LyricData,
  DynamicLyricWord,
  OnlineLyricResult,
  LyricSource,
  LyricSourceOption,
  LyricWindowState,
} from "./types";
export type { LyricManagerState } from "./LyricManager";
export type { LyricBlockProps } from "./LyricBlock";