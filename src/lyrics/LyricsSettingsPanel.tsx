/**
 * LyricsSettingsPanel — 歌词显示设置面板
 * 复用 FluidSettingsPanel 的 UI 模式：GlassModal + GlassToggle + GlassPillButton
 *
 * @module lyrics/LyricsSettingsPanel
 */

import type { FC } from "react";
import { GlassModal, GlassToggle, GlassPillButton } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/types";

// ── 类型 ──

export interface LyricsSettingsValues {
  enableScale: boolean;
  enableBlur: boolean;
  enableGlow: boolean;
  enableStagger: boolean;
  fontSize: "small" | "medium" | "large";
  alignment: "center" | "top" | "bottom";
  lineSpacing: number;
  lyricSource: "auto" | "lrclib" | "netease" | "qq";
}

export const DEFAULT_LYRICS_SETTINGS: LyricsSettingsValues = {
  enableScale: true,
  enableBlur: true,
  enableGlow: true,
  enableStagger: true,
  fontSize: "medium",
  alignment: "center",
  lineSpacing: 24,
  lyricSource: "auto",
};

const LYRICS_SETTINGS_KEY = "lyricsSettings";

export function loadLyricsSettings(): LyricsSettingsValues {
  try {
    const raw = localStorage.getItem(LYRICS_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return { ...DEFAULT_LYRICS_SETTINGS, ...parsed };
    }
  } catch {
    console.warn("[LyricsSettings] Configuration load failed, using defaults");
  }
  return { ...DEFAULT_LYRICS_SETTINGS };
}

export function saveLyricsSettings(values: LyricsSettingsValues): void {
  try {
    localStorage.setItem(LYRICS_SETTINGS_KEY, JSON.stringify(values));
    window.dispatchEvent(new CustomEvent("lyricsSettingsChanged"));
  } catch {
    console.warn("[LyricsSettings] Configuration save failed");
  }
}

// ── 选项 ──

const FONT_SIZE_OPTIONS: { id: LyricsSettingsValues["fontSize"]; label: { zh: string; en: string } }[] = [
  { id: "small", label: { zh: "小", en: "S" } },
  { id: "medium", label: { zh: "中", en: "M" } },
  { id: "large", label: { zh: "大", en: "L" } },
];


const SOURCE_OPTIONS: { id: LyricsSettingsValues["lyricSource"]; label: { zh: string; en: string } }[] = [
  { id: "auto", label: { zh: "自动", en: "Auto" } },
  { id: "lrclib", label: { zh: "LRCLIB", en: "LRCLIB" } },
  { id: "netease", label: { zh: "网易云", en: "Netease" } },
  { id: "qq", label: { zh: "QQ音乐", en: "QQ" } },
];

const ALIGN_OPTIONS: { id: LyricsSettingsValues["alignment"]; label: { zh: string; en: string } }[] = [
  { id: "center", label: { zh: "中", en: "Center" } },
  { id: "top", label: { zh: "上", en: "Top" } },
  { id: "bottom", label: { zh: "下", en: "Bottom" } },
];

// ── 样式 ──

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
    title: "歌词显示设置",
    animation: "动画",
    enableScale: "缩放效果",
    enableBlur: "模糊效果",
    enableGlow: "发光效果",
    enableStagger: "错开延迟",
    display: "显示",
    fontSize: "字号",
    alignment: "当前行位置",
    lineSpacing: "行间距",
    lyricSource: "词库源",
    auto: "自动",
    lrclib: "LRCLIB",
    netease: "网易云",
    qq: "QQ音乐",
    reset: "恢复默认",
  },
  en: {
    title: "Lyrics Settings",
    animation: "Animation",
    enableScale: "Scale Effect",
    enableBlur: "Blur Effect",
    enableGlow: "Glow Effect",
    enableStagger: "Stagger Delay",
    display: "Display",
    fontSize: "Font Size",
    alignment: "Line Position",
    lineSpacing: "Line Spacing",
    lyricSource: "Lyrics Source",
    auto: "Auto",
    lrclib: "LRCLIB",
    netease: "Netease",
    qq: "QQ Music",
    reset: "Reset Defaults",
  },
};

// ── Props ──

interface LyricsSettingsPanelProps {
  open: boolean;
  onClose: () => void;
  values: LyricsSettingsValues;
  onChange: (values: LyricsSettingsValues) => void;
}

// ── Component ──

const LyricsSettingsPanel: FC<LyricsSettingsPanelProps> = ({ open, onClose, values, onChange }) => {
  const { lang } = useLanguage();
  const tx = t[lang];
  const set = <K extends keyof LyricsSettingsValues>(key: K, value: LyricsSettingsValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <GlassModal open={open} onClose={onClose} maxWidth={360}>
      <div style={{ padding: "20px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
        {/* Title */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
            {tx.title}
          </h3>
          <GlassPillButton onClick={() => onChange({ ...DEFAULT_LYRICS_SETTINGS })}>
            {tx.reset}
          </GlassPillButton>
        </div>

        <div style={separatorStyle} />

        {/* ── 动画 ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            {tx.animation}
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{tx.enableScale}</span>
            <GlassToggle active={values.enableScale} onChange={(v) => set("enableScale", v)} />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{tx.enableBlur}</span>
            <GlassToggle active={values.enableBlur} onChange={(v) => set("enableBlur", v)} />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{tx.enableGlow}</span>
            <GlassToggle active={values.enableGlow} onChange={(v) => set("enableGlow", v)} />
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{tx.enableStagger}</span>
            <GlassToggle active={values.enableStagger} onChange={(v) => set("enableStagger", v)} />
          </div>
        </div>

        <div style={separatorStyle} />

        {/* ── 显示 ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            {tx.display}
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{tx.fontSize}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {FONT_SIZE_OPTIONS.map((opt) => (
                <GlassPillButton
                  key={opt.id}
                  active={values.fontSize === opt.id}
                  onClick={() => set("fontSize", opt.id)}
                >
                  {opt.label[lang]}
                </GlassPillButton>
              ))}
            </div>
          </div>
          <div style={rowStyle}>
            <span style={labelStyle}>{tx.alignment}</span>
            <div style={{ display: "flex", gap: 4 }}>
              {ALIGN_OPTIONS.map((opt) => (
                <GlassPillButton
                  key={opt.id}
                  active={values.alignment === opt.id}
                  onClick={() => set("alignment", opt.id)}
                >
                  {opt.label[lang]}
                </GlassPillButton>
              ))}
            </div>
          </div>
        </div>

          <div style={rowStyle}>
            <span style={labelStyle}>{tx.lineSpacing}</span>
            <span style={{ fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", minWidth: 28, textAlign: "right" }}>
              {values.lineSpacing}px
            </span>
          </div>
          <input
            type="range"
            min={12}
            max={48}
            step={2}
            value={values.lineSpacing}
            onChange={(e) => set("lineSpacing", parseInt(e.target.value))}
            style={{ width: "100%", accentColor: "var(--accent)" }}
          />

        <div style={separatorStyle} />

        {/* ── 词库源 ── */}
        <div style={sectionStyle}>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 2 }}>
            {tx.lyricSource}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap" }}>
            {SOURCE_OPTIONS.map((opt) => (
              <GlassPillButton
                key={opt.id}
                active={values.lyricSource === opt.id}
                onClick={() => set("lyricSource", opt.id)}
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

export default LyricsSettingsPanel;
