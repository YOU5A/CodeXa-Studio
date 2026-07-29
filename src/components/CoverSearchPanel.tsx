/**
 * CoverSearchPanel — 网络封面搜索面板
 * 使用 GlassModal 承载，从网易云/QQ音乐搜索专辑封面
 */

import { useState, useCallback, useEffect, type FC } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Loader2, Globe, Image as ImageIcon, Download, Check } from "lucide-react";
import {
  GlassModal,
  GlassButton,
  GlassInput,
  GlassPillButton,
  GlassSurface,
  GlassEmptyState,
  GlassBadge,
  GlassTooltip,
  space,
  fontSizes,
  radii,
} from "@/design-system";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import type { Language } from "@/types";
import type { CoverSearchResult } from "@/types";

export interface CoverSearchPanelProps {
  open: boolean;
  onClose: () => void;
  title: string;
  artist: string;
  album: string;
  onApplyCover: (coverUrl: string) => Promise<void>;
  onSaveCover: (coverUrl: string) => Promise<void>;
}

type SearchSource = "netease" | "qq" | "both";

const t: Record<Language, Record<string, string>> = {
  zh: {
    title: "搜索网络封面",
    searchLabel: "搜索词",
    searchPlaceholder: "输入关键词搜索...",
    searchBtn: "搜索",
    source: "来源",
    netease: "网易云",
    qq: "QQ音乐",
    both: "全部",
    searching: "搜索中...",
    noResults: "未找到封面",
    emptyHint: "输入关键词或直接使用歌曲信息搜索",
    selectHint: "点击选择封面",
    applyCover: "替换封面",
    saveCover: "另存为",
    resultsCount: "共 {n} 个结果",
    selected: "已选中",
    coverFrom: "{source} · {title}",
    savedOk: "封面已保存",
    appliedOk: "封面已替换",
    saveFailed: "保存失败",
    applyFailed: "替换失败",
  },
  en: {
    title: "Search Cover Online",
    searchLabel: "Keywords",
    searchPlaceholder: "Enter keywords to search...",
    searchBtn: "Search",
    source: "Source",
    netease: "Netease",
    qq: "QQ Music",
    both: "Both",
    searching: "Searching...",
    noResults: "No covers found",
    emptyHint: "Enter keywords or use song info to search",
    selectHint: "Click to select a cover",
    applyCover: "Replace Cover",
    saveCover: "Save as File",
    resultsCount: "{n} results",
    selected: "Selected",
    coverFrom: "{source} · {title}",
    savedOk: "Cover saved successfully",
    appliedOk: "Cover applied",
    saveFailed: "Save failed",
    applyFailed: "Apply failed",
  },
};

