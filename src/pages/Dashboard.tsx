import { useState, useEffect, useRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import {
  Activity,
  CircleAlert,
  Cpu,
  HardDrive,
  MemoryStick,
  MonitorCog,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { GlassBadge, GlassProgressBar } from "@/design-system/components";
import { space, radii, fontSizes } from "@/design-system/tokens";
import { STORAGE_DASHBOARD_HARDWARE } from "@/constants/storage-keys";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SystemInfo } from "@/types";

const t = {
  zh: {
    title: "仪表盘",
    systemHealth: "当前系统",
    cpu: "CPU",
    memory: "内存",
    disk: "磁盘",
    system: "系统",
    windowsVersion: "Windows 版本",
    hostname: "主机",
    build: "系统版本",
    admin: "权限",
    adminGranted: "管理员权限",
    adminRequired: "需要管理员权限",
    statusAttention: "需要关注",
    statusCritical: "高负载",
    statusAttentionDesc: "有资源使用率偏高，建议留意当前负载。",
    statusCriticalDesc: "检测到高负载，建议检查当前进程或应用。",
    liveTrend: "实时趋势 · 最近 60 秒",
    noTrend: "等待系统数据",
    loadingSystem: "正在读取系统状态...",
    systemUnavailable: "暂时无法获取系统信息",
    cores: "核",
    threads: "线程",
    currentConfiguration: "当前配置",
    win32Value: "当前 Win32 值",
    gpuName: "显卡名称",
    decimal: "十进制",
    hex: "十六进制",
    loadingValue: "读取中...",
    valueUnavailable: "暂不可用",
  },
  en: {
    title: "Dashboard",
    systemHealth: "Current System",
    cpu: "CPU",
    memory: "Memory",
    disk: "Disk",
    system: "System",
    windowsVersion: "Windows Version",
    hostname: "Host",
    build: "System Build",
    admin: "Access",
    adminGranted: "Administrator",
    adminRequired: "Administrator Required",
    statusAttention: "Needs attention",
    statusCritical: "High load",
    statusAttentionDesc: "One or more resources are running high. Keep an eye on the current load.",
    statusCriticalDesc: "High resource usage detected. Check the current processes or apps.",
    liveTrend: "Live trend · Last 60 seconds",
    noTrend: "Waiting for system data",
    loadingSystem: "Reading system status...",
    systemUnavailable: "System information is temporarily unavailable",
    cores: "C",
    threads: "T",
    currentConfiguration: "Current Configuration",
    win32Value: "Current Win32 Value",
    gpuName: "GPU Name",
    decimal: "Decimal",
    hex: "Hexadecimal",
    loadingValue: "Reading...",
    valueUnavailable: "Unavailable",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

type HealthState = "good" | "attention" | "critical";

interface MetricPoint {
  cpu: number;
  memory: number;
  disk: number;
}

function getProgressColor(pct: number): "accent" | "success" | "warning" | "danger" {
  if (pct >= 90) return "danger";
  if (pct >= 70) return "warning";
  if (pct >= 50) return "accent";
  return "success";
}

function getHealthState(info: SystemInfo): HealthState {
  const highestUsage = Math.max(info.cpu_percent, info.memory_percent, info.disk_percent);
  if (highestUsage >= 90) return "critical";
  if (highestUsage >= 70) return "attention";
  return "good";
}

function healthBadgeVariant(state: HealthState): "success" | "warning" | "danger" {
  if (state === "critical") return "danger";
  if (state === "attention") return "warning";
  return "success";
}

function HealthIcon({ state, size = 16 }: { state: HealthState; size?: number }) {
  return state === "critical" || state === "attention" ? <CircleAlert size={size} /> : null;
}

function PanelHeader({ icon, title, right, compact = false }: { icon: ReactNode; title: string; right?: ReactNode; compact?: boolean }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: space[3], marginBottom: compact ? space[4] : space[5] }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], minWidth: 0 }}>
        <span style={{ color: "var(--text-secondary)", display: "flex", flexShrink: 0 }}>{icon}</span>
        <h2 style={{ margin: 0, color: "var(--text-primary)", fontSize: compact ? fontSizes.lg : fontSizes.xl, fontWeight: 600, letterSpacing: "-0.02em" }}>
          {title}
        </h2>
      </div>
      {right}
    </div>
  );
}

