/**
 * NowPlayingDisc — 专辑封面（RNP 圆角方块样式）
 *
 * 尺寸：与左列等宽（100%）；封面彩色模糊阴影（可开关）。
 * rectangle=false 时为圆形 CD；blurShadow=false 时隐藏弥散阴影层。
 * 方形/圆形圆角与阴影开关均带平滑过渡。
 */

import { Music } from "lucide-react";
import type { RGB } from "@/utils/colorExtractor";

interface NowPlayingDiscProps {
  coverB64: string | null;
  coverColor: RGB | null;
  playing: boolean;
  /** 方形封面（默认 true 保持现状）；false = 圆形 CD */
  rectangle?: boolean;
  /** 封面弥散阴影（默认 true 保持现状） */
  blurShadow?: boolean;
}

const COVER_RADIUS = 18;

/** 封面圆角/阴影形状与显隐过渡 */
const DISC_TRANSITION = "0.5s cubic-bezier(0.22, 0.61, 0.36, 1)";

const SHADOW_IMG_TRANSITION = [
  "opacity", "border-radius", "inset", "width", "height",
].map((p) => `${p} ${DISC_TRANSITION}`).join(", ");

const SHADOW_DIV_TRANSITION = ["opacity", "border-radius"].map((p) => `${p} ${DISC_TRANSITION}`).join(", ");

export default function NowPlayingDisc({ coverB64, coverColor, playing, rectangle = true, blurShadow = true }: NowPlayingDiscProps) {
  const coverUrl = coverB64 ? `data:image/jpeg;base64,${coverB64}` : null;
  const fallbackGlow = coverColor
    ? `rgba(${coverColor[0]}, ${coverColor[1]}, ${coverColor[2]}, 0.5)`
    : "var(--np-disc-bg)";
  const radius = rectangle ? COVER_RADIUS : "50%";
  const shadowRadius = rectangle ? COVER_RADIUS + 8 : "50%";

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        aspectRatio: "1 / 1",
        flexShrink: 0,
      }}
    >
      {/* 封面彩色阴影：同一封面图模糊放大（常驻渲染，开关用透明度过渡） */}
      {coverUrl ? (
        <img
          src={coverUrl}
          alt=""
          aria-hidden
          style={{
            position: "absolute",
            inset: rectangle ? "-12%" : "-8%",
            width: rectangle ? "124%" : "116%",
            height: rectangle ? "124%" : "116%",
            objectFit: "cover",
            borderRadius: shadowRadius,
            filter: "blur(25px) saturate(1.3) brightness(1.2)",
            opacity: blurShadow ? 0.75 : 0,
            pointerEvents: "none",
            transition: SHADOW_IMG_TRANSITION,
          }}
        />
      ) : (
        <div
          style={{
            position: "absolute",
            inset: -18,
            borderRadius: shadowRadius,
            background: `radial-gradient(circle, ${fallbackGlow} 0%, transparent 70%)`,
            filter: "blur(25px)",
            opacity: blurShadow ? 1 : 0,
            pointerEvents: "none",
            transition: SHADOW_DIV_TRANSITION,
          }}
        />
      )}

      {/* 封面主体 */}
      <div
        className="np-disc"
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          borderRadius: radius,
          transition: `border-radius ${DISC_TRANSITION}`,
          overflow: "hidden",
          background: "var(--np-disc-bg)",
          boxShadow: "0 20px 60px rgba(0,0,0,0.55)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {coverUrl ? (
          <img src={coverUrl} alt="cover" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <Music size={64} style={{ color: "var(--text-tertiary)" }} />
        )}
      </div>
    </div>
  );
}
