/**
 * AI Tool Registry — defines the tools the LLM copilot can call.
 *
 * These are a curated subset of the 76+ MCP tools, chosen for editing operations.
 * Each definition maps to a Tauri command that modifies live editor state.
 *
 * Ollama tool calling format: { type: "function", function: { name, description, parameters } }
 */

export interface ToolParameter {
  type: string;
  description: string;
  enum?: string[];
  minimum?: number;
  maximum?: number;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, ToolParameter>;
    required: string[];
  };
  tauriCommand: string;
}

/**
 * Core editing tools — the 20 most useful for an AI copilot.
 * Grouped by domain.
 */
export const TOOL_REGISTRY: ToolDefinition[] = [
  // --- Drawing ---
  {
    name: 'draw_pixel',
    description: 'Draw a single pixel at (x, y) with the given RGBA color on the active layer.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'integer', description: 'X coordinate' },
        y: { type: 'integer', description: 'Y coordinate' },
        r: { type: 'integer', description: 'Red (0-255)', minimum: 0, maximum: 255 },
        g: { type: 'integer', description: 'Green (0-255)', minimum: 0, maximum: 255 },
        b: { type: 'integer', description: 'Blue (0-255)', minimum: 0, maximum: 255 },
        a: { type: 'integer', description: 'Alpha (0-255)', minimum: 0, maximum: 255 },
      },
      required: ['x', 'y', 'r', 'g', 'b', 'a'],
    },
    tauriCommand: 'write_pixel',
  },
  {
    name: 'read_pixel',
    description: 'Read the RGBA color of a pixel at (x, y) on the composited frame.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'integer', description: 'X coordinate' },
        y: { type: 'integer', description: 'Y coordinate' },
      },
      required: ['x', 'y'],
    },
    tauriCommand: 'read_pixel',
  },
  {
    name: 'begin_stroke',
    description: 'Begin a new drawing stroke with the given tool and color. Must call end_stroke when done.',
    parameters: {
      type: 'object',
      properties: {
        tool: { type: 'string', description: 'Tool name', enum: ['brush', 'eraser'] },
        r: { type: 'integer', description: 'Red (0-255)' },
        g: { type: 'integer', description: 'Green (0-255)' },
        b: { type: 'integer', description: 'Blue (0-255)' },
        a: { type: 'integer', description: 'Alpha (0-255)' },
      },
      required: ['tool', 'r', 'g', 'b', 'a'],
    },
    tauriCommand: 'begin_stroke',
  },
  {
    name: 'stroke_points',
    description: 'Add points to the current stroke. Each point is [x, y]. Call after begin_stroke.',
    parameters: {
      type: 'object',
      properties: {
        points: { type: 'array', description: 'Array of [x, y] coordinate pairs' },
      },
      required: ['points'],
    },
    tauriCommand: 'stroke_points',
  },
  {
    name: 'end_stroke',
    description: 'Finish the current stroke and commit it to the undo stack.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'end_stroke',
  },

  // --- Layers ---
  {
    name: 'create_layer',
    description: 'Create a new empty layer with the given name.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Layer name' },
      },
      required: ['name'],
    },
    tauriCommand: 'create_layer',
  },
  {
    name: 'set_layer_visibility',
    description: 'Show or hide a layer by name.',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID' },
        visible: { type: 'boolean', description: 'Whether the layer should be visible' },
      },
      required: ['layerId', 'visible'],
    },
    tauriCommand: 'set_layer_visibility',
  },
  {
    name: 'rename_layer',
    description: 'Rename a layer.',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID' },
        name: { type: 'string', description: 'New name' },
      },
      required: ['layerId', 'name'],
    },
    tauriCommand: 'rename_layer',
  },
  {
    name: 'reorder_layer',
    description: 'Move a layer to a new z-order position (0 = bottom).',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID' },
        newIndex: { type: 'integer', description: 'New z-order index' },
      },
      required: ['layerId', 'newIndex'],
    },
    tauriCommand: 'reorder_layer',
  },

  // --- Frames ---
  {
    name: 'create_frame',
    description: 'Add a new blank animation frame.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Frame name (optional)' },
      },
      required: [],
    },
    tauriCommand: 'create_frame',
  },
  {
    name: 'duplicate_frame',
    description: 'Duplicate the current frame with all layers.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'duplicate_frame',
  },
  {
    name: 'select_frame',
    description: 'Switch to a specific frame by ID.',
    parameters: {
      type: 'object',
      properties: {
        frameId: { type: 'string', description: 'Frame UUID' },
      },
      required: ['frameId'],
    },
    tauriCommand: 'select_frame',
  },
  {
    name: 'set_frame_duration',
    description: 'Set per-frame duration in milliseconds. Use null for default FPS timing.',
    parameters: {
      type: 'object',
      properties: {
        frameId: { type: 'string', description: 'Frame UUID' },
        durationMs: { type: 'integer', description: 'Duration in ms (null for default)', minimum: 10 },
      },
      required: ['frameId'],
    },
    tauriCommand: 'set_frame_duration',
  },

  // --- Selection ---
  {
    name: 'set_selection',
    description: 'Set a rectangular selection on the canvas.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'integer', description: 'Left edge' },
        y: { type: 'integer', description: 'Top edge' },
        width: { type: 'integer', description: 'Selection width' },
        height: { type: 'integer', description: 'Selection height' },
      },
      required: ['x', 'y', 'width', 'height'],
    },
    tauriCommand: 'set_selection_rect',
  },
  {
    name: 'clear_selection',
    description: 'Remove the current selection.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'clear_selection',
  },
  {
    name: 'copy_selection',
    description: 'Copy the selected pixels to the clipboard.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'copy_selection',
  },
  {
    name: 'paste_selection',
    description: 'Paste clipboard contents at the current selection position.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'paste_selection',
  },
  {
    name: 'flip_selection_horizontal',
    description: 'Flip the selected region horizontally.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'flip_selection_horizontal',
  },

  // --- Analysis ---
  {
    name: 'analyze_bounds',
    description: 'Get the bounding box of all non-transparent pixels in the current frame.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'analyze_bounds',
  },
  {
    name: 'analyze_colors',
    description: 'Get a color histogram of the current frame (up to 50 colors).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'analyze_colors',
  },

  // --- Undo/Redo ---
  {
    name: 'undo',
    description: 'Undo the last operation.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'undo',
  },
  {
    name: 'redo',
    description: 'Redo the last undone operation.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'redo',
  },
];

