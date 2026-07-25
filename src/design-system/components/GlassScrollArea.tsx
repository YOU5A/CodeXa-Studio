/**
 * GlassScrollArea — Scrollable container with glass-themed scrollbar
 *
 * A reusable scrollable area that styles the scrollbar to match the
 * Liquid Glass design system. Use for settings panels, content areas, etc.
 * Scrollbar sits at the container edge with padding separating it from content.
 *
 * @module design-system/components/GlassScrollArea
 */

import { forwardRef, type ReactNode, useLayoutEffect, useRef } from "react";

let styleInjected = false;

export interface GlassScrollAreaProps {
  children?: ReactNode;
  maxHeight?: number | string;
  style?: React.CSSProperties;
  className?: string;
  /** Right padding before scrollbar (default 10px) */
  scrollbarGutter?: number;
  /** Enable top/bottom fade mask for scroll edges (default false) */
  fadeEdges?: boolean;
}

export const GlassScrollArea = forwardRef<HTMLDivElement, GlassScrollAreaProps>(
  function GlassScrollArea({ children, maxHeight, style, className, scrollbarGutter = 10, fadeEdges = false }, ref) {
    const injectedRef = useRef(false);

    useLayoutEffect(() => {
      if (styleInjected || injectedRef.current) return;
      injectedRef.current = true;
      styleInjected = true;
      const el = document.createElement("style");
      el.textContent = `
        .glass-scroll-area {
          overflow-y: auto;
          overflow-x: clip;
          overscroll-behavior: contain;
          flex: 1;
          min-height: 0;
          padding-block: 6px;
          margin-block: -6px;
        }
        .glass-scroll-area::-webkit-scrollbar {
          width: 5px;
        }
        .glass-scroll-area::-webkit-scrollbar-track {
          background: transparent;
          margin-block: 4px;
        }
        .glass-scroll-area::-webkit-scrollbar-thumb {
          background-color: rgba(255, 255, 255, 0.10);
          border-radius: 100px;
          transition: background-color 0.25s ease;
        }
        .glass-scroll-area::-webkit-scrollbar-thumb:hover {
          background-color: rgba(255, 255, 255, 0.22);
        }
        .glass-scroll-area::-webkit-scrollbar-thumb:active {
          background-color: rgba(255, 255, 255, 0.32);
        }
      `;
      document.head.appendChild(el);
    }, []);

    return (
      <div
        ref={ref}
        className={`glass-scroll-area${className ? " " + className : ""}`}
        style={{
          maxHeight: maxHeight ?? "100%",
          paddingRight: scrollbarGutter,
          ...(fadeEdges ? {
            maskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent 0%, black 6%, black 94%, transparent 100%)",
          } : {}),
          ...style,
        }}
      >
        {children}
      </div>
    );
  }
);

export default GlassScrollArea;
