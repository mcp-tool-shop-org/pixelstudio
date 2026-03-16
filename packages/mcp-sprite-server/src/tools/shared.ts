/**
 * Shared helpers for MCP tool implementations.
 *
 * Centralizes session validation and result wrapping so tool files
 * stay focused on domain logic.
 */

import type { SessionManager } from '../session/sessionManager.js';
import { fail, ErrorCode } from '../schemas/result.js';
import type { ToolResult } from '../schemas/result.js';

type StoreType = NonNullable<ReturnType<SessionManager['getStore']>>;

interface SessionOk { store: StoreType }
interface SessionErr { error: ToolResult<never> }

/**
 * Validate that a session exists and return its store.
 * Returns `{ store }` on success or `{ error }` with a structured fail result.
 */
export function requireSession(sessions: SessionManager, sessionId: string): SessionOk | SessionErr {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) } as SessionErr;
  return { store } as SessionOk;
}

/**
 * Wrap a ToolResult as an MCP content response (single text block).
 */
export function jsonResult(result: ToolResult) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
}

/**
 * Resolve frameIndex from args that may contain either `frameIndex` (canonical)
 * or `index` (compatibility alias). Returns the resolved index or undefined.
 *
 * Canonical name: `frameIndex`
 * Compat alias: `index` (accepted but not published in schemas/catalog)
 */
export function resolveFrameIndex(args: { frameIndex?: number; index?: number }): number | undefined {
  return args.frameIndex ?? args.index;
}

/**
 * MCP tool call response shape from the SDK client.
 */
interface McpToolCallResponse {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
}

/**
 * Normalize a raw MCP tool call response into structured JSON.
 *
 * Guarantees the returned object always has `ok`, `code`, and `message`
 * when the call failed — even for SDK-level validation errors that
 * return plain text with `isError: true`.
 */
export function normalizeToolCallResult(response: McpToolCallResponse): Record<string, unknown> {
  const contentBlocks = response.content;
  const text = contentBlocks.find((c) => c.type === 'text')?.text ?? '{}';

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(text) as Record<string, unknown>;
  } catch {
    // Non-JSON text — wrap in structured error
    const code = response.isError && text.includes('validation error')
      ? ErrorCode.VALIDATION_ERROR
      : 'mcp_error';
    parsed = { ok: false, code, message: text };
  }

  // If the SDK flagged isError but the text was valid JSON without ok:false,
  // force it into a structured error shape
  if (response.isError && parsed.ok !== false) {
    parsed = { ok: false, code: ErrorCode.VALIDATION_ERROR, message: text };
  }

  // Attach image data if present
  const imageBlock = contentBlocks.find((c) => c.type === 'image');
  if (imageBlock?.data) {
    parsed._imageBase64 = imageBlock.data;
    parsed._imageMimeType = imageBlock.mimeType ?? 'image/png';
  }

  return parsed;
}
