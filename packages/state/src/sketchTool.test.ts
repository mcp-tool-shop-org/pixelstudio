import { describe, it, expect } from 'vitest';
import { isSketchTool, SKETCH_TOOLS } from '@glyphstudio/domain';
import type { ToolId } from '@glyphstudio/domain';

describe('isSketchTool', () => {
  it('returns true for sketch-brush', () => {
    expect(isSketchTool('sketch-brush')).toBe(true);
  });

  it('returns true for sketch-eraser', () => {
    expect(isSketchTool('sketch-eraser')).toBe(true);
  });

  it('returns false for pencil', () => {
    expect(isSketchTool('pencil')).toBe(false);
  });

  it('returns false for eraser', () => {
    expect(isSketchTool('eraser')).toBe(false);
  });

  it('returns false for all non-sketch tools', () => {
    const nonSketch: ToolId[] = [
      'pencil', 'eraser', 'fill', 'line', 'rectangle', 'ellipse',
      'marquee', 'lasso', 'magic-select', 'color-select',
      'move', 'transform', 'slice', 'socket', 'measure',
    ];
    for (const tool of nonSketch) {
      expect(isSketchTool(tool)).toBe(false);
    }
  });
});

describe('SKETCH_TOOLS', () => {
  it('contains exactly sketch-brush and sketch-eraser', () => {
    expect(SKETCH_TOOLS).toEqual(['sketch-brush', 'sketch-eraser']);
  });

  it('is readonly', () => {
    // TypeScript enforces this at compile time; runtime check that it's an array
    expect(Array.isArray(SKETCH_TOOLS)).toBe(true);
  });
});
