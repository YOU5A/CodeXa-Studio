import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Cpu, MemoryStick, HardDrive, Activity, Clock, Database, Gauge, Music } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { GlassButton, GlassProgressBar, GlassBadge, GlassEmptyState } from "@/design-system/components";
import { space, radii, fontSizes } from "@/design-system/tokens";
import { getActivities, type ActivityEntry } from "@/hooks/useActivityLog";
import { useLanguage } from "@/contexts/LanguageContext";
import type { SystemInfo, BackupEntry, Language, Page } from "@/types";
import { useTheme } from "@/hooks/useTheme";

interface DashboardProps {
  onNavigate: (page: Page) => void;
}

const t = {
  zh: {
    title: "仪表盘",
    cpu: "CPU",
    memory: "内存",
    disk: "磁盘",
    system: "系统",
    windowsVersion: "Windows 版本",
    quickAccess: "快捷入口",
    win32Priority: "Win32 优先级",
    win32Desc: "管理系统 CPU 调度优先级",
    appCpuPriority: "应用 CPU 优先级",
    appCpuDesc: "管理应用程序 CPU/I/O 优先级",
    musicManager: "音乐管理器",
    musicDesc: "音频标签编辑与文件管理",
    recentActivity: "操作历史",
    recentBackups: "最近备份",
    noActivity: "暂无操作记录",
    noBackups: "暂无备份",
    loading: "加载中...",
    viewAll: "查看全部",
    cores: "核",
    threads: "线程",
  },
  en: {
    title: "Dashboard",
    cpu: "CPU",
    memory: "Memory",
    disk: "Disk",
    system: "System",
    windowsVersion: "Windows Version",
    quickAccess: "Quick Access",
    win32Priority: "Win32 Priority",
    win32Desc: "Manage system CPU scheduling priority",
    appCpuPriority: "App CPU Priority",
    appCpuDesc: "Manage application CPU/I/O priority",
    musicManager: "Music Manager",
    musicDesc: "Audio tag editor & file management",
    recentActivity: "Recent Activity",
    recentBackups: "Recent Backups",
    noActivity: "No recent activity",
    noBackups: "No backups",
    loading: "Loading...",
    viewAll: "View All",
    cores: "C",
    threads: "T",
  },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

function formatTimeAgo(iso: string, lang: Language): string {
  const now = Date.now();
  const then = new Date(iso).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return lang === "zh" ? "刚刚" : "just now";
  if (diff < 3600) return lang === "zh" ? `${Math.floor(diff / 60)} 分钟前` : `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return lang === "zh" ? `${Math.floor(diff / 3600)} 小时前` : `${Math.floor(diff / 3600)}h ago`;
  return lang === "zh" ? `${Math.floor(diff / 86400)} 天前` : `${Math.floor(diff / 86400)}d ago`;
}

const moduleLabels: Record<string, string> = {
  win32priority: "Win32 Priority",
  appcpupriority: "App CPU Priority",
  musicmanager: "Music Manager",
  backupcenter: "Backup Center",
};

/* ─── Shared Stat Icon ─── */
function StatIcon({ icon, color }: { icon: React.ReactNode; color: string }) {
  return (
    <div
      style={{
        width: 44,
        height: 44,
        borderRadius: radii.md,
        background: `color-mix(in srgb, ${color} 12%, transparent)`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color,
        flexShrink: 0,
      }}
    >
      {icon}
    </div>
  );
}

/* ─── Section Header ─── */
function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: space[2], marginBottom: space[4] }}>
      <span style={{ color: "var(--text-secondary)", display: "flex" }}>{icon}</span>
      <h3 style={{ fontSize: fontSizes.lg, fontWeight: 500, color: "var(--text-primary)", margin: 0 }}>
        {title}
      </h3>
    </div>
  );
}

/* ─── List Divider ─── */
const listItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[2]}px 0`,
  borderBottom: "1px solid var(--border-color)",
};
const lastItemStyle: React.CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: `${space[2]}px 0`,
};

