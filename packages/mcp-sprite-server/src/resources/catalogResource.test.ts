/**
 * Tests for MCP.6.3 — Machine-readable tool catalog.
 *
 * Proves: sprite_tools_get_catalog tool returns all tools,
 * sprite://schema/tools.json resource works, catalog is sorted,
 * every tool has name + description + inputSchema, catalog
 * includes the catalog tool itself.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGlyphStudioServer } from '../server.js';

interface CatalogEntry {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

describe('MCP.6.3 — Tool catalog', () => {
  let client: Client;

  beforeEach(async () => {
    const { server } = createGlyphStudioServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-catalog', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  function parseResult(result: unknown): Record<string, unknown> {
    const content = (result as { content: Array<{ type: string; text: string }> }).content;
    return JSON.parse(content[0].text);
  }

  // ── sprite_tools_get_catalog tool ──

  it('returns structured ok:true with tools array', async () => {
    const result = await client.callTool({
      name: 'sprite_tools_get_catalog',
      arguments: {},
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(typeof parsed.toolCount).toBe('number');
    expect(parsed.toolCount).toBe((parsed.tools as CatalogEntry[]).length);
  });

  it('catalog includes all expected tool groups', async () => {
    const result = await client.callTool({
      name: 'sprite_tools_get_catalog',
      arguments: {},
    });
    const parsed = parseResult(result);
    const tools = parsed.tools as CatalogEntry[];
    const names = tools.map((t) => t.name);

    // Spot-check tools from each group
    expect(names).toContain('sprite_session_new');
    expect(names).toContain('sprite_document_new');
    expect(names).toContain('sprite_frame_add');
    expect(names).toContain('sprite_layer_add');
    expect(names).toContain('sprite_draw_pixels');
    expect(names).toContain('sprite_fill');
    expect(names).toContain('sprite_history_undo');
    expect(names).toContain('sprite_batch_apply');
    expect(names).toContain('sprite_render_frame');
    expect(names).toContain('sprite_analyze_bounds');
    expect(names).toContain('sprite_palette_list');
    expect(names).toContain('sprite_tool_get');
    expect(names).toContain('sprite_playback_get_config');
    expect(names).toContain('sprite_tools_get_catalog'); // includes itself
  });

  it('every tool entry has name, description, and inputSchema', async () => {
    const result = await client.callTool({
      name: 'sprite_tools_get_catalog',
      arguments: {},
    });
    const parsed = parseResult(result);
    const tools = parsed.tools as CatalogEntry[];

    for (const tool of tools) {
      expect(typeof tool.name, `${tool.name} should have string name`).toBe('string');
      expect(tool.name.length, `${tool.name} name should be non-empty`).toBeGreaterThan(0);
      expect(typeof tool.description, `${tool.name} should have string description`).toBe('string');
      expect(tool.description.length, `${tool.name} description should be non-empty`).toBeGreaterThan(0);
      expect(typeof tool.inputSchema, `${tool.name} should have object inputSchema`).toBe('object');
    }
  });

  it('catalog is sorted alphabetically by name', async () => {
    const result = await client.callTool({
      name: 'sprite_tools_get_catalog',
      arguments: {},
    });
    const parsed = parseResult(result);
    const tools = parsed.tools as CatalogEntry[];
    const names = tools.map((t) => t.name);
    const sorted = [...names].sort();
    expect(names).toEqual(sorted);
  });

  it('catalog tool count matches SDK listTools count', async () => {
    const catalogResult = await client.callTool({
      name: 'sprite_tools_get_catalog',
      arguments: {},
    });
    const catalog = parseResult(catalogResult);

    const sdkList = await client.listTools();
    expect(catalog.toolCount).toBe(sdkList.tools.length);
  });

  // ── sprite://schema/tools.json resource ──

  it('resource returns JSON with toolCount and tools array', async () => {
    const result = await client.readResource({ uri: 'sprite://schema/tools.json' });
    expect(result.contents.length).toBe(1);
    expect(result.contents[0].mimeType).toBe('application/json');

    const parsed = JSON.parse(result.contents[0].text as string);
    expect(typeof parsed.toolCount).toBe('number');
    expect(Array.isArray(parsed.tools)).toBe(true);
    expect(parsed.toolCount).toBe(parsed.tools.length);
  });

  it('resource catalog matches tool catalog', async () => {
    const toolResult = await client.callTool({
      name: 'sprite_tools_get_catalog',
      arguments: {},
    });
    const toolCatalog = parseResult(toolResult);

    const resourceResult = await client.readResource({ uri: 'sprite://schema/tools.json' });
    const resourceCatalog = JSON.parse(resourceResult.contents[0].text as string);

    expect(resourceCatalog.toolCount).toBe(toolCatalog.toolCount);
    expect(resourceCatalog.tools.length).toBe((toolCatalog.tools as CatalogEntry[]).length);

    // Same tool names in same order
    const toolNames = (toolCatalog.tools as CatalogEntry[]).map((t) => t.name);
    const resourceNames = resourceCatalog.tools.map((t: CatalogEntry) => t.name);
    expect(resourceNames).toEqual(toolNames);
  });
});
