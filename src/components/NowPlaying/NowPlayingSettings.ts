/**
 * NowPlaying — 覆盖层专属设置（localStorage 持久化）
 *
 * 仅存放覆盖层自身行为开关；歌词显示设置仍复用 lyrics/types.ts 的共享设置。
 */

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
  lyricsFontSize: 38,
};

/** NowPlaying 全屏固定歌词字号（全屏时覆盖用户设置，设置面板置灰同步显示该值） */
export const NOW_PLAYING_FULLSCREEN_FONT_SIZE = 48;

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