function Sparkline({ values, color, label, noDataLabel }: { values: number[]; color: string; label: string; noDataLabel: string }) {
  const width = 176;
  const height = 44;
  const latest = values.length > 0 ? values[values.length - 1] : null;
  const points = values.length > 0
    ? values.map((value, index) => {
        const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
        const y = height - 4 - (Math.max(0, Math.min(100, value)) / 100) * (height - 8);
        return `${x},${y}`;
      }).join(" ")
    : `${width / 2},${height / 2}`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      role="img"
      aria-label={`${label}: ${latest === null ? noDataLabel : `${Math.round(latest)}%`}`}
      style={{ width: "100%", height, display: "block", color }}
    >
      <line x1="0" y1="40" x2={width} y2="40" stroke="currentColor" strokeWidth="1" opacity="0.14" />
      {values.length > 0 && (
        <polyline fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" points={points} />
      )}
    </svg>
  );
}

function MetricBlock({ icon, label, value, detail, values, color, noDataLabel }: {
  icon: ReactNode;
  label: string;
  value: number | null;
  detail: string;
  values: number[];
  color: string;
  noDataLabel: string;
}) {
  const progressColor = value === null ? "accent" : getProgressColor(value);

  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[1] }}>
        <span style={{ color, display: "flex" }}>{icon}</span>
        <span style={{ color: "var(--text-secondary)", fontSize: fontSizes.sm }}>{label}</span>
        <strong style={{ marginLeft: "auto", color: "var(--text-primary)", fontSize: fontSizes.xl, fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
          {value === null ? "—" : `${Math.round(value)}%`}
        </strong>
      </div>
      <GlassProgressBar value={value ?? 0} color={progressColor} height={4} />
      <div style={{ marginTop: space[2], marginBottom: space[1], padding: "0 2px" }}>
        <Sparkline values={values} color={color} label={label} noDataLabel={noDataLabel} />
      </div>
      <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs, fontVariantNumeric: "tabular-nums", minHeight: 17 }}>
        {detail}
      </div>
    </div>
  );
}

