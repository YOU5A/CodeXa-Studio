/**
 * GlassSelect — Liquid Glass Fluid Dropdown
 *
 * FluidSettingsPanel-style dropdown with:
 * - Pill-shaped option buttons with white cursor glow
 * - High-blur glass panel with separators
 * - Optional title/subtitle header
 * - Optional reset button
 * - Portal-based rendering to avoid clipping
 */

import { useState, useRef, useEffect, useMemo, useCallback, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import type { Transition } from "framer-motion";
import { ChevronDown, RotateCcw } from "lucide-react";
import { GlassPillButton } from "./GlassPillButton";
import { space, radii, fontSizes, zLayers } from "../tokens";
import { useTheme } from "@/hooks/useTheme";

export interface SelectOption {
  value: string;
  label: string;
}

export interface GlassSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  placeholder?: string;
  disabled?: boolean;
  fullWidth?: boolean;
  width?: number | string;
  /** Fluid panel title (optional) */
  title?: string;
  /** Fluid panel subtitle (optional) */
  subtitle?: string;
  /** If provided, shows a reset button that calls this handler */
  onReset?: () => void;
  /** Reset button label */
  resetLabel?: string;
}

export function GlassSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  disabled = false,
  fullWidth = true,
  width,
  title,
  subtitle,
  onReset,
  resetLabel,
}: GlassSelectProps) {
  const { settings } = useTheme();
  const dropdownTransition: Transition = useMemo(() => {
    if (settings.animationSpeed === "off") return { duration: 0 };
    if (settings.animationSpeed === "normal") return { type: "spring", stiffness: 250, damping: 28, mass: 0.7 };
    return { type: "spring", stiffness: 400, damping: 30, mass: 0.6 };
  }, [settings.animationSpeed]);

  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const updateDropdownPos = useCallback(() => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setDropdownPos({ top: rect.bottom + 6, left: rect.left, width: Math.max(rect.width, 200) });
    }
  }, []);

  /* Cursor-following glow */
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

  useEffect(() => {
    if (open) {
      updateDropdownPos();
      window.addEventListener("scroll", updateDropdownPos, true);
      window.addEventListener("resize", updateDropdownPos);
      return () => {
        window.removeEventListener("scroll", updateDropdownPos, true);
        window.removeEventListener("resize", updateDropdownPos);
      };
    }
  }, [open, updateDropdownPos]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (triggerRef.current?.contains(target)) return;
      if (dropdownRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const selectedLabel =
    options.find((o) => o.value === value)?.label ?? placeholder;

  /* ── Trigger — pill-shaped ── */
  const triggerStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    background: "linear-gradient(var(--glass-angle, 135deg), rgba(var(--glass-glow-rgb,255,255,255),0.12) 0%, rgba(var(--glass-glow-rgb,255,255,255),0.03) 45%, rgba(var(--glass-glow-rgb,255,255,255),0.01) 70%, rgba(var(--glass-glow-rgb,255,255,255),0.05) 100%), transparent",
    color: value ? "var(--text-primary)" : "var(--text-tertiary)",
    border: "none",
    borderRadius: "calc(var(--radius) * 1.0)",
    padding: "7px 16px",
    fontSize: fontSizes.sm,
    fontWeight: 500,
    cursor: disabled ? "not-allowed" : "pointer",
    width: fullWidth ? (width ?? "100%") : width ?? "auto",
    outline: "none",
    userSelect: "none",
    backdropFilter: "blur(32px) saturate(2.2)",
    WebkitBackdropFilter: "blur(32px) saturate(2.2)",
    "--glass-angle": (105 + Math.random() * 60) + "deg",
    "--glass-highlight-opacity": "0.08",
    transition: "all var(--transition-fast)",
    opacity: disabled ? 0.5 : 1,
    margin: "2px 0", boxShadow: open ? "0 0 0 1px var(--accent), 0 0 0 3px var(--accent-bg)" : "0 0 0 1px var(--border-color)",
  };

  /* ── Dropdown panel — fluid glass ── */
  const panelStyle: React.CSSProperties = {
    position: "fixed",
    top: dropdownPos.top,
    left: dropdownPos.left,
    width: dropdownPos.width,
    zIndex: zLayers.tooltip + 10,
    background: "var(--bg-secondary)",
    backdropFilter: "blur(50px) saturate(2.5)",
    WebkitBackdropFilter: "blur(50px) saturate(2.5)",
    border: "1px solid var(--border-strong)",
    borderRadius: radii.lg,
    padding: 14,
    boxShadow: "0 12px 40px rgba(0,0,0,0.18), 0 4px 12px rgba(0,0,0,0.08)",
    display: "flex",
    flexDirection: "column",
    gap: 0,
    maxHeight: 360,
    overflowY: "auto",
  };

  const separatorStyle: React.CSSProperties = {
    height: 1,
    background: "var(--border-color)",
    opacity: 0.5,
    margin: "10px 0",
  };

  const dropdownMenu = (
    <motion.div
      ref={dropdownRef}
      variants={{
        hidden: { opacity: 0, y: -6, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1 },
        exit: { opacity: 0, y: -6, scale: 0.95 },
      }}
      initial="hidden"
      animate="visible"
      exit="exit"
      transition={dropdownTransition}
      style={panelStyle}
    >
      {/* Header */}
      {(title || subtitle) && (
        <>
          <div style={{ marginBottom: 2 }}>
            {title && (
              <div style={{ fontSize: fontSizes.md, fontWeight: 600, color: "var(--text-primary)", letterSpacing: "-0.01em" }}>
                {title}
              </div>
            )}
            {subtitle && (
              <div style={{ fontSize: 11, color: "var(--text-tertiary)", marginTop: 1 }}>
                {subtitle}
              </div>
            )}
          </div>
          <div style={separatorStyle} />
        </>
      )}

      {/* Options as fluid pills */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <GlassPillButton
              key={opt.value}
              active={active}
              onClick={() => {
                onChange(opt.value);
                setOpen(false);
              }}
              style={{ display: "flex", alignItems: "center", gap: 6 }}
            >
              {opt.label}
            </GlassPillButton>
          );
        })}
      </div>

      {/* Reset button */}
      {onReset && (
        <>
          <div style={separatorStyle} />
          <GlassPillButton
            onClick={() => {
              onReset();
              setOpen(false);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 6,
              width: "100%",
              padding: "6px 0",
              borderRadius: 16,
              fontSize: 11,
              fontWeight: 500,
            }}
          >
            <RotateCcw size={11} />
            {resetLabel || "Reset"}
          </GlassPillButton>
        </>
      )}
    </motion.div>
  );

  return (
    <>
      <div
        ref={triggerRef}
        role="combobox"
        tabIndex={disabled ? -1 : 0}
        aria-expanded={open}
        onClick={() => !disabled && setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            !disabled && setOpen(!open);
          }
          if (e.key === "Escape") setOpen(false);
        }}
        onMouseMove={(e) => !disabled && setGlow(e.currentTarget, e.clientX, e.clientY)}
        onMouseEnter={(e) => !disabled && setGlow(e.currentTarget, e.clientX, e.clientY)}
        onMouseLeave={(e) => clearGlow(e.currentTarget)}
        style={triggerStyle}
      >
        <span className="theme-pill-glow" />
        <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", position: "relative", zIndex: 1 }}>
          {selectedLabel}
        </span>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={dropdownTransition}
          style={{ flexShrink: 0, display: "flex", color: "var(--text-tertiary)", position: "relative", zIndex: 1 }}
        >
          <ChevronDown size={14} />
        </motion.span>
      </div>

      {createPortal(
        <AnimatePresence>
          {open && dropdownMenu}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}

export default GlassSelect;