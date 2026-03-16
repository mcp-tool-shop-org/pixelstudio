import { describe, it, expect } from 'vitest';
import { expandDab, expandStrokeDabs } from './sketchDab';

describe('expandDab', () => {
  const base = { canvasWidth: 32, canvasHeight: 32, scatter: 0 };

  it('size 1 returns the center pixel only', () => {
    const pts = expandDab(10, 10, { ...base, size: 1 });
    expect(pts).toEqual([[10, 10]]);
  });

  it('size 3 returns a 3×3-ish filled circle', () => {
    const pts = expandDab(10, 10, { ...base, size: 3 });
    // radius = 1, so all pixels within distance 1 of center
    expect(pts.length).toBeGreaterThanOrEqual(5); // cross + center
    expect(pts.length).toBeLessThanOrEqual(9); // max 3x3
    expect(pts).toContainEqual([10, 10]);
    expect(pts).toContainEqual([9, 10]);
    expect(pts).toContainEqual([11, 10]);
    expect(pts).toContainEqual([10, 9]);
    expect(pts).toContainEqual([10, 11]);
  });

  it('size 5 returns more pixels than size 3', () => {
    const pts3 = expandDab(10, 10, { ...base, size: 3 });
    const pts5 = expandDab(10, 10, { ...base, size: 5 });
    expect(pts5.length).toBeGreaterThan(pts3.length);
  });

  it('clamps to canvas bounds at (0,0)', () => {
    const pts = expandDab(0, 0, { ...base, size: 5 });
    for (const [x, y] of pts) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
    }
  });

  it('clamps to canvas bounds at edge', () => {
    const pts = expandDab(31, 31, { ...base, size: 5, canvasWidth: 32, canvasHeight: 32 });
    for (const [x, y] of pts) {
      expect(x).toBeLessThan(32);
      expect(y).toBeLessThan(32);
    }
  });

  it('scatter adds extra pixels outside core radius', () => {
    const noScatter = expandDab(10, 10, { ...base, size: 3, scatter: 0 });
    const withScatter = expandDab(10, 10, { ...base, size: 3, scatter: 3 });
    expect(withScatter.length).toBeGreaterThan(noScatter.length);
  });

  it('returns no duplicates', () => {
    const pts = expandDab(10, 10, { ...base, size: 5, scatter: 2 });
    const keys = pts.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('expandStrokeDabs', () => {
  const base = { canvasWidth: 64, canvasHeight: 64, scatter: 0, size: 1, spacing: 0.25 };

  it('returns empty for empty input', () => {
    expect(expandStrokeDabs([], base)).toEqual([]);
  });

  it('single point returns at least one pixel', () => {
    const pts = expandStrokeDabs([[10, 10]], base);
    expect(pts.length).toBeGreaterThanOrEqual(1);
    expect(pts).toContainEqual([10, 10]);
  });

  it('deduplicates overlapping dabs', () => {
    // Two adjacent points with size 3 will overlap
    const pts = expandStrokeDabs(
      [[10, 10], [11, 10]],
      { ...base, size: 3, spacing: 0.25 },
    );
    const keys = pts.map(([x, y]) => `${x},${y}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('spacing controls dab frequency', () => {
    const line: [number, number][] = [];
    for (let i = 0; i < 20; i++) line.push([10 + i, 10]);

    const tight = expandStrokeDabs(line, { ...base, size: 3, spacing: 0.25 });
    const loose = expandStrokeDabs(line, { ...base, size: 3, spacing: 1.0 });
    // Tight spacing produces more coverage than loose
    expect(tight.length).toBeGreaterThanOrEqual(loose.length);
  });

  it('larger brush produces more pixels', () => {
    const pts1 = expandStrokeDabs([[16, 16]], { ...base, size: 1 });
    const pts5 = expandStrokeDabs([[16, 16]], { ...base, size: 5 });
    expect(pts5.length).toBeGreaterThan(pts1.length);
  });
});
