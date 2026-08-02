/**
 * LyricDisplay — Core lyrics display with flow-based layout
 *
 * 流式布局版：所有歌词行按普通文档流排列在 wrapper 内，行高由浏览器计算，
 * 天然支持换行/字号/子层变化；通过 wrapper 整体 translateY 实现当前行定位与切换动画。
 * 每行的缩放/模糊/透明度只作为纯视觉 transform，不参与布局计算。
 *
 * @module lyrics/LyricDisplay
 */

import { useRef, useMemo, useLayoutEffect, useState, useCallback, useEffect } from "react";
import type { LyricData, LyricsSettingsValues } from "./types";
import { DEFAULT_LYRICS_SETTINGS } from "./types";
import LyricBlock, { scaleByOffset, blurByOffset, opacityByOffset } from "./LyricBlock";
import Scrollbar from "./Scrollbar";
import LyricOverview from "./LyricOverview";

import { GlassGlow } from "@/design-system/components";
import { softenColorForGlow } from "@/utils/colorExtractor";

// ── Props ──

export interface LyricDisplayProps {
  lyricData: LyricData | null;
  currentTime: number;
  currentLineIndex: number;
  getCurrentTime?: () => number;
  seekCounter?: number;
  playState?: boolean;
  pageOpen?: boolean;
  loading?: boolean;
  error?: string | null;
  loadingText?: string;
  noLyricsText?: string;
  instrumentalText?: string;
  onLineClick?: (time: number) => void;
  settings?: LyricsSettingsValues;
  scrollingMode?: boolean;
  scrollingFocusLine?: number;
  scrollbar?: boolean;
  overview?: boolean;
  onSeek?: (time: number) => void;
  /** 歌词对齐（NowPlaying 专属配置；默认居中，悬浮歌词窗不传则保持原行为） */
  textAlign?: "left" | "center" | "right";
  /** 行间距倍率（相对字号，默认 1.2，保持原有布局） */
  lineSpacing?: number;
  /** 固定行间距（像素）：传值时行距直接用该像素值，不随字号动画缩放（NowPlaying 使用） */
  lineGapPx?: number;
  /** 每行悬停光晕圆角（默认跟随窗口圆角 var(--radius)） */
  glowBorderRadius?: number | string;
  /** NowPlaying 专属：逐字歌词开关（默认 undefined，悬浮歌词窗保持现状） */
  useKaraokeLyrics?: boolean;
  /** NowPlaying 专属：逐字动画类型 */
  karaokeAnimation?: "float" | "slide";
  /** NowPlaying 专属：长音发光动画 */
  lyricGlow?: boolean;
}

// ── Component ──

// 字号 JS 插值动画时长（与子层展开动画 300ms 区分）
const FONT_ANIM_MS = 250;
const SUB_ANIM_MS = 300;

