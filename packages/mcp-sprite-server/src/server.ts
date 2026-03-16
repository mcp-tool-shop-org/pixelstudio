/**
 * MCP server factory — creates and configures the GlyphStudio MCP server.
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SessionManager } from './session/sessionManager.js';
import { registerSessionTools } from './tools/sessionTools.js';
import { registerDocumentTools } from './tools/documentTools.js';
import { registerFrameTools } from './tools/frameTools.js';
import { registerLayerTools } from './tools/layerTools.js';
import { registerPaletteTools } from './tools/paletteTools.js';
import { registerResources } from './resources/documentResource.js';

export interface GlyphStudioServerOptions {
  /** Custom session manager (for testing). If omitted, a new one is created. */
  sessions?: SessionManager;
}

export interface GlyphStudioServer {
  server: McpServer;
  sessions: SessionManager;
}

/**
 * Create and return a fully configured GlyphStudio MCP server.
 * Tools and resources are registered but the transport is not connected —
 * the caller decides how to wire it (stdio, SSE, etc.).
 */
export function createGlyphStudioServer(options?: GlyphStudioServerOptions): GlyphStudioServer {
  const sessions = options?.sessions ?? new SessionManager();

  const server = new McpServer({
    name: 'glyphstudio-sprite-server',
    version: '1.0.0',
  });

  // Register all tool groups
  registerSessionTools(server, sessions);
  registerDocumentTools(server, sessions);
  registerFrameTools(server, sessions);
  registerLayerTools(server, sessions);
  registerPaletteTools(server, sessions);

  // Register resources
  registerResources(server, sessions);

  return { server, sessions };
}