function SystemHealthPanel({ sysInfo, trend, tx }: { sysInfo: SystemInfo | null; trend: MetricPoint[]; tx: typeof t.zh }) {
  const state = sysInfo ? getHealthState(sysInfo) : null;
  const statusLabel = state === "attention" ? tx.statusAttention : state === "critical" ? tx.statusCritical : null;
  const statusDescription = state === "attention" ? tx.statusAttentionDesc : state === "critical" ? tx.statusCriticalDesc : null;

  return (
    <GlassCard noHover style={{ overflow: "hidden", display: "flex", flexDirection: "column" }}>
      <PanelHeader
        icon={<Activity size={17} />}
        title={tx.systemHealth}
        right={
          state === null ? (
            <GlassBadge variant="default">{tx.loadingSystem}</GlassBadge>
          ) : statusLabel ? (
            <GlassBadge variant={healthBadgeVariant(state)}>
              <HealthIcon state={state} size={14} />
              {statusLabel}
            </GlassBadge>
          ) : undefined
        }
      />

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: space[6], alignItems: "stretch" }}>
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", minHeight: 132 }}>
          <div>
            {statusLabel ? (
              <>
                <div style={{ color: "var(--text-primary)", fontSize: fontSizes["3xl"], fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.15 }}>
                  {statusLabel}
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: fontSizes.sm, lineHeight: 1.6, margin: `${space[2]}px 0 0`, maxWidth: 330 }}>
                  {statusDescription}
                </p>
              </>
            ) : (
              <>
                <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.sm, marginBottom: space[1] }}>{tx.system}</div>
                <div style={{ color: "var(--text-primary)", fontSize: fontSizes["3xl"], fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.15, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sysInfo?.windows_edition ?? ""}>
                  {sysInfo?.windows_edition ?? "—"}
                </div>
                <p style={{ color: "var(--text-secondary)", fontSize: fontSizes.sm, lineHeight: 1.6, margin: `${space[2]}px 0 0`, maxWidth: 330 }}>
                  {sysInfo ? `${sysInfo.windows_release} · ${tx.build} ${sysInfo.windows_build}` : tx.systemUnavailable}
                </p>
              </>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: space[2], marginTop: space[4] }}>
            <GlassBadge size="sm">{sysInfo?.hostname ?? "—"}</GlassBadge>
            {sysInfo ? (
              <GlassBadge size="sm" variant={sysInfo.is_admin ? "success" : "warning"}>
                {sysInfo.is_admin ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
                {sysInfo.is_admin ? tx.adminGranted : tx.adminRequired}
              </GlassBadge>
            ) : (
              <GlassBadge size="sm">{tx.loadingSystem}</GlassBadge>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: `${space[4]}px ${space[5]}px`, alignContent: "center" }}>
          <div>
            <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs, marginBottom: space[1] }}>{tx.hostname}</div>
            <div style={{ color: "var(--text-primary)", fontSize: fontSizes.sm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sysInfo?.hostname ?? ""}>
              {sysInfo?.hostname ?? "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs, marginBottom: space[1] }}>{tx.windowsVersion}</div>
            <div style={{ color: "var(--text-primary)", fontSize: fontSizes.sm, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={sysInfo ? `${sysInfo.windows_edition} ${sysInfo.windows_release}` : ""}>
              {sysInfo ? `${sysInfo.windows_edition} ${sysInfo.windows_release}` : "—"}
            </div>
          </div>
          <div>
            <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs, marginBottom: space[1] }}>{tx.build}</div>
            <div style={{ color: "var(--text-primary)", fontSize: fontSizes.sm, fontVariantNumeric: "tabular-nums" }}>{sysInfo?.windows_build ?? "—"}</div>
          </div>
          <div>
            <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs, marginBottom: space[1] }}>{tx.admin}</div>
            <div style={{ color: sysInfo?.is_admin ? "var(--success)" : "var(--warning)", fontSize: fontSizes.sm }}>
              {sysInfo ? (sysInfo.is_admin ? tx.adminGranted : tx.adminRequired) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div style={{ borderTop: "1px solid var(--border-color)", marginTop: space[6], paddingTop: space[4] }}>
        <div style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: space[3] }}>{tx.liveTrend}</div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: space[5] }}>
          <MetricBlock
            icon={<Cpu size={16} />}
            label={tx.cpu}
            value={sysInfo?.cpu_percent ?? null}
            detail={sysInfo ? `${sysInfo.cpu_count_physical ?? sysInfo.cpu_count} ${tx.cores} / ${sysInfo.cpu_count} ${tx.threads}` : tx.noTrend}
            values={trend.map((point) => point.cpu)}
            color="var(--accent)"
            noDataLabel={tx.noTrend}
          />
          <MetricBlock
            icon={<MemoryStick size={16} />}
            label={tx.memory}
            value={sysInfo?.memory_percent ?? null}
            detail={sysInfo ? `${formatBytes(sysInfo.memory_used)} / ${formatBytes(sysInfo.memory_total)}` : tx.noTrend}
            values={trend.map((point) => point.memory)}
            color="var(--warning)"
            noDataLabel={tx.noTrend}
          />
          <MetricBlock
            icon={<HardDrive size={16} />}
            label={tx.disk}
            value={sysInfo?.disk_percent ?? null}
            detail={sysInfo ? `${formatBytes(sysInfo.disk_used)} / ${formatBytes(sysInfo.disk_total)}` : tx.noTrend}
            values={trend.map((point) => point.disk)}
            color="var(--success)"
            noDataLabel={tx.noTrend}
          />
        </div>
      </div>
    </GlassCard>
  );
}

interface Win32ValueSnapshot {
  value: number | null;
  decimal?: number;
  hex?: string;
  binary?: string;
  error?: string;
}

interface GpuDetectionSnapshot {
  adapters?: Array<{ name?: string }>;
  error?: string;
}

