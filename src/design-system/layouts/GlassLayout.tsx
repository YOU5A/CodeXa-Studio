import { type ReactNode } from "react";
import { GlassBackground, type GlassBackgroundProps } from "./GlassBackground";
import GlassSVGFilter from "../components/GlassSVGFilter";

export interface GlassLayoutProps {
  children?: ReactNode;
  /** Background configuration */
  background?: GlassBackgroundProps;
  /** CSS class to add to the root shell */
  className?: string;
}

export function GlassLayout({
  children,
  background,
  className,
}: GlassLayoutProps) {
  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100%",
        isolation: "isolate",
      }}
    >
      {/* Global SVG filters for chromatic aberration */}
      <GlassSVGFilter />

      {/* FluidBackground is now rendered in AppContent with proper enabled control */}
      <GlassBackground {...background} />

      {/* Depth layer 2+: content shell with split backdrop/clip layers */}
      <div className={"app-root-backdrop" + (className ? " " + className : "")}>
        <div className="app-root">
          {children}
        </div>
      </div>
    </div>
  );
}

export default GlassLayout;