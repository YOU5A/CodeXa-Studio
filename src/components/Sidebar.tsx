import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence, useMotionValue, useSpring, animate } from "framer-motion";
import { springSnappy, GlassSurface, GlassTooltip } from "@/design-system";
import {
  LayoutDashboard, Cpu, Gauge, Music, MonitorCog, Settings, FileAudio,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/hooks/useTheme";
import { useDevUnlock } from "@/developer-unlock";
import { useConfirm } from "@/contexts/ConfirmContext";
import type { Page, Language } from "@/types";
import { APP_VERSION } from "@/version";
import type { FluidSurfaceHandle } from "@/components/FluidBackground";
import type { FluidSettingsValues } from "@/components/FluidSettingsPanel";

interface SidebarProps {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  onPreload?: (page: Page) => void;
  onVersionTrigger?: () => void;
  fluidSurface?: FluidSurfaceHandle | null;
  backgroundType?: FluidSettingsValues["backgroundType"];
}

interface ClickTip {
  x: number;
  y: number;
  text: string;
}

const navLabels: Record<Language, Record<Page, string>> = {
  zh: {
    dashboard: "仪表盘",
    win32priority: "Win32 优先级",
    appcpupriority: "应用 CPU 优先级",
    musicmanager: "音乐管理器",
    backupcenter: "显卡名称",
    ncmstudio: "NCM 解码",
    settings: "设置",
  },
  en: {
    dashboard: "Dashboard",
    win32priority: "Win32 Priority",
    appcpupriority: "App CPU Priority",
    musicmanager: "Music Manager",
    backupcenter: "GPU Name",
    ncmstudio: "NCM Studio",
    settings: "Settings",
  },
};

const navItems: { id: Page; icon: React.ReactNode }[] = [
  { id: "dashboard", icon: <LayoutDashboard size={18} /> },
  { id: "backupcenter", icon: <MonitorCog size={18} /> },
  { id: "win32priority", icon: <Cpu size={18} /> },
  { id: "appcpupriority", icon: <Gauge size={18} /> },
  { id: "musicmanager", icon: <Music size={18} /> },
  { id: "ncmstudio", icon: <FileAudio size={18} /> },
  { id: "settings", icon: <Settings size={18} /> },
];

const FLUID_CANVAS_ZOOM = 1.075;

function updateItemGlow(el: HTMLElement, cx: number, cy: number) {
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return;
  const px = ((cx - r.left) / r.width) * 100;
  const py = ((cy - r.top) / r.height) * 100;
  el.style.setProperty("--btn-gx", px + "%");
  el.style.setProperty("--btn-gy", py + "%");
  el.style.setProperty("--btn-go", "1");
}

function clearItemGlow(el: HTMLElement) {
  el.style.setProperty("--btn-go", "0");
}

const SIDEBAR_LENS_MAP_WIDTH = 512;
const SIDEBAR_LENS_MAP_HEIGHT = 128;

function generateSidebarLensMap(): string {
  if (typeof document === "undefined") return "";

  const canvas = document.createElement("canvas");
  canvas.width = SIDEBAR_LENS_MAP_WIDTH;
  canvas.height = SIDEBAR_LENS_MAP_HEIGHT;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";

  const image = ctx.createImageData(canvas.width, canvas.height);
  const data = image.data;
  const cx = canvas.width / 2;
  const cy = canvas.height / 2;

  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const index = (y * canvas.width + x) * 4;
      const nx = (x + 0.5 - cx) / cx;
      const ny = (y + 0.5 - cy) / cy;
      const radius = Math.sqrt(nx * nx + ny * ny);

      if (radius >= 1) {
        data[index] = 128;
        data[index + 1] = 128;
        data[index + 2] = 0;
        // 由胶囊本身的 border-radius 负责裁切，位移图保持不透明避免滤镜内圈出现锯齿。
        data[index + 3] = 255;
        continue;
      }

      const taper = radius > 0.88
        ? Math.sin(((1 - radius) / 0.12) * Math.PI * 0.5)
        : 1;
      const magnitude = (0.18 * radius + 0.82 * Math.pow(radius, 2.2)) * taper;
      const length = Math.max(radius, 0.001);
      const rValue = Math.round(128 - 127 * (nx / length) * magnitude);
      const gValue = Math.round(128 - 127 * (ny / length) * magnitude);
      const edgeMask = radius > 0.34
        ? Math.round(255 * Math.min(1, ((radius - 0.34) / 0.66) ** 2))
        : 0;

      data[index] = rValue;
      data[index + 1] = gValue;
      data[index + 2] = edgeMask;
      data[index + 3] = 255;
    }
  }

  ctx.putImageData(image, 0, 0);
  return canvas.toDataURL("image/png");
}

