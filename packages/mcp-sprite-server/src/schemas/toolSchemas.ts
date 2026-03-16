/**
 * Zod schemas for MCP tool input validation.
 *
 * This is the single source of truth for reusable schema fragments.
 * Tool files import from here instead of defining inline duplicates.
 */

import { z } from 'zod';

// ── Reusable fragments ──

/** Session ID — required by every tool except session_new and session_list. */
export const sessionId = z.string().describe('The session ID');

/**
 * RGBA color tuple [r, g, b, a] with each component 0-255.
 * Used by drawing tools, batch operations, and palette tools.
 */
export const RgbaSchema = z.tuple([
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
  z.number().int().min(0).max(255),
]);

/**
 * Canonical frame index parameter.
 * Optional — defaults to active frame when omitted.
 */
export const frameIndexOptional = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('Frame index (defaults to active frame)');

/**
 * Required frame index parameter.
 */
export const frameIndexRequired = z
  .number()
  .int()
  .min(0)
  .describe('Frame index');

/**
 * Compatibility alias for `frameIndex` — accepted but not published.
 * Used in tools that historically accepted `index` for frame selection.
 */
export const frameIndexCompat = z
  .number()
  .int()
  .min(0)
  .optional()
  .describe('(Deprecated) Alias for frameIndex — use frameIndex instead');

// ── Composite schemas (used directly by tool registrations) ──

export const SessionIdSchema = z.object({
  sessionId: sessionId.describe('The session ID to operate on'),
});

export const NewDocumentSchema = z.object({
  sessionId,
  name: z.string().min(1).describe('Document name'),
  width: z.number().int().min(1).max(1024).describe('Canvas width in pixels'),
  height: z.number().int().min(1).max(1024).describe('Canvas height in pixels'),
});

export const LoadDocumentSchema = z.object({
  sessionId,
  json: z.string().describe('The .glyph file JSON content'),
  filePath: z.string().describe('The file path for reference'),
});

export const DocumentSummarySchema = z.object({ sessionId });

export const AddFrameSchema = z.object({ sessionId });

export const RemoveFrameSchema = z.object({
  sessionId,
  frameId: z.string().describe('The frame ID to remove'),
});

export const SetActiveFrameSchema = z.object({
  sessionId,
  frameIndex: frameIndexRequired.describe('Frame index to activate'),
  index: frameIndexCompat,
});

export const SetFrameDurationSchema = z.object({
  sessionId,
  frameId: z.string().describe('The frame ID'),
  durationMs: z.number().int().min(1).describe('Frame duration in milliseconds'),
});

export const AddLayerSchema = z.object({ sessionId });

export const RemoveLayerSchema = z.object({
  sessionId,
  layerId: z.string().describe('The layer ID to remove'),
});

export const SetActiveLayerSchema = z.object({
  sessionId,
  layerId: z.string().describe('The layer ID to activate'),
});

export const ToggleLayerVisibilitySchema = z.object({
  sessionId,
  layerId: z.string().describe('The layer ID'),
});

export const RenameLayerSchema = z.object({
  sessionId,
  layerId: z.string().describe('The layer ID'),
  name: z.string().min(1).describe('New layer name'),
});

export const SetForegroundColorSchema = z.object({
  sessionId,
  index: z.number().int().min(0).describe('Palette color index'),
});

export const SetBackgroundColorSchema = z.object({
  sessionId,
  index: z.number().int().min(0).describe('Palette color index'),
});

export const SwapColorsSchema = z.object({ sessionId });
