/**
 * GlassButton - Liquid Glass Button
 *
 * Apple-style button with glass material support.
 * Includes cursor-following glow on hover.
 *
 * Variants: primary | secondary | danger | ghost | input
 */

import { forwardRef, type ReactNode, useCallback, useEffect, useRef } from "react";
import { motion, type HTMLMotionProps, type TargetAndTransition } from "framer-motion";
import { springSnappy, glassPress, glassGhostHover } from "../animations";
import { space, radii, fontSizes } from "../tokens";

export type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "input";
export type ButtonSize = "sm" | "md" | "lg";

export interface GlassButtonProps extends Omit<HTMLMotionProps<"button">, "children"> {
  children?: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  inline?: boolean;
  noAnimation?: boolean;
  noGlow?: boolean;
}

/* Border-radius synced with window --radius (default 20px -> 10px) */
const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm:  { padding: String(space[1]) + "px " + String(space[3]) + "px", fontSize: fontSizes.xs, borderRadius: "calc(var(--radius) * 0.85)" },
  md:  { padding: String(space[2]) + "px " + String(space[4]) + "px", fontSize: fontSizes.sm, borderRadius: "calc(var(--radius) * 1.0)" },
  lg:  { padding: String(space[3]) + "px " + String(space[5]) + "px", fontSize: fontSizes.md, borderRadius: "calc(var(--radius) * 1.2)" },
};

function variantBase(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.00) 70%, rgba(255,255,255,0.06) 100%), rgba(var(--accent-rgb), 0.12)", color: "var(--accent)", border: "none", fontWeight: 500, backdropFilter: "blur(32px) saturate(2.2)", WebkitBackdropFilter: "blur(32px) saturate(2.2)", boxShadow: "0 0 0 1px rgba(var(--accent-rgb), 0.25)" };
    case "secondary":
      return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.08) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.06) 40%, rgba(var(--glass-glow-rgb,255,255,255),0.02) 65%, rgba(var(--glass-glow-rgb,255,255,255),0.08) 100%), transparent", color: "var(--text-primary)", border: "none", fontWeight: 500, backdropFilter: "blur(32px) saturate(2.2)", WebkitBackdropFilter: "blur(32px) saturate(2.2)", boxShadow: "0 0 0 1px var(--border-color)" };
    case "danger":
      return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(255,255,255,0.18) 0%, rgba(255,255,255,0.04) 45%, rgba(255,255,255,0.00) 70%, rgba(255,255,255,0.06) 100%), rgba(var(--danger-rgb), 0.12)", color: "var(--danger)", border: "none", fontWeight: 500, backdropFilter: "blur(32px) saturate(2.2)", WebkitBackdropFilter: "blur(32px) saturate(2.2)", boxShadow: "0 0 0 1px rgba(var(--danger-rgb), 0.25)" };
    case "ghost":
      return { background: "transparent", color: "var(--text-secondary)", border: "none", backdropFilter: "none", WebkitBackdropFilter: "none" };
    case "input":
      return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.08) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.02) 50%, rgba(var(--glass-glow-rgb,255,255,255),0.04) 100%), transparent", color: "var(--text-primary)", border: "none", fontSize: fontSizes.sm, borderRadius: radii.md, padding: String(space[2]) + "px " + String(space[4]) + "px", backdropFilter: "blur(32px) saturate(2.2)", WebkitBackdropFilter: "blur(32px) saturate(2.2)", boxShadow: "0 0 0 1px var(--border-color)" };
    default: return {};
  }
}

function hoverTarget(variant: ButtonVariant): TargetAndTransition | undefined {
  switch (variant) {
    case "primary": return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.005) 70%, rgba(255,255,255,0.04) 100%), rgba(var(--accent-rgb), 0.22)", boxShadow: "0 0 0 1px rgba(var(--accent-rgb), 0.50), 0 0 14px rgba(var(--accent-rgb), 0.20)" };
    case "secondary": return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.05) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.05) 40%, rgba(var(--glass-glow-rgb,255,255,255),0.015) 65%, rgba(var(--glass-glow-rgb,255,255,255),0.06) 100%), rgba(var(--glass-glow-rgb,255,255,255),0.06)", boxShadow: "0 0 0 1px var(--border-color), 0 0 18px rgba(var(--accent-rgb), 0.08)" };
    case "danger": return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(255,255,255,0.11) 0%, rgba(255,255,255,0.03) 45%, rgba(255,255,255,0.005) 70%, rgba(255,255,255,0.04) 100%), rgba(var(--danger-rgb), 0.22)", boxShadow: "0 0 0 1px rgba(var(--danger-rgb), 0.50), 0 0 14px rgba(var(--danger-rgb), 0.20)" };
    case "ghost": return { background: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.05) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.04) 50%, rgba(var(--glass-glow-rgb,255,255,255),0.08) 100%), var(--bg-tertiary)", color: "var(--text-primary)", borderRadius: radii.md };
    case "input": return { boxShadow: "0 0 0 1px var(--border-color), 0 0 12px rgba(var(--accent-rgb), 0.08), 0 0 0 3px var(--accent-bg)" };
    default: return undefined;
  }
}

