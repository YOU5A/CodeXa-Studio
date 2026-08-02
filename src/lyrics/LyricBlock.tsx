/**
 * LyricBlock — Single lyric block with original + romaji + translation layers
 *
 * Ported from refined-now-playing-netease-next. Refactored to block-based centering.
 * Each block is the fundamental rendering unit for scrolling, highlighting, and animation.
 * All sub-layers share the same block-level visual treatment (opacity controlled by LyricDisplay).
 *
 * NowPlaying 专属扩展（可选 props，默认 undefined 时行为与改动前完全一致）：
 * - useKaraokeLyrics: 逐字歌词开关；true 时按 karaokeAnimation 渲染逐词动画
 * - karaokeAnimation: "float"（上浮）/ "slide"（滑动）
 * - lyricGlow: 长音（trailing 词）发光动画，WAAPI 驱动，rAF 推进
 *
 * @module lyrics/LyricBlock
 */

import { memo, useEffect, useRef } from "react";
import type { DynamicLyricWord, LyricLine } from "./types";
import type { LyricsSettingsValues } from "./types";
import { DEFAULT_LYRICS_SETTINGS } from "./types";
import InterludeDots from "./InterludeDots";

export interface LyricBlockProps {
  line: LyricLine;
  offset: number;
  isCurrent: boolean;
  currentTime: number;
  id?: number;
  getCurrentTime?: () => number;
  seekCounter?: number;
  playState?: boolean;
  pageOpen?: boolean;
  onClick?: (time: number) => void;
  settings?: LyricsSettingsValues;
  /** NowPlaying 专属：逐字歌词开关（undefined = 悬浮窗默认路径，保持现状） */
  useKaraokeLyrics?: boolean;
  /** NowPlaying 专属：逐字动画类型 */
  karaokeAnimation?: "float" | "slide";
  /** NowPlaying 专属：长音发光动画 */
  lyricGlow?: boolean;
}

/** scale = (max(1 - |offset|*0.2, 0))^3 * 0.3 + 0.7 */
export function scaleByOffset(offset: number): number {
  const a = Math.abs(offset);
  const s = 1 - a * 0.2;
  if (s <= 0) return 0.7;
  return s * s * s * 0.3 + 0.7;
}

/** blur = min(0.5 + |offset|*1.0, 4.5) px */
export function blurByOffset(offset: number): number {
  return Math.min(0.5 + Math.abs(offset) * 1.0, 4.5);
}

/** opacity: |offset|<=1->1, else max(1-0.4*(|offset|-1), 0) */
export function opacityByOffset(offset: number): number {
  const a = Math.abs(offset);
  if (a <= 1) return 1;
  return Math.max(1 - 0.4 * (a - 1), 0);
}

/** Estimate character width units (CJK=1, ASCII 0.55, other 0.65) */
export function estimateCharUnits(text: string): number {
  let units = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    if (cp <= 0x7F) units += 0.55;
    else if (
      (cp >= 0x4E00 && cp <= 0x9FFF) ||
      (cp >= 0x3000 && cp <= 0x303F) ||
      (cp >= 0xFF00 && cp <= 0xFFEF) ||
      (cp >= 0xAC00 && cp <= 0xD7AF)
    )
      units += 1;
    else units += 0.65;
  }
  return units;
}

/** 当前行歌词发光阴影（与旧渲染路径一致） */
const LYRIC_TEXT_SHADOW =
  "var(--lyric-text-shadow, 0 3px 12px rgba(var(--lyric-glow-rgb), 0.4), 0 1px 4px rgba(var(--lyric-glow-rgb), 0.25))";

/** 当前行音译/翻译歌词发光阴影（子层字号小，模糊更柔和，避免被 overflow: hidden 裁切） */
const LYRIC_SUB_TEXT_SHADOW =
  "var(--lyric-sub-text-shadow, 0 2px 8px rgba(var(--lyric-glow-rgb), 0.5), 0 1px 3px rgba(var(--lyric-glow-rgb), 0.3))";

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

