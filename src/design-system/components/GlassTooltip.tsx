/**
 * GlassTooltip - Custom glass-styled tooltip for hover text.
 *
 * Replaces native title tooltips with Liquid Glass styled popups.
 * Shows after delay at the position where the mouse settled.
 */

import { useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { radii } from "../tokens";

interface GlassTooltipProps {
  text: string;
  children: ReactNode;
  placement?: "right" | "left";
}

const SHOW_DELAY = 400;

export function GlassTooltip({ text, children, placement = "right" }: GlassTooltipProps) {
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [visible, setVisible] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const hide = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    setPos(null);
  }, []);

  const onMove = useCallback((e: React.MouseEvent) => {
    lastPosRef.current = { x: e.clientX, y: e.clientY };
  }, []);

  const onEnter = useCallback((e: React.MouseEvent) => {
    hide();
    lastPosRef.current = { x: e.clientX, y: e.clientY };
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      setPos({ ...lastPosRef.current });
      setVisible(true);
    }, SHOW_DELAY);
  }, [hide]);

  const onLeave = useCallback(() => {
    hide();
  }, [hide]);

  useEffect(() => {
    return () => hide();
  }, [hide]);

  return (
    <span
      onMouseEnter={onEnter}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ display: "inline-flex" }}
    >
      {children}
      {visible && pos && text && createPortal(
        <div
          style={{
            position: "fixed",
            left: placement === "left" ? pos.x - 14 : pos.x + 14,
            top: pos.y - 32,
            transform: placement === "left" ? "translateX(-100%)" : "none",
            zIndex: 99999,
            pointerEvents: "none",
            backdropFilter: "blur(32px) saturate(2.2)",
            WebkitBackdropFilter: "blur(32px) saturate(2.2)",
            background: "rgba(18,18,28,0.40)",
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: radii.lg,
            padding: "3px 10px",
            fontSize: 12,
            fontWeight: 500,
            color: "rgba(255,255,255,0.92)",
            whiteSpace: "nowrap",
            boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
          }}
        >
          {text}
        </div>,
        document.body
      )}
    </span>
  );
}

export default GlassTooltip;
