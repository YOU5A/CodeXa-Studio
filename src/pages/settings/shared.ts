import type React from "react";

/** Pill button glow helpers — reused across section components */
export function setPillGlow(el: HTMLElement, cx: number, cy: number) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  el.style.setProperty("--pill-gx", ((cx - r.left) / r.width) * 100 + "%");
  el.style.setProperty("--pill-gy", ((cy - r.top) / r.height) * 100 + "%");
  el.style.setProperty("--pill-go", "1");
}

export function clearPillGlow(el: HTMLElement) {
  el.style.setProperty("--pill-go", "0");
}

export const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  minWidth: 56,
  flexShrink: 0,
};

export const sectionLabelStyle: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  marginBottom: -4,
};

export const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 0",
  gap: 12,
};

export const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

export const separatorStyle: React.CSSProperties = {
  height: 1,
  background: "var(--border-color)",
  opacity: 0.5,
  margin: "4px 0",
};

/** Active pill style for option selectors */
export function pillActiveStyle(active: boolean): React.CSSProperties {
  return {
    padding: "5px 12px",
    borderRadius: 20,
    border: `1.5px solid ${active ? "var(--accent)" : "var(--border-color)"}`,
    background: active ? "var(--accent-bg)" : "transparent",
    color: active ? "var(--accent)" : "var(--text-secondary)",
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: "pointer",
    transition: "all var(--transition-fast)",
    boxShadow: active ? "0 0 12px rgba(255,255,255,0.25), 0 0 4px rgba(255,255,255,0.15)" : "none",
    fontFamily: "inherit",
    outline: "none",
  };
}