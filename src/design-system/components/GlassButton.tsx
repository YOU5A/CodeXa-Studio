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

const sizeStyles: Record<ButtonSize, React.CSSProperties> = {
  sm:  { padding: String(space[1]) + "px " + String(space[3]) + "px", fontSize: fontSizes.xs, borderRadius: radii.lg },
  md:  { padding: String(space[2]) + "px " + String(space[4]) + "px", fontSize: fontSizes.sm, borderRadius: radii.xl },
  lg:  { padding: String(space[3]) + "px " + String(space[5]) + "px", fontSize: fontSizes.md, borderRadius: radii["2xl"] },
};

function variantBase(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case "primary":
      return { background: "rgba(var(--accent-rgb), 0.25)", color: "var(--accent)", border: "1px solid rgba(var(--accent-rgb), 0.35)", fontWeight: 500, backdropFilter: "blur(12px) saturate(1.4)", WebkitBackdropFilter: "blur(12px) saturate(1.4)" };
    case "secondary":
      return { background: "var(--bg-secondary)", color: "var(--text-primary)", border: "1.5px solid var(--border-color)", fontWeight: 500, backdropFilter: "blur(15px)", WebkitBackdropFilter: "blur(15px)" };
    case "danger":
      return { background: "rgba(var(--danger-rgb), 0.25)", color: "var(--danger)", border: "1px solid rgba(var(--danger-rgb), 0.35)", fontWeight: 500, backdropFilter: "blur(12px) saturate(1.4)", WebkitBackdropFilter: "blur(12px) saturate(1.4)" };
    case "ghost":
      return { background: "transparent", color: "var(--text-secondary)", border: "none", backdropFilter: "none", WebkitBackdropFilter: "none" };
    case "input":
      return { background: "var(--bg-tertiary)", color: "var(--text-primary)", border: "1px solid var(--border-color)", fontSize: fontSizes.sm, borderRadius: radii.md, padding: String(space[2]) + "px " + String(space[4]) + "px", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)" };
    default: return {};
  }
}

function hoverTarget(variant: ButtonVariant): TargetAndTransition | undefined {
  switch (variant) {
    case "primary": return { background: "rgba(var(--accent-rgb), 0.4)", borderColor: "rgba(var(--accent-rgb), 0.55)", boxShadow: "0 0 24px rgba(var(--accent-rgb), 0.4), 0 0 8px rgba(var(--accent-rgb), 0.25)" };
    case "secondary": return { background: "var(--bg-elevated)", borderColor: "var(--accent)", boxShadow: "0 0 14px rgba(var(--accent-rgb), 0.15)" };
    case "danger": return { background: "rgba(var(--danger-rgb), 0.4)", borderColor: "rgba(var(--danger-rgb), 0.55)", boxShadow: "0 0 24px rgba(var(--danger-rgb), 0.4), 0 0 8px rgba(var(--danger-rgb), 0.25)" };
    case "ghost": return { background: "var(--bg-tertiary)", color: "var(--text-primary)", borderRadius: radii.xl };
    case "input": return { borderColor: "var(--accent)", boxShadow: "0 0 0 3px var(--accent-bg)" };
    default: return undefined;
  }
}

function disabledStyle(): React.CSSProperties {
  return { opacity: 0.5, cursor: "not-allowed", transform: "none", boxShadow: "none" };
}

/* ─── Button Glow ─── */

const GLOW_COLOR = "rgba(255,255,255,0.18)";
const GLOW_RADIUS = 280;

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
    const composedStyle: React.CSSProperties = {
      display: inline ? "inline-flex" : "flex",
      alignItems: "center",
      gap: 6,
      cursor: disabled ? "not-allowed" : "pointer",
      transition: "all var(--transition-fast) ease",
      willChange: "transform",
      position: "relative",
      ...sizeStyles[size],
      ...variantBase(variant),
      ...(disabled ? disabledStyle() : {}),
      ...(style as React.CSSProperties),
    };

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
              background: `radial-gradient(${GLOW_RADIUS}px circle at var(--btn-gx, 50%) var(--btn-gy, 50%), ${GLOW_COLOR}, transparent 50%)`,
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