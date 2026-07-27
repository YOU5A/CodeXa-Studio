/**
 * GlassSurface - Base Glass Primitive
 *
 * Cursor-following white glow. Clean and subtle.
 */

import { forwardRef, type ReactNode, useRef, useCallback, useEffect } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { materialToStyle, generateGlassSeed, type GlassSeed } from "../materials";
import type { GlassTier } from "../tokens";

export interface GlassSurfaceProps extends HTMLMotionProps<"div"> {
  children?: ReactNode;
  tier?: GlassTier;
  noBlur?: boolean;
  noGlow?: boolean;
  /** Randomized glass parameters for specular highlight variation. Auto-generated if omitted. */
  glassSeed?: GlassSeed;
  styleOverrides?: Partial<{ radius: number; shadow: string; border: string }>;
}

const GLOW_COLOR = "rgba(255,255,255,0.05)";
const GLOW_RADIUS = 500;

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
    const lastPos = useRef<{ x: number; y: number } | null>(null);
    const rafRef = useRef(0);

    useEffect(() => {
      if (noGlow) return;
      const g = glowRef.current;
      if (g) { g.style.transition = "opacity 0.4s ease-out"; g.style.opacity = "0"; }
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
      g.style.background = `radial-gradient(${GLOW_RADIUS}px circle at ${px}% ${py}%, ${GLOW_COLOR}, transparent 60%)`;
      g.style.opacity = "1";
    }, [noGlow]);

    const handleScroll = useCallback(() => {
      if (noGlow) return;
      const pos = lastPos.current;
      const c = containerRef.current;
      const g = glowRef.current;
      if (!pos || !c || !g) return;
      const elUnder = document.elementFromPoint(pos.x, pos.y);
      if (!elUnder || !(elUnder === c || c.contains(elUnder) || elUnder === g || g.contains(elUnder))) {
        g.style.opacity = "0";
        return;
      }
      applyGlow(pos.x, pos.y);
    }, [noGlow, applyGlow]);

    useEffect(() => {
      if (noGlow) return;
      const c = containerRef.current;
      if (!c) return;
      const targets: (EventTarget & { addEventListener: Function; removeEventListener: Function })[] = [];
      c.addEventListener("scroll", handleScroll, { capture: true, passive: true });
      targets.push(c);
      window.addEventListener("scroll", handleScroll, { passive: true });
      targets.push(window);
      let el: HTMLElement | null = c.parentElement;
      while (el) {
        const s = window.getComputedStyle(el);
        const ov = s.overflow + s.overflowY;
        if (ov.includes("auto") || ov.includes("scroll")) {
          el.addEventListener("scroll", handleScroll, { passive: true });
          targets.push(el);
        }
        el = el.parentElement;
      }
      return () => { for (const t of targets) t.removeEventListener("scroll", handleScroll); };
    }, [noGlow, handleScroll]);

    const onMove = useCallback((e: React.MouseEvent) => {
      if (noGlow) return;
      lastPos.current = { x: e.clientX, y: e.clientY };
      // rAF throttle: one DOM write per frame
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const pos = lastPos.current;
          if (pos) applyGlow(pos.x, pos.y);
        });
      }
    }, [noGlow, applyGlow]);

    const onEnter = useCallback((e: React.MouseEvent) => {
      if (noGlow) return;
      lastPos.current = { x: e.clientX, y: e.clientY };
      applyGlow(e.clientX, e.clientY);
    }, [noGlow, applyGlow]);

    const onLeave = useCallback(() => {
      if (noGlow) return;
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
