import type { NcmFileInfo, DecodeResult } from "@/types";

export interface NcmFileListProps {
  files: NcmFileInfo[];
  selectedFile: NcmFileInfo | null;
  selectedIndices: Set<number>;
  onSelect: (file: NcmFileInfo, index: number) => void;
  onToggleSelect: (index: number) => void;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  ncmFilesLabel: string;
  allLabel: string;
  noneLabel: string;
  filesCountLabel: string;
  noFilesLabel: string;
}

export interface NcmMetadataPanelProps {
  info: Record<string, any> | null;
  writeTags: boolean;
  onWriteTagsChange: (v: boolean) => void;
  metadataLabel: string;
  noMetadataText: string;
  titleLabel: string;
  artistLabel: string;
  albumLabel: string;
  formatLabel: string;
  durationLabel: string;
  writeTagsLabel: string;
}

export interface NcmDecodeBarProps {
  selCount: number;
  isDecoding: boolean;
  decodeProgress: number;
  results: DecodeResult[];
  onDecodeSelected: () => void;
  onOpenOutput: () => void;
  decodeSelectedLabel: string;
  openOutputLabel: string;
  decodingLabel: string;
  successLabel: string;
  failedLabel: string;
}
