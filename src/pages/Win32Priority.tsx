import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { createPortal } from "react-dom";
import { RefreshCw, Save, RotateCcw, Trash2, FolderOpen } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import {
  GlassButton,
  GlassInput,
  GlassBadge,
  GlassEmptyState,
  GlassProgressBar,
  space,
  radii,
  fontSizes,
} from "@/design-system";
import { useToast } from "@/contexts/ToastContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { recordActivity } from "@/hooks/useActivityLog";
import type { RegistryValue, BackupEntry } from "@/types";

interface Props {}

const t = {
  zh: {
    title: "Win32 PrioritySeparation",
    currentValue: "当前值",
    decimal: "十进制",
    hex: "十六进制",
    binary: "二进制",
    quickPresets: "快速预设",
    customSet: "自定义设置",
    enterValue: "输入新值（0x开头或直接输入十六进制）",
    apply: "应用",
    refresh: "刷新",
    backups: "备份管理",
    createBackup: "创建备份",
    openDir: "打开备份目录",
    restore: "恢复",
    delete: "删除",
    noBackups: "无备份",
    clearAll: "清除所有备份",
    clearAllConfirm: "确定要删除所有备份文件吗？此操作不可撤销。",
    clearAllDone: "已清除 {n} 个备份文件",
    confirmSet: "确定要设置此值吗？需要管理员权限，重启后生效。",
    success: "设置成功，重启后生效",
    failed: "设置失败",
    backupCreated: "备份已创建",
    restoreConfirm: "确定要恢复此备份吗？",
    deleteConfirm: "确定要删除此备份吗？",
    presetFilled: "已填入",
  },
  en: {
    title: "Win32 PrioritySeparation",
    currentValue: "Current Value",
    decimal: "Decimal",
    hex: "Hexadecimal",
    binary: "Binary",
    quickPresets: "Quick Presets",
    customSet: "Custom Setting",
    enterValue: "Enter value (0x prefix or hex)",
    apply: "Apply",
    refresh: "Refresh",
    backups: "Backup Management",
    createBackup: "Create Backup",
    openDir: "Open Backup Folder",
    restore: "Restore",
    delete: "Delete",
    noBackups: "No backups",
    clearAll: "Clear All Backups",
    clearAllConfirm: "Delete all backup files? This cannot be undone.",
    clearAllDone: "Deleted {n} backup files",
    confirmSet: "Set this value? Admin rights required. Takes effect after reboot.",
    success: "Value set successfully. Restart to apply.",
    failed: "Failed to set value",
    backupCreated: "Backup created",
    restoreConfirm: "Restore this backup?",
    deleteConfirm: "Delete this backup?",
    presetFilled: "Filled",
  },
};

interface PresetEntry {
  value: number;
  hex: string;
  aa: "short" | "long";
  bb: "fixed" | "variable";
  cc: "3:1" | "2:1" | "1:1";
  effect: string | null;
}

const presetData: PresetEntry[] = [
  { value: 42, hex: "2A", aa: "short", bb: "fixed", cc: "3:1", effect: "highest_fps" },
  { value: 41, hex: "29", aa: "short", bb: "fixed", cc: "2:1", effect: null },
  { value: 40, hex: "28", aa: "short", bb: "fixed", cc: "1:1", effect: "fast_response" },
  { value: 38, hex: "26", aa: "short", bb: "variable", cc: "3:1", effect: "program_default" },
  { value: 37, hex: "25", aa: "short", bb: "variable", cc: "2:1", effect: null },
  { value: 36, hex: "24", aa: "short", bb: "variable", cc: "1:1", effect: null },
  { value: 26, hex: "1A", aa: "long", bb: "fixed", cc: "3:1", effect: null },
  { value: 25, hex: "19", aa: "long", bb: "fixed", cc: "2:1", effect: null },
  { value: 24, hex: "18", aa: "long", bb: "fixed", cc: "1:1", effect: "background_default" },
  { value: 22, hex: "16", aa: "long", bb: "variable", cc: "3:1", effect: "smoothest" },
  { value: 21, hex: "15", aa: "long", bb: "variable", cc: "2:1", effect: null },
  { value: 20, hex: "14", aa: "long", bb: "variable", cc: "1:1", effect: null },
];

