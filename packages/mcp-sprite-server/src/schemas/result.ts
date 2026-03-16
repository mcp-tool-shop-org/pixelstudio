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

/** Standard error codes used across tools. */
export const ErrorCode = {
  NO_SESSION: 'no_session',
  NO_DOCUMENT: 'no_document',
  NO_FRAME: 'no_frame',
  INVALID_INPUT: 'invalid_input',
  NOT_FOUND: 'not_found',
  SERIALIZE_ERROR: 'serialize_error',
  CONSTRAINT_VIOLATION: 'constraint_violation',
} as const;
