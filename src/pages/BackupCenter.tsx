import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Trash2, FolderOpen, Download } from "lucide-react";
import { GlassCard, GlassButton, GlassEmptyState, GlassBadge } from "@/design-system/components";
import { space, fontSizes, radii } from "@/design-system/tokens";
import { useToast } from "@/contexts/ToastContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import type { BackupEntry } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import PageLayout from "@/components/PageLayout";
import { getAnimDuration, EASE_OUT } from "@/utils/animations";


function formatBytes(bytes: number): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`;
}

interface Props {}

const t = {
  zh: {
    title: "备份中心",
    subtitle: "管理注册表备份文件，支持恢复与导出",
    openDir: "打开备份目录",
    restore: "恢复",
    delete: "删除",
    export: "导出",
    source: "来源",
    noBackups: "暂无备份文件",
    restoreConfirm: "确定要恢复此备份吗？",
    deleteConfirm: "确定要删除此备份吗？",
    decimal: "十进制",
    hex: "十六进制",
    restored: "备份已恢复",
    deleted: "备份已删除",
    exported: "备份已导出",
    exportFailed: "导出失败",
  },
  en: {
    title: "Backup Center",
    subtitle: "Manage registry backup files — restore, export, and delete",
    openDir: "Open Backup Folder",
    restore: "Restore",
    delete: "Delete",
    export: "Export",
    source: "Source",
    noBackups: "No backup files",
    restoreConfirm: "Restore this backup?",
    deleteConfirm: "Delete this backup?",
    decimal: "Decimal",
    hex: "Hexadecimal",
    restored: "Backup restored",
    deleted: "Backup deleted",
    exported: "Backup exported",
    exportFailed: "Export failed",
  },
}

export default function BackupCenter(_props: Props) {
  const { lang } = useLanguage();
  const tx = t[lang];
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [backupDir, setBackupDir] = useState("");
  const [backups, setBackups] = useState<BackupEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchBackups = useCallback(async () => {
    const result = await window.electronAPI?.python.call("backup.list");
    if (result && !result.error) setBackups(result.backups ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBackups(); window.electronAPI?.python.call("backup.dir").then(r => { if (r?.dir) setBackupDir(r.dir); }); }, [fetchBackups]);

  const restoreBackup = async (bp: BackupEntry) => {
    const ok = await confirm({ title: tx.restoreConfirm, danger: false });
    if (!ok) return;
    const result = await window.electronAPI?.python.call("backup.restore", { filepath: bp.filepath });
    if (result?.success) {
      showToast(tx.restored, "success");
      fetchBackups();
    }
  };

  const deleteBackup = async (bp: BackupEntry) => {
    const ok = await confirm({ title: tx.deleteConfirm, danger: true });
    if (!ok) return;
    const result = await window.electronAPI?.python.call("backup.delete", { filename: bp.filename });
    if (result?.success) {
      showToast(tx.deleted, "success");
      fetchBackups();
    }
  };

  const openBackupDir = () => {
    window.electronAPI?.shell.openPath(backupDir);
  };

  const exportBackup = async (bp: BackupEntry) => {
    const dest = await window.electronAPI?.dialog.saveFile({
      defaultPath: bp.filename,
      filters: [{ name: "Registry Files", extensions: ["reg"] }],
    });
    if (!dest) return;
    const result = await window.electronAPI?.python.call("backup.export", {
      filepath: bp.filepath,
      dest: dest,
    });
    if (result?.success) {
      showToast(tx.exported, "success");
    } else {
      showToast(result?.error ?? tx.exportFailed, "error");
    }
  };
  const { settings } = useTheme();


  return (
    <PageLayout title={tx.title} subtitle={tx.subtitle} actions={
      <GlassButton variant="secondary" size="sm" onClick={openBackupDir}>
        <FolderOpen size={14} /> {tx.openDir}
      </GlassButton>
    }>
      {loading ? (
        <GlassCard style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: space[8] }}>
          <div style={{
            width: 24, height: 24, borderRadius: "50%",
            border: "3px solid var(--border-color)",
            borderTopColor: "var(--accent)",
            animation: "spin 0.6s linear infinite",
          }} />
        </GlassCard>
      ) : backups.length === 0 ? (
        <GlassCard style={{ padding: `${space[12]}px ${space[6]}px`, textAlign: "center" }}>
          <GlassEmptyState
            icon={<FolderOpen size={48} />}
            title={tx.noBackups}
          />
        </GlassCard>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: space[3] }}>
          {backups.map((bp) => (
            <GlassCard
              key={bp.filename}
              style={{
                padding: space[4] + "px " + space[5] + "px",
                display: "flex", alignItems: "center", justifyContent: "space-between",
              }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{
                  fontSize: fontSizes.md, fontWeight: 500,
                  color: "var(--text-primary)", marginBottom: 4,
                }}>
                  {bp.date} {bp.time}
                </div>
                <div style={{
                  fontSize: fontSizes.sm, color: "var(--text-secondary)",
                  fontVariantNumeric: "tabular-nums", letterSpacing: "0.02em",
                }}>
                  {tx.decimal}: {bp.decimal}  |  {tx.hex}: {bp.hex}
                </div>
                <div style={{ display: "flex", gap: space[3], marginTop: space[1] }}>
                  <GlassBadge variant="default" size="sm">
                    {tx.source}: {(bp as any).module === "win32" ? "Win32 Priority" : (bp as any).module ?? "N/A"}
                  </GlassBadge>
                  {(bp as any).size !== undefined && (
                    <GlassBadge variant="default" size="sm">
                      {formatBytes((bp as any).size)}
                    </GlassBadge>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", gap: space[2], flexShrink: 0, marginLeft: space[4] }}>
                <GlassButton variant="secondary" size="sm" onClick={() => exportBackup(bp)}>
                  <Download size={12} /> {tx.export}
                </GlassButton>
                <GlassButton variant="secondary" size="sm" onClick={() => restoreBackup(bp)}>
                  <RotateCcw size={12} /> {tx.restore}
                </GlassButton>
                <GlassButton variant="secondary" size="sm" onClick={() => deleteBackup(bp)}>
                  <Trash2 size={12} /> {tx.delete}
                </GlassButton>
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </PageLayout>
  );
}