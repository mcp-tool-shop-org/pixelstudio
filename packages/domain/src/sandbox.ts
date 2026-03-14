/** Sandbox session source — where the frames came from */
export type SandboxSource = 'timeline_span' | 'motion_proposal';

/** Sandbox playback settings */
export interface SandboxPlaybackSettings {
  fps: number;
  looping: boolean;
}

/** Sandbox session info returned from backend */
export interface SandboxSessionInfo {
  sessionId: string;
  source: SandboxSource;
  startFrameIndex: number;
  endFrameIndex: number;
  frameCount: number;
  /** RGBA preview data per frame (composited, full-size) */
  previewFrames: number[][];
  previewWidth: number;
  previewHeight: number;
}

// ── Analysis types ────────────────────────────────────────────────

export interface BBoxInfo {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  centerX: number;
  centerY: number;
  width: number;
  height: number;
}

export interface LoopDiagnostics {
  firstLastDelta: number;
  /** "good" | "moderate_mismatch" | "large_mismatch" | "not_applicable" */
  label: string;
  hint: string;
}

export interface DriftDiagnostics {
  driftX: number;
  driftY: number;
  driftMagnitude: number;
  maxDisplacement: number;
  /** "none" | "mild" | "notable" | "strong" */
  label: string;
  hint: string;
}

export interface TimingDiagnostics {
  identicalAdjacentCount: number;
  largestAdjacentDelta: number;
  avgAdjacentDelta: number;
  hint: string;
}

export type DiagnosticSeverity = 'info' | 'warning' | 'strong_warning';

export interface DiagnosticIssue {
  severity: DiagnosticSeverity;
  label: string;
  explanation: string;
}

export interface SandboxMetricsSummary {
  sessionId: string;
  frameCount: number;
  previewWidth: number;
  previewHeight: number;
  bboxes: (BBoxInfo | null)[];
  adjacentDeltas: number[];
  loopDiagnostics: LoopDiagnostics;
  driftDiagnostics: DriftDiagnostics;
  timingDiagnostics: TimingDiagnostics;
  issues: DiagnosticIssue[];
}

// ── Anchor path visualization types ───────────────────────────────

export interface AnchorPointSample {
  frameIndex: number;
  x: number;
  y: number;
  present: boolean;
}

export type ContactLabel = 'stable_contact' | 'likely_sliding' | 'possible_contact';

export interface ContactHint {
  frameIndex: number;
  label: ContactLabel;
  confidence: number;
}

export interface AnchorPathInfo {
  anchorName: string;
  anchorKind: string;
  samples: AnchorPointSample[];
  contactHints: ContactHint[];
  totalDistance: number;
  maxDisplacement: number;
}

export interface SandboxAnchorPathsResult {
  sessionId: string;
  paths: AnchorPathInfo[];
}

// ── Apply action types ────────────────────────────────────────────

export interface SandboxTimingApplyResult {
  sessionId: string;
  framesAffected: number;
  durationMs: number | null;
}

export interface SandboxDuplicateSpanResult {
  sessionId: string;
  newFrameIds: string[];
  insertPosition: number;
  firstNewFrameId: string;
}
