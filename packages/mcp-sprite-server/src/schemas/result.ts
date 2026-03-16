/**
 * Standard MCP tool result shapes.
 *
 * Every tool returns { ok: true, ...data } or { ok: false, code, message }.
 * This keeps results machine-parseable and consistent.
 */

export type ToolResult<T = Record<string, unknown>> =
  | ({ ok: true } & T)
  | { ok: false; code: string; message: string };

export function success<T extends Record<string, unknown>>(data: T): ToolResult<T> {
  return { ok: true, ...data };
}

export function fail(code: string, message: string): ToolResult<never> {
  return { ok: false, code, message };
}

/**
 * Standard error codes used across tools.
 *
 * All tool errors must use a code from this enum.
 * Codes are grouped by domain for discoverability.
 */
export const ErrorCode = {
  // ── Session / document lifecycle ──
  NO_SESSION: 'no_session',
  NO_DOCUMENT: 'no_document',
  NO_FRAME: 'no_frame',
  SERIALIZE_ERROR: 'serialize_error',

  // ── Input validation ──
  INVALID_INPUT: 'invalid_input',
  INVALID_COORDINATES: 'invalid_coordinates',
  CONSTRAINT_VIOLATION: 'constraint_violation',

  // ── Domain-specific ──
  NOT_FOUND: 'not_found',
  SELECTION_REQUIRED: 'selection_required',
  CLIPBOARD_EMPTY: 'clipboard_empty',
  BATCH_FAILED: 'batch_failed',
  PLAYBACK_UNAVAILABLE: 'playback_unavailable',

  // ── Schema / protocol ──
  VALIDATION_ERROR: 'validation_error',
} as const;