export default function LyricDisplay({
  lyricData, currentTime, currentLineIndex, getCurrentTime,
  seekCounter = 0, playState = true, pageOpen = true,
  loading, error, loadingText, noLyricsText, instrumentalText,
  onLineClick, settings = DEFAULT_LYRICS_SETTINGS,
  scrollingMode = false, scrollingFocusLine = 0,
  scrollbar = false, overview = false, onSeek,
  textAlign = "center", lineSpacing = 1.2, lineGapPx,
  glowBorderRadius = "var(--radius)",
  useKaraokeLyrics, karaokeAnimation, lyricGlow,
}: LyricDisplayProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [containerHeight, setContainerHeight] = useState(0);
  const [containerWidth, setContainerWidth] = useState(0);
  const containerHeightRef = useRef(0);

  // Opacity gate: keep lyrics hidden until container height is measured.
  // Prevents visible flash of wrong centering on first paint.
  const [isVisible, setIsVisible] = useState(false);

  // 是否允许下一帧播放位移动画：切歌/改设置/容器尺寸变化时置 false，
  // 让新位置在 paint 前一次性生效，避免“跳帧 + 错位”。
  const shouldTransit = useRef(false);
  const previousFocusedLineRef = useRef(0);

  // 流式栈位置：wrapper 的 translateY
  const [stackOffset, setStackOffset] = useState(0);
  const [suppressStackTransition, setSuppressStackTransition] = useState(true);
  // 容器尺寸变化计数：即使尺寸数值未变（如 DevTools 停靠切换），也强制重渲染一次，
  // 让栈定位 effect 及时消费并复位 shouldTransit，避免抑制标记卡住导致下一次跳行无动画
  const [resizeTick, setResizeTick] = useState(0);
  // 切换抑制窗口：容器尺寸变化（全屏/窗口缩放）时短暂禁用字号/边距过渡，
  // 让歌词一步到位，避免字号过渡 + 逐帧居中叠加造成“上下乱弹”
  const [switchReset, setSwitchReset] = useState(false);
  const switchResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [coverGlowColor, setCoverGlowColor] = useState<string | null>(null);
  const [coverGlowRgb, setCoverGlowRgb] = useState<string | null>(null);
  const [dynamicGlowRgb, setDynamicGlowRgb] = useState<string[] | null>(null);

  // ── Data ──

  const allLines = useMemo(() => {
    return lyricData?.lines ?? [];
  }, [lyricData]);

  // 布局/设置变化键：任一影响行高、位置或对齐的设置变化都会触发重新定位
  // 字号变化键：三个字号走 JS 驱动插值动画（LyricBlock 通过 CSS 变量引用）
  const fontKey = [
    settings.fontSize, settings.romajiFontSize, settings.translationFontSize,
  ].join("|");

  // 布局/设置变化键：任一影响行高、位置或对齐的非字号设置变化都会触发重新定位
  const layoutKey = [
    settings.showTranslation, settings.showRomaji, settings.fontBold,
    settings.alignmentPercentage, lineSpacing, lineGapPx, textAlign, scrollbar, overview,
    useKaraokeLyrics, karaokeAnimation,
  ].join("|");

  // 仅切歌时抑制一次过渡：新歌词直接到位；其余设置/布局变化一律走平滑位移动画
  const prevLyricDataRef = useRef<LyricData | null>(null);
  // 字号变化跟踪：JS 插值动画期间（约 250ms）栈要同帧跟随布局，不用 0.5s 过渡追赶
  const prevFontKeyRef = useRef(fontKey);
  const fontChangedAtRef = useRef(0);
  const fontChanged = prevFontKeyRef.current !== fontKey;
  if (fontChanged) {
    prevFontKeyRef.current = fontKey;
    fontChangedAtRef.current = Date.now();
  }

  // 布局/设置变化跟踪：开关/对齐等变化期间栈即时跟随（无 0.5s 过渡追赶）
  const prevLayoutKeyRef = useRef(layoutKey);
  const layoutChangedAtRef = useRef(0);
  const layoutChanged = prevLayoutKeyRef.current !== layoutKey;
  if (layoutChanged) {
    prevLayoutKeyRef.current = layoutKey;
    layoutChangedAtRef.current = Date.now();
  }
  if (prevLyricDataRef.current !== lyricData) {
    prevLyricDataRef.current = lyricData;
    layoutChangedAtRef.current = Date.now();
    fontChangedAtRef.current = Date.now();
    shouldTransit.current = false;
  }


  // 切歌淡入：数据从无到有/切换时用 WAAPI 淡入新歌词（不受 React 状态时序影响）
  const songFadeAnimRef = useRef<Animation | null>(null);
  const prevSongFadeRef = useRef(lyricData);
  useEffect(() => {
    if (prevSongFadeRef.current === lyricData) return;
    prevSongFadeRef.current = lyricData;
    if (!lyricData) return; // 加载/无歌词状态不参与淡入
    const el = containerRef.current;
    if (!el) return;
    songFadeAnimRef.current?.cancel();
    songFadeAnimRef.current = el.animate(
      [{ opacity: 0 }, { opacity: 1 }],
      { duration: 300, easing: "ease" }
    );
    return () => songFadeAnimRef.current?.cancel();
  }, [lyricData]);

  // 字号动画当前值（初始 = 设置目标；动画期间逐帧更新）
  const fontCurrentRef = useRef<[number, number, number]>([
    settings.fontSize, settings.romajiFontSize, settings.translationFontSize,
  ]);
  const fontMountedRef = useRef(false);
  const fontAnimRef = useRef<{
    raf: number;
    from: [number, number, number];
    to: [number, number, number];
    start: number;
    activeLineAtStart: number;
  } | null>(null);


  // ── Resize tracking ──

  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measure = () => {
      if (!containerRef.current) return;
      const h = containerRef.current.clientHeight;
      containerHeightRef.current = h;
      setContainerHeight(h);
      setContainerWidth(containerRef.current.clientWidth);
      if (h > 0) setIsVisible(true);
    };
    measure();
    const ro = new ResizeObserver(() => {
      shouldTransit.current = false;
      measure();
      setResizeTick((t) => t + 1);
      // 容器尺寸变化也是布局变化：窗口缩放/全屏期间同样让栈即时跟随，避免 0.5s 过渡追赶
      layoutChangedAtRef.current = Date.now();
      // 切换抑制窗口：350ms 内字号/边距直接到位，不做平滑过渡
      setSwitchReset(true);
      if (switchResetTimerRef.current) clearTimeout(switchResetTimerRef.current);
      switchResetTimerRef.current = setTimeout(() => setSwitchReset(false), 350);
    });
    ro.observe(el);
    return () => ro.disconnect();
    // 歌词数据异步加载：首帧容器可能不存在，allLines 变化后重新挂载监听
  }, [allLines]);

  useEffect(() => {
    const handler = (e: Event) => {
      const color = (e as CustomEvent).detail as [number, number, number] | null;
      if (color) {
        const softened = softenColorForGlow(color);
        setCoverGlowColor("rgb(" + softened[0] + "," + softened[1] + "," + softened[2] + ")");
        setCoverGlowRgb(softened[0] + "," + softened[1] + "," + softened[2]);
      } else {
        setCoverGlowColor(null);
        setCoverGlowRgb(null);
      }
      // 封面切换时清空旧动态色，确保 effectiveGlowRgb 立即回退到当前封面色
      setDynamicGlowRgb(null);
    };
    const cached = localStorage.getItem("fluidCoverColor");
    if (cached) {
      try {
        const c = JSON.parse(cached) as [number, number, number];
        const softened = softenColorForGlow(c);
        setCoverGlowColor("rgb(" + softened[0] + "," + softened[1] + "," + softened[2] + ")");
        setCoverGlowRgb(softened[0] + "," + softened[1] + "," + softened[2]);
      } catch {}
    }
    window.addEventListener("fluidCoverColorChanged", handler);
    return () => window.removeEventListener("fluidCoverColorChanged", handler);
  }, []);

  // Dynamic fluid color -> glow (top 3 blob colors)
  useEffect(() => {
    const handler = (e: Event) => {
      const colors = (e as CustomEvent).detail as [number, number, number][] | null;
      if (colors && colors.length > 0) {
        setDynamicGlowRgb(colors.map(c => {
          const s = softenColorForGlow(c);
          return s[0] + "," + s[1] + "," + s[2];
        }));
      } else {
        setDynamicGlowRgb(null);
      }
    };
    const cached = localStorage.getItem("fluidDynamicColor");
    if (cached) {
      try {
        const arr = JSON.parse(cached) as [number, number, number][];
        if (Array.isArray(arr) && arr.length > 0) {
          setDynamicGlowRgb(arr.map(c => {
            const s = softenColorForGlow(c);
            return s[0] + "," + s[1] + "," + s[2];
          }));
        }
      } catch {}
    }
    window.addEventListener("fluidDynamicColorChanged", handler);
    return () => window.removeEventListener("fluidDynamicColorChanged", handler);
  }, []);


  const focusLine = scrollingMode ? scrollingFocusLine : currentLineIndex;

  // ── Effective glow RGB based on fluid color mode ──
  const effectiveGlowRgb = useMemo(() => {
    let cm = null;
    try {
      const raw = localStorage.getItem("fluidSettings");
      if (raw) cm = JSON.parse(raw).colorMode;
    } catch {}
    // cover / auto: cover color first (most reliable, avoids stale dynamicGlowRgb)
    if (coverGlowRgb && (cm === "cover" || cm === "auto")) return coverGlowRgb;
    // dynamic / auto fallback: Canvas blob sampled colors
    if (dynamicGlowRgb && dynamicGlowRgb.length > 0 && (cm === "dynamic" || cm === "auto")) return dynamicGlowRgb[0];
    // universal fallback
    if (coverGlowRgb) return coverGlowRgb;
    return null;
  }, [coverGlowRgb, dynamicGlowRgb]);

  const effectiveGlowColor = effectiveGlowRgb ? "rgb(" + effectiveGlowRgb + ")" : null;

  // Adaptive GlassGlow color based on effective glow RGB (softened = whitened pastel)
  const glassGlowColor = effectiveGlowRgb
    ? "rgba(" + effectiveGlowRgb + ", 0.18)"
    : "rgba(255,255,255,0.15)";

  // Secondary / tertiary glow RGB (from dynamic multi-color sampling)
  const effectiveGlowRgb2 = dynamicGlowRgb && dynamicGlowRgb.length > 1 ? dynamicGlowRgb[1] : effectiveGlowRgb;
  const effectiveGlowRgb3 = dynamicGlowRgb && dynamicGlowRgb.length > 2 ? dynamicGlowRgb[2] : effectiveGlowRgb;

  // ── Manual scroll state ──

  const [isManual, setIsManual] = useState(false);
  const [manualLine, setManualLine] = useState(0);
  const [manualExitTick, setManualExitTick] = useState(0); // 退出手动后强制栈重新定位
  const isManualRef = useRef(false);
  const manualTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 像素级自由滚动：手动期间 translateY 由滚轮/惯性直接控制
  const stackOffsetRef = useRef(0); // 当前栈位置镜像，进入手动时作为起点
  const manualOffsetRef = useRef(0); // 手动滚动期间的 translateY（像素）
  const wheelVelRef = useRef(0); // 滚轮速度（px/ms，平滑滤波）
  const lastWheelTimeRef = useRef(0);
  const coastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null); // 惯性启动延迟
  const coastRafRef = useRef(0); // 惯性 rAF
  const allLinesRef = useRef(allLines);
  const alignmentPctRef = useRef(settings.alignmentPercentage);
  const manualLineRef = useRef(0); // manualLine 镜像，避免滚动中重复 setState
  const lineCentersRef = useRef<number[]>([]); // 各行中心缓存（不逐帧读 DOM 布局）
  stackOffsetRef.current = stackOffset;
  allLinesRef.current = allLines;
  alignmentPctRef.current = settings.alignmentPercentage;
  manualLineRef.current = manualLine;

  // 刷新各行中心缓存（字号/翻译/换行/切歌导致行几何变化时调用）
  const refreshLineCenters = useCallback(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const centers: number[] = [];
    for (let i = 0; i < wrapper.children.length; i++) {
      const el = wrapper.children[i] as HTMLElement;
      centers.push(el.offsetTop + el.offsetHeight / 2);
    }
    lineCentersRef.current = centers;
  }, []);

  // 当前聚焦行（含手动滚动/外部滚动模式）
  const activeLine = scrollingMode ? scrollingFocusLine : (isManual ? manualLine : focusLine);
  const activeLineRef = useRef(activeLine);
  activeLineRef.current = activeLine;

  // ── 子层展开/收起（翻译/音译开关，JS 驱动）──
  // CSS 过渡的插值在帧管线中晚于 rAF/强制布局，无法被 wrapper 位移同帧跟随；
  // 改为逐帧设置每行子层高度/透明度/边距 CSS 变量（--lyric-trans-h/o/m-{id} 等），
  // 几何即时生效，再同帧读取并直写 transform，当前行保持严格居中。
  const transShowRef = useRef(settings.showTranslation);
  transShowRef.current = settings.showTranslation;
  const romaShowRef = useRef(settings.showRomaji);
  romaShowRef.current = settings.showRomaji;
  const subProgressRef = useRef({ trans: settings.showTranslation ? 1 : 0, roma: settings.showRomaji ? 1 : 0 });
  const subLayoutMountedRef = useRef(false);
  const subMountedRef = useRef(false);
  const subAnimRef = useRef<{ raf: number; start: number; activeLineAtStart: number } | null>(null);

  const applySubHeights = (tp: number, rp: number) => {
    const w = wrapperRef.current;
    if (!w) return;
    const fs = fontCurrentRef.current[0];
    for (let i = 0; i < w.children.length; i++) {
      const row = w.children[i] as HTMLElement;
      const trans = row.querySelector(".lyric-block-translated") as HTMLElement | null;
      if (trans) {
        const inner = trans.firstElementChild as HTMLElement;
        const h = inner.scrollHeight;
        w.style.setProperty(`--lyric-trans-h-${i}`, `${h * tp}px`);
        w.style.setProperty(`--lyric-trans-o-${i}`, String(tp));
        // 默认 margin 是相对子层字号的 0.3em（如 19px×0.3=5.7px），须用子层字号计算
        w.style.setProperty(`--lyric-trans-m-${i}`, `${fs * fontCurrentRef.current[2] * 0.3 * tp}px`);
      }
      const roma = row.querySelector(".lyric-block-romaji") as HTMLElement | null;
      if (roma) {
        const inner = roma.firstElementChild as HTMLElement;
        const h = inner.scrollHeight;
        w.style.setProperty(`--lyric-roma-h-${i}`, `${h * rp}px`);
        w.style.setProperty(`--lyric-roma-o-${i}`, String(rp));
        w.style.setProperty(`--lyric-roma-m-${i}`, `${fs * fontCurrentRef.current[1] * 0.4 * rp}px`);
      }
    }
  };

  const clearSubVars = () => {
    const w = wrapperRef.current;
    if (!w) return;
    for (let i = 0; i < w.children.length; i++) {
      for (const n of ["trans-h", "trans-o", "trans-m", "roma-h", "roma-o", "roma-m"]) {
        w.style.removeProperty(`--lyric-${n}-${i}`);
      }
    }
  };

  // 布局变化提交后、paint 前用当前进度覆盖 React 默认值，
  // 保证 stack effect 读取到的几何与动画起点一致（无先跳变再动画）
  useLayoutEffect(() => {
    if (!subLayoutMountedRef.current) { subLayoutMountedRef.current = true; return; }
    const sp = subProgressRef.current;
    applySubHeights(sp.trans, sp.roma);
  }, [layoutKey]);


  // ── Per-line visuals (pure visual transform, no layout participation) ──

  const lineVisuals = useMemo(() => {
    const jump = Math.abs(focusLine - previousFocusedLineRef.current);
    const delayByOffset = (offset: number) => {
      if (scrollingMode) return 0;
      if (!settings.enableStagger) return 0;
      // Only stagger on manual jumps (>1 line), not during normal auto-advance
      if (!shouldTransit.current || jump <= 1) return 0;
      return Math.min(Math.abs(offset) * 80, 400);
    };
    const sByOffset = (offset: number) => {
      // 手动滚动/惯性阶段先禁用缩放，回归自动后按设置恢复
      if (!settings.enableScale || isManual) return 1;
      return scaleByOffset(offset);
    };
    const bByOffset = (offset: number) => {
      if (!settings.enableBlur || isManual || scrollingMode) return 0;
      return blurByOffset(offset);
    };
    const oByOffset = (offset: number) => {
      return opacityByOffset(offset);
    };

    const list: Array<{ scale: number; blur: number; opacity: number; delay: number }> = [];
    for (let i = 0; i < allLines.length; i++) {
      const offset = i - activeLine;
      list.push({
        scale: sByOffset(offset),
        blur: bByOffset(offset),
        opacity: oByOffset(offset),
        delay: delayByOffset(offset),
      });
    }
    previousFocusedLineRef.current = focusLine;
    return list;
  }, [
    allLines, focusLine, activeLine,
    settings.enableScale, settings.enableBlur, settings.enableStagger,
    scrollingMode, isManual,
  ]);

  // ── Stack positioning (flow-based) ──

  useLayoutEffect(() => {
    // 先消费并复位过渡抑制标记：即使下面提前返回，也不会把“无动画”状态遗留到下一次跳行
    // 布局变化信号用 ref 时间戳（并发渲染中断不会丢失），变化后 100ms 内抑制位移动画
    const suppress = !shouldTransit.current || Date.now() - layoutChangedAtRef.current < 100;
    shouldTransit.current = true;
    // 手动自由滚动/惯性期间位置由滚轮直接控制，不参与自动居中
    if (isManualRef.current) return;
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper || !allLines.length) return;
    const idx = Math.min(Math.max(activeLine, 0), allLines.length - 1);
    // wrapper 的直接子元素即各行 GlassGlow（文档流顺序 = 行顺序）
    const lineEl = wrapper.children[idx] as HTMLElement | undefined;
    if (!lineEl) return;
    const h = containerHeightRef.current || container.clientHeight;
    if (h <= 0) return;
    const next = h * (settings.alignmentPercentage * 0.01) - lineEl.offsetTop - lineEl.offsetHeight / 2;
    setStackOffset(next);
    setSuppressStackTransition(suppress);
    setIsVisible(true);
  }, [
    allLines, activeLine, containerHeight, containerWidth,
    layoutKey, resizeTick, manualExitTick,
  ]);

  // ── 对齐方式切换的水平滑入动画（FLIP）──
  // 每行宽度不同，居中/左/右切换时各行水平位移不同，无法用统一 transform 表达，
  // 因此在切换前记录各行旧位置，切换后用 WAAPI 从旧位置平滑滑到新位置。
  const prevAlignRef = useRef<"left" | "center" | "right">(textAlign);
  const prevLineRectsRef = useRef<number[]>([]);
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const newRects: number[] = [];
    for (let i = 0; i < wrapper.children.length; i++) {
      newRects.push((wrapper.children[i] as HTMLElement).getBoundingClientRect().left);
    }
    const changed = prevAlignRef.current !== textAlign;
    if (changed && prevLineRectsRef.current.length === newRects.length) {
      for (let i = 0; i < newRects.length; i++) {
        const el = wrapper.children[i] as HTMLElement;
        const delta = prevLineRectsRef.current[i] - newRects[i];
        if (Math.abs(delta) < 0.5) continue;
        const s = lineVisuals[i]?.scale ?? 1;
        el.animate(
          [
            { transform: `translateX(${delta}px) scale(${s})` },
            { transform: `translateX(0px) scale(${s})` },
          ],
          {
            duration: 320,
            easing: "cubic-bezier(0.22, 0.61, 0.36, 1)",
            fill: "none",
          }
        );
      }
    }
    prevAlignRef.current = textAlign;
    prevLineRectsRef.current = newRects;
  }, [allLines, textAlign, containerWidth, lineVisuals]);

  // ── 歌词栈自身尺寸变化跟踪（字号过渡/换行/子层显隐等）──
  // 字号过渡期间行高是逐帧变化的，栈定位 effect 只跑一次不够；
  // 用 wrapper 的 ResizeObserver 在每一帧高度变化时重新计算居中位置；
  // 字号过渡中即时跟随（无自身过渡），其余高度变化保持平滑滑动。
  const recenterRef = useRef<() => number | null>(() => null);
  recenterRef.current = () => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper || !allLines.length) return null;
    const idx = Math.min(Math.max(activeLine, 0), allLines.length - 1);
    const lineEl = wrapper.children[idx] as HTMLElement | undefined;
    if (!lineEl) return null;
    const h = containerHeightRef.current || container.clientHeight;
    if (h <= 0) return null;
    return h * (settings.alignmentPercentage * 0.01) - lineEl.offsetTop - lineEl.offsetHeight / 2;
  };
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => {
      refreshLineCenters(); // 字号过渡/换行期间同步刷新行中心缓存
      if (isManualRef.current) return; // 手动滚动期间保持当前像素位置
      // 字号/子层动画期间由各自的 rAF 循环独占定位，RO 的滞后值会覆盖同帧直写
      if (fontAnimRef.current || subAnimRef.current) return;
      const next = recenterRef.current();
      if (next !== null) {
        const suppress =
          Date.now() - layoutChangedAtRef.current < 400 ||
          Date.now() - fontChangedAtRef.current < 400;
        setStackOffset(next);
        setSuppressStackTransition(suppress);
      }
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
    // 歌词数据异步加载：首帧 wrapper 可能不存在，allLines 变化后重新挂载监听
  }, [allLines]);

  // ── 字号 JS 插值动画（从当前行向上下缩放）──
  // 三个字号通过 --lyric-font-size / --lyric-romaji-scale / --lyric-trans-scale 驱动，
  // 每帧先写变量再强制读取几何并直接写 transform，保证 paint 前当前行严格居中。

  const setFontVars = useCallback((font: number, roma: number, trans: number) => {
    const w = wrapperRef.current;
    if (!w) return;
    w.style.setProperty("--lyric-font-size", font + "px");
    w.style.setProperty("--lyric-romaji-scale", String(roma));
    w.style.setProperty("--lyric-trans-scale", String(trans));
  }, []);

  // 字号目标变化：启动/重定向插值动画
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const to: [number, number, number] = [settings.fontSize, settings.romajiFontSize, settings.translationFontSize];
    // 首次挂载/无实际变化：直接写目标值
    if (!fontMountedRef.current) {
      setFontVars(to[0], to[1], to[2]);
      fontCurrentRef.current = [...to];
      return;
    }
    // 手动滚动/惯性期间：字号直接到位，transform 由手动路径接管
    if (isManualRef.current) {
      setFontVars(to[0], to[1], to[2]);
      fontCurrentRef.current = [...to];
      return;
    }
    const prev = fontAnimRef.current;
    const from: [number, number, number] = prev ? [...fontCurrentRef.current] : [...fontCurrentRef.current];
    if (prev) cancelAnimationFrame(prev.raf);
    const anim = { raf: 0, from, to, start: performance.now(), activeLineAtStart: activeLine };
    fontAnimRef.current = anim;
    const tick = (now: number) => {
      if (fontAnimRef.current !== anim) return;
      // 手动接管或播放切行：立即收敛字号，交还正常定位流程
      // 手动接管时立即收敛；播放切行不打断动画（recenter 基于最新 activeLine 自动跟随）
      if (isManualRef.current) {
        setFontVars(anim.to[0], anim.to[1], anim.to[2]);
        fontCurrentRef.current = [...anim.to];
        if (fontAnimRef.current === anim) fontAnimRef.current = null;
        return;
      }
      // rAF 时间戳是帧开始时间，可能早于 effect 内的 performance.now()，需夹取非负
      const p = Math.min(1, Math.max(0, now - anim.start) / FONT_ANIM_MS);
      const e = 1 - Math.pow(1 - p, 3);
      const v0 = anim.from[0] + (anim.to[0] - anim.from[0]) * e;
      const v1 = anim.from[1] + (anim.to[1] - anim.from[1]) * e;
      const v2 = anim.from[2] + (anim.to[2] - anim.from[2]) * e;
      fontCurrentRef.current = [v0, v1, v2];
      const w = wrapperRef.current;
      if (w) {
        w.style.setProperty("--lyric-font-size", v0 + "px");
        w.style.setProperty("--lyric-romaji-scale", String(v1));
        w.style.setProperty("--lyric-trans-scale", String(v2));
        // 强制布局（offsetTop 读取）后同帧居中：几何与位移在 paint 前一致
        recenterRef.current(); // 首次读取强制布局（变量刚写入）
        const next = recenterRef.current(); // 二次读取拿到稳定几何
        if (next !== null) {
          w.style.transform = `translateY(${next}px)`;
          stackOffsetRef.current = next;
          setStackOffset(next);
          setSuppressStackTransition(true);
        }
      }
      if (p >= 1) {
        if (fontAnimRef.current === anim) fontAnimRef.current = null;
        return;
      }
      anim.raf = requestAnimationFrame(tick);
    };
    anim.raf = requestAnimationFrame(tick);
    return () => {
      if (fontAnimRef.current === anim) {
        cancelAnimationFrame(anim.raf);
        fontAnimRef.current = null;
      }
    };
    // fontChanged 仅用于区分“首次/无变化”与“真实变化”，不参与依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  // 切歌：字号动画立即收敛到目标，避免在旧歌词几何下继续插值
  useEffect(() => {
    const anim = fontAnimRef.current;
    if (anim) {
      cancelAnimationFrame(anim.raf);
      fontAnimRef.current = null;
    }
    setFontVars(settings.fontSize, settings.romajiFontSize, settings.translationFontSize);
    fontCurrentRef.current = [settings.fontSize, settings.romajiFontSize, settings.translationFontSize];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricData]);


  // ── 子层展开/收起动画循环（翻译/音译开关）──
  // 逐帧插值子层高度/透明度/边距（applySubHeights）并同帧重定位，
  // 当前行保持居中；连续切换开关时从当前进度重定向。
  useEffect(() => {
    // 首次挂载/非开关类布局变化时不启动动画
    if (!subMountedRef.current) { subMountedRef.current = true; return; }
    const prev = subAnimRef.current;
    if (prev) cancelAnimationFrame(prev.raf);
    const anim = { raf: 0, start: performance.now(), activeLineAtStart: activeLine };
    subAnimRef.current = anim;
    const tick = (now: number) => {
      if (subAnimRef.current !== anim) return;
      // 手动接管时直接收敛；播放切行不打断动画（recenter 基于最新 activeLine 自动跟随）
      if (isManualRef.current) {
        const tT = transShowRef.current ? 1 : 0;
        const rT = romaShowRef.current ? 1 : 0;
        subProgressRef.current = { trans: tT, roma: rT };
        clearSubVars();
        if (subAnimRef.current === anim) subAnimRef.current = null;
        return;
      }
      const p = Math.min(1, Math.max(0, now - anim.start) / SUB_ANIM_MS);
      const e = 1 - Math.pow(1 - p, 3);
      const sp = subProgressRef.current;
      const tTarget = transShowRef.current ? 1 : 0;
      const rTarget = romaShowRef.current ? 1 : 0;
      const tp = sp.trans + (tTarget - sp.trans) * e;
      const rp = sp.roma + (rTarget - sp.roma) * e;
      subProgressRef.current = { trans: tp, roma: rp };
      applySubHeights(tp, rp);
      const w = wrapperRef.current;
      recenterRef.current(); // 首次读取强制布局（变量刚写入）
      const next = recenterRef.current(); // 二次读取拿到稳定几何
      if (w && next !== null) {
        w.style.transform = `translateY(${next}px)`;
        stackOffsetRef.current = next;
        setStackOffset(next);
        setSuppressStackTransition(true);
      }
      const done = Math.abs(tp - tTarget) < 0.001 && Math.abs(rp - rTarget) < 0.001;
      if (done || p >= 1) {
        clearSubVars();
        subProgressRef.current = { trans: tTarget, roma: rTarget };
        if (subAnimRef.current === anim) subAnimRef.current = null;
        return;
      }
      anim.raf = requestAnimationFrame(tick);
    };
    anim.raf = requestAnimationFrame(tick);
    return () => {
      if (subAnimRef.current === anim) {
        cancelAnimationFrame(anim.raf);
        subAnimRef.current = null;
      }
    };
    // layoutChanged 仅用于区分首次挂载与真实变化，不参与依赖
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layoutKey]);



  // ── Scrolling mode via wheel ──
  // 手动滚轮：像素级自由滚动 + 惯性缓停 + 吸附到最近行

  const getAlignmentY = () => (containerHeightRef.current || 0) * (alignmentPctRef.current * 0.01);

  // 手动滚动允许的 translateY 范围：首行/末行都能被对齐到当前歌词位置
  const getScrollBounds = () => {
    const centers = lineCentersRef.current;
    const h = containerHeightRef.current || 0;
    if (centers.length === 0 || h <= 0) return { min: 0, max: 0 };
    const ay = getAlignmentY();
    return {
      min: ay - centers[centers.length - 1],
      max: ay - centers[0],
    };
  };

  const clampManualOffset = (v: number) => {
    const { min, max } = getScrollBounds();
    return Math.min(max, Math.max(min, v));
  };

  // 距离当前歌词位置最近的（非间奏）行
  const nearestManualLine = (offset: number) => {
    const centers = lineCentersRef.current;
    if (centers.length === 0) return 0;
    const ay = getAlignmentY();
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < centers.length; i++) {
      if (allLinesRef.current[i]?.isInterlude) continue;
      const d = Math.abs(centers[i] + offset - ay);
      if (d < bestDist) {
        bestDist = d;
        best = i;
      }
    }
    return best;
  };

  // 让指定行居中对齐所需的 translateY
  const lineCenterOffset = (idx: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper || idx < 0 || idx >= wrapper.children.length) return null;
    const el = wrapper.children[idx] as HTMLElement;
    return getAlignmentY() - el.offsetTop - el.offsetHeight / 2;
  };

  // 直接写 DOM 变换：滚动/惯性期间逐帧更新不经过 React 渲染，避免卡顿
  const applyManualOffset = (offset: number) => {
    manualOffsetRef.current = offset;
    const wrapper = wrapperRef.current;
    if (wrapper) wrapper.style.transform = `translateY(${offset}px)`;
  };

  const exitManual = useCallback(() => {
    if (coastTimerRef.current) {
      clearTimeout(coastTimerRef.current);
      coastTimerRef.current = null;
    }
    if (coastRafRef.current) {
      cancelAnimationFrame(coastRafRef.current);
      coastRafRef.current = 0;
    }
    if (manualTimer.current) {
      clearTimeout(manualTimer.current);
      manualTimer.current = null;
    }
    wheelVelRef.current = 0;
    isManualRef.current = false;
    setIsManual(false);
    // 强制栈 effect 重新定位（即使手动行恰好等于自动行，也要按新容器尺寸居中）
    setManualExitTick((t) => t + 1);
  }, []);

  // 惯性结束：吸附到最近的非间奏行（柔和过渡），并重新开始 3s 自动回归
  const snapManual = useCallback(() => {
    if (!isManualRef.current) return;
    const idx = nearestManualLine(manualOffsetRef.current);
    const target = lineCenterOffset(idx);
    if (target === null) return;
    manualOffsetRef.current = target;
    setStackOffset(target);
    setSuppressStackTransition(false);
    setManualLine(idx);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(exitManual, 3000);
  }, [exitManual]);

  // 停止滚动约 120ms 后进入惯性阶段：速度逐帧衰减，趋近 0 时吸附
  const startCoast = useCallback(() => {
    if (coastRafRef.current) cancelAnimationFrame(coastRafRef.current);
    let last = performance.now();
    const step = () => {
      coastRafRef.current = 0;
      if (!isManualRef.current) return;
      const now = performance.now();
      const dt = Math.min(32, now - last);
      last = now;
      wheelVelRef.current *= Math.pow(0.85, dt / 16.667);
      const before = manualOffsetRef.current;
      const next = clampManualOffset(before - wheelVelRef.current * dt);
      applyManualOffset(next); // 直接写 DOM，不走 React 渲染
      const nearest = nearestManualLine(next);
      if (nearest !== manualLineRef.current) setManualLine(nearest);
      const stopped = Math.abs(wheelVelRef.current) < 0.04;
      const hitBound = next === before && Math.abs(wheelVelRef.current) > 0.05;
      if (stopped || hitBound) {
        snapManual();
        return;
      }
      coastRafRef.current = requestAnimationFrame(step);
    };
    coastRafRef.current = requestAnimationFrame(step);
  }, [snapManual]);

  // 滚动条拖动：直接跳到指定行（不参与惯性）
  const jumpToManualLine = useCallback((idx: number) => {
    if (coastTimerRef.current) {
      clearTimeout(coastTimerRef.current);
      coastTimerRef.current = null;
    }
    if (coastRafRef.current) {
      cancelAnimationFrame(coastRafRef.current);
      coastRafRef.current = 0;
    }
    isManualRef.current = true;
    setIsManual(true);
    const target = lineCenterOffset(idx);
    manualOffsetRef.current = target ?? manualOffsetRef.current;
    setStackOffset(target ?? stackOffsetRef.current);
    setSuppressStackTransition(true);
    setManualLine(idx);
    if (manualTimer.current) clearTimeout(manualTimer.current);
    manualTimer.current = setTimeout(exitManual, 3000);
  }, [exitManual]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const hw = (e: WheelEvent) => {
      e.preventDefault();
      if (e.deltaY === 0) return;
      const now = performance.now();
      if (!isManualRef.current) {
        // 进入手动模式：以当前自动位置为起点，开始自由滚动
        isManualRef.current = true;
        setIsManual(true);
        manualOffsetRef.current = stackOffsetRef.current;
        refreshLineCenters(); // 滚动前确保行中心缓存是最新的
        setManualLine(nearestManualLine(manualOffsetRef.current));
        wheelVelRef.current = 0;
      }
      const dt = now - lastWheelTimeRef.current;
      const centers = lineCentersRef.current;
      const linePitch = centers.length > 1
        ? (centers[centers.length - 1] - centers[0]) / (centers.length - 1)
        : 40;
      // 用滚动方向相邻行的实际中心间距作为“一行”的步长，避免行高不均时跨不过去
      const dir = e.deltaY > 0 ? 1 : -1;
      const nearestNow = nearestManualLine(manualOffsetRef.current);
      let localPitch = linePitch;
      if (nearestNow >= 0 && nearestNow < centers.length) {
        const neighbor = Math.min(centers.length - 1, Math.max(0, nearestNow + dir));
        const p = Math.abs(centers[neighbor] - centers[nearestNow]);
        if (p > 0) localPitch = p;
      }
      // 滚轮行模式（deltaMode=1）按本地行距换算成像素；像素模式保持原样
      let raw = e.deltaMode === 1 ? e.deltaY * localPitch : e.deltaY;
      // 单次档位位移过小（如系统“滚动 2 行”或极小像素档）时补偿到至少一行：
      // 保证滚一下就能切到下一句，避免小位移被吸附“拉回”造成卡顿/锁顶
      if (dt > 20 && Math.abs(raw) < localPitch * 0.7) {
        raw = dir * localPitch;
      }
      if (dt > 0 && dt < 120) {
        wheelVelRef.current = wheelVelRef.current * 0.7 + (raw / dt) * 0.3;
      } else {
        wheelVelRef.current = raw / Math.max(dt, 16);
      }
      lastWheelTimeRef.current = now;
      const next = clampManualOffset(manualOffsetRef.current - raw);
      // B 方案：慢速离散档位（间隔 >150ms）带 0.35s 平滑过渡；快速连续滚动直接跟手
      if (dt > 150) {
        manualOffsetRef.current = next;
        setStackOffset(next);
        setSuppressStackTransition(false);
      } else {
        applyManualOffset(next);
        setSuppressStackTransition(true);
      }
      const nearest = nearestManualLine(manualOffsetRef.current);
      if (nearest !== manualLineRef.current) setManualLine(nearest);
      // 重新计时：惯性（120ms 无滚轮）与 3s 自动回归
      if (coastTimerRef.current) clearTimeout(coastTimerRef.current);
      coastTimerRef.current = setTimeout(startCoast, 120);
      if (manualTimer.current) clearTimeout(manualTimer.current);
      manualTimer.current = setTimeout(exitManual, 3000);
    };
    el.addEventListener("wheel", hw, { passive: false });
    return () => el.removeEventListener("wheel", hw);
  }, [exitManual, startCoast]);

  // 自动跳行（播放推进/seek）时立即退出手动模式，恢复模糊/缩放
  useEffect(() => {
    if (isManualRef.current) exitManual();
  }, [currentLineIndex, exitManual]);

  // 容器尺寸变化（全屏切换/窗口缩放）时退出手动模式：
  // 旧的手动像素偏移在新尺寸下会错位，退回自动居中并强制重新定位
  useEffect(() => {
    if (isManualRef.current) exitManual();
  }, [containerHeight, containerWidth, exitManual]);

  // 歌词行几何变化（切歌/字号/翻译/换行等）时刷新行中心缓存
  useLayoutEffect(() => {
    refreshLineCenters();
  }, [allLines, layoutKey, refreshLineCenters]);

  useLayoutEffect(() => {
    return () => {
      if (manualTimer.current) clearTimeout(manualTimer.current);
      if (coastTimerRef.current) clearTimeout(coastTimerRef.current);
      if (coastRafRef.current) cancelAnimationFrame(coastRafRef.current);
      if (switchResetTimerRef.current) clearTimeout(switchResetTimerRef.current);
    };
  }, []);

  // Animation timing CSS variable
  const timingMap: Record<string, string> = {
    smooth: "ease",
    sharp: "cubic-bezier(0.22, 0.61, 0.36, 1)",
    easeout: "cubic-bezier(0, 0, 0.58, 1)",
    lazy: "cubic-bezier(0.45, 0, 0.75, 0.35)",
  };

  // Container class for centering/bold
  const containerClass =
    "lyric-display-container" +
    (scrollingMode ? " scrolling" : "") +
    (settings.fontBold ? " font-bold" : "") +
    (switchReset ? " lyric-switch-reset" : "");

  // ── Render: loading / error / empty states ──

  const cs: React.CSSProperties = {
    height: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    padding: "0 16px",
  };
  if (loading)
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{loadingText || "加载中..."}</span>
      </div>
    );
  if (error)
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{error}</span>
      </div>
    );
  if (!lyricData || !allLines.length)
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{noLyricsText || "暂无歌词"}</span>
      </div>
    );
  if (!allLines.some((l) => (l.originalLyric || l.text || "").trim()))
    return (
      <div style={cs}>
        <span style={{ fontSize: 13, color: "var(--text-tertiary)" }}>{instrumentalText || "纯音乐，请欣赏"}</span>
      </div>
    );

  // ── Main render ──

  return (
    <>
      {/* Global keyframe styles */}
      <style>{`
        @keyframes interlude-dot-breathe {
          0%   { transform: scale(0.9); opacity: 0.25; }
          50%  { transform: scale(1.08); opacity: 0.5; }
          100% { transform: scale(0.9); opacity: 0.25; }
        }
        .interlude-inner {
          opacity: 1;
        }
        .interlude-dot {
          display: inline-block;
          width: 0.5em;
          height: 0.5em;
          aspect-ratio: 1 / 1;
          border-radius: 50%;
        }
        .interlude-dot:not(:last-child) {
          margin-right: 0.5em;
        }
        .lyric-display-container .lyric-scrollbar {
          opacity: 0;
          transition: opacity 0.25s ease;
        }
        .lyric-display-container:hover .lyric-scrollbar,
        .lyric-scrollbar.dragging {
          opacity: 1;
        }
        /* 全屏/窗口缩放切换抑制：字号/边距直接到位，只保留颜色/发光平滑 */
        .lyric-display-container.lyric-switch-reset .lyric-block-original,
        .lyric-display-container.lyric-switch-reset .lyric-block-romaji,
        .lyric-display-container.lyric-switch-reset .lyric-block-translated,
        .lyric-display-container.lyric-switch-reset .lyric-interlude-line {
          /* !important：覆盖内联 transition 简写，否则抑制不生效 */
          transition-property: color, text-shadow !important;
        }
      `}</style>

      <div
        ref={containerRef}
        className={containerClass}
        style={{
          height: "100%",
          position: "relative",
          opacity: isVisible ? 1 : 0,
          transition: "opacity 0.3s ease",
          textAlign,
          overflow: "hidden",
          contain: "layout style",
          ["--lyric-timing-function" as string]: timingMap[settings.animationTiming] || "ease",
          ["--lyric-glow" as string]: effectiveGlowColor || "var(--accent)",
          ["--lyric-glow-rgb" as string]: effectiveGlowRgb || "var(--accent-rgb)",
          ["--lyric-glow-rgb-2" as string]: effectiveGlowRgb2 || "var(--accent-rgb)",
          ["--lyric-glow-rgb-3" as string]: effectiveGlowRgb3 || "var(--accent-rgb)",
        }}
      >
        {/* 流式栈：行高由浏览器计算，整体 translateY 负责当前行定位与切换动画 */}
        <div
          ref={wrapperRef}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: textAlign === "left" ? "flex-start" : textAlign === "right" ? "flex-end" : "center",
            // 行距优先使用固定像素值（NowPlaying 传 lineGapPx，不随字号动画缩放）；
            // 未传时按字号倍率计算（悬浮歌词窗默认路径保持原行为）
            gap: lineGapPx != null ? `${lineGapPx}px` : "calc(var(--lyric-font-size, 20px) * var(--lyric-line-spacing, 1.2))",
            ["--lyric-line-spacing" as string]: String(lineSpacing),
            // 预留概览/滚动条区域：保留区在 wrapper 内，行居中/对齐不受其影响
            paddingRight: overview ? 200 : scrollbar ? 20 : 0,
            // 手动滚动期间 transform 由滚轮/惯性直接写 DOM（manualOffsetRef 为同步镜像），
            // React 重渲染时写入当前值，避免覆盖滚动中的实时位置
            // 用 ref 镜像渲染：动画循环直写 transform 后，即使 React state 尚未刷新，渲染也不会回写旧值
            transform: isManual ? `translateY(${manualOffsetRef.current}px)` : `translateY(${stackOffsetRef.current}px)`,
            transition: suppressStackTransition
              ? "none"
              : `transform ${isManual ? "0.35s cubic-bezier(0.22, 0.61, 0.36, 1)" : "0.5s var(--lyric-timing-function, ease)"}`,
            willChange: "transform",
          }}
        >
          {allLines.map((line, i) => {
            const v = lineVisuals[i];
            if (!v) return null;

            const isCurrent = i === activeLine;
            const ds = v.delay ? ` ${v.delay}ms` : "";

            return (
              <GlassGlow
                key={i}
                glowColor={glassGlowColor}
                glowRadius={350}
                borderRadius={glowBorderRadius}
                style={{
                  maxWidth: "calc(100% - 40px)",
                  // 悬停光晕上下放大（左右保持 8px 不变）
                  padding: "6px 8px 5px 8px",
                  marginLeft: textAlign === "left" ? 8 : undefined,
                  marginRight: textAlign === "right" ? (scrollbar ? 28 : 8) : undefined,
                  transform: `scale(${v.scale})`,
                  filter: v.blur > 0.5 ? `blur(${v.blur}px)` : "none",
                  opacity: v.opacity,
                  transition: [
                    `transform ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                    `filter ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                    `opacity ${isManual ? "0.12s" : "0.5s"} var(--lyric-timing-function, ease)${ds}`,
                  ].join(", "),
                  willChange: Math.abs(i - activeLine) <= 3 ? "transform" : "auto",
                  transformOrigin: textAlign === "left" ? "left center" : textAlign === "right" ? "right center" : "center",
                }}
              >
                <div data-lyric-index={i}>
                  <LyricBlock
                    line={line}
                    offset={i - activeLine}
                    isCurrent={isCurrent}
                    currentTime={currentTime}
                    id={i}
                    getCurrentTime={getCurrentTime}
                    seekCounter={seekCounter}
                    playState={playState}
                    pageOpen={pageOpen}
                    onClick={onLineClick}
                    settings={settings}
                    useKaraokeLyrics={useKaraokeLyrics}
                    karaokeAnimation={karaokeAnimation}
                    lyricGlow={lyricGlow}
                  />
                </div>
              </GlassGlow>
            );
          })}
        </div>

        {/* 歌词概览（可选） */}
        {overview && (
          <LyricOverview
            lines={allLines}
            currentLineIndex={activeLine}
            onJump={onSeek ?? onLineClick}
            noLyricsText={noLyricsText}
          />
        )}

        {/* 右侧滚动条（可选） */}
        {scrollbar && (
          <Scrollbar
            lines={allLines}
            currentLineIndex={activeLine}
            containerHeight={containerHeight}
            onFocusLine={jumpToManualLine}
          />
        )}
      </div>
    </>
  );
}
