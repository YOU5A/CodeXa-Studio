/**
 * NowPlayingLyrics — NowPlaying 覆盖层专属歌词配置
 *
 * 包装共享 LyricDisplay，只对 NowPlaying 生效的歌词调整：
 * - 专属字号（默认 38px，设置面板可自由调整）；
 * - 固定 36px 行距（默认与全屏一致，不随字号动画缩放）；
 * - 左 / 中 / 右对齐。
 * MusicManager 悬浮歌词窗不经过本组件，行为完全不变。
 */

import { useMemo } from "react";
import LyricDisplay from "@/lyrics/LyricDisplay";
import type { LyricDisplayProps, LyricsSettingsValues } from "@/lyrics";

export interface NowPlayingLyricsProps
  extends Omit<LyricDisplayProps, "settings" | "textAlign" | "lineSpacing" | "lineGapPx"> {
  settings: LyricsSettingsValues;
  /** NowPlaying 专属歌词字号（持久化于 nowplaying-settings，默认 38px） */
  fontSize?: number;
  /** 覆盖当前歌词位置百分比 0-100（全屏时强制 50 居中；不传则用共享设置） */
  alignmentPercentage?: number;
  /** NowPlaying 专属歌词对齐方式（持久化于 nowplaying-settings） */
  align: "left" | "center" | "right";
}

/** NowPlaying 默认（非全屏）固定行间距（像素，与字号无关，不随字号动画缩放） */
const NOW_PLAYING_LINE_GAP_PX = 36;

export default function NowPlayingLyrics({ align, settings, fontSize, alignmentPercentage, ...rest }: NowPlayingLyricsProps) {
  // 专属字号优先；未传入时回退共享设置（悬浮歌词窗等场景不受影响）
  const effectiveSettings = useMemo<LyricsSettingsValues>(
    () => ({
      ...settings,
      fontSize: fontSize ?? settings.fontSize,
      alignmentPercentage: alignmentPercentage ?? settings.alignmentPercentage,
    }),
    [settings, fontSize, alignmentPercentage]
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