function SidebarLiquidLensFilter() {
  const mapUrl = useMemo(() => generateSidebarLensMap(), []);

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
        <filter
          id="sidebar-liquid-refract"
          filterUnits="objectBoundingBox"
          primitiveUnits="objectBoundingBox"
          x="-0.18"
          y="-0.45"
          width="1.36"
          height="1.9"
          colorInterpolationFilters="sRGB"
        >
          {mapUrl && (
            <feImage
              href={mapUrl}
              xlinkHref={mapUrl}
              x="0"
              y="0"
              width="1"
              height="1"
              preserveAspectRatio="none"
              result="sidebarDispMap"
            />
          )}
          <feDisplacementMap
            in="SourceGraphic"
            in2="sidebarDispMap"
            scale="0.12"
            xChannelSelector="R"
            yChannelSelector="G"
            result="sidebarDispR"
          />
          <feColorMatrix
            in="sidebarDispR"
            type="matrix"
            values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="sidebarRed"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="sidebarDispMap"
            scale="0.145"
            xChannelSelector="R"
            yChannelSelector="G"
            result="sidebarDispG"
          />
          <feColorMatrix
            in="sidebarDispG"
            type="matrix"
            values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0"
            result="sidebarGreen"
          />
          <feDisplacementMap
            in="SourceGraphic"
            in2="sidebarDispMap"
            scale="0.17"
            xChannelSelector="R"
            yChannelSelector="G"
            result="sidebarDispB"
          />
          <feColorMatrix
            in="sidebarDispB"
            type="matrix"
            values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0"
            result="sidebarBlue"
          />
          <feBlend in="sidebarRed" in2="sidebarGreen" mode="screen" result="sidebarRG" />
          <feBlend in="sidebarRG" in2="sidebarBlue" mode="screen" result="sidebarRGB" />
          <feBlend in="SourceGraphic" in2="sidebarRGB" mode="normal" />
        </filter>
      </defs>
    </svg>
  );
}

function SidebarItemGlow() {
  return (
    <div className="sidebar-nav-item-glow" aria-hidden="true">
      <span className="glow-apex" />
      <span className="glow-rim" />
      <span className="glow-specular" />
      <span className="glow-diffuse" />
    </div>
  );
}

