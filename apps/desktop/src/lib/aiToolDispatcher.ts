/**
 * AI Tool Dispatcher — executes LLM tool calls against the live editor.
 *
 * Takes a tool call from Ollama's response, validates it, maps to the
 * correct Tauri command, and returns a structured result.
 * All operations go through the existing undo/redo stack.
 */

import { invoke } from '@tauri-apps/api/core';
import { findTool, TOOL_REGISTRY, type ToolDefinition } from './aiToolRegistry';
import {
  SPRITE_TEMPLATE_LIBRARY,
  findTemplate as findLibraryTemplate,
  listTemplatesByArchetype,
  searchTemplates as searchLibraryTemplates,
} from './spriteTemplateLibrary';
import { resolveTemplate } from './spriteTemplateRenderer';
import type { RGBA } from '@glyphstudio/domain';

export interface ToolCallRequest {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolCallResult {
  name: string;
  success: boolean;
  data: unknown;
  error: string | null;
  durationMs: number;
}

/**
 * Execute a single tool call against the live editor state.
 * Returns a structured result suitable for feeding back to the LLM.
 */
export async function executeToolCall(
  call: ToolCallRequest,
  context?: { frameIds?: string[] },
): Promise<ToolCallResult> {
  const start = Date.now();

  // Handle meta-tools
  if (call.name === 'apply_to_all_frames') {
    return executeApplyToAllFrames(call, context, start);
  }
  if (call.name === 'list_templates') {
    return executeListTemplates(call, start);
  }
  if (call.name === 'search_templates') {
    return executeSearchTemplates(call, start);
  }
  if (call.name === 'instantiate_template') {
    return executeInstantiateTemplate(call, start);
  }

  const tool = findTool(call.name);

  if (!tool) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: `Unknown tool: ${call.name}. Available tools: ${TOOL_REGISTRY.map((t) => t.name).join(', ')}`,
      durationMs: Date.now() - start,
    };
  }

  // Validate required parameters
  const validationError = validateArgs(tool, call.arguments);
  if (validationError) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: validationError,
      durationMs: Date.now() - start,
    };
  }

  try {
    const data = await invoke(tool.tauriCommand, call.arguments);
    return {
      name: call.name,
      success: true,
      data,
      error: null,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Handle the apply_to_all_frames meta-tool.
 * Parses the calls argument, gets frame IDs from context, and delegates to executeBatchAcrossFrames.
 */
async function executeApplyToAllFrames(
  call: ToolCallRequest,
  context: { frameIds?: string[] } | undefined,
  start: number,
): Promise<ToolCallResult> {
  const rawCalls = call.arguments.calls;
  if (!Array.isArray(rawCalls) || rawCalls.length === 0) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: 'apply_to_all_frames requires a non-empty "calls" array',
      durationMs: Date.now() - start,
    };
  }

  const frameIds = context?.frameIds;
  if (!frameIds || frameIds.length === 0) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: 'No frame IDs available. Cannot apply to frames without canvas context.',
      durationMs: Date.now() - start,
    };
  }

  // Validate each inner call
  const innerCalls: ToolCallRequest[] = [];
  for (const raw of rawCalls) {
    if (!raw || typeof raw.name !== 'string') {
      return {
        name: call.name,
        success: false,
        data: null,
        error: `Invalid inner call: each call must have a "name" string. Got: ${JSON.stringify(raw)}`,
        durationMs: Date.now() - start,
      };
    }
    innerCalls.push({ name: raw.name, arguments: raw.arguments ?? {} });
  }

  try {
    const batchResults = await executeBatchAcrossFrames(frameIds, innerCalls, {
      continueOnError: true,
    });

    const totalOps = batchResults.reduce((sum, fr) => sum + fr.results.length, 0);
    const failedFrames = batchResults.filter((fr) => !fr.success).length;
    const summary = failedFrames === 0
      ? `Applied ${innerCalls.length} operation(s) to ${frameIds.length} frames (${totalOps} total ops)`
      : `Applied to ${frameIds.length} frames, ${failedFrames} frame(s) had errors`;

    return {
      name: call.name,
      success: failedFrames === 0,
      data: { batchResults, totalOps, failedFrames },
      error: failedFrames > 0 ? summary : null,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Handle list_templates meta-tool.
 */
function executeListTemplates(call: ToolCallRequest, start: number): ToolCallResult {
  const archetype = call.arguments.archetype as string | undefined;
  const templates = archetype
    ? listTemplatesByArchetype(archetype)
    : [...SPRITE_TEMPLATE_LIBRARY];

  return {
    name: call.name,
    success: true,
    data: templates.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      archetype: t.archetype,
      suggestedWidth: t.suggestedWidth,
      suggestedHeight: t.suggestedHeight,
      colorSlots: t.colorSlots.map((s) => s.name),
      tags: t.tags,
    })),
    error: null,
    durationMs: Date.now() - start,
  };
}