/**
 * Convert tool definitions to Ollama tool-calling format.
 */
export function toolsToOllamaFormat(tools: ToolDefinition[] = TOOL_REGISTRY): Array<{
  type: 'function';
  function: { name: string; description: string; parameters: object };
}> {
  return tools.map((t) => ({
    type: 'function' as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: t.parameters,
    },
  }));
}

/**
 * Look up a tool definition by name.
 */
export function findTool(name: string): ToolDefinition | undefined {
  return TOOL_REGISTRY.find((t) => t.name === name);
}

/**
 * Get a context-relevant subset of tools based on what the user is doing.
 * This keeps the context window manageable for 14B models.
 */
export function getRelevantTools(context: {
  hasSelection: boolean;
  frameCount: number;
  canUndo: boolean;
  canRedo: boolean;
}): ToolDefinition[] {
  return TOOL_REGISTRY.filter((t) => {
    // Always include drawing, layers, analysis
    if (['draw_pixel', 'read_pixel', 'begin_stroke', 'stroke_points', 'end_stroke',
      'create_layer', 'set_layer_visibility', 'rename_layer', 'reorder_layer',
      'analyze_bounds', 'analyze_colors'].includes(t.name)) {
      return true;
    }
    // Selection tools only if there's a selection or could be one
    if (['copy_selection', 'paste_selection', 'flip_selection_horizontal', 'clear_selection'].includes(t.name)) {
      return context.hasSelection;
    }
    if (t.name === 'set_selection') return true;
    // Frame tools only if multi-frame
    if (['create_frame', 'duplicate_frame', 'select_frame', 'set_frame_duration'].includes(t.name)) {
      return context.frameCount > 1 || t.name === 'create_frame' || t.name === 'duplicate_frame';
    }
    // Undo/redo based on availability
    if (t.name === 'undo') return context.canUndo;
    if (t.name === 'redo') return context.canRedo;
    return true;
  });
}
