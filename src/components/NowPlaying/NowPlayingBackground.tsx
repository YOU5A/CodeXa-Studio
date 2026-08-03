/**
 * NowPlayingBackground — 全窗口播放背景
 *
 * 背景类型（参考 refined-now-playing-netease-next）：
 * - fluid: 封面流体（动态由 dynamicFluid 控制，关 = 静态单帧）
 * - blur: 封面模糊
 * - gradient: 封面色渐变
 * - solid: 封面纯色
 * 流体参数来自共享 fluidSettings（与音乐页同步）；暗化遮罩由设置面板滑块控制。
 */

import { memo } from "react";
import { AnimatePresence, motion } from "framer-motion";
import FluidBackground from "@/components/FluidBackground";
import type { FluidSettingsValues } from "@/components/FluidSettingsPanel";
import type { RGB } from "@/utils/colorExtractor";

interface NowPlayingBackgroundProps {
  coverColor: RGB | null;
  coverImageUrl: string | null;
  playing: boolean;
  /** 背景暗化 0-100 */
  dim: number;
  /** 背景类型：流体 / 模糊 / 渐变 / 纯色 */
  type: FluidSettingsValues["backgroundType"];
  /** 动态流体：流体类型时是否启用动画（关 = 静态单帧） */
  dynamicFluid: boolean;
  /** 流体模糊强度（来自外层 fluidSettings，与音乐页共享同一状态源） */
  blurAmount: number;
  /** 流体目标帧率 */
  targetFps: FluidSettingsValues["fps"];
}

/** RGB → css 颜色，可选亮度系数（渐变用） */
const rgbCss = (c: RGB, factor = 1) =>
  `rgb(${Math.min(255, Math.round(c[0] * factor))},${Math.min(255, Math.round(c[1] * factor))},${Math.min(255, Math.round(c[2] * factor))})`;

function NowPlayingBackground({ coverColor, coverImageUrl, playing, dim, type, dynamicFluid, blurAmount, targetFps }: NowPlayingBackgroundProps) {

  const dimOpacity = Math.max(0, Math.min(100, dim)) / 100;


  let content: React.ReactNode;
  if (type === "blur") {
    content = (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: coverImageUrl ? `url(${coverImageUrl})` : undefined,
          backgroundColor: "#12161f",
          backgroundSize: "cover",
          backgroundPosition: "center",
          filter: "blur(36px)",
          transform: "scale(1.15)",
        }}
      />
    );
  } else if (type === "gradient") {
    content = (
      <div
        style={{
          position: "absolute",
          inset: 0,
          backgroundImage: coverColor
            ? `linear-gradient(-45deg, ${rgbCss(coverColor, 1.35)}, ${rgbCss(coverColor)} 45%, ${rgbCss(coverColor, 0.55)})`
            : "linear-gradient(-45deg, #3d4050, #12161f)",
        }}
      />
    );
  } else if (type === "solid") {
    content = (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: coverColor ? `rgb(${coverColor[0]},${coverColor[1]},${coverColor[2]})` : "#12161f",
        }}
      />
    );
  } else {
    // fluid（动态由 dynamicFluid 控制）
    content = (
      <FluidBackground
        blurAmount={blurAmount}
        targetFps={targetFps}
        staticFluid={!dynamicFluid}
        coverImageUrl={coverImageUrl}
        playing={playing}
      />
    );
  }

  return (
    <div className="np-background" style={{ position: "absolute", inset: 0, overflow: "hidden" }}>
      <AnimatePresence initial={false}>
        <motion.div
          key={type}
          style={{ position: "absolute", inset: 0 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeInOut" }}
        >
          {content}
        </motion.div>
      </AnimatePresence>
      {/* 暗色渐变遮罩：暗化由设置面板滑块控制 */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          opacity: dimOpacity,
          background: "linear-gradient(to bottom, rgba(0,0,0,0.36) 0%, rgba(0,0,0,0.06) 28%, rgba(0,0,0,0.16) 72%, rgba(0,0,0,0.40) 100%)",
        }}
      />
    </div>
  );
}

// memo：开/关播放列表面板时避免重渲染整个背景
export default memo(NowPlayingBackground);
