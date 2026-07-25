/**
 * LyricsSettingsPanel — Lyrics display settings panel
 *
 * @module lyrics/LyricsSettingsPanel
 */

import { type FC } from "react";
import { GlassModal, GlassToggle, GlassPillButton, GlassScrollArea, GlassSlider } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/types";
import type { LyricsSettingsValues } from "./types";
import { DEFAULT_LYRICS_SETTINGS } from "./types";

const t: Record<Language, Record<string, string>> = {
  zh: {
    title: "歌词显示设置", animation: "动画",
    enableScale: "缩放效果", enableBlur: "模糊效果", enableGlow: "发光效果", enableStagger: "错开延迟",
    fontBold: "加粗首行", content: "内容", showTranslation: "显示翻译", showRomaji: "显示罗马音",
    display: "显示", fontSize: "字体大小", romajiFontSize: "罗马音字号", translationFontSize: "翻译字号",
    alignmentPercentage: "当前歌词位置", animationTiming: "动画曲线", offset: "全局偏移", offsetUnit: "秒",
    lyricSource: "词库源", reset: "恢复默认", auto: "自动", netease: "网易云", lrc: "文件LRC",
    highTop: "居上", center: "居中", smooth: "平滑", sharp: "急促", easeout: "缓出", lazy: "温和", notSet: "未设置",
    resetToDefault: "重置",
  },
  en: {
    title: "Lyrics Settings", animation: "Animation",
    enableScale: "Scale Effect", enableBlur: "Blur Effect", enableGlow: "Glow Effect", enableStagger: "Stagger Delay",
    fontBold: "Bold Lyrics", content: "Content", showTranslation: "Show Translation", showRomaji: "Show Romaji",
    display: "Display", fontSize: "Font Size", romajiFontSize: "Romaji Size", translationFontSize: "Translation Size",
    alignmentPercentage: "Line Position", animationTiming: "Animation Curve", offset: "Global Offset", offsetUnit: "s",
    lyricSource: "Lyrics Source", reset: "Reset Defaults", auto: "Auto", netease: "Netease", lrc: "File LRC",
    highTop: "Top", center: "Center", smooth: "Smooth", sharp: "Sharp", easeout: "Ease Out", lazy: "Lazy", notSet: "Not Set",
    resetToDefault: "Reset",
  },
};

const SOURCES: { id: LyricsSettingsValues["lyricSource"]; l: { zh: string; en: string } }[] = [
  { id: "auto", l: { zh: "自动", en: "Auto" } },
  { id: "netease", l: { zh: "网易云", en: "Netease" } },
  { id: "lrc", l: { zh: "文件LRC", en: "File LRC" } },
];
const TIMINGS = [
  { id: "smooth" as const, l: { zh: "平滑", en: "Smooth" } }, { id: "sharp" as const, l: { zh: "急促", en: "Sharp" } },
  { id: "easeout" as const, l: { zh: "缓出", en: "Ease Out" } }, { id: "lazy" as const, l: { zh: "温和", en: "Lazy" } },
];
const ALIGNS = [{ v: 30, l: { zh: "居上", en: "Top" } }, { v: 50, l: { zh: "居中", en: "Center" } }];

const sep: React.CSSProperties = { height: 1, background: "var(--border-color)", opacity: 0.5, margin: "2px 0" };
const rowS: React.CSSProperties = { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "4px 0", gap: 12 };
const lblS: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "var(--text-primary)", minWidth: 64, flexShrink: 0 };
const valS: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" as const };

function Sec({ title, children }: { title: string; children: React.ReactNode }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 1 }}>{title}</div>
    {children}
  </div>;
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return <div style={rowS}><span style={lblS}>{label}</span>{children}</div>;
}

// ── Main ──

interface Props { open: boolean; onClose: () => void; values: LyricsSettingsValues; onChange: (v: LyricsSettingsValues) => void; }

