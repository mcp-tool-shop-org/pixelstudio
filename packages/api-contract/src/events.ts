import type { AIJobType } from './commands';

/** Events emitted from backend to frontend */

export interface JobQueuedEvent {
  jobId: string;
  type: AIJobType;
}

export interface JobProgressEvent {
  jobId: string;
  progress: number;
  stage?: string;
}

export interface JobSucceededEvent {
  jobId: string;
  candidateIds: string[];
}

export interface JobFailedEvent {
  jobId: string;
  error: BackendErrorPayload;
}

export interface JobCancelledEvent {
  jobId: string;
}

export interface AutosaveUpdatedEvent {
  projectId: string;
  savedAt: string;
}

export interface RecoveryAvailableEvent {
  projectId: string;
  recoveryBranchId: string;
}

export interface BackendErrorPayload {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  retryable?: boolean;
}

/** Event name constants */
export const EVENTS = {
  JOB_QUEUED: 'job:queued',
  JOB_PROGRESS: 'job:progress',
  JOB_SUCCEEDED: 'job:succeeded',
  JOB_FAILED: 'job:failed',
  JOB_CANCELLED: 'job:cancelled',
  AUTOSAVE_UPDATED: 'project:autosave_updated',
  RECOVERY_AVAILABLE: 'project:recovery_available',
  SAVE_FAILED: 'project:save_failed',
  EXPORT_STARTED: 'export:started',
  EXPORT_PROGRESS: 'export:progress',
  EXPORT_SUCCEEDED: 'export:succeeded',
  EXPORT_FAILED: 'export:failed',
} as const;
