/**
 * Global Mouse Tracker
 *
 * Tracks the real-time clientX and clientY across all viewport movements.
 * Provides accurate hit testing during and after scroll operations so that
 * cursor-following glow effects never flash at stale coordinates or on
 * elements that the cursor has already scrolled past.
 */

let globalClientX = -9999;
let globalClientY = -9999;
let isMouseInside = false;

if (typeof window !== "undefined") {
  window.addEventListener(
    "mousemove",
    (e) => {
      globalClientX = e.clientX;
      globalClientY = e.clientY;
      isMouseInside = true;
    },
    { capture: true, passive: true }
  );

  document.addEventListener(
    "mouseleave",
    () => {
      isMouseInside = false;
    },
    { passive: true }
  );

  window.addEventListener(
    "blur",
    () => {
      isMouseInside = false;
    },
    { passive: true }
  );
}

export function getGlobalMousePos(): { x: number; y: number; inside: boolean } {
  return { x: globalClientX, y: globalClientY, inside: isMouseInside };
}

/**
 * Checks whether the cursor is currently physically over an element in the viewport.
 */
export function isMouseOverElement(el: HTMLElement | null): boolean {
  if (!el || !isMouseInside || globalClientX < 0 || globalClientY < 0) {
    return false;
  }
  const rect = el.getBoundingClientRect();
  if (
    globalClientX < rect.left ||
    globalClientX > rect.right ||
    globalClientY < rect.top ||
    globalClientY > rect.bottom
  ) {
    return false;
  }
  const topEl = document.elementFromPoint(globalClientX, globalClientY);
  return !!topEl && (topEl === el || el.contains(topEl));
}
