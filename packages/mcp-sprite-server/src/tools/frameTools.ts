/**
 * MCP tools for frame management.
 *
 * Tools: sprite_frame_add, sprite_frame_remove, sprite_frame_set_active,
 *        sprite_frame_set_duration
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import {
  storeAddFrame,
  storeRemoveFrame,
  storeSetActiveFrame,
  storeSetFrameDuration,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerFrameTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_frame_add',
    'Add a new blank frame after the active frame.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeAddFrame(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, err)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ document: summary })) }] };
    },
  );

  server.tool(
    'sprite_frame_remove',
    'Remove a frame by ID. Cannot remove the last frame.',
    {
      sessionId: z.string().describe('The session ID'),
      frameId: z.string().describe('The frame ID to remove'),
    },
    async ({ sessionId, frameId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeRemoveFrame(req.store, frameId);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.CONSTRAINT_VIOLATION, err)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ document: summary })) }] };
    },
  );

  server.tool(
    'sprite_frame_set_active',
    'Set the active frame by index.',
    {
      sessionId: z.string().describe('The session ID'),
      index: z.number().int().min(0).describe('Frame index to activate'),
    },
    async ({ sessionId, index }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetActiveFrame(req.store, index);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ activeFrameIndex: summary?.activeFrameIndex })) }] };
    },
  );

  server.tool(
    'sprite_frame_set_duration',
    'Set a frame\'s duration in milliseconds.',
    {
      sessionId: z.string().describe('The session ID'),
      frameId: z.string().describe('The frame ID'),
      durationMs: z.number().int().min(1).describe('Frame duration in milliseconds'),
    },
    async ({ sessionId, frameId, durationMs }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetFrameDuration(req.store, frameId, durationMs);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ frameId, durationMs })) }] };
    },
  );
}
