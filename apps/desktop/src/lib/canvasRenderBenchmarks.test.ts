/**
 * Performance benchmark harness for canvas render helpers.
 *
 * These tests are NOT correctness tests — they measure wall-clock cost of the
 * pixel-buffer operations at realistic frame sizes and establish a regression
 * baseline. They run in the Vitest environment (no DOM needed) and use
 * performance.now() for sub-millisecond timing.
 *
 * Failure thresholds are intentionally generous (10× the expected cost) so
 * CI never flakes on a busy runner. The purpose is to catch orders-of-magnitude
 * regressions, not to enforce a specific microsecond budget.
 *
 * Ledger — last recorded on 2026-03-17 (CI / Windows / Vitest 4.1):
 *   buildFramePixelBuffer  32×32   normal     < 0.1ms
 *   buildFramePixelBuffer  64×64   normal     < 0.2ms
 *   buildFramePixelBuffer 128×128  normal     < 0.5ms
 *   buildFramePixelBuffer 256×256  normal     < 1.5ms
 *   buildFramePixelBuffer  64×64   silhouette < 0.3ms
 *   buildTintedPixelBuffer 64×64   blue       < 0.3ms
 *   buildTintedPixelBuffer 64×64   red        < 0.3ms
 *   buildTintedPixelBuffer 128×128 blue       < 0.6ms
 *
 * Architectural truths locked by FRP-2 / FRP-3 (2026-03-17):
 *   - Pan/zoom removed from React reconciliation path (FRP-3-C4).
 *     Path: Zustand subscribe → scheduleRender → rAF → render reads state
 *     imperatively. Zero React re-renders per gesture tick.
 *     Regression: any re-introduction of zoom/panX/panY into the render
 *     useCallback dep array restores the old React cascade.
 *   - Full-frame render is composition-only when pixels are unchanged (FRP-2-C3).
 *     Path: offscreen canvas keyed by frameVersion — drawImage per render,
 *     putImageData only on stroke commit.
 *     Regression: any per-pixel fillRect loop in the render hot path.
 *   - Onion skin and transform preview follow the same offscreen pattern (FRP-2-C4, FRP-3-C2).
 *   - rAF coalescing gates all pointer-event-driven renders (FRP-2-C2).
 *     Regression: direct render() calls in pointer move handlers.
 */

import { describe, it, expect } from 'vitest';
import { buildFramePixelBuffer, buildTintedPixelBuffer } from './canvasRenderHelpers';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Generate a synthetic RGBA frame with known values for benchmarking. */
function makeFrameData(width: number, height: number): number[] {
  const n = width * height * 4;
  const data = new Array<number>(n);
  for (let i = 0; i < n; i += 4) {
    data[i]     = (i / 4) % 256;          // R cycles through 0-255
    data[i + 1] = 128;                     // G constant
    data[i + 2] = 64;                      // B constant
    data[i + 3] = i % 8 === 0 ? 0 : 255;  // ~12.5% transparent, rest opaque
  }
  return data;
}

/** Run fn() `iterations` times and return median wall-clock ms per call. */
function timeMs(fn: () => void, iterations = 100): number {
  // Warm up the JIT
  for (let i = 0; i < 5; i++) fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const t0 = performance.now();
    fn();
    times.push(performance.now() - t0);
  }
  times.sort((a, b) => a - b);
  return times[Math.floor(times.length / 2)]; // median
}

// ---------------------------------------------------------------------------
// buildFramePixelBuffer — normal mode
// ---------------------------------------------------------------------------

describe('benchmark: buildFramePixelBuffer normal mode', () => {
  it('32×32 completes in < 1ms', () => {
    const src = makeFrameData(32, 32);
    const ms = timeMs(() => buildFramePixelBuffer(src, 32, 32, false, 0, 0, 0));
    // Ledger: < 0.1ms expected. Threshold is 1ms (10× budget) for CI tolerance.
    expect(ms).toBeLessThan(1);
  });

  it('64×64 completes in < 2ms', () => {
    const src = makeFrameData(64, 64);
    const ms = timeMs(() => buildFramePixelBuffer(src, 64, 64, false, 0, 0, 0));
    // Ledger: < 0.2ms expected. Threshold: 2ms.
    expect(ms).toBeLessThan(2);
  });

  it('128×128 completes in < 5ms', () => {
    const src = makeFrameData(128, 128);
    const ms = timeMs(() => buildFramePixelBuffer(src, 128, 128, false, 0, 0, 0));
    // Ledger: < 0.5ms expected. Threshold: 5ms.
    expect(ms).toBeLessThan(5);
  });

  it('256×256 completes in < 15ms', () => {
    const src = makeFrameData(256, 256);
    const ms = timeMs(() => buildFramePixelBuffer(src, 256, 256, false, 0, 0, 0));
    // Ledger: < 1.5ms expected. Threshold: 15ms.
    expect(ms).toBeLessThan(15);
  });
});

// ---------------------------------------------------------------------------
// buildFramePixelBuffer — silhouette mode
// ---------------------------------------------------------------------------

describe('benchmark: buildFramePixelBuffer silhouette mode', () => {
  it('64×64 silhouette completes in < 3ms', () => {
    const src = makeFrameData(64, 64);
    const ms = timeMs(() => buildFramePixelBuffer(src, 64, 64, true, 255, 0, 128));
    // Ledger: < 0.3ms expected. Threshold: 3ms.
    expect(ms).toBeLessThan(3);
  });

  it('128×128 silhouette completes in < 6ms', () => {
    const src = makeFrameData(128, 128);
    const ms = timeMs(() => buildFramePixelBuffer(src, 128, 128, true, 255, 0, 128));
    // Ledger: < 0.6ms expected. Threshold: 6ms.
    expect(ms).toBeLessThan(6);
  });
});

// ---------------------------------------------------------------------------
// buildTintedPixelBuffer
// ---------------------------------------------------------------------------

describe('benchmark: buildTintedPixelBuffer', () => {
  it('64×64 blue tint completes in < 3ms', () => {
    const src = makeFrameData(64, 64);
    const ms = timeMs(() => buildTintedPixelBuffer(src, 64, 64, 'blue'));
    // Ledger: < 0.3ms expected. Threshold: 3ms.
    expect(ms).toBeLessThan(3);
  });

  it('64×64 red tint completes in < 3ms', () => {
    const src = makeFrameData(64, 64);
    const ms = timeMs(() => buildTintedPixelBuffer(src, 64, 64, 'red'));
    // Ledger: < 0.3ms expected. Threshold: 3ms.
    expect(ms).toBeLessThan(3);
  });

  it('128×128 blue tint completes in < 6ms', () => {
    const src = makeFrameData(128, 128);
    const ms = timeMs(() => buildTintedPixelBuffer(src, 128, 128, 'blue'));
    // Ledger: < 0.6ms expected. Threshold: 6ms.
    expect(ms).toBeLessThan(6);
  });

  it('128×128 red tint completes in < 6ms', () => {
    const src = makeFrameData(128, 128);
    const ms = timeMs(() => buildTintedPixelBuffer(src, 128, 128, 'red'));
    // Ledger: < 0.6ms expected. Threshold: 6ms.
    expect(ms).toBeLessThan(6);
  });
});
