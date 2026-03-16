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
import { sessionId, frameIndexCompat } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult, resolveFrameIndex } from './shared.js';
import {
  storeAddFrame,
  storeRemoveFrame,
  storeSetActiveFrame,
  storeSetFrameDuration,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

export function registerFrameTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_frame_add',
    'Add a new blank frame after the active frame.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeAddFrame(req.store);
      if (err) return jsonResult(fail(ErrorCode.NO_DOCUMENT, err));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ document: summary }));
    },
  );

  server.tool(
    'sprite_frame_remove',
    'Remove a frame by ID. Cannot remove the last frame.',
    {
      sessionId,
      frameId: z.string().describe('The frame ID to remove'),
    },
    async ({ sessionId, frameId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeRemoveFrame(req.store, frameId);
      if (err) return jsonResult(fail(ErrorCode.CONSTRAINT_VIOLATION, err));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ document: summary }));
    },
  );

  server.tool(
    'sprite_frame_set_active',
    'Set the active frame by index.',
    {
      sessionId,
      frameIndex: z.number().int().min(0).optional().describe('Frame index to activate'),
      index: frameIndexCompat,
    },
    async ({ sessionId, frameIndex, index }) => {
      const resolved = resolveFrameIndex({ frameIndex, index });
      if (resolved === undefined) return jsonResult(fail(ErrorCode.INVALID_INPUT, 'frameIndex is required'));

      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetActiveFrame(req.store, resolved);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ activeFrameIndex: summary?.activeFrameIndex }));
    },
  );

  server.tool(
    'sprite_frame_set_duration',
    'Set a frame\'s duration in milliseconds.',
    {
      sessionId,
      frameId: z.string().describe('The frame ID'),
      durationMs: z.number().int().min(1).describe('Frame duration in milliseconds'),
    },
    async ({ sessionId, frameId, durationMs }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetFrameDuration(req.store, frameId, durationMs);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ frameId, durationMs }));
    },
  );
}
