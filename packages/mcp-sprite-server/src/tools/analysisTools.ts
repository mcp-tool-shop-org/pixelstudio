/**
 * MCP tools for sprite analysis — bounds, colors, frame comparison.
 *
 * Tools: sprite_analyze_bounds, sprite_analyze_colors, sprite_compare_frames
 */

import { z } from 'zod';
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId, frameIndexOptional, frameIndexRequired } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeAnalyzeBounds,
  storeAnalyzeColors,
  storeCompareFrames,
} from '../adapters/storeAdapter.js';

export function registerAnalysisTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_analyze_bounds',
    'Find the bounding box of non-transparent pixels in a frame. Returns minX, minY, maxX, maxY, opaque pixel count, and whether the frame is empty.',
    {
      sessionId,
      frameIndex: frameIndexOptional,
    },
    async ({ sessionId, frameIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeAnalyzeBounds(req.store, frameIndex);
      if (typeof result === 'string') return jsonResult(fail(ErrorCode.INVALID_INPUT, result));
      return jsonResult(success({ ...result }));
    },
  );

  server.tool(
    'sprite_analyze_colors',
    'Count unique colors and produce a frequency histogram for a frame. Returns unique color count, histogram sorted by frequency, and opaque/transparent pixel counts.',
    {
      sessionId,
      frameIndex: frameIndexOptional,
    },
    async ({ sessionId, frameIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeAnalyzeColors(req.store, frameIndex);
      if (typeof result === 'string') return jsonResult(fail(ErrorCode.INVALID_INPUT, result));
      return jsonResult(success({ ...result }));
    },
  );

  server.tool(
    'sprite_compare_frames',
    'Compare two frames pixel-by-pixel. Returns changed pixel count, changed bounds, and percentage of pixels that differ.',
    {
      sessionId,
      frameA: frameIndexRequired.describe('First frame index'),
      frameB: frameIndexRequired.describe('Second frame index'),
    },
    async ({ sessionId, frameA, frameB }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeCompareFrames(req.store, frameA, frameB);
      if (typeof result === 'string') return jsonResult(fail(ErrorCode.INVALID_INPUT, result));
      return jsonResult(success({ ...result }));
    },
  );
}
