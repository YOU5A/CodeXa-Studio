/**
 * LyricDisplay — Core lyrics display with flow-based layout
 *
 * 流式布局版：所有歌词行按普通文档流排列在 wrapper 内，行高由浏览器计算，
 * 天然支持换行/字号/子层变化；通过 wrapper 整体 translateY 实现当前行定位与切换动画。
 * 每行的缩放/模糊/透明度只作为纯视觉 transform，不参与布局计算。
 *
 * @module lyrics/LyricDisplay
 */

import { memo, useRef, useMemo, useLayoutEffect, useState, useCallback, useEffect } from "react";
import type { LyricData, LyricLine, LyricsSettingsValues } from "./types";
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

// 字号/子层过渡时长：与缩放效果同一套 0.5s + --lyric-timing-function（纯 CSS 过渡）
const SUB_ANIM_MS = 500;

// 每次滚轮事件最大位移（行数倍率，保底 120px）：超快滚动也不会一次跨过多行
const MAX_WHEEL_STEP_LINES = 1.5;
const MAX_WHEEL_STEP_PX = 120;
// 滚轮/惯性最大速度（px/ms）：限制甩动后的总滑行距离
const MAX_WHEEL_VELOCITY = 2.0;

// ── LyricRow：单行渲染（memo）──
// 换行时只有视觉属性变化的行（当前行附近）重渲染，远处行跳过，
// 避免快速连续换行时整棵歌词树重渲染导致主线程卡顿；
// currentTime/offset 不参与比较：逐字/发光动画通过 getCurrentTime 实时读取，offset 仅调试属性
interface LyricRowProps {
  line: LyricLine;
  index: number;
  offset: number;
  isCurrent: boolean;
  scale: number;
  blur: number;
  opacity: number;
  delay: number;
  currentTime: number;
  getCurrentTime?: () => number;
  seekCounter: number;
  playState: boolean;
  pageOpen: boolean;
  onClick?: (time: number) => void;
  settings: LyricsSettingsValues;
  useKaraokeLyrics?: boolean;
  karaokeAnimation?: "float" | "slide";
  lyricGlow?: boolean;
  glassGlowColor: string;
  glowBorderRadius: number | string;
  textAlign: "left" | "center" | "right";
  scrollbar: boolean;
  isManual: boolean;
}

function LyricRow({
  line, index, offset, isCurrent, scale, blur, opacity, delay,
  currentTime, getCurrentTime, seekCounter, playState, pageOpen, onClick,
  settings, useKaraokeLyrics, karaokeAnimation, lyricGlow,
  glassGlowColor, glowBorderRadius, textAlign, scrollbar, isManual,
}: LyricRowProps) {
  const ds = delay ? ` ${delay}ms` : "";
  const lineAnimDuration = isManual ? "0.12s" : "0.5s";
  return (
    <GlassGlow
      glowColor={glassGlowColor}
      glowRadius={350}
      borderRadius={glowBorderRadius}
      style={{
        maxWidth: "calc(100% - 40px)",
        padding: "6px 8px 5px 8px",
        marginLeft: textAlign === "left" ? 8 : undefined,
        marginRight: textAlign === "right" ? (scrollbar ? 28 : 8) : undefined,
        transform: `scale(${scale})`,
        filter: blur > 0.5 ? `blur(${blur}px)` : "none",
        opacity,
        transition: [
          `transform ${lineAnimDuration} var(--lyric-timing-function, ease)${ds}`,
          `opacity ${lineAnimDuration} var(--lyric-timing-function, ease)${ds}`,
        ].join(", "),
        willChange: Math.abs(offset) <= 3 ? "transform" : "auto",
        transformOrigin: textAlign === "left" ? "left center" : textAlign === "right" ? "right center" : "center",
      }}
    >
      <div data-lyric-index={index}>
        <LyricBlock
          line={line}
          offset={offset}
          isCurrent={isCurrent}
          currentTime={currentTime}
          id={index}
          getCurrentTime={getCurrentTime}
          seekCounter={seekCounter}
          playState={playState}
          pageOpen={pageOpen}
          onClick={onClick}
          settings={settings}
          useKaraokeLyrics={useKaraokeLyrics}
          karaokeAnimation={karaokeAnimation}
          lyricGlow={lyricGlow}
        />
      </div>
    </GlassGlow>
  );
}

