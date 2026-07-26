import { Palette } from "lucide-react";
import { GlassPillButton, GlassSlider } from "@/design-system/components";
import { sectionLabelStyle, rowStyle, labelStyle, sectionStyle, separatorStyle, pillActiveStyle } from "./shared";
import type { AppSettings } from "@/types";

interface AppearanceSectionProps {
  tx: Record<string, string>;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  onOpenThemePicker: () => void;
  currentThemeIcon: React.ReactNode;
  currentThemeKey: string;
  animSpeedOptions: readonly { value: string; key: string }[];
}

const themePillStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "5px 12px",
  borderRadius: 20,
  border: "1.5px solid var(--border-color)",
  background: "transparent",
  color: "var(--text-secondary)",
  fontSize: 12,
  fontWeight: 500,
  cursor: "pointer",
  transition: "all var(--transition-fast)",
  fontFamily: "inherit",
  outline: "none",
};

export default function AppearanceSection({
  tx, settings, updateSettings, onOpenThemePicker,
  currentThemeIcon, currentThemeKey, animSpeedOptions,
}: AppearanceSectionProps) {
  return (
    <>
      <div style={sectionLabelStyle}>{tx.appearance}</div>

      {/* Theme */}
      <div style={rowStyle}>
        <div style={labelStyle}>{tx.themeLabel}</div>
        <GlassPillButton onClick={onOpenThemePicker} style={themePillStyle}>
          {currentThemeIcon}
          {tx[currentThemeKey]}
          <Palette size={12} />
        </GlassPillButton>
      </div>

      {/* Opacity */}
      <div style={sectionStyle}>
        <GlassSlider
          label={tx.opacity}
          display={settings.windowOpacity + "%"}
          value={settings.windowOpacity}
          defaultVal={100}
          min={70}
          max={100}
          step={1}
          onChange={(v) => updateSettings({ windowOpacity: v })}
        />
      </div>

      {/* Radius */}
      <div style={sectionStyle}>
        <GlassSlider
          label={tx.radius}
          display={settings.borderRadius + "px"}
          value={settings.borderRadius}
          defaultVal={20}
          min={0}
          max={30}
          step={1}
          onChange={(v) => updateSettings({ borderRadius: v })}
        />
      </div>

      {/* Animation Speed */}
      <div style={sectionStyle}>
        <div style={labelStyle}>{tx.animSpeed}</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {animSpeedOptions.map((opt) => {
            const active = settings.animationSpeed === opt.value;
            return (
              <GlassPillButton
                key={opt.value}
                onClick={() => updateSettings({ animationSpeed: opt.value as typeof settings.animationSpeed })}
                style={pillActiveStyle(active)}
              >
                {tx[opt.key]}
              </GlassPillButton>
            );
          })}
        </div>
      </div>

      <div style={separatorStyle} />
    </>
  );
}
