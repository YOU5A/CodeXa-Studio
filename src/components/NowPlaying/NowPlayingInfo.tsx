/**
 * NowPlayingInfo — 歌曲信息（标题 + 艺术家 + 专辑）
 *
 * 标题带歌词同款彩色发光；文本严格超出容器宽度时才自动滚动：
 * 单份文本在原本位置停顿后向左滚出，滚完立即回到原本位置继续
 * （每遍完整播放，非无缝填充循环）。
 * 停顿期间左侧不显示透明渐变（文字完整可见），滚动开始时左侧渐变动画淡入。
 */

import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties } from "react";

interface NowPlayingInfoProps {
  title: string;
  artist: string;
  album?: string;
}

/** 跑马灯恒定速度（px/s） */
const MARQUEE_SPEED = 40;

/** 起点停顿时长（ms）：音乐刚开始播放时同样先停顿再滚动 */
const MARQUEE_HOLD_MS = 1000;

/** 左右边缘透明度渐变宽度（px） */
const MARQUEE_FADE = 32;

/** 左侧渐变淡入时长（ms） */
const MARQUEE_FADE_IN_MS = 600;

/**
 * 仅当文本宽度严格超过容器宽度（scrollWidth > clientWidth）时触发。
 *
 * 测量 span 常驻 DOM（滚动时隐藏，仅作测量），配合 useLayoutEffect +
 * ResizeObserver + FontFaceSet loadingdone + resize 监听，覆盖异步元数据、
 * 字体加载、布局动画等一切时序；flex 子项默认 min-width:auto 会按内容撑开，
 * 因此显式 minWidth:0 / maxWidth:100% 保证 clientWidth 是真实容器宽度。
 */
interface MarqueeTextProps {
  text: string;
  style: CSSProperties;
  /** 上下扩展 overflow 裁剪盒（px）：容纳标题 text-shadow 光晕；负 margin 抵消布局，滚动层用同值 top 对齐 */
  clipPaddingY?: number;
}

