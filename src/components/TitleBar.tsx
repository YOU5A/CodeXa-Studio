import { useState, useEffect, useRef, useCallback } from "react";
import { Minus, X, Square, Copy, Droplets } from "lucide-react";
import { GlassSurface, LiquidGlassLens } from "@/design-system";

interface TitleBarProps {
  isMaximized: boolean;
  onToggleMaximize: () => void;
}

/* ─── macOS Traffic Light Colors ─── */
const TRAFFIC_LIGHT = {
  red:    { bg: "#FF5F57", icon: "#8B0000" },
  yellow: { bg: "#FFBD2E", icon: "#9B6E00" },
  green:  { bg: "#27CA40", icon: "#006E0D" },
  inactive: "#D1D1D6",
} as const;

type TrafficColor = "red" | "yellow" | "green";
type TrafficIcon = "minimize" | "maximize" | "close";

const DOT_SIZE = 12;
const DOT_GAP = 8;

function TrafficLightDot({
  color,
  icon,
  label,
  onClick,
  isMaximized,
}: {
  color: TrafficColor;
  icon: TrafficIcon;
  label: string;
  onClick: () => void;
  isMaximized?: boolean;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const [isWindowFocused, setIsWindowFocused] = useState(true);

  useEffect(() => {
    const onFocus = () => setIsWindowFocused(true);
    const onBlur = () => setIsWindowFocused(false);
    window.addEventListener("focus", onFocus);
    window.addEventListener("blur", onBlur);
    setIsWindowFocused(document.hasFocus());
    return () => {
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("blur", onBlur);
    };
  }, []);

  const c = TRAFFIC_LIGHT[color];
  const active = isWindowFocused;

  const dotBg = active ? c.bg : TRAFFIC_LIGHT.inactive;
  const iconVisible = active && isHovered;

  const renderIcon = () => {
    const iconStyle: React.CSSProperties = {
      position: "absolute",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      opacity: iconVisible ? 1 : 0,
      transition: "opacity 0.15s ease",
    };

    switch (icon) {
      case "minimize":
        return (
          <span style={iconStyle}>
            <Minus size={6} strokeWidth={3} color={c.icon} />
          </span>
        );
      case "maximize":
        return (
          <span style={iconStyle}>
            {isMaximized ? (
              <Copy size={7} strokeWidth={2.5} color={c.icon} />
            ) : (
              <Square size={6} strokeWidth={2.5} color={c.icon} />
            )}
          </span>
        );
      case "close":
        return (
          <span style={iconStyle}>
            <X size={6} strokeWidth={2.5} color={c.icon} />
          </span>
        );
    }
  };

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      aria-label={label}
      style={{
        WebkitAppRegion: "no-drag",
        width: DOT_SIZE,
        height: DOT_SIZE,
        minWidth: DOT_SIZE,
        minHeight: DOT_SIZE,
        borderRadius: "50%",
        border: "none",
        padding: 0,
        cursor: "default",
        background: dotBg,
        position: "relative",
        boxShadow: active
          ? `0 0 0 0.5px rgba(0,0,0,0.10), inset 0 1px 0.5px rgba(255,255,255,0.25), inset 0 -0.5px 1px rgba(0,0,0,0.06)`
          : `0 0 0 0.5px rgba(0,0,0,0.06), inset 0 1px 0.5px rgba(255,255,255,0.15)`,
        transition: "background 0.15s ease, box-shadow 0.15s ease",
        outline: "none",
      } as React.CSSProperties}
    >
      {renderIcon()}
    </button>
  );
}

