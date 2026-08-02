/**
 * GlassSeekBar ? Interactive Glass Seek / Volume Bar
 *
 * A glass-themed interactive slider for progress seeking and volume control.
 * Handles its own hover/animation state internally.
 * Accepts forwardRef for external ref compatibility (e.g. MusicManager's progressRef/volumeRef).
 *
 * Visual design fuses:
 *   - Track: GlassProgressBar (var(--border-color) bg, radii.full)
 *   - Thumb: global input[type="range"]::-webkit-slider-thumb (backdrop-filter:blur, accent glow)
 *   - Fill: var(--accent) + framer-motion spring
 *
 * @module design-system/components/GlassSeekBar
 */

import { forwardRef, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { radii } from "../tokens";
import type { ProgressColor } from "./GlassProgressBar";

const colorMap: Record<ProgressColor, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

const sizeConfig = {
  sm: { container: 10, track: 4, thumb: 12 },
  md: { container: 14, track: 5, thumb: 14 },
  lg: { container: 20, track: 6, thumb: 18 },
} as const;

export interface GlassSeekBarProps {
  /** Current value 0-100 */
  value: number;
  /** Size preset: sm for compact volume, md for standard, lg for large progress */
  size?: "sm" | "md" | "lg";
  /** Color theme (default accent) */
  color?: ProgressColor;
  /** 自定义填充色（CSS 颜色值），优先于 color */
  fillColor?: string;
  /** 自定义滑块颜色（CSS 颜色值）；不传时保持默认白色滑块 + 主题强调色光晕 */
  thumbColor?: string;
  disabled?: boolean;
  /** Pass-through mousedown for legacy drag handling */
  onMouseDown?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export const GlassSeekBar = forwardRef<HTMLDivElement, GlassSeekBarProps>(
  function GlassSeekBar(
    { value, size = "md", color = "accent", fillColor: fillColorOverride, thumbColor: thumbColorOverride, disabled = false, onMouseDown, style },
    ref
  ) {
    const [hovered, setHovered] = useState(false);
    const cfg = sizeConfig[size];
    const pct = Math.min(Math.max(value, 0), 100);
    const fillColor = fillColorOverride ?? colorMap[color];

    const handleMouseEnter = useCallback(() => { if (!disabled) setHovered(true); }, [disabled]);
    const handleMouseLeave = useCallback(() => { setHovered(false); }, []);

    // 滑块视觉：传 thumbColor 时跟随自定义色（NowPlaying 发光色）；默认保持白色滑块 + accent 光晕
    const thumbVisual = thumbColorOverride
      ? {
          idleBg: `color-mix(in srgb, ${thumbColorOverride} 52%, white)`,
          hoverBg: `color-mix(in srgb, ${thumbColorOverride} 70%, white)`,
          idleShadow: `0 1px 4px rgba(0,0,0,0.18), 0 0 0 1px color-mix(in srgb, ${thumbColorOverride} 28%, transparent), 0 0 10px color-mix(in srgb, ${thumbColorOverride} 14%, transparent)`,
          hoverShadow: `0 2px 8px rgba(0,0,0,0.22), 0 0 0 2px color-mix(in srgb, ${thumbColorOverride} 45%, transparent), 0 0 18px color-mix(in srgb, ${thumbColorOverride} 30%, transparent)`,
        }
      : {
          idleBg: "rgba(255,255,255,0.45)",
          hoverBg: "rgba(255,255,255,0.55)",
          idleShadow: "0 1px 4px rgba(0,0,0,0.18), 0 0 0 1px rgba(var(--accent-rgb),0.2), 0 0 10px rgba(255,255,255,0.06)",
          hoverShadow: "0 2px 8px rgba(0,0,0,0.22), 0 0 0 2px rgba(var(--accent-rgb),0.35), 0 0 18px rgba(255,255,255,0.10)",
        };

    return (
      <div
        ref={ref}
        onMouseDown={onMouseDown}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          width: "100%",
          height: cfg.container,
          position: "relative",
          cursor: disabled ? "not-allowed" : "pointer",
          opacity: disabled ? 0.4 : 1,
          flexShrink: 0,
          ...style,
        }}
      >
        {/* Track */}
        <div
          style={{
            position: "absolute",
            top: "50%",
            left: 0,
            right: 0,
            height: cfg.track,
            transform: "translateY(-50%)",
            borderRadius: radii.full,
            background: "var(--border-color)",
            overflow: "hidden",
          }}
          aria-hidden="true"
        >
          {/* Fill */}
          <motion.div
            style={{
              height: "100%",
              borderRadius: radii.full,
              background: `linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.02) 100%), color-mix(in srgb, ${fillColor} 35%, transparent)`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: `0 0 10px color-mix(in srgb, ${fillColor} 20%, transparent)`,
              position: "absolute",
              left: 0,
              top: 0,
            }}
            animate={{ width: `${pct}%` }}
            // 短 tween 紧跟 100ms 位置刷新节奏：无 spring 过冲回弹，视觉更顺
            transition={{ type: "tween", duration: 0.15, ease: "easeOut" }}
          />
        </div>

        {/* Thumb ? only visible on hover */}
        <motion.div
          aria-hidden="true"
          style={{
            position: "absolute",
            top: "50%",
            width: cfg.thumb,
            height: cfg.thumb,
            borderRadius: "50%",
            border: thumbColorOverride ? `1.5px solid color-mix(in srgb, ${thumbColorOverride} 55%, white)` : "1.5px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            pointerEvents: "none",
          }}
          animate={{
            left: `${pct}%`,
            x: "-50%",
            y: "-50%",
            opacity: hovered ? 1 : 0,
            scale: hovered ? 1 : 0.6,
            background: hovered ? thumbVisual.hoverBg : thumbVisual.idleBg,
            boxShadow: hovered ? thumbVisual.hoverShadow : thumbVisual.idleShadow,
          }}
          transition={{
            // 位置跟随拖动：快速弹簧保持跟手；显隐/颜色：柔和过渡
            left: { type: "spring", stiffness: 500, damping: 40 },
            x: { type: "spring", stiffness: 500, damping: 40 },
            y: { type: "spring", stiffness: 500, damping: 40 },
            opacity: { type: "tween", duration: 0.28, ease: "easeOut" },
            scale: { type: "tween", duration: 0.28, ease: "easeOut" },
            background: { type: "tween", duration: 0.28, ease: "easeOut" },
            boxShadow: { type: "tween", duration: 0.28, ease: "easeOut" },
          }}
        />
      </div>
    );
  }
);

export default GlassSeekBar;
