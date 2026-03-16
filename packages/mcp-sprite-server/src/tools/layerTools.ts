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
import { sessionId } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeAddLayer,
  storeRemoveLayer,
  storeSetActiveLayer,
  storeToggleLayerVisibility,
  storeRenameLayer,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

export function registerLayerTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_layer_add',
    'Add a new blank layer to the active frame.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeAddLayer(req.store);
      if (err) return jsonResult(fail(ErrorCode.NO_DOCUMENT, err));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ document: summary }));
    },
  );

  server.tool(
    'sprite_layer_remove',
    'Remove a layer by ID. Cannot remove the last layer.',
    {
      sessionId,
      layerId: z.string().describe('The layer ID to remove'),
    },
    async ({ sessionId, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeRemoveLayer(req.store, layerId);
      if (err) return jsonResult(fail(ErrorCode.CONSTRAINT_VIOLATION, err));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ document: summary }));
    },
  );

  server.tool(
    'sprite_layer_set_active',
    'Set the active layer for editing.',
    {
      sessionId,
      layerId: z.string().describe('The layer ID to activate'),
    },
    async ({ sessionId, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetActiveLayer(req.store, layerId);
      if (err) return jsonResult(fail(ErrorCode.NOT_FOUND, err));

      return jsonResult(success({ activeLayerId: layerId }));
    },
  );

  server.tool(
    'sprite_layer_toggle_visibility',
    'Toggle a layer\'s visibility.',
    {
      sessionId,
      layerId: z.string().describe('The layer ID'),
    },
    async ({ sessionId, layerId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeToggleLayerVisibility(req.store, layerId);
      if (err) return jsonResult(fail(ErrorCode.NOT_FOUND, err));

      const summary = storeGetDocumentSummary(req.store);
      const frame = summary?.frames[summary.activeFrameIndex];
      const layer = frame?.layers.find((l) => l.id === layerId);
      return jsonResult(success({ layerId, visible: layer?.visible }));
    },
  );

  server.tool(
    'sprite_layer_rename',
    'Rename a layer.',
    {
      sessionId,
      layerId: z.string().describe('The layer ID'),
      name: z.string().min(1).describe('New layer name'),
    },
    async ({ sessionId, layerId, name }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeRenameLayer(req.store, layerId, name);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ layerId, name: name.trim() }));
    },
  );
}
