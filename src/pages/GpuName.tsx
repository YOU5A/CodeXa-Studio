import { useCallback, useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { MonitorCog, RefreshCw, Save, ShieldCheck, Trash2 } from "lucide-react";
import { GlassBadge, GlassButton, GlassCard, GlassEmptyState, GlassInput } from "@/design-system/components";
import { fontSizes, radii, space } from "@/design-system/tokens";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import { BottomNotice } from "@/components/BottomNotice";
import PageLayout from "@/components/PageLayout";

type Adapter = {
  name: string;
  path: string;
  deviceDesc?: string;
  nativeName?: string;
  originalDeviceDesc?: string;
};

type Detection = {
  adapters?: Adapter[];
  formFactor?: "laptop" | "desktop";
  isLaptop?: boolean;
};

const presets = [
  "NVIDIA GeForce GTX 750 Ti",
  "NVIDIA GeForce RTX 5090",
  "NVIDIA GeForce RTX 5080",
  "NVIDIA GeForce RTX 3060",
  "NVIDIA GeForce GTX 1060",
];

const t = {
  zh: {
    title: "显卡名称",
    subtitle: "修改 Windows 当前显示的显卡名称",
    current: "当前显示适配器",
    refresh: "重新检测",
    laptop: "笔记本电脑",
    desktop: "台式电脑",
    custom: "自定义名称",
    placeholder: "输入要显示的显卡名称",
    apply: "应用名称",
    restore: "恢复原生名称",
    native: "原生名称",
    presets: "推荐显卡名称",
    minimum: "最低要求",
    mainstream: "主流型号",
    highEnd: "高端型号",
    success: "显卡名称已更新，重启电脑后生效",
    restored: "已恢复原生显卡名称",
    failed: "修改失败",
    noGpu: "未检测到可修改的显示适配器",
    safe: "仅修改 DeviceDesc 显示字段，不会改变驱动或硬件",
    presetFilled: "已填入",
  },
  en: {
    title: "GPU Name",
    subtitle: "Change the display name shown by Windows",
    current: "Detected Display Adapters",
    refresh: "Detect again",
    laptop: "Laptop",
    desktop: "Desktop",
    custom: "Custom name",
    placeholder: "Enter the GPU name to display",
    apply: "Apply name",
    restore: "Restore native name",
    native: "Native name",
    presets: "Recommended GPU names",
    minimum: "Minimum",
    mainstream: "Mainstream",
    highEnd: "High-end model",
    success: "GPU name updated. Restart your computer to apply",
    restored: "Native GPU name restored",
    failed: "Update failed",
    noGpu: "No editable display adapter found",
    safe: "Only the DeviceDesc display field is changed; drivers and hardware are untouched",
    presetFilled: "Filled",
  },
} as const;

export default function GpuName() {
  const { lang } = useLanguage();
  const tx = t[lang];
  const { showToast } = useToast();

  const cached = (() => {
    try {
      return JSON.parse(localStorage.getItem("gpu-detection-cache") || "null") as Detection | null;
    } catch {
      return null;
    }
  })();

  const [data, setData] = useState<Detection | null>(cached);
  const [selected, setSelected] = useState(0);
  const [name, setName] = useState(cached?.adapters?.[0]?.name || "");
  const [nativeName, setNativeName] = useState(cached?.adapters?.[0]?.nativeName || cached?.adapters?.[0]?.name || "");
  const [loading, setLoading] = useState(!cached);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [backups, setBackups] = useState<any[]>([]);
  const [presetTooltip, setPresetTooltip] = useState<string | null>(null);
  const userInteractedRef = useRef(false);

  const detect = useCallback(async (forceReset = false) => {
    setRefreshing(true);
    const raw = await window.electronAPI?.bridge.call<Detection | { result: Detection }>("gpu.detect");
    const r = (raw as any)?.result ?? (raw as Detection | undefined);
    if (r) localStorage.setItem("gpu-detection-cache", JSON.stringify(r));
    setData(r ?? { adapters: [] });
    setSelected(0);
    const a = r?.adapters?.[0];
    const hwNative = a?.nativeName || "";
    const cachedNative = a?.path ? localStorage.getItem(`gpu-native:${a.path}`) : null;
    const finalNative = hwNative || cachedNative || a?.name || "";
    if (hwNative && a?.path) {
      localStorage.setItem(`gpu-native:${a.path}`, hwNative);
    }
    setNativeName(finalNative);
    if (forceReset || !userInteractedRef.current) {
      setName(a?.name || "");
    }
    setLoading(false);
    setRefreshing(false);
  }, []);

  useEffect(() => {
    const id = setTimeout(() => detect(false), 0);
    return () => clearTimeout(id);
  }, [detect]);

  const adapter = data?.adapters?.[selected];

  useEffect(() => {
    window.electronAPI?.bridge.call<any>("gpu.backup.list").then((r) => setBackups(r?.backups || []));
  }, []);

  const select = (i: number) => {
    const a = data?.adapters?.[i];
    if (!a) return;
    setSelected(i);
    userInteractedRef.current = false;
    setName(a.name);
    const hwNative = a.nativeName || "";
    const cachedNative = a.path ? localStorage.getItem(`gpu-native:${a.path}`) : null;
    const finalNative = hwNative || cachedNative || a.name;
    if (hwNative && a.path) {
      localStorage.setItem(`gpu-native:${a.path}`, hwNative);
    }
    setNativeName(finalNative);
  };

  const write = async (value: string, restored = false, rawDesc?: string) => {
    if (!adapter || !value.trim()) return;
    setSaving(true);
    const key = `gpu-native:${adapter.path}`;
    if (!localStorage.getItem(key)) {
      localStorage.setItem(key, nativeName || adapter.nativeName || adapter.name);
    }
    const r = await window.electronAPI?.bridge.call("gpu.write_name", {
      path: adapter.path,
      name: value.trim(),
      rawDesc: rawDesc || undefined,
    });
    if (r?.success) {
      setName(r.name || value.trim());
      userInteractedRef.current = false;
      await detect(true);
      showToast(restored ? tx.restored : tx.success, "success");
    } else {
      showToast(r?.error || tx.failed, "error");
    }
    setSaving(false);
  };

  const reloadBackups = async () => {
    const res = await window.electronAPI?.bridge.call<any>("gpu.backup.list");
    setBackups(res?.backups || []);
  };

  // 鼠标跟随白色光晕逻辑（与 Win32 优先级保持一致）
  const setPillGlow = useCallback((el: HTMLElement, cx: number, cy: number) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    el.style.setProperty("--pill-gx", ((cx - r.left) / r.width) * 100 + "%");
    el.style.setProperty("--pill-gy", ((cy - r.top) / r.height) * 100 + "%");
    el.style.setProperty("--pill-go", "1");
  }, []);

  const clearPillGlow = useCallback((el: HTMLElement) => {
    el.style.setProperty("--pill-go", "0");
  }, []);

  const handlePillMove = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    setPillGlow(e.currentTarget, e.clientX, e.clientY);
  }, [setPillGlow]);

  const handlePillLeave = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    clearPillGlow(e.currentTarget);
  }, [clearPillGlow]);

  const handlePresetClick = (preset: string) => {
    userInteractedRef.current = true;
    setName(preset);
    setPresetTooltip(preset);
  };

  const handleRestoreClick = () => {
    if (!nativeName) return;
    userInteractedRef.current = true;
    setName(nativeName);
    setPresetTooltip(nativeName);
  };

  const currentAdapterName = (adapter?.name || "").trim().toLowerCase();
  const nativeNameTrim = (nativeName || "").trim().toLowerCase();
  const isHardwareNativeActive = Boolean(
    nativeNameTrim &&
    currentAdapterName === nativeNameTrim &&
    (adapter?.deviceDesc?.includes("@") || !presets.some((pr) => pr.toLowerCase() === currentAdapterName))
  );

  return (
    <PageLayout
      title={tx.title}
      subtitle={tx.subtitle}
      actions={
        <GlassButton
          variant="secondary"
          size="sm"
          onClick={() => {
            userInteractedRef.current = false;
            detect(true);
          }}
          disabled={refreshing}
        >
          <motion.span
            animate={{ rotate: refreshing ? 360 : 0 }}
            transition={{ repeat: refreshing ? Infinity : 0, duration: 0.7, ease: "linear" }}
            style={{ display: "flex" }}
          >
            <RefreshCw size={14} />
          </motion.span>
          {tx.refresh}
        </GlassButton>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
        {/* 当前显示适配器 */}
        <GlassCard>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: space[3] }}>
            <h3 style={{ margin: 0, fontSize: fontSizes.md, fontWeight: 500 }}>{tx.current}</h3>
            <GlassBadge variant="accent">
              <MonitorCog size={13} /> {data?.formFactor === "laptop" ? tx.laptop : tx.desktop}
            </GlassBadge>
          </div>
          {loading ? (
            <GlassEmptyState title="..." />
          ) : !adapter ? (
            <div style={{ padding: `${space[4]}px 0` }}>
              <div style={{ fontSize: fontSizes["3xl"], fontWeight: 600, color: "var(--accent)" }}>—</div>
              <div style={{ marginTop: space[2], color: "var(--text-secondary)" }}>{tx.noGpu}</div>
            </div>
          ) : (
            <>
              <div style={{ padding: `${space[4]}px 0` }}>
                <div style={{ fontSize: fontSizes["3xl"], fontWeight: 600, color: "var(--accent)" }}>{adapter.name}</div>
              </div>
              {(data!.adapters?.length ?? 0) > 1 && (
                <div style={{ display: "flex", gap: space[2], flexWrap: "wrap", marginTop: space[3] }}>
                  {data!.adapters!.map((a, i) => (
                    <GlassButton key={a.path} variant={i === selected ? "primary" : "secondary"} size="sm" onClick={() => select(i)}>
                      {a.name}
                    </GlassButton>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", gap: space[2], marginTop: space[3], alignItems: "center", color: "var(--text-tertiary)", fontSize: fontSizes.xs }}>
                <ShieldCheck size={14} />
                {tx.safe}
              </div>
            </>
          )}
        </GlassCard>

        {/* 推荐显卡名称（预设卡片） */}
        <GlassCard>
          <h3 style={{ margin: `0 0 ${space[3]}px`, fontSize: fontSizes.md, fontWeight: 500 }}>{tx.presets}</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: space[3] }}>
            {presets.map((p, i) => {
              const isActive = !isHardwareNativeActive && currentAdapterName === p.trim().toLowerCase();
              return (
                <motion.button
                  key={p}
                  className="theme-pill"
                  onClick={() => handlePresetClick(p)}
                  onMouseMove={handlePillMove}
                  onMouseEnter={handlePillMove}
                  onMouseLeave={handlePillLeave}
                  whileHover={isActive ? undefined : { scale: 1.015, borderColor: "var(--border-strong)", background: "var(--bg-secondary)" }}
                  whileTap={{ scale: 0.98 }}
                  animate={
                    isActive
                      ? {
                          borderColor: "var(--glass-vision-border)",
                          background: "var(--glass-vision-active)",
                          boxShadow: "var(--glass-vision-shadow)",
                        }
                      : {
                          borderColor: "var(--border-color)",
                          background: "var(--bg-tertiary)",
                          boxShadow: "var(--glass-lens-inner-shadow), 0 1px 3px rgba(0,0,0,0.04)",
                        }
                  }
                  transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                  style={{
                    textAlign: "left",
                    padding: `${space[3]}px ${space[4]}px`,
                    minHeight: 76,
                    borderRadius: radii.lg,
                    border: "1.5px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    cursor: "pointer",
                    outline: "none",
                    position: "relative",
                  }}
                >
                  <div style={{ fontWeight: 600, color: isActive ? "var(--accent)" : "var(--text-primary)", textShadow: isActive ? "0 0 8px rgba(var(--accent-rgb), 0.35)" : "none" }}>{p}</div>
                  <div style={{ marginTop: 4, fontSize: fontSizes.xs, color: "var(--text-tertiary)" }}>
                    {i === 0 || i === 4 ? `${tx.minimum} · ${i === 4 ? tx.laptop : tx.desktop}` : p.includes("3060") ? tx.mainstream : tx.highEnd}
                  </div>
                  <span className="theme-pill-glow" />
                </motion.button>
              );
            })}

            {/* 恢复原生名称 */}
            {(() => {
              const isRestoreActive = isHardwareNativeActive;
              return (
                <motion.button
                  className="theme-pill"
                  whileHover={isRestoreActive ? undefined : { scale: 1.015, borderColor: "var(--border-strong)", background: "var(--bg-secondary)" }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleRestoreClick}
                  onMouseMove={handlePillMove}
                  onMouseEnter={handlePillMove}
                  onMouseLeave={handlePillLeave}
                  disabled={!adapter || !nativeName || saving}
                  animate={
                    isRestoreActive
                      ? {
                          borderColor: "var(--glass-vision-border)",
                          background: "var(--glass-vision-active)",
                          boxShadow: "var(--glass-vision-shadow)",
                        }
                      : {
                          borderColor: "var(--border-color)",
                          background: "var(--bg-tertiary)",
                          boxShadow: "var(--glass-lens-inner-shadow), 0 1px 3px rgba(0,0,0,0.04)",
                        }
                  }
                  transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                  style={{
                    textAlign: "left",
                    padding: `${space[3]}px ${space[4]}px`,
                    minHeight: 76,
                    borderRadius: radii.lg,
                    border: "1.5px solid var(--border-color)",
                    background: "var(--bg-tertiary)",
                    color: "var(--text-primary)",
                    cursor: !adapter || !nativeName || saving ? "not-allowed" : "pointer",
                    outline: "none",
                    position: "relative",
                    opacity: !adapter || !nativeName || saving ? 0.6 : 1,
                  }}
                >
                  <div style={{ fontWeight: 600, color: isRestoreActive ? "var(--accent)" : "var(--text-primary)", textShadow: isRestoreActive ? "0 0 8px rgba(var(--accent-rgb), 0.35)" : "none" }}>{nativeName || "—"}</div>
                  <div style={{ marginTop: 4, fontSize: fontSizes.xs, color: "var(--text-tertiary)" }}>{tx.restore}</div>
                  <span className="theme-pill-glow" />
                </motion.button>
              );
            })()}
          </div>
        </GlassCard>

        {/* 自定义名称 */}
        <GlassCard>
          <h3 style={{ margin: `0 0 ${space[3]}px`, fontSize: fontSizes.md, fontWeight: 500 }}>{tx.custom}</h3>
          <div style={{ display: "flex", gap: space[3], alignItems: "flex-end" }}>
            <div style={{ flex: 1 }}>
              <GlassInput
                value={name}
                onChange={(e) => {
                  userInteractedRef.current = true;
                  setName(e.target.value);
                }}
                placeholder={tx.placeholder}
              />
            </div>
            <GlassButton
              variant="primary"
              onClick={() => {
                const isRestoring = Boolean(
                  adapter &&
                  nativeName &&
                  name.trim().toLowerCase() === nativeName.trim().toLowerCase()
                );
                const rawDesc = isRestoring ? adapter?.originalDeviceDesc : undefined;
                write(name, isRestoring, rawDesc);
              }}
              disabled={!adapter || !name.trim() || saving}
            >
              <Save size={14} />
              {tx.apply}
            </GlassButton>
          </div>
        </GlassCard>

        {/* 备份管理 */}
        <GlassCard>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: space[3] }}>
            <h3 style={{ margin: 0, fontSize: fontSizes.md, fontWeight: 500 }}>备份管理</h3>
            <div style={{ display: "flex", gap: space[2] }}>
              <GlassButton
                variant="secondary"
                size="sm"
                onClick={async () => {
                  const r = await window.electronAPI?.bridge.call<any>("gpu.backup.create");
                  if (r?.success) {
                    reloadBackups();
                    showToast("显卡名称已备份", "success");
                  }
                }}
                disabled={!adapter}
              >
                <Save size={14} /> 创建备份
              </GlassButton>
              <GlassButton variant="secondary" size="sm" onClick={() => window.electronAPI?.shell.openPath("C:\\CodeXaStudio\\gpu-backups")}>
                <MonitorCog size={14} /> 打开备份目录
              </GlassButton>
              {backups.length > 0 && (
                <GlassButton
                  variant="danger"
                  size="sm"
                  onClick={async () => {
                    await window.electronAPI?.bridge.call("gpu.backup.clear");
                    reloadBackups();
                  }}
                >
                  <Trash2 size={14} /> 清除所有备份
                </GlassButton>
              )}
            </div>
          </div>
          {backups.length === 0 ? (
            <GlassEmptyState title="暂无显卡名称备份" />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {backups.map((b) => (
                <div
                  key={b.filepath}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "8px 0",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: fontSizes.sm, color: "var(--text-primary)" }}>{b.names || b.filename}</div>
                    <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)" }}>
                      {b.date} {b.time}
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: space[2], flexShrink: 0 }}>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        const r = await window.electronAPI?.bridge.call<any>("gpu.backup.restore", { filepath: b.filepath });
                        if (r?.success) {
                          showToast("备份已恢复", "success");
                          detect();
                        }
                      }}
                    >
                      恢复
                    </GlassButton>
                    <GlassButton
                      variant="secondary"
                      size="sm"
                      onClick={async () => {
                        await window.electronAPI?.bridge.call("gpu.backup.delete", { filename: b.filename });
                        reloadBackups();
                      }}
                    >
                      <Trash2 size={14} /> 删除
                    </GlassButton>
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </div>

      {/* 底部居中 Glass Tip */}
      <BottomNotice
        key={presetTooltip || "empty"}
        show={presetTooltip !== null}
        duration={2000}
        onDone={() => setPresetTooltip(null)}
      >
        <span style={{ color: "var(--accent)", fontWeight: 600 }}>
          {presetTooltip}
        </span>
        <span>{tx.presetFilled}</span>
      </BottomNotice>
    </PageLayout>
  );
}