function disabledStyle(): React.CSSProperties {
  return { opacity: 0.5, cursor: "not-allowed", transform: "none", boxShadow: "none" };
}

/* Button Glow */

const GLOW_COLOR = "rgba(255,255,255,0.25)";
const GLOW_RADIUS = 360;

function updateBtnGlow(el: HTMLElement, cx: number, cy: number) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const px = ((cx - r.left) / r.width) * 100;
  const py = ((cy - r.top) / r.height) * 100;
  el.style.setProperty("--btn-gx", px + "%");
  el.style.setProperty("--btn-gy", py + "%");
  el.style.setProperty("--btn-go", "1");
}

function clearBtnGlow(el: HTMLElement) {
  el.style.setProperty("--btn-go", "0");
}

export const GlassButton = forwardRef<HTMLButtonElement, GlassButtonProps>(
  function GlassButton(
    { children, variant = "secondary", size = "md", inline = true, noAnimation = false, noGlow = false, disabled, style, ...rest },
    ref
  ) {
    // Stable random seed per mount ? avoids angle jump during animations
    const seedRef = useRef<{ angle: number; intensity: number; noise: number } | null>(null);
    if (!seedRef.current) {
      const s = Math.random();
      seedRef.current = {
        angle: 105 + s * 60,
        intensity: 0.5 + s * 0.5,
        noise: 0.02 + s * 0.04,
      };
    }

    const composedStyle: React.CSSProperties = {
      display: inline ? "inline-flex" : "flex",
      alignItems: "center",
      gap: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all var(--transition-fast) ease",
      willChange: "transform",
      position: "relative",
      overflow: "hidden",
      "--glass-angle": seedRef.current.angle + "deg",
      "--glass-highlight-opacity": String(seedRef.current.intensity),
      "--glass-noise-opacity": String(seedRef.current.noise),
      ...sizeStyles[size],
      ...variantBase(variant),
      ...(disabled ? disabledStyle() : {}),
      ...(style as React.CSSProperties),
    } as React.CSSProperties;

    const onMove = useCallback((e: React.MouseEvent) => {
      if (noGlow || disabled) return;
      updateBtnGlow(e.currentTarget as HTMLElement, e.clientX, e.clientY);
    }, [noGlow, disabled]);

    const onEnter = useCallback((e: React.MouseEvent) => {
      if (noGlow || disabled) return;
      updateBtnGlow(e.currentTarget as HTMLElement, e.clientX, e.clientY);
    }, [noGlow, disabled]);

    const onLeave = useCallback((e: React.MouseEvent) => {
      if (noGlow) return;
      clearBtnGlow(e.currentTarget as HTMLElement);
    }, [noGlow]);

    const btnRef = useRef<HTMLButtonElement | null>(null);

    // Clear glow when button becomes disabled
    useEffect(() => {
      if (disabled && btnRef.current) {
        clearBtnGlow(btnRef.current);
      }
    }, [disabled]);

    return (
      <motion.button
        ref={(node) => { btnRef.current = node; if (typeof ref === "function") ref(node); else if (ref) ref.current = node; }}
        disabled={disabled}
        style={composedStyle}
        onMouseMove={onMove}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        whileHover={noAnimation || disabled ? undefined : variant === "ghost" ? glassGhostHover.whileHover : hoverTarget(variant)}
        whileTap={noAnimation || disabled ? undefined : { ...glassPress.whileTap }}
        transition={springSnappy}
        {...rest}
      >
        {children}
        {!noGlow && (
          <span
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              background: `radial-gradient(360px circle at var(--btn-gx, 50%) var(--btn-gy, 50%), rgba(255,255,255,0.25), transparent 50%)`,
              opacity: "var(--btn-go, 0)",
              transition: "opacity 0.4s ease-out",
              borderRadius: "inherit",
            }}
          />
        )}
      </motion.button>
    );
  }
);

export default GlassButton;
