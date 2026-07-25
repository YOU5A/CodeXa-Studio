/**
 * GlassPillButton — 统一胶囊按钮组件
 *
 * 封装 theme-pill 按钮的标准样式、光标跟随光晕、选中态发光。
 * 所有 pill 按钮统一使用此组件。
 */

import { useCallback, type ReactNode } from "react";

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
        borderRadius: 20,
        border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
        background: active ? "var(--accent-bg)" : "transparent",
        color: active ? "var(--accent)" : "var(--text-secondary)",
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.4 : 1,
        transition: "all var(--transition-fast)",
        boxShadow: active ? "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "none",
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
