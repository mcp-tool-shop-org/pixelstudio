/**
 * MCP resource + tool — machine-readable tool catalog.
 *
 * Resource: sprite://schema/tools.json
 * Tool:     sprite_tools_get_catalog
 *
 * Both return the same catalog: the full list of registered tools
 * with names, descriptions, and input schemas. Built from the SDK's
 * internal tool registry at call time — always in sync.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { success } from '../schemas/result.js';
import { jsonResult } from '../tools/shared.js';

/** Shape of a single tool entry in the catalog. */
interface CatalogEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

/**
 * Extract the tool catalog from the McpServer's internal registry.
 *
 * Uses the private `_registeredTools` map — we own the upgrade path
 * and this avoids an in-process client roundtrip.
 */
function buildCatalog(server: McpServer): CatalogEntry[] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const registered = (server as any)._registeredTools as
    Record<string, { description: string; inputSchema?: Record<string, unknown>; enabled?: boolean }> | undefined;

  if (!registered) return [];

  return Object.entries(registered)
    .filter(([, def]) => def.enabled !== false)
    .map(([name, def]) => ({
      name,
      description: def.description ?? '',
      inputSchema: def.inputSchema ?? { type: 'object', properties: {} },
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function registerCatalogResource(server: McpServer): void {
  const CATALOG_URI = 'sprite://schema/tools.json';

  // ── Resource: sprite://schema/tools.json ──
  server.resource(
    'sprite-tool-catalog',
    CATALOG_URI,
    { description: 'Machine-readable catalog of all registered sprite tools with input schemas' },
    async (uri) => {
      const catalog = buildCatalog(server);
      return {
        contents: [{
          uri: uri.href,
          mimeType: 'application/json',
          text: JSON.stringify({ toolCount: catalog.length, tools: catalog }, null, 2),
        }],
      };
    },
  );

  // ── Tool: sprite_tools_get_catalog ──
  server.tool(
    'sprite_tools_get_catalog',
    'Get the machine-readable catalog of all available sprite tools with their input schemas.',
    {},
    async () => {
      const catalog = buildCatalog(server);
      return jsonResult(success({ toolCount: catalog.length, tools: catalog }));
    },
  );
}
