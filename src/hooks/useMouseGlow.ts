import { useRef, useEffect, useCallback, type RefObject } from "react";
import { isMouseOverElement, getGlobalMousePos } from "@/utils/mouseTracker";

export interface MouseGlowResult {
  containerRef: RefObject<HTMLDivElement | null>;
  overlayRef: RefObject<HTMLDivElement | null>;
  containerProps: {
    onMouseMove: (e: React.MouseEvent) => void;
    onMouseEnter: (e: React.MouseEvent) => void;
    onMouseLeave: () => void;
  };
  glowing: boolean;
}

/**
 * useMouseGlow - Real-time cursor-following glow via direct DOM manipulation.
 *
 * Uses percentage-based positioning. Listens to scroll events on both
 * ancestors (parent scroll) and descendants (inner scrollable areas)
 * so the glow follows even when the mouse stays still.
 *
 * Features:
 * - Smooth hide on scroll, smooth show when scroll ends (150ms debounce)
 * - Perf: mouseMove uses requestAnimationFrame throttle (one DOM write per frame)
 */
function isLightTheme(): boolean {
  return document.documentElement.getAttribute("data-theme") === "light";
}

function resolveGlowColor(userColor?: string): string {
  if (isLightTheme()) {
    return "rgba(0, 0, 0, 0.08)";
  }
  return userColor ?? "rgba(255, 255, 255, 0.12)";
}

export function useMouseGlow(
  glowColor = "rgba(255,255,255,0.12)",
  glowRadius = 600
): MouseGlowResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const lastClientPos = useRef<{ x: number; y: number } | null>(null);
  const glowingRef = useRef(false);
  const rafRef = useRef(0);
  /** Whether scrolling is in progress — glow is hidden while true */
  const scrollingRef = useRef(false);
  const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const overlay = overlayRef.current;
    if (overlay) {
      overlay.style.transition = "opacity 0.3s ease-out";
      overlay.style.opacity = "0";
    }
  }, []);

  const applyGlowAt = useCallback(
    (clientX: number, clientY: number) => {
      const container = containerRef.current;
      const overlay = overlayRef.current;
      if (!container || !overlay) return;

      const rect = container.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      const px = ((clientX - rect.left) / rect.width) * 100;
      const py = ((clientY - rect.top) / rect.height) * 100;
      const effectiveColor = resolveGlowColor(glowColor);

      overlay.style.background = `radial-gradient(${glowRadius}px circle at ${px}% ${py}%, ${effectiveColor}, transparent 85%)`;

      // Only show glow if not currently scrolling
      if (!scrollingRef.current) {
        overlay.style.opacity = "1";
      }
      glowingRef.current = true;
    },
    [glowColor, glowRadius]
  );

  // Reposition glow using real-time mouse position and prevent stale flash
  const handleScroll = useCallback(() => {
    const overlay = overlayRef.current;
    const curContainer = containerRef.current;

    // Hide glow smoothly on scroll start
    if (!scrollingRef.current) {
      scrollingRef.current = true;
      if (overlay) {
        overlay.style.opacity = "0";
      }
    }

    if (!isMouseOverElement(curContainer)) {
      glowingRef.current = false;
    }

    // Debounce: show glow again 150ms after last scroll event ONLY if mouse is still truly inside
    if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    scrollTimerRef.current = setTimeout(() => {
      scrollingRef.current = false;
      const c = containerRef.current;
      const o = overlayRef.current;
      if (!c || !o) return;

      if (!isMouseOverElement(c)) {
        o.style.opacity = "0";
        glowingRef.current = false;
        return;
      }

      glowingRef.current = true;
      const { x, y } = getGlobalMousePos();
      applyGlowAt(x, y);
    }, 150);
  }, [applyGlowAt]);

  // Attach scroll listeners: capture phase on self for descendants,
  // and on window + scrollable ancestors for parent scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Capture all scrolling across the window
    window.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    window.addEventListener("wheel", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll, { capture: true });
      window.removeEventListener("wheel", handleScroll);
      if (scrollTimerRef.current) clearTimeout(scrollTimerRef.current);
    };
  }, [handleScroll]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      lastClientPos.current = { x: e.clientX, y: e.clientY };
      if (scrollingRef.current) return;

      // rAF throttle: one DOM write per frame
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const pos = lastClientPos.current;
          if (pos && !scrollingRef.current) applyGlowAt(pos.x, pos.y);
        });
      }
    },
    [applyGlowAt]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      lastClientPos.current = { x: e.clientX, y: e.clientY };
      if (!scrollingRef.current) {
        applyGlowAt(e.clientX, e.clientY);
      }
    },
    [applyGlowAt]
  );

  const handleMouseLeave = useCallback(() => {
    const overlay = overlayRef.current;
    if (overlay) overlay.style.opacity = "0";
    glowingRef.current = false;
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = 0;
    }
  }, []);

  return {
    containerRef,
    overlayRef,
    containerProps: {
      onMouseMove: handleMouseMove,
      onMouseEnter: handleMouseEnter,
      onMouseLeave: handleMouseLeave,
    },
    get glowing() { return glowingRef.current; },
  };
}

export default useMouseGlow;
