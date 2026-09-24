/**
 * LiquidGlassLens - 苹果 Liquid Glass 物理折射与色散水滴透镜
 *
 * 核心特性：
 * 1. 边缘物理折射：基于光学多项式曲率构建法线位移场，中心平坦清晰，边缘平滑弯曲凸透畸变
 * 2. 真实 3 通道色散：R / G / B 三通道以差异化折射率偏折，边缘呈现物理级彩虹分色光谱
 * 3. 边缘渐进霜化模糊：中心 0 模糊保留底层清晰度，边缘过渡至高斯柔焦磨砂质感
 * 4. 菲涅尔聚光与环境反光：左上角主高光弧 + 底部环境反光 + 边缘微色散光环
 * 5. 纯 GPU 硬件管线加速：位移贴图由 Canvas 离屏预计算缓存，拖拽时 60FPS 丝滑无卡顿
 */

import { memo, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface LiquidGlassLensProps {
  /** 是否处于激活状态 */
  active: boolean;
  /** 当前水滴中心 X 坐标 */
  x: number;
  /** 当前水滴中心 Y 坐标 */
  y: number;
  /** 水滴半径，默认 85px */
  radius?: number;
  /** 是否处于拖动状态 (影响弹性拉伸) */
  isDragging?: boolean;
}

/**
 * 生成水滴透镜的光学法线位移贴图与边缘遮罩
 * - R 通道：水平 X 位移（128 为中性 0 偏移）
 * - G 通道：垂直 Y 位移（128 为中性 0 偏移）
 * - B 通道：边缘模糊渐进遮罩（0 中心无模糊，255 边缘全模糊）
 * - A 通道：透镜几何裁剪蒙版
 */
function generateLensMap(size: number): string {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const imgData = ctx.createImageData(size, size);
  const data = imgData.data;
  const radius = size / 2;
  const cx = radius;
  const cy = radius;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x + 0.5 - cx;
      const dy = y + 0.5 - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      const u = r / radius;

      if (u >= 1.0) {
        data[idx] = 128;
        data[idx + 1] = 128;
        data[idx + 2] = 0;
        data[idx + 3] = 0;
        continue;
      }

      const nx = r > 0.001 ? dx / r : 0;
      const ny = r > 0.001 ? dy / r : 0;

      // 连续光学多项式曲率模型：D(u) = (0.22 * u + 0.78 * u^2.5) * taper
      // 外沿 0.90 ~ 1.0 处平滑过渡归零，保证与外部环境无缝融合不撕裂
      let taper = 1.0;
      if (u > 0.90) {
        taper = Math.sin(((1.0 - u) / 0.1) * Math.PI * 0.5);
      }
      const dispMagnitude = (0.22 * u + 0.78 * Math.pow(u, 2.5)) * taper;

      // 径向向内采样 = 图像向边缘凸透弯曲放大
      const rVal = Math.round(128 + 127 * (-nx * dispMagnitude));
      const gVal = Math.round(128 + 127 * (-ny * dispMagnitude));

      // 边缘模糊遮罩（B 通道）：中心 u < 0.38 保持 0，向边缘平滑升至 255
      let edgeBlur = 0;
      if (u > 0.38) {
        const tb = (u - 0.38) / (1.0 - 0.38);
        edgeBlur = Math.round(255 * (tb * tb * (3 - 2 * tb)));
      }

      data[idx] = rVal;
      data[idx + 1] = gVal;
      data[idx + 2] = edgeBlur;
      data[idx + 3] = 255;
    }
  }

  ctx.putImageData(imgData, 0, 0);
  return canvas.toDataURL("image/png");
}

