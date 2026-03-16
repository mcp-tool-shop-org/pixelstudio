#!/usr/bin/env node

/**
 * CLI entry point — starts the GlyphStudio MCP server over stdio.
 */

import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createGlyphStudioServer } from './server.js';

async function main() {
  const { server } = createGlyphStudioServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  console.error('GlyphStudio MCP server failed to start:', err);
  process.exit(1);
});