const LyricsSettingsPanel: FC<Props> = ({ open, onClose, values, onChange }) => {
  const { lang } = useLanguage();
  const tx = t[lang];
  const set = <K extends keyof LyricsSettingsValues>(k: K, v: LyricsSettingsValues[K]) => onChange({ ...values, [k]: v });
  const fmt = (ms: number) => ms === 0 ? "0" + tx.offsetUnit : (ms > 0 ? "+" : "") + (ms / 1000).toFixed(2) + tx.offsetUnit;

  return (
    <GlassModal open={open} onClose={onClose} maxWidth={360}>
      <div style={{ marginRight: -28, height: "100%", display: "flex", flexDirection: "column", minHeight: 0 }}>
        <GlassScrollArea maxHeight="70vh" fadeEdges>
          <div style={{ paddingRight: 28, display: "flex", flexDirection: "column", gap: 10, paddingTop: 12, paddingBottom: 12 }}>

            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
              <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{tx.title}</h3>
              <GlassPillButton onClick={() => onChange({ ...DEFAULT_LYRICS_SETTINGS })}>{tx.reset}</GlassPillButton>
            </div>
            <div style={sep} />

            <Sec title={tx.content}>
              <Row label={tx.showTranslation}><GlassToggle active={values.showTranslation} onChange={v => set("showTranslation", v)} /></Row>
              <Row label={tx.showRomaji}><GlassToggle active={values.showRomaji} onChange={v => set("showRomaji", v)} /></Row>
              <Row label={tx.fontBold}><GlassToggle active={values.fontBold} onChange={v => set("fontBold", v)} /></Row>
            </Sec>
            <div style={sep} />

            <Sec title={tx.animation}>
              <Row label={tx.enableScale}><GlassToggle active={values.enableScale} onChange={v => set("enableScale", v)} /></Row>
              <Row label={tx.enableBlur}><GlassToggle active={values.enableBlur} onChange={v => set("enableBlur", v)} /></Row>
              <Row label={tx.enableGlow}><GlassToggle active={values.enableGlow} onChange={v => set("enableGlow", v)} /></Row>
              <Row label={tx.enableStagger}><GlassToggle active={values.enableStagger} onChange={v => set("enableStagger", v)} /></Row>
              <Row label={tx.animationTiming}>
                <div style={{ display: "flex", gap: 4 }}>{TIMINGS.map(o => <GlassPillButton key={o.id} active={values.animationTiming === o.id} onClick={() => set("animationTiming", o.id)}>{o.l[lang]}</GlassPillButton>)}</div>
              </Row>
            </Sec>
            <div style={sep} />

            <Sec title={tx.display}>
              <GlassSlider label={tx.fontSize} defaultVal={DEFAULT_LYRICS_SETTINGS.fontSize} display={`${values.fontSize}px`} value={values.fontSize} min={16} max={64} step={1} onChange={v => set("fontSize", v)} />
              <GlassSlider label={tx.romajiFontSize} defaultVal={DEFAULT_LYRICS_SETTINGS.romajiFontSize} display={`${values.romajiFontSize.toFixed(2)}em`} value={values.romajiFontSize} min={0.3} max={1.5} step={0.05} onChange={v => set("romajiFontSize", v)} />
              <GlassSlider label={tx.translationFontSize} defaultVal={DEFAULT_LYRICS_SETTINGS.translationFontSize} display={`${values.translationFontSize.toFixed(2)}em`} value={values.translationFontSize} min={0.3} max={1.5} step={0.05} onChange={v => set("translationFontSize", v)} />

              <Row label={tx.alignmentPercentage}>
                <div style={{ display: "flex", gap: 4 }}>{ALIGNS.map(o => <GlassPillButton key={o.v} active={values.alignmentPercentage === o.v} onClick={() => set("alignmentPercentage", o.v)}>{o.l[lang]}</GlassPillButton>)}</div>
              </Row>

              <div style={{ marginTop: 2 }}>
                <GlassSlider label={tx.offset} display={fmt(values.globalOffset)} value={values.globalOffset} defaultVal={DEFAULT_LYRICS_SETTINGS.globalOffset} min={-10000} max={10000} step={250} onChange={v => set("globalOffset", v)} />
                <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginTop: 4 }}>
                  <GlassPillButton onClick={() => set("globalOffset", Math.max(-10000, values.globalOffset - 250))}>-0.25s</GlassPillButton>
                  <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 40, textAlign: "center" }}>{values.globalOffset !== 0 ? fmt(values.globalOffset) : tx.notSet}</span>
                  <GlassPillButton onClick={() => set("globalOffset", Math.min(10000, values.globalOffset + 250))}>+0.25s</GlassPillButton>
                </div>
              </div>
            </Sec>
            <div style={sep} />

            <Sec title={tx.lyricSource}>
              <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "nowrap", paddingLeft: 6, paddingBottom: 6 }}>{SOURCES.map(o => <GlassPillButton key={o.id} active={values.lyricSource === o.id} onClick={() => set("lyricSource", o.id)}>{o.l[lang]}</GlassPillButton>)}</div>
            </Sec>

          </div>
        </GlassScrollArea>
      </div>
    </GlassModal>
  );
};

export default LyricsSettingsPanel;