function MarqueeText({ text, style, clipPaddingY = 0 }: MarqueeTextProps) {
  const spanRef = useRef<HTMLSpanElement | null>(null);
  const marqueeRef = useRef<HTMLDivElement | null>(null);
  const [measure, setMeasure] = useState<{ containerW: number; textW: number } | null>(null);
  // 是否处于滚动阶段（起点停顿期间为 false，左侧渐变不显示）
  const [scrolling, setScrolling] = useState(false);

  useLayoutEffect(() => {
    const el = spanRef.current;
    if (!el) return;
    const update = () => {
      setMeasure((prev) => {
        const containerW = el.clientWidth;
        const textW = el.scrollWidth;
        if (prev && prev.containerW === containerW && prev.textW === textW) return prev;
        return { containerW, textW };
      });
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    window.addEventListener("resize", update);
    // 字体加载完成会改变文本实际宽度（scrollWidth 变化不触发 RO），
    // 监听 FontFaceSet loadingdone 替代原 500ms 常驻轮询
    document.fonts?.addEventListener("loadingdone", update);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", update);
      document.fonts?.removeEventListener("loadingdone", update);
    };
  }, [text]);

  const overflow = !!measure && measure.textW > measure.containerW + 1;

  // Web Animations API 时间轴：起点停顿 → 向左滚出 → 立即回到起点循环。
  // 每轮起点停顿期间 scrolling=false（左侧渐变隐藏），停顿结束切换为 true 淡入左侧渐变。
  useEffect(() => {
    const el = marqueeRef.current;
    if (!el || !measure || !overflow) return;
    setScrolling(false);
    const travelMs = (measure.textW / MARQUEE_SPEED) * 1000;
    const total = MARQUEE_HOLD_MS + travelMs;
    const anim = el.animate(
      [
        { transform: "translateX(0px)" },
        { transform: "translateX(0px)", offset: MARQUEE_HOLD_MS / total },
        { transform: `translateX(${-measure.textW}px)` },
      ],
      { duration: total, iterations: Infinity, easing: "linear" }
    );
    let holdTimer = window.setTimeout(() => setScrolling(true), MARQUEE_HOLD_MS);
    const resetTimer = window.setInterval(() => {
      // 每轮回到起点：隐藏左侧渐变，停顿结束后再次淡入
      setScrolling(false);
      holdTimer = window.setTimeout(() => setScrolling(true), MARQUEE_HOLD_MS);
    }, total);
    return () => {
      anim.cancel();
      window.clearTimeout(holdTimer);
      window.clearInterval(resetTimer);
    };
  }, [measure, text, overflow]);

  const fadeGradient =
    `linear-gradient(to right, transparent 0, black var(--np-fade-l, 0px), ` +
    `black calc(100% - var(--np-fade-r, 0px)), transparent 100%)`;

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minWidth: 0,
        // 未溢出时无需裁剪（光晕完全可见）；滚动时才裁剪文本
        overflow: overflow ? "hidden" : "visible",
        // 上下扩展裁剪盒容纳光晕；负 margin 抵消，不影响行高与间距
        paddingTop: clipPaddingY || undefined,
        paddingBottom: clipPaddingY || undefined,
        marginTop: clipPaddingY ? -clipPaddingY : undefined,
        marginBottom: clipPaddingY ? -clipPaddingY : undefined,
        whiteSpace: "nowrap",
        // 右侧渐变常开；左侧渐变仅在滚动阶段显示：进入停顿时瞬间隐藏，滚动开始时平滑淡入
        maskImage: overflow ? fadeGradient : undefined,
        WebkitMaskImage: overflow ? fadeGradient : undefined,
        ["--np-fade-l" as string]: overflow ? (scrolling ? `${MARQUEE_FADE}px` : "0px") : undefined,
        ["--np-fade-r" as string]: overflow ? `${MARQUEE_FADE}px` : undefined,
        // 仅滚动阶段带过渡（淡入动画）；进入停顿时无过渡（瞬间隐藏）
        transition: overflow && scrolling ? `--np-fade-l ${MARQUEE_FADE_IN_MS}ms ease` : undefined,
      }}
    >
      {/* 可见层：未滚动时直接显示；滚动时隐藏但保留占位用于测量 */}
      <span
        ref={spanRef}
        style={{
          display: "block",
          minWidth: 0,
          maxWidth: "100%",
          whiteSpace: "nowrap",
          visibility: overflow ? "hidden" : "visible",
          ...style,
        }}
      >
        {text}
      </span>

      {/* 滚动层：单份文本，原本位置停顿 → 向左滚出 → 立即回到原本位置继续 */}
      {overflow && measure && (
        <div
          key={text}
          ref={marqueeRef}
          className="np-auto-marquee"
          style={{ position: "absolute", left: 0, top: clipPaddingY || 0 }}
        >
          <span style={style}>{text}</span>
        </div>
      )}
    </div>
  );
}

export default function NowPlayingInfo({ title, artist, album }: NowPlayingInfoProps) {
  return (
    <div
      className="np-info"
      style={{
        width: "100%",
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 4,
      }}
    >
      {/* 标题：大字号 + 与歌词一致的发光；严格溢出时自动滚动 */}
      <MarqueeText
        text={title}
        clipPaddingY={28}
        style={{
          fontSize: 26,
          fontWeight: 700,
          lineHeight: 1.25,
          color: "var(--np-cover-text, var(--text-primary))",
          whiteSpace: "nowrap",
          textShadow: "var(--np-title-glow, 0 3px 12px rgba(var(--np-glow-rgb), 0.4), 0 1px 4px rgba(var(--np-glow-rgb), 0.25))", 
        }}
      />

      {/* 艺术家：严格溢出时自动滚动 */}
      <MarqueeText
        text={artist}
        style={{
          fontSize: 15,
          marginTop: 8,
          color: "var(--np-cover-text, var(--text-secondary))",
          opacity: 0.5,
          whiteSpace: "nowrap",
        }}
      />

      {/* 专辑：严格溢出时自动滚动 */}
      {album ? (
        <MarqueeText
          text={album}
          style={{
            fontSize: 13,
            color: "var(--np-cover-text, var(--text-tertiary))",
            opacity: 0.5,
            whiteSpace: "nowrap",
          }}
        />
      ) : null}
    </div>
  );
}
