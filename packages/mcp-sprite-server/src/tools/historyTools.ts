/**
 * MCP tools for sprite history — undo, redo, summary, and batch operations.
 *
 * Tools: sprite_history_get_summary, sprite_history_undo, sprite_history_redo, sprite_batch_apply
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail } from '../schemas/result.js';
import { sessionId, RgbaSchema } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeGetHistorySummary,
  storeUndo,
  storeRedo,
  storeBatchApply,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';
import type { BatchOperation } from '../adapters/storeAdapter.js';

export function registerHistoryTools(server: McpServer, sessions: SessionManager): void {
  // ── sprite_history_get_summary ──
  server.tool(
    'sprite_history_get_summary',
    'Get the current undo/redo history summary: stack sizes, can-undo/redo, latest operation.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const summary = storeGetHistorySummary(req.store);
      return jsonResult(success({ ...summary }));
    },
  );

  // ── sprite_history_undo ──
  server.tool(
    'sprite_history_undo',
    'Undo the last sprite editing operation. Returns whether the undo was applied and the updated history summary.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeUndo(req.store);
      return jsonResult(success({ ...result, summary: { ...result.summary } }));
    },
  );

  // ── sprite_history_redo ──
  server.tool(
    'sprite_history_redo',
    'Redo a previously undone sprite editing operation. Returns whether the redo was applied and the updated history summary.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeRedo(req.store);
      return jsonResult(success({ ...result, summary: { ...result.summary } }));
    },
  );

  // ── sprite_batch_apply ──
  server.tool(
    'sprite_batch_apply',
    'Apply multiple drawing operations as a single undo step. Supports draw, draw_line, fill, and erase. Stops on first error.',
    {
      sessionId,
      operations: z.array(z.discriminatedUnion('type', [
        z.object({
          type: z.literal('draw'),
          pixels: z.array(z.object({
            x: z.number().int(),
            y: z.number().int(),
            rgba: RgbaSchema,
          })).min(1),
          layerId: z.string().optional(),
        }),
        z.object({
          type: z.literal('draw_line'),
          x0: z.number().int(),
          y0: z.number().int(),
          x1: z.number().int(),
          y1: z.number().int(),
          rgba: RgbaSchema,
          layerId: z.string().optional(),
        }),
        z.object({
          type: z.literal('fill'),
          x: z.number().int(),
          y: z.number().int(),
          rgba: RgbaSchema,
          layerId: z.string().optional(),
        }),
        z.object({
          type: z.literal('erase'),
          pixels: z.array(z.object({
            x: z.number().int(),
            y: z.number().int(),
          })).min(1),
          layerId: z.string().optional(),
        }),
      ])).min(1).describe('Ordered list of drawing operations to apply atomically'),
    },
    async ({ sessionId, operations }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const batchOps: BatchOperation[] = operations.map((op) => {
        switch (op.type) {
          case 'draw':
            return { type: 'draw' as const, pixels: op.pixels.map((p) => ({ x: p.x, y: p.y, rgba: p.rgba as [number, number, number, number] })), layerId: op.layerId };
          case 'draw_line':
            return { type: 'draw_line' as const, x0: op.x0, y0: op.y0, x1: op.x1, y1: op.y1, rgba: op.rgba as [number, number, number, number], layerId: op.layerId };
          case 'fill':
            return { type: 'fill' as const, x: op.x, y: op.y, rgba: op.rgba as [number, number, number, number], layerId: op.layerId };
          case 'erase':
            return { type: 'erase' as const, pixels: op.pixels, layerId: op.layerId };
        }
      });

      const result = storeBatchApply(req.store, batchOps);

      if (!result.ok) {
        const lastResult = result.results[result.results.length - 1];
        return jsonResult(fail(
          'batch_failed',
          `Batch failed at operation ${lastResult.index}: ${lastResult.error}`,
        ));
      }

      const docSummary = storeGetDocumentSummary(req.store);
      return jsonResult(success({
        operationsApplied: result.operationsApplied,
        results: result.results,
        history: result.summary,
        activeFrameIndex: docSummary?.activeFrameIndex,
        activeLayerId: docSummary?.activeLayerId,
        dirty: docSummary?.dirty,
      }));
    },
  );
}