const aaLabel = {
  zh: { short: "短间隔", long: "长间隔" },
  en: { short: "Short", long: "Long" },
} as const;

const bbLabel = {
  zh: { fixed: "固定", variable: "可变" },
  en: { fixed: "Fixed", variable: "Variable" },
} as const;

const ccLabel = {
  zh: { "3:1": "3:1", "2:1": "2:1", "1:1": "1:1" },
  en: { "3:1": "3:1", "2:1": "2:1", "1:1": "1:1" },
} as const;

const effectLabel: Record<string, { zh: string; en: string }> = {
  highest_fps: { zh: "最高FPS / 游戏优化", en: "Best FPS / Gaming" },
  fast_response: { zh: "快速响应 / 1:1分配", en: "Fast Response / 1:1" },
  program_default: { zh: "程序默认 (Win10+)", en: "Default (Win10+)" },
  background_default: { zh: "后台服务默认", en: "Background Services" },
  smoothest: { zh: "最平滑 / 前台优先", en: "Smoothest / Foreground" },
};

/* ─── Shared Styles ─── */
const stackGap = { display: "flex", flexDirection: "column" as const, gap: space[4] };
const rowBetween = { display: "flex", alignItems: "center", justifyContent: "space-between" };
const sectionTitle: React.CSSProperties = {
  fontSize: fontSizes.md,
  fontWeight: 500,
  color: "var(--text-primary)",
  margin: 0,
  marginBottom: space[3],
};

