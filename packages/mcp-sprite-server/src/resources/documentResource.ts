/**
 * MCP resources — expose authored document state as readable resources.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/sessionManager.js';
import { storeGetDocumentSummary } from '../adapters/storeAdapter.js';

export function registerResources(server: McpServer, sessions: SessionManager): void {
  // Resource template: per-session document summary
  server.resource(
    'sprite-document',
    'sprite://session/{sessionId}/document',
    { description: 'Current sprite document summary for a session' },
    async (uri) => {
      // Extract sessionId from URI: sprite://session/{sessionId}/document
      const match = uri.href.match(/^sprite:\/\/session\/([^/]+)\/document$/);
      const sessionId = match?.[1];

      if (!sessionId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Invalid resource URI' }) }] };
      }

      const store = sessions.getStore(sessionId);
      if (!store) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }] };
      }

      const summary = storeGetDocumentSummary(store);
      if (!summary) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'No document open' }) }] };
      }

      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify(summary, null, 2),
        }],
      };
    },
  );
}