/**
 * Handle search_templates meta-tool.
 */
function executeSearchTemplates(call: ToolCallRequest, start: number): ToolCallResult {
  const query = call.arguments.query as string;
  if (!query) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: 'search_templates requires a "query" string',
      durationMs: Date.now() - start,
    };
  }

  const results = searchLibraryTemplates(query);
  return {
    name: call.name,
    success: true,
    data: results.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      archetype: t.archetype,
      tags: t.tags,
    })),
    error: null,
    durationMs: Date.now() - start,
  };
}

/**
 * Handle instantiate_template meta-tool.
 * Resolves template + params, then invokes the Rust render_template command.
 */
async function executeInstantiateTemplate(
  call: ToolCallRequest,
  start: number,
): Promise<ToolCallResult> {
  const templateId = call.arguments.templateId as string;
  if (!templateId) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: 'instantiate_template requires a "templateId" string',
      durationMs: Date.now() - start,
    };
  }

  const template = findLibraryTemplate(templateId);
  if (!template) {
    const available = SPRITE_TEMPLATE_LIBRARY.map((t) => t.id).join(', ');
    return {
      name: call.name,
      success: false,
      data: null,
      error: `Template not found: "${templateId}". Available: ${available}`,
      durationMs: Date.now() - start,
    };
  }

  // Parse color overrides from arguments
  const rawColors = (call.arguments.colors ?? {}) as Record<string, unknown>;
  const colors: Record<string, RGBA> = {};
  for (const [slot, val] of Object.entries(rawColors)) {
    if (Array.isArray(val) && val.length === 4) {
      colors[slot] = val as RGBA;
    }
  }

  const scale = typeof call.arguments.scale === 'number' ? call.arguments.scale : 1.0;

  const params = { templateId, colors, scale };
  const { regions, connections } = resolveTemplate(template, params);

  try {
    const result = await invoke<{
      regionCount: number;
      connectionCount: number;
      pixelCount: number;
    }>('render_template', {
      input: {
        regions,
        connections,
        layerId: null,
      },
    });

    return {
      name: call.name,
      success: true,
      data: {
        templateId,
        templateName: template.name,
        regionCount: result.regionCount,
        connectionCount: result.connectionCount,
        pixelCount: result.pixelCount,
        canvasWidth: Math.round(template.suggestedWidth * scale),
        canvasHeight: Math.round(template.suggestedHeight * scale),
      },
      error: null,
      durationMs: Date.now() - start,
    };
  } catch (err: unknown) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - start,
    };
  }
}

/**
 * Execute a batch of tool calls sequentially.
 * Stops on first failure unless continueOnError is true.
 */
export async function executeBatch(
  calls: ToolCallRequest[],
  options: { continueOnError?: boolean; onResult?: (result: ToolCallResult) => void } = {},
): Promise<ToolCallResult[]> {
  const results: ToolCallResult[] = [];
  for (const call of calls) {
    const result = await executeToolCall(call);
    results.push(result);
    options.onResult?.(result);
    if (!result.success && !options.continueOnError) break;
  }
  return results;
}

/**
 * Parse tool calls from an Ollama response message.
 * Handles both the tool_calls array format and inline JSON.
 */
