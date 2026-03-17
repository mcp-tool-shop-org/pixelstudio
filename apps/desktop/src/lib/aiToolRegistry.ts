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
 * Core editing tools — curated subset for the AI copilot.
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
  {
    name: 'fill_rect',
    description: 'Fill a rectangular area with a solid RGBA color on the active layer.',
    parameters: {
      type: 'object',
      properties: {
        x: { type: 'integer', description: 'Left edge X coordinate' },
        y: { type: 'integer', description: 'Top edge Y coordinate' },
        width: { type: 'integer', description: 'Rectangle width in pixels', minimum: 1 },
        height: { type: 'integer', description: 'Rectangle height in pixels', minimum: 1 },
        r: { type: 'integer', description: 'Red (0-255)', minimum: 0, maximum: 255 },
        g: { type: 'integer', description: 'Green (0-255)', minimum: 0, maximum: 255 },
        b: { type: 'integer', description: 'Blue (0-255)', minimum: 0, maximum: 255 },
        a: { type: 'integer', description: 'Alpha (0-255)', minimum: 0, maximum: 255 },
      },
      required: ['x', 'y', 'width', 'height', 'r', 'g', 'b', 'a'],
    },
    tauriCommand: 'fill_rect',
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
  {
    name: 'select_layer',
    description: 'Switch the active layer by UUID. Drawing operations will target this layer.',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID to activate' },
      },
      required: ['layerId'],
    },
    tauriCommand: 'select_layer',
  },
  {
    name: 'delete_layer',
    description: 'Delete a layer by UUID. Cannot delete the last remaining layer.',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID to delete' },
      },
      required: ['layerId'],
    },
    tauriCommand: 'delete_layer',
  },
  {
    name: 'set_layer_opacity',
    description: 'Set layer opacity (0.0 = fully transparent, 1.0 = fully opaque).',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID' },
        opacity: { type: 'number', description: 'Opacity value 0.0-1.0', minimum: 0, maximum: 1 },
      },
      required: ['layerId', 'opacity'],
    },
    tauriCommand: 'set_layer_opacity',
  },
  {
    name: 'set_layer_lock',
    description: 'Lock or unlock a layer. Locked layers cannot be drawn on.',
    parameters: {
      type: 'object',
      properties: {
        layerId: { type: 'string', description: 'Layer UUID' },
        locked: { type: 'boolean', description: 'Whether the layer should be locked' },
      },
      required: ['layerId', 'locked'],
    },
    tauriCommand: 'set_layer_lock',
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
  {
    name: 'delete_frame',
    description: 'Delete an animation frame by UUID. Cannot delete the last remaining frame.',
    parameters: {
      type: 'object',
      properties: {
        frameId: { type: 'string', description: 'Frame UUID to delete' },
      },
      required: ['frameId'],
    },
    tauriCommand: 'delete_frame',
  },
  {
    name: 'rename_frame',
    description: 'Rename an animation frame.',
    parameters: {
      type: 'object',
      properties: {
        frameId: { type: 'string', description: 'Frame UUID' },
        name: { type: 'string', description: 'New frame name' },
      },
      required: ['frameId', 'name'],
    },
    tauriCommand: 'rename_frame',
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
    description: 'Flip the selected region horizontally. Requires an active transform session.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'flip_selection_horizontal',
  },
  {
    name: 'flip_selection_vertical',
    description: 'Flip the selected region vertically. Requires an active transform session.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'flip_selection_vertical',
  },
  {
    name: 'rotate_selection_90_cw',
    description: 'Rotate the selected region 90° clockwise. Requires an active transform session.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'rotate_selection_90_cw',
  },
  {
    name: 'rotate_selection_90_ccw',
    description: 'Rotate the selected region 90° counter-clockwise. Requires an active transform session.',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'rotate_selection_90_ccw',
  },
  {
    name: 'cut_selection',
    description: 'Cut the selected pixels (copy to clipboard and clear to transparent).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'cut_selection',
  },
  {
    name: 'delete_selection',
    description: 'Delete pixels within the selection (clear to transparent without copying).',
    parameters: {
      type: 'object',
      properties: {},
      required: [],
    },
    tauriCommand: 'delete_selection',
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
  {
    name: 'compare_frames',
    description: 'Compare two frames pixel-by-pixel. Returns changed pixel count, percentage, and bounding box of changes.',
    parameters: {
      type: 'object',
      properties: {
        frameA: { type: 'integer', description: 'First frame index (0-based)' },
        frameB: { type: 'integer', description: 'Second frame index (0-based)' },
      },
      required: ['frameA', 'frameB'],
    },
    tauriCommand: 'compare_frames',
  },

  // --- Batch frame operations ---
  {
    name: 'apply_to_all_frames',
    description: 'Apply a set of tool calls to every frame in the animation. Provide the tool calls as a JSON array in the "calls" parameter. Each call is { name, arguments }. The system will switch to each frame and execute the calls sequentially.',
    parameters: {
      type: 'object',
      properties: {
        calls: { type: 'array', description: 'Array of { name, arguments } tool call objects to run on each frame' },
      },
      required: ['calls'],
    },
    tauriCommand: '__meta_batch_frames__',
  },

  // --- Template generation ---
  {
    name: 'list_templates',
    description: 'List available sprite templates, optionally filtered by archetype (humanoid, quadruped, flying, item, vehicle, structure). Returns template IDs, names, descriptions, and suggested sizes.',
    parameters: {
      type: 'object',
      properties: {
        archetype: { type: 'string', description: 'Filter by archetype (optional)', enum: ['humanoid', 'quadruped', 'flying', 'item', 'vehicle', 'structure'] },
      },
      required: [],
    },
    tauriCommand: '__meta_list_templates__',
  },
  {
    name: 'search_templates',
    description: 'Search sprite templates by keyword (name, description, or tag). Returns matching template IDs and descriptions.',
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search keyword' },
      },
      required: ['query'],
    },
    tauriCommand: '__meta_search_templates__',
  },
  {
    name: 'instantiate_template',
    description: 'Render a sprite template onto the canvas. Provide template ID and optional color overrides (slot name → [r, g, b, a]). The template defines body regions, shapes, and connections which are rasterized in one operation.',
    parameters: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'Template ID (e.g. "humanoid-warrior")' },
        colors: { type: 'object', description: 'Color overrides: { slotName: [r, g, b, a] }. Missing slots use template defaults.' },
        scale: { type: 'number', description: 'Scale factor (1.0 = suggested size, 2.0 = double)', minimum: 0.5, maximum: 4 },
      },
      required: ['templateId'],
    },
    tauriCommand: '__meta_instantiate_template__',
  },

  // --- Animation generation ---
  {
    name: 'list_animations',
    description: 'List available animation presets, optionally filtered by category (idle, walk, run, attack, hurt, death, cast, jump). Shows preset names, descriptions, frame counts, and compatible archetypes.',
    parameters: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Filter by animation category (optional)', enum: ['idle', 'walk', 'run', 'attack', 'hurt', 'death', 'cast', 'jump'] },
        archetype: { type: 'string', description: 'Filter by compatible template archetype (optional)' },
      },
      required: [],
    },
    tauriCommand: '__meta_list_animations__',
  },
  {
    name: 'generate_animation',
    description: 'Generate a multi-frame animation sequence from a template + animation preset. Creates new frames on the canvas with per-frame region transforms applied. Example: "generate idle-bob animation from humanoid-warrior template".',
    parameters: {
      type: 'object',
      properties: {
        templateId: { type: 'string', description: 'Template ID to use as base pose (e.g. "humanoid-warrior")' },
        presetId: { type: 'string', description: 'Animation preset ID (e.g. "idle-bob", "walk-cycle", "attack-swing")' },
        colors: { type: 'object', description: 'Color overrides: { slotName: [r, g, b, a] }. Missing slots use template defaults.' },
        scale: { type: 'number', description: 'Scale factor (1.0 = suggested size)', minimum: 0.5, maximum: 4 },
        intensity: { type: 'number', description: 'Motion intensity (0.5 = subtle, 1.0 = normal, 2.0 = exaggerated)', minimum: 0.1, maximum: 3 },
      },
      required: ['templateId', 'presetId'],
    },
    tauriCommand: '__meta_generate_animation__',
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
  // Tools always available
  const ALWAYS_INCLUDE = new Set([
    'draw_pixel', 'read_pixel', 'begin_stroke', 'stroke_points', 'end_stroke', 'fill_rect',
    'create_layer', 'set_layer_visibility', 'rename_layer', 'reorder_layer',
    'select_layer', 'delete_layer', 'set_layer_opacity', 'set_layer_lock',
    'analyze_bounds', 'analyze_colors',
    'set_selection',
    'list_templates', 'search_templates', 'instantiate_template',
    'list_animations', 'generate_animation',
  ]);

  // Selection-dependent tools
  const SELECTION_TOOLS = new Set([
    'copy_selection', 'paste_selection', 'cut_selection', 'delete_selection',
    'flip_selection_horizontal', 'flip_selection_vertical',
    'rotate_selection_90_cw', 'rotate_selection_90_ccw',
    'clear_selection',
  ]);

  // Frame tools — always include create/duplicate, rest only if multi-frame
  const FRAME_ALWAYS = new Set(['create_frame', 'duplicate_frame']);
  const FRAME_MULTI = new Set([
    'select_frame', 'set_frame_duration', 'delete_frame', 'rename_frame', 'compare_frames',
    'apply_to_all_frames',
  ]);

  return TOOL_REGISTRY.filter((t) => {
    if (ALWAYS_INCLUDE.has(t.name)) return true;
    if (SELECTION_TOOLS.has(t.name)) return context.hasSelection;
    if (FRAME_ALWAYS.has(t.name)) return true;
    if (FRAME_MULTI.has(t.name)) return context.frameCount > 1;
    if (t.name === 'undo') return context.canUndo;
    if (t.name === 'redo') return context.canRedo;
    return true;
  });
}