interface DashboardHardwareCache {
  win32Value: Win32ValueSnapshot | null;
  gpuName: string | null;
}

function readDashboardHardwareCache(): DashboardHardwareCache {
  try {
    const cached = JSON.parse(localStorage.getItem(STORAGE_DASHBOARD_HARDWARE) || "null") as Partial<DashboardHardwareCache> | null;
    const win32Value = cached?.win32Value;
    const gpuName = typeof cached?.gpuName === "string" && cached.gpuName.trim() ? cached.gpuName : null;
    return {
      win32Value: win32Value && typeof win32Value.value === "number" ? win32Value : null,
      gpuName,
    };
  } catch {
    return { win32Value: null, gpuName: null };
  }
}

function unwrapBridgeResult<T>(raw: unknown): T | undefined {
  if (raw && typeof raw === "object" && "result" in raw) {
    return (raw as { result?: T }).result;
  }
  return raw as T | undefined;
}

function formatWin32Hex(value: number): string {
  return `0x${value.toString(16).toUpperCase().padStart(8, "0")}`;
}

function CurrentValuesPanel({ win32Value, gpuName, loading, tx }: {
  win32Value: Win32ValueSnapshot | null;
  gpuName: string | null;
  loading: boolean;
  tx: typeof t.zh;
}) {
  const numericValue = typeof win32Value?.decimal === "number"
    ? win32Value.decimal
    : typeof win32Value?.value === "number" ? win32Value.value : null;
  const hexValue = numericValue === null ? null : win32Value?.hex || formatWin32Hex(numericValue);

  return (
    <GlassCard noHover style={{ overflow: "hidden", display: "flex", flexDirection: "column", minHeight: 0 }}>
      <PanelHeader icon={<MonitorCog size={18} />} title={tx.currentConfiguration} />

      <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", gap: space[5], alignItems: "stretch", flex: 1, minHeight: 0 }}>
        <section
          aria-labelledby="dashboard-win32-value"
          style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: `${space[5]}px ${space[6]}px`, borderRadius: radii.lg, background: "var(--bg-tertiary)" }}
        >
            <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[4] }}>
              <div id="dashboard-win32-value" style={{ display: "flex", alignItems: "center", gap: space[2], color: "var(--text-secondary)", fontSize: fontSizes.sm }}>
                <Activity size={16} aria-hidden="true" />
                {tx.win32Value}
              </div>
              <span style={{ color: "var(--text-tertiary)", fontSize: fontSizes.xs }}>· {tx.hex}</span>
          </div>
          <div style={{ color: "var(--accent)", fontSize: fontSizes["3xl"], fontWeight: 600, letterSpacing: "-0.04em", lineHeight: 1.15, fontVariantNumeric: "tabular-nums", overflow: "hidden", textOverflow: "ellipsis" }}>
            {loading ? tx.loadingValue : hexValue ?? tx.valueUnavailable}
          </div>
          <div style={{ marginTop: space[3], color: "var(--text-tertiary)", fontSize: fontSizes.sm, fontVariantNumeric: "tabular-nums" }}>
            {tx.decimal} <strong style={{ color: "var(--text-primary)", fontWeight: 600 }}>{loading ? "—" : numericValue ?? "—"}</strong>
          </div>
        </section>

        <section
          aria-labelledby="dashboard-gpu-name"
          style={{ minWidth: 0, display: "flex", flexDirection: "column", justifyContent: "center", padding: `${space[5]}px ${space[6]}px`, borderRadius: radii.lg, background: "var(--bg-tertiary)" }}
        >
          <div id="dashboard-gpu-name" style={{ display: "flex", alignItems: "center", gap: space[2], color: "var(--text-secondary)", fontSize: fontSizes.sm, marginBottom: space[3] }}>
            <MonitorCog size={16} aria-hidden="true" />
            {tx.gpuName}
          </div>
          <div style={{ color: "var(--text-primary)", fontSize: fontSizes["2xl"], fontWeight: 600, lineHeight: 1.35, overflowWrap: "anywhere", display: "-webkit-box", WebkitLineClamp: 3, WebkitBoxOrient: "vertical", overflow: "hidden" }} title={gpuName ?? undefined}>
            {loading ? tx.loadingValue : gpuName ?? tx.valueUnavailable}
          </div>
        </section>
      </div>
    </GlassCard>
  );
}

