/**
 * MCP tools for selection and clipboard operations.
 *
 * Tools: sprite_selection_set_rect, sprite_selection_clear, sprite_selection_get,
 *        sprite_selection_copy, sprite_selection_cut, sprite_selection_paste,
 *        sprite_selection_flip_horizontal, sprite_selection_flip_vertical,
 *        sprite_selection_commit
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import {
  storeSetSelection,
  storeClearSelection,
  storeGetSelection,
  storeCopySelection,
  storeCutSelection,
  storePasteSelection,
  storeFlipSelectionHorizontal,
  storeFlipSelectionVertical,
  storeCommitSelection,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerSelectionTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_selection_set_rect',
    'Set a rectangular selection on the active layer. Extracts the pixels within the rect.',
    {
      sessionId: z.string().describe('The session ID'),
      x: z.number().int().describe('Selection X'),
      y: z.number().int().describe('Selection Y'),
      width: z.number().int().min(1).describe('Selection width'),
      height: z.number().int().min(1).describe('Selection height'),
    },
    async ({ sessionId, x, y, width, height }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetSelection(req.store, { x, y, width, height });
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('selection_missing', err)) }] };

      const sel = storeGetSelection(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ selection: sel })) }] };
    },
  );

  server.tool(
    'sprite_selection_clear',
    'Clear the current selection without modifying pixels.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      storeClearSelection(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ cleared: true })) }] };
    },
  );

  server.tool(
    'sprite_selection_get',
    'Get the current selection rect and dimensions, or null if none.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const sel = storeGetSelection(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ selection: sel })) }] };
    },
  );

  server.tool(
    'sprite_selection_copy',
    'Copy the current selection to the clipboard. Does not modify pixels.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeCopySelection(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('selection_missing', err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ copied: true })) }] };
    },
  );

  server.tool(
    'sprite_selection_cut',
    'Cut the current selection: copy to clipboard and clear selected pixels.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeCutSelection(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('selection_missing', err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ cut: true, dirty: true })) }] };
    },
  );

  server.tool(
    'sprite_selection_paste',
    'Paste the clipboard as a new selection at (0,0).',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storePasteSelection(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('clipboard_empty', err)) }] };

      const sel = storeGetSelection(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ selection: sel })) }] };
    },
  );

  server.tool(
    'sprite_selection_flip_horizontal',
    'Flip the current selection buffer horizontally.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeFlipSelectionHorizontal(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('selection_missing', err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ flipped: 'horizontal' })) }] };
    },
  );

  server.tool(
    'sprite_selection_flip_vertical',
    'Flip the current selection buffer vertically.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeFlipSelectionVertical(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('selection_missing', err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ flipped: 'vertical' })) }] };
    },
  );

  server.tool(
    'sprite_selection_commit',
    'Commit the current selection (blit) onto the active layer and clear selection state.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeCommitSelection(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('selection_missing', err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ committed: true, dirty: true })) }] };
    },
  );
}