const CoverSearchPanel: FC<CoverSearchPanelProps> = ({
  open,
  onClose,
  title,
  artist,
  album,
  onApplyCover,
  onSaveCover,
}) => {
  const { lang } = useLanguage();
  const { showToast } = useToast();
  const tx = t[lang];

  const [query, setQuery] = useState("");
  const [source, setSource] = useState<SearchSource>("both");
  const [results, setResults] = useState<CoverSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<CoverSearchResult | null>(null);
  const [applying, setApplying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [noticeMsg, setNoticeMsg] = useState<{ text: string; type: "success" | "error" } | null>(null);

  useEffect(() => {
    if (open) {
      const parts = [title, artist, album].filter(Boolean);
      if (parts.length > 0) {
        setQuery(parts.join(" "));
        setHasSearched(false);
        setResults([]);
        setSelected(null);
      }
    }
  }, [open]);

  useEffect(() => {
    if (noticeMsg) {
      const timer = setTimeout(() => setNoticeMsg(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [noticeMsg]);

  const doSearch = useCallback(async () => {
    const q = query.trim();
    if (!q) return;
    setLoading(true);
    setHasSearched(true);
    setSelected(null);

    const allResults: CoverSearchResult[] = [];

    try {
      if (source === "netease" || source === "both") {
        const r = await window.electronAPI?.music?.searchCoverNetease(q, "", "");
        if (r?.results) allResults.push(...r.results);
      }
    } catch (e) {
      console.error("[CoverSearch] Netease error:", e);
    }

    try {
      if (source === "qq" || source === "both") {
        const r = await window.electronAPI?.music?.searchCoverQQ(q, "", "");
        if (r?.results) allResults.push(...r.results);
      }
    } catch (e) {
      console.error("[CoverSearch] QQ error:", e);
    }

    const seen = new Set<string>();
    const deduped: CoverSearchResult[] = [];
    for (const item of allResults) {
      if (!seen.has(item.coverUrl)) {
        seen.add(item.coverUrl);
        deduped.push(item);
      }
    }

    setResults(deduped);
    setLoading(false);
  }, [query, source, title, artist, album]);

  useEffect(() => {
    if (hasSearched && query.trim()) {
      doSearch();
    }
  }, [source]);

  const handleApply = useCallback(async () => {
    if (!selected) return;
    setApplying(true);
    setNoticeMsg(null);
    try {
      if (window.electronAPI?.music?.downloadCoverImage) {
        const dl = await window.electronAPI.music.downloadCoverImage(selected.coverUrl);
        if (dl?.data) {
          await onApplyCover(dl.data);
          setNoticeMsg({ text: tx.appliedOk, type: "success" });
          return;
        }
      }
      await onApplyCover(selected.coverUrl);
      setNoticeMsg({ text: tx.appliedOk, type: "success" });
    } catch (e: any) {
      setNoticeMsg({ text: e?.message || tx.applyFailed, type: "error" });
    } finally {
      setApplying(false);
    }
  }, [selected, onApplyCover, tx]);

  const handleSave = useCallback(async () => {
    if (!selected) return;
    setSaving(true);
    setNoticeMsg(null);
    try {
      if (window.electronAPI?.music?.downloadCoverImage) {
        const dl = await window.electronAPI.music.downloadCoverImage(selected.coverUrl);
        if (dl?.data) {
          await onSaveCover(dl.data);
          setNoticeMsg({ text: tx.savedOk, type: "success" });
          return;
        }
      }
      await onSaveCover(selected.coverUrl);
      setNoticeMsg({ text: tx.savedOk, type: "success" });
    } catch (e: any) {
      setNoticeMsg({ text: e?.message || tx.saveFailed, type: "error" });
    } finally {
      setSaving(false);
    }
  }, [selected, onSaveCover, tx]);

  return (
    <GlassModal open={open} onClose={onClose} maxWidth={480}>
      <div style={{ padding: "28px 28px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
        <h3 style={{ fontSize: 17, fontWeight: 600, color: "var(--text-primary)", margin: 0 }}>
          {tx.title}
        </h3>

        <div style={{ display: "flex", gap: space[2], alignItems: "flex-end" }}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 11, color: "var(--text-tertiary)" }}>{tx.searchLabel}</span>
            <GlassInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={tx.searchPlaceholder}
              onKeyDown={(e) => { if (e.key === "Enter") doSearch(); }}
              style={{ fontSize: fontSizes.sm, padding: "6px 10px" }}
            />
          </div>
          <GlassButton
            key={loading ? "searching" : "idle"}
            variant="primary"
            size="md"
            onClick={doSearch}
            disabled={loading || !query.trim()}
            style={{ height: 34, minWidth: 72 }}
          >
            {loading ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Search size={14} />}
            <span style={{ marginLeft: 4 }}>{loading ? tx.searching : tx.searchBtn}</span>
          </GlassButton>
        </div>

        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={{ fontSize: 11, color: "var(--text-tertiary)", marginRight: 4 }}>{tx.source}:</span>
          {(["both", "netease", "qq"] as SearchSource[]).map((s) => (
            <GlassPillButton
              key={s}
              active={source === s}
              onClick={() => setSource(s)}
              style={{ fontSize: 11, padding: "2px 10px" }}
            >
              {tx[s]}
            </GlassPillButton>
          ))}
        </div>

        {results.length > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: space[2], flexWrap: "wrap" }}>
            <span style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)" }}>
              {tx.resultsCount.replace("{n}", String(results.length))}
            </span>
            {selected && (
              <GlassTooltip text={selected.title}>
                <GlassBadge variant="accent" style={{ maxWidth: "100%", overflow: "hidden", cursor: "default" }}>
                  <span style={{
                    display: "inline-block",
                    maxWidth: 260,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    verticalAlign: "bottom",
                  }}>
                    {tx.selected}: {selected.title}
                  </span>
                </GlassBadge>
              </GlassTooltip>
            )}
          </div>
        )}

        {loading ? (
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            padding: "40px 0", color: "var(--text-tertiary)",
          }}>
            <Loader2 size={20} style={{ animation: "spin 1s linear infinite", marginRight: 8 }} />
            {tx.searching}
          </div>
        ) : results.length === 0 && hasSearched ? (
          <GlassEmptyState
            icon={<ImageIcon size={32} style={{ opacity: 0.4 }} />}
            title={tx.noResults}
            description={tx.emptyHint}
          />
        ) : results.length > 0 ? (
          <div className="scroll-fade-edge" style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
            gap: space[2],
            maxHeight: 360,
            overflowY: "auto",
            padding: "2px 0",
            marginRight: -16,
            paddingRight: 16,
            marginBottom: -8,
            "--scroll-fade-size": "36px",
            maskImage: "linear-gradient(to bottom, transparent, black 36px, black calc(100% - 36px), transparent)",
            WebkitMaskImage: "linear-gradient(to bottom, transparent, black 36px, black calc(100% - 36px), transparent)",
          } as React.CSSProperties}>
            {results.map((item, idx) => {
              const isSel = selected?.coverUrl === item.coverUrl;
              return (
                <motion.div
                  key={item.coverUrl + idx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.03, duration: 0.25 }}
                  onClick={() => setSelected(isSel ? null : item)}
                  style={{
                    cursor: "pointer",
                    borderRadius: radii.md,
                    overflow: "hidden",
                    border: isSel
                      ? "2px solid var(--accent)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(0,0,0,0.2)",
                    transition: "border-color 0.2s ease, transform 0.15s ease",
                    transform: isSel ? "scale(1.03)" : "scale(1)",
                    position: "relative",
                  }}
                >
                  <img
                    src={item.coverUrl.replace(/T002R800x800/, "T002R200x200").replace(/\?param=\d+y\d+/, "") + (item.source === "netease" ? "?param=200y200" : "")}
                    alt={item.title}
                    loading="lazy"
                    style={{
                      width: "100%",
                      aspectRatio: "1",
                      objectFit: "cover",
                      display: "block",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                  <div style={{
                    position: "absolute", bottom: 0, left: 0, right: 0,
                    background: "linear-gradient(transparent, rgba(0,0,0,0.7))",
                    padding: "20px 6px 6px",
                    opacity: 0.85,
                  }}>
                    <span style={{
                      fontSize: 10, color: "#fff", lineHeight: 1.3,
                      display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}>
                      {item.title}
                    </span>
                    <GlassBadge variant="default" style={{ fontSize: 9, marginTop: 2, padding: "1px 5px" }}>
                      {item.source === "netease" ? tx.netease : tx.qq}
                    </GlassBadge>
                  </div>
                  {isSel && (
                    <div style={{
                      position: "absolute", top: 6, right: 6,
                      width: 22, height: 22, borderRadius: "50%",
                      background: "var(--accent)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                      <Check size={12} style={{ color: "#fff" }} />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>
        ) : null}

        <AnimatePresence>
          {noticeMsg && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: "linear" }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                padding: "8px 14px",
                borderRadius: radii.lg,
                fontSize: fontSizes.xs,
                fontWeight: 500,
                backdropFilter: "blur(32px) saturate(2.2)",
                WebkitBackdropFilter: "blur(32px) saturate(2.2)",
                background: noticeMsg.type === "success"
                  ? "rgba(22,163,74,0.22)"
                  : "rgba(220,38,38,0.22)",
                color: "rgba(255,255,255,0.92)",
                border: "1px solid rgba(255,255,255,0.10)",
                boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
                textAlign: "center",
              }}>
                {noticeMsg.text}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{ height: 0, opacity: 0, marginTop: 0 }}
              animate={{ height: "auto", opacity: 1, marginTop: 0 }}
              exit={{ height: 0, opacity: 0, marginTop: 0 }}
              transition={{ duration: 0.25, ease: "linear" }}
              style={{ overflow: "hidden" }}
            >
              <div style={{
                display: "flex", gap: space[2], paddingTop: 10,
                paddingBottom: 4,
                marginTop: 8,
                borderTop: "1px solid var(--border-color)",
              }}>
                <span style={{ flex: 1, overflow: "hidden", borderRadius: radii.xl }}>
                  <GlassButton
                    variant="primary"
                    size="md"
                    onClick={handleApply}
                    disabled={applying}
                    style={{ width: "100%", justifyContent: "center", outline: "none" }}
                  >
                    {applying ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={14} />}
                    <span style={{ marginLeft: 4 }}>{tx.applyCover}</span>
                  </GlassButton>
                </span>
                <GlassButton
                  variant="secondary"
                  size="md"
                  onClick={handleSave}
                  disabled={saving}
                  style={{ flex: 1, justifyContent: "center", outline: "none" }}
                >
                  {saving ? <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} /> : <Download size={14} />}
                  <span style={{ marginLeft: 4 }}>{tx.saveCover}</span>
                </GlassButton>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </GlassModal>
  );
};

export default CoverSearchPanel;
