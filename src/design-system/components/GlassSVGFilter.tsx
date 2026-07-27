/**
 * GlassSVGFilter - Global Chromatic Aberration SVG Filter
 *
 * Injects a hidden <svg> with <filter id="glass-ca"> that provides
 * edge-only chromatic aberration for glass surfaces.
 *
 * - Uses feTurbulence to generate organic noise displacement maps
 * - Displaces R/G/B channels independently via feDisplacementMap
 * - Blends channels with screen mode for refractive fringe effect
 * - Radial gradient mask restricts the effect to edges only
 * - Extremely low scale (1-1.5px) to preserve text readability
 *
 * Rendered once in GlassLayout. All .glass-surface-ca elements
 * reference it via CSS filter: url(#glass-ca)
 */

import { memo } from "react";

const GlassSVGFilter = memo(function GlassSVGFilter() {
  return (
    <svg
      aria-hidden="true"
      style={{
        position: "absolute",
        width: 0,
        height: 0,
        overflow: "hidden",
        pointerEvents: "none",
      }}
    >
      <defs>
        {/* Edge mask: radial gradient - transparent at center, opaque at edges */}
        <radialGradient id="glass-ca-edge-mask" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="white" stopOpacity="0" />
          <stop offset="65%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="1" />
        </radialGradient>

        {/* Glass chromatic aberration filter */}
        <filter
          id="glass-ca"
          x="-10%"
          y="-10%"
          width="120%"
          height="120%"
          colorInterpolationFilters="sRGB"
        >
          {/* Generate organic noise for displacement */}
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.045"
            numOctaves="3"
            seed="7"
            result="noise"
          />

          {/* Convert noise to usable displacement map */}
          <feColorMatrix
            in="noise"
            type="matrix"
            values="0.35 0.35 0.35 0 0  0.35 0.35 0.35 0 0  0.35 0.35 0.35 0 0  0 0 0 1 0"
            result="displacement"
          />

          {/* Create soft edge mask from alpha channel */}
          <feGaussianBlur in="SourceAlpha" stdDeviation="8" result="blurredAlpha" />

          {/* Displace red channel slightly */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="displacement"
            scale="1.5"
            xChannelSelector="R"
            yChannelSelector="G"
            result="redDisplaced"
          />
          <feColorMatrix
            in="redDisplaced"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="redChannel"
          />

          {/* Displace green channel - slightly different offset */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="displacement"
            scale="1.2"
            xChannelSelector="R"
            yChannelSelector="B"
            result="greenDisplaced"
          />
          <feColorMatrix
            in="greenDisplaced"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="greenChannel"
          />

          {/* Displace blue channel - slightly different offset */}
          <feDisplacementMap
            in="SourceGraphic"
            in2="displacement"
            scale="1.0"
            xChannelSelector="R"
            yChannelSelector="B"
            result="blueDisplaced"
          />
          <feColorMatrix
            in="blueDisplaced"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="blueChannel"
          />

          {/* Combine RGB channels with screen blend */}
          <feBlend in="greenChannel" in2="blueChannel" mode="screen" result="gbCombined" />
          <feBlend in="redChannel" in2="gbCombined" mode="screen" result="rgbCombined" />

          {/* Slight blur to soften the aberration */}
          <feGaussianBlur in="rgbCombined" stdDeviation="0.3" result="aberratedBlurred" />

          {/* Mask: only apply aberration at edges using blurred alpha */}
          <feComposite in="aberratedBlurred" in2="invertedAlpha" operator="in" result="edgeAberration" />

          {/* Invert the edge mask for the center (original image) */}
          <feComponentTransfer in="blurredAlpha" result="invertedAlpha">
            <feFuncA type="table" tableValues="1 0" />
          </feComponentTransfer>

          {/* Center: original image preserved */}
          <feComposite in="SourceGraphic" in2="blurredAlpha" operator="in" result="centerOriginal" />

          {/* Final: blend edge aberration over center original */}
          <feBlend in="centerOriginal" in2="edgeAberration" mode="normal" />
        </filter>
      </defs>
    </svg>
  );
});

export default GlassSVGFilter;
