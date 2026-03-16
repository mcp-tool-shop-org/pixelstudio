/**
 * MCP tools for render, import/export, and artifact pipeline.
 *
 * Tools: sprite_render_frame, sprite_render_sheet, sprite_render_overview,
 *        sprite_import_sheet, sprite_export_sheet_png, sprite_export_frame_png,
 *        sprite_export_gif, sprite_export_metadata_json
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { encode } from 'fast-png';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId, frameIndexOptional } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult } from './shared.js';
import {
  storeRenderFrame,
  storeRenderSheet,
  storeImportSheet,
  storeExportMetadataJson,
  storeExportGif,
  storeGetDocumentSummary,
} from '../adapters/storeAdapter.js';

/** Encode raw RGBA buffer to PNG bytes and return as base64 data URI. */
function rgbaToPngBase64(rgba: Uint8ClampedArray, width: number, height: number): string {
  const pngBytes = encode({ width, height, data: rgba, channels: 4, depth: 8 });
  const base64 = Buffer.from(pngBytes).toString('base64');
  return `data:image/png;base64,${base64}`;
}

export function registerRenderTools(server: McpServer, sessions: SessionManager): void {
  // ── Render ──

  server.tool(
    'sprite_render_frame',
    'Flatten a frame\'s visible layers into a single composited image. Returns PNG as base64 data URI.',
    {
      sessionId,
      frameIndex: frameIndexOptional,
    },
    async ({ sessionId, frameIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeRenderFrame(req.store, frameIndex);
      if ('error' in result) return jsonResult(fail(ErrorCode.NO_FRAME, result.error));

      const dataUri = rgbaToPngBase64(result.rgba, result.width, result.height);
      return { content: [
        { type: 'text' as const, text: JSON.stringify(success({
          frameIndex: result.frameIndex,
          frameId: result.frameId,
          width: result.width,
          height: result.height,
        })) },
        { type: 'image' as const, data: dataUri.split(',')[1], mimeType: 'image/png' },
      ] };
    },
  );

  server.tool(
    'sprite_render_sheet',
    'Assemble all frames into a horizontal sprite sheet. Returns PNG as base64 data URI.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeRenderSheet(req.store);
      if ('error' in result) return jsonResult(fail(ErrorCode.NO_DOCUMENT, result.error));

      const dataUri = rgbaToPngBase64(result.rgba, result.width, result.height);
      return { content: [
        { type: 'text' as const, text: JSON.stringify(success({
          width: result.width,
          height: result.height,
          frameCount: result.frameCount,
        })) },
        { type: 'image' as const, data: dataUri.split(',')[1], mimeType: 'image/png' },
      ] };
    },
  );

  server.tool(
    'sprite_render_overview',
    'Get a structured document overview with rendered thumbnails for each frame.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const summary = storeGetDocumentSummary(req.store);
      if (!summary) return jsonResult(fail(ErrorCode.NO_DOCUMENT, 'No document open'));

      const frameImages: { type: 'image'; data: string; mimeType: string }[] = [];
      for (let i = 0; i < summary.frameCount; i++) {
        const rendered = storeRenderFrame(req.store, i);
        if ('error' in rendered) continue;
        const base64 = rgbaToPngBase64(rendered.rgba, rendered.width, rendered.height).split(',')[1];
        frameImages.push({ type: 'image' as const, data: base64, mimeType: 'image/png' });
      }

      return { content: [
        { type: 'text' as const, text: JSON.stringify(success({
          document: summary,
          frameCount: summary.frameCount,
        })) },
        ...frameImages,
      ] };
    },
  );

  // ── Import ──

  server.tool(
    'sprite_import_sheet',
    'Import a horizontal sprite sheet PNG (base64) by slicing it into frames. Frame dimensions must match the document.',
    {
      sessionId,
      pngBase64: z.string().describe('PNG image as base64 string (no data URI prefix)'),
      frameWidth: z.number().int().min(1).describe('Width of each frame in the sheet'),
      frameHeight: z.number().int().min(1).describe('Height of each frame in the sheet'),
    },
    async ({ sessionId, pngBase64, frameWidth, frameHeight }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      let sheetWidth: number;
      let sheetHeight: number;
      let sheetData: Uint8ClampedArray;
      try {
        const { decode } = await import('fast-png');
        const buffer = Buffer.from(pngBase64, 'base64');
        const decoded = decode(buffer);
        sheetWidth = decoded.width;
        sheetHeight = decoded.height;
        sheetData = new Uint8ClampedArray(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength);
      } catch {
        return jsonResult(fail(ErrorCode.INVALID_INPUT, 'Failed to decode PNG'));
      }
      const result = storeImportSheet(req.store, sheetData, sheetWidth, sheetHeight, frameWidth, frameHeight);
      if ('error' in result) return jsonResult(fail(ErrorCode.INVALID_INPUT, result.error));

      const summary = storeGetDocumentSummary(req.store);
      return jsonResult(success({
        frameCount: result.frameCount,
        sheetWidth,
        sheetHeight,
        frameWidth,
        frameHeight,
        document: summary,
      }));
    },
  );

  // ── Export ──

  server.tool(
    'sprite_export_frame_png',
    'Export a single frame as PNG (base64). Returns raw base64 string suitable for file writing.',
    {
      sessionId,
      frameIndex: frameIndexOptional,
    },
    async ({ sessionId, frameIndex }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeRenderFrame(req.store, frameIndex);
      if ('error' in result) return jsonResult(fail(ErrorCode.NO_FRAME, result.error));

      const pngBytes = encode({ width: result.width, height: result.height, data: result.rgba, channels: 4, depth: 8 });
      const base64 = Buffer.from(pngBytes).toString('base64');

      return jsonResult(success({
        frameIndex: result.frameIndex,
        frameId: result.frameId,
        width: result.width,
        height: result.height,
        pngBase64: base64,
        byteLength: pngBytes.length,
      }));
    },
  );

  server.tool(
    'sprite_export_sheet_png',
    'Export all frames as a horizontal sprite sheet PNG (base64).',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeRenderSheet(req.store);
      if ('error' in result) return jsonResult(fail(ErrorCode.NO_DOCUMENT, result.error));

      const pngBytes = encode({ width: result.width, height: result.height, data: result.rgba, channels: 4, depth: 8 });
      const base64 = Buffer.from(pngBytes).toString('base64');

      return jsonResult(success({
        width: result.width,
        height: result.height,
        frameCount: result.frameCount,
        pngBase64: base64,
        byteLength: pngBytes.length,
      }));
    },
  );

  server.tool(
    'sprite_export_gif',
    'Export the animation as an animated GIF (base64).',
    {
      sessionId,
      loop: z.boolean().optional().describe('Loop the GIF (default: true)'),
    },
    async ({ sessionId, loop }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeExportGif(req.store, loop ?? true);
      if (result && typeof result === 'object' && 'error' in result) {
        return jsonResult(fail(ErrorCode.NO_DOCUMENT, (result as { error: string }).error));
      }

      const gifBytes = result as Uint8Array;
      const base64 = Buffer.from(gifBytes).toString('base64');

      return jsonResult(success({
        gifBase64: base64,
        byteLength: gifBytes.length,
      }));
    },
  );

  server.tool(
    'sprite_export_metadata_json',
    'Export sprite sheet metadata as JSON (frame positions, timing, layout for game engines).',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const result = storeExportMetadataJson(req.store);
      if ('error' in result) return jsonResult(fail(ErrorCode.NO_DOCUMENT, result.error));

      return jsonResult(success({ metadata: result.meta }));
    },
  );
}
