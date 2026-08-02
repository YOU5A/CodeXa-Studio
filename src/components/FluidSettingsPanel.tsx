/**
 * FluidSettingsPanel — 流体背景设置面板
 * 使用 GlassModal 承载，控制 FluidBackground 各项参数。
 *
 * FluidSettingsContent 为控件体（无模态外壳），供 MusicManager 弹窗与
 * NowPlaying 设置面板（背景分类）共用，避免同一套控件双份维护。
 */

import type { FC } from "react";
import { GlassModal, GlassPillButton, GlassSlider } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import type { Language } from "@/types";

// ── 类型 ──

export interface FluidSettingsValues {
  /** 帧率：30 / 60 / 0 = 无限 */
  fps: 30 | 60 | 0;
  /** 模糊程度 0.6-1.0（最小锁死 60%） */
  blurAmount: number;
  /** 背景类型（复制自 NowPlaying 背景设置）：流体 / 模糊 / 渐变 / 纯色 */
  backgroundType: "fluid" | "blur" | "gradient" | "solid";
  /** 动态流体：流体类型时是否启用动画（关 = 静态单帧） */
  dynamicFluid: boolean;
  /** 背景暗化 0-100 */
  backgroundDim: number;
}

export const DEFAULT_FLUID_SETTINGS: FluidSettingsValues = {
  fps: 60,
  blurAmount: 0.8,
  backgroundType: "fluid",
  dynamicFluid: true,
  backgroundDim: 50,
};

const FLUID_SETTINGS_KEY = "fluidSettings";

/** 模糊最小值（锁死 60%，滑块不可低于此值） */
const BLUR_MIN = 0.6;

export function loadFluidSettings(): FluidSettingsValues {
  try {
    const raw = localStorage.getItem(FLUID_SETTINGS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<FluidSettingsValues> & { colorMode?: string };
      // 显式取用当前字段，丢弃旧版已删除字段（enabled/style/intensity/speedMultiplier/colorMode）
      // 旧版数据迁移：老形状含 colorMode 且 blurAmount 可能是 0，直接整体回退默认值
      if (parsed.colorMode !== undefined) {
        return { ...DEFAULT_FLUID_SETTINGS };
      }
      return {
        fps: parsed.fps ?? DEFAULT_FLUID_SETTINGS.fps,
        // 越界值（如旧版写入的 0）视为脏数据，回退默认 0.8
        blurAmount: parsed.blurAmount != null && parsed.blurAmount >= BLUR_MIN && parsed.blurAmount <= 1
          ? parsed.blurAmount
          : DEFAULT_FLUID_SETTINGS.blurAmount,
        backgroundType: parsed.backgroundType ?? DEFAULT_FLUID_SETTINGS.backgroundType,
        dynamicFluid: parsed.dynamicFluid ?? DEFAULT_FLUID_SETTINGS.dynamicFluid,
        backgroundDim: parsed.backgroundDim ?? DEFAULT_FLUID_SETTINGS.backgroundDim,
      };
    }
  } catch {
    console.warn("[FluidSettings] Configuration load failed, using defaults");
  }
  return { ...DEFAULT_FLUID_SETTINGS };
}

export function saveFluidSettings(values: FluidSettingsValues): void {
  try {
    const next = JSON.stringify(values);
    // 仅在值真正变化时写入并广播，避免“保存→事件→监听器回写新对象→effect 再保存”的反馈死循环
    if (localStorage.getItem(FLUID_SETTINGS_KEY) !== next) {
      localStorage.setItem(FLUID_SETTINGS_KEY, next);
      window.dispatchEvent(new CustomEvent("fluidSettingsChanged"));
    }
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

// ── 帧率选项 ──

const FPS_OPTIONS: { v: FluidSettingsValues["fps"]; label: { zh: string; en: string } }[] = [
  { v: 30, label: { zh: "30 FPS", en: "30 FPS" } },
  { v: 60, label: { zh: "60 FPS", en: "60 FPS" } },
  { v: 0, label: { zh: "无限", en: "Unlimited" } },
];

// ── 样式常量 ──

const BACKGROUND_TYPES: { id: FluidSettingsValues["backgroundType"]; label: { zh: string; en: string } }[] = [
  { id: "fluid", label: { zh: "流体", en: "Fluid" } },
  { id: "blur", label: { zh: "模糊", en: "Blur" } },
  { id: "gradient", label: { zh: "渐变", en: "Gradient" } },
  { id: "solid", label: { zh: "纯色", en: "Solid" } },
];

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
    frameRate: "帧率",
    blur: "模糊",
    reset: "恢复默认",
    resetTitle: "恢复默认设置",
    background: "背景",
    backgroundType: "背景类型",
    dynamicFluid: "动态流体",
    dim: "暗化",
    on: "开",
    off: "关",
  },
  en: {
    title: "Fluid Background",
    frameRate: "Frame Rate",
    blur: "Blur",
    reset: "Reset Defaults",
    resetTitle: "Reset to default settings",
    background: "Background",
    backgroundType: "Background Type",
    dynamicFluid: "Dynamic Fluid",
    dim: "Dim",
    on: "On",
    off: "Off",
  },
};

