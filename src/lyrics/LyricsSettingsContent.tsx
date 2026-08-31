/**
 * LyricsSettingsContent — 歌词显示设置内容（无模态外壳）
 *
 * 供 LyricsSettingsPanel（弹窗）与 NowPlaying 设置面板（嵌入页）共用，
 * 避免同一套控件双份维护。
 *
 * @module lyrics/LyricsSettingsContent
 */

import { type FC } from "react";
import { GlassToggle, GlassPillButton, GlassSlider } from "@/design-system";
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

const lblS: React.CSSProperties = { fontSize: 13, fontWeight: 500, color: "var(--text-primary)", minWidth: 64, flexShrink: 0 };
const valS: React.CSSProperties = { fontSize: 12, color: "var(--text-secondary)", fontVariantNumeric: "tabular-nums", minWidth: 32, textAlign: "right" as const };

function Sec({ title, children, roomy = false }: { title: string; children: React.ReactNode; roomy?: boolean }) {
  return <div style={{ display: "flex", flexDirection: "column", gap: roomy ? 8 : 5 }}>
    <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: roomy ? 5 : 1 }}>{title}</div>
    {children}
  </div>;
}

function Row({ label, children, roomy = false, disabled = false }: { label: string; children: React.ReactNode; roomy?: boolean; disabled?: boolean }) {
  return <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: roomy ? "6px 0" : "4px 0", gap: 12, opacity: disabled ? 0.45 : 1, pointerEvents: disabled ? "none" : undefined }}><span style={lblS}>{label}</span>{children}</div>;
}

interface Props {
  values: LyricsSettingsValues;
  onChange: (v: LyricsSettingsValues) => void;
  /** 嵌入其他容器时隐藏自带标题，仅保留右上角重置按钮 */
  embedded?: boolean;
  /** 渲染在“当前歌词位置”行之后的可选内容（NowPlaying 对齐选项使用；悬浮窗不传则不渲染） */
  footer?: React.ReactNode;
  /** 放大各元素上下间隔（NowPlaying 合并设置页使用；默认保持原紧凑间距） */
  roomy?: boolean;
  /** 重置按钮位置：默认 "top"（嵌入页右上角 / 弹窗标题行）；"bottom" 移到页面末尾 */
  resetPosition?: "top" | "bottom";
  /** 自定义“恢复默认”点击行为（NowPlaying 面板内确认使用）；不传则直接恢复默认 */
  onReset?: () => void;
  /** NowPlaying 专属字号：传此对象时字号滑块改控制它，不写入共享歌词设置；defaultVal 为滑块重置基准 */
  fontSizeOverride?: { value: number; defaultVal: number; onChange: (v: number) => void };
  /** 覆盖翻译字号滑块的恢复基准（NowPlaying 默认值与共享歌词设置不同） */
  translationFontSizeDefault?: number;
  /** 全屏时禁用字体大小滑块（置灰不可调） */
  fontSizeDisabled?: boolean;
  /** 全屏时禁用当前歌词位置（置灰不可调） */
  alignmentDisabled?: boolean;
  /** 隐藏“当前歌词位置”行（NowPlaying 设置面板已移至外观分类；悬浮窗不传保持现状） */
  hideAlignment?: boolean;
}

