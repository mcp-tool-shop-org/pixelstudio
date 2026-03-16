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
