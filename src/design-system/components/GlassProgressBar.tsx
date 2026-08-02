/**
 * GlassProgressBar — Liquid Glass Progress Bar
 *
 * A glass-themed progress/usage bar with smooth fill animation.
 * Supports color modes (accent, success, warning, danger) and
 * optional label/value display.
 *
 * @module design-system/components/GlassProgressBar
 */

import { forwardRef } from "react";
import { radii, space } from "../tokens";

export type ProgressColor = "accent" | "success" | "warning" | "danger";

export interface GlassProgressBarProps {
  /** Progress value 0-100 */
  value: number;
  /** Max value (default 100) */
  max?: number;
  /** Color theme */
  color?: ProgressColor;
  /** Bar height in px */
  height?: number;
  /** Show percentage label */
  showLabel?: boolean;
  /** Label position */
  labelPosition?: "right" | "inside" | "none";
  /** Custom style */
  style?: React.CSSProperties;
}

const colorMap: Record<ProgressColor, string> = {
  accent: "var(--accent)",
  success: "var(--success)",
  warning: "var(--warning)",
  danger: "var(--danger)",
};

export const GlassProgressBar = forwardRef<HTMLDivElement, GlassProgressBarProps>(
  function GlassProgressBar(
    {
      value,
      max = 100,
      color = "accent",
      height = 6,
      showLabel = false,
      labelPosition = "right",
      style,
    },
    ref
  ) {
    const pct = Math.min(Math.max((value / max) * 100, 0), 100);
    const barColor = colorMap[color];

    return (
      <div
        ref={ref}
        style={{
          display: "flex",
          alignItems: "center",
          gap: labelPosition === "right" && showLabel ? space[2] : 0,
          width: "100%",
          ...style,
        }}
      >
        <div
          style={{
            flex: 1,
            height,
            borderRadius: radii.full,
            background: "var(--border-color)",
            overflow: "hidden",
            position: "relative",
          }}
        >
          <div
            style={{
              width: `${pct}%`,
              height: "100%",
              borderRadius: radii.full,
              background: `linear-gradient(180deg, rgba(255,255,255,0.20) 0%, rgba(255,255,255,0.02) 100%), color-mix(in srgb, ${barColor} 35%, transparent)`,
              backdropFilter: "blur(10px)",
              WebkitBackdropFilter: "blur(10px)",
              boxShadow: `0 0 10px color-mix(in srgb, ${barColor} 20%, transparent)`,
              position: "absolute",
              left: 0,
              top: 0,
              transition: "width 0.5s cubic-bezier(0.25, 0.1, 0.25, 1.0)",
            }}
          />
          {showLabel && labelPosition === "inside" && (
            <span
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-primary)",
                textShadow: "0 0 4px var(--bg-elevated)",
              }}
            >
              {Math.round(pct)}%
            </span>
          )}
        </div>
        {showLabel && labelPosition === "right" && (
          <span
            style={{
              fontSize: 12,
              fontWeight: 500,
              color: "var(--text-secondary)",
              fontVariantNumeric: "tabular-nums",
              minWidth: 36,
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            {Math.round(pct)}%
          </span>
        )}
      </div>
    );
  }
);

export default GlassProgressBar;
