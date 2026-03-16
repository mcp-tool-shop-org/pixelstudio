/**
 * MCP tools for tool settings, onion skin, and view controls.
 *
 * Tools: sprite_tool_set, sprite_tool_get, sprite_tool_set_brush_size,
 *        sprite_tool_set_brush_shape, sprite_tool_set_pixel_perfect,
 *        sprite_onion_set, sprite_onion_get,
 *        sprite_canvas_set_zoom, sprite_canvas_set_pan, sprite_canvas_reset_view
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeSetTool,
  storeGetTool,
  storeSetBrushSize,
  storeSetBrushShape,
  storeSetPixelPerfect,
  storeSetOnionSkin,
  storeGetOnionSkin,
  storeSetZoom,
  storeSetPan,
  storeResetView,
} from '../adapters/storeAdapter.js';

export function registerToolSettingsTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_tool_set',
    'Switch the active editing tool.',
    {
      sessionId,
      tool: z.enum(['pencil', 'eraser', 'fill', 'eyedropper', 'select']).describe('Tool to activate'),
    },
    async ({ sessionId, tool }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetTool(req.store, tool);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ tool: storeGetTool(req.store) }));
    },
  );

  server.tool(
    'sprite_tool_get',
    'Get the current tool configuration.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      return jsonResult(success({ tool: storeGetTool(req.store) }));
    },
  );

  server.tool(
    'sprite_tool_set_brush_size',
    'Set the brush size (minimum 1).',
    {
      sessionId,
      size: z.number().int().min(1).describe('Brush size in pixels'),
    },
    async ({ sessionId, size }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetBrushSize(req.store, size);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ brushSize: size }));
    },
  );

  server.tool(
    'sprite_tool_set_brush_shape',
    'Set the brush shape (square or circle).',
    {
      sessionId,
      shape: z.enum(['square', 'circle']).describe('Brush shape'),
    },
    async ({ sessionId, shape }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetBrushShape(req.store, shape);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ brushShape: shape }));
    },
  );

  server.tool(
    'sprite_tool_set_pixel_perfect',
    'Toggle pixel-perfect mode for 1px strokes.',
    {
      sessionId,
      enabled: z.boolean().describe('Enable pixel-perfect mode'),
    },
    async ({ sessionId, enabled }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storeSetPixelPerfect(req.store, enabled);
      return jsonResult(success({ pixelPerfect: enabled }));
    },
  );

  server.tool(
    'sprite_onion_set',
    'Update onion skin settings.',
    {
      sessionId,
      enabled: z.boolean().optional().describe('Enable onion skin'),
      framesBefore: z.number().int().min(0).optional().describe('Frames to show before'),
      framesAfter: z.number().int().min(0).optional().describe('Frames to show after'),
      opacity: z.number().min(0).max(1).optional().describe('Onion skin opacity'),
    },
    async ({ sessionId, ...config }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storeSetOnionSkin(req.store, config);
      return jsonResult(success({ onionSkin: storeGetOnionSkin(req.store) }));
    },
  );

  server.tool(
    'sprite_onion_get',
    'Get the current onion skin configuration.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      return jsonResult(success({ onionSkin: storeGetOnionSkin(req.store) }));
    },
  );

  server.tool(
    'sprite_canvas_set_zoom',
    'Set the canvas zoom level (1–64). View-only, does not mutate document.',
    {
      sessionId,
      zoom: z.number().int().min(1).max(64).describe('Zoom level'),
    },
    async ({ sessionId, zoom }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetZoom(req.store, zoom);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ zoom }));
    },
  );

  server.tool(
    'sprite_canvas_set_pan',
    'Set the canvas pan offset. View-only, does not mutate document.',
    {
      sessionId,
      x: z.number().describe('Pan X offset'),
      y: z.number().describe('Pan Y offset'),
    },
    async ({ sessionId, x, y }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storeSetPan(req.store, x, y);
      return jsonResult(success({ panX: x, panY: y }));
    },
  );

  server.tool(
    'sprite_canvas_reset_view',
    'Reset zoom to 8x and pan to (0,0). View-only, does not mutate document.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storeResetView(req.store);
      return jsonResult(success({ zoom: 8, panX: 0, panY: 0 }));
    },
  );
}
