import { useRef, useEffect, useCallback, type RefObject } from "react";

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
 * Perf: mouseMove uses requestAnimationFrame throttle (one DOM write per frame).
 */
export function useMouseGlow(
  glowColor = "rgba(255,255,255,0.12)",
  glowRadius = 600
): MouseGlowResult {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<HTMLDivElement | null>(null);
  const lastClientPos = useRef<{ x: number; y: number } | null>(null);
  const glowingRef = useRef(false);
  const rafRef = useRef(0);

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

      overlay.style.background = `radial-gradient(${glowRadius}px circle at ${px}% ${py}%, ${glowColor}, transparent 85%)`;
      overlay.style.opacity = "1";
      glowingRef.current = true;
    },
    [glowColor, glowRadius]
  );

  // Reposition glow using last known mouse position
  const handleScroll = useCallback(() => {
    const pos = lastClientPos.current;
    if (pos && glowingRef.current) {
      applyGlowAt(pos.x, pos.y);
    }
  }, [applyGlowAt]);

  // Attach scroll listeners: capture phase on self for descendants,
  // and on window + scrollable ancestors for parent scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const targets: (EventTarget & { addEventListener: Function; removeEventListener: Function })[] = [];

    // Capture scroll events from descendants (inner scrollable areas)
    container.addEventListener("scroll", handleScroll, { capture: true, passive: true });
    targets.push(container);

    // Window scroll
    window.addEventListener("scroll", handleScroll, { passive: true });
    targets.push(window);

    // Scrollable ancestors
    let el: HTMLElement | null = container.parentElement;
    while (el) {
      const s = window.getComputedStyle(el);
      const ov = s.overflow + s.overflowY;
      if (ov.includes("auto") || ov.includes("scroll")) {
        el.addEventListener("scroll", handleScroll, { passive: true });
        targets.push(el);
      }
      el = el.parentElement;
    }

    return () => {
      for (const t of targets) {
        t.removeEventListener("scroll", handleScroll);
      }
    };
  }, [handleScroll]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      lastClientPos.current = { x: e.clientX, y: e.clientY };
      // rAF throttle: one DOM write per frame
      if (!rafRef.current) {
        rafRef.current = requestAnimationFrame(() => {
          rafRef.current = 0;
          const pos = lastClientPos.current;
          if (pos) applyGlowAt(pos.x, pos.y);
        });
      }
    },
    [applyGlowAt]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent) => {
      lastClientPos.current = { x: e.clientX, y: e.clientY };
      applyGlowAt(e.clientX, e.clientY);
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
