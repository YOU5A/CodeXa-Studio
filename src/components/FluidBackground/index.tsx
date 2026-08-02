/**
 * FluidBackground React 组件
 * SVG 封面流体（封面图片四分块 + feTurbulence/feDisplacementMap 扭曲）
 * 不依赖任何 Context 或全局状态
 */

import { lazy, Suspense, type FC } from "react";

const SvgFluidRenderer = lazy(() => import("./SvgFluidRenderer"));

export interface FluidBackgroundProps {
  /** 封面图片 URL (base64 或 http URL) */
  coverImageUrl?: string | null;
  /** 总开关, 默认 true */
  enabled?: boolean;
  /** 速度倍率 0.1-3.0, 默认 1.0 */
  speedMultiplier?: number;
  /** 模糊程度 0-1, 默认 0 */
  blurAmount?: number;
  /** 目标帧率 (30/60), 默认 60 */
  targetFps?: number;
  /** 播放状态, 用于暂停同步 */
  playing?: boolean;
  /** 静态流体：暂停动画、渲染单帧（NowPlaying 背景类型“静态流体”使用） */
  staticFluid?: boolean;
  /** 额外 CSS 类名 */
  className?: string;
}

const FluidBackground: FC<FluidBackgroundProps> = ({
  coverImageUrl,
  enabled,
  speedMultiplier,
  blurAmount,
  targetFps,
  playing,
  staticFluid,
  className,
}) => {
  // 无封面时无流体可渲染（旧版 Canvas 彩色光斑已移除）
  if (!coverImageUrl) return null;

  return (
    <Suspense fallback={null}>
        <SvgFluidRenderer
          imageUrl={coverImageUrl}
          enabled={enabled}
          speedMultiplier={speedMultiplier}
        targetFps={targetFps}
        blurAmount={blurAmount}
        paused={playing === false}
        className={staticFluid ? `svg-fluid-static${className ? " " + className : ""}` : className}
      />
    </Suspense>
  );
};

export default FluidBackground;
