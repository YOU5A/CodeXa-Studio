/**
 * SvgFluidRenderer — SVG feTurbulence + feDisplacementMap 流体背景渲染器
 * 将输入图片分成 4 象限，通过 SVG 滤镜扭曲 + CSS 旋转动画产生有机流体效果
 * 位移量固定 400（原项目为音频驱动，未接入音频时保持静止）；
 * 帧率经 CSS steps() 限制（与 refined-now-playing-netease-next 一致）。
 * 参考: refined-now-playing-netease-next (SUlTlUS)
 */

import { useEffect, useRef, useCallback, type FC } from "react";
import "./SvgFluidRenderer.css";

export interface FluidSurfaceHandle {
  /** 当前流体渲染使用的四个源 canvas。 */
  readonly sourceCanvases: readonly HTMLCanvasElement[];
  /** 当前流体容器，位置会随窗口布局变化。 */
  readonly sourceElement: HTMLElement;
  /** 获取流体容器当前屏幕区域。 */
  getRect: () => DOMRect;
  /** 将当前流体画面绘制到目标 canvas。 */
  paint: (target: HTMLCanvasElement, targetRect: DOMRect, offset?: { x?: number; y?: number }) => void;
  /** 停止后续绘制并释放句柄。 */
  dispose: () => void;
}

export interface SvgFluidRendererProps {
  /** 图片 URL (base64 或 http URL) */
  imageUrl: string;
  /** 总开关 */
  enabled?: boolean;
  /** 速度倍率 0.1-3.0（旋转动画时长倍率） */
  speedMultiplier?: number;
  /** 是否暂停动画 */
  paused?: boolean;
  /** 目标帧率 (30/60)；通过 CSS steps() 限制旋转动画 */
  targetFps?: 30 | 60;
  /** 模糊程度 0-1（作用于流体上的 backdrop blur，最大 64px） */
  blurAmount?: number;
  /** 额外 CSS 类名 */
  className?: string;
  /** 将当前流体表面提供给拖拽透镜等内部消费者。 */
  onSurfaceChange?: (surface: FluidSurfaceHandle | null) => void;
}

const CANVAS_SIZE = 100;

interface TransformMetrics {
  rotation: number;
  scaleX: number;
  scaleY: number;
}

function readTransformMetrics(element: HTMLElement): TransformMetrics {
  const value = getComputedStyle(element).transform;
  if (!value || value === "none") return { rotation: 0, scaleX: 1, scaleY: 1 };

  const match = value.match(/matrix(?:3d)?\(([^)]+)\)/);
  if (!match) return { rotation: 0, scaleX: 1, scaleY: 1 };
  const values = match[1].split(",").map(Number);
  if (values.length === 6) {
    const [a, b, c, d] = values;
    return {
      rotation: Math.atan2(b, a),
      scaleX: Math.hypot(a, b) || 1,
      scaleY: Math.hypot(c, d) || 1,
    };
  }
  if (values.length === 16) {
    const [a, b, , , c, d] = values;
    return {
      rotation: Math.atan2(b, a),
      scaleX: Math.hypot(a, b) || 1,
      scaleY: Math.hypot(c, d) || 1,
    };
  }
  return { rotation: 0, scaleX: 1, scaleY: 1 };
}

