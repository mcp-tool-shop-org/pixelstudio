/**
 * Zod schemas for MCP tool input validation.
 */

import { z } from 'zod';

export const SessionIdSchema = z.object({
  sessionId: z.string().describe('The session ID to operate on'),
});

export const NewDocumentSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  name: z.string().min(1).describe('Document name'),
  width: z.number().int().min(1).max(1024).describe('Canvas width in pixels'),
  height: z.number().int().min(1).max(1024).describe('Canvas height in pixels'),
});

export const LoadDocumentSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  json: z.string().describe('The .glyph file JSON content'),
  filePath: z.string().describe('The file path for reference'),
});

export const DocumentSummarySchema = z.object({
  sessionId: z.string().describe('The session ID'),
});

export const AddFrameSchema = z.object({
  sessionId: z.string().describe('The session ID'),
});

export const RemoveFrameSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  frameId: z.string().describe('The frame ID to remove'),
});

export const SetActiveFrameSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  index: z.number().int().min(0).describe('Frame index to activate'),
});

export const SetFrameDurationSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  frameId: z.string().describe('The frame ID'),
  durationMs: z.number().int().min(1).describe('Frame duration in milliseconds'),
});

export const AddLayerSchema = z.object({
  sessionId: z.string().describe('The session ID'),
});

export const RemoveLayerSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  layerId: z.string().describe('The layer ID to remove'),
});

export const SetActiveLayerSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  layerId: z.string().describe('The layer ID to activate'),
});

export const ToggleLayerVisibilitySchema = z.object({
  sessionId: z.string().describe('The session ID'),
  layerId: z.string().describe('The layer ID'),
});

export const RenameLayerSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  layerId: z.string().describe('The layer ID'),
  name: z.string().min(1).describe('New layer name'),
});

export const SetForegroundColorSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  index: z.number().int().min(0).describe('Palette color index'),
});

export const SetBackgroundColorSchema = z.object({
  sessionId: z.string().describe('The session ID'),
  index: z.number().int().min(0).describe('Palette color index'),
});

export const SwapColorsSchema = z.object({
  sessionId: z.string().describe('The session ID'),
});
