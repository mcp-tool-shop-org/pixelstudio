/** Motion intent — what kind of movement to generate */
export type MotionIntent =
  | 'idle_bob'
  | 'walk_cycle_stub'
  | 'run_cycle_stub'
  | 'hop';

/** Direction for motion generation */
export type MotionDirection = 'left' | 'right' | 'up' | 'down';

/** What the motion acts on */
export type MotionTargetMode = 'active_selection' | 'anchor_binding' | 'whole_frame';

/** Output frame count */
export type MotionFrameCount = 2 | 4;

/** Session status */
export type MotionSessionStatus =
  | 'idle'
  | 'configuring'
  | 'generating'
  | 'reviewing'
  | 'committing'
  | 'error';

/** A single generated motion proposal */
export interface MotionProposal {
  id: string;
  label: string;
  description: string;
  /** Preview frame RGBA data (flat arrays, one per generated frame) */
  previewFrames: number[][];
  previewWidth: number;
  previewHeight: number;
}

/** Motion template identifiers */
export type MotionTemplateId =
  | 'idle_breathing'
  | 'walk_basic'
  | 'run_basic'
  | 'hop_basic';

/** Template anchor requirement */
export interface MotionTemplateAnchorReq {
  kind: string;
  required: boolean;
  role: string;
}

/** Motion template definition */
export interface MotionTemplateInfo {
  id: MotionTemplateId;
  name: string;
  description: string;
  anchorRequirements: MotionTemplateAnchorReq[];
}

/** A motion session tracks one generation cycle */
export interface MotionSession {
  id: string;
  intent: MotionIntent;
  direction: MotionDirection | null;
  targetMode: MotionTargetMode;
  outputFrameCount: MotionFrameCount;
  sourceFrameId: string;
  proposals: MotionProposal[];
  selectedProposalId: string | null;
  status: MotionSessionStatus;
}