// ── Content component（无模态外壳，NowPlaying 设置面板复用） ──

export interface FluidSettingsContentProps {
  values: FluidSettingsValues;
  onChange: (values: FluidSettingsValues) => void;
  /** 禁用全部控件（NowPlaying 非流体背景类型时置灰；音乐页弹窗不传保持可用） */
  disabled?: boolean;
  /** 渲染在“帧率分隔线”与“模糊”之间的可选内容（NowPlaying 暗化滑块使用；音乐页弹窗不传则不渲染） */
  beforeBlur?: React.ReactNode;
}

export const FluidSettingsContent: FC<FluidSettingsContentProps> = ({ values, onChange, beforeBlur, disabled = false }) => {
  const { lang } = useLanguage();
  const tx = t[lang];
  const set = <K extends keyof FluidSettingsValues>(key: K, value: FluidSettingsValues[K]) => {
    onChange({ ...values, [key]: value });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
      {/* ── 帧率 ── */}
      <div style={rowStyle}>
        <div>
          <div style={{ ...labelStyle, opacity: disabled ? 0.4 : 1 }}>{tx.frameRate}</div>
        </div>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {FPS_OPTIONS.map((opt) => (
            <GlassPillButton
              key={opt.v}
              active={!disabled && values.fps === opt.v}
              disabled={disabled}
              onClick={() => set("fps", opt.v)}
            >
              {opt.label[lang]}
            </GlassPillButton>
          ))}
        </div>
      </div>

      <div style={separatorStyle} />

      {beforeBlur}
      {/* ── 模糊 ── */}
      <div style={sectionStyle}>
        <GlassSlider
          label={tx.blur}
          display={Math.round(values.blurAmount * 100) + "%"}
          value={values.blurAmount}
          defaultVal={DEFAULT_FLUID_SETTINGS.blurAmount}
          min={BLUR_MIN}
          max={1.0}
          step={0.05}
          disabled={disabled}
          onChange={(v) => set("blurAmount", v)}
        />
      </div>
    </div>
  );
};

// ── Panel（模态外壳，音乐页使用） ──

const FluidSettingsPanel: FC<FluidSettingsPanelProps> = ({ open, onClose, values, onChange }) => {
  const { lang } = useLanguage();
  const tx = t[lang];

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

        {/* 背景区块（复制自 NowPlaying 背景设置） */}
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-tertiary)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
            {tx.background}
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>{tx.backgroundType}</div>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
              {BACKGROUND_TYPES.map((o) => (
                <GlassPillButton
                  key={o.id}
                  active={values.backgroundType === o.id}
                  onClick={() => onChange({ ...values, backgroundType: o.id })}
                >
                  {o.label[lang]}
                </GlassPillButton>
              ))}
            </div>
          </div>
          <div style={rowStyle}>
            <div>
              <div style={labelStyle}>{tx.dynamicFluid}</div>
            </div>
            <GlassPillButton
              active={values.backgroundType === "fluid" && values.dynamicFluid}
              disabled={values.backgroundType !== "fluid"}
              onClick={() => onChange({ ...values, dynamicFluid: !values.dynamicFluid })}
            >
              {values.dynamicFluid ? tx.on : tx.off}
            </GlassPillButton>
          </div>
        </div>

        <FluidSettingsContent
          values={values}
          onChange={onChange}
          disabled={values.backgroundType !== "fluid"}
          beforeBlur={
            <div style={{ padding: "2px 0 6px" }}>
              <GlassSlider
                label={tx.dim}
                live
                defaultVal={DEFAULT_FLUID_SETTINGS.backgroundDim}
                display={`${values.backgroundDim}%`}
                value={values.backgroundDim}
                min={0}
                max={100}
                step={1}
                onChange={(v) => onChange({ ...values, backgroundDim: v })}
              />
            </div>
          }
        />
      </div>
    </GlassModal>
  );
};

export default FluidSettingsPanel;
