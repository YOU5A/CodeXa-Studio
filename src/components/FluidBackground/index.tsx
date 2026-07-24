/**
 * FluidBackground React 组件
 * 双模式: SVG 流体滤镜 (有封面时) / Canvas 2D blob (回退)
 * 不依赖任何 Context 或全局状态
 */

import { useEffect, useRef, useCallback, lazy, Suspense, type FC } from "react";
import { FluidRenderer } from "./renderer";
import type { FluidConfig, FluidPresetId } from "./config";
import { DEFAULT_CONFIG, loadConfig } from "./config";

const SvgFluidRenderer = lazy(() => import("./SvgFluidRenderer"));

export interface FluidBackgroundProps {
  /** 预设, 默认 "auto" (主题自适应) */
  preset?: FluidPresetId | "auto";
  /** 整体不透明度 0-1, 默认 0.6 */
  intensity?: number;
  /** 画质, 默认 "medium" */
  quality?: "low" | "medium" | "high";
  /** 是否响应鼠标交互, 默认 true */
  interactive?: boolean;
  /** 总开关, 默认 true */
  enabled?: boolean;
  /** 速度倍率 0.1-3.0, 默认 1.0 */
  speedMultiplier?: number;
  /** 模糊程度 0-1, 默认 0 */
  blurAmount?: number;
  /** 颜色模式, 默认 "auto" */
  colorMode?: "auto" | "cover" | "dynamic";
  /** 封面颜色 RGB, 仅在 colorMode="cover" */
  coverColor?: [number, number, number] | null;
  /** 封面图片 URL (base64), 用于 SVG 流体模式 */
  coverImageUrl?: string | null;
  /** 目标帧率 (30/60), 默认 60 */
  targetFps?: number;
  /** 播放状态, 用于 SVG 流体模式暂停同步 */
  playing?: boolean;
  /** 额外 CSS 类名 */
  className?: string;
}

const FluidBackground: FC<FluidBackgroundProps> = ({
  preset,
  intensity,
  quality,
  interactive,
  enabled,
  speedMultiplier,
  blurAmount,
  colorMode,
  coverColor,
  coverImageUrl,
  targetFps,
  playing,
  className,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rendererRef = useRef<FluidRenderer | null>(null);
  const configRef = useRef<FluidConfig>({ ...DEFAULT_CONFIG, ...loadConfig() });

  // 合并 props 到运行时配置
  const mergedConfig: FluidConfig = {
    ...configRef.current,
    ...(preset !== undefined ? { preset } : {}),
    ...(intensity !== undefined ? { intensity } : {}),
    ...(quality !== undefined ? { quality } : {}),
    ...(interactive !== undefined ? { interactive } : {}),
    ...(enabled !== undefined ? { enabled } : {}),
    ...(speedMultiplier !== undefined ? { speedMultiplier } : {}),
    ...(blurAmount !== undefined ? { blurAmount } : {}),
    ...(colorMode !== undefined ? { colorMode } : {}),
  };

  // 判断是否使用 SVG 流体模式: 有封面图片 且 颜色模式为 "cover"
  const useSvgFluid = !!(coverImageUrl && (mergedConfig.colorMode === "cover" || mergedConfig.colorMode === "auto") && mergedConfig.enabled);

  // ---------- SVG 流体模式 (封面图片可用时) ----------
  // 此模式下不挂载 Canvas 渲染器

  // ---------- Canvas 模式: 初始化 / 销毁 ----------
  useEffect(() => {
    // 如果使用 SVG 模式, 不初始化 Canvas 渲染器
    if (useSvgFluid) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const renderer = new FluidRenderer(canvas, mergedConfig);
    rendererRef.current = renderer;

    // 初始尺寸
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      renderer.resize(w, h);
    };
    resize();

    // ResizeObserver
    const ro = new ResizeObserver(() => resize());
    ro.observe(document.documentElement);

    // 可见性
    const visHandler = () => {
      renderer.setVisible(!document.hidden && mergedConfig.enabled);
    };
    document.addEventListener("visibilitychange", visHandler);

    // Apply cover color synchronously before first render to avoid flash
    if (coverColor) {
      renderer.setCoverColor(coverColor);
    }

    // Start if enabled
    if (mergedConfig.enabled) {
      renderer.start();
    }

    return () => {
      ro.disconnect();
      document.removeEventListener("visibilitychange", visHandler);
      renderer.destroy();
      rendererRef.current = null;
    };
    // 仅在挂载/卸载时运行
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [useSvgFluid]);

  // ---------- Props change ----------
  useEffect(() => {
    if (useSvgFluid) return;
    const r = rendererRef.current;
    if (!r) return;
    r.updateConfig({
      preset,
      intensity,
      quality,
      interactive,
      enabled,
      speedMultiplier,
      blurAmount,
      colorMode,
    });
    if (enabled === false) {
      r.stop();
    } else if (enabled === true) {
      r.start();
    }
  }, [preset, intensity, quality, interactive, enabled, speedMultiplier, blurAmount, colorMode, useSvgFluid]);

  // 封面颜色
  useEffect(() => {
    if (useSvgFluid) return;
    rendererRef.current?.setCoverColor(coverColor ?? null);
  }, [coverColor, useSvgFluid]);

  // FPS 设置
  useEffect(() => {
    if (useSvgFluid) return;
    if (targetFps) {
      rendererRef.current?.setTargetFps(targetFps);
    }
  }, [targetFps, useSvgFluid]);

  // ---------- 鼠标交互 (仅 Canvas 模式) ----------
  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      if (!mergedConfig.interactive || useSvgFluid) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      rendererRef.current?.splat(nx, ny, 0.3);
    },
    [mergedConfig.interactive, useSvgFluid],
  );

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLCanvasElement>) => {
      if (!mergedConfig.interactive || useSvgFluid) return;
      const rect = (e.target as HTMLCanvasElement).getBoundingClientRect();
      const nx = (e.clientX - rect.left) / rect.width;
      const ny = (e.clientY - rect.top) / rect.height;
      rendererRef.current?.splat(nx, ny, 1.2);
    },
    [mergedConfig.interactive, useSvgFluid],
  );

  // ---------- 渲染 ----------
  // SVG 流体模式
  if (useSvgFluid && coverImageUrl) {
    return (
      <Suspense fallback={null}>
        <SvgFluidRenderer
          imageUrl={coverImageUrl}
          enabled={mergedConfig.enabled}
          static={false}
          speedMultiplier={mergedConfig.speedMultiplier}
          targetFps={targetFps}
          paused={playing === false}
          className={className}
        />
      </Suspense>
    );
  }

  // Canvas blob 模式
  return (
    <canvas
      ref={canvasRef}
      className={className}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 0,
        pointerEvents: mergedConfig.interactive && !useSvgFluid ? "auto" : "none",
        opacity: mergedConfig.intensity,
        display: mergedConfig.enabled ? undefined : "none",
      }}
      onPointerMove={handlePointerMove}
      onClick={handleClick}
    />
  );
};

export default FluidBackground;