export default function Dashboard({ onNavigate }: DashboardProps) {
  const { lang } = useLanguage();
  const tx = t[lang];
  const [sysInfo, setSysInfo] = useState<SystemInfo | null>(null);
  const [activities, setActivities] = useState<ActivityEntry[]>([]);
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loadingBackups, setLoadingBackups] = useState(true);

  useEffect(() => {
    const fetchSysInfo = async () => {
      try {
        const result = await window.electronAPI?.python.call("system.info");
        if (result) setSysInfo(result);
      } catch {}
    };
    fetchSysInfo();
    const interval = setInterval(fetchSysInfo, 2500);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setActivities(getActivities().slice(0, 5));
  }, []);

  useEffect(() => {
    const fetchBackups = async () => {
      const result = await window.electronAPI?.python.call("backup.list");
      if (result?.backups) setBackups(result.backups.slice(0, 5));
      setLoadingBackups(false);
    };
    fetchBackups();
  }, []);

  const { settings } = useTheme();

  const quickLinks = [
    { icon: <Cpu size={20} />, title: tx.win32Priority, desc: tx.win32Desc, page: "win32priority" as const },
    { icon: <Gauge size={20} />, title: tx.appCpuPriority, desc: tx.appCpuDesc, page: "appcpupriority" as const },
    { icon: <Music size={20} />, title: tx.musicManager, desc: tx.musicDesc, page: "musicmanager" as const },
  ];

  function getProgressColor(pct: number): "accent" | "success" | "warning" | "danger" {
    if (pct >= 90) return "danger";
    if (pct >= 70) return "warning";
    if (pct >= 50) return "accent";
    return "success";
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      style={{ display: "flex", flexDirection: "column", gap: space[6], height: "100%" }}
    >
      {/* ─── System Info Text ─── */}
      {sysInfo && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: space[2],
            padding: `${space[2]}px ${space[1]}px`,
            fontSize: fontSizes.xs,
            color: "var(--text-tertiary)",
            fontVariantNumeric: "tabular-nums",
            userSelect: "none",
          }}
        >
          <span style={{ fontWeight: 500, color: "var(--text-secondary)" }}>
            {sysInfo.hostname}
          </span>
          <span>
            {sysInfo.windows_edition} {sysInfo.windows_release}
          </span>
          <span style={{ opacity: 0.6 }}>
            Build {sysInfo.windows_build}
          </span>
        </div>
      )}
      {/* ─── Stat Cards Row ─── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: space[4],
        }}
      >
        {/* CPU */}
        <GlassCard style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
            <StatIcon icon={<Cpu size={20} />} color="var(--accent)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: fontSizes.sm, color: "var(--text-tertiary)" }}>{tx.cpu}</div>
              <div style={{ fontSize: fontSizes["2xl"], fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {sysInfo ? `${sysInfo.cpu_percent}%` : tx.loading}
              </div>
            </div>
          </div>
          {sysInfo && (
            <div>
              <GlassProgressBar value={sysInfo.cpu_percent} color={getProgressColor(sysInfo.cpu_percent)} height={5} />
              <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", marginTop: space[1] }}>
                {sysInfo.cpu_count_physical ?? sysInfo.cpu_count} {tx.cores} / {sysInfo.cpu_count} {tx.threads}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Memory */}
        <GlassCard style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
            <StatIcon icon={<MemoryStick size={20} />} color="var(--warning)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: fontSizes.sm, color: "var(--text-tertiary)" }}>{tx.memory}</div>
              <div style={{ fontSize: fontSizes["2xl"], fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {sysInfo ? `${sysInfo.memory_percent}%` : tx.loading}
              </div>
            </div>
          </div>
          {sysInfo && (
            <div>
              <GlassProgressBar value={sysInfo.memory_percent} color={getProgressColor(sysInfo.memory_percent)} height={5} />
              <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", marginTop: space[1] }}>
                {formatBytes(sysInfo.memory_used)} / {formatBytes(sysInfo.memory_total)}
              </div>
            </div>
          )}
        </GlassCard>

        {/* Disk */}
        <GlassCard style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
            <StatIcon icon={<HardDrive size={20} />} color="var(--success)" />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: fontSizes.sm, color: "var(--text-tertiary)" }}>{tx.disk}</div>
              <div style={{ fontSize: fontSizes["2xl"], fontWeight: 600, color: "var(--text-primary)", fontVariantNumeric: "tabular-nums" }}>
                {sysInfo ? `${sysInfo.disk_percent}%` : tx.loading}
              </div>
            </div>
          </div>
          {sysInfo && (
            <div>
              <GlassProgressBar value={sysInfo.disk_percent} color={getProgressColor(sysInfo.disk_percent)} height={5} />
              <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", marginTop: space[1] }}>
                {formatBytes(sysInfo.disk_used)} / {formatBytes(sysInfo.disk_total)}
              </div>
            </div>
          )}
        </GlassCard>

      </div>

      {/* ─── Quick Access ─── */}
      <div>
        <SectionHeader icon={<Activity size={16} />} title={tx.quickAccess} />
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: space[3] }}>
          {quickLinks.map((link) => (
            <GlassCard key={link.page} onClick={() => onNavigate(link.page)}>
              <div style={{ display: "flex", alignItems: "center", gap: space[3] }}>
                <div
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: radii.md,
                    background: "var(--accent-bg)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  {link.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: fontSizes.lg, fontWeight: 600, color: "var(--text-primary)", marginBottom: 2 }}>
                    {link.title}
                  </div>
                  <div style={{ fontSize: fontSizes.sm, color: "var(--text-tertiary)" }}>{link.desc}</div>
                </div>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>

      {/* ─── Recent Activity + Backups ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: space[4] }}>
        {/* Activity */}
        <GlassCard style={{ overflow: "hidden" }}>
          <SectionHeader icon={<Clock size={16} />} title={tx.recentActivity} />
          {activities.length === 0 ? (
            <GlassEmptyState title={tx.noActivity} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {activities.map((a, i) => (
                <div key={i} style={i < activities.length - 1 ? listItemStyle : lastItemStyle}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: fontSizes.sm,
                        color: "var(--text-primary)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {a.description}
                    </div>
                    <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", marginTop: 2 }}>
                      <GlassBadge size="sm">{moduleLabels[a.module] ?? a.module}</GlassBadge>
                    </div>
                  </div>
                  <span style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", flexShrink: 0, marginLeft: space[3] }}>
                    {formatTimeAgo(a.timestamp, lang)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </GlassCard>

        {/* Backups */}
        <GlassCard style={{ overflow: "hidden" }}>
          <SectionHeader icon={<Database size={16} />} title={tx.recentBackups} />
          {loadingBackups ? (
            <GlassEmptyState title={tx.loading} />
          ) : backups.length === 0 ? (
            <GlassEmptyState title={tx.noBackups} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: space[2] }}>
              {backups.map((bp, i) => (
                <div key={bp.filename} style={i < backups.length - 1 ? listItemStyle : lastItemStyle}>
                  <div>
                    <div style={{ fontSize: fontSizes.sm, color: "var(--text-primary)" }}>
                      {bp.date} {bp.time}
                    </div>
                    <div style={{ fontSize: fontSizes.xs, color: "var(--text-tertiary)", fontVariantNumeric: "tabular-nums" }}>
                      {lang === "zh" ? "值" : "Value"}: {bp.decimal} (0x{bp.hex?.replace("0x", "")})
                    </div>
                  </div>
                </div>
              ))}
              {backups.length >= 5 && (
                <GlassButton
                  variant="secondary"
                  size="sm"
                  onClick={() => onNavigate("backupcenter")}
                  style={{ fontSize: fontSizes.xs, padding: "6px 12px", alignSelf: "center", marginTop: space[1] }}
                >
                  {tx.viewAll}
                </GlassButton>
              )}
            </div>
          )}
        </GlassCard>
      </div>
    </motion.div>
  );
}