// Module-level cache to avoid reset on page re-entry
let cachedSysInfo: SystemInfo | null = null;

export default function Dashboard() {
  const { lang } = useLanguage();
  const tx = t[lang];
  const [cachedHardware] = useState(readDashboardHardwareCache);
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(cachedSysInfo);
  const [trend, setTrend] = useState<MetricPoint[]>([]);
  const [win32Value, setWin32Value] = useState<Win32ValueSnapshot | null>(cachedHardware.win32Value);
  const [gpuName, setGpuName] = useState<string | null>(cachedHardware.gpuName);
  const [hardwareLoading, setHardwareLoading] = useState(!cachedHardware.win32Value && !cachedHardware.gpuName);
  const lastGoodCpu = useRef(cachedSysInfo?.cpu_percent ?? 0);

  useEffect(() => {
    const fetchSysInfo = async () => {
      try {
        const result = await window.electronAPI?.bridge.call<SystemInfo>("system.info");
        if (!result) return;

        const nextInfo = { ...result };
        if (nextInfo.cpu_percent === 0 && lastGoodCpu.current > 0) {
          nextInfo.cpu_percent = lastGoodCpu.current;
        } else if (nextInfo.cpu_percent > 0) {
          lastGoodCpu.current = nextInfo.cpu_percent;
        }

        cachedSysInfo = nextInfo;
        setSysInfo(nextInfo);
        setTrend((previous) => [
          ...previous.slice(-23),
          {
            cpu: nextInfo.cpu_percent,
            memory: nextInfo.memory_percent,
            disk: nextInfo.disk_percent,
          },
        ]);
      } catch {
        // Keep the last known-good snapshot visible when a poll fails.
      }
    };

    void fetchSysInfo();
    const interval = window.setInterval(fetchSysInfo, 2500);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCurrentValues = async () => {
      const api = window.electronAPI;
      if (!api) {
        if (!cancelled) setHardwareLoading(false);
        return;
      }

      const [win32Result, gpuResult] = await Promise.allSettled([
        api.bridge.call<Win32ValueSnapshot>("registry.read"),
        api.bridge.call<GpuDetectionSnapshot>("gpu.detect"),
      ]);

      if (cancelled) return;

      let nextWin32Value = cachedHardware.win32Value;
      let nextGpuName = cachedHardware.gpuName;

      if (win32Result.status === "fulfilled") {
        const snapshot = unwrapBridgeResult<Win32ValueSnapshot>(win32Result.value);
        if (snapshot && !snapshot.error) {
          nextWin32Value = snapshot;
          setWin32Value(snapshot);
        }
      }

      if (gpuResult.status === "fulfilled") {
        const snapshot = unwrapBridgeResult<GpuDetectionSnapshot>(gpuResult.value);
        if (snapshot && !snapshot.error) {
          nextGpuName = snapshot.adapters?.map((adapter) => adapter.name?.trim()).filter(Boolean).join(" · ") || null;
          setGpuName(nextGpuName);
        }
      }

      try {
        localStorage.setItem(STORAGE_DASHBOARD_HARDWARE, JSON.stringify({ win32Value: nextWin32Value, gpuName: nextGpuName }));
      } catch {
        // Cache is an enhancement; the live RPC result remains authoritative.
      }

      setHardwareLoading(false);
    };

    void fetchCurrentValues();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: "flex", flexDirection: "column", gap: space[6], height: "100%", minHeight: 0 }}
    >
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(420px, 1fr))", gridAutoRows: "minmax(min-content, 1fr)", gap: space[4], alignItems: "stretch", alignContent: "stretch", flex: 1, height: "100%", minHeight: 0 }}>
        <SystemHealthPanel sysInfo={sysInfo} trend={trend} tx={tx} />
        <CurrentValuesPanel win32Value={win32Value} gpuName={gpuName} loading={hardwareLoading} tx={tx} />
      </div>
    </motion.div>
  );
}
