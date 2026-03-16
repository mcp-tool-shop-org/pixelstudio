/**
 * MCP resource — compact session state snapshot.
 *
 * sprite://session/{id}/state
 *
 * Provides a single-read summary of everything an agent needs to orient:
 * document, active frame/layer, tool, selection, playback, preview.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/sessionManager.js';
import { storeGetStateSummary } from '../adapters/storeAdapter.js';

export function registerStateResource(server: McpServer, sessions: SessionManager): void {
  server.resource(
    'sprite-state',
    'sprite://session/{sessionId}/state',
    { description: 'Compact session state: document, tool, selection, playback, preview' },
    async (uri) => {
      const match = uri.href.match(/^sprite:\/\/session\/([^/]+)\/state$/);
      const sessionId = match?.[1];

      if (!sessionId) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: 'Invalid resource URI' }) }] };
      }

      const store = sessions.getStore(sessionId);
      if (!store) {
        return { contents: [{ uri: uri.href, mimeType: 'application/json', text: JSON.stringify({ error: `Session not found: ${sessionId}` }) }] };
      }

      const summary = storeGetStateSummary(store);
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
