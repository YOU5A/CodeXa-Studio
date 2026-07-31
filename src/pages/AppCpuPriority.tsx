import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Plus, Pencil, Trash2, RefreshCw, Upload, Download } from "lucide-react";
import GlassCard from "@/components/GlassCard";
import { GlassButton, GlassInput, GlassModal, GlassSelect, GlassToggle, GlassBadge, GlassEmptyState } from "@/design-system/components";
import { space, radii, fontSizes } from "@/design-system/tokens";
import PageLayout from "@/components/PageLayout";
import type { SelectOption } from "@/design-system/components";
import { useToast } from "@/contexts/ToastContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useConfirm } from "@/contexts/ConfirmContext";
import { recordActivity } from "@/hooks/useActivityLog";
import type { PriorityRule } from "@/types";
import { useTheme } from "@/hooks/useTheme";
import { getAnimDuration, EASE_OUT } from "@/utils/animations";

interface Props {}

const t = {
  zh: {
    title: "应用程序 CPU / I/O 优先级",
    subtitle: "通过 Windows 注册表永久设置应用优先级",
    add: "添加应用",
    edit: "编辑",
    delete: "删除",
    refresh: "刷新",
    export: "导出配置",
    import: "导入配置",
    name: "应用名称",
    cpu: "CPU 优先级",
    io: "I/O 优先级",
    noRules: "暂无已配置的应用",
    addDialog: "添加应用优先级",
    editDialog: "编辑应用优先级",
    nameLabel: "应用名称 (exe)",
    cpuLabel: "CPU 优先级",
    ioLabel: "I/O 优先级",
    ioEnable: "启用 I/O 优先级",
    save: "保存",
    cancel: "取消",
    nameEmpty: "应用名称不能为空",
    deleteConfirm: "确定要删除此规则吗？",
    importConfirm: "将导入新的配置，确定继续？",
    success: "操作成功",
    failed: "操作失败",
    exported: "配置已导出",
    importResult: "导入完成: {imported} 成功, {failed} 失败",
    cpuOptions: {
      "1": "空闲 (1)",
      "2": "正常 (2)",
      "3": "高 (3) - 推荐游戏",
      "4": "实时 (4) - 谨慎",
      "5": "低于正常 (5)",
      "6": "高于正常 (6)",
    },
    ioOptions: {
      "0": "非常低 (0)",
      "1": "低 (1)",
      "2": "正常 (2)",
      "3": "高 (3) - 推荐游戏",
    },
  },
  en: {
    title: "Application CPU / I/O Priority",
    subtitle: "Permanently set application priority via Windows Registry",
    add: "Add App",
    edit: "Edit",
    delete: "Delete",
    refresh: "Refresh",
    export: "Export Config",
    import: "Import Config",
    name: "App Name",
    cpu: "CPU Priority",
    io: "I/O Priority",
    noRules: "No configured applications",
    addDialog: "Add Application Priority",
    editDialog: "Edit Application Priority",
    nameLabel: "App Name (exe)",
    cpuLabel: "CPU Priority",
    ioLabel: "I/O Priority",
    ioEnable: "Enable I/O Priority",
    save: "Save",
    cancel: "Cancel",
    nameEmpty: "App name cannot be empty",
    deleteConfirm: "Delete this rule?",
    importConfirm: "Import new configuration?",
    success: "Operation successful",
    failed: "Operation failed",
    exported: "Config exported",
    importResult: "Import done: {imported} success, {failed} failed",
    cpuOptions: {
      "1": "Idle (1)",
      "2": "Normal (2)",
      "3": "High (3) - Gaming",
      "4": "Realtime (4) - Caution",
      "5": "Below Normal (5)",
      "6": "Above Normal (6)",
    },
    ioOptions: {
      "0": "Very Low (0)",
      "1": "Low (1)",
      "2": "Normal (2)",
      "3": "High (3) - Gaming",
    },
  },
};

const cpuLabelMap: Record<string, string> = {
  "1": "Idle", "2": "Normal", "3": "High",
  "4": "Realtime", "5": "Below Normal", "6": "Above Normal", "-": "-",
};
const ioLabelMap: Record<string, string> = {
  "0": "Very Low", "1": "Low", "2": "Normal", "3": "High", "-": "-",
};