const SvgFluidRenderer: FC<SvgFluidRendererProps> = ({
  imageUrl,
  enabled = true,
  speedMultiplier = 1.0,
  paused = false,
  targetFps = 60,
  blurAmount = 0,
  className,
  onSurfaceChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvas1Ref = useRef<HTMLCanvasElement>(null);
  const canvas2Ref = useRef<HTMLCanvasElement>(null);
  const canvas3Ref = useRef<HTMLCanvasElement>(null);
  const canvas4Ref = useRef<HTMLCanvasElement>(null);
  const feTurbulenceRef = useRef<SVGFETurbulenceElement>(null);

  // 绘制 4 象限到 canvas
  const drawQuadrants = useCallback((src: string) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const { naturalWidth: w, naturalHeight: h } = img;
      const halfW = Math.floor(w / 2);
      const halfH = Math.floor(h / 2);

      const canvases = [
        canvas1Ref.current, canvas2Ref.current,
        canvas3Ref.current, canvas4Ref.current,
      ];
      const sx = [0, halfW, 0, halfW];
      const sy = [0, 0, halfH, halfH];

      canvases.forEach((canvas, i) => {
        if (!canvas) return;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
        ctx.drawImage(img, sx[i], sy[i], halfW, halfH, 0, 0, CANVAS_SIZE, CANVAS_SIZE);
      });

      // 随机 seed 让每次换图有不同湍流形态
      if (feTurbulenceRef.current) {
        feTurbulenceRef.current.setAttribute("seed", String(Math.floor(Math.random() * 1000)));
      }
    };
    img.src = src;
  }, []);

  // 当 imageUrl 变化时重绘
  useEffect(() => {
    if (imageUrl) {
      drawQuadrants(imageUrl);
    }
  }, [imageUrl, drawQuadrants]);

  const paintSurface = useCallback((target: HTMLCanvasElement, targetRect: DOMRect, offset: { x?: number; y?: number } = {}) => {
    const root = containerRef.current;
    const context = target.getContext("2d");
    if (!root || !context || targetRect.width <= 0 || targetRect.height <= 0) return;

    const rootRect = root.getBoundingClientRect();
    if (rootRect.width <= 0 || rootRect.height <= 0) return;

    const dpr = window.devicePixelRatio || 1;
    const pixelWidth = Math.max(1, Math.ceil(targetRect.width * dpr));
    const pixelHeight = Math.max(1, Math.ceil(targetRect.height * dpr));
    if (target.width !== pixelWidth || target.height !== pixelHeight) {
      target.width = pixelWidth;
      target.height = pixelHeight;
    }

    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, targetRect.width, targetRect.height);

    const rootTransform = readTransformMetrics(root);
    const offsetX = offset.x ?? 0;
    const offsetY = offset.y ?? 0;
    const canvases = [canvas1Ref.current, canvas2Ref.current, canvas3Ref.current, canvas4Ref.current];
    for (const canvas of canvases) {
      if (!canvas) continue;
      const sourceRect = canvas.getBoundingClientRect();
      if (sourceRect.width <= 0 || sourceRect.height <= 0) continue;

      const canvasTransform = readTransformMetrics(canvas);
      const layoutWidth = canvas.offsetWidth || sourceRect.width;
      const layoutHeight = canvas.offsetHeight || sourceRect.height;
      const drawWidth = layoutWidth * rootTransform.scaleX * canvasTransform.scaleX;
      const drawHeight = layoutHeight * rootTransform.scaleY * canvasTransform.scaleY;
      const centerX = sourceRect.left + sourceRect.width / 2 - targetRect.left + offsetX;
      const centerY = sourceRect.top + sourceRect.height / 2 - targetRect.top + offsetY;

      context.save();
      context.translate(centerX, centerY);
      context.rotate(rootTransform.rotation + canvasTransform.rotation);
      context.drawImage(canvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
      context.restore();
    }
  }, []);

  useEffect(() => {
    if (!enabled || !imageUrl || !containerRef.current) {
      onSurfaceChange?.(null);
      return;
    }

    let disposed = false;
    const sourceCanvases = [canvas1Ref.current, canvas2Ref.current, canvas3Ref.current, canvas4Ref.current]
      .filter((canvas): canvas is HTMLCanvasElement => Boolean(canvas));

    const surface: FluidSurfaceHandle = {
      sourceCanvases,
      sourceElement: containerRef.current,
      getRect: () => containerRef.current?.getBoundingClientRect() ?? new DOMRect(),
      paint: (target, targetRect, offset) => {
        if (!disposed) paintSurface(target, targetRect, offset);
      },
      dispose: () => {
        disposed = true;
      },
    };

    onSurfaceChange?.(surface);
    return () => {
      surface.dispose();
      onSurfaceChange?.(null);
    };
  }, [enabled, imageUrl, onSurfaceChange, paintSurface]);

  if (!enabled || !imageUrl) return null;

  return (
    <>
      {/* SVG 滤镜定义 (隐藏) */}
      <svg width="0" height="0" style={{ position: "absolute" }}>
        <filter
          id="svg-fluid-filter"
          x="-20%"
          y="-20%"
          width="140%"
          height="140%"
          filterUnits="objectBoundingBox"
          primitiveUnits="userSpaceOnUse"
          colorInterpolationFilters="sRGB"
        >
          <feTurbulence
            ref={feTurbulenceRef}
            type="fractalNoise"
            baseFrequency="0.005"
            numOctaves="1"
            seed="0"
            result="fluidNoise"
          />
          {/* 位移固定 400：原项目为音频驱动，未接音频时保持此值 */}
          <feDisplacementMap in="SourceGraphic" in2="fluidNoise" scale="400" />
        </filter>
      </svg>

      {/* 流体容器 */}
      <div
        className={`svg-fluid-background${className ? " " + className : ""}`}
        style={{
          backgroundImage: `url(${imageUrl})`,
          display: enabled ? undefined : "none",
          ["--svg-fluid-blur" as string]: `${Math.round(blurAmount * 64)}px`,
        }}
      >
        <div
          ref={containerRef}
          className={`svg-fluid-rect${paused ? " paused" : ""}`}
          style={{
            animationDuration: `${150 / speedMultiplier}s`,
            // 原项目帧率限制：150s 旋转 → fps*150 步；60s 块旋转 → fps*60 步
            ["--svg-fluid-steps-rect" as string]: `steps(${Math.round(targetFps * 150)})`,
            ["--svg-fluid-steps-block" as string]: `steps(${Math.round(targetFps * 60)})`,
          }}
        >
          <canvas ref={canvas1Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
          <canvas ref={canvas2Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
          <canvas ref={canvas3Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
          <canvas ref={canvas4Ref} className="svg-fluid-canvas" width={CANVAS_SIZE} height={CANVAS_SIZE} />
        </div>
      </div>
    </>
  );
};

export default SvgFluidRenderer;
