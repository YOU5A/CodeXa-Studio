/**
 * GlassSurface - Base Glass Primitive
 *
 * Cursor-following white glow. Clean and subtle.
 */

import { forwardRef, type ReactNode, useRef, useCallback, useEffect } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { materialToStyle, generateGlassSeed, type GlassSeed } from "../materials";
import type { GlassTier } from "../tokens";
import { isMouseOverElement, getGlobalMousePos } from "@/utils/mouseTracker";

export interface GlassSurfaceProps extends HTMLMotionProps<"div"> {
  children?: ReactNode;
  tier?: GlassTier;
  noBlur?: boolean;
  noGlow?: boolean;
  /** Randomized glass parameters for specular highlight variation. Auto-generated if omitted. */
  glassSeed?: GlassSeed;
  styleOverrides?: Partial<{ radius: number; shadow: string; border: string }>;
}

const GLOW_RADIUS = 500;

function isLightTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "light";
}

function getGlowColor(): string {
  return isLightTheme() ? "rgba(0, 0, 0, 0.055)" : "rgba(255, 255, 255, 0.055)";
}

export const GlassSurface = forwardRef<HTMLDivElement, GlassSurfaceProps>(
  function GlassSurface(
    { children, tier = "regular", noBlur = false, noGlow = false, glassSeed, styleOverrides, style, ...rest },
    ref
  ) {
    // Stable random seed per mount — NOT per render (avoids flicker)
    const seedRef = useRef<GlassSeed | null>(null);
    if (!seedRef.current) {
      seedRef.current = glassSeed ?? generateGlassSeed();
    }
    const seed = seedRef.current;

    const baseStyle = materialToStyle(tier, styleOverrides);
    if (noBlur) {
      baseStyle.backdropFilter = "none";
      baseStyle.WebkitBackdropFilter = "none";
    }

    const glowRef = useRef<HTMLDivElement | null>(null);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const rafRef = useRef(0);
    const isHoveredRef = useRef(false);
    const scrollingRef = useRef(false);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
      if (noGlow) return;
      const g = glowRef.current;
      if (g) {
        g.style.transition = "opacity 0.35s cubic-bezier(0.16, 1, 0.3, 1)";
        g.style.opacity = "0";
      }
    }, [noGlow]);

    const applyGlow = useCallback((cx: number, cy: number) => {
      if (noGlow) return;
      const c = containerRef.current;
      const g = glowRef.current;
      if (!c || !g) return;
      const r = c.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      const px = ((cx - r.left) / r.width) * 100;
      const py = ((cy - r.top) / r.height) * 100;
      const color = getGlowColor();
      g.style.background = `radial-gradient(${GLOW_RADIUS}px circle at ${px}% ${py}%, ${color}, transparent 60%)`;
      if (!scrollingRef.current) {
        g.style.opacity = "1";
      }
    }, [noGlow]);

    // Scroll handler: immediately hide glow with smooth transition, restore when scrolling stops
    const handleScroll = useCallback(() => {
      if (noGlow) return;
      const g = glowRef.current;
      const c = containerRef.current;

      // Smoothly hide glow as soon as scroll begins
      if (!scrollingRef.current) {
        scrollingRef.current = true;
        if (g) {
          g.style.opacity = "0";
        }
      }

      // Check immediately if element is already scrolled out from under the cursor
      if (!isMouseOverElement(c)) {
        isHoveredRef.current = false;
      }

      // Debounce: restore glow 150ms after scroll ends ONLY if mouse is still truly inside
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      scrollTimerRef.current = setTimeout(() => {
        scrollingRef.current = false;
        if (noGlow) return;
        const curContainer = containerRef.current;
        const curGlow = glowRef.current;
        if (!curContainer || !curGlow) return;

        // Accurate real-time hit test using global viewport cursor position
        if (!isMouseOverElement(curContainer)) {
          curGlow.style.opacity = "0";
          isHoveredRef.current = false;
          return;
        }

        // Cursor is verified over this element: refresh position to real-time coordinates and fade in
        isHoveredRef.current = true;
        const { x, y } = getGlobalMousePos();
        applyGlow(x, y);
      }, 150);
    }, [noGlow, applyGlow]);

    useEffect(() => {
      if (noGlow) return;
      const c = containerRef.current;
      if (!c) return;

      // Window scroll in capture phase catches scrolling anywhere in the app
      window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
      window.addEventListener("wheel", handleScroll, { passive: true });

      return () => {
        window.removeEventListener("scroll", handleScroll, { capture: true });
        window.removeEventListener("wheel", handleScroll);
        if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
      };
    }, [noGlow, handleScroll]);

    const onMove = useCallback((e: React.MouseEvent) => {
      if (noGlow) return;
      isHoveredRef.current = true;
      if (scrollingRef.current) return;

      // rAF throttle: one DOM write per frame
      if (!rafRef.current) {
        const cx = e.clientX, cy = e.clientY;
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          if (!scrollingRef.current) {
            applyGlow(cx, cy);
          }
        });
      }
    }, [noGlow, applyGlow]);

    const onEnter = useCallback((e: React.MouseEvent) => {
      if (noGlow) return;
      isHoveredRef.current = true;
      if (!scrollingRef.current) {
        applyGlow(e.clientX, e.clientY);
      }
    }, [noGlow, applyGlow]);

    const onLeave = useCallback(() => {
      if (noGlow) return;
      isHoveredRef.current = false;
      const g = glowRef.current;
      if (g) g.style.opacity = "0";
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = 0;
      }
    }, [noGlow]);

    return (
      <motion.div
        ref={(node: HTMLDivElement | null) => {
          containerRef.current = node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={"glass-surface" + (tier !== "ultraThin" ? " glass-surface-border" : " glass-surface-no-border")}
        style={{
          position: "relative",
          "--glass-angle": seed.angle + "deg",
          "--glass-highlight-opacity": String(seed.intensity),
          "--glass-noise-opacity": String(seed.noiseStrength),
          ...baseStyle,
          ...style,
        } as React.CSSProperties}
        onMouseMove={onMove}
        onMouseEnter={onEnter}
        onMouseLeave={onLeave}
        {...rest}
      >
        {!noGlow && (
          <div
            ref={glowRef}
            aria-hidden="true"
            style={{
              position: "absolute",
              inset: 0,
              pointerEvents: "none",
              zIndex: 1,
              borderRadius: "inherit",
            }}
          />
        )}
        {children}
      </motion.div>
    );
  }
);

export default GlassSurface;
