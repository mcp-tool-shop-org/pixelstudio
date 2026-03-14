/** Preset kind — locomotion or secondary motion */
export type MotionPresetKind = 'locomotion' | 'secondary_motion';

/** An anchor definition within a preset */
export interface PresetAnchor {
  name: string;
  kind: string;
  parentName: string | null;
  falloffWeight: number;
  hintX: number;
  hintY: number;
}

/** Template/intent settings captured in a preset */
export interface PresetMotionSettings {
  intent?: string | null;
  templateId?: string | null;
  direction?: string | null;
  strength?: number | null;
  frameCount?: number | null;
  phaseOffset?: number | null;
}

/** Full preset document */
export interface MotionPresetDocument {
  schemaVersion: number;
  id: string;
  name: string;
  kind: MotionPresetKind;
  description?: string | null;
  anchors: PresetAnchor[];
  motionSettings: PresetMotionSettings;
  targetNotes?: string | null;
  createdAt: string;
  modifiedAt: string;
}

/** Lightweight preset summary for listing */
export interface MotionPresetSummary {
  id: string;
  name: string;
  kind: MotionPresetKind;
  description?: string | null;
  anchorCount: number;
  hasHierarchy: boolean;
  templateId?: string | null;
  createdAt: string;
  modifiedAt: string;
}

/** Result from saving a preset */
export interface PresetSaveResult {
  id: string;
  name: string;
}

/** Compatibility check result */
export interface PresetCompatibility {
  tier: 'compatible' | 'partial' | 'incompatible';
  matchingAnchors: string[];
  missingAnchors: string[];
  extraAnchors: string[];
  wouldExceedLimit: boolean;
  notes: string[];
}

/** Optional overrides for preset apply — does not modify the saved preset */
export interface PresetApplyOverrides {
  strength?: number;
  direction?: string;
  frameCount?: number;
  phaseOffset?: number;
}

/** Result from applying a preset */
export interface PresetApplyResult {
  createdAnchors: string[];
  updatedAnchors: string[];
  skipped: string[];
  warnings: string[];
  appliedSettings?: PresetMotionSettings | null;
}

/** Per-frame result within a batch apply */
export interface BatchFrameResult {
  frameIndex: number;
  frameId: string;
  created: number;
  updated: number;
  skipped: number;
  warnings: string[];
}

/** Result from batch-applying a preset across frames */
export interface BatchApplyResult {
  totalFrames: number;
  appliedFrames: number;
  skippedFrames: number;
  perFrame: BatchFrameResult[];
  summary: string[];
  appliedSettings?: PresetMotionSettings | null;
}

/** Per-anchor diff in a preview */
export interface PresetAnchorDiff {
  name: string;
  action: 'create' | 'update' | 'skip';
  changes: string[];
}

/** Non-mutating preview of what applying a preset would do */
export interface PresetPreviewResult {
  presetName: string;
  presetKind: MotionPresetKind;
  anchorDiffs: PresetAnchorDiff[];
  effectiveSettings: PresetMotionSettings;
  warnings: string[];
  scopeFrames: number;
}
