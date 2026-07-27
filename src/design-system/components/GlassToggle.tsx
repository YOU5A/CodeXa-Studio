/**
 * GlassToggle ? Liquid Glass Toggle Switch
 *
 * Apple-style toggle switch with glass styling.
 * Semi-transparent accent + cursor-following glow.
 */

import { useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";

export interface GlassToggleProps {
  active: boolean;
  onChange: (active: boolean) => void;
  disabled?: boolean;
  size?: "sm" | "md";
}

const sizeConfig = {
  sm: { width: 36, height: 20, radius: 10, knob: 14, pad: 2 },
  md: { width: 44, height: 26, radius: 13, knob: 20, pad: 3 },
};

const GLOW_COLOR = "rgba(255,255,255,0.18)";
const GLOW_RADIUS = 280;

function updateGlow(el: HTMLElement, cx: number, cy: number) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const px = ((cx - r.left) / r.width) * 100;
  const py = ((cy - r.top) / r.height) * 100;
  el.style.setProperty("--tg-gx", px + "%");
  el.style.setProperty("--tg-gy", py + "%");
  el.style.setProperty("--tg-go", "1");
}

function clearGlow(el: HTMLElement) {
  el.style.setProperty("--tg-go", "0");
}

export function GlassToggle({
  active,
  onChange,
  disabled = false,
  size = "md",
}: GlassToggleProps) {
  const cfg = sizeConfig[size];
  const knobTravel = cfg.width - cfg.knob - 2 * cfg.pad;
  const [hovered, setHovered] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    updateGlow(e.currentTarget as HTMLElement, e.clientX, e.clientY);
  }, [disabled]);

  const onEnter = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setHovered(true);
    updateGlow(e.currentTarget as HTMLElement, e.clientX, e.clientY);
  }, [disabled]);

  const onLeave = useCallback((e: React.MouseEvent) => {
    if (disabled) return;
    setHovered(false);
    clearGlow(e.currentTarget as HTMLElement);
  }, [disabled]);

  return (
    <div
      ref={ref}
      role="switch"
      aria-checked={active}
      tabIndex={disabled ? -1 : 0}
      onClick={() => !disabled && onChange(!active)}
      onKeyDown={(e) => {
        if ((e.key === "Enter" || e.key === " ") && !disabled) {
          e.preventDefault();
          onChange(!active);
        }
      }}
      onMouseMove={onMove}
      onMouseEnter={onEnter}
      onMouseLeave={onLeave}
      style={{
        display: "flex",
        alignItems: "center",
        width: cfg.width,
        height: cfg.height,
        borderRadius: cfg.radius,
        padding: `0 ${cfg.pad}px`,
        cursor: disabled ? "not-allowed" : "pointer",
        flexShrink: 0,
        boxSizing: "border-box",
        position: "relative",
        background: active
          ? "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.08) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.06) 50%, rgba(var(--glass-glow-rgb,255,255,255),0.02) 100%), rgba(var(--accent-rgb), 0.35)"
          : "var(--bg-tertiary)",
        backdropFilter: active ? "blur(10px) saturate(1.6)" : "none",
        WebkitBackdropFilter: active ? "blur(10px) saturate(1.6)" : "none",
        boxShadow: active ? "inset 0 1px 2px rgba(var(--glass-glow-rgb,255,255,255),0.1)" : "none",
        border: "1px solid",
        borderColor: active
          ? "rgba(var(--accent-rgb), 0.5)"
          : "var(--border-color)",
        boxShadow: active && hovered
          ? "0 0 16px rgba(var(--accent-rgb), 0.35)"
          : "none",
        transition: "background var(--transition-fast) ease, border-color var(--transition-fast) ease, box-shadow 0.25s ease",
        opacity: disabled ? 0.5 : 1,
        overflow: "hidden",
      }}
    >
      {/* Inner glow overlay */}
      <span
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background: `radial-gradient(${GLOW_RADIUS}px circle at var(--tg-gx, 50%) var(--tg-gy, 50%), ${GLOW_COLOR}, transparent 50%)`,
          opacity: "var(--tg-go, 0)",
          transition: "opacity 0.4s ease-out",
          borderRadius: "inherit",
        }}
      />
      <motion.div
        animate={{ x: active ? knobTravel : 0 }}
        transition={{ type: "spring", stiffness: 500, damping: 30, mass: 0.8 }}
        style={{
          width: cfg.knob,
          height: cfg.knob,
          borderRadius: "50%",
          background: "white",
          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
          flexShrink: 0,
          position: "relative",
          zIndex: 1,
        }}
      />
    </div>
  );
}

export default GlassToggle;
