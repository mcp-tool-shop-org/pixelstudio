/** A named clip definition — a contiguous span of frames with export metadata */
export interface Clip {
  id: string;
  name: string;
  /** Start frame index (inclusive, 0-based) */
  startFrame: number;
  /** End frame index (inclusive, 0-based) */
  endFrame: number;
  /** Whether this clip should loop on playback/export */
  loopClip: boolean;
  /** Optional FPS override (null = use project FPS) */
  fpsOverride?: number | null;
  /** Optional tags for organization */
  tags: string[];
}

/** Clip validity tier */
export type ClipValidity = 'valid' | 'warning' | 'invalid';

/** Pivot preset mode */
export type PivotMode = 'center' | 'bottom_center' | 'custom';

/** Pivot point — pixel coordinates relative to frame top-left */
export interface PivotPoint {
  x: number;
  y: number;
}

/** Clip-level pivot/origin configuration */
export interface ClipPivot {
  mode: PivotMode;
  /** Pixel coordinates for custom mode */
  customPoint?: PivotPoint | null;
}

/** Response info for a clip */
export interface ClipInfo {
  id: string;
  name: string;
  startFrame: number;
  endFrame: number;
  frameCount: number;
  loopClip: boolean;
  fpsOverride: number | null;
  tags: string[];
  pivot: ClipPivot | null;
  warnings: string[];
  validity: ClipValidity;
}

/** Structured validation result for all clips */
export interface ClipValidationResult {
  totalClips: number;
  validCount: number;
  warningCount: number;
  invalidCount: number;
  clips: ClipInfo[];
}
