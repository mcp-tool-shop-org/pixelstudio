/**
 * AI Tool Dispatcher — executes LLM tool calls against the live editor.
 *
 * Takes a tool call from Ollama's response, validates it, maps to the
 * correct Tauri command, and returns a structured result.
 * All operations go through the existing undo/redo stack.
 */

import { invoke } from '@tauri-apps/api/core';
import { findTool, type ToolDefinition } from './aiToolRegistry';

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
export async function executeToolCall(call: ToolCallRequest): Promise<ToolCallResult> {
  const start = Date.now();
  const tool = findTool(call.name);

  if (!tool) {
    return {
      name: call.name,
      success: false,
      data: null,
      error: `Unknown tool: ${call.name}. Available tools: draw_pixel, read_pixel, begin_stroke, stroke_points, end_stroke, create_layer, set_layer_visibility, rename_layer, reorder_layer, create_frame, duplicate_frame, select_frame, set_frame_duration, set_selection, clear_selection, copy_selection, paste_selection, flip_selection_horizontal, analyze_bounds, analyze_colors, undo, redo`,
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
