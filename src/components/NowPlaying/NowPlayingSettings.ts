/**
 * NowPlaying — 覆盖层专属设置（localStorage 持久化）
 *
 * 存放覆盖层自身行为开关与专属歌词样式；全局偏移/词库源仍复用 lyrics/types.ts 的共享设置。
 */

import type { LyricsSettingsValues } from "@/lyrics";

/** NowPlaying 与共享歌词设置隔离的样式字段（主字号 lyricsFontSize 与对齐 lyricsAlign 单独存储） */
type NowPlayingLyricStyleKeys =
  | "showTranslation" | "showRomaji" | "fontBold"
  | "enableScale" | "enableBlur" | "enableGlow" | "enableStagger"
  | "animationTiming" | "romajiFontSize" | "translationFontSize"
  | "alignmentPercentage";

/** NowPlaying 专属歌词样式（悬浮歌词窗不受影响） */
export type NowPlayingLyricStyles = Pick<LyricsSettingsValues, NowPlayingLyricStyleKeys>;

export interface NowPlayingSettingsValues {
  /** 鼠标停止移动 1.5 秒后淡出界面元素（信息/控件/右上角按钮） */
  idleHide: boolean;
  /** 显示模式：全部 / 仅歌词 / 仅封面 */
  displayMode: "all" | "lyric-only" | "song-info-only";
  /** 进度条悬停预览：鼠标悬停在进度条上时显示对应歌词 */
  enableProgressbarPreview: boolean;
  /** 隐藏整个播放控制区（进度条+时间+按钮+音量） */
  hidePlayerControls: boolean;
  /** 方形专辑封面（关 = 圆形 CD） */
  rectangleCover: boolean;
  /** 封面弥散阴影 */
  coverBlurryShadow: boolean;
  /** 逐字歌词开关（右下角按钮同步） */
  useKaraokeLyrics: boolean;
  /** 逐字动画类型：上浮 / 滑动 */
  karaokeAnimation: "float" | "slide";
  /** 长音发光动画 */
  lyricGlow: boolean;
  /** NowPlaying 专属歌词对齐方式：left / center / right */
  lyricsAlign: "left" | "center" | "right";
  /** NowPlaying 专属歌词样式（字号/显隐/动画等，与共享 lyricsSettings 隔离） */
  lyricStyles: NowPlayingLyricStyles;
  /** NowPlaying 专属歌词字号（默认 38px，设置面板可自由调整） */
  lyricsFontSize: number;
}

export const DEFAULT_NOW_PLAYING_SETTINGS: NowPlayingSettingsValues = {
  idleHide: false,
  displayMode: "all",
  enableProgressbarPreview: true,
  hidePlayerControls: false,
  rectangleCover: true,
  coverBlurryShadow: true,
  useKaraokeLyrics: true,
  karaokeAnimation: "float",
  lyricGlow: false,
  lyricsAlign: "center",
  lyricStyles: {
    showTranslation: true,
    showRomaji: true,
    fontBold: true,
    enableScale: true,
    enableBlur: true,
    enableGlow: true,
    enableStagger: true,
    animationTiming: "smooth",
    romajiFontSize: 0.6,
    translationFontSize: 0.8,
    alignmentPercentage: 50,
  },
  lyricsFontSize: 38,
};


const NOW_PLAYING_SETTINGS_KEY = "nowplaying-settings";
/** 设置存储版本：v2 起闲置自动隐藏默认关闭（旧数据为 true 时重置一次）；v3 起新增显示模式/预览/封面/暗化/逐字等字段 */
const NOW_PLAYING_SETTINGS_VERSION = 3;

export function loadNowPlayingSettings(): NowPlayingSettingsValues {
  try {
    const raw = localStorage.getItem(NOW_PLAYING_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<NowPlayingSettingsValues>;
      const parsedWithVersion = parsed as Partial<NowPlayingSettingsValues> & { version?: number };
      // v2：闲置自动隐藏默认改为关闭
      if (parsedWithVersion.version !== NOW_PLAYING_SETTINGS_VERSION) {
        parsedWithVersion.idleHide = false;
        parsedWithVersion.version = NOW_PLAYING_SETTINGS_VERSION;
      }
      // 旧版默认字号 40px 迁移为新的默认 38px
      if (parsed.lyricsFontSize === 40) parsed.lyricsFontSize = 38;
      return { ...DEFAULT_NOW_PLAYING_SETTINGS, ...parsed };
    }
  } catch {
    /* ignore */
  }
  return { ...DEFAULT_NOW_PLAYING_SETTINGS };
}

export function saveNowPlayingSettings(values: NowPlayingSettingsValues): void {
  try {
    localStorage.setItem(NOW_PLAYING_SETTINGS_KEY, JSON.stringify({ ...values, version: NOW_PLAYING_SETTINGS_VERSION }));
  } catch {
    /* ignore */
  }
}

/** 取共享歌词设置中的 NowPlaying 专属样式子集 */
function pickLyricStyles(v: NowPlayingLyricStyles): NowPlayingLyricStyles {
  return {
    showTranslation: v.showTranslation,
    showRomaji: v.showRomaji,
    fontBold: v.fontBold,
    enableScale: v.enableScale,
    enableBlur: v.enableBlur,
    enableGlow: v.enableGlow,
    enableStagger: v.enableStagger,
    animationTiming: v.animationTiming,
    romajiFontSize: v.romajiFontSize,
    translationFontSize: v.translationFontSize,
    alignmentPercentage: v.alignmentPercentage,
  };
}

/** 合并共享歌词设置与 NowPlaying 专属样式：样式字段以专属为准，全局字段（偏移/词库源）保留共享 */
export function mergeLyricsSettings(shared: LyricsSettingsValues, np: NowPlayingSettingsValues): LyricsSettingsValues {
  return { ...shared, ...np.lyricStyles };
}

/** 拆分面板变更：样式字段写回 NowPlaying 专属设置，全局字段写回共享设置 */
export function splitLyricsChange(
  shared: LyricsSettingsValues,
  np: NowPlayingSettingsValues,
  next: LyricsSettingsValues
): { shared: LyricsSettingsValues; np: NowPlayingSettingsValues } {
  return {
    shared: { ...shared, globalOffset: next.globalOffset, lyricSource: next.lyricSource },
    np: { ...np, lyricStyles: pickLyricStyles(next) },
  };
}
