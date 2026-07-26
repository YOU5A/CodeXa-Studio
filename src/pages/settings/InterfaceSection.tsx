import { Globe } from "lucide-react";
import { GlassToggle, GlassPillButton } from "@/design-system/components";
import { sectionLabelStyle, rowStyle, labelStyle, sectionStyle, separatorStyle } from "./shared";
import type { AppSettings, Language } from "@/types";

interface InterfaceSectionProps {
  tx: Record<string, string>;
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => void;
  lang: Language;
  setLang: (lang: Language) => void;
  sidebarWidthOptions: { value: string; label: string }[];
  fontScaleOptions: { value: string; label: string }[];
}

export default function InterfaceSection({
  tx, settings, updateSettings, lang, setLang,
  sidebarWidthOptions, fontScaleOptions,
}: InterfaceSectionProps) {
  return (
    <>
      <div style={sectionLabelStyle}>{tx.interface}</div>

      {/* Sidebar Width */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={labelStyle}>{tx.sidebarWidth}</div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            {settings.sidebarWidth}px
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {sidebarWidthOptions.map((opt) => {
            const active = String(settings.sidebarWidth) === opt.value;
            return (
              <GlassPillButton
                key={opt.value}
                onClick={() => updateSettings({ sidebarWidth: Number(opt.value) })}
                active={active}
              >
                {opt.label}
              </GlassPillButton>
            );
          })}
        </div>
      </div>

      {/* Font Scale */}
      <div style={sectionStyle}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={labelStyle}>{tx.fontScale}</div>
          <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums" }}>
            {settings.fontScale}%
          </span>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {fontScaleOptions.map((opt) => {
            const active = String(settings.fontScale) === opt.value;
            return (
              <GlassPillButton
                key={opt.value}
                onClick={() => updateSettings({ fontScale: Number(opt.value) })}
                active={active}
              >
                {opt.label}
              </GlassPillButton>
            );
          })}
        </div>
      </div>

      {/* Compact Mode */}
      <div style={rowStyle}>
        <div style={labelStyle}>{tx.compact}</div>
        <GlassToggle
          active={settings.compactMode}
          onChange={(v) => updateSettings({ compactMode: v, fontScale: v ? 90 : 120 })}
        />
      </div>

      <div style={separatorStyle} />

      {/* Language */}
      <div style={sectionLabelStyle}>{tx.language}</div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        {(["zh", "en"] as const).map((lng) => {
          const active = lang === lng;
          return (
            <GlassPillButton
              key={lng}
              onClick={() => setLang(lng)}
              active={active}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              <Globe size={13} />
              {lng === "zh" ? "中文" : "English"}
            </GlassPillButton>
          );
        })}
      </div>

      <div style={separatorStyle} />
    </>
  );
}
