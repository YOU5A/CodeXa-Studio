/**
 * InterludeDots — 间奏等待点动画组件
 *
 * 歌曲间奏（无歌词段落）时显示 3 个逐渐填充的呼吸圆点。
 * 参考 refined-now-playing-netease 的 Interlude 实现。
 *
 * @module lyrics/InterludeDots
 */

import { useEffect, useRef } from "react";
import type { LyricLine } from "./types";

/** 间奏行在滚动容器中的行高 */
export const INTERLUDE_ROW_HEIGHT = 28;

/**
 * 注入 interludeBreath 关键帧动画到 document.head。
 * 全局仅注入一次，多实例共享。
 */
function useInterludeKeyframes() {
  useEffect(() => {
    const styleId = "interlude-breath-kf";
    if (document.getElementById(styleId)) return;
    const el = document.createElement("style");
    el.id = styleId;
    el.textContent = [
      "@keyframes interludeBreath {",
      "  0% { transform: scale(1); }",
      "  50% { transform: scale(1.08); }",
      "  100% { transform: scale(1); }",
      "}",
    ].join("\n");
    document.head.appendChild(el);
    return () => { el.remove(); };
  }, []);
}

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
  useInterludeKeyframes();

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
        gap: 8,
        height: INTERLUDE_ROW_HEIGHT,
        animation: isCurrent ? "interludeBreath 2s ease-in-out infinite" : "none",
        animationPlayState: isCurrent ? "running" : "paused",
        opacity: isCurrent ? 1 : 0.25,
        transition: "opacity 0.5s ease",
      }}
    >
      {Array.from({ length: dotCount }).map((_, i) => {
        const dotProgress = Math.max(
          0,
          Math.min(1, (elapsed - perDotTime * i) / Math.max(perDotTime, 0.1))
        );
        const dotOpacity = 0.2 + 0.7 * dotProgress;
        const dotScale = 0.85 + 0.15 * dotProgress;

        return (
          <span
            key={i}
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "var(--text-primary)",
              opacity: dotOpacity,
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