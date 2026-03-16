/**
 * MCP tools for sprite analysis — bounds, colors, frame comparison.
 *
 * Tools: sprite_analyze_bounds, sprite_analyze_colors, sprite_compare_frames
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import {
  storeAnalyzeBounds,
  storeAnalyzeColors,
  storeCompareFrames,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerAnalysisTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_analyze_bounds',
    'Find the bounding box of non-transparent pixels in a frame. Returns minX, minY, maxX, maxY, opaque pixel count, and whether the frame is empty.',
    {
      sessionId: z.string().describe('The session ID'),
      frameIndex: z.number().int().optional().describe('Frame index (defaults to active frame)'),
    },
    async ({ sessionId, frameIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeAnalyzeBounds(req.store, frameIndex);
      if (typeof result === 'string') return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, result)) }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ ...result })) }] };
    },
  );

  server.tool(
    'sprite_analyze_colors',
    'Count unique colors and produce a frequency histogram for a frame. Returns unique color count, histogram sorted by frequency, and opaque/transparent pixel counts.',
    {
      sessionId: z.string().describe('The session ID'),
      frameIndex: z.number().int().optional().describe('Frame index (defaults to active frame)'),
    },
    async ({ sessionId, frameIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeAnalyzeColors(req.store, frameIndex);
      if (typeof result === 'string') return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, result)) }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ ...result })) }] };
    },
  );

  server.tool(
    'sprite_compare_frames',
    'Compare two frames pixel-by-pixel. Returns changed pixel count, changed bounds, and percentage of pixels that differ.',
    {
      sessionId: z.string().describe('The session ID'),
      frameA: z.number().int().describe('First frame index'),
      frameB: z.number().int().describe('Second frame index'),
    },
    async ({ sessionId, frameA, frameB }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const result = storeCompareFrames(req.store, frameA, frameB);
      if (typeof result === 'string') return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, result)) }] };
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ ...result })) }] };
    },
  );
}
