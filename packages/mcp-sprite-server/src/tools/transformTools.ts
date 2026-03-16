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
import { sessionId } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
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

export function registerTransformTools(server: McpServer, sessions: SessionManager): void {
  // ── Canvas transforms ──

  server.tool(
    'sprite_flip_canvas',
    'Flip the entire canvas (all frames, all layers) horizontally or vertically. This is a real document mutation with undo support.',
    {
      sessionId,
      direction: z.enum(['horizontal', 'vertical']).describe('Flip direction'),
    },
    async ({ sessionId, direction }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeFlipCanvas(req.store, direction);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      const history = storeGetHistorySummary(req.store);
      return jsonResult(success({ direction, ...summary!, history: { ...history } }));
    },
  );

  server.tool(
    'sprite_rotate_canvas',
    'Rotate the entire canvas (all frames, all layers) clockwise by 90, 180, or 270 degrees. 90/270 swap width and height.',
    {
      sessionId,
      angle: z.union([z.literal(90), z.literal(180), z.literal(270)]).describe('Rotation angle clockwise'),
    },
    async ({ sessionId, angle }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeRotateCanvas(req.store, angle);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      const history = storeGetHistorySummary(req.store);
      return jsonResult(success({ angle, ...summary!, history: { ...history } }));
    },
  );

  server.tool(
    'sprite_resize_canvas',
    'Resize the canvas (all frames, all layers). Top-left anchored: shrinking crops from bottom-right, growing extends with transparent pixels.',
    {
      sessionId,
      width: z.number().int().min(1).max(1024).describe('New width in pixels'),
      height: z.number().int().min(1).max(1024).describe('New height in pixels'),
    },
    async ({ sessionId, width, height }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeResizeCanvas(req.store, width, height);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      const history = storeGetHistorySummary(req.store);
      return jsonResult(success({ ...summary!, history: { ...history } }));
    },
  );

  // ── Frame primitives ──

  server.tool(
    'sprite_frame_duplicate',
    'Duplicate the active frame with all its layers and pixel data. The copy is inserted after the active frame.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeDuplicateFrame(req.store);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({
        frameCount: summary!.frameCount,
        activeFrameIndex: summary!.activeFrameIndex,
        activeLayerId: summary!.activeLayerId,
      }));
    },
  );

  server.tool(
    'sprite_frame_move',
    'Move a frame from one position to another in the animation sequence.',
    {
      sessionId,
      fromIndex: z.number().int().describe('Current frame index'),
      toIndex: z.number().int().describe('Target frame index'),
    },
    async ({ sessionId, fromIndex, toIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeMoveFrame(req.store, fromIndex, toIndex);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({
        frameCount: summary!.frameCount,
        activeFrameIndex: summary!.activeFrameIndex,
      }));
    },
  );

  // ── Layer primitives ──

  server.tool(
    'sprite_layer_duplicate',
    'Duplicate the active layer (copies pixel data). The new layer is added on top of the stack.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeDuplicateLayer(req.store);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      const activeFrame = summary!.frames[summary!.activeFrameIndex];
      return jsonResult(success({
        layerCount: activeFrame?.layerCount ?? 0,
        activeLayerId: summary!.activeLayerId,
      }));
    },
  );

  server.tool(
    'sprite_layer_move',
    'Move a layer from one position to another in the stack order (0 = bottom).',
    {
      sessionId,
      fromIndex: z.number().int().describe('Current layer index'),
      toIndex: z.number().int().describe('Target layer index'),
    },
    async ({ sessionId, fromIndex, toIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const error = storeMoveLayer(req.store, fromIndex, toIndex);
      if (error) return jsonResult(fail(ErrorCode.INVALID_INPUT, error));

      const summary = storeGetDocumentSummary(req.store);
      const activeFrame = summary!.frames[summary!.activeFrameIndex];
      return jsonResult(success({
        layerCount: activeFrame?.layerCount ?? 0,
        activeLayerId: summary!.activeLayerId,
      }));
    },
  );
}
