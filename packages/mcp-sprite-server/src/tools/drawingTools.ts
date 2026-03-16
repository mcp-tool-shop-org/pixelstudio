/**
 * MCP tools for drawing / raster operations.
 *
 * Tools: sprite_draw_pixels, sprite_draw_line, sprite_fill,
 *        sprite_erase_pixels, sprite_sample_pixel
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import {
  storeDrawPixels,
  storeDrawLine,
  storeFill,
  storeErasePixels,
  storeSamplePixel,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

const RgbaSchema = z.tuple([
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
]);

export function registerDrawingTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_draw_pixels',
    'Draw a batch of pixels on the active layer. Each pixel has x, y, and rgba.',
    {
      sessionId: z.string().describe('The session ID'),
      pixels: z.array(z.object({
        x: z.number().int().describe('X coordinate'),
        y: z.number().int().describe('Y coordinate'),
        rgba: RgbaSchema.describe('RGBA color [r,g,b,a] each 0-255'),
      })).min(1).describe('Pixels to draw'),
      layerId: z.string().optional().describe('Target layer ID (defaults to active layer)'),
    },
    async ({ sessionId, pixels, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeDrawPixels(req.store, pixels.map((p) => ({ x: p.x, y: p.y, rgba: p.rgba as [number, number, number, number] })), layerId);
      if ('error' in result) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('invalid_pixel_coordinates', result.error)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        bounds: result.bounds,
        activeFrameIndex: summary?.activeFrameIndex,
        activeLayerId: summary?.activeLayerId,
        dirty: summary?.dirty,
      })) }] };
    },
  );

  server.tool(
    'sprite_draw_line',
    'Draw a line between two points using Bresenham rasterization.',
    {
      sessionId: z.string().describe('The session ID'),
      x0: z.number().int().describe('Start X'),
      y0: z.number().int().describe('Start Y'),
      x1: z.number().int().describe('End X'),
      y1: z.number().int().describe('End Y'),
      rgba: RgbaSchema.describe('Line color [r,g,b,a]'),
      layerId: z.string().optional().describe('Target layer ID (defaults to active layer)'),
    },
    async ({ sessionId, x0, y0, x1, y1, rgba, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeDrawLine(req.store, x0, y0, x1, y1, rgba as [number, number, number, number], layerId);
      if ('error' in result) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('invalid_pixel_coordinates', result.error)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ bounds: result.bounds, dirty: true })) }] };
    },
  );

  server.tool(
    'sprite_fill',
    'Flood fill a contiguous region starting at (x, y) with the given color.',
    {
      sessionId: z.string().describe('The session ID'),
      x: z.number().int().describe('Start X'),
      y: z.number().int().describe('Start Y'),
      rgba: RgbaSchema.describe('Fill color [r,g,b,a]'),
      layerId: z.string().optional().describe('Target layer ID (defaults to active layer)'),
    },
    async ({ sessionId, x, y, rgba, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeFill(req.store, x, y, rgba as [number, number, number, number], layerId);
      if ('error' in result) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('invalid_pixel_coordinates', result.error)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ filled: true, dirty: true })) }] };
    },
  );

  server.tool(
    'sprite_erase_pixels',
    'Erase a batch of pixels (set to transparent) on the active layer.',
    {
      sessionId: z.string().describe('The session ID'),
      pixels: z.array(z.object({
        x: z.number().int().describe('X coordinate'),
        y: z.number().int().describe('Y coordinate'),
      })).min(1).describe('Pixels to erase'),
      layerId: z.string().optional().describe('Target layer ID (defaults to active layer)'),
    },
    async ({ sessionId, pixels, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeErasePixels(req.store, pixels, layerId);
      if ('error' in result) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('invalid_pixel_coordinates', result.error)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ bounds: result.bounds, dirty: true })) }] };
    },
  );

  server.tool(
    'sprite_sample_pixel',
    'Read the color of a pixel at (x, y) without modifying anything.',
    {
      sessionId: z.string().describe('The session ID'),
      x: z.number().int().describe('X coordinate'),
      y: z.number().int().describe('Y coordinate'),
      layerId: z.string().optional().describe('Target layer ID (defaults to active layer)'),
    },
    async ({ sessionId, x, y, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeSamplePixel(req.store, x, y, layerId);
      if ('error' in result) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('invalid_pixel_coordinates', result.error)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ rgba: result.rgba })) }] };
    },
  );
}
