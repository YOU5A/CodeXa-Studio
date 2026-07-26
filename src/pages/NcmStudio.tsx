import { useState, useCallback, useEffect } from "react";
import {
  FolderOpen, Search, CheckCircle, XCircle, Zap, ExternalLink,
} from "lucide-react";
import {
  GlassButton, GlassInput, GlassSurface, GlassBadge, GlassProgressBar,
} from "@/design-system/components";
import { space, fontSizes, radii } from "@/design-system/tokens";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/contexts/ToastContext";
import { useBridge } from "@/hooks/useBridge";
import type { NcmFileInfo, DecodeResult } from "@/types";
import { STORAGE_NCM_OUTPUT_DIR } from "@/constants/storage-keys";

import FileList from "./ncm/FileList";
import MetadataPanel from "./ncm/MetadataPanel";

const t = {
  zh: {
    title: "NCM Studio",
    subtitle: "NCM 无损解码引擎 — 将网易云 NCM 格式转换为 FLAC/MP3",
    browse: "浏览",
    scan: "扫描",
    found: "找到 {n} 个 NCM 文件",
    outputDir: "输出目录",
    noFileSelected: "请先选择文件",
    noMetadata: "选择文件查看元数据",
    title_: "标题",
    artist: "艺术家",
    album: "专辑",
    format: "格式",
    duration: "时长",
    writeTags: "写入标签",
    decodeSelected: "解码选中",
    openOutput: "打开输出目录",
    decoding: "解码中...",
    success: "成功",
    failed: "失败",
    browseFolder: "选择 NCM 文件夹",
    browseOutput: "选择输出目录",
    scanning: "扫描中...",
    decodeDone: "解码完成",
    decodeFail: "解码失败",
    ncmFiles: "NCM 文件",
    metadata: "元数据",
    all: "全选",
    none: "取消",
    filesCount: "个文件",
    noFiles: "选择文件夹并扫描 NCM 文件",
  },
  en: {
    title: "NCM Studio",
    subtitle: "Lossless NCM decoder — Convert NetEase NCM to FLAC/MP3",
    browse: "Browse",
    scan: "Scan",
    found: "Found {n} NCM files",
    outputDir: "Output",
    noFileSelected: "Select a file first",
    noMetadata: "Select a file to view metadata",
    title_: "Title",
    artist: "Artist",
    album: "Album",
    format: "Format",
    duration: "Duration",
    writeTags: "Write Tags",
    decodeSelected: "Decode Selected",
    openOutput: "Open Output",
    decoding: "Decoding...",
    success: "Success",
    failed: "Failed",
    browseFolder: "Select NCM folder",
    browseOutput: "Select output directory",
    scanning: "Scanning...",
    decodeDone: "Decode Complete",
    decodeFail: "Decode Failed",
    ncmFiles: "NCM Files",
    metadata: "Metadata",
    all: "All",
    none: "None",
    filesCount: "files",
    noFiles: "Select a folder and scan for NCM files",
  },
};


// ── Session-persistent state (survives page switching, resets on app restart) ──
let sessionState: {
  folder: string;
  files: NcmFileInfo[];
  selectedFile: NcmFileInfo | null;
  selectedIndices: number[];
  ncmInfo: Record<string, any> | null;
  results: DecodeResult[];
} = {
  folder: "",
  files: [],
  selectedFile: null,
  selectedIndices: [],
  ncmInfo: null,
  results: [],
};

