/**
 * MCP resources — rendered PNG artifacts and metadata.
 *
 * sprite://session/{id}/frame.png     — active frame as PNG
 * sprite://session/{id}/sheet.png     — full sprite sheet as PNG
 * sprite://session/{id}/metadata.json — sprite sheet metadata
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { encode } from 'fast-png';
import type { SessionManager } from '../session/sessionManager.js';
import { storeRenderFrame, storeRenderSheet, storeExportMetadataJson } from '../adapters/storeAdapter.js';

export function registerRenderResources(server: McpServer, sessions: SessionManager): void {
  server.resource(
    'sprite-frame-png',
    'sprite://session/{sessionId}/frame.png',
    { description: 'Active frame rendered as PNG (base64)' },
    async (uri) => {
      const match = uri.href.match(/^sprite:\/\/session\/([^/]+)\/frame\.png$/);
      const sessionId = match?.[1];

      if (!sessionId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Invalid resource URI' }) }] };
      }

      const store = sessions.getStore(sessionId);
      if (!store) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }] };
      }

      const result = storeRenderFrame(store);
      if ('error' in result) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: result.error }) }] };
      }

      const pngBytes = encode({ width: result.width, height: result.height, data: result.rgba, channels: 4, depth: 8 });
      const base64 = Buffer.from(pngBytes).toString('base64');

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'image/png',
          blob: base64,
        }],
      };
    },
  );

  server.resource(
    'sprite-sheet-png',
    'sprite://session/{sessionId}/sheet.png',
    { description: 'Full sprite sheet as PNG (base64)' },
    async (uri) => {
      const match = uri.href.match(/^sprite:\/\/session\/([^/]+)\/sheet\.png$/);
      const sessionId = match?.[1];

      if (!sessionId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Invalid resource URI' }) }] };
      }

      const store = sessions.getStore(sessionId);
      if (!store) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }] };
      }

      const result = storeRenderSheet(store);
      if ('error' in result) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: result.error }) }] };
      }

      const pngBytes = encode({ width: result.width, height: result.height, data: result.rgba, channels: 4, depth: 8 });
      const base64 = Buffer.from(pngBytes).toString('base64');

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'image/png',
          blob: base64,
        }],
      };
    },
  );

  server.resource(
    'sprite-metadata-json',
    'sprite://session/{sessionId}/metadata.json',
    { description: 'Sprite sheet metadata (frame positions, timing, layout)' },
    async (uri) => {
      const match = uri.href.match(/^sprite:\/\/session\/([^/]+)\/metadata\.json$/);
      const sessionId = match?.[1];

      if (!sessionId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Invalid resource URI' }) }] };
      }

      const store = sessions.getStore(sessionId);
      if (!store) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }] };
      }

      const result = storeExportMetadataJson(store);
      if ('error' in result) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: result.error }) }] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: result.json,
        }],
      };
    },
  );
}
