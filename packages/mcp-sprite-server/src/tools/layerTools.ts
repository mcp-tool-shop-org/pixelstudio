/**
 * MCP tools for layer management.
 *
 * Tools: sprite_layer_add, sprite_layer_remove, sprite_layer_set_active,
 *        sprite_layer_toggle_visibility, sprite_layer_rename
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import {
  storeAddLayer,
  storeRemoveLayer,
  storeSetActiveLayer,
  storeToggleLayerVisibility,
  storeRenameLayer,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerLayerTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_layer_add',
    'Add a new blank layer to the active frame.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeAddLayer(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, err)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ document: summary })) }] };
    },
  );

  server.tool(
    'sprite_layer_remove',
    'Remove a layer by ID. Cannot remove the last layer.',
    {
      sessionId: z.string().describe('The session ID'),
      layerId: z.string().describe('The layer ID to remove'),
    },
    async ({ sessionId, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeRemoveLayer(req.store, layerId);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.CONSTRAINT_VIOLATION, err)) }] };

      const summary = storeGetDocumentSummary(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ document: summary })) }] };
    },
  );

  server.tool(
    'sprite_layer_set_active',
    'Set the active layer for editing.',
    {
      sessionId: z.string().describe('The session ID'),
      layerId: z.string().describe('The layer ID to activate'),
    },
    async ({ sessionId, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetActiveLayer(req.store, layerId);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NOT_FOUND, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ activeLayerId: layerId })) }] };
    },
  );

  server.tool(
    'sprite_layer_toggle_visibility',
    'Toggle a layer\'s visibility.',
    {
      sessionId: z.string().describe('The session ID'),
      layerId: z.string().describe('The layer ID'),
    },
    async ({ sessionId, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeToggleLayerVisibility(req.store, layerId);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NOT_FOUND, err)) }] };

      const summary = storeGetDocumentSummary(req.store);
      const frame = summary?.frames[summary.activeFrameIndex];
      const layer = frame?.layers.find((l) => l.id === layerId);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ layerId, visible: layer?.visible })) }] };
    },
  );

  server.tool(
    'sprite_layer_rename',
    'Rename a layer.',
    {
      sessionId: z.string().describe('The session ID'),
      layerId: z.string().describe('The layer ID'),
      name: z.string().min(1).describe('New layer name'),
    },
    async ({ sessionId, layerId, name }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeRenameLayer(req.store, layerId, name);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ layerId, name: name.trim() })) }] };
    },
  );
}
