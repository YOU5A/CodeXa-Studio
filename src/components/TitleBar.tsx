import { useState, useEffect } from "react";
import { Minus, X, Square, Copy } from "lucide-react";
import { GlassSurface } from "@/design-system";

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

        {/* Right: placeholder for symmetry */}
        <div style={noDragStyle} />
      </GlassSurface>
    </>
  );
}
