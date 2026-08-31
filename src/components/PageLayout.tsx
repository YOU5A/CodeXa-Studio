/**
 * PageLayout — 页面通用布局框架
 *
 * 提供统一的标题栏 + 滚动内容区 + 渐隐遮罩布局。
 * 覆盖 GlassMain 的 scroll-fade，Header 固定顶部，内容区独立滚动与渐隐。
 */

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { space, fontSizes } from "@/design-system";
import { useTheme } from "@/hooks/useTheme";
import { getAnimDuration, EASE_OUT } from "@/utils/animations";

export interface PageLayoutProps {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children: ReactNode;
}

const SCROLL_MASK =
  "linear-gradient(to bottom, transparent 0, black 48px, black calc(100% - 48px), transparent 100%)";

export default function PageLayout({ title, subtitle, actions, children }: PageLayoutProps) {
  const { settings } = useTheme();
  const animDuration = getAnimDuration(settings.animationSpeed);

  return (
    <motion.div
      className="page-layout"
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: animDuration, ease: EASE_OUT }}
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        maskImage: "none",
        WebkitMaskImage: "none",
      }}
    >
      {/* Header */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        paddingBottom: space[3],
        flexShrink: 0,
      }}>
        <div>
          <h2 className="page-title" style={{
            fontSize: fontSizes["2xl"], fontWeight: 600,
            color: "var(--text-primary)", margin: 0,
          }}>
            {title}
          </h2>
          <p className="page-subtitle" style={{
            fontSize: fontSizes.sm, color: "var(--text-tertiary)",
            margin: `${space[1]}px 0 0`,
          }}>
            {subtitle}
          </p>
        </div>
        {actions && (
          <div style={{ display: "flex", gap: space[2] }}>
            {actions}
          </div>
        )}
      </div>

      {/* Scroll Content */}
      <div style={{
        flex: 1, overflowY: "auto", minHeight: 0,
        marginRight: -24, paddingRight: 24,
        maskImage: SCROLL_MASK,
        WebkitMaskImage: SCROLL_MASK,
        paddingTop: 20,
      }}>
        {children}
      </div>
    </motion.div>
  );
}
