import type { ColorMode, ImpactScope, MotionDirection, MotionFrameCount, MotionIntent, MotionTargetMode, ProvenanceRef, Rect, ValidationCategory } from '@glyphstudio/domain';

// ─── Project ───────────────────────────────────────────────────
export interface CreateProjectInput {
  name: string;
  filePath: string;
  canvasWidth: number;
  canvasHeight: number;
  colorMode: ColorMode;
  paletteId?: string | null;
  timelineEnabled: boolean;
  starterRigId?: string | null;
}

export interface ProjectSummary {
  projectId: string;
  name: string;
  filePath: string;
  canvasWidth: number;
  canvasHeight: number;
  colorMode: ColorMode;
  createdAt: string;
}

export interface RecentProjectItem {
  filePath: string;
  name: string;
  thumbnailPath?: string | null;
  lastModifiedAt: string;
}

// ─── AI ────────────────────────────────────────────────────────
export type AIJobType =
  | 'region-draft'
  | 'variant-proposal'
  | 'cleanup'
  | 'requantize'
  | 'silhouette-repair'
  | 'inbetween'
  | 'locomotion-draft'
  | 'workflow-run';

export interface AIContextTarget {
  layerIds?: string[];
  frameIds?: string[];
  region?: Rect | null;
  maskRefId?: string | null;
  tagId?: string | null;
}

export interface QueueAIJobInput {
  projectId: string;
  type: AIJobType;
  target: AIContextTarget;
  prompt?: string;
  negativePrompt?: string;
  stylePresetId?: string | null;
  paletteMode: 'free' | 'prefer-active' | 'strict-contract';
  contractId?: string | null;
  candidateCount: number;
  preserveSilhouette?: boolean;
  preserveSockets?: boolean;
  modelHints?: {
    ollamaModel?: string | null;
    comfyWorkflowId?: string | null;
  };
  reproducibility?: {
    seed?: number | null;
    sampler?: string | null;
    steps?: number | null;
  };
}

export interface AcceptAICandidateInput {
  projectId: string;
  candidateId: string;
  acceptMode: 'new-layer' | 'replace-draft-layer' | 'new-draft-track' | 'notes-only';
  targetLayerId?: string | null;
  targetFrameId?: string | null;
  targetDraftTrackId?: string | null;
}

export interface AcceptAICandidateOutput {
  impact: ImpactScope;
  provenance: ProvenanceRef;
  insertion: {
    layerIds?: string[];
    frameIds?: string[];
    draftTrackId?: string | null;
  };
}

// ─── Motion Assistance ────────────────────────────────────────
export interface BeginMotionSessionInput {
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
}

export interface MotionProposalResult {
  id: string;
  label: string;
  description: string;
  previewFrames: number[][];
  previewWidth: number;
  previewHeight: number;
}

export interface MotionSessionResult {
  sessionId: string;
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
  sourceFrameId: string;
  proposals: MotionProposalResult[];
  selectedProposalId: string | null;
  status: string;
}

export interface AcceptMotionProposalResult {
  insertedFrameIds: string[];
  activeFrameId: string;
  activeFrameIndex: number;
}

// ─── Locomotion ────────────────────────────────────────────────
export interface AnalyzeLocomotionInput {
  projectId: string;
  tagId?: string | null;
  frameIds?: string[];
  includeEquipmentLayers: boolean;
}

export interface PlanLocomotionInput {
  projectId: string;
  tagId?: string | null;
  movementType: 'walk' | 'run' | 'strafe' | 'idle-to-move' | 'heavy-carry' | 'ready-stance';
  targetFeel: 'light' | 'standard' | 'heavy' | 'stealth' | 'ceremonial';
  preserveCurrentKeyPoses: boolean;
  frameCountTarget?: number | null;
}

// ─── Validation ────────────────────────────────────────────────
export interface RunValidationInput {
  projectId: string;
  categories?: ValidationCategory[];
  full: boolean;
}

export interface ValidationIssue {
  id: string;
  category: ValidationCategory;
  severity: 'info' | 'warning' | 'error';
  ruleId: string;
  message: string;
  affectedLayerIds: string[];
  affectedFrameIds: string[];
  affectedRegion?: Rect | null;
  suggestedRepairIds: string[];
}

export interface ValidationReport {
  reportId: string;
  createdAt: string;
  summary: {
    infoCount: number;
    warningCount: number;
    errorCount: number;
    stale: boolean;
  };
  issues: ValidationIssue[];
}

// ─── Export ────────────────────────────────────────────────────
export interface PreviewExportInput {
  projectId: string;
  presetId: string;
  settings: Record<string, unknown>;
}

export interface QueueExportJobInput {
  projectId: string;
  presetId: string;
  settings: Record<string, unknown>;
  outputPath: string;
}