const LyricBlock = memo(function LyricBlock({
  line,
  offset,
  isCurrent,
  currentTime,
  id,
  getCurrentTime,
  seekCounter = 0,
  playState = true,
  pageOpen = true,
  onClick,
  settings = DEFAULT_LYRICS_SETTINGS,
  useKaraokeLyrics,
  karaokeAnimation = "float",
  lyricGlow,
}: LyricBlockProps) {
  const pressStartTime = useRef(0);
  const karaokeRef = useRef<HTMLSpanElement | null>(null);
  const glowAnimRefs = useRef<{ anim: Animation; start: number }[]>([]);

  // 字号不再直接参与样式：由 LyricDisplay 通过 --lyric-font-size / --lyric-romaji-scale / --lyric-trans-scale
  // CSS 变量驱动（JS 插值动画），保证行几何与 wrapper 位移同帧一致
  const { fontBold, showTranslation, showRomaji, enableGlow } = settings;

  // ── 长音发光动画（仅 NowPlaying：lyricGlow && 当前行 && 播放中） ──
  // 注意：本 effect 必须在 interlude 提前 return 之前声明，保证任意行类型下 hook 数量一致
  useEffect(() => {
    glowAnimRefs.current.forEach((a) => a.anim.cancel());
    glowAnimRefs.current = [];
    if (!pageOpen || !lyricGlow || !isCurrent || playState === false || !line.dynamicLyric?.length) return;
    const container = karaokeRef.current;
    if (!container) return;
    const trailingIndexes: number[] = [];
    line.dynamicLyric.forEach((w, i) => { if (w.trailing) trailingIndexes.push(i); });
    if (!trailingIndexes.length) return;

    const glowRgb = "var(--lyric-glow-rgb, var(--accent-rgb))";
    const createGlow = (el: HTMLElement, word: DynamicLyricWord) => {
      const fadeIn = Math.max(word.duration * 0.6, 1);
      const keep = Math.max(word.duration * 0.4, 1);
      const fadeAway = 500;
      const duration = fadeIn + keep + fadeAway;
      const anim = el.animate(
        [
          { filter: `drop-shadow(0 0 0px rgba(${glowRgb}, 0)) drop-shadow(0 0 0px rgba(${glowRgb}, 0))` },
          { filter: `drop-shadow(0 0 15px rgba(${glowRgb}, 1)) drop-shadow(0 0 10px rgba(${glowRgb}, 0.5))`, offset: fadeIn / duration },
          { filter: `drop-shadow(0 0 15px rgba(${glowRgb}, 1)) drop-shadow(0 0 10px rgba(${glowRgb}, 0.5))`, offset: (fadeIn + keep) / duration },
          { filter: `drop-shadow(0 0 0px rgba(${glowRgb}, 0)) drop-shadow(0 0 0px rgba(${glowRgb}, 0))`, offset: 1 },
        ],
        { duration, fill: "forwards", easing: "linear" }
      );
      anim.pause();
      return { anim, start: getWordAbsoluteTime(word) };
    };

    glowAnimRefs.current = trailingIndexes
      .map((i) => {
        const el = container.children[i] as HTMLElement | null;
        return el && line.dynamicLyric ? createGlow(el, line.dynamicLyric[i]) : null;
      })
      .filter((v): v is { anim: Animation; start: number } => v !== null);

    const apply = () => {
      const t = (getCurrentTime?.() ?? currentTime) * 1000;
      for (const a of glowAnimRefs.current) {
        a.anim.currentTime = Math.max(0, t - a.start);
      }
    };
    apply();
    let raf = 0;
    const loop = () => {
      apply();
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      glowAnimRefs.current.forEach((a) => a.anim.cancel());
      glowAnimRefs.current = [];
    };
  }, [isCurrent, lyricGlow, playState, pageOpen, line, seekCounter, karaokeAnimation, getCurrentTime, currentTime]);


  // Interlude line
  if (line.isInterlude) {
    return (
      <div
        className="lyric-block lyric-interlude-line"
        data-offset={offset}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
          fontSize: "var(--lyric-font-size, 20px)",
          paddingTop: "0.1em",
          paddingBottom: "0.1em",
        }}
      >
        <InterludeDots
          line={line}
          currentTime={currentTime}
          isCurrent={isCurrent}
          id={id ?? 0}
          getCurrentTime={getCurrentTime}
          seekCounter={seekCounter}
          playState={playState}
          pageOpen={pageOpen}
        />
      </div>
    );
  }

  const displayText = line.originalLyric || line.text;

  // Block-level color treatment: current line is primary, others dim to tertiary.
  // Opacity is handled at the container level by LyricDisplay (no per-sub-layer opacity).
  // NowPlaying 内为封面主色+白色柔和（--np-cover-text*），其他场景回退原文本色
  const textColor = isCurrent ? "var(--np-cover-text, var(--text-primary))" : "var(--np-cover-text-soft, var(--text-tertiary))";
  const subColor = isCurrent ? "var(--np-cover-text-soft, var(--text-secondary))" : "var(--np-cover-text-soft, var(--text-tertiary))";

  // ── NowPlaying 逐字动画（仅 useKaraokeLyrics === true 时启用；undefined 保持旧路径） ──
  const words = line.dynamicLyric ?? [];
  const karaokeBaseTime = line.dynamicLyricTime ?? line.time * 1000;
  const getWordAbsoluteTime = (word: DynamicLyricWord) => {
    const t = word.time ?? 0;
    // 网易云 YRC 通常存绝对时间；仅对小偏移补行基准（与 RNP 一致）
    return t >= karaokeBaseTime - 1000 ? t : karaokeBaseTime + t;
  };
  const effectiveNowMs = (getCurrentTime?.() ?? currentTime) * 1000;

  const renderKaraokeWord = (word: DynamicLyricWord, wi: number) => {
    const duration = Math.max(1, word.duration || 0);
    const wordDelay = getWordAbsoluteTime(word) - effectiveNowMs;
    const progress = clamp01((effectiveNowMs - getWordAbsoluteTime(word)) / duration);
    const marginRight = word.endsWithSpace && wi < words.length - 1 ? (word.isCJK ? "0.5em" : "0.25em") : undefined;

    if (karaokeAnimation === "slide") {
      const wordStyle: React.CSSProperties = {
        display: "inline-block",
        position: "relative",
        marginRight,
        transform: isCurrent ? "translateY(-1px)" : "translateY(0px)",
      };
      const fillerStyle: React.CSSProperties = {
        opacity: isCurrent ? (playState === false ? (progress > 0 ? 1 : 0) : 1) : 0,
        textShadow: isCurrent && enableGlow ? LYRIC_TEXT_SHADOW : undefined,
      };
      if (isCurrent && playState !== false) {
        wordStyle.transitionDuration = `${duration}ms, ${duration * 0.8}ms, 0.5s`;
        wordStyle.transitionDelay = `${wordDelay}ms, ${wordDelay + duration * 0.5}ms, 0ms`;
        // 滑动擦除改用一次性 CSS 动画：每词按自身 duration/delay 从 100% 滑到 0%；
        // 负 delay 直接落到当前进度，切换上浮/滑动时不会残留旧样式或卡住
        fillerStyle.animationName = "np-karaoke-wipe";
        fillerStyle.animationDuration = `${duration}ms`;
        fillerStyle.animationDelay = `${wordDelay}ms`;
        fillerStyle.animationTimingFunction = "linear";
        fillerStyle.animationFillMode = "both";
        // opacity 淡入仍走 0.5s 过渡
        fillerStyle.transitionDuration = "0s, 0s, 0.5s";
        fillerStyle.transitionDelay = "0ms";
      } else if (isCurrent) {
        wordStyle.transitionDuration = "0s, 0s, 0.5s";
        wordStyle.transitionDelay = "0ms";
        wordStyle.transform = `translateY(-${progress}px)`;
        fillerStyle.transitionDuration = "0s, 0s, 0.5s";
        fillerStyle.transitionDelay = "0ms";
        fillerStyle.WebkitMaskPositionX = `${100 * (1 - progress)}%`;
      } else {
        wordStyle.transitionDuration = "0ms, 0ms, 0.5s";
        wordStyle.transitionDelay = "0ms";
        fillerStyle.transitionDuration = "0ms, 0ms, 0.5s";
        fillerStyle.transitionDelay = "0ms";
        fillerStyle.WebkitMaskPositionX = "100%";
      }
      return (
        <span key={wi} className="lyric-karaoke-word" style={wordStyle}>
          <span>{word.word}</span>
          <span className="lyric-karaoke-word-filler" style={fillerStyle}>{word.word}</span>
        </span>
      );
    }

    // float（上浮）
    const floatStyle: React.CSSProperties = {
      display: "inline-block",
      marginRight,
      textShadow: isCurrent && enableGlow ? LYRIC_TEXT_SHADOW : undefined,
    };
    if (isCurrent && playState !== false) {
      floatStyle.opacity = 1;
      floatStyle.transform = "translateY(-2px)";
      floatStyle.transitionDuration = `${duration}ms, ${duration + 150}ms`;
      floatStyle.transitionDelay = `${wordDelay}ms`;
    } else if (isCurrent) {
      floatStyle.opacity = 0.4 + progress * 0.6;
      floatStyle.transform = `translateY(-${progress * 2}px)`;
      floatStyle.transitionDuration = "0s";
      floatStyle.transitionDelay = "0ms";
    } else {
      floatStyle.opacity = 0.4;
      floatStyle.transform = "translateY(0px)";
      floatStyle.transitionDuration = "200ms";
      floatStyle.transitionDelay = "0ms";
    }
    return (
      <span key={wi} className="lyric-karaoke-word" style={floatStyle}>{word.word}</span>
    );
  };

  let originalLayer: React.ReactNode;
  if (useKaraokeLyrics === true && words.length > 0) {
    // NowPlaying 逐字路径：所有行都渲染逐词结构（非当前行置暗），保证切行时 CSS 过渡可触发
    // 以动画类型作 key：切换上浮/滑动时整组重建，避免旧模式 DOM/样式残留重叠
    originalLayer = (
      <span
        key={karaokeAnimation}
        ref={karaokeRef}
        className={`lyric-karaoke lyric-karaoke-${karaokeAnimation}`}
        style={{ display: "inline-block" }}
      >
        {words.map(renderKaraokeWord)}
      </span>
    );
  } else if (useKaraokeLyrics === undefined && isCurrent && enableGlow && words.length > 0) {
    // 悬浮窗默认路径：与改动前完全一致（仅当前行 + 发光时的逐词 span，无动画）
    originalLayer = words.map((w, wi) => {
      const isLast = wi === words.length - 1;
      return (
        <span key={wi} style={{
          display: "inline-block",
          marginRight: w.endsWithSpace && !isLast ? (w.isCJK ? "0.5em" : "0.25em") : undefined,
          textShadow: LYRIC_TEXT_SHADOW,
          transition: "text-shadow 0.5s ease",
        }}>
          {w.word}
        </span>
      );
    });
  } else {
    originalLayer = displayText;
  }


  return (
    <div
      className="lyric-block"
      data-offset={offset}
      onMouseDown={
        onClick
          ? () => {
              pressStartTime.current = Date.now();
            }
          : undefined
      }
      onMouseUp={
        onClick
          ? () => {
              if (Date.now() - pressStartTime.current < 200) onClick(line.time);
            }
          : undefined
      }
      style={{
        cursor: onClick ? "pointer" : "default",
        userSelect: "none",
        overflowWrap: "break-word",
        wordBreak: "break-word",
        position: "relative",
        overflow: "visible",
        // BFC：让子层 margin-bottom 参与行高，行视觉中心与布局中心一致（否则字号动画中会漂移）
        display: "flow-root",
      }}
    >
      {/* Original lyric */}
      <div
        className="lyric-block-original"
        style={{
          fontSize: "var(--lyric-font-size, 20px)",
          fontWeight: fontBold ? 700 : (isCurrent ? 600 : 400),
          lineHeight: 1.2,
          color: textColor,
          marginBottom: "0.3em",
          // 逐字模式开着但歌词无逐字数据时走普通文本，发光仍应生效
          textShadow: (isCurrent && enableGlow && (useKaraokeLyrics !== true || words.length === 0))
            ? LYRIC_TEXT_SHADOW
            : "none",
          transition: "color 0.5s ease, text-shadow 0.5s ease",
        }}
      >
        {originalLayer}
      </div>

      {/* Romaji */}
      {line.romanLyric && (
        <div
          className="lyric-block-romaji"
          style={{
            // 展开/收起由 LyricDisplay 通过 --lyric-roma-h/o/m-{id} CSS 变量逐帧驱动（JS 插值），
            // 避免 CSS 过渡几何无法与 wrapper 位移同帧导致的居中抖动
            overflow: "hidden",
            height: `var(--lyric-roma-h-${id ?? 0}, ${showRomaji ? "auto" : "0px"})`,
            opacity: `var(--lyric-roma-o-${id ?? 0}, ${showRomaji ? 1 : 0})`,
            marginBottom: `var(--lyric-roma-m-${id ?? 0}, ${showRomaji ? "0.4em" : "0px"})`,
            fontSize: "calc(var(--lyric-font-size, 20px) * var(--lyric-romaji-scale, 0.6))",
            fontWeight: isCurrent ? 400 : 300,
            lineHeight: 1.2,
            color: subColor,
            // 跟随“发光效果”开关：仅当前行发光
            textShadow: isCurrent && enableGlow ? LYRIC_SUB_TEXT_SHADOW : "none",
            transition: "color 0.5s ease, text-shadow 0.5s ease",
          }}
        >
          <div style={{ minHeight: 0 }}>{line.romanLyric}</div>
        </div>
      )}

      {/* Translation */}
      {line.translatedLyric && (
        <div
          className="lyric-block-translated"
          style={{
            // 展开/收起由 LyricDisplay 通过 --lyric-trans-h/o/m-{id} CSS 变量逐帧驱动（JS 插值）
            overflow: "hidden",
            height: `var(--lyric-trans-h-${id ?? 0}, ${showTranslation ? "auto" : "0px"})`,
            opacity: `var(--lyric-trans-o-${id ?? 0}, ${showTranslation ? 1 : 0})`,
            marginBottom: `var(--lyric-trans-m-${id ?? 0}, ${showTranslation ? "0.3em" : "0px"})`,
            fontSize: "calc(var(--lyric-font-size, 20px) * var(--lyric-trans-scale, 0.5))",
            fontWeight: isCurrent ? 400 : 300,
            lineHeight: 1.2,
            color: subColor,
            // 跟随“发光效果”开关：仅当前行发光
            textShadow: isCurrent && enableGlow ? LYRIC_SUB_TEXT_SHADOW : "none",
            transition: "color 0.5s ease, text-shadow 0.5s ease",
          }}
        >
          <div style={{ minHeight: 0 }}>{line.translatedLyric}</div>
        </div>
      )}
    </div>
  );
});

export default LyricBlock;
