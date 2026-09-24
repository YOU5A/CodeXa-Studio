/**
 * GlassGlow — Mouse-Following Dynamic Glow Effect
 *
 * Wraps children with a real-time cursor-tracking radial-gradient spotlight.
 * Uses direct DOM manipulation for zero-lag 60fps tracking.
 * The static background glow (glass-background-animated) is preserved independently.
 *
 * Does NOT use overflow:hidden — preserves box-shadows and overflow content.
 * The glow overlay is self-clipped via border-radius.
 *
 * Usage:
 *   <GlassGlow glowColor="rgba(255,255,255,0.15)" glowRadius={500}>
 *     <GlassCard>Mouse over me</GlassCard>
 *   </GlassGlow>
 */

import { type ReactNode, type CSSProperties } from "react";
import { useMouseGlow } from "@/hooks/useMouseGlow";
import { radii } from "../tokens";

export interface GlassGlowProps {
  children: ReactNode;
  /** Glow color — defaults to subtle white */
  glowColor?: string;
  /** Glow radius in px — defaults to 500 */
  glowRadius?: number;
  /** Border radius to clip the glow */
  borderRadius?: number | string;
  /** Optional additional container styles */
  style?: CSSProperties;
  /** Optional class for the wrapper */
  className?: string;
}

export function GlassGlow({
  children,
  glowColor = "rgba(255,255,255,0.12)",
  glowRadius = 600,
  borderRadius = radii.lg,
  style,
  className,
}: GlassGlowProps) {
  const { containerRef, overlayRef, containerProps } = useMouseGlow(
    glowColor,
    glowRadius
  );

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: "relative",
        borderRadius,
        ...style,
      }}
      {...containerProps}
    >
      {children}
      <div
        ref={overlayRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          borderRadius: "inherit",
        }}
      />
    </div>
  );
}

export default GlassGlow;