export default function NcmStudio() {
  const { lang } = useLanguage();
  const { showToast } = useToast();
  const { call, openFolder } = useBridge();
  const tx = t[lang];

  const [folder, setFolder] = useState(sessionState.folder);
  const [files, setFiles] = useState<NcmFileInfo[]>(sessionState.files);
  const [selectedFile, setSelectedFile] = useState<NcmFileInfo | null>(sessionState.selectedFile);
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(
    () => new Set(sessionState.selectedIndices)
  );
  const [outputDir, setOutputDir] = useState(() =>
    localStorage.getItem(STORAGE_NCM_OUTPUT_DIR) || "");
  const [ncmInfo, setNcmInfo] = useState<Record<string, any> | null>(sessionState.ncmInfo);
  const [writeTags, setWriteTags] = useState(true);
  const [results, setResults] = useState<DecodeResult[]>(sessionState.results);
  const [isScanning, setIsScanning] = useState(false);
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodeProgress, setDecodeProgress] = useState(0);
  // Sync state back to session store on every change
  useEffect(() => { sessionState.folder = folder; }, [folder]);
  useEffect(() => { sessionState.files = files; }, [files]);
  useEffect(() => { sessionState.selectedFile = selectedFile; }, [selectedFile]);
  useEffect(() => { sessionState.selectedIndices = [...selectedIndices]; }, [selectedIndices]);
  useEffect(() => { sessionState.ncmInfo = ncmInfo; }, [ncmInfo]);
  useEffect(() => { sessionState.results = results; }, [results]);

  // Restore selectedIndices from stored indices when component remounts
  useEffect(() => {
    if (files.length > 0 && sessionState.selectedIndices.length > 0) {
      const valid = sessionState.selectedIndices.filter((i: number) => i < files.length);
      if (valid.length > 0) {
        setSelectedIndices(new Set(valid));
      }
    }
  }, []); // run once on mount


  const browseFolder = useCallback(async () => {
    const dir = await openFolder();
    if (dir) setFolder(dir);
  }, [openFolder]);

  const browseOutput = useCallback(async () => {
    const dir = await openFolder();
    if (dir) {
      setOutputDir(dir);
      localStorage.setItem(STORAGE_NCM_OUTPUT_DIR, dir);
    }
  }, [openFolder]);

  const scan = useCallback(async () => {
    if (!folder) return;
    setIsScanning(true);
    try {
      const result = await call("ncm.list", { folder, recursive: true });
      const fileList = (result?.files as string[]) || [];
      const items: NcmFileInfo[] = fileList.map((fp) => {
        const parts = fp.split("\\");
        return { filepath: fp, filename: parts[parts.length - 1], size: 0 };
      });
      setFiles(items);
      setSelectedFile(null);
      setSelectedIndices(new Set());
      setNcmInfo(null);
      setResults([]);
      showToast(tx.found.replace("{n}", String(items.length)), "info");
    } catch (e: any) {
      showToast(e?.message || tx.decodeFail, "error");
    } finally {
      setIsScanning(false);
    }
  }, [folder, call, showToast, tx]);

  const handleSelect = useCallback(async (file: NcmFileInfo, index: number) => {
    setSelectedFile(file);
    try {
      const info = await call("ncm.get_info", { filepath: file.filepath });
      setNcmInfo(info as Record<string, any>);
    } catch {
      setNcmInfo({ error: tx.decodeFail });
    }
  }, [call, tx]);

  const toggleSelection = useCallback((index: number) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      next.has(index) ? next.delete(index) : next.add(index);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedIndices(new Set(files.map((_, i) => i)));
  }, [files]);

  const deselectAll = useCallback(() => {
    setSelectedIndices(new Set());
  }, []);

  const decodeSelected = useCallback(async () => {
    if (selectedIndices.size === 0) {
      showToast(tx.noFileSelected, "warning");
      return;
    }
    setIsDecoding(true);
    setDecodeProgress(0);
    setResults([]);
    await new Promise(r => setTimeout(r, 50));
    try {
      const selectedFiles = [...selectedIndices].map((i) => files[i].filepath);
      const total = selectedFiles.length;
      let successCount = 0;
      let failCount = 0;
      const allResults: DecodeResult[] = [];

      for (let i = 0; i < total; i++) {
        const fp = selectedFiles[i];
        try {
          const result = await call("ncm.decode", {
            filepath: fp,
            outputDir: outputDir || undefined,
            writeTags,
          }) as unknown as DecodeResult;
          allResults.push(result);
          if (result?.success) {
            successCount++;
            // Log cover debug info to DevTools
            if ((result as any).coverEmbedded) {
              console.log("[NCM Decode] %c" + fp.split("\\").pop() + " %ccover embedded: " + ((result as any).coverDebug || ""), "color:#4f8;font-weight:bold", "color:inherit");
            } else {
              console.log("[NCM Decode] %c" + fp.split("\\").pop() + " %cno cover: " + ((result as any).coverDebug || ""), "color:#ff8;font-weight:bold", "color:inherit");
            }
          } else {
            failCount++;
            console.error("[NCM Decode] %c" + fp.split("\\").pop() + " %cfailed: " + ((result as any).errorMessage || "?"), "color:#f66;font-weight:bold", "color:inherit");
          }
        } catch (e: any) {
          allResults.push({ success: false, errorMessage: e?.message || "Unknown error", audioFormat: "", originalSize: 0, decryptedSize: 0 });
          failCount++;
        }
        // Update progress after each file
        const progress = Math.round(((i + 1) / total) * 100);
        setDecodeProgress(progress);
        setResults([...allResults]);
      }

      showToast(
        `${successCount} ${tx.success}, ${failCount} ${tx.failed}`,
        failCount === 0 ? "success" : "warning"
      );
    } catch (e: any) {
      showToast(e?.message || tx.decodeFail, "error");
    } finally {
      setIsDecoding(false);
    }
  }, [selectedIndices, files, outputDir, writeTags, call, showToast, tx]);

  const openOutput = useCallback(() => {
    const dir = outputDir || folder;
    if (dir) window.electronAPI?.shell.openPath(dir);
  }, [outputDir, folder]);

  const selCount = selectedIndices.size;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: space[3], height: "100%" }}>
      <GlassSurface tier="regular" style={{
        display: "flex", alignItems: "center", gap: space[2],
        padding: "8px 12px", borderRadius: radii.md, flexWrap: "wrap", flexShrink: 0,
      }}>
        <GlassButton variant="ghost" size="sm" onClick={browseFolder}>
          <FolderOpen size={14} />
          <span style={{ marginLeft: 4 }}>{tx.browse}</span>
        </GlassButton>
        <GlassInput
          value={folder}
          onChange={(e) => setFolder((e.target as HTMLInputElement).value)}
          placeholder={tx.browseFolder}
          style={{ flex: 1, minWidth: 120, fontSize: fontSizes.xs }}
        />
        <GlassButton variant="primary" size="sm" onClick={scan} disabled={!folder || isScanning}>
          <Search size={14} />
          <span style={{ marginLeft: 4 }}>{isScanning ? tx.scanning : tx.scan}</span>
        </GlassButton>
        {files.length > 0 && (
          <GlassBadge variant="accent">{tx.found.replace("{n}", String(files.length))}</GlassBadge>
        )}
        <GlassButton variant="ghost" size="sm" onClick={browseOutput}>
          <FolderOpen size={14} />
          <span style={{ marginLeft: 4 }}>{tx.outputDir}</span>
        </GlassButton>
        <span style={{
          fontSize: fontSizes.xs, color: "var(--text-tertiary)",
          maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {outputDir || folder || "-"}
        </span>
      </GlassSurface>

      <div style={{ display: "flex", gap: space[3], flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* Left: FileList + Actions */}
        <div style={{ minWidth: 200, display: "flex", flexDirection: "column", minHeight: 0, flexShrink: 0 }}>
          <div style={{ flex: 1, minHeight: 0 }}>
            <FileList
              files={files}
              selectedFile={selectedFile}
              selectedIndices={selectedIndices}
              onSelect={handleSelect}
              onToggleSelect={toggleSelection}
              onSelectAll={selectAll}
              onDeselectAll={deselectAll}
              ncmFilesLabel={tx.ncmFiles}
              allLabel={tx.all}
              noneLabel={tx.none}
              filesCountLabel={tx.filesCount}
              noFilesLabel={tx.noFiles}
            />
          </div>
          <div style={{ flexShrink: 0, paddingTop: space[2] }}>
            <GlassSurface tier="regular" style={{
              display: "inline-flex", alignItems: "center", gap: space[2],
              padding: "8px 12px", borderRadius: radii.md,
              width: "fit-content",
            }}>
              <GlassButton variant="ghost" size="sm" onClick={openOutput}>
                <ExternalLink size={14} />
                <span style={{ marginLeft: 4 }}>{tx.openOutput}</span>
              </GlassButton>
              <GlassButton
                variant="primary" size="sm" onClick={decodeSelected}
                disabled={selCount === 0 || isDecoding}
              >
                <Zap size={14} />
                <span style={{ marginLeft: 4 }}>{tx.decodeSelected} ({selCount})</span>
              </GlassButton>
            </GlassSurface>
          </div>
        </div>

        {/* Right: Metadata + Results overlay */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, position: "relative" }}>
          <MetadataPanel
            info={ncmInfo}
            writeTags={writeTags}
            onWriteTagsChange={setWriteTags}
            metadataLabel={tx.metadata}
            noMetadataText={tx.noMetadata}
            titleLabel={tx.title_}
            artistLabel={tx.artist}
            albumLabel={tx.album}
            formatLabel={tx.format}
            durationLabel={tx.duration}
            writeTagsLabel={tx.writeTags}
          />
          {(isDecoding || results.length > 0) && (
            <div style={{
              position: "absolute", bottom: 0, left: 0, right: 0,
              zIndex: 5, marginRight: space[3], marginBottom: 0, marginLeft: space[2],
            }}>
              <GlassSurface tier="regular" style={{
                padding: 10, borderRadius: radii.md,
                maxHeight: 150, overflowY: "auto",
              }}>
                {isDecoding && (
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)", marginBottom: 3 }}>
                      {tx.decoding}
                    </div>
                    <GlassProgressBar value={decodeProgress} />
                  </div>
                )}
                {results.length > 0 && (
                  <>
                    <div style={{ fontSize: fontSizes.xs, color: "var(--text-secondary)", marginBottom: 4 }}>
                      {results.filter((r: DecodeResult) => r.success).length} {tx.success}
                      {" / "}
                      {results.filter((r: DecodeResult) => !r.success).length} {tx.failed}
                    </div>
                    <div style={{ fontSize: fontSizes.xs }}>
                      {results.map((r: DecodeResult, i: number) => (
                        <div key={i} style={{
                          display: "flex", alignItems: "center", gap: 6, padding: "2px 0",
                          color: r.success ? "var(--text-primary)" : "var(--danger)",
                        }}>
                          {r.success
                            ? <CheckCircle size={12} style={{ color: "var(--success)", flexShrink: 0 }} />
                            : <XCircle size={12} style={{ color: "var(--danger)", flexShrink: 0 }} />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {r.success
                              ? r.outputPath?.split("\\").pop() || r.outputPath
                              : r.errorMessage}
                          </span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </GlassSurface>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}