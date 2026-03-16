/**
 * MCP tools for playback — authored config and transient preview.
 *
 * Authored config tools: sprite_playback_get_config, sprite_playback_set_config
 * Transient preview tools: sprite_preview_play, sprite_preview_stop,
 *   sprite_preview_get_state, sprite_preview_set_frame,
 *   sprite_preview_step_next, sprite_preview_step_prev
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { SessionManager } from '../session/sessionManager.js';
import { success, fail, ErrorCode } from '../schemas/result.js';
import { sessionId, frameIndexCompat } from '../schemas/toolSchemas.js';
import { requireSession, jsonResult, resolveFrameIndex } from './shared.js';
import {
  storeGetPlaybackConfig,
  storeSetPlaybackConfig,
  storeGetPreviewState,
  storePreviewPlay,
  storePreviewStop,
  storePreviewSetFrame,
  storePreviewStepNext,
  storePreviewStepPrev,
} from '../adapters/storeAdapter.js';

export function registerPlaybackTools(server: McpServer, sessions: SessionManager): void {
  // ── Authored config ──

  server.tool(
    'sprite_playback_get_config',
    'Get authored playback configuration (looping, per-frame durations).',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const config = storeGetPlaybackConfig(req.store);
      if ('error' in config) return jsonResult(fail(ErrorCode.NO_DOCUMENT, config.error));

      return jsonResult(success({ config }));
    },
  );

  server.tool(
    'sprite_playback_set_config',
    'Set authored playback configuration. Only provided fields are updated.',
    {
      sessionId,
      isLooping: z.boolean().optional().describe('Whether playback loops'),
    },
    async ({ sessionId, isLooping }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storeSetPlaybackConfig(req.store, { isLooping });
      if (err) return jsonResult(fail(ErrorCode.NO_DOCUMENT, err));

      const config = storeGetPlaybackConfig(req.store);
      if ('error' in config) return jsonResult(fail(ErrorCode.NO_DOCUMENT, config.error));

      return jsonResult(success({ config }));
    },
  );

  // ── Transient preview ──

  server.tool(
    'sprite_preview_play',
    'Start animation preview playback. Transient state only — does not modify document.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storePreviewPlay(req.store);
      if (err) return jsonResult(fail(ErrorCode.PLAYBACK_UNAVAILABLE, err));

      return jsonResult(success({ preview: storeGetPreviewState(req.store) }));
    },
  );

  server.tool(
    'sprite_preview_stop',
    'Stop animation preview playback. Transient state only — does not modify document.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      storePreviewStop(req.store);
      return jsonResult(success({ preview: storeGetPreviewState(req.store) }));
    },
  );

  server.tool(
    'sprite_preview_get_state',
    'Get the current transient preview state (playing, frame index).',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      return jsonResult(success({ preview: storeGetPreviewState(req.store) }));
    },
  );

  server.tool(
    'sprite_preview_set_frame',
    'Scrub the preview to a specific frame index. Only works when not playing.',
    {
      sessionId,
      frameIndex: z.number().int().min(0).optional().describe('Frame index to jump to'),
      index: frameIndexCompat,
    },
    async ({ sessionId, frameIndex, index }) => {
      const resolved = resolveFrameIndex({ frameIndex, index });
      if (resolved === undefined) return jsonResult(fail(ErrorCode.INVALID_INPUT, 'frameIndex is required'));

      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storePreviewSetFrame(req.store, resolved);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ preview: storeGetPreviewState(req.store) }));
    },
  );

  server.tool(
    'sprite_preview_step_next',
    'Step the preview forward by one frame. Only works when not playing.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storePreviewStepNext(req.store);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ preview: storeGetPreviewState(req.store) }));
    },
  );

  server.tool(
    'sprite_preview_step_prev',
    'Step the preview backward by one frame. Only works when not playing.',
    { sessionId },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return jsonResult(req.error);

      const err = storePreviewStepPrev(req.store);
      if (err) return jsonResult(fail(ErrorCode.INVALID_INPUT, err));

      return jsonResult(success({ preview: storeGetPreviewState(req.store) }));
    },
  );
}
