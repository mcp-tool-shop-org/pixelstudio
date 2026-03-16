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
import {
  storeSetForegroundColor,
  storeSetBackgroundColor,
  storeSwapColors,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerPaletteTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_palette_set_foreground',
    'Set the foreground color by palette index.',
    {
      sessionId: z.string().describe('The session ID'),
      index: z.number().int().min(0).describe('Palette color index'),
    },
    async ({ sessionId, index }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetForegroundColor(req.store, index);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ foregroundIndex: index })) }] };
    },
  );

  server.tool(
    'sprite_palette_set_background',
    'Set the background color by palette index.',
    {
      sessionId: z.string().describe('The session ID'),
      index: z.number().int().min(0).describe('Palette color index'),
    },
    async ({ sessionId, index }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetBackgroundColor(req.store, index);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ backgroundIndex: index })) }] };
    },
  );

  server.tool(
    'sprite_palette_swap',
    'Swap foreground and background colors.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSwapColors(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, err)) }] };

      const state = req.store.getState();
      const doc = state.document;
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        foregroundIndex: doc?.palette.foregroundIndex,
        backgroundIndex: doc?.palette.backgroundIndex,
      })) }] };
    },
  );

  server.tool(
    'sprite_palette_list',
    'List all colors in the current palette.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const state = req.store.getState();
      if (!state.document) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, 'No document open')) }] };

      const { palette } = state.document;
      const colors = palette.colors.map((c, i) => ({
        index: i,
        rgba: c.rgba,
        name: c.name ?? null,
      }));

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({
        colors,
        foregroundIndex: palette.foregroundIndex,
        backgroundIndex: palette.backgroundIndex,
      })) }] };
    },
  );
}
