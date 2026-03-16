/**
 * MCP tools for canvas transforms and missing frame/layer primitives.
 *
 * Tools: sprite_flip_canvas, sprite_rotate_canvas, sprite_resize_canvas,
 *        sprite_frame_duplicate, sprite_frame_move,
 *        sprite_layer_duplicate, sprite_layer_move
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import {
  storeFlipCanvas,
  storeRotateCanvas,
  storeResizeCanvas,
  storeDuplicateFrame,
  storeMoveFrame,
  storeDuplicateLayer,
  storeMoveLayer,
  storeGetDocumentSummary,
  storeGetHistorySummary,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerTransformTools(server: McpServer, sessions: SessionManager): void {
  // ── Canvas transforms ──

  server.tool(
    'sprite_flip_canvas',
    'Flip the entire canvas (all frames, all layers) horizontally or vertically. This is a real document mutation with undo support.',
    {
      sessionId: z.string().describe('The session ID'),
      direction: z.enum(['horizontal', 'vertical']).describe('Flip direction'),
    },
    async ({ sessionId, direction }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeFlipCanvas(req.store, direction);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      const history = storeGetHistorySummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ direction, ...summary!, history: { ...history } })) }] };
    },
  );

  server.tool(
    'sprite_rotate_canvas',
    'Rotate the entire canvas (all frames, all layers) clockwise by 90, 180, or 270 degrees. 90/270 swap width and height.',
    {
      sessionId: z.string().describe('The session ID'),
      angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).describe('Rotation angle clockwise'),
    },
    async ({ sessionId, angle }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeRotateCanvas(req.store, angle);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      const history = storeGetHistorySummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ angle, ...summary!, history: { ...history } })) }] };
    },
  );

  server.tool(
    'sprite_resize_canvas',
    'Resize the canvas (all frames, all layers). Top-left anchored: shrinking crops from bottom-right, growing extends with transparent pixels.',
    {
      sessionId: z.string().describe('The session ID'),
      width: z.number().int().min(1).max(1024).describe('New width in pixels'),
      height: z.number().int().min(1).max(1024).describe('New height in pixels'),
    },
    async ({ sessionId, width, height }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeResizeCanvas(req.store, width, height);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      const history = storeGetHistorySummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ ...summary!, history: { ...history } })) }] };
    },
  );

  // ── Frame primitives ──

  server.tool(
    'sprite_frame_duplicate',
    'Duplicate the active frame with all its layers and pixel data. The copy is inserted after the active frame.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeDuplicateFrame(req.store);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        frameCount: summary!.frameCount,
        activeFrameIndex: summary!.activeFrameIndex,
        activeLayerId: summary!.activeLayerId,
      })) }] };
    },
  );

  server.tool(
    'sprite_frame_move',
    'Move a frame from one position to another in the animation sequence.',
    {
      sessionId: z.string().describe('The session ID'),
      fromIndex: z.number().int().describe('Current frame index'),
      toIndex: z.number().int().describe('Target frame index'),
    },
    async ({ sessionId, fromIndex, toIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeMoveFrame(req.store, fromIndex, toIndex);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        frameCount: summary!.frameCount,
        activeFrameIndex: summary!.activeFrameIndex,
      })) }] };
    },
  );

  // ── Layer primitives ──

  server.tool(
    'sprite_layer_duplicate',
    'Duplicate the active layer (copies pixel data). The new layer is added on top of the stack.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeDuplicateLayer(req.store);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      const activeFrame = summary!.frames[summary!.activeFrameIndex];
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        layerCount: activeFrame?.layerCount ?? 0,
        activeLayerId: summary!.activeLayerId,
      })) }] };
    },
  );

  server.tool(
    'sprite_layer_move',
    'Move a layer from one position to another in the stack order (0 = bottom).',
    {
      sessionId: z.string().describe('The session ID'),
      fromIndex: z.number().int().describe('Current layer index'),
      toIndex: z.number().int().describe('Target layer index'),
    },
    async ({ sessionId, fromIndex, toIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const error = storeMoveLayer(req.store, fromIndex, toIndex);
      if (error) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      const activeFrame = summary!.frames[summary!.activeFrameIndex];
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        layerCount: activeFrame?.layerCount ?? 0,
        activeLayerId: summary!.activeLayerId,
      })) }] };
    },
  );
}
