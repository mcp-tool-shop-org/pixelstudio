/**
 * MCP tools for session lifecycle management.
 *
 * Tools: sprite_session_new, sprite_session_list, sprite_session_close
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId } from '../schemas/toolSchemas.js';
import { jsonResult } from './shared.js';

export function registerSessionTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_session_new',
    'Create a new sprite editing session. Returns a session ID for use with other tools.',
    {},
    async () => {
      const id = sessions.create();
      return jsonResult(success({ sessionId: id }));
    },
  );

  server.tool(
    'sprite_session_list',
    'List all active sprite editing sessions.',
    {},
    async () => {
      const list = sessions.list();
      return jsonResult(success({ sessions: list, count: list.length }));
    },
  );

  server.tool(
    'sprite_session_close',
    'Close and destroy a sprite editing session. Unsaved changes are lost.',
    { sessionId: sessionId.describe('The session ID to close') },
    async ({ sessionId }) => {
      if (!sessions.has(sessionId)) {
        return jsonResult(fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`));
      }
      sessions.destroy(sessionId);
      return jsonResult(success({ closed: sessionId }));
    },
  );
}
