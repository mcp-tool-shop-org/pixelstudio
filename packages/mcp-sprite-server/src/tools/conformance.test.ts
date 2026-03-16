/**
 * MCP.6.4 — Protocol conformance tests.
 *
 * Exercises the server as a real MCP client would: creates sessions,
 * draws, undoes, exports, checks catalogs, and verifies that every
 * response conforms to the structured result contract.
 *
 * These tests prove the protocol is "boring to consume" — consistent
 * parameter names, consistent error shapes, machine-readable catalog,
 * and no plain-text surprises.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGlyphStudioServer } from '../server.js';
import { normalizeToolCallResult } from './shared.js';

describe('MCP.6.4 — Protocol conformance', () => {
  let client: Client;

  beforeEach(async () => {
    const { server } = createGlyphStudioServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);
    client = new Client({ name: 'test-conformance', version: '1.0.0' });
    await client.connect(clientTransport);
  });

  afterEach(async () => {
    await client.close();
  });

  function call(name: string, args: Record<string, unknown> = {}) {
    return client.callTool({ name, arguments: args });
  }

  function parse(result: unknown): Record<string, unknown> {
    const content = (result as { content: Array<{ type: string; text: string }> }).content;
    return JSON.parse(content[0].text);
  }

  // ── Contract: every successful result has ok:true ──

  it('full lifecycle: session → document → draw → undo → export', async () => {
    // 1. Create session
    const session = parse(await call('sprite_session_new'));
    expect(session.ok).toBe(true);
    const sid = session.sessionId as string;

    // 2. Create document
    const doc = parse(await call('sprite_document_new', {
      sessionId: sid, name: 'Conformance', width: 8, height: 8,
    }));
    expect(doc.ok).toBe(true);

    // 3. Draw pixels
    const draw = parse(await call('sprite_draw_pixels', {
      sessionId: sid,
      pixels: [
        { x: 0, y: 0, rgba: [255, 0, 0, 255] },
        { x: 1, y: 0, rgba: [0, 255, 0, 255] },
      ],
    }));
    expect(draw.ok).toBe(true);
    expect(draw.bounds).toBeDefined();

    // 4. Undo
    const undo = parse(await call('sprite_history_undo', { sessionId: sid }));
    expect(undo.ok).toBe(true);
    expect(undo.summary).toBeDefined();

    // 5. Redo
    const redo = parse(await call('sprite_history_redo', { sessionId: sid }));
    expect(redo.ok).toBe(true);

    // 6. Export PNG
    const png = parse(await call('sprite_export_frame_png', {
      sessionId: sid, frameIndex: 0,
    }));
    expect(png.ok).toBe(true);
    expect(png.pngBase64).toBeDefined();

    // 7. Document summary
    const summary = parse(await call('sprite_document_summary', { sessionId: sid }));
    expect(summary.ok).toBe(true);

    // 8. Close
    const close = parse(await call('sprite_session_close', { sessionId: sid }));
    expect(close.ok).toBe(true);
  });

  // ── Contract: every error has ok:false, code, message ──

  it('error responses always have ok:false, code, and message', async () => {
    const errorCases = [
      { name: 'sprite_document_summary', args: { sessionId: 'nonexistent' } },
      { name: 'sprite_draw_pixels', args: { sessionId: 'bad', pixels: [{ x: 0, y: 0, rgba: [0, 0, 0, 255] }] } },
      { name: 'sprite_frame_set_active', args: { sessionId: 'bad', frameIndex: 0 } },
      { name: 'sprite_layer_add', args: { sessionId: 'bad' } },
      { name: 'sprite_history_undo', args: { sessionId: 'bad' } },
      { name: 'sprite_palette_list', args: { sessionId: 'bad' } },
      { name: 'sprite_tool_get', args: { sessionId: 'bad' } },
    ];

    for (const { name, args } of errorCases) {
      const result = parse(await call(name, args));
      expect(result.ok, `${name} should have ok:false`).toBe(false);
      expect(typeof result.code, `${name} should have string code`).toBe('string');
      expect(typeof result.message, `${name} should have string message`).toBe('string');
      expect((result.code as string).length, `${name} code should be non-empty`).toBeGreaterThan(0);
      expect((result.message as string).length, `${name} message should be non-empty`).toBeGreaterThan(0);
    }
  });

  // ── Contract: Zod validation errors are structured after normalization ──

  it('validation errors normalize to structured JSON', async () => {
    const result = await call('sprite_draw_pixels', {});
    const normalized = normalizeToolCallResult(
      result as { content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>; isError?: boolean },
    );
    expect(normalized.ok).toBe(false);
    expect(typeof normalized.code).toBe('string');
    expect(typeof normalized.message).toBe('string');
  });

  // ── Contract: frameIndex canonical name works everywhere ──

  it('frameIndex is the canonical parameter name', async () => {
    const session = parse(await call('sprite_session_new'));
    const sid = session.sessionId as string;
    await call('sprite_document_new', { sessionId: sid, name: 'FI', width: 4, height: 4 });
    await call('sprite_frame_add', { sessionId: sid });

    // frameIndex works on frame_set_active
    const setActive = parse(await call('sprite_frame_set_active', {
      sessionId: sid, frameIndex: 1,
    }));
    expect(setActive.ok).toBe(true);
    expect(setActive.activeFrameIndex).toBe(1);

    // frameIndex works on render
    const render = await call('sprite_render_frame', { sessionId: sid, frameIndex: 0 });
    const renderContent = (render as { content: Array<{ type: string; text?: string }> }).content;
    const renderParsed = JSON.parse(renderContent[0].text!);
    expect(renderParsed.ok).toBe(true);

    // frameIndex works on export
    const exportPng = parse(await call('sprite_export_frame_png', {
      sessionId: sid, frameIndex: 0,
    }));
    expect(exportPng.ok).toBe(true);

    // frameIndex works on analysis
    const bounds = parse(await call('sprite_analyze_bounds', {
      sessionId: sid, frameIndex: 0,
    }));
    expect(bounds.ok).toBe(true);
  });

  // ── Contract: backward-compat index alias still works ──

  it('index compat alias still works for frame_set_active', async () => {
    const session = parse(await call('sprite_session_new'));
    const sid = session.sessionId as string;
    await call('sprite_document_new', { sessionId: sid, name: 'Compat', width: 4, height: 4 });
    await call('sprite_frame_add', { sessionId: sid });

    const result = parse(await call('sprite_frame_set_active', {
      sessionId: sid, index: 1,
    }));
    expect(result.ok).toBe(true);
    expect(result.activeFrameIndex).toBe(1);
  });

  // ── Contract: catalog tool exists and is self-referential ──

  it('catalog tool lists itself and has correct count', async () => {
    const catalog = parse(await call('sprite_tools_get_catalog'));
    expect(catalog.ok).toBe(true);

    const tools = catalog.tools as Array<{ name: string }>;
    const names = tools.map((t) => t.name);
    expect(names).toContain('sprite_tools_get_catalog');

    // Cross-check with SDK listTools
    const sdkList = await client.listTools();
    expect(catalog.toolCount).toBe(sdkList.tools.length);
  });

  // ── Contract: catalog resource matches tool ──

  it('catalog resource is consistent with catalog tool', async () => {
    const toolResult = parse(await call('sprite_tools_get_catalog'));
    const resourceResult = await client.readResource({ uri: 'sprite://schema/tools.json' });
    const resourceCatalog = JSON.parse(resourceResult.contents[0].text as string);

    expect(resourceCatalog.toolCount).toBe(toolResult.toolCount);
  });

  // ── Contract: batch operations return structured results ──

  it('batch apply returns structured result with operation details', async () => {
    const session = parse(await call('sprite_session_new'));
    const sid = session.sessionId as string;
    await call('sprite_document_new', { sessionId: sid, name: 'Batch', width: 8, height: 8 });

    const result = parse(await call('sprite_batch_apply', {
      sessionId: sid,
      operations: [
        { type: 'draw', pixels: [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }] },
        { type: 'draw_line', x0: 0, y0: 0, x1: 7, y1: 7, rgba: [0, 255, 0, 255] },
        { type: 'fill', x: 4, y: 0, rgba: [0, 0, 255, 255] },
      ],
    }));
    expect(result.ok).toBe(true);
    expect(result.operationsApplied).toBe(3);
    expect(result.history).toBeDefined();
  });

  // ── Contract: multi-session isolation ──

  it('sessions are isolated from each other', async () => {
    const s1 = parse(await call('sprite_session_new'));
    const s2 = parse(await call('sprite_session_new'));
    const sid1 = s1.sessionId as string;
    const sid2 = s2.sessionId as string;

    await call('sprite_document_new', { sessionId: sid1, name: 'S1', width: 4, height: 4 });

    // Session 2 has no document — summary should fail
    const summary2 = parse(await call('sprite_document_summary', { sessionId: sid2 }));
    expect(summary2.ok).toBe(false);
    expect(summary2.code).toBe('no_document');

    // Session 1 document is fine
    const summary1 = parse(await call('sprite_document_summary', { sessionId: sid1 }));
    expect(summary1.ok).toBe(true);
  });
});
