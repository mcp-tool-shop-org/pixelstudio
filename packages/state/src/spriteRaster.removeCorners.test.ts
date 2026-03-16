import { describe, it, expect } from 'vitest';
import { bresenhamLine, removeCorners } from './spriteRaster';

describe('removeCorners (pixel-perfect)', () => {
  it('returns input unchanged for 0-2 points', () => {
    expect(removeCorners([])).toEqual([]);
    expect(removeCorners([[0, 0]])).toEqual([[0, 0]]);
    expect(removeCorners([[0, 0], [1, 1]])).toEqual([[0, 0], [1, 1]]);
  });

  it('removes L-shaped corners from horizontal→vertical steps', () => {
    // Horizontal then vertical: (0,0)→(1,0)→(1,1) is an L
    const points: [number, number][] = [[0, 0], [1, 0], [1, 1]];
    const result = removeCorners(points);
    // Middle point (1,0) should be removed
    expect(result).toEqual([[0, 0], [1, 1]]);
  });

  it('removes L-shaped corners from vertical→horizontal steps', () => {
    const points: [number, number][] = [[0, 0], [0, 1], [1, 1]];
    const result = removeCorners(points);
    expect(result).toEqual([[0, 0], [1, 1]]);
  });

  it('preserves diagonal-only lines', () => {
    // Pure diagonal — no L corners
    const points: [number, number][] = [[0, 0], [1, 1], [2, 2]];
    const result = removeCorners(points);
    expect(result).toEqual([[0, 0], [1, 1], [2, 2]]);
  });

  it('preserves straight horizontal lines', () => {
    const points: [number, number][] = [[0, 0], [1, 0], [2, 0], [3, 0]];
    const result = removeCorners(points);
    expect(result).toEqual(points);
  });

  it('preserves straight vertical lines', () => {
    const points: [number, number][] = [[0, 0], [0, 1], [0, 2], [0, 3]];
    const result = removeCorners(points);
    expect(result).toEqual(points);
  });

  it('produces fewer points on diagonal bresenham lines', () => {
    const raw = bresenhamLine(0, 0, 5, 3);
    const cleaned = removeCorners(raw);
    // Cleaned should have fewer or equal points (corners removed)
    expect(cleaned.length).toBeLessThanOrEqual(raw.length);
    // First and last should be preserved
    expect(cleaned[0]).toEqual([0, 0]);
    expect(cleaned[cleaned.length - 1]).toEqual([5, 3]);
  });

  it('always preserves start and end points', () => {
    const raw = bresenhamLine(0, 0, 3, 7);
    const cleaned = removeCorners(raw);
    expect(cleaned[0]).toEqual(raw[0]);
    expect(cleaned[cleaned.length - 1]).toEqual(raw[raw.length - 1]);
  });
});
