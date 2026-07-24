/**
 * FluidSettingsPanel — 流体背景设置面板
 * 使用 GlassModal 承载，控制 FluidBackground 各项参数
 */

import type { FC } from "react";
import { GlassModal, GlassToggle, GlassButton, GlassSurface, GlassPillButton } from "@/design-system";
import type { FluidPresetId } from "@/components/FluidBackground/config";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/types";

// ── 类型 ──

export interface FluidSettingsValues {
  enabled: boolean;
  speedMultiplier: number;
  style: FluidPresetId | "auto";
  fps: 30 | 60;
  intensity: number;
  blurAmount: number;
  colorMode: "auto" | "cover" | "dynamic";
}

export const DEFAULT_FLUID_SETTINGS: FluidSettingsValues = {
  enabled: false,
  speedMultiplier: 1.0,
  style: "auto",
  fps: 60,
  intensity: 0.5,
  blurAmount: 0,
  colorMode: "auto",
};

const FLUID_SETTINGS_KEY = "fluidSettings";

export function loadFluidSettings(): FluidSettingsValues {
  try {
    const raw = localStorage.getItem(FLUID_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_FLUID_SETTINGS, ...parsed };
    }
  } catch {
    console.warn("[FluidSettings] Configuration load failed, using defaults");
  }
  return { ...DEFAULT_FLUID_SETTINGS };
}

export function saveFluidSettings(values: FluidSettingsValues): void {
  try {
    localStorage.setItem(FLUID_SETTINGS_KEY, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("fluidSettingsChanged"));
  } catch {
    console.warn("[FluidSettings] Configuration save failed");
  }
}

interface FluidSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  values: FluidSettingsValues;
  onChange: (values: FluidSettingsValues) => void;
}

// ── 风格选项 ──

const STYLE_OPTIONS: { id: FluidPresetId | "auto"; label: { zh: string; en: string } }[] = [
  { id: "auto", label: { zh: "自动", en: "Auto" } },
  { id: "aurora", label: { zh: "极光", en: "Aurora" } },
  { id: "ocean", label: { zh: "深海", en: "Ocean" } },
  { id: "nebula", label: { zh: "星云", en: "Nebula" } },
  { id: "plasma", label: { zh: "等离子", en: "Plasma" } },
  { id: "ember", label: { zh: "余烬", en: "Ember" } },
  { id: "forest", label: { zh: "森林", en: "Forest" } },
];

const COLOR_MODE_OPTIONS: { id: FluidSettingsValues["colorMode"]; label: { zh: string; en: string } }[] = [
  { id: "auto", label: { zh: "自动", en: "Auto" } },
  { id: "dynamic", label: { zh: "动态彩色", en: "Dynamic" } },
  { id: "cover", label: { zh: "封面颜色", en: "Cover Color" } },
];

// ── 样式常量 ──

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
  minWidth: 56,
  flexShrink: 0,
};

const rowStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "6px 0",
  gap: 12,
};

const sectionStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: 8,
};

const separatorStyle: React.CSSProperties = {
  height: 1,
  background: "var(--border-color)",
  opacity: 0.5,
  margin: "4px 0",
};

// ── Translations ──

const t: Record<Language, Record<string, string>> = {
  zh: {
    title: "流体背景设置",

    enable: "开启背景",

    speed: "速度",

    colorMode: "颜色模式",

    frameRate: "帧率",

    intensity: "强度",

    blur: "模糊",

    style: "风格",

    reset: "恢复默认",
    resetTitle: "恢复默认设置",
  },
  en: {
    title: "Fluid Background",

    enable: "Enable Background",

    speed: "Speed",

    colorMode: "Color Mode",

    frameRate: "Frame Rate",

    intensity: "Intensity",

    blur: "Blur",

    style: "Style",

    reset: "Reset Defaults",
    resetTitle: "Reset to default settings",
  },
};

// ── Component ──

