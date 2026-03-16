/**
 * Tests for MCP.6.1 — shared helpers, frameIndex normalization, and schema source of truth.
 *
 * Proves: requireSession centralization, resolveFrameIndex compat,
 * toolSchemas.ts is actually used, canonical frameIndex accepted everywhere.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGlyphStudioServer } from '../server.js';

describe('shared helpers and frameIndex normalization', () => {
  let client: Client;
  let sessionId: string;

  beforeEach(async () => {
    const { server } = createGlyphStudioServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-shared', version: '1.0.0' });
    await client.connect(clientTransport);

    // Create session + document
    const sessionResult = await client.callTool({ name: 'sprite_session_new', arguments: {} });
    const text = (sessionResult.content as Array<{ type: string; text: string }>)[0].text;
    sessionId = JSON.parse(text).sessionId;

    await client.callTool({
      name: 'sprite_document_new',
      arguments: { sessionId, name: 'Test', width: 8, height: 8 },
    });

    // Add a second frame so we can test frame switching
    await client.callTool({ name: 'sprite_frame_add', arguments: { sessionId } });
  });

  afterEach(async () => {
    await client.close();
  });

  function parseResult(result: unknown): Record<string, unknown> {
    const content = (result as { content: Array<{ type: string; text: string }> }).content;
    return JSON.parse(content[0].text);
  }

  // ── requireSession centralization ──

  it('requireSession returns structured error for invalid session', async () => {
    const result = await client.callTool({
      name: 'sprite_document_summary',
      arguments: { sessionId: 'nonexistent' },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('no_session');
    expect(parsed.message).toContain('nonexistent');
  });

  it('requireSession works across all tool groups', async () => {
    // Test a tool from each group with a bad session
    const tools = [
      { name: 'sprite_frame_add', arguments: { sessionId: 'bad' } },
      { name: 'sprite_layer_add', arguments: { sessionId: 'bad' } },
      { name: 'sprite_draw_pixels', arguments: { sessionId: 'bad', pixels: [{ x: 0, y: 0, rgba: [0, 0, 0, 255] }] } },
      { name: 'sprite_history_get_summary', arguments: { sessionId: 'bad' } },
      { name: 'sprite_tool_get', arguments: { sessionId: 'bad' } },
      { name: 'sprite_palette_list', arguments: { sessionId: 'bad' } },
    ];

    for (const tool of tools) {
      const result = await client.callTool(tool);
      const parsed = parseResult(result);
      expect(parsed.ok, `${tool.name} should fail with no_session`).toBe(false);
      expect(parsed.code, `${tool.name} error code`).toBe('no_session');
    }
  });

  // ── frameIndex canonical arg ──

  it('sprite_frame_set_active accepts canonical frameIndex', async () => {
    const result = await client.callTool({
      name: 'sprite_frame_set_active',
      arguments: { sessionId, frameIndex: 1 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.activeFrameIndex).toBe(1);
  });

  it('sprite_frame_set_active accepts compat alias index', async () => {
    const result = await client.callTool({
      name: 'sprite_frame_set_active',
      arguments: { sessionId, index: 1 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.activeFrameIndex).toBe(1);
  });

  it('sprite_frame_set_active prefers frameIndex over index', async () => {
    const result = await client.callTool({
      name: 'sprite_frame_set_active',
      arguments: { sessionId, frameIndex: 0, index: 1 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.activeFrameIndex).toBe(0); // frameIndex wins
  });

  it('sprite_frame_set_active fails when neither provided', async () => {
    const result = await client.callTool({
      name: 'sprite_frame_set_active',
      arguments: { sessionId },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(false);
    expect(parsed.code).toBe('invalid_input');
  });

  it('sprite_preview_set_frame accepts canonical frameIndex', async () => {
    const result = await client.callTool({
      name: 'sprite_preview_set_frame',
      arguments: { sessionId, frameIndex: 0 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  it('sprite_preview_set_frame accepts compat alias index', async () => {
    const result = await client.callTool({
      name: 'sprite_preview_set_frame',
      arguments: { sessionId, index: 0 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  // ── frameIndex already canonical in render/export/analysis ──

  it('sprite_render_frame accepts frameIndex', async () => {
    const result = await client.callTool({
      name: 'sprite_render_frame',
      arguments: { sessionId, frameIndex: 0 },
    });
    const content = (result as { content: Array<{ type: string }> }).content;
    // Should have text + image blocks
    expect(content.length).toBe(2);
    const parsed = JSON.parse((content[0] as { text: string }).text);
    expect(parsed.ok).toBe(true);
  });

  it('sprite_export_frame_png accepts frameIndex', async () => {
    const result = await client.callTool({
      name: 'sprite_export_frame_png',
      arguments: { sessionId, frameIndex: 0 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.pngBase64).toBeDefined();
  });

  it('sprite_analyze_bounds accepts frameIndex', async () => {
    const result = await client.callTool({
      name: 'sprite_analyze_bounds',
      arguments: { sessionId, frameIndex: 0 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  it('sprite_analyze_colors accepts frameIndex', async () => {
    const result = await client.callTool({
      name: 'sprite_analyze_colors',
      arguments: { sessionId, frameIndex: 0 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  // ── toolSchemas.ts is actually used ──

  it('RgbaSchema from toolSchemas is used in drawing tools', async () => {
    // If RgbaSchema wasn't imported correctly, this would fail with schema error
    const result = await client.callTool({
      name: 'sprite_draw_pixels',
      arguments: {
        sessionId,
        pixels: [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }],
      },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  it('RgbaSchema from toolSchemas is used in batch operations', async () => {
    const result = await client.callTool({
      name: 'sprite_batch_apply',
      arguments: {
        sessionId,
        operations: [
          { type: 'draw', pixels: [{ x: 0, y: 0, rgba: [0, 255, 0, 255] }] },
        ],
      },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
  });

  // ── dogfood workflows still work with compat ──

  it('walk cycle workflow pattern still works (index compat)', async () => {
    // This is the exact pattern from walkCycle.ts
    await client.callTool({
      name: 'sprite_frame_set_active',
      arguments: { sessionId, index: 0 },
    });
    await client.callTool({
      name: 'sprite_frame_duplicate',
      arguments: { sessionId },
    });
    // Switch to new frame using canonical name
    const result = await client.callTool({
      name: 'sprite_frame_set_active',
      arguments: { sessionId, frameIndex: 1 },
    });
    const parsed = parseResult(result);
    expect(parsed.ok).toBe(true);
    expect(parsed.activeFrameIndex).toBe(1);
  });
});