export function parseToolCalls(message: {
  tool_calls?: Array<{ function: { name: string; arguments: Record<string, unknown> } }>;
  content?: string;
}): ToolCallRequest[] {
  // Standard Ollama tool_calls format
  if (message.tool_calls && message.tool_calls.length > 0) {
    return message.tool_calls.map((tc) => ({
      name: tc.function.name,
      arguments: tc.function.arguments ?? {},
    }));
  }

  // Fallback: try to extract JSON tool calls from content
  if (message.content) {
    try {
      const parsed = JSON.parse(message.content);
      if (Array.isArray(parsed)) {
        return parsed
          .filter((item) => item.name && typeof item.name === 'string')
          .map((item) => ({
            name: item.name,
            arguments: item.arguments ?? {},
          }));
      }
      if (parsed.name && typeof parsed.name === 'string') {
        return [{ name: parsed.name, arguments: parsed.arguments ?? {} }];
      }
    } catch {
      // Not JSON — no tool calls
    }
  }

  return [];
}

/**
 * Execute tool calls across multiple frames.
 * Switches to each frame, runs the calls, then returns to the original frame.
 *
 * @param frameIds - Array of frame UUIDs to iterate over
 * @param calls - Tool calls to execute on each frame
 * @param onFrameResult - Optional callback after each frame completes
 * @returns Results grouped by frame
 */
export interface FrameBatchResult {
  frameId: string;
  frameIndex: number;
  results: ToolCallResult[];
  success: boolean;
}

export async function executeBatchAcrossFrames(
  frameIds: string[],
  calls: ToolCallRequest[],
  options: {
    continueOnError?: boolean;
    onFrameResult?: (result: FrameBatchResult) => void;
  } = {},
): Promise<FrameBatchResult[]> {
  const batchResults: FrameBatchResult[] = [];

  for (let i = 0; i < frameIds.length; i++) {
    const frameId = frameIds[i];

    // Switch to this frame
    try {
      await invoke('select_frame', { frameId });
    } catch (err: unknown) {
      const errorResult: FrameBatchResult = {
        frameId,
        frameIndex: i,
        results: [{
          name: 'select_frame',
          success: false,
          data: null,
          error: `Failed to switch to frame: ${err instanceof Error ? err.message : String(err)}`,
          durationMs: 0,
        }],
        success: false,
      };
      batchResults.push(errorResult);
      options.onFrameResult?.(errorResult);
      if (!options.continueOnError) break;
      continue;
    }

    // Execute all calls on this frame
    const frameResults: ToolCallResult[] = [];
    let frameSuccess = true;
    for (const call of calls) {
      const result = await executeToolCall(call);
      frameResults.push(result);
      if (!result.success) {
        frameSuccess = false;
        if (!options.continueOnError) break;
      }
    }

    const batchResult: FrameBatchResult = {
      frameId,
      frameIndex: i,
      results: frameResults,
      success: frameSuccess,
    };
    batchResults.push(batchResult);
    options.onFrameResult?.(batchResult);

    if (!frameSuccess && !options.continueOnError) break;
  }

  return batchResults;
}

/**
 * Validate tool call arguments against the schema.
 * Returns an error string if invalid, null if valid.
 */
function validateArgs(tool: ToolDefinition, args: Record<string, unknown>): string | null {
  for (const req of tool.parameters.required) {
    if (!(req in args) || args[req] === undefined || args[req] === null) {
      return `Missing required parameter: ${req} for tool ${tool.name}`;
    }
  }

  for (const [key, value] of Object.entries(args)) {
    const schema = tool.parameters.properties[key];
    if (!schema) continue; // Extra params are allowed (ignored)

    if (schema.type === 'integer' || schema.type === 'number') {
      if (typeof value !== 'number') {
        return `Parameter ${key} must be a number, got ${typeof value}`;
      }
      if (schema.minimum !== undefined && value < schema.minimum) {
        return `Parameter ${key} must be >= ${schema.minimum}, got ${value}`;
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return `Parameter ${key} must be <= ${schema.maximum}, got ${value}`;
      }
    }

    if (schema.type === 'string' && typeof value !== 'string') {
      return `Parameter ${key} must be a string, got ${typeof value}`;
    }

    if (schema.type === 'boolean' && typeof value !== 'boolean') {
      return `Parameter ${key} must be a boolean, got ${typeof value}`;
    }

    if (schema.enum && !schema.enum.includes(value as string)) {
      return `Parameter ${key} must be one of: ${schema.enum.join(', ')}. Got: ${value}`;
    }
  }

  return null;
}
