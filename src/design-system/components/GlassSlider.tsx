/**
 * GlassSlider — Glass-styled range slider
 *
 * Uses global input[type="range"] CSS styles with dynamic --slider-fill.
 * Includes an optional empty capsule reset button next to the label.
 *
 * @module design-system/components/GlassSlider
 */

import { useCallback } from "react";
import { GlassPillButton } from "./GlassPillButton";

export interface GlassSliderProps {
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
  /** Formatted display value shown on the right */
  display?: string;
  /** Default value for reset. If omitted, reset is hidden. */
  defaultVal?: number;
  disabled?: boolean;
  style?: React.CSSProperties;
}

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  padding: "4px 0",
  gap: 12,
};

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
};

const valueStyle: React.CSSProperties = {
  fontSize: 12,
  color: "var(--text-secondary)",
  fontVariantNumeric: "tabular-nums",
  minWidth: 32,
  textAlign: "right" as const,
};

export function GlassSlider({
  label, value, min, max, step, onChange, display, defaultVal, disabled, style,
}: GlassSliderProps) {
  const parse = useCallback(
    (raw: string) => (step >= 1 ? parseInt(raw) : parseFloat(raw)),
    [step],
  );

  const fillPct = ((value - min) / (max - min)) * 100;
  const hasReset = defaultVal !== undefined;

  return (
    <div style={{ opacity: disabled ? 0.4 : 1, ...style }}>
      {(label || display || hasReset) ? (
        <div style={rowStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {label ? <span style={{ ...labelStyle, lineHeight: 1 }}>{label}</span> : null}
            {hasReset && value !== defaultVal ? (
              <GlassPillButton
                onClick={() => onChange(defaultVal!)}
                style={{
                  width: 14,
                  height: 10,
                  padding: 0,
                  borderRadius: 10,
                  opacity: 0.7,
                  fontSize: 0,
                  lineHeight: "10px",
                }}
              />
            ) : null}
          </div>
          <div style={{ flex: 1 }} />
          {display ? <span style={valueStyle}>{display}</span> : null}
        </div>
      ) : null}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        defaultValue={value}
        key={value}
        disabled={disabled}
        style={{
          width: "100%",
          "--slider-fill": fillPct + "%",
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? "not-allowed" : undefined,
        } as React.CSSProperties}
        onInput={(e) => {
          const pct =
            ((parseFloat((e.target as HTMLInputElement).value) - min) /
              (max - min)) *
            100;
          (e.target as HTMLInputElement).style.setProperty(
            "--slider-fill",
            pct + "%",
          );
        }}
        onMouseUp={(e) =>
          onChange(parse((e.target as HTMLInputElement).value))
        }
        onTouchEnd={(e) =>
          onChange(parse((e.target as HTMLInputElement).value))
        }
      />
    </div>
  );
}

export default GlassSlider;
