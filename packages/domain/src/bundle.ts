/** Bundle output format */
export type ExportBundleFormat = 'folder' | 'zip';

/** What gets included in a bundle */
export interface ExportBundleContents {
  /** Sprite sheet or sequence images */
  images: boolean;
  /** Manifest JSON */
  manifest: boolean;
  /** Thumbnail/preview image */
  preview: boolean;
}

/** Entry for a single asset within a bundle */
export interface BundleAssetEntry {
  assetId: string;
  assetName: string;
  clipId: string | null;
  exportAction: 'sequence' | 'sheet' | 'all_clips_sheet';
  layout: import('./export').ExportLayout;
  manifestFormat: import('./export').ManifestFormat;
}

/** Result from previewing a bundle before export */
export interface BundlePreviewResult {
  /** Files that will be written */
  files: BundlePreviewFile[];
  /** Total estimated size in bytes (0 if unknown) */
  estimatedBytes: number;
  /** Warnings (missing clips, oversized output, etc.) */
  warnings: string[];
}

export interface BundlePreviewFile {
  /** Relative path within the bundle */
  relativePath: string;
  /** File type category */
  fileType: 'image' | 'manifest' | 'preview' | 'metadata';
}

/** Per-asset entry in a catalog bundle preview */
export interface CatalogBundleAssetEntry {
  assetId: string;
  assetName: string;
  status: 'ok' | 'missing' | 'error';
  fileCount: number;
  warnings: string[];
}

/** Result from previewing a catalog (multi-asset) bundle */
export interface CatalogBundlePreviewResult {
  assets: CatalogBundleAssetEntry[];
  totalFiles: number;
  warnings: string[];
}

/** Result after exporting a catalog bundle */
export interface CatalogBundleExportResult {
  outputPath: string;
  format: ExportBundleFormat;
  assetCount: number;
  skippedCount: number;
  files: string[];
  totalBytes: number;
  wasSuffixed: boolean;
  warnings: string[];
}

/** Result after writing a bundle */
export interface ExportBundleResult {
  /** Root path of the written bundle (folder path or zip path) */
  outputPath: string;
  /** Format used */
  format: ExportBundleFormat;
  /** Files written */
  files: string[];
  /** Total bytes written */
  totalBytes: number;
  /** Whether collision-safe naming was applied */
  wasSuffixed: boolean;
  /** Warnings */
  warnings: string[];
}
