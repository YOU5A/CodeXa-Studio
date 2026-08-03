/**
 * NowPlayingLyrics — NowPlaying 覆盖层专属歌词配置
 *
 * 包装共享 LyricDisplay，对 NowPlaying 生效的歌词调整：
 * - 专属歌词样式（字号/子层字号/显隐/动画等，与共享 lyricsSettings 隔离）；
 * - 固定 36px 行距（默认与全屏一致，不随字号动画缩放）；
 * - 左 / 中 / 右对齐。
 * MusicManager 悬浮歌词窗不经过本组件，行为完全不变。
 */

import { memo, useMemo } from "react";
import LyricDisplay from "@/lyrics/LyricDisplay";
import type { LyricDisplayProps, LyricsSettingsValues } from "@/lyrics";
import type { NowPlayingSettingsValues } from "./NowPlayingSettings";

export interface NowPlayingLyricsProps
  extends Omit<LyricDisplayProps, "settings" | "textAlign" | "lineSpacing" | "lineGapPx"> {
  settings: LyricsSettingsValues;
  /** NowPlaying 专属歌词样式（字号/子层字号/显隐/动画等，持久化于 nowplaying-settings） */
  npSettings: NowPlayingSettingsValues;
  /** NowPlaying 专属歌词字号（持久化于 nowplaying-settings，默认 38px） */
  fontSize?: number;
  /** 覆盖当前歌词位置百分比 0-100（全屏时强制 50 居中；不传则用 NowPlaying 专属设置） */
  alignmentPercentage?: number;
  /** NowPlaying 专属歌词对齐方式（持久化于 nowplaying-settings） */
  align: "left" | "center" | "right";
}

/** NowPlaying 默认（非全屏）固定行间距（像素，与字号无关，不随字号动画缩放） */
const NOW_PLAYING_LINE_GAP_PX = 36;

function NowPlayingLyrics({ align, settings, npSettings, fontSize, alignmentPercentage, ...rest }: NowPlayingLyricsProps) {
  // 专属样式优先：除全局字段（偏移/词库源）外，显示样式全部取自 npSettings
  const effectiveSettings = useMemo<LyricsSettingsValues>(
    () => ({
      ...settings,
      ...npSettings.lyricStyles,
      fontSize: fontSize ?? npSettings.lyricsFontSize,
      alignmentPercentage: alignmentPercentage ?? npSettings.lyricStyles.alignmentPercentage,
    }),
    [settings, npSettings, fontSize, alignmentPercentage]
  );

  return (
    <LyricDisplay
      {...rest}
      settings={effectiveSettings}
      textAlign={align}
      lineGapPx={NOW_PLAYING_LINE_GAP_PX}
    />
  );
}

// memo：播放位置高频刷新时避免外层重渲染穿透到 LyricDisplay 子树
export default memo(NowPlayingLyrics);
