/** What frames to include in the export */
export type ExportScope =
  | { type: 'current_frame' }
  | { type: 'selected_span'; start: number; end: number }
  | { type: 'current_clip'; clipId: string }
  | { type: 'all_clips' };

/** How to arrange frames in the output image */
export type ExportLayout =
  | { type: 'horizontal_strip' }
  | { type: 'vertical_strip' }
  | { type: 'grid'; columns?: number | null };

/** Where a single frame lands in the output image */
export interface ExportPreviewFramePlacement {
  frameIndex: number;
  frameId: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Clip grouping metadata in the preview */
export interface ExportPreviewClipGroup {
  clipId: string;
  clipName: string;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  /** Index of the first placement belonging to this clip */
  placementOffset: number;
}

/** Full layout preview result — authoritative for later export */
export interface ExportPreviewResult {
  outputWidth: number;
  outputHeight: number;
  frameWidth: number;
  frameHeight: number;
  frameCount: number;
  columns: number;
  rows: number;
  placements: ExportPreviewFramePlacement[];
  clipGroups: ExportPreviewClipGroup[];
  warnings: string[];
}

/** Manifest format selection */
export type ManifestFormat = 'pixelstudio_native' | 'generic_runtime';

/** Summary of a concrete export operation */
export interface ExportResult {
  files: ExportedFileInfo[];
  manifest: ExportedFileInfo | null;
  frameCount: number;
  clipCount: number;
  skippedClips: number;
  wasSuffixed: boolean;
  warnings: string[];
}

export interface ExportedFileInfo {
  path: string;
  width: number;
  height: number;
}
