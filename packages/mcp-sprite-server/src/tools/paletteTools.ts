/**
 * MCP tools for palette management.
 *
 * Tools: sprite_palette_set_foreground, sprite_palette_set_background, sprite_palette_swap,
 *        sprite_palette_list
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeSetForegroundColor,
  storeSetBackgroundColor,
  storeSwapColors,
} from '../adapters/storeAdapter.js';

export function registerPaletteTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_palette_set_foreground',
    'Set the foreground color by palette index.',
    {
      sessionId,
      index: z.number().int().min(0).describe('Palette color index'),
    },
    async ({ sessionId, index }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetForegroundColor(req.store, index);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ foregroundIndex: index }));
    },
  );

  server.tool(
    'sprite_palette_set_background',
    'Set the background color by palette index.',
    {
      sessionId,
      index: z.number().int().min(0).describe('Palette color index'),
    },
    async ({ sessionId, index }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetBackgroundColor(req.store, index);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ backgroundIndex: index }));
    },
  );

  server.tool(
    'sprite_palette_swap',
    'Swap foreground and background colors.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSwapColors(req.store);
      if (err) return jsonResult(fail(ErrorCode.NO_DOCUMENT, err));

      const state = req.store.getState();
      const doc = state.document;
      return jsonResult(success({
        foregroundIndex: doc?.palette.foregroundIndex,
        backgroundIndex: doc?.palette.backgroundIndex,
      }));
    },
  );

  server.tool(
    'sprite_palette_list',
    'List all colors in the current palette.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const state = req.store.getState();
      if (!state.document) return jsonResult(fail(ErrorCode.NO_DOCUMENT, 'No document open'));

      const { palette } = state.document;
      const colors = palette.colors.map((c, i) => ({
        index: i,
        rgba: c.rgba,
        name: c.name ?? null,
      }));

      return jsonResult(success({
        colors,
        foregroundIndex: palette.foregroundIndex,
        backgroundIndex: palette.backgroundIndex,
      }));
    },
  );
}
