/**
 * MCP tools for document lifecycle and inspection.
 *
 * Tools: sprite_document_new, sprite_document_open, sprite_document_save,
 *        sprite_document_close, sprite_document_summary
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeNewDocument,
  storeCloseDocument,
  storeLoadDocument,
  storeSaveDocument,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

export function registerDocumentTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_document_new',
    'Create a new blank sprite document in a session.',
    {
      sessionId,
      name: z.string().min(1).describe('Document name'),
      width: z.number().int().min(1).max(1024).describe('Canvas width in pixels'),
      height: z.number().int().min(1).max(1024).describe('Canvas height in pixels'),
    },
    async ({ sessionId, name, width, height }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storeNewDocument(req.store, name, width, height);
      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ document: summary }));
    },
  );

  server.tool(
    'sprite_document_open',
    'Open a .glyph file in a session from its JSON content.',
    {
      sessionId,
      json: z.string().describe('The .glyph file JSON content'),
      filePath: z.string().describe('The file path for reference'),
    },
    async ({ sessionId, json, filePath }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeLoadDocument(req.store, json, filePath);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({ document: summary }));
    },
  );

  server.tool(
    'sprite_document_save',
    'Serialize the current document as .glyph JSON. Returns the JSON string for the caller to persist.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const saveResult = storeSaveDocument(req.store);
      if ('error' in saveResult) return jsonResult(fail(ErrorCode.SERIALIZE_ERROR, saveResult.error));

      return jsonResult(success({ json: saveResult.json }));
    },
  );

  server.tool(
    'sprite_document_close',
    'Close the current document in a session without destroying the session.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storeCloseDocument(req.store);
      return jsonResult(success({ closed: true }));
    },
  );

  server.tool(
    'sprite_document_summary',
    'Get a structured summary of the current document: dimensions, frames, layers, palette, dirty state.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const summary = storeGetDocumentSummary(req.store);
      if (!summary) return jsonResult(fail(ErrorCode.NO_DOCUMENT, 'No document open in this session'));

      return jsonResult(success({ document: summary }));
    },
  );
}
