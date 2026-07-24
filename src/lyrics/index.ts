/**
 * Lyrics Module — 统一导出（重构版）
 *
 * @module lyrics
 */

export { parseLyrics, detectSource } from "./LyricParser";
export { useLyricManager } from "./LyricManager";
export { default as LyricWindow } from "./LyricWindow";
export { default as LyricDisplay } from "./LyricDisplay";
export { default as LyricsLine } from "./LyricsLine";
export { scaleByOffset, blurByOffset, opacityByOffset } from "./LyricsLine";
export { default as InterludeDots, INTERLUDE_ROW_HEIGHT } from "./InterludeDots";
export { default as LyricsSettingsPanel } from "./LyricsSettingsPanel";
export {
  DEFAULT_LYRICS_SETTINGS,
  loadLyricsSettings,
  saveLyricsSettings,
} from "./LyricsSettingsPanel";
export type { LyricsSettingsValues } from "./LyricsSettingsPanel";
export type {
  LyricLine,
  LyricData,
  LyricSource,
  LyricWindowState,
} from "./types";
export type { LyricManagerState } from "./LyricManager";
export type { LyricsLineProps } from "./LyricsLine";