export default function Win32Priority(_props: Props) {
  const { lang } = useLanguage();
  const tx = t[lang];
  const { showToast } = useToast();
  const { confirm } = useConfirm();

  const [registry, setRegistry] = useState<RegistryValue | null>(null);
  const [customValue, setCustomValue] = useState("");
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [applying, setApplying] = useState(false);
  const [presetTooltip, setPresetTooltip] = useState<string | null>(null);
  const tooltipTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const result = await window.electronAPI?.python.call("registry.read");
    if (result && !result.error) {
      // Normalize hex from bridge format "0x0000002A" to "2A" for preset matching
      const normalizedHex = result.hex
        ? result.hex.replace(/^0x0*/, "").toUpperCase() || "0"
        : result.hex;
      setRegistry({ ...result, hex: normalizedHex });
    }
    const bkResult = await window.electronAPI?.python.call("backup.list");
    if (bkResult?.backups) setBackups(bkResult.backups);
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { return () => { if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current); }; }, []);

  const applyValue = async () => {
    const ok = await confirm({ title: tx.confirmSet, danger: false });
    if (!ok) return;
    setApplying(true);
    // Parse user input: accept "0x2A", "2A", or decimal "42"
    const raw = customValue.trim();
    let parsedValue: number;
    if (raw.startsWith("0x") || raw.startsWith("0X")) {
      parsedValue = parseInt(raw, 16);
    } else if (/^[0-9A-Fa-f]+$/.test(raw) && isNaN(Number(raw))) {
      // Pure hex without prefix (e.g. "2A")
      parsedValue = parseInt(raw, 16);
    } else {
      parsedValue = parseInt(raw, 10);
    }
    const result = await window.electronAPI?.python.call("registry.write", { value: parsedValue });
    if (result && !result.error) {
      showToast(tx.success, "success");
      recordActivity("win32priority", lang === "zh" ? `Win32 优先级已设置为 ${result.value}` : `Win32 priority set to ${result.value}`);
      fetchData();
    } else {
      showToast(result?.error || tx.failed, "error");
    }
    setApplying(false);
  };

  const createBackup = async () => {
    const result = await window.electronAPI?.python.call("registry.backup");
    if (result && !result.error) {
      showToast(tx.backupCreated, "success");
      fetchData();
    } else {
      showToast(result?.error || tx.failed, "error");
    }
  };

  const restoreBackup = async (bp: BackupEntry) => {
    const ok = await confirm({ title: tx.restoreConfirm, danger: false });
    if (!ok) return;
    const result = await window.electronAPI?.python.call("backup.restore", { filepath: bp.filepath, module: "win32" });
    if (result?.success) showToast(tx.success, "success");
    else showToast(result?.error || tx.failed, "error");
    fetchData();
  };

  const deleteBackup = async (bp: BackupEntry) => {
    const ok = await confirm({ title: tx.deleteConfirm, danger: true });
    if (!ok) return;
    const result = await window.electronAPI?.python.call("backup.delete", { filename: bp.filename });
    if (result?.success) fetchData();
  };

  const clearAll = async () => {
    const ok = await confirm({ title: tx.clearAllConfirm, danger: true });
    if (!ok) return;
    let n = 0;
    for (const bp of backups) {
      try { await window.electronAPI?.python.call("backup.delete", { filename: bp.filename }); n++; } catch {}
    }
    showToast(tx.clearAllDone.replace("{n}", String(n)), "success");
    fetchData();
  };

  const showPresetTooltip = useCallback((hex: string) => {
    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
    setPresetTooltip(hex);
    tooltipTimerRef.current = setTimeout(() => setPresetTooltip(null), 2000);
  }, []);
  // 光标跟随白色光晕（匹配 GlassButton）
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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ ...stackGap, height: "100%" }}
    >
      {/* ─── Current Value ─── */}
      <GlassCard>
        <h3 style={sectionTitle}>{tx.currentValue}</h3>
        {registry ? (
          <div style={{ ...stackGap, gap: space[2] }}>
            <div style={{ fontSize: fontSizes["3xl"], fontWeight: 600, color: "var(--accent)", fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}>
              0x{registry.hex}
            </div>
            <div style={{ display: "flex", gap: space[3], flexWrap: "wrap", fontVariantNumeric: "tabular-nums" }}>
              <GlassBadge variant="default">{tx.decimal}: {registry.decimal}</GlassBadge>
              <GlassBadge variant="default">{tx.hex}: 0x{registry.hex}</GlassBadge>
              <GlassBadge variant="default">{tx.binary}: {registry.binary}</GlassBadge>
            </div>
            <div style={{ display: "flex", gap: space[2], marginTop: space[2] }}>
              <GlassButton variant="secondary" size="sm" onClick={fetchData}>
                <RefreshCw size={14} /> {tx.refresh}
              </GlassButton>
              <GlassButton variant="secondary" size="sm" onClick={createBackup}>
                <Save size={14} /> {tx.createBackup}
              </GlassButton>
            </div>
          </div>
        ) : (
          <GlassEmptyState title={loading ? "..." : tx.failed} />
        )}
      </GlassCard>

      {/* ─── Quick Presets ─── */}
      <GlassCard>
        <h3 style={sectionTitle}>{tx.quickPresets}</h3>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
            gap: space[2],
          }}
        >
          {presetData.map((p) => {
            const isActive = registry?.hex?.toUpperCase() === p.hex;
            return (
              <motion.button
                key={p.hex}
                className="theme-pill"
                onClick={() => { setCustomValue(p.hex); showPresetTooltip(p.hex); }}
                onMouseMove={handlePillMove}
                onMouseEnter={handlePillMove}
                onMouseLeave={handlePillLeave}
                whileHover={
                  isActive
                    ? undefined
                    : {
                        scale: 1.02,
                        borderColor: "var(--border-strong)",
                        background: "var(--bg-elevated)",
                      }
                }
                whileTap={{ scale: 0.96 }}
                animate={
                  isActive
                    ? {
                        borderColor: "var(--accent)",
                        background: "var(--accent-bg)",
                        boxShadow: "0 0 20px rgba(var(--accent-rgb), 0.14)",
                      }
                    : {
                        borderColor: "var(--border-color)",
                        background: "var(--bg-secondary)",
                        boxShadow: "none",
                      }
                }
                transition={{ type: "tween", duration: 0.2, ease: "easeOut" }}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 4,
                  width: "100%",
                  padding: `${space[3]}px ${space[4]}px`,
                  borderRadius: radii.lg,
                  cursor: isActive ? "default" : "pointer",
                  border: "1.5px solid var(--border-color)",
                  background: "var(--bg-secondary)",
                  textAlign: "left",
                  fontFamily: "inherit",
                  fontSize: "inherit",
                  color: "inherit",
                  userSelect: "none",
                  outline: "none",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: fontSizes.lg, fontWeight: 600, color: "var(--accent)", fontFamily: "monospace" }}>
                    0x{p.hex}
                  </span>
                  {p.effect && (
                    <GlassBadge variant="accent" size="sm">
                      {effectLabel[p.effect]?.[lang] ?? p.effect}
                    </GlassBadge>
                  )}
                </div>
                <div style={{ display: "flex", gap: space[2], flexWrap: "wrap" }}>
                  <span style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)" }}>
                    {aaLabel[lang][p.aa]}
                  </span>
                  <span style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)" }}>
                    {bbLabel[lang][p.bb]}
                  </span>
                  <span style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)" }}>
                    {ccLabel[lang][p.cc]}
                  </span>
                </div>
                <span className="theme-pill-glow" />
              </motion.button>
            );
          })}
        </div>
      </GlassCard>

      {/* ─── Custom Setting ─── */}
      <GlassCard>
        <h3 style={sectionTitle}>{tx.customSet}</h3>
        <div style={{ display: "flex", gap: space[3], alignItems: "flex-end" }}>
          <div style={{ flex: 1 }}>
            <GlassInput
              value={customValue}
              onChange={(e) => setCustomValue(e.target.value)}
              placeholder={tx.enterValue}
            />
          </div>
          <GlassButton variant="primary" onClick={applyValue} disabled={applying || !customValue.trim()}>
            {tx.apply}
          </GlassButton>
        </div>
      </GlassCard>

      {/* ─── Backup Management ─── */}
      <GlassCard>
        <div style={{ ...rowBetween, marginBottom: space[3] }}>
          <h3 style={{ ...sectionTitle, marginBottom: 0 }}>{tx.backups}</h3>
          <div style={{ display: "flex", gap: space[2] }}>
            <GlassButton variant="secondary" size="sm" onClick={createBackup}>
              <Save size={14} /> {tx.createBackup}
            </GlassButton>
            <GlassButton variant="secondary" size="sm" onClick={() => window.electronAPI?.shell.openPath(backups[0]?.filepath?.replace(/\\[^\\]+$/, "") || "")}>
              <FolderOpen size={14} /> {tx.openDir}
            </GlassButton>
            {backups.length > 0 && (
              <GlassButton variant="danger" size="sm" onClick={clearAll}>
                <Trash2 size={14} /> {tx.clearAll}
              </GlassButton>
            )}
          </div>
        </div>
        {backups.length === 0 ? (
          <GlassEmptyState title={tx.noBackups} />
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
            {backups.map((bp) => (
              <div
                key={bp.filename}
                style={{
                  ...rowBetween,
                  padding: `${space[2]}px 0`,
                  borderBottom: "1px solid var(--border-color)",
                }}
              >
                <div>
                  <div style={{ fontSize: fontSizes.sm, color: "var(--text-primary)" }}>
                    {bp.date} {bp.time}
                  </div>
                  <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                    {tx.decimal}: {bp.decimal}  |  {tx.hex}: 0x{bp.hex}
                  </div>
                </div>
                <div style={{ display: "flex", gap: space[2] }}>
                  <GlassButton variant="secondary" size="sm" onClick={() => restoreBackup(bp)}>
                    <RotateCcw size={14} /> {tx.restore}
                  </GlassButton>
                  <GlassButton variant="secondary" size="sm" onClick={() => deleteBackup(bp)}>
                    <Trash2 size={14} /> {tx.delete}
                  </GlassButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>

      {/* ─── Preset Tooltip ─── */}
      {presetTooltip && createPortal(
        <AnimatePresence>
          <motion.div
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 6, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 400, damping: 30, mass: 0.8 }}
            style={{
              position: "fixed",
              bottom: 24,
              left: "50%",
              transform: "translateX(-50%)",
              zIndex: 99999,
              pointerEvents: "none",
              backdropFilter: "blur(32px) saturate(2.2)",
              WebkitBackdropFilter: "blur(32px) saturate(2.2)",
              background: "rgba(18,18,28,0.40)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 20,
              padding: "8px 20px",
              fontSize: 14,
              fontWeight: 500,
              color: "rgba(255,255,255,0.92)",
              whiteSpace: "nowrap",
              boxShadow: "0 8px 28px rgba(0,0,0,0.22)",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ color: "var(--accent)", fontFamily: "monospace", fontWeight: 600 }}>
              0x{presetTooltip}
            </span>
            <span>{tx.presetFilled}</span>
          </motion.div>
        </AnimatePresence>,
        document.body
      )}
    </motion.div>
  );
}
