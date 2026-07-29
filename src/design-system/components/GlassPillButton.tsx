/**
 * GlassPillButton — 统一胶囊按钮组件
 *
 * 封装 theme-pill 按钮的标准样式、光标跟随光晕、选中态发光。
 * 所有 pill 按钮统一使用此组件。
 */

import { useCallback, useRef, type ReactNode } from "react";

export interface GlassPillButtonProps {
  children?: ReactNode;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
}

export function GlassPillButton({
  children,
  active = false,
  disabled = false,
  onClick,
  className,
  style,
  title,
}: GlassPillButtonProps) {
  // Stable random seed per mount ? avoids angle jump during re-renders
  const seedRef = useRef<number>(112 + Math.random() * 56);

  const setGlow = useCallback((el: HTMLElement, cx: number, cy: number) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    el.style.setProperty("--pill-gx", ((cx - r.left) / r.width) * 100 + "%");
    el.style.setProperty("--pill-gy", ((cy - r.top) / r.height) * 100 + "%");
    el.style.setProperty("--pill-go", "1");
  }, []);

  const clearGlow = useCallback((el: HTMLElement) => {
    el.style.setProperty("--pill-go", "0");
  }, []);

  return (
    <button
      className={`theme-pill${className ? " " + className : ""}`}
      onClick={onClick}
      disabled={disabled}
      onMouseMove={(e) => setGlow(e.currentTarget, e.clientX, e.clientY)}
      onMouseEnter={(e) => setGlow(e.currentTarget, e.clientX, e.clientY)}
      onMouseLeave={(e) => clearGlow(e.currentTarget)}
      title={title}
      style={{
        padding: "5px 14px",
        borderRadius: "calc(var(--radius) * 1.0)",
        border: "none",
        background: active
          ? "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.15) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.03) 50%, rgba(var(--glass-glow-rgb,255,255,255),0.01) 100%), var(--accent-bg-fade)"
          : "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.08) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.01) 45%, rgba(var(--glass-glow-rgb,255,255,255),0.00) 70%, rgba(var(--glass-glow-rgb,255,255,255),0.03) 100%), transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        backdropFilter: "blur(32px) saturate(2.2)",
        WebkitBackdropFilter: "blur(32px) saturate(2.2)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        "--glass-angle": seedRef.current + "deg",
        "--glass-highlight-opacity": "0.08",
        "--glass-noise-opacity": "0.01",
        transition: "all var(--transition-fast)",
        boxShadow: active ? "0 0 0 1px var(--accent), 0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "0 0 0 1px var(--border-color)",
        whiteSpace: "nowrap",
        fontFamily: "inherit",
        outline: "none",
        ...style,
      }}
    >
      <span className="theme-pill-glow" />
      {children}
    </button>
  );
}

export default GlassPillButton;