export const LiquidGlassLens = memo(function LiquidGlassLens({
  active,
  x,
  y,
  radius = 85,
  isDragging = false,
}: LiquidGlassLensProps) {
  const size = radius * 2;

  // 缓存位移贴图，仅在透镜尺寸改变时重新生成
  const mapUrl = useMemo(() => {
    if (typeof document === "undefined") return "";
    return generateLensMap(size);
  }, [size]);

  return (
    <>
      {/* 隐藏的物理折射、色散与边缘渐进模糊 SVG 滤镜定义 */}
      <svg
        aria-hidden="true"
        style={{
          position: "fixed",
          width: 0,
          height: 0,
          overflow: "hidden",
          pointerEvents: "none",
          zIndex: -1,
        }}
      >
        <defs>
          <filter
            id="liquid-glass-lens-filter"
            filterUnits="userSpaceOnUse"
            primitiveUnits="userSpaceOnUse"
            x="0"
            y="0"
            width={size}
            height={size}
            colorInterpolationFilters="sRGB"
          >
            {mapUrl && (
              <feImage
                href={mapUrl}
                xlinkHref={mapUrl}
                x="0"
                y="0"
                width={size}
                height={size}
                result="dispMap"
              />
            )}

            {/* 1. 物理色散 3 通道边缘折射（RGB 差异化偏折率） */}
            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale="22"
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispR"
            />
            <feColorMatrix
              in="dispR"
              type="matrix"
              values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="redOnly"
            />

            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale="26"
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispG"
            />
            <feColorMatrix
              in="dispG"
              type="matrix"
              values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
              result="greenOnly"
            />

            <feDisplacementMap
              in="SourceGraphic"
              in2="dispMap"
              scale="30"
              xChannelSelector="R"
              yChannelSelector="G"
              result="dispB"
            />
            <feColorMatrix
              in="dispB"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
              result="blueOnly"
            />

            {/* 重组 RGB 通道 */}
            <feComposite in="redOnly" in2="greenOnly" operator="arithmetic" k2="1" k3="1" result="rgCombined" />
            <feComposite in="rgCombined" in2="blueOnly" operator="arithmetic" k2="1" k3="1" result="refracted" />

            {/* 2. 边缘渐进霜化模糊：高斯模糊层与 B 通道边缘遮罩智能合成 */}
            <feGaussianBlur in="refracted" stdDeviation="5.5" result="blurredRefracted" />

            {/* 提取 B 通道到 Alpha 得到 edgeMask */}
            <feColorMatrix
              in="dispMap"
              type="matrix"
              values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 1 0 0"
              result="edgeMask"
            />

            {/* 边缘区域保留霜化模糊 */}
            <feComposite in="blurredRefracted" in2="edgeMask" operator="in" result="edgeBlurredPass" />

            {/* 中心区域反向遮罩保留清晰折射 */}
            <feComponentTransfer in="edgeMask" result="centerMask">
              <feFuncA type="table" tableValues="1 0" />
            </feComponentTransfer>
            <feComposite in="refracted" in2="centerMask" operator="in" result="sharpCenterPass" />

            {/* 合成中心清晰 + 边缘模糊 */}
            <feComposite in="sharpCenterPass" in2="edgeBlurredPass" operator="over" />
          </filter>
        </defs>
      </svg>

      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{
              scale: isDragging ? [1, 1.03, 1] : 1,
              opacity: 1,
            }}
            exit={{ scale: 0, opacity: 0, transition: { duration: 0.18, ease: "easeIn" } }}
            transition={{
              type: "spring",
              damping: 20,
              stiffness: 280,
              mass: 0.6,
            }}
            style={{
              position: "fixed",
              left: x - radius,
              top: y - radius,
              width: size,
              height: size,
              borderRadius: "50%",
              pointerEvents: "none",
              zIndex: 999999,
              willChange: "transform, left, top",
              overflow: "hidden",
              /* 水滴物理外围阴影与立体边缘凹凸高光 */
              boxShadow: `
                0 20px 45px -10px rgba(0, 0, 0, 0.55),
                0 4px 20px rgba(0, 113, 227, 0.25),
                inset 0 0 0 1px rgba(255, 255, 255, 0.45),
                inset 0 2px 4px 0 rgba(255, 255, 255, 0.75),
                inset 0 -2px 6px 0 rgba(0, 0, 0, 0.25)
              `,
            }}
          >
            {/* 1. 物理折射与边缘渐进模糊层 */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                backdropFilter: "url(#liquid-glass-lens-filter) contrast(1.05) saturate(1.15)",
                WebkitBackdropFilter: "url(#liquid-glass-lens-filter) contrast(1.05) saturate(1.15)",
                pointerEvents: "none",
              }}
            />

            {/* 2. 左上角主菲涅尔聚光弧 (Specular Highlight) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: `radial-gradient(
                  circle at 35% 28%,
                  rgba(255, 255, 255, 0.72) 0%,
                  rgba(255, 255, 255, 0.15) 30%,
                  transparent 60%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* 3. 底部环境二次反光弧 (Bottom Rim Light) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: `radial-gradient(
                  circle at 65% 82%,
                  rgba(255, 255, 255, 0.32) 0%,
                  rgba(255, 255, 255, 0.06) 32%,
                  transparent 52%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* 4. 边缘透镜暗角圈 (Edge Vignette) */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                borderRadius: "inherit",
                background: `radial-gradient(
                  circle at 50% 50%,
                  transparent 62%,
                  rgba(0, 0, 0, 0.02) 78%,
                  rgba(0, 0, 0, 0.12) 100%
                )`,
                pointerEvents: "none",
              }}
            />

            {/* 5. 边缘彩虹微色散轮廓光环 (RGB Dispersion Ring) */}
            <div
              style={{
                position: "absolute",
                inset: 1,
                borderRadius: "inherit",
                padding: 1.5,
                background: `conic-gradient(
                  from 180deg at 50% 50%,
                  rgba(255, 95, 109, 0.45) 0deg,
                  rgba(255, 255, 255, 0.85) 45deg,
                  rgba(56, 189, 248, 0.55) 120deg,
                  rgba(192, 132, 252, 0.45) 220deg,
                  rgba(255, 95, 109, 0.45) 360deg
                )`,
                WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                WebkitMaskComposite: "xor",
                maskComposite: "exclude",
                pointerEvents: "none",
                opacity: 0.85,
              }}
            />

            {/* 6. 中心水滴微聚光透光点 */}
            <div
              style={{
                position: "absolute",
                top: "50%",
                left: "50%",
                transform: "translate(-50%, -50%)",
                width: "55%",
                height: "55%",
                borderRadius: "50%",
                background: "radial-gradient(circle, rgba(255,255,255,0.08) 0%, transparent 75%)",
                pointerEvents: "none",
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});

export default LiquidGlassLens;
