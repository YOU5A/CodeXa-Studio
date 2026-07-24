/**
 * InterludeDots — 间奏等待点动画组件
 *
 * 歌曲间奏（无歌词段落）时显示 3 个逐渐填充的呼吸圆点。
 *
 * @module lyrics/InterludeDots
 */

import type { LyricLine } from "./types";

/** 间奏行在滚动容器中的行高 */
export const INTERLUDE_ROW_HEIGHT = 28;

interface InterludeDotsProps {
  /** 间奏行数据 */
  line: LyricLine;
  /** 当前播放秒数 */
  currentTime: number;
  /** 是否为当前高亮行 */
  isCurrent: boolean;
}

export default function InterludeDots({
  line,
  currentTime,
  isCurrent,
}: InterludeDotsProps) {
  const duration = line.duration || 3;
  const elapsed = currentTime - line.time;
  const dotCount = 3;
  const perDotTime = duration / dotCount;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        height: INTERLUDE_ROW_HEIGHT,
      }}
      className={isCurrent ? "interlude-breathing" : undefined}
    >
      {Array.from({ length: dotCount }).map((_, i) => {
        const dotProgress = Math.max(
          0,
          Math.min(1, (elapsed - perDotTime * i) / Math.max(perDotTime, 0.1))
        );
        const dotOpacity = 0.25 + 0.65 * dotProgress;
        const dotScale = 0.85 + 0.15 * dotProgress;

        return (
          <span
            key={i}
            className="interlude-dot"
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: "50%",
              background: "var(--text-primary)",
              opacity: 0.25,
              transform: `scale(${dotScale})`,
              transition: isCurrent
                ? "none"
                : "opacity 0.2s ease, transform 0.2s ease",
            }}
          />
        );
      })}
    </div>
  );
}