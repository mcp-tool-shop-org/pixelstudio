import { describe, it, expect } from 'vitest';
import {
  bresenhamLine,
  rectangleOutline,
  ellipseOutline,
  screenToCanvasPixelUnclamped,
  screenToCanvasPixelClamped,
  type CanvasViewport,
} from './canvasPixelMath';

// ---------------------------------------------------------------------------
// bresenhamLine
// ---------------------------------------------------------------------------

describe('bresenhamLine', () => {
  it('returns single point for same start and end', () => {
    expect(bresenhamLine(3, 3, 3, 3)).toEqual([[3, 3]]);
  });

  it('draws horizontal line left-to-right', () => {
    const pts = bresenhamLine(0, 0, 3, 0);
    expect(pts).toEqual([[0, 0], [1, 0], [2, 0], [3, 0]]);
  });

  it('draws horizontal line right-to-left', () => {
    const pts = bresenhamLine(3, 0, 0, 0);
    expect(pts).toEqual([[3, 0], [2, 0], [1, 0], [0, 0]]);
  });

  it('draws vertical line top-to-bottom', () => {
    const pts = bresenhamLine(0, 0, 0, 3);
    expect(pts).toEqual([[0, 0], [0, 1], [0, 2], [0, 3]]);
  });

  it('draws 45-degree diagonal', () => {
    const pts = bresenhamLine(0, 0, 2, 2);
    expect(pts).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('starts at (x0,y0) and ends at (x1,y1)', () => {
    const pts = bresenhamLine(5, 2, 8, 6);
    expect(pts[0]).toEqual([5, 2]);
    expect(pts[pts.length - 1]).toEqual([8, 6]);
  });

  it('produces no duplicate points', () => {
    const pts = bresenhamLine(0, 0, 10, 7);
    const keys = pts.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ---------------------------------------------------------------------------
// rectangleOutline
// ---------------------------------------------------------------------------

describe('rectangleOutline', () => {
  it('single point when start equals end', () => {
    expect(rectangleOutline(2, 2, 2, 2)).toEqual([[2, 2]]);
  });

  it('horizontal line for height-0 rectangle', () => {
    const pts = rectangleOutline(0, 0, 2, 0);
    const xs = pts.map(([x]) => x).sort((a, b) => a - b);
    expect(xs).toEqual([0, 1, 2]);
    pts.forEach(([, y]) => expect(y).toBe(0));
  });

  it('corner order: top row, bottom row, left col, right col', () => {
    const pts = rectangleOutline(0, 0, 2, 2);
    const keys = new Set(pts.map(([x, y]) => `${x},${y}`));
    // All 8 border pixels of a 3×3 outline
    ['0,0','1,0','2,0','0,2','1,2','2,2','0,1','2,1'].forEach((k) => {
      expect(keys.has(k)).toBe(true);
    });
    // Interior pixel should NOT be present
    expect(keys.has('1,1')).toBe(false);
  });

  it('produces no duplicate points', () => {
    const pts = rectangleOutline(0, 0, 5, 4);
    const keys = pts.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('works with reversed coordinates', () => {
    const a = rectangleOutline(0, 0, 3, 3);
    const b = rectangleOutline(3, 3, 0, 0);
    const keysA = new Set(a.map(([x, y]) => `${x},${y}`));
    const keysB = new Set(b.map(([x, y]) => `${x},${y}`));
    keysA.forEach((k) => expect(keysB.has(k)).toBe(true));
  });
});

// ---------------------------------------------------------------------------
// ellipseOutline
// ---------------------------------------------------------------------------

describe('ellipseOutline', () => {
  it('returns single point for zero-size ellipse', () => {
    const pts = ellipseOutline(2, 2, 2, 2);
    expect(pts.length).toBe(1);
    expect(pts[0]).toEqual([2, 2]);
  });

  it('returns vertical line when rx < 0.5', () => {
    const pts = ellipseOutline(5, 0, 5, 4);
    pts.forEach(([x]) => expect(x).toBe(5));
    const ys = pts.map(([, y]) => y).sort((a, b) => a - b);
    expect(ys[0]).toBe(0);
    expect(ys[ys.length - 1]).toBe(4);
  });

  it('returns horizontal line when ry < 0.5', () => {
    const pts = ellipseOutline(0, 5, 4, 5);
    pts.forEach(([, y]) => expect(y).toBe(5));
    const xs = pts.map(([x]) => x).sort((a, b) => a - b);
    expect(xs[0]).toBe(0);
    expect(xs[xs.length - 1]).toBe(4);
  });

  it('produces no duplicate points', () => {
    const pts = ellipseOutline(0, 0, 10, 6);
    const keys = pts.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('circle outline has ~symmetric extents', () => {
    const pts = ellipseOutline(0, 0, 8, 8);
    const xs = pts.map(([x]) => x);
    const ys = pts.map(([, y]) => y);
    expect(Math.min(...xs)).toBe(0);
    expect(Math.max(...xs)).toBe(8);
    expect(Math.min(...ys)).toBe(0);
    expect(Math.max(...ys)).toBe(8);
  });
});

// ---------------------------------------------------------------------------
// Coordinate transforms
// ---------------------------------------------------------------------------

function makeViewport(overrides: Partial<CanvasViewport> = {}): CanvasViewport {
  return {
    rectLeft: 0,
    rectTop: 0,
    rectWidth: 200,
    rectHeight: 200,
    zoom: 1,
    panX: 0,
    panY: 0,
    frameWidth: 64,
    frameHeight: 64,
    ...overrides,
  };
}

describe('screenToCanvasPixelUnclamped', () => {
  it('maps canvas center to frame center with no pan', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    // Center of canvas = (100, 100), origin of frame = (100 - 32, 100 - 32) = (68, 68)
    // pixel = floor((100 - 68) / 1) = 32
    const p = screenToCanvasPixelUnclamped(100, 100, vp);
    expect(p.x).toBe(32);
    expect(p.y).toBe(32);
  });

  it('maps top-left of frame correctly', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    // originX = 100 - 32 = 68, clicking at x=68 → pixel 0
    const p = screenToCanvasPixelUnclamped(68, 68, vp);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('accounts for zoom', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 4, frameWidth: 32, frameHeight: 32, panX: 0, panY: 0 });
    // originX = 100 - (32*4)/2 = 100 - 64 = 36
    // clicking at x=36 → floor((36-36)/4) = 0
    const p = screenToCanvasPixelUnclamped(36, 36, vp);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('accounts for pan', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64, panX: 10, panY: 0 });
    // originX = 100 - 32 + 10 = 78, clicking at x=78 → pixel 0
    const p = screenToCanvasPixelUnclamped(78, 68, vp);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });

  it('can return coords outside frame bounds', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    const p = screenToCanvasPixelUnclamped(-100, -100, vp);
    expect(p.x).toBeLessThan(0);
    expect(p.y).toBeLessThan(0);
  });

  it('accounts for non-zero rectLeft/rectTop', () => {
    const vp = makeViewport({ rectLeft: 50, rectTop: 50, rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    // Same logical click, now shifted by (50,50) in screen space
    const p = screenToCanvasPixelUnclamped(50 + 68, 50 + 68, vp);
    expect(p.x).toBe(0);
    expect(p.y).toBe(0);
  });
});

describe('screenToCanvasPixelClamped', () => {
  it('returns null for out-of-bounds click', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    expect(screenToCanvasPixelClamped(-10, -10, vp)).toBeNull();
    expect(screenToCanvasPixelClamped(1000, 1000, vp)).toBeNull();
  });

  it('returns pixel for in-bounds click', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    const p = screenToCanvasPixelClamped(68, 68, vp);
    expect(p).not.toBeNull();
    expect(p!.x).toBe(0);
    expect(p!.y).toBe(0);
  });

  it('returns null exactly at frame boundary (frameWidth)', () => {
    const vp = makeViewport({ rectWidth: 200, rectHeight: 200, zoom: 1, frameWidth: 64, frameHeight: 64 });
    // originX = 68; clicking at 68 + 64 = 132 → pixel 64 (out of bounds)
    expect(screenToCanvasPixelClamped(132, 68, vp)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// applyMirrorPoints
// ---------------------------------------------------------------------------

import { applyMirrorPoints } from './canvasPixelMath';

describe('applyMirrorPoints', () => {
  const W = 16, H = 16;

  it('mode=none returns original points unchanged', () => {
    const pts: [number, number][] = [[2, 3], [7, 8]];
    expect(applyMirrorPoints(pts, W, H, 'none')).toEqual(pts);
  });

  it('mode=h adds horizontally mirrored counterpart', () => {
    const result = applyMirrorPoints([[2, 3]], W, H, 'h');
    expect(result).toContainEqual([2, 3]);
    expect(result).toContainEqual([13, 3]); // W-1-2 = 13
    expect(result).toHaveLength(2);
  });

  it('mode=v adds vertically mirrored counterpart', () => {
    const result = applyMirrorPoints([[2, 3]], W, H, 'v');
    expect(result).toContainEqual([2, 3]);
    expect(result).toContainEqual([2, 12]); // H-1-3 = 12
    expect(result).toHaveLength(2);
  });

  it('mode=both adds three additional mirror variants', () => {
    const result = applyMirrorPoints([[2, 3]], W, H, 'both');
    expect(result).toContainEqual([2, 3]);
    expect(result).toContainEqual([13, 3]);
    expect(result).toContainEqual([2, 12]);
    expect(result).toContainEqual([13, 12]);
    expect(result).toHaveLength(4);
  });

  it('deduplicates points on horizontal mirror axis', () => {
    // x = 7 in a 16-wide canvas: mirror = W-1-7 = 8 (different — no dedup)
    // x = 7.5 doesn't exist in integers; use a 15-wide canvas where mid = 7
    const result = applyMirrorPoints([[7, 3]], 15, H, 'h');
    // W-1-7 = 7 (same!) so only 1 point
    expect(result).toHaveLength(1);
    expect(result).toContainEqual([7, 3]);
  });

  it('deduplicates points on vertical mirror axis', () => {
    const result = applyMirrorPoints([[2, 7]], W, 15, 'v');
    // H-1-7 = 7 (same!) → dedup
    expect(result).toHaveLength(1);
  });

  it('handles empty points array', () => {
    expect(applyMirrorPoints([], W, H, 'h')).toEqual([]);
  });

  it('handles multiple points without cross-dedup', () => {
    const pts: [number, number][] = [[1, 1], [4, 4]];
    const result = applyMirrorPoints(pts, W, H, 'h');
    // original: (1,1), (4,4); mirrors: (14,1), (11,4)
    expect(result).toHaveLength(4);
  });

  it('deduplicates when two source points mirror to the same target', () => {
    // Source: (1,1) and (14,1) — in h-mode mirror of (1,1)=(14,1) and mirror of (14,1)=(1,1)
    const pts: [number, number][] = [[1, 1], [14, 1]];
    const result = applyMirrorPoints(pts, W, H, 'h');
    expect(result).toHaveLength(2);
  });
});
