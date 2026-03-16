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

function requireSession(sessions: SessionManager, sessionId: string) {
  const store = sessions.getStore(sessionId);
  if (!store) return { error: fail(ErrorCode.NO_SESSION, `Session not found: ${sessionId}`) };
  return { store };
}

export function registerPlaybackTools(server: McpServer, sessions: SessionManager): void {
  // ── Authored config ──

  server.tool(
    'sprite_playback_get_config',
    'Get authored playback configuration (looping, per-frame durations).',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const config = storeGetPlaybackConfig(req.store);
      if ('error' in config) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, config.error)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ config })) }] };
    },
  );

  server.tool(
    'sprite_playback_set_config',
    'Set authored playback configuration. Only provided fields are updated.',
    {
      sessionId: z.string().describe('The session ID'),
      isLooping: z.boolean().optional().describe('Whether playback loops'),
    },
    async ({ sessionId, isLooping }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storeSetPlaybackConfig(req.store, { isLooping });
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, err)) }] };

      const config = storeGetPlaybackConfig(req.store);
      if ('error' in config) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.NO_DOCUMENT, config.error)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ config })) }] };
    },
  );

  // ── Transient preview ──

  server.tool(
    'sprite_preview_play',
    'Start animation preview playback. Transient state only — does not modify document.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storePreviewPlay(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail('playback_preview_unavailable', err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ preview: storeGetPreviewState(req.store) })) }] };
    },
  );

  server.tool(
    'sprite_preview_stop',
    'Stop animation preview playback. Transient state only — does not modify document.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      storePreviewStop(req.store);
      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ preview: storeGetPreviewState(req.store) })) }] };
    },
  );

  server.tool(
    'sprite_preview_get_state',
    'Get the current transient preview state (playing, frame index).',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ preview: storeGetPreviewState(req.store) })) }] };
    },
  );

  server.tool(
    'sprite_preview_set_frame',
    'Scrub the preview to a specific frame index. Only works when not playing.',
    {
      sessionId: z.string().describe('The session ID'),
      index: z.number().int().min(0).describe('Frame index to jump to'),
    },
    async ({ sessionId, index }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storePreviewSetFrame(req.store, index);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ preview: storeGetPreviewState(req.store) })) }] };
    },
  );

  server.tool(
    'sprite_preview_step_next',
    'Step the preview forward by one frame. Only works when not playing.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storePreviewStepNext(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ preview: storeGetPreviewState(req.store) })) }] };
    },
  );

  server.tool(
    'sprite_preview_step_prev',
    'Step the preview backward by one frame. Only works when not playing.',
    { sessionId: z.string().describe('The session ID') },
    async ({ sessionId }) => {
      const req = requireSession(sessions, sessionId);
      if ('error' in req) return { content: [{ type: 'text' as const, text: JSON.stringify(req.error) }] };

      const err = storePreviewStepPrev(req.store);
      if (err) return { content: [{ type: 'text' as const, text: JSON.stringify(fail(ErrorCode.INVALID_INPUT, err)) }] };

      return { content: [{ type: 'text' as const, text: JSON.stringify(success({ preview: storeGetPreviewState(req.store) })) }] };
    },
  );
}
