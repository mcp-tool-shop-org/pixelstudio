import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { executeToolCall, executeBatch, executeBatchAcrossFrames, parseToolCalls, type ToolCallRequest } from './aiToolDispatcher';
import { mockInvoke } from '../test/setup';

beforeEach(() => {
  mockInvoke.reset();
});

afterEach(() => {
  mockInvoke.reset();
});

describe('executeToolCall', () => {
  it('dispatches to the correct Tauri command', async () => {
    mockInvoke.on('write_pixel', () => ({ r: 255, g: 0, b: 0, a: 255 }));

    const result = await executeToolCall({
      name: 'draw_pixel',
      arguments: { x: 5, y: 10, r: 255, g: 0, b: 0, a: 255 },
    });

    expect(result.success).toBe(true);
    expect(result.name).toBe('draw_pixel');
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error for unknown tool', async () => {
    const result = await executeToolCall({
      name: 'fake_tool',
      arguments: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Unknown tool: fake_tool');
  });

  it('validates required parameters', async () => {
    const result = await executeToolCall({
      name: 'draw_pixel',
      arguments: { x: 5 }, // missing y, r, g, b, a
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Missing required parameter');
  });

  it('validates parameter types', async () => {
    const result = await executeToolCall({
      name: 'draw_pixel',
      arguments: { x: 'not a number', y: 10, r: 255, g: 0, b: 0, a: 255 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be a number');
  });

  it('validates parameter ranges', async () => {
    const result = await executeToolCall({
      name: 'draw_pixel',
      arguments: { x: 5, y: 10, r: 300, g: 0, b: 0, a: 255 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be <= 255');
  });

  it('validates enum values', async () => {
    const result = await executeToolCall({
      name: 'begin_stroke',
      arguments: { tool: 'flamethrower', r: 255, g: 0, b: 0, a: 255 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('must be one of');
  });

  it('handles Tauri command errors gracefully', async () => {
    mockInvoke.on('write_pixel', () => {
      throw new Error('Layer is locked');
    });

    const result = await executeToolCall({
      name: 'draw_pixel',
      arguments: { x: 5, y: 10, r: 255, g: 0, b: 0, a: 255 },
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Layer is locked');
  });

  it('works for parameterless tools', async () => {
    mockInvoke.on('undo', () => true);

    const result = await executeToolCall({
      name: 'undo',
      arguments: {},
    });

    expect(result.success).toBe(true);
  });
});

describe('executeBatch', () => {
  it('executes multiple calls sequentially', async () => {
    mockInvoke.on('undo', () => true);
    mockInvoke.on('analyze_bounds', () => ({ minX: 0, minY: 0, maxX: 10, maxY: 10, empty: false }));

    const results = await executeBatch([
      { name: 'undo', arguments: {} },
      { name: 'analyze_bounds', arguments: {} },
    ]);

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(true);
  });

  it('stops on first failure by default', async () => {
    const results = await executeBatch([
      { name: 'fake_tool', arguments: {} },
      { name: 'undo', arguments: {} },
    ]);

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });

  it('continues on error when option set', async () => {
    mockInvoke.on('undo', () => true);

    const results = await executeBatch(
      [
        { name: 'fake_tool', arguments: {} },
        { name: 'undo', arguments: {} },
      ],
      { continueOnError: true },
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(false);
    expect(results[1].success).toBe(true);
  });

  it('calls onResult callback for each result', async () => {
    mockInvoke.on('undo', () => true);
    mockInvoke.on('redo', () => true);

    const collected: string[] = [];
    await executeBatch(
      [
        { name: 'undo', arguments: {} },
        { name: 'redo', arguments: {} },
      ],
      { onResult: (r) => collected.push(r.name) },
    );

    expect(collected).toEqual(['undo', 'redo']);
  });
});

describe('parseToolCalls', () => {
  it('parses standard Ollama tool_calls format', () => {
    const calls = parseToolCalls({
      tool_calls: [
        { function: { name: 'undo', arguments: {} } },
        { function: { name: 'draw_pixel', arguments: { x: 5, y: 10, r: 255, g: 0, b: 0, a: 255 } } },
      ],
    });

    expect(calls).toHaveLength(2);
    expect(calls[0].name).toBe('undo');
    expect(calls[1].name).toBe('draw_pixel');
    expect(calls[1].arguments.x).toBe(5);
  });

  it('parses single JSON object from content', () => {
    const calls = parseToolCalls({
      content: JSON.stringify({ name: 'undo', arguments: {} }),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('undo');
  });

  it('parses JSON array from content', () => {
    const calls = parseToolCalls({
      content: JSON.stringify([
        { name: 'undo', arguments: {} },
        { name: 'redo', arguments: {} },
      ]),
    });

    expect(calls).toHaveLength(2);
  });

  it('returns empty for non-JSON content', () => {
    const calls = parseToolCalls({ content: 'I will now undo the last action.' });
    expect(calls).toHaveLength(0);
  });

  it('returns empty for no tool calls', () => {
    const calls = parseToolCalls({});
    expect(calls).toHaveLength(0);
  });

  it('prefers tool_calls over content', () => {
    const calls = parseToolCalls({
      tool_calls: [{ function: { name: 'undo', arguments: {} } }],
      content: JSON.stringify({ name: 'redo', arguments: {} }),
    });

    expect(calls).toHaveLength(1);
    expect(calls[0].name).toBe('undo');
  });
});

describe('executeBatchAcrossFrames', () => {
  it('executes calls on each frame', async () => {
    mockInvoke.on('select_frame', () => true);
    mockInvoke.on('analyze_bounds', () => ({ minX: 0, minY: 0, maxX: 10, maxY: 10, empty: false }));

    const results = await executeBatchAcrossFrames(
      ['frame-1', 'frame-2', 'frame-3'],
      [{ name: 'analyze_bounds', arguments: {} }],
    );

    expect(results).toHaveLength(3);
    expect(results.every((r) => r.success)).toBe(true);
  });

  it('reports failed frames', async () => {
    let callCount = 0;
    mockInvoke.on('select_frame', () => {
      callCount++;
      if (callCount === 2) throw new Error('Frame not found');
      return true;
    });
    mockInvoke.on('analyze_bounds', () => ({ empty: true }));

    const results = await executeBatchAcrossFrames(
      ['frame-1', 'frame-2'],
      [{ name: 'analyze_bounds', arguments: {} }],
      { continueOnError: true },
    );

    expect(results).toHaveLength(2);
    expect(results[0].success).toBe(true);
    expect(results[1].success).toBe(false);
  });

  it('stops on error by default', async () => {
    mockInvoke.on('select_frame', () => { throw new Error('fail'); });

    const results = await executeBatchAcrossFrames(
      ['frame-1', 'frame-2'],
      [{ name: 'analyze_bounds', arguments: {} }],
    );

    expect(results).toHaveLength(1);
    expect(results[0].success).toBe(false);
  });
});

describe('apply_to_all_frames meta-tool', () => {
  it('applies calls to all frames via context', async () => {
    mockInvoke.on('select_frame', () => true);
    mockInvoke.on('analyze_colors', () => ({ uniqueColors: 5, histogram: [] }));

    const result = await executeToolCall(
      {
        name: 'apply_to_all_frames',
        arguments: {
          calls: [{ name: 'analyze_colors', arguments: {} }],
        },
      },
      { frameIds: ['f1', 'f2', 'f3'] },
    );

    expect(result.success).toBe(true);
    expect(result.name).toBe('apply_to_all_frames');
  });

  it('fails without frame IDs in context', async () => {
    const result = await executeToolCall(
      {
        name: 'apply_to_all_frames',
        arguments: {
          calls: [{ name: 'analyze_colors', arguments: {} }],
        },
      },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('No frame IDs');
  });

  it('fails with empty calls array', async () => {
    const result = await executeToolCall(
      {
        name: 'apply_to_all_frames',
        arguments: { calls: [] },
      },
      { frameIds: ['f1'] },
    );

    expect(result.success).toBe(false);
    expect(result.error).toContain('non-empty');
  });
});
