import { describe, it, expect } from 'vitest';
import {
  TOOL_REGISTRY,
  toolsToOllamaFormat,
  findTool,
  getRelevantTools,
} from './aiToolRegistry';

describe('TOOL_REGISTRY', () => {
  it('has 22 tools', () => {
    expect(TOOL_REGISTRY).toHaveLength(22);
  });

  it('all tools have unique names', () => {
    const names = TOOL_REGISTRY.map((t) => t.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('all tools have a tauriCommand', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.tauriCommand).toBeTruthy();
    }
  });

  it('all tools have valid parameter schemas', () => {
    for (const tool of TOOL_REGISTRY) {
      expect(tool.parameters.type).toBe('object');
      expect(tool.parameters.properties).toBeDefined();
      expect(Array.isArray(tool.parameters.required)).toBe(true);
      // All required params must exist in properties
      for (const req of tool.parameters.required) {
        expect(tool.parameters.properties[req]).toBeDefined();
      }
    }
  });
});

describe('toolsToOllamaFormat', () => {
  it('converts all tools to Ollama format', () => {
    const formatted = toolsToOllamaFormat();
    expect(formatted).toHaveLength(22);
    for (const t of formatted) {
      expect(t.type).toBe('function');
      expect(t.function.name).toBeTruthy();
      expect(t.function.description).toBeTruthy();
      expect(t.function.parameters).toBeDefined();
    }
  });

  it('accepts a subset of tools', () => {
    const subset = TOOL_REGISTRY.slice(0, 3);
    const formatted = toolsToOllamaFormat(subset);
    expect(formatted).toHaveLength(3);
  });
});

describe('findTool', () => {
  it('finds existing tools', () => {
    expect(findTool('draw_pixel')).toBeDefined();
    expect(findTool('undo')).toBeDefined();
    expect(findTool('analyze_bounds')).toBeDefined();
  });

  it('returns undefined for unknown tools', () => {
    expect(findTool('nonexistent_tool')).toBeUndefined();
  });
});

describe('getRelevantTools', () => {
  it('always includes drawing and analysis tools', () => {
    const tools = getRelevantTools({
      hasSelection: false,
      frameCount: 1,
      canUndo: false,
      canRedo: false,
    });
    const names = tools.map((t) => t.name);
    expect(names).toContain('draw_pixel');
    expect(names).toContain('analyze_bounds');
    expect(names).toContain('create_layer');
  });

  it('excludes selection tools when no selection', () => {
    const tools = getRelevantTools({
      hasSelection: false,
      frameCount: 1,
      canUndo: false,
      canRedo: false,
    });
    const names = tools.map((t) => t.name);
    expect(names).not.toContain('copy_selection');
    expect(names).not.toContain('flip_selection_horizontal');
  });

  it('includes selection tools when selection active', () => {
    const tools = getRelevantTools({
      hasSelection: true,
      frameCount: 1,
      canUndo: false,
      canRedo: false,
    });
    const names = tools.map((t) => t.name);
    expect(names).toContain('copy_selection');
    expect(names).toContain('paste_selection');
  });

  it('excludes undo when nothing to undo', () => {
    const tools = getRelevantTools({
      hasSelection: false,
      frameCount: 1,
      canUndo: false,
      canRedo: false,
    });
    const names = tools.map((t) => t.name);
    expect(names).not.toContain('undo');
    expect(names).not.toContain('redo');
  });

  it('includes undo/redo when available', () => {
    const tools = getRelevantTools({
      hasSelection: false,
      frameCount: 1,
      canUndo: true,
      canRedo: true,
    });
    const names = tools.map((t) => t.name);
    expect(names).toContain('undo');
    expect(names).toContain('redo');
  });
});
