/**
 * MCP tools for session lifecycle management.
 *
 * Tools: sprite_session_new, sprite_session_list, sprite_session_close
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { SessionIdSchema } from '../schemas/toolSchemas.js';

export function registerSessionTools(server: McpServer, sessions: SessionManager): void {
  server.tool(
    'sprite_session_new',
    'Create a new sprite editing session. Returns a session ID for use with other tools.',
    {},
    async () => {
      const id = sessions.create();
      const result = success({ sessionId: id });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'sprite_session_list',
    'List all active sprite editing sessions.',
    {},
    async () => {
      const list = sessions.list();
      const result = success({ sessions: list, count: list.length });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );

  server.tool(
    'sprite_session_close',
    'Close and destroy a sprite editing session. Unsaved changes are lost.',
    { sessionId: z.string().describe('The session ID to close') },
    async ({ sessionId }) => {
      if (!sessions.has(sessionId)) {
        const result = fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`);
        return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
      }
      sessions.destroy(sessionId);
      const result = success({ closed: sessionId });
      return { content: [{ type: 'text' as const, text: JSON.stringify(result) }] };
    },
  );
}