export default function Sidebar({ currentPage, onNavigate, onPreload, onVersionTrigger, fluidSurface, backgroundType = "fluid" }: SidebarProps) {
  const { lang } = useLanguage();
  const { settings } = useTheme();
  const { isDeveloperMode, registerVersionClick, lock } = useDevUnlock();
  const { confirm } = useConfirm();
  const [clickTip, setClickTip] = useState<ClickTip | null>(null);
  const [hoveredNavId, setHoveredNavId] = useState<Page | null>(null);
  const [isHoverFading, setIsHoverFading] = useState(false);
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tipKeyRef = useRef(0);
  const tipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 列表容器与各个条目的 DOM 引用
  const listRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Partial<Record<Page, HTMLButtonElement | null>>>({});

  // 长按拖动与选中胶囊动画状态
  const [isDragging, setIsDragging] = useState(false);
  const [dragTargetId, setDragTargetId] = useState<Page | null>(null);
  const [pillHeight, setPillHeight] = useState(36);
  const pillTargetY = useMotionValue(0);
  const pillY = useSpring(pillTargetY, { stiffness: 250, damping: 30, mass: 0.85 });

  // 水滴液体物理拉伸与晃动弹簧 (带有轻微欠阻尼，停下时会产生自然的水滴弹性晃动)
  const rawScaleX = useMotionValue(1);
  const rawScaleY = useMotionValue(1);
  const liquidScaleX = useSpring(rawScaleX, { stiffness: 320, damping: 30, mass: 0.55 });
  const liquidScaleY = useSpring(rawScaleY, { stiffness: 280, damping: 24, mass: 0.65 });

  const lastMoveInfoRef = useRef<{ y: number; time: number }>({ y: 0, time: 0 });
  const stopJiggleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isDraggingRef = useRef(false);
  const dragTargetIdRef = useRef<Page | null>(null);
  const dragJustEndedRef = useRef(false);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStartInfoRef = useRef<{ startX: number; startY: number; pageId: Page } | null>(null);
  const isMountedRef = useRef(false);
  const fluidCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const fluidPaintFrameRef = useRef<number | null>(null);

  const stopFluidPaint = useCallback(() => {
    if (fluidPaintFrameRef.current !== null) {
      cancelAnimationFrame(fluidPaintFrameRef.current);
      fluidPaintFrameRef.current = null;
    }
    const canvas = fluidCanvasRef.current;
    if (canvas) {
      const context = canvas.getContext("2d");
      context?.clearRect(0, 0, canvas.width, canvas.height);
      canvas.width = 1;
      canvas.height = 1;
    }
  }, []);

  const paintFluidFrame = useCallback(() => {
    if (!isDraggingRef.current || !fluidSurface || !fluidCanvasRef.current) {
      fluidPaintFrameRef.current = null;
      return;
    }

    const canvas = fluidCanvasRef.current;
    // canvas 本身带有凸透放大，采样区域先还原到放大前的屏幕尺寸，
    // 避免把 1.075 倍缩放重复计入流体纹理坐标。
    const transformedRect = canvas.getBoundingClientRect();
    const unscaledWidth = transformedRect.width / FLUID_CANVAS_ZOOM;
    const unscaledHeight = transformedRect.height / FLUID_CANVAS_ZOOM;
    const targetRect = new DOMRect(
      transformedRect.left + (transformedRect.width - unscaledWidth) / 2,
      transformedRect.top + (transformedRect.height - unscaledHeight) / 2,
      unscaledWidth,
      unscaledHeight,
    );
    fluidSurface.paint(canvas, targetRect, { x: 12 });
    fluidPaintFrameRef.current = requestAnimationFrame(paintFluidFrame);
  }, [fluidSurface]);

  useEffect(() => {
    stopFluidPaint();
    if (!isDragging || !fluidSurface) return;
    fluidPaintFrameRef.current = requestAnimationFrame(paintFluidFrame);
    return stopFluidPaint;
  }, [isDragging, fluidSurface, paintFluidFrame, stopFluidPaint]);

  // 清理所有计时器
  useEffect(() => {
    return () => {
      if (tipTimerRef.current) clearTimeout(tipTimerRef.current);
      if (fadeTimerRef.current) clearTimeout(fadeTimerRef.current);
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (stopJiggleTimerRef.current) clearTimeout(stopJiggleTimerRef.current);
      stopFluidPaint();
    };
  }, [stopFluidPaint]);

  // 获取特定页面的 DOM 几何位置
  const getItemMetrics = useCallback((page: Page) => {
    const el = itemRefs.current[page];
    if (!el || !listRef.current) return null;
    return {
      top: el.offsetTop,
      height: el.offsetHeight,
      centerY: el.offsetTop + el.offsetHeight / 2,
    };
  }, []);

  // 根据列表相对 Y 坐标寻找最接近的条目
  const findItemByY = useCallback((y: number) => {
    const visible = navItems.filter((item) => item.id !== "ncmstudio" || isDeveloperMode);
    let closestPage: Page = currentPage;
    let minDiff = Infinity;
    for (const item of visible) {
      const el = itemRefs.current[item.id];
      if (!el) continue;
      const centerY = el.offsetTop + el.offsetHeight / 2;
      const diff = Math.abs(y - centerY);
      if (diff < minDiff) {
        minDiff = diff;
        closestPage = item.id;
      }
    }
    return closestPage;
  }, [currentPage, isDeveloperMode]);

  // 当当前页面改变、紧凑模式切换或开发者模式切换时，同步选中胶囊位置
  useEffect(() => {
    if (isDraggingRef.current) return;
    const updatePos = () => {
      const metrics = getItemMetrics(currentPage);
      if (metrics) {
        setPillHeight(metrics.height);
        if (!isMountedRef.current) {
          pillTargetY.set(metrics.top);
          isMountedRef.current = true;
        } else {
          animate(pillTargetY, metrics.top, {
            type: "spring",
            stiffness: 380,
            damping: 30,
            mass: 0.8,
          });
        }
      }
    };
    const raf = requestAnimationFrame(updatePos);
    return () => cancelAnimationFrame(raf);
  }, [currentPage, settings.compactMode, isDeveloperMode, getItemMetrics, pillTargetY]);

  // 激活长按拖拽模式 (计算胶囊 Y 坐标)
  const activateDrag = useCallback((clientY: number) => {
    if (isDraggingRef.current) return;
    isDraggingRef.current = true;
    setIsDragging(true);
    Object.values(itemRefs.current).forEach((el) => {
      if (el) clearItemGlow(el);
    });
    lastMoveInfoRef.current = { y: clientY, time: performance.now() };

    // 激活瞬间轻微压扁，宽度不超过侧边栏边界
    rawScaleX.set(1);
    rawScaleY.set(0.97);
    setTimeout(() => {
      rawScaleX.set(1);
      rawScaleY.set(1);
    }, 50);

    if (listRef.current) {
      const listRect = listRef.current.getBoundingClientRect();
      const relativeY = clientY - listRect.top;
      const metrics = getItemMetrics(currentPage);
      const h = metrics ? metrics.height : 36;
      const dragH = h + 16;

      const minTop = 0;
      const maxTop = Math.max(minTop, listRect.height - dragH);

      const targetY = Math.max(minTop, Math.min(maxTop, relativeY - dragH / 2));
      pillTargetY.set(targetY);

      const hit = findItemByY(relativeY);
      dragTargetIdRef.current = hit;
      setDragTargetId(hit);
      onPreload?.(hit);
    }
  }, [currentPage, isDeveloperMode, getItemMetrics, findItemByY, onPreload, pillTargetY, rawScaleX, rawScaleY]);

  // 指针按下：判定短按点击 vs 长按拖动
  const handlePointerDown = useCallback((e: React.PointerEvent, page: Page) => {
    if (e.button !== 0) return;

    const startX = e.clientX;
    const startY = e.clientY;
    dragStartInfoRef.current = { startX, startY, pageId: page };

    // 160ms 长按检测定时器
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      activateDrag(startY);
    }, 160);

    const handlePointerMove = (moveEvent: PointerEvent) => {
      if (!dragStartInfoRef.current) return;

      const deltaX = Math.abs(moveEvent.clientX - startX);
      const deltaY = Math.abs(moveEvent.clientY - startY);

      if (!isDraggingRef.current) {
        // 拖动位移超过阈值立即进入拖拽模式
        if (deltaY > 5 || (deltaY > 3 && deltaY > deltaX)) {
          if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
          }
          activateDrag(moveEvent.clientY);
        }
        return;
      }

      // 处于拖拽状态
      moveEvent.preventDefault();

      // 水滴液体物理微拉伸与速度计算
      const now = performance.now();
      const dt = Math.max(1, now - lastMoveInfoRef.current.time);
      const dy = moveEvent.clientY - lastMoveInfoRef.current.y;
      lastMoveInfoRef.current = { y: moveEvent.clientY, time: now };

      const speed = Math.abs(dy / dt);
      const stretch = Math.min(0.08, speed * 0.030);
      rawScaleY.set(1 + stretch);
      rawScaleX.set(Math.max(0.97, 1 - stretch * 0.35));

      // 拖动骤停检测：40ms 无位移判定为物理骤停，触发自然水滴轻微晃动 (Jiggle / Wobble)
      if (stopJiggleTimerRef.current) clearTimeout(stopJiggleTimerRef.current);
      stopJiggleTimerRef.current = setTimeout(() => {
        if (!isDraggingRef.current) return;
        const currentY = rawScaleY.get();
        const currentX = rawScaleX.get();
        animate(rawScaleY, [currentY, 0.96, 1.04, 0.98, 1.01, 1], {
          duration: 0.38,
          ease: "easeOut",
        });
        animate(rawScaleX, [currentX, 0.99, 1, 0.995, 1], {
          duration: 0.38,
          ease: "easeOut",
        });
      }, 40);

      if (!listRef.current) return;
      const listRect = listRef.current.getBoundingClientRect();
      const relativeY = moveEvent.clientY - listRect.top;

      const minTop = 0;

      const currentMetrics = getItemMetrics(currentPage);
      const h = currentMetrics ? currentMetrics.height : 36;
      const dragH = h + 16;
      const maxTop = Math.max(minTop, listRect.height - dragH);
      const targetY = Math.max(minTop, Math.min(maxTop, relativeY - dragH / 2));
      pillTargetY.set(targetY);

      // 计算当前命中条目（“拖到那里选中那里”）
      const hit = findItemByY(relativeY);
      if (hit !== dragTargetIdRef.current) {
        dragTargetIdRef.current = hit;
        setDragTargetId(hit);
        onPreload?.(hit);
      }
    };

    const handlePointerUp = () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);

      if (isDraggingRef.current) {
        dragJustEndedRef.current = true;
        setTimeout(() => {
          dragJustEndedRef.current = false;
        }, 140);

        if (stopJiggleTimerRef.current) {
          clearTimeout(stopJiggleTimerRef.current);
          stopJiggleTimerRef.current = null;
        }
        animate(rawScaleY, 1, { duration: 0.18, ease: "easeOut" });
        animate(rawScaleX, 1, { duration: 0.18, ease: "easeOut" });

        const finalPage = dragTargetIdRef.current || page;
        isDraggingRef.current = false;
        setIsDragging(false);
        setDragTargetId(null);

        // 弹簧吸附至目标项，兼具水滴入水弹性
        const finalMetrics = getItemMetrics(finalPage);
        if (finalMetrics) {
          animate(pillTargetY, finalMetrics.top, {
            type: "spring",
            stiffness: 440,
            damping: 26,
            mass: 0.7,
          });
        }

        // 确认切换到该项
        onNavigate(finalPage);
      }

      dragStartInfoRef.current = null;
    };

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);
  }, [activateDrag, currentPage, getItemMetrics, findItemByY, onPreload, onNavigate, pillTargetY, rawScaleX, rawScaleY]);

  const handleItemEnter = useCallback((id: Page) => {
    if (isDraggingRef.current) return;
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
      fadeTimerRef.current = null;
    }
    setIsHoverFading(false);
    setHoveredNavId(id);
    onPreload?.(id);
  }, [onPreload]);

  const handleListLeave = useCallback(() => {
    Object.values(itemRefs.current).forEach((el) => {
      if (el) clearItemGlow(el);
    });
    if (isDraggingRef.current) return;
    if (!hoveredNavId) return;
    setIsHoverFading(true);
    if (fadeTimerRef.current) {
      clearTimeout(fadeTimerRef.current);
    }
    fadeTimerRef.current = setTimeout(() => {
      setHoveredNavId(null);
      setIsHoverFading(false);
      fadeTimerRef.current = null;
    }, 280);
  }, [hoveredNavId]);

  const handleItemMouseMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    if (isDraggingRef.current) return;
    updateItemGlow(e.currentTarget, e.clientX, e.clientY);
  }, []);

  const handleItemMouseEnter = useCallback((e: React.MouseEvent<HTMLButtonElement>, id: Page) => {
    handleItemEnter(id);
    if (isDraggingRef.current) return;
    updateItemGlow(e.currentTarget, e.clientX, e.clientY);
  }, [handleItemEnter]);

  const handleItemMouseLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    clearItemGlow(e.currentTarget);
  }, []);

  const handleVersionClick = useCallback(async (e: React.MouseEvent) => {
    if (isDeveloperMode) {
      const ok = await confirm({
        title: lang === "zh" ? "退出开发者模式？" : "Exit Developer Mode?",
        confirmLabel: lang === "zh" ? "退出" : "Exit",
        cancelLabel: lang === "zh" ? "取消" : "Cancel",
        danger: true,
      });
      if (ok) await lock();
      return;
    }

    const { remaining, triggered } = registerVersionClick();
    if (triggered) {
      if (tipTimerRef.current) { clearTimeout(tipTimerRef.current); tipTimerRef.current = null; }
      setClickTip(null);
      onVersionTrigger?.();
      return;
    }

    if (tipTimerRef.current) {
      clearTimeout(tipTimerRef.current);
      tipTimerRef.current = null;
    }

    const msg = lang === "zh"
      ? `还需点击 ${remaining} 次`
      : `${remaining} more clicks`;
    const offsetX = (Math.random() - 0.5) * 48;
    const offsetY = (Math.random() - 0.5) * 20;
    tipKeyRef.current++;
    setClickTip({
      x: e.clientX + 16 + offsetX,
      y: e.clientY - 40 + offsetY,
      text: msg,
    });

    tipTimerRef.current = setTimeout(() => {
      tipTimerRef.current = null;
      setClickTip(null);
    }, 1500);
  }, [isDeveloperMode, registerVersionClick, onVersionTrigger, lang, confirm, lock]);

  return (
    <GlassSurface
      tier="regular"
      styleOverrides={{ radius: 0, shadow: "none" }}
      style={{
        width: "var(--sidebar-width)",
        minWidth: 180,
        maxWidth: 320,
        display: "flex",
        flexDirection: "column",
        padding: settings.compactMode ? "8px 8px" : "12px 10px",
        borderRight: "1px solid var(--border-color)",
        borderTop: "none",
        borderBottom: "none",
        borderLeft: "none",
        gap: settings.compactMode ? 3 : 5,
        flexShrink: 0,
        borderRadius: 0,
      }}
      onMouseLeave={handleListLeave}
    >
      <div
        ref={listRef}
        className={`sidebar-nav-list${isDragging ? " is-dragging" : ""}`}
        onMouseLeave={handleListLeave}
        style={{ gap: settings.compactMode ? 3 : 5 }}
      >
        <SidebarLiquidLensFilter />

        {/* 拖拽态透镜先绘制在导航内容下方，避免滤镜覆盖文字和图标 */}
        <motion.div
          className={`sidebar-nav-active-pill${isDragging ? " dragging" : ""}${isDragging && fluidSurface ? " fluid" : ""}${isDragging ? ` ${backgroundType}` : ""}`}
          animate={{
            left: 0,
            right: 0,
            height: isDragging ? pillHeight + 16 : pillHeight,
          }}
          style={{
            top: 0,
            y: pillY,
            scaleX: liquidScaleX,
            scaleY: liquidScaleY,
          }}
          transition={{
            left: { type: "spring", stiffness: 420, damping: 28 },
            right: { type: "spring", stiffness: 420, damping: 28 },
            height: { type: "spring", stiffness: 420, damping: 28 },
          }}
          aria-hidden="true"
        >
          {isDragging && (
            <>
              {fluidSurface && (
                <canvas
                  ref={fluidCanvasRef}
                  className="sidebar-nav-active-pill-fluid"
                  aria-hidden="true"
                />
              )}
              <span className="sidebar-nav-active-pill-refract" />
              <span className="sidebar-nav-active-pill-edge-blur" />
            </>
          )}
        </motion.div>

        {navItems.map((item) => {
          if (item.id === "ncmstudio" && !isDeveloperMode) return null;
          const isItemActive = currentPage === item.id;
          const isDragTarget = isDragging && dragTargetId === item.id;
          const isHovered = hoveredNavId === item.id && !isDragging;
          const isNewNcm = item.id === "ncmstudio";
          return (
            <motion.button
              key={item.id}
              ref={(el) => {
                itemRefs.current[item.id] = el;
              }}
              className={`sidebar-nav-item${isItemActive && !isDragging ? " active" : ""}${isDragTarget ? " drag-target" : ""}${isHovered && !isHoverFading ? " hovered" : ""}`}
              onPointerDown={(e) => handlePointerDown(e, item.id)}
              onClick={() => {
                if (dragJustEndedRef.current || isDraggingRef.current) return;
                onNavigate(item.id);
              }}
              onMouseEnter={(e) => handleItemMouseEnter(e, item.id)}
              onMouseMove={handleItemMouseMove}
              onMouseLeave={handleItemMouseLeave}
              initial={isNewNcm ? { opacity: 0, y: -10 } : undefined}
              animate={isNewNcm ? { opacity: 1, y: 0 } : undefined}
              transition={isNewNcm ? springSnappy : undefined}
              style={{
                padding: settings.compactMode ? "7px 14px" : "9px 16px",
                fontSize: settings.compactMode ? 12 : 13,
              }}
              data-nav-id={item.id}
            >
              {/* 鼠标悬停时的平滑滑动胶囊指示器 (拖拽时不显示) */}
              {isHovered && (
                <motion.div
                  layoutId="sidebar-hover-pill"
                  className={`sidebar-nav-hover-pill${isHoverFading ? " fading" : ""}`}
                  transition={{
                    type: "spring",
                    stiffness: 320,
                    damping: 28,
                    mass: 0.8,
                  }}
                />
              )}

              {/* 跟随鼠标移动最新 Liquid Glass 光晕 (非拖拽态显现) */}
              {!isDragging && <SidebarItemGlow />}

              <span
                className="sidebar-nav-icon"
                style={{
                  color: isDragTarget || isItemActive ? "var(--text-primary)" : undefined,
                  transition: "color 0.16s ease",
                }}
              >
                {item.icon}
              </span>
              <span
                className="sidebar-nav-label"
                style={{
                  color: isDragTarget || isItemActive ? "var(--text-primary)" : undefined,
                  fontWeight: isDragTarget || isItemActive ? 600 : 500,
                  transition: "color 0.16s ease, font-weight 0.16s ease",
                }}
              >
                {navLabels[lang][item.id]}
              </span>
            </motion.button>
          );
        })}

        {/* UI 折射层必须位于导航内容之后，才能采样文字和图标。 */}
        {isDragging && (
          <motion.div
            className={`sidebar-nav-ui-lens ${backgroundType}`}
            animate={{
              left: 0,
              right: 0,
              height: pillHeight + 16,
            }}
            style={{
              top: 0,
              y: pillY,
              scaleX: liquidScaleX,
              scaleY: liquidScaleY,
            }}
            transition={{
              left: { type: "spring", stiffness: 420, damping: 28 },
              right: { type: "spring", stiffness: 420, damping: 28 },
              height: { type: "spring", stiffness: 420, damping: 28 },
            }}
            aria-hidden="true"
          />
        )}

      </div>

      <div style={{ flex: 1 }} />

      <GlassTooltip text={isDeveloperMode ? (lang === "zh" ? "点击退出开发者模式" : "Click to exit Developer Mode") : ""}>
        <div
          onClick={handleVersionClick}
          style={{
            padding: settings.compactMode ? "8px 10px" : "12px 14px",
            fontSize: 11,
            color: isDeveloperMode ? "var(--accent)" : "var(--text-tertiary)",
            textAlign: "center",
            cursor: "pointer",
            userSelect: "none",
            transition: "color 0.2s",
            width: "100%",
          }}
        >
          {"CodeXa Studio V" + APP_VERSION}
          {isDeveloperMode && (
            <span style={{ fontSize: 9, display: "block", marginTop: 2, opacity: 0.6 }}>
              {lang === "zh" ? "开发者模式" : "Dev Mode"}
            </span>
          )}
        </div>
      </GlassTooltip>

      {createPortal(
        <AnimatePresence>
          {clickTip && (
            <motion.div
              key={tipKeyRef.current}
              initial={{ opacity: 0, y: -6, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.88 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              style={{
                position: "fixed",
                left: clickTip.x,
                top: clickTip.y,
                zIndex: 99999,
                pointerEvents: "none",
                backdropFilter: "blur(32px) saturate(2.2)",
                WebkitBackdropFilter: "blur(32px) saturate(2.2)",
                background: "rgba(18,18,28,0.40)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                color: "rgba(255,255,255,0.92)",
                whiteSpace: "nowrap",
                boxShadow: "0 6px 20px rgba(0,0,0,0.18)",
              }}
            >
              {clickTip.text}
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </GlassSurface>
  );
}