export default function TitleBar({ isMaximized, onToggleMaximize }: TitleBarProps) {
  const dragStyle = { WebkitAppRegion: "drag" } as React.CSSProperties;
  const noDragStyle = { WebkitAppRegion: "no-drag" } as React.CSSProperties;

  const [lensState, setLensState] = useState<{
    active: boolean;
    x: number;
    y: number;
    isDragging: boolean;
  }>({
    active: false,
    x: 0,
    y: 0,
    isDragging: false,
  });

  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMouseDownRef = useRef(false);

  // 长按触发水滴折射透镜拖动
  const handleLensPressStart = useCallback((e: React.MouseEvent) => {
    isMouseDownRef.current = true;
    const clientX = e.clientX;
    const clientY = e.clientY;

    longPressTimerRef.current = setTimeout(() => {
      if (isMouseDownRef.current) {
        setLensState({
          active: true,
          x: clientX,
          y: clientY,
          isDragging: true,
        });
      }
    }, 220);
  }, []);

  const handleGlobalMouseMove = useCallback((e: MouseEvent) => {
    if (!isMouseDownRef.current) return;
    setLensState((prev) => {
      if (!prev.active) return prev;
      return { ...prev, x: e.clientX, y: e.clientY, isDragging: true };
    });
  }, []);

  const handleGlobalMouseUp = useCallback(() => {
    isMouseDownRef.current = false;
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    setLensState((prev) => {
      if (!prev.active) return prev;
      return { ...prev, active: false, isDragging: false };
    });
  }, []);

  useEffect(() => {
    window.addEventListener("mousemove", handleGlobalMouseMove);
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mousemove", handleGlobalMouseMove);
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, [handleGlobalMouseMove, handleGlobalMouseUp]);

  return (
    <>
      <GlassSurface
        tier="ultraThin"
        noBlur={false}
        styleOverrides={{ radius: 0, shadow: "none" }}
        style={{
          height: "var(--titlebar-height)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 12px",
          borderBottom: "1px solid var(--border-color)",
          borderTop: "none",
          borderLeft: "none",
          borderRight: "none",
          borderRadius: 0,
          ...dragStyle,
          flexShrink: 0,
          zIndex: 100,
        }}
      >
        {/* Left: Traffic Lights + App Logo/Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          {/* Traffic Light Dots */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: DOT_GAP,
              paddingLeft: 2,
              ...noDragStyle,
            }}
          >
            <TrafficLightDot
              color="red"
              icon="close"
              label="关闭"
              onClick={() => window.electronAPI?.window.close()}
            />
            <TrafficLightDot
              color="yellow"
              icon="minimize"
              label="最小化"
              onClick={() => window.electronAPI?.window.minimize()}
            />
            <TrafficLightDot
              color="green"
              icon="maximize"
              label={isMaximized ? "恢复" : "最大化"}
              onClick={onToggleMaximize}
              isMaximized={isMaximized}
            />
          </div>
          <span style={{
            fontSize: 13, fontWeight: 500, color: "var(--text-primary)", letterSpacing: "-0.01em",
          }}>
            CodeXa Studio
          </span>
        </div>

        {/* Center: 液态折射拖动把手 (方案 B 触发器) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            ...noDragStyle,
          }}
        >
          <button
            className="theme-pill"
            onMouseDown={handleLensPressStart}
            title="按住200ms进入水滴物理折射拖拽模式"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              padding: "3px 12px",
              fontSize: 11,
              fontWeight: 500,
              color: lensState.active ? "var(--text-primary)" : "var(--text-tertiary)",
              background: lensState.active ? "var(--glass-vision-active)" : "rgba(255, 255, 255, 0.04)",
              border: "none",
              borderRadius: "calc(var(--radius) * 0.8)",
              cursor: lensState.active ? "grabbing" : "grab",
              userSelect: "none",
              outline: "none",
              boxShadow: lensState.active
                ? "var(--glass-vision-shadow)"
                : "var(--glass-lens-inner-shadow), 0 0 0 1px var(--border-color)",
              transition: "all var(--transition-fast) ease",
            }}
          >
            <Droplets size={12} style={{ color: lensState.active ? "var(--text-primary)" : "inherit" }} />
            <span>{lensState.active ? "液态折射拖拽中" : "液态把手"}</span>
            <span className="theme-pill-glow" />
          </button>
        </div>

        {/* Right: placeholder for symmetry */}
        <div style={noDragStyle} />
      </GlassSurface>

      {/* 方案 B：物理折射与色散水滴透镜 */}
      <LiquidGlassLens
        active={lensState.active}
        x={lensState.x}
        y={lensState.y}
        radius={85}
        isDragging={lensState.isDragging}
      />
    </>
  );
}