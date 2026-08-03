/**
 * NowPlayingLyricsCopyMode — NowPlaying 复制模式歌词平铺列表
 *
 * 复制模式开启时替代 NowPlayingLyrics：所有歌词行按文档流平铺展示，
 * 支持鼠标拖选文本（user-select: text）与滚动浏览。
 * 单击不跳转，避免干扰选词；全选由外部通过容器 ref 调用 Range 选中。
 */

import { forwardRef } from "react";
import type { LyricLine } from "@/lyrics";

interface NowPlayingLyricsCopyModeProps {
  lines: LyricLine[];
  showRomaji: boolean;
  showTranslation: boolean;
}

/** 平铺列表原文固定字号（参考 refined-now-playing-netease-next 复制模式） */
const COPY_LYRIC_FONT_SIZE = 24;

const NowPlayingLyricsCopyMode = forwardRef<HTMLDivElement, NowPlayingLyricsCopyModeProps>(
  function NowPlayingLyricsCopyMode({ lines, showRomaji, showTranslation }, ref) {
    return (
      <div ref={ref} className="np-copy-lyrics" style={{ fontSize: COPY_LYRIC_FONT_SIZE }}>
        {lines.map((line, i) => (
          <div key={i} className={`np-copy-lyrics-line${line.isInterlude ? " interlude" : ""}`}>
            {line.isInterlude ? (
              "· · ·"
            ) : (
              <>
                <div className="np-copy-lyrics-original">{line.originalLyric || line.text || "…"}</div>
                {showRomaji && line.romanLyric && (
                  <div className="np-copy-lyrics-romaji">{line.romanLyric}</div>
                )}
                {showTranslation && line.translatedLyric && (
                  <div className="np-copy-lyrics-translation">{line.translatedLyric}</div>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    );
  }
);

export default NowPlayingLyricsCopyMode;
