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
import { springSmooth } from "../animations";
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
} as const;

export interface GlassSeekBarProps {
  /** Current value 0-100 */
  value: number;
  /** Size preset: sm for volume, md for progress */
  size?: "sm" | "md";
  /** Color theme (default accent) */
  color?: ProgressColor;
  disabled?: boolean;
  /** Pass-through mousedown for legacy drag handling */
  onMouseDown?: (e: React.MouseEvent) => void;
  style?: React.CSSProperties;
}

export const GlassSeekBar = forwardRef<HTMLDivElement, GlassSeekBarProps>(
  function GlassSeekBar(
    { value, size = "md", color = "accent", disabled = false, onMouseDown, style },
    ref
  ) {
    const [hovered, setHovered] = useState(false);
    const cfg = sizeConfig[size];
    const pct = Math.min(Math.max(value, 0), 100);
    const fillColor = colorMap[color];

    const handleMouseEnter = useCallback(() => { if (!disabled) setHovered(true); }, [disabled]);
    const handleMouseLeave = useCallback(() => { setHovered(false); }, []);

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
              background: fillColor,
              position: "absolute",
              left: 0,
              top: 0,
            }}
            animate={{ width: `${pct}%` }}
            transition={springSmooth}
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
            border: "1.5px solid rgba(255,255,255,0.12)",
            backdropFilter: "blur(4px)",
            WebkitBackdropFilter: "blur(4px)",
            pointerEvents: "none",
          }}
          animate={{
            left: `${pct}%`,
            x: "-50%",
            y: "-50%",
            scale: hovered ? 1.15 : 0,
            background: hovered ? "rgba(255,255,255,0.55)" : "rgba(255,255,255,0.45)",
            boxShadow: hovered
              ? "0 2px 8px rgba(0,0,0,0.22), 0 0 0 2px rgba(var(--accent-rgb),0.35), 0 0 18px rgba(255,255,255,0.10)"
              : "0 1px 4px rgba(0,0,0,0.18), 0 0 0 1px rgba(var(--accent-rgb),0.2), 0 0 10px rgba(255,255,255,0.06)",
          }}
          transition={springSmooth}
        />
      </div>
    );
  }
);

export default GlassSeekBar;