function lyricRowPropsEqual(prev: LyricRowProps, next: LyricRowProps): boolean {
  return (
    prev.line === next.line &&
    prev.index === next.index &&
    prev.isCurrent === next.isCurrent &&
    prev.scale === next.scale &&
    prev.blur === next.blur &&
    prev.opacity === next.opacity &&
    prev.delay === next.delay &&
    prev.getCurrentTime === next.getCurrentTime &&
    prev.seekCounter === next.seekCounter &&
    prev.playState === next.playState &&
    prev.pageOpen === next.pageOpen &&
    prev.onClick === next.onClick &&
    prev.settings === next.settings &&
    prev.useKaraokeLyrics === next.useKaraokeLyrics &&
    prev.karaokeAnimation === next.karaokeAnimation &&
    prev.lyricGlow === next.lyricGlow &&
    prev.glassGlowColor === next.glassGlowColor &&
    prev.glowBorderRadius === next.glowBorderRadius &&
    prev.textAlign === next.textAlign &&
    prev.scrollbar === next.scrollbar &&
    prev.isManual === next.isManual
  );
}

const LyricRowMemo = memo(LyricRow, lyricRowPropsEqual);

function LyricDisplay({
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
  // 快速连续换行检测：记录播放换行时间与单次跳转行数
  const focusJumpRef = useRef(0);

  // 流式栈位置：wrapper 的 translateY
  const [stackOffset, setStackOffset] = useState(0);
  const [suppressStackTransition, setSuppressStackTransition] = useState(true);
  // 容器尺寸变化计数：即使尺寸数值未变（如 DevTools 停靠切换），也强制重渲染一次，
  // 让栈定位 effect 及时消费并复位 shouldTransit，避免抑制标记卡住导致下一次跳行无动画
  const [resizeTick, setResizeTick] = useState(0);
  // 子层收起/展开动画结束后强制一次栈重定位：
  // switchReset 抑制过渡时 wrapper 净高度变化可能为零，ResizeObserver 不会触发
  const [subSettleTick, setSubSettleTick] = useState(0);
  // 上次生效的子层显隐标志：仅“开关真正变化”时走先钉满再收起的动画路径
  const prevSubFlagsRef = useRef<[boolean, boolean]>([settings.showTranslation, settings.showRomaji]);
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
  // 字号变化键：三个字号直接到位（LyricBlock 通过 CSS 变量引用）
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
  // 字号/子层几何过渡窗口时间戳：期间 wrapper RO 直写居中，避免逐帧 React 渲染
  const geometryChangedAtRef = useRef(0);
  // 子层过渡结束后清除 CSS 变量的定时器
  const subEndTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);


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

  // 单次播放换行跳过的行数：>2 视为 seek/点击歌词/切歌（大跳时精确居中并退出手动模式）
  const focusJump = Math.abs(focusLine - previousFocusedLineRef.current);
  focusJumpRef.current = focusJump;

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
  // stackOffsetRef 由栈 effect / wrapper RO / 手动滚动直写维护（渲染以 ref 为准，state 仅作渲染触发）
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

  // 平均行距（来自行中心缓存，避免逐帧读 DOM 布局；无缓存时回退 40px）
  const getLinePitch = () => {
    const centers = lineCentersRef.current;
    if (centers.length > 1) {
      return (centers[centers.length - 1] - centers[0]) / (centers.length - 1);
    }
    return 40;
  };

  // 当前聚焦行（含手动滚动/外部滚动模式）
  const activeLine = scrollingMode ? scrollingFocusLine : (isManual ? manualLine : focusLine);
  const activeLineRef = useRef(activeLine);
  activeLineRef.current = activeLine;

  // 统一栈定位目标：当前播放行精确居中（手动/滚动模式期间由滚轮接管）
  const computeStackTarget = useCallback((): number | null => {
    const container = containerRef.current;
    const wrapper = wrapperRef.current;
    if (!container || !wrapper || !allLines.length) return null;
    const idx = Math.min(Math.max(activeLine, 0), allLines.length - 1);
    // wrapper 的直接子元素即各行 GlassGlow（文档流顺序 = 行顺序）
    const lineEl = wrapper.children[idx] as HTMLElement | undefined;
    if (!lineEl) return null;
    const h = containerHeightRef.current || container.clientHeight;
    if (h <= 0) return null;
    const alignmentY = h * (alignmentPctRef.current * 0.01);
    const next = alignmentY - lineEl.offsetTop - lineEl.offsetHeight / 2;
    // 当前播放行始终精确居中（手动/滚动模式期间由滚轮接管，不参与）
    return next;
  }, [allLines, activeLine]);

  const transShowRef = useRef(settings.showTranslation);
  transShowRef.current = settings.showTranslation;
  const romaShowRef = useRef(settings.showRomaji);
  romaShowRef.current = settings.showRomaji;

  // ── 子层展开/收起（翻译/音译开关，CSS 过渡驱动）──
  // 与缩放效果同一套动画：一次写入目标 CSS 变量（--lyric-trans-h/o/m-{id} 等），
  // 高度/边距/透明度由子层 0.5s var(--lyric-timing-function) 过渡插值，
  // 居中由 wrapper ResizeObserver 逐帧直写 transform 跟随，无需 JS 插值循环。


  // 子层内容高度缓存：展开动画期间只写 CSS 变量、不逐帧读布局。
  // 每次布局/歌词变化后测量一次（querySelector + scrollHeight），动画帧内直接复用。
  const subMeasureRef = useRef<{ trans: number | null; roma: number | null }[]>([]);

  const measureSubHeights = useCallback(() => {
    const w = wrapperRef.current;
    if (!w) return;
    const arr: { trans: number | null; roma: number | null }[] = [];
    for (let i = 0; i < w.children.length; i++) {
      const row = w.children[i] as HTMLElement;
      const trans = row.querySelector(".lyric-block-translated") as HTMLElement | null;
      const roma = row.querySelector(".lyric-block-romaji") as HTMLElement | null;
      arr.push({
        trans: trans ? (trans.firstElementChild as HTMLElement).scrollHeight : null,
        roma: roma ? (roma.firstElementChild as HTMLElement).scrollHeight : null,
      });
    }
    subMeasureRef.current = arr;
  }, []);

  const applySubHeights = (tp: number, rp: number) => {
    const w = wrapperRef.current;
    if (!w) return;
    const fs = fontCurrentRef.current[0];
    const ms = subMeasureRef.current;
    const count = Math.min(w.children.length, ms.length);
    for (let i = 0; i < count; i++) {
      const m = ms[i];
      if (m?.trans != null) {
        w.style.setProperty(`--lyric-trans-h-${i}`, `${m.trans * tp}px`);
        w.style.setProperty(`--lyric-trans-o-${i}`, String(tp));
        // 默认 margin 是相对子层字号的 0.3em（如 19px×0.3=5.7px），须用子层字号计算
        w.style.setProperty(`--lyric-trans-m-${i}`, `${fs * fontCurrentRef.current[2] * 0.3 * tp}px`);
      }
      if (m?.roma != null) {
        w.style.setProperty(`--lyric-roma-h-${i}`, `${m.roma * rp}px`);
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

  useLayoutEffect(() => {
    const transShow = transShowRef.current;
    const romaShow = romaShowRef.current;
    // 仅“开关真正变化”时走先钉满再收起的动画路径；
    // 首次挂载/切歌/容器尺寸变化时 CSS 兜底（auto/0px）已是目标状态，
    // 若仍先钉满再收起，同帧净高度变化为零会让 wrapper ResizeObserver 不触发，
    // 栈定位停留在全展开几何上导致错位（重开 NowPlaying 后歌词不居中）
    const flagsChanged = transShow !== prevSubFlagsRef.current[0] || romaShow !== prevSubFlagsRef.current[1];
    prevSubFlagsRef.current = [transShow, romaShow];

    if (!flagsChanged) {
      clearSubVars();
      refreshLineCenters();
      geometryChangedAtRef.current = Date.now();
      if (subEndTimerRef.current) clearTimeout(subEndTimerRef.current);
      subEndTimerRef.current = null;
      return;
    }
    // 翻译/罗马音开关：测量并先钉住完整高度（auto→px 是离散跳变、视觉无差异），
    // 下一帧（双重 rAF）写目标值，保证收起/展开过渡两端都是可插值的 px；
    // 插值由子层 CSS 过渡（0.5s，与缩放效果同曲线）驱动，无需逐帧 JS
    measureSubHeights();
    applySubHeights(1, 1);
    geometryChangedAtRef.current = Date.now();
    refreshLineCenters();
    if (subEndTimerRef.current) clearTimeout(subEndTimerRef.current);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        applySubHeights(transShow ? 1 : 0, romaShow ? 1 : 0);
        // 动画结束后强制一次栈重定位：switchReset 抑制窗口内收起瞬间到位、
        // 净高度变化为零，wrapper RO 可能不触发，必须显式重算居中位置
        setSubSettleTick((t) => t + 1);
        refreshLineCenters();
        geometryChangedAtRef.current = Date.now();
      });
    });
    // 过渡结束后清除变量恢复 auto/0px：字号变化时子层高度自动跟随，无需逐事件重测
    subEndTimerRef.current = setTimeout(() => {
      clearSubVars();
      refreshLineCenters();
      geometryChangedAtRef.current = 0;
      subEndTimerRef.current = null;
    }, SUB_ANIM_MS + 150);
  }, [layoutKey, allLines, containerWidth, measureSubHeights, refreshLineCenters]);


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
      // |offset| >= 4 的行 opacity 已 = 0，完全不可见；不再参与模糊过渡（±3 行保留 3.5px 渐变），
      // 显著降低切行时主线程 blur 重栅格化面积（翻译/罗马音开启时行高更大，收益最明显）
      if (!settings.enableBlur || isManual || scrollingMode || Math.abs(offset) >= 4) return 0;
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
    // 字号变化起始帧同样抑制 transform 过渡（后续由 wrapper RO 直写居中）
    const suppress = !shouldTransit.current || Date.now() - layoutChangedAtRef.current < 100 || Date.now() - fontChangedAtRef.current < 100;
    shouldTransit.current = true;
    // 手动自由滚动/惯性期间位置由滚轮直接控制，不参与自动居中
    if (isManualRef.current) return;
    const next = computeStackTarget();
    if (next === null) return;
    stackOffsetRef.current = next;
    setStackOffset(next);
    setSuppressStackTransition(suppress);
    setIsVisible(true);
  }, [
    allLines, activeLine, containerHeight, containerWidth,
    layoutKey, fontKey, resizeTick, manualExitTick, subSettleTick, computeStackTarget,
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
  recenterRef.current = () => computeStackTarget();
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    const ro = new ResizeObserver(() => {
      if (isManualRef.current) return; // 手动滚动期间位置由滚轮接管
      const w = wrapperRef.current;
      const next = recenterRef.current();
      if (w && next !== null) {
        // 高度过渡期间逐帧直写 transform（不触发 React 渲染）；
        // 起始帧栈 effect 已置 suppress=true，transform 过渡为 0s，不会追赶
        w.style.transform = `translateY(${next}px)`;
        stackOffsetRef.current = next;
        setSuppressStackTransition(true);
      }
      // 非字号/子层过渡窗口内刷新行中心缓存（如窗口缩放导致换行）
      if (Date.now() - geometryChangedAtRef.current > 600) refreshLineCenters();
    });
    ro.observe(wrapper);
    return () => ro.disconnect();
    // 歌词数据异步加载：首帧 wrapper 可能不存在，allLines 变化后重新挂载监听
  }, [allLines]);

  // ── 字号：直接到位（保持发布行为），子层高度为 auto 自动跟随 ──

  const setFontVars = useCallback((font: number, roma: number, trans: number) => {
    const w = wrapperRef.current;
    if (!w) return;
    w.style.setProperty("--lyric-font-size", font + "px");
    w.style.setProperty("--lyric-romaji-scale", String(roma));
    w.style.setProperty("--lyric-trans-scale", String(trans));
  }, []);

  // 字号目标变化：直接到位（与发布行为一致）；子层高度此时为 auto，自动跟随字号
  useLayoutEffect(() => {
    const to: [number, number, number] = [settings.fontSize, settings.romajiFontSize, settings.translationFontSize];
    setFontVars(to[0], to[1], to[2]);
    fontCurrentRef.current = [...to];
    geometryChangedAtRef.current = Date.now();
    // fontChanged 已在上方渲染期写入 fontChangedAtRef（栈抑制用）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fontKey]);

  // 切歌：字号直接到位，避免旧歌词几何下残留过渡
  useLayoutEffect(() => {
    setFontVars(settings.fontSize, settings.romajiFontSize, settings.translationFontSize);
    fontCurrentRef.current = [settings.fontSize, settings.romajiFontSize, settings.translationFontSize];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lyricData]);





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
      const linePitch = getLinePitch();
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
      // 限速：单次事件最大位移（1.5 行，保底 120px），避免超快滚动直接闪到底部
      const maxStep = Math.max(localPitch * MAX_WHEEL_STEP_LINES, MAX_WHEEL_STEP_PX);
      raw = Math.max(-maxStep, Math.min(maxStep, raw));
      if (dt > 0 && dt < 120) {
        wheelVelRef.current = wheelVelRef.current * 0.7 + (raw / dt) * 0.3;
      } else {
        wheelVelRef.current = raw / Math.max(dt, 16);
      }
      // 速度上限：限制惯性甩动的总滑行距离
      wheelVelRef.current = Math.max(-MAX_WHEEL_VELOCITY, Math.min(MAX_WHEEL_VELOCITY, wheelVelRef.current));
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

  // 播放行大跳（seek/点击歌词/切歌/全局偏移）时退出手动模式；
  // 播放自然换行（单行推进）不打断手动浏览位置
  useEffect(() => {
    if (isManualRef.current && focusJumpRef.current > 2) exitManual();
  }, [focusLine, exitManual]);

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
      if (subEndTimerRef.current) clearTimeout(subEndTimerRef.current);
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
            // 字号 CSS 变量（渲染即写目标值；字号变化直接到位）
            ["--lyric-font-size" as string]: fontCurrentRef.current[0] + "px",
            ["--lyric-romaji-scale" as string]: String(fontCurrentRef.current[1]),
            ["--lyric-trans-scale" as string]: String(fontCurrentRef.current[2]),
            // 手动滚动期间 transform 由滚轮/惯性直接写 DOM（manualOffsetRef 为同步镜像），
            // React 重渲染时写入当前值，避免覆盖滚动中的实时位置
            // 用 ref 镜像渲染：动画循环直写 transform 后，即使 React state 尚未刷新，渲染也不会回写旧值
            transform: isManual ? `translateY(${manualOffsetRef.current}px)` : `translateY(${stackOffsetRef.current}px)`,
            // 子层展开/收起的几何过渡由 wrapper RO 逐帧直写居中（见 wrapper RO），
            // 这里 transform 仅在线性切换/手动滚动时保留 CSS 过渡
            transition: suppressStackTransition
              ? "none"
              : `transform ${isManual ? "0.35s cubic-bezier(0.22, 0.61, 0.36, 1)" : "0.5s var(--lyric-timing-function, ease)"}`,
            willChange: "transform",
          }}
        >
          {allLines.map((line, i) => {
            const v = lineVisuals[i];
            if (!v) return null;

            return (
              <LyricRowMemo
                key={i}
                line={line}
                index={i}
                offset={i - activeLine}
                isCurrent={i === activeLine}
                scale={v.scale}
                blur={v.blur}
                opacity={v.opacity}
                delay={v.delay}
                currentTime={currentTime}
                getCurrentTime={getCurrentTime}
                seekCounter={seekCounter}
                playState={playState}
                pageOpen={pageOpen}
                onClick={onLineClick}
                settings={settings}
                useKaraokeLyrics={useKaraokeLyrics}
                karaokeAnimation={karaokeAnimation}
                lyricGlow={lyricGlow}
                glassGlowColor={glassGlowColor}
                glowBorderRadius={glowBorderRadius}
                textAlign={textAlign}
                scrollbar={scrollbar}
                isManual={isManual}
              />
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

// memo：播放中 audioState.pos 高频更新会让外层整树重渲染，歌词子树的 props 基本稳定，
// 包一层 memo 避免每次位置刷新都重渲染全部歌词行（翻译/罗马音开启时行数多、代价大）
export default memo(LyricDisplay);
