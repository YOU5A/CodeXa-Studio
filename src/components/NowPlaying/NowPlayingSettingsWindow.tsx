/**
 * NowPlayingSettingsWindow — NowPlaying 覆盖层设置面板（右侧固定毛玻璃）
 *
 * 布局：顶部胶囊分类导航 + 单列合并滚动页，分类固定顺序：外观 / 封面 / 背景 / 歌词 / 关于。
 * “当前歌词位置”与“歌词对齐”位于外观分类；流体设置与音乐页共享同一份 localStorage。
 * 玻璃材质与播放列表面板一致；动画从右上角设置齿轮处缩放展开（transformOrigin: top right）。
 * 点击面板外空白处关闭（与播放列表一致）。
 */

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { GlassButton, GlassPillButton, GlassToggle, GlassSlider, GlassScrollArea } from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import { DEFAULT_LYRICS_SETTINGS, LyricsSettingsContent } from "@/lyrics";
import type { LyricsSettingsValues } from "@/lyrics";
import { DEFAULT_FLUID_SETTINGS, FluidSettingsContent, loadFluidSettings, saveFluidSettings, type FluidSettingsValues } from "@/components/FluidSettingsPanel";
import { APP_VERSION } from "@/version";
import { DEFAULT_NOW_PLAYING_SETTINGS } from "./NowPlayingSettings";
import { NOW_PLAYING_FULLSCREEN_FONT_SIZE } from "./NowPlayingSettings";
import type { NowPlayingSettingsValues } from "./NowPlayingSettings";

type SettingsTab = "appearance" | "cover" | "lyrics" | "background" | "about";

interface NowPlayingSettingsWindowProps {
  open: boolean;
  onClose: () => void;
  settings: NowPlayingSettingsValues;
  onChange: (values: NowPlayingSettingsValues) => void;
  lyricsSettings: LyricsSettingsValues;
  onLyricsSettingsChange: (values: LyricsSettingsValues) => void;
  /** 全屏状态下禁用字号/当前歌词位置设置 */
  fullscreen?: boolean;
}

const TABS: { id: SettingsTab; zh: string; en: string }[] = [
  { id: "appearance", zh: "外观", en: "Appearance" },
  { id: "cover", zh: "封面", en: "Cover" },
  { id: "background", zh: "背景", en: "Background" },
  { id: "lyrics", zh: "歌词", en: "Lyrics" },
  { id: "about", zh: "关于", en: "About" },
];

const DISPLAY_OPTIONS: { id: NowPlayingSettingsValues["displayMode"]; zh: string; en: string }[] = [
  { id: "all", zh: "全部", en: "All" },
  { id: "lyric-only", zh: "仅歌词", en: "Lyrics Only" },
  { id: "song-info-only", zh: "仅封面", en: "Cover Only" },
];

const ALIGNMENT_OPTIONS: { v: number; zh: string; en: string }[] = [
  { v: 30, zh: "居上", en: "Top" },
  { v: 50, zh: "居中", en: "Center" },
];

const ALIGN_OPTIONS: { id: NowPlayingSettingsValues["lyricsAlign"]; zh: string; en: string }[] = [
  { id: "left", zh: "左对齐", en: "Left" },
  { id: "center", zh: "居中", en: "Center" },
  { id: "right", zh: "右对齐", en: "Right" },
];

const KARAOKE_OPTIONS: { id: NowPlayingSettingsValues["karaokeAnimation"]; zh: string; en: string }[] = [
  { id: "float", zh: "上浮", en: "Float" },
  { id: "slide", zh: "滑动", en: "Slide" },
];

const BACKGROUND_TYPES: { id: FluidSettingsValues["backgroundType"]; zh: string; en: string }[] = [
  { id: "fluid", zh: "流体", en: "Fluid" },
  { id: "blur", zh: "模糊", en: "Blur" },
  { id: "gradient", zh: "渐变", en: "Gradient" },
  { id: "solid", zh: "纯色", en: "Solid" },
];

