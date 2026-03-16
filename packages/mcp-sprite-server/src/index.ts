/**
 * GlyphStudio MCP Server — programmable surface over the sprite editor.
 *
 * Exposes the full sprite editing API (session, document, frame, layer, palette)
 * as MCP tools, resources, and prompts. Calls real domain/state logic —
 * no reimplementation of raster ops or editor behavior.
 */

export { createGlyphStudioServer } from './server.js';
export { SessionManager } from './session/sessionManager.js';
export type { SessionInfo } from './session/sessionManager.js';
export type { DocumentSummary, SessionStateSummary, PlaybackConfig, PreviewState, ChangedBounds, PixelEntry, RenderedFrame, HistorySummary, BatchOperation, BatchResult } from './adapters/storeAdapter.js';
export { success, fail, ErrorCode } from './schemas/result.js';
export type { ToolResult } from './schemas/result.js';