const FluidSettingsPanel: FC<FluidSettingsPanelProps> = ({ open, onClose, values, onChange }) => {
  const { lang } = useLanguage();
  const tx = t[lang];
  const set = <K extends keyof FluidSettingsValues>(key: K, value: FluidSettingsValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  const dim = values.enabled ? 1 : 0.35;

  return (
    <GlassModal open={open} onClose={onClose} maxWidth={360}>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Title + Reset */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {tx.title}
          </h3>
          <GlassPillButton
            onClick={() => onChange({ ...DEFAULT_FLUID_SETTINGS })}
            style={{ padding: "3px 12px", borderRadius: 14, border: "1px solid var(--border-color)", fontSize: 11, fontWeight: 500 }}
            title={tx.resetTitle}
          >
            {tx.reset}
          </GlassPillButton>
        </div>


        {/* ── 开启背景 ── */}
        <div style={rowStyle}>
          <div>
            <div style={labelStyle}>{tx.enable}</div>
          </div>
          <GlassToggle active={values.enabled} onChange={(v) => set("enabled", v)} />
        </div>

        <div style={separatorStyle} />

        {/* ── 速度 ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{...labelStyle, opacity: dim}}>{tx.speed}</div>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", opacity: dim }}>
              {values.speedMultiplier.toFixed(1)}x
            </span>
          </div>
          <input
            type="range"
            min={0.1}
            max={3.0}
            step={0.1}
            value={values.speedMultiplier}
            onChange={(e) => set("speedMultiplier", parseFloat(e.target.value))}
            disabled={!values.enabled}
            style={{
              width: "100%",
              accentColor: "var(--accent)",
              opacity: values.enabled ? 1 : 0.4,
            }}
          />
        </div>

        <div style={separatorStyle} />

        {/* ── 颜色模式 ── */}
        <div style={sectionStyle}>
          <div>
            <div style={{...labelStyle, opacity: dim}}>{tx.colorMode}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {COLOR_MODE_OPTIONS.map((opt) => (
              <GlassPillButton
                key={opt.id}
                active={values.colorMode === opt.id}
                disabled={!values.enabled}
                onClick={() => set("colorMode", opt.id)}
              >
                {opt.label[lang]}
              </GlassPillButton>
            ))}
          </div>
        </div><div style={separatorStyle} />

        {/* ── 帧率 ── */}
        <div style={rowStyle}>
          <div>
            <div style={{...labelStyle, opacity: dim}}>{tx.frameRate}</div>
          </div>
          <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {([30, 60] as const).map((fps) => (
              <GlassPillButton
                key={fps}
                active={values.fps === fps}
                disabled={!values.enabled}
                onClick={() => set("fps", fps)}
              >
                {fps} FPS
              </GlassPillButton>
            ))}
          </div>
        </div>

        <div style={separatorStyle} />

        {/* ── 强度 ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{...labelStyle, opacity: dim}}>{tx.intensity}</div>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", opacity: dim }}>
              {Math.round(values.intensity * 100)}%
            </span>
          </div>
          <input
            type="range"
            min={0.05}
            max={1.0}
            step={0.05}
            value={values.intensity}
            onChange={(e) => set("intensity", parseFloat(e.target.value))}
            disabled={!values.enabled}
            style={{
              width: "100%",
              accentColor: "var(--accent)",
              opacity: values.enabled ? 1 : 0.4,
            }}
          />
        </div>

        <div style={separatorStyle} />

        {/* ── 模糊 ── */}
        <div style={sectionStyle}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <div>
              <div style={{...labelStyle, opacity: 0.35}}>{tx.blur}</div>
            </div>
            <span style={{ fontSize: 12, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums", opacity: 0.4 }}>
              N/A
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={1.0}
            step={0.05}
            value={0}
            onChange={(e) => set("blurAmount", parseFloat(e.target.value))}
            disabled={true}
            style={{
              width: "100%",
              accentColor: "var(--text-tertiary)",
              opacity: 0.3,
              cursor: "not-allowed",
            }}
          />
        </div>

        <div style={separatorStyle} />

        {/* ── 风格 ── */}
        <div style={sectionStyle}>
          <div>
            <div style={{...labelStyle, opacity: dim}}>{tx.style}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {STYLE_OPTIONS.map((opt) => (
              <GlassPillButton
                key={opt.id}
                active={values.style === opt.id}
                disabled={!values.enabled}
                onClick={() => set("style", opt.id)}
              >
                {opt.label[lang]}
              </GlassPillButton>
            ))}
          </div>
        </div>

        
      </div>
    </GlassModal>
  );
};

export default FluidSettingsPanel;