const LyricsSettingsContent: FC<Props> = ({ values, onChange, embedded = false, footer, roomy = false, resetPosition = "top", onReset, fontSizeOverride, translationFontSizeDefault, fontSizeDisabled = false, alignmentDisabled = false, hideAlignment = false }) => {
  const { lang } = useLanguage();
  const tx = t[lang];
  const resetAtBottom = resetPosition === "bottom";
  const sep: React.CSSProperties = { height: 1, background: "var(--border-color)", opacity: 0.5, margin: roomy ? "5px 0" : "2px 0" };
  const set = <K extends keyof LyricsSettingsValues>(k: K, v: LyricsSettingsValues[K]) => onChange({ ...values, [k]: v });
  const fmt = (ms: number) => ms === 0 ? "0" + tx.offsetUnit : (ms > 0 ? "+" : "") + (ms / 1000).toFixed(2) + tx.offsetUnit;
  const shownFontSize = fontSizeOverride?.value ?? values.fontSize;
  const handleReset = () => {
    if (onReset) onReset();
    else onChange({ ...DEFAULT_LYRICS_SETTINGS });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: roomy ? 12 : 10, paddingTop: embedded ? 0 : 12, paddingBottom: 12 }}>
      {embedded ? (
        !resetAtBottom && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
            <GlassPillButton onClick={handleReset}>{tx.reset}</GlassPillButton>
          </div>
        )
      ) : (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
          <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>{tx.title}</h3>
          {!resetAtBottom && (
            <GlassPillButton onClick={handleReset}>{tx.reset}</GlassPillButton>
          )}
        </div>
      )}
      <div style={sep} />

      <Sec title={tx.content} roomy={roomy}>
        <Row label={tx.showTranslation} roomy={roomy}><GlassToggle active={values.showTranslation} onChange={v => set("showTranslation", v)} /></Row>
        <Row label={tx.showRomaji} roomy={roomy}><GlassToggle active={values.showRomaji} onChange={v => set("showRomaji", v)} /></Row>
        <Row label={tx.fontBold} roomy={roomy}><GlassToggle active={values.fontBold} onChange={v => set("fontBold", v)} /></Row>
      </Sec>
      <div style={sep} />

      <Sec title={tx.animation} roomy={roomy}>
        <Row label={tx.enableScale} roomy={roomy}><GlassToggle active={values.enableScale} onChange={v => set("enableScale", v)} /></Row>
        <Row label={tx.enableBlur} roomy={roomy}><GlassToggle active={values.enableBlur} onChange={v => set("enableBlur", v)} /></Row>
        <Row label={tx.enableGlow} roomy={roomy}><GlassToggle active={values.enableGlow} onChange={v => set("enableGlow", v)} /></Row>
        <Row label={tx.enableStagger} roomy={roomy}><GlassToggle active={values.enableStagger} onChange={v => set("enableStagger", v)} /></Row>
        <Row label={tx.animationTiming} roomy={roomy}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>{TIMINGS.map(o => <GlassPillButton key={o.id} active={values.animationTiming === o.id} onClick={() => set("animationTiming", o.id)}>{o.l[lang]}</GlassPillButton>)}</div>
        </Row>
      </Sec>
      <div style={sep} />

      <Sec title={tx.display} roomy={roomy}>
        <GlassSlider label={tx.fontSize} live defaultVal={fontSizeOverride ? fontSizeOverride.defaultVal : DEFAULT_LYRICS_SETTINGS.fontSize} display={`${shownFontSize}px`} value={shownFontSize} min={16} max={64} step={1} disabled={fontSizeDisabled} onChange={fontSizeOverride ? fontSizeOverride.onChange : (v) => set("fontSize", v)} />
        <GlassSlider label={tx.romajiFontSize} live defaultVal={DEFAULT_LYRICS_SETTINGS.romajiFontSize} display={`${values.romajiFontSize.toFixed(2)}em`} value={values.romajiFontSize} min={0.3} max={1.5} step={0.05} onChange={v => set("romajiFontSize", v)} />
        <GlassSlider label={tx.translationFontSize} live defaultVal={translationFontSizeDefault ?? DEFAULT_LYRICS_SETTINGS.translationFontSize} display={`${values.translationFontSize.toFixed(2)}em`} value={values.translationFontSize} min={0.3} max={1.5} step={0.05} onChange={v => set("translationFontSize", v)} />

        {!hideAlignment && (
        <Row label={tx.alignmentPercentage} roomy={roomy} disabled={alignmentDisabled}>
          <div style={{ display: "flex", gap: 4 }}>{ALIGNS.map(o => <GlassPillButton key={o.v} active={values.alignmentPercentage === o.v} onClick={() => set("alignmentPercentage", o.v)}>{o.l[lang]}</GlassPillButton>)}</div>
        </Row>
        )}

        {footer}

        <div style={{ marginTop: roomy ? 6 : 2 }}>
          <GlassSlider label={tx.offset} live display={fmt(values.globalOffset)} value={values.globalOffset} defaultVal={DEFAULT_LYRICS_SETTINGS.globalOffset} min={-10000} max={10000} step={250} onChange={v => set("globalOffset", v)} />
          <div style={{ display: "flex", alignItems: "center", gap: 4, justifyContent: "center", marginTop: roomy ? 6 : 4 }}>
            <GlassPillButton onClick={() => set("globalOffset", Math.max(-10000, values.globalOffset - 250))}>-0.25s</GlassPillButton>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)", minWidth: 40, textAlign: "center" }}>{values.globalOffset !== 0 ? fmt(values.globalOffset) : tx.notSet}</span>
            <GlassPillButton onClick={() => set("globalOffset", Math.min(10000, values.globalOffset + 250))}>+0.25s</GlassPillButton>
          </div>
        </div>
      </Sec>
      <div style={sep} />

      <Row label={tx.lyricSource} roomy={roomy}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>{SOURCES.map(o => <GlassPillButton key={o.id} active={values.lyricSource === o.id} onClick={() => set("lyricSource", o.id)}>{o.l[lang]}</GlassPillButton>)}</div>
      </Row>
      {resetAtBottom && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end" }}>
          <GlassPillButton onClick={handleReset}>{tx.reset}</GlassPillButton>
        </div>
      )}
    </div>
  );
};

export default LyricsSettingsContent;