export default function AppCpuPriority(_props: Props) {
  const { lang } = useLanguage();
  const tx = t[lang];
  const { showToast } = useToast();
  const { confirm } = useConfirm();
  const [rules, setRules] = useState<PriorityRule[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [editTarget, setEditTarget] = useState<PriorityRule | null>(null);
  const [formName, setFormName] = useState("");
  const [formCpu, setFormCpu] = useState("3");
  const [formIo, setFormIo] = useState("");
  const [enableIo, setEnableIo] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchRules = useCallback(async () => {
    try {
      const result = await window.electronAPI?.bridge.call("priority.list");
      if (result && !result.error) setRules(result.applications ?? []);
    } catch { /* bridge not ready, will retry */ }
  }, []);

  useEffect(() => { fetchRules(); }, [fetchRules]);

  const openDialog = (rule?: PriorityRule) => {
    if (rule) {
      setEditTarget(rule);
      setFormName(rule.name);
      setFormCpu(rule.cpu_priority === "-" ? "3" : rule.cpu_priority);
      const ioVal = rule.io_priority;
      if (ioVal && ioVal !== "-") { setFormIo(ioVal); setEnableIo(true); }
      else { setFormIo(""); setEnableIo(false); }
    } else {
      setEditTarget(null);
      setFormName("");
      setFormCpu("3");
      setFormIo("");
      setEnableIo(false);
    }
    setShowDialog(true);
  };

  const saveRule = async () => {
    if (!formName.trim()) { showToast(tx.nameEmpty, "warning"); return; }
    setSaving(true);
    try {
      const method = editTarget ? "priority.edit" : "priority.add";
      const result = await window.electronAPI?.bridge.call(method, {
        name: formName.trim(),
        cpu_priority: parseInt(formCpu),
        io_priority: enableIo && formIo ? parseInt(formIo) : null,
      });
      setSaving(false);
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        showToast(tx.success, "success");
        recordActivity("appcpu", `${editTarget ? (lang === "zh" ? "编辑" : "Edited") : (lang === "zh" ? "添加" : "Added")} ${formName.trim()}`);
        setShowDialog(false);
        fetchRules();
      }
    } catch (e: any) {
      setSaving(false);
      showToast(e?.message ?? tx.failed, "error");
    }
  };

  const deleteRule = async (rule: PriorityRule) => {
    const ok = await confirm({ title: tx.deleteConfirm, danger: true });
        if (!ok) return;
    try {
      const result = await window.electronAPI?.bridge.call("priority.delete", { name: rule.name });
      if (result?.error) {
        showToast(result.error, "error");
      } else {
        recordActivity("appcpu", `${lang === "zh" ? "删除" : "Deleted"} ${rule.name}`);
        fetchRules();
      }
    } catch (e: any) {
      showToast(e?.message ?? tx.failed, "error");
    }
  };

  const exportConfig = async () => {
    try {
      const dest = await window.electronAPI?.dialog.saveFile({
        defaultPath: "AppCpuPriority_export.json",
        filters: [{ name: "JSON Files", extensions: ["json"] }],
      });
      if (!dest) return;
      const result = await window.electronAPI?.bridge.call("priority.export", { filepath: dest });
      if (result?.success) {
        showToast(tx.exported, "success");
      } else {
        showToast(result?.error ?? tx.failed, "error");
      }
    } catch (e: any) {
      showToast(e?.message ?? tx.failed, "error");
    }
  };

  const importConfig = async () => {
    try {
      const ok = await confirm({ title: tx.importConfirm, danger: false });
      if (!ok) return;
      const filepath = await window.electronAPI?.dialog.openFile([{
        name: "JSON Files", extensions: ["json"],
      }]);
      if (!filepath) return;
      const result = await window.electronAPI?.bridge.call("priority.import_config", { filepath });
      if (result && !result.error) {
        const msg = tx.importResult
          .replace("{imported}", String(result.imported ?? 0))
          .replace("{failed}", String(result.failed ?? 0));
        showToast(msg, "success");
        fetchRules();
      } else {
        showToast(result?.error ?? tx.failed, "error");
      }
    } catch (e: any) {
      showToast(e?.message ?? tx.failed, "error");
    }
  };
  const { settings } = useTheme();
  const animationDuration = getAnimDuration(settings.animationSpeed);


  return (
    <>
      <PageLayout title={tx.title} subtitle={tx.subtitle} actions={
      <>
        <GlassButton variant="primary" onClick={() => openDialog()} style={{ padding: `${space[2]}px ${space[4]}px`, fontSize: fontSizes.md }}>
          <Plus size={14} /> {tx.add}
        </GlassButton>
        <GlassButton variant="secondary" onClick={fetchRules} style={{ padding: `${space[2]}px ${space[3]}px`, fontSize: fontSizes.md }}>
          <RefreshCw size={14} />
        </GlassButton>
        <GlassButton variant="secondary" onClick={exportConfig} style={{ padding: `${space[2]}px ${space[4]}px`, fontSize: fontSizes.md }}>
          <Download size={14} /> {tx.export}
        </GlassButton>
        <GlassButton variant="secondary" onClick={importConfig} style={{ padding: `${space[2]}px ${space[4]}px`, fontSize: fontSizes.md }}>
          <Upload size={14} /> {tx.import}
        </GlassButton>
      </>
    }>
      {rules.length === 0 ? (
        <GlassCard style={{ padding: `${space[12]}px ${space[6]}px`, textAlign: "center" }}>
          <motion.div initial={{ opacity: 0.3 }} animate={{ opacity: 1 }} transition={{ duration: animationDuration, ease: EASE_OUT }} />
          <div style={{ fontSize: fontSizes.md, color: "var(--text-tertiary)" }}>{tx.noRules}</div>
        </GlassCard>
      ) : (
        <GlassCard style={{ padding: 0, overflow: "hidden" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border-color)" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{tx.name}</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{tx.cpu}</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}>{tx.io}</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: 11, fontWeight: 500, color: "var(--text-tertiary)", textTransform: "uppercase" }}></th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.name} style={{ borderBottom: "1px solid var(--border-color)" }}>
                  <td style={{ padding: `${space[2]}px ${space[4]}px`, fontSize: fontSizes.md, fontWeight: 500, color: "var(--text-primary)" }}>{rule.name}</td>
                  <td style={{ padding: `${space[2]}px ${space[4]}px`, fontSize: fontSizes.md, color: "var(--text-secondary)" }}>
                    {cpuLabelMap[rule.cpu_priority] ?? rule.cpu_priority}
                  </td>
                  <td style={{ padding: `${space[2]}px ${space[4]}px`, fontSize: fontSizes.md, color: "var(--text-secondary)" }}>
                    {ioLabelMap[rule.io_priority] ?? rule.io_priority}
                  </td>
                  <td style={{ padding: `${space[2]}px ${space[4]}px`, textAlign: "right" }}>
                    <button className="btn-icon" onClick={() => openDialog(rule)}><Pencil size={12} /></button>
                    <button className="btn-icon" onClick={() => deleteRule(rule)} style={{ color: "var(--danger)" }}><Trash2 size={12} /></button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </GlassCard>
      )}
    </PageLayout>

      {/* Dialog — portal-rendered, outside PageLayout to avoid scroll clipping */}
      <GlassModal open={showDialog} onClose={() => setShowDialog(false)} maxWidth={420}>
        <h3 style={{
          fontSize: fontSizes.xl, fontWeight: 600,
          color: "var(--text-primary)",
          margin: 0,
          letterSpacing: "-0.01em",
        }}>
          {editTarget ? tx.editDialog : tx.addDialog}
        </h3>

        <div style={{ display: "flex", flexDirection: "column", gap: space[4] }}>
          <div>
            <label style={{
              fontSize: 11, fontWeight: 500,
              color: "var(--text-tertiary)",
              display: "block", marginBottom: 6,
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>{tx.nameLabel}</label>
            <GlassInput
              value={formName}
              onChange={(e) => setFormName((e.target as HTMLInputElement).value)}
              placeholder="example.exe"
              autoFocus
            />
          </div>

          <div>
            <label style={{
              fontSize: 11, fontWeight: 500,
              color: "var(--text-tertiary)",
              display: "block", marginBottom: 6,
              textTransform: "uppercase", letterSpacing: "0.04em",
            }}>{tx.cpuLabel}</label>
            <GlassSelect
              value={formCpu}
              onChange={setFormCpu}
              options={Object.entries(tx.cpuOptions).map(([v, l]) => ({ value: v, label: l }))}
              title={tx.cpuLabel}
            />
          </div>

          <div>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              cursor: "pointer", userSelect: "none",
            }}>
              <GlassToggle active={enableIo} onChange={setEnableIo} size="sm" />
              <span style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)" }}>{tx.ioEnable}</span>
            </div>
            {enableIo && (
              <div style={{ marginTop: space[3] }}>
                <GlassSelect
                  value={formIo}
                  onChange={setFormIo}
                  options={Object.entries(tx.ioOptions).map(([v, l]) => ({ value: v, label: l }))}
                  title={tx.ioLabel}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{
          display: "flex", justifyContent: "flex-end", gap: space[3],
        }}>
          <GlassButton
            variant="secondary"
            size="sm"
            onClick={() => setShowDialog(false)}
            disabled={saving}
          >{tx.cancel}</GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            onClick={saveRule}
            disabled={saving}
          >{tx.save}</GlassButton>
        </div>
      </GlassModal>
    </>
  );
}