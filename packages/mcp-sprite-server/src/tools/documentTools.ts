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
import {
  storeNewDocument,
  storeCloseDocument,
  storeLoadDocument,
  storeSaveDocument,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerDocumentTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_document_new',
    'Create a new blank sprite document in a session.',
    {
      sessionId: z.string().describe('The session ID'),
      name: z.string().min(1).describe('Document name'),
      width: z.number().int().min(1).max(1024).describe('Canvas width in pixels'),
      height: z.number().int().min(1).max(1024).describe('Canvas height in pixels'),
    },
    async ({ sessionId, name, width, height }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      storeNewDocument(req.store, name, width, height);
      const summary = storeGetDocumentSummary(req.store);
      const result = success({ document: summary });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'sprite_document_open',
    'Open a .glyph file in a session from its JSON content.',
    {
      sessionId: z.string().describe('The session ID'),
      json: z.string().describe('The .glyph file JSON content'),
      filePath: z.string().describe('The file path for reference'),
    },
    async ({ sessionId, json, filePath }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeLoadDocument(req.store, json, filePath);
      if (err) {
        const result = fail(ErrorCode.INVALID_INPUT, err);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      }

      const summary = storeGetDocumentSummary(req.store);
      const result = success({ document: summary });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'sprite_document_save',
    'Serialize the current document as .glyph JSON. Returns the JSON string for the caller to persist.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const saveResult = storeSaveDocument(req.store);
      if ('error' in saveResult) {
        const result = fail(ErrorCode.SERIALIZE_ERROR, saveResult.error);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      }

      const result = success({ json: saveResult.json });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'sprite_document_close',
    'Close the current document in a session without destroying the session.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      storeCloseDocument(req.store);
      const result = success({ closed: true });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'sprite_document_summary',
    'Get a structured summary of the current document: dimensions, frames, layers, palette, dirty state.',
    {
      sessionId: z.string().describe('The session ID'),
    },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const summary = storeGetDocumentSummary(req.store);
      if (!summary) {
        const result = fail(ErrorCode.NO_DOCUMENT, 'No document open in this session');
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      }

      const result = success({ document: summary });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