const panelS: React.CSSProperties = {
  position: "absolute",
  top: 64,
  right: 24,
  width: 460,
  height: "min(560px, 72vh)",
  maxHeight: "calc(100% - 96px)",
  display: "flex",
  flexDirection: "column",
  borderRadius: 18,
  border: "0.5px solid var(--border-strong)",
  background: "linear-gradient(160deg, rgba(255,255,255,0.10), rgba(255,255,255,0.04))",
  backdropFilter: "blur(24px) saturate(1.5)",
  WebkitBackdropFilter: "blur(24px) saturate(1.5)",
  boxShadow: "0 12px 48px rgba(0,0,0,0.45)",
  overflow: "hidden",
  zIndex: 3,
  transformOrigin: "top right",
  isolation: "isolate",
  willChange: "transform, opacity",
};

const sectionTitleS: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-tertiary)",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  marginBottom: 12,
};

const rowLabelS: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 500,
  color: "var(--text-primary)",
};

const noteS: React.CSSProperties = {
  fontSize: 11,
  color: "var(--text-tertiary)",
  marginTop: 4,
  marginBottom: 12,
};

function SettingRow({ label, children, disabled = false }: { label: string; children: React.ReactNode; disabled?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", gap: 12 }}>
      <span style={disabled ? { ...rowLabelS, color: "var(--text-tertiary)" } : rowLabelS}>{label}</span>
      {children}
    </div>
  );
}

function SettingNote({ children }: { children: React.ReactNode }) {
  return <div style={noteS}>{children}</div>;
}

