/** Typed error codes from the backend */
export const ERROR_CODES = {
  PROJECT_NOT_FOUND: 'project/not_found',
  PROJECT_INVALID_FORMAT: 'project/invalid_format',
  PROJECT_SAVE_FAILED: 'project/save_failed',
  VALIDATION_UNSUPPORTED_SCOPE: 'validation/unsupported_scope',
  PALETTE_ILLEGAL_MAPPING: 'palette/illegal_mapping',
  TIMELINE_FRAME_NOT_FOUND: 'timeline/frame_not_found',
  LAYER_NOT_FOUND: 'layer/not_found',
  SOCKET_NOT_FOUND: 'socket/not_found',
  AI_SERVICE_UNAVAILABLE: 'ai/service_unavailable',
  AI_JOB_FAILED: 'ai/job_failed',
  AI_CANDIDATE_NOT_FOUND: 'ai/candidate_not_found',
  LOCOMOTION_ANALYSIS_FAILED: 'locomotion/analysis_failed',
  EXPORT_FAILED: 'export/failed',
  INTERNAL_UNEXPECTED: 'internal/unexpected',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