export default function NowPlayingSettingsWindow({
  open,
  onClose,
  settings,
  onChange,
  lyricsSettings,
  onLyricsSettingsChange,
  fullscreen,
}: NowPlayingSettingsWindowProps) {
  const { lang } = useLanguage();
  const [tab, setTab] = useState<SettingsTab>("appearance");
  const [confirmReset, setConfirmReset] = useState(false);
  const [fluidSettings, setFluidSettings] = useState<FluidSettingsValues>(() => loadFluidSettings());
  const panelRef = useRef<HTMLDivElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const appearanceRef = useRef<HTMLDivElement | null>(null);
  const coverRef = useRef<HTMLDivElement | null>(null);
  const lyricsRef = useRef<HTMLDivElement | null>(null);
  const backgroundRef = useRef<HTMLDivElement | null>(null);
  const aboutRef = useRef<HTMLDivElement | null>(null);
  const scrollPosRef = useRef(0);

  // 流体设置与音乐页共享：外部修改实时同步，本面板修改即保存并广播
  useEffect(() => {
    const handler = () => setFluidSettings(loadFluidSettings());
    window.addEventListener("fluidSettingsChanged", handler);
    return () => window.removeEventListener("fluidSettingsChanged", handler);
  }, []);
  const handleFluidChange = (v: FluidSettingsValues) => {
    setFluidSettings(v);
    saveFluidSettings(v);
  };

  // 点击面板外空白处关闭（与播放列表一致；设置齿轮按钮除外，避免关后立即重开）
  useEffect(() => {
    if (!open) return;
    const handler = (e: PointerEvent) => {
      const target = e.target as Element | null;
      if (!target) return;
      if (target.closest("[data-np-settings-toggle]")) return;
      if (panelRef.current && !panelRef.current.contains(target)) onClose();
    };
    document.addEventListener("pointerdown", handler);
    return () => document.removeEventListener("pointerdown", handler);
  }, [open, onClose]);

  // 记住滚动位置，重新打开时恢复到上次的位置（组件常驻，ref 不随面板卸载丢失）；
  // 同时按区块位置同步顶部导航高亮，手动滚动后导航不再停留在旧区块
  useEffect(() => {
    if (!open) return;
    setConfirmReset(false);
    const el = scrollRef.current;
    if (!el) return;
    const syncTabFromScroll = () => {
      const scroll = scrollRef.current;
      if (!scroll) return;
      const scrollRect = scroll.getBoundingClientRect();
      const sections = [
        { id: "appearance" as const, ref: appearanceRef },
        { id: "cover" as const, ref: coverRef },
        { id: "background" as const, ref: backgroundRef },
        { id: "lyrics" as const, ref: lyricsRef },
        { id: "about" as const, ref: aboutRef },
      ];
      let active: SettingsTab = "appearance";
      for (const s of sections) {
        const node = s.ref.current;
        if (!node) continue;
        // 区块顶部已进入可视区上方（或贴近顶部）时视为当前区块
        if (node.getBoundingClientRect().top - scrollRect.top <= 88) active = s.id;
      }
      setTab((prev) => (prev === active ? prev : active));
    };
    const onScroll = () => {
      scrollPosRef.current = el.scrollTop;
      syncTabFromScroll();
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    el.scrollTop = scrollPosRef.current;
    syncTabFromScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [open]);

  // 恢复默认弹窗打开时，ESC 只关闭弹窗（capture 阶段优先于覆盖层的 ESC 监听）
  useEffect(() => {
    if (!confirmReset) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopImmediatePropagation();
        setConfirmReset(false);
      }
    };
    window.addEventListener("keydown", handler, true);
    return () => window.removeEventListener("keydown", handler, true);
  }, [confirmReset]);

  const T = (zh: string, en: string) => (lang === "zh" ? zh : en);
  const openLink = (url: string) => {
    window.electronAPI?.shell.openExternal(url).catch(() => {});
  };

  // 五个分类：同一合并页内滚动到对应区块
  const sectionRefs: Record<SettingsTab, React.RefObject<HTMLDivElement | null>> = {
    appearance: appearanceRef,
    cover: coverRef,
    lyrics: lyricsRef,
    background: backgroundRef,
    about: aboutRef,
  };
  const handleNav = (id: SettingsTab) => {
    setTab(id);
    requestAnimationFrame(() => {
      const scroll = scrollRef.current;
      const target = sectionRefs[id].current;
      if (scroll && target) {
        const scrollRect = scroll.getBoundingClientRect();
        const targetRect = target.getBoundingClientRect();
        scroll.scrollTop = Math.max(0, scroll.scrollTop + (targetRect.top - scrollRect.top) - 6);
      }
    });
  };

  // 暗化滑块：与音乐页流体设置共享（fluidSettings），始终显示
  const renderDimSlider = (disabled: boolean) => (
    <div style={{ padding: "2px 0 6px" }}>
      <GlassSlider
        label={T("暗化", "Dim")}
        live
        defaultVal={DEFAULT_FLUID_SETTINGS.backgroundDim}
        display={`${fluidSettings.backgroundDim}%`}
        value={fluidSettings.backgroundDim}
        min={0}
        max={100}
        step={1}
        disabled={disabled}
        onChange={(v) => handleFluidChange({ ...fluidSettings, backgroundDim: v })}
      />
    </div>
  );

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="np-settings-window"
          ref={panelRef}
          className="np-settings-window"
          initial={{ scale: 0.55, opacity: 0, y: -16 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.55, opacity: 0, y: -16 }}
          transition={{ type: "tween", duration: 0.26, ease: "easeOut" }}
          style={panelS}
        >
          {/* 头部：标题 + 关闭 */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 16px 10px", flexShrink: 0 }}>
            <span style={{ fontSize: 15, fontWeight: 600, color: "var(--text-primary)" }}>
              {T("NowPlaying 设置", "NowPlaying Settings")}
            </span>
            <GlassButton
              variant="ghost"
              size="sm"
              noAnimation
              aria-label="关闭设置"
              onClick={onClose}
              style={{
                width: 28,
                height: 28,
                minWidth: 28,
                padding: 0,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-secondary)",
              }}
            >
              <X size={15} />
            </GlassButton>
          </div>

          {/* 主体：顶部导航 + 合并页（外观/封面/歌词/背景/关于） */}
          <div style={{ display: "flex", flexDirection: "column", flex: 1, minHeight: 0 }}>
            <div
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: 6,
                padding: "2px 16px 10px",
                borderBottom: "1px solid var(--border-color)",
                flexShrink: 0,
              }}
            >
              {TABS.map((item) => (
                <GlassPillButton
                  key={item.id}
                  active={tab === item.id}
                  onClick={() => handleNav(item.id)}
                  style={{ padding: "4px 12px", fontSize: 12 }}
                >
                  {T(item.zh, item.en)}
                </GlassPillButton>
              ))}
            </div>

            <div style={{ flex: 1, minWidth: 0, minHeight: 0, display: "flex", flexDirection: "column" }}>
              <GlassScrollArea ref={scrollRef} maxHeight="100%" fadeEdges scrollbarGutter={12} style={{ flex: 1 }}>
                <div style={{ padding: "12px 18px 20px 16px" }}>
                  {/* 外观区块 */}
                  <div ref={appearanceRef}>
                    <div style={sectionTitleS}>{T("外观", "Appearance")}</div>
                    <SettingRow label={T("显示", "Display")}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                        {DISPLAY_OPTIONS.map((o) => (
                          <GlassPillButton
                            key={o.id}
                            active={settings.displayMode === o.id}
                            onClick={() => onChange({ ...settings, displayMode: o.id })}
                          >
                            {T(o.zh, o.en)}
                          </GlassPillButton>
                        ))}
                      </div>
                    </SettingRow>
                    <SettingRow label={T("闲置自动隐藏界面元素", "Auto-hide UI when idle")}>
                      <GlassToggle active={settings.idleHide} onChange={(v) => onChange({ ...settings, idleHide: v })} />
                    </SettingRow>
                    <SettingNote>
                      {T("鼠标停止移动 1.5 秒后淡出播放控件（含进度条）与右上角按钮，保留歌曲信息", "Fade out player controls (including the progress bar) and top-right buttons after 1.5s without mouse movement; song info stays visible")}
                    </SettingNote>
                    <SettingRow label={T("隐藏播放控件", "Hide player controls")}>
                      <GlassToggle active={settings.hidePlayerControls} onChange={(v) => onChange({ ...settings, hidePlayerControls: v })} />
                    </SettingRow>
                    <SettingRow label={T("进度条悬停预览", "Progress bar hover preview")}>
                      <GlassToggle active={settings.enableProgressbarPreview} onChange={(v) => onChange({ ...settings, enableProgressbarPreview: v })} />
                    </SettingRow>
                    <SettingNote>{T("鼠标悬停在进度条上时显示对应歌词", "Show the corresponding lyric when hovering over the progress bar")}</SettingNote>

                    {/* 当前歌词位置（全屏时禁用） */}
                    <SettingRow label={T("当前歌词位置", "Current line position")}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {ALIGNMENT_OPTIONS.map((o) => (
                          <GlassPillButton
                            key={o.v}
                            active={lyricsSettings.alignmentPercentage === o.v}
                            disabled={fullscreen}
                            onClick={() => onLyricsSettingsChange({ ...lyricsSettings, alignmentPercentage: o.v })}
                          >
                            {T(o.zh, o.en)}
                          </GlassPillButton>
                        ))}
                      </div>
                    </SettingRow>
                    {/* 歌词对齐 */}
                    <SettingRow label={T("对齐", "Align")}>
                      <div style={{ display: "flex", gap: 4, justifyContent: "flex-end" }}>
                        {ALIGN_OPTIONS.map((o) => (
                          <GlassPillButton
                            key={o.id}
                            active={settings.lyricsAlign === o.id}
                            onClick={() => onChange({ ...settings, lyricsAlign: o.id })}
                          >
                            {T(o.zh, o.en)}
                          </GlassPillButton>
                        ))}
                      </div>
                    </SettingRow>
                  </div>

                  {/* 封面区块 */}
                  <div ref={coverRef} style={{ marginTop: 28 }}>
                    <div style={sectionTitleS}>{T("封面", "Cover")}</div>
                    <SettingRow label={T("方形专辑封面", "Square album cover")}>
                      <GlassToggle active={settings.rectangleCover} onChange={(v) => onChange({ ...settings, rectangleCover: v })} />
                    </SettingRow>
                    <SettingRow label={T("封面弥散阴影", "Blurry cover shadow")}>
                      <GlassToggle active={settings.coverBlurryShadow} onChange={(v) => onChange({ ...settings, coverBlurryShadow: v })} />
                    </SettingRow>
                  </div>

                  {/* 背景区块 */}
                  <div ref={backgroundRef} style={{ marginTop: 28 }}>
                    <div style={sectionTitleS}>{T("背景", "Background")}</div>
                    {/* 背景类型：流体 / 模糊 / 渐变 / 纯色（参考 RNP 背景类型） */}
                    <SettingRow label={T("背景类型", "Background Type")}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                        {BACKGROUND_TYPES.map((o) => (
                          <GlassPillButton
                            key={o.id}
                            active={fluidSettings.backgroundType === o.id}
                            onClick={() => handleFluidChange({ ...fluidSettings, backgroundType: o.id })}
                          >
                            {T(o.zh, o.en)}
                          </GlassPillButton>
                        ))}
                      </div>
                    </SettingRow>
                    {/* 动态流体：流体类型时切换动画/静态单帧；其他类型置灰 */}
                    <SettingRow label={T("动态流体", "Dynamic Fluid")} disabled={fluidSettings.backgroundType !== "fluid"}>
                      <GlassPillButton
                        active={fluidSettings.backgroundType === "fluid" && fluidSettings.dynamicFluid}
                        disabled={fluidSettings.backgroundType !== "fluid"}
                        onClick={() => handleFluidChange({ ...fluidSettings, dynamicFluid: !fluidSettings.dynamicFluid })}
                      >
                        {T(fluidSettings.dynamicFluid ? "开" : "关", fluidSettings.dynamicFluid ? "On" : "Off")}
                      </GlassPillButton>
                    </SettingRow>
                    {/* 帧率/模糊：始终显示，非流体类型置灰禁用；暗化对所有类型可用 */}
                    <FluidSettingsContent
                      values={fluidSettings}
                      onChange={handleFluidChange}
                      disabled={fluidSettings.backgroundType !== "fluid"}
                      beforeBlur={renderDimSlider(false)}
                    />
                  </div>

                  {/* 歌词区块 */}
                  <div ref={lyricsRef} style={{ marginTop: 28 }}>
                    {/* NowPlaying 专属：逐字动画 + 长音发光（置于共享歌词设置上方） */}
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ ...sectionTitleS, color: "var(--text-secondary)" }}>
                        {T("NowPlaying 专属", "NowPlaying Exclusive")}
                      </div>
                      <SettingRow label={T("逐字动画", "Karaoke Animation")}>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4, justifyContent: "flex-end" }}>
                          {KARAOKE_OPTIONS.map((o) => (
                            <GlassPillButton
                              key={o.id}
                              active={settings.karaokeAnimation === o.id}
                              onClick={() => onChange({ ...settings, karaokeAnimation: o.id })}
                            >
                              {T(o.zh, o.en)}
                            </GlassPillButton>
                          ))}
                        </div>
                      </SettingRow>
                      <SettingRow label={T("长音发光动画", "Long-note glow")}>
                        <GlassToggle active={settings.lyricGlow} onChange={(v) => onChange({ ...settings, lyricGlow: v })} />
                      </SettingRow>
                      <SettingNote>{T("在句末长音单词播放时显示发光动画", "Glow animation on trailing long-note words")}</SettingNote>
                    </div>

                    <LyricsSettingsContent
                      values={lyricsSettings}
                      onChange={onLyricsSettingsChange}
                      embedded
                      roomy
                      resetPosition="bottom"
                      onReset={() => setConfirmReset(true)}
                      fontSizeDisabled={fullscreen}
                      hideAlignment
                      fontSizeOverride={{
                        value: fullscreen ? NOW_PLAYING_FULLSCREEN_FONT_SIZE : settings.lyricsFontSize,
                        defaultVal: DEFAULT_NOW_PLAYING_SETTINGS.lyricsFontSize,
                        onChange: (v) => onChange({ ...settings, lyricsFontSize: v }),
                      }}
                    />
                  </div>

                  {/* 关于区块（并入同一页，位于末尾） */}
                  <div ref={aboutRef} style={{ marginTop: 32, display: "flex", flexDirection: "column", alignItems: "flex-end", paddingTop: 4 }}>
                    <div style={{ ...sectionTitleS, marginBottom: 14 }}>{T("关于", "About")}</div>
                    {([
                      { title: T("版本", "Version"), value: APP_VERSION },
                      { title: T("作者", "Author"), value: "YOU5A" },
                      { title: T("许可证", "License"), value: "AGPL-3.0" },
                    ] as { title: string; value: string }[]).map((item) => (
                      <div key={item.title} style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 16 }}>
                        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{item.title}</span>
                        <span style={{ fontSize: 14, color: "var(--text-primary)" }}>{item.value}</span>
                      </div>
                    ))}
                    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                      <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>{T("仓库", "Repository")}</span>
                      <button
                        onClick={() => openLink("https://github.com/YOU5A/CodeXa-Studio")}
                        style={{
                          background: "none",
                          border: "none",
                          padding: 0,
                          cursor: "pointer",
                          fontSize: 14,
                          color: "var(--accent)",
                        }}
                      >
                        github.com/YOU5A/CodeXa-Studio
                      </button>
                    </div>
                  </div>
                </div>
              </GlassScrollArea>
            </div>
          </div>

          {/* 恢复默认的弹窗确认：覆盖整个面板，带淡入/缩放动画 */}
          <AnimatePresence>
            {confirmReset && (
              <motion.div
                key="np-reset-confirm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ type: "tween", duration: 0.18, ease: "easeOut" }}
                style={{
                  position: "absolute",
                  inset: 0,
                  zIndex: 4,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  background: "rgba(0,0,0,0.55)",
                  borderRadius: 18,
                }}
                onClick={() => setConfirmReset(false)}
              >
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.94, y: 6 }}
                  transition={{ type: "tween", duration: 0.22, ease: "easeOut" }}
                  onClick={(e) => e.stopPropagation()}
                  style={{
                    width: "calc(100% - 56px)",
                    maxWidth: 320,
                    borderRadius: 14,
                    border: "1px solid rgba(255,255,255,0.14)",
                    background: "rgba(18,20,28,0.92)",
                    boxShadow: "0 16px 48px rgba(0,0,0,0.45)",
                    padding: "18px 18px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 14,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 600, color: "rgba(255,255,255,0.92)", marginBottom: 4 }}>
                      {T("恢复默认歌词设置？", "Reset lyrics settings?")}
                    </div>
                    <div style={{ fontSize: 12, color: "rgba(255,255,255,0.62)", lineHeight: 1.5 }}>
                      {T("将恢复歌词显示设置与 NowPlaying 歌词字号为默认值", "Restore lyrics display settings and the NowPlaying font size to defaults")}
                    </div>
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                    <GlassButton variant="secondary" size="sm" style={{ color: "rgba(255,255,255,0.9)" }} onClick={() => setConfirmReset(false)}>
                      {T("取消", "Cancel")}
                    </GlassButton>
                    <GlassButton
                      variant="primary"
                      size="sm"
                      onClick={() => {
                        onLyricsSettingsChange({ ...DEFAULT_LYRICS_SETTINGS });
                        onChange({ ...settings, lyricsFontSize: DEFAULT_NOW_PLAYING_SETTINGS.lyricsFontSize });
                        setConfirmReset(false);
                      }}
                    >
                      {T("确认", "Confirm")}
                    </GlassButton>
                  </div>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

      )}
    </AnimatePresence>
  );
}
