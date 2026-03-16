/**
 * Sketch dab expansion — converts a single cursor position into
 * a set of pixel coordinates based on brush size and scatter.
 *
 * Designed for speed and roughness, not precision.
 */

export interface DabParams {
  /** Brush diameter in pixels */
  size: number;
  /** Scatter radius (0 = no randomness) */
  scatter: number;
  /** Canvas width for bounds clamping */
  canvasWidth: number;
  /** Canvas height for bounds clamping */
  canvasHeight: number;
}

/** Simple deterministic hash for reproducible scatter */
function hash(x: number, y: number, seed: number): number {
  let h = (x * 374761393 + y * 668265263 + seed * 1274126177) | 0;
  h = ((h ^ (h >> 13)) * 1103515245) | 0;
  return (h ^ (h >> 16)) >>> 0;
}

/**
 * Expand a single cursor pixel into a filled circle of dab points.
 * Returns an array of [x, y] pairs, clamped to canvas bounds.
 */
export function expandDab(
  cx: number,
  cy: number,
  params: DabParams,
): [number, number][] {
  const { size, scatter, canvasWidth, canvasHeight } = params;
  const points: [number, number][] = [];
  const radius = Math.max(0, (size - 1) / 2);
  const r2 = radius * radius;

  const minX = Math.max(0, Math.floor(cx - radius - scatter));
  const maxX = Math.min(canvasWidth - 1, Math.ceil(cx + radius + scatter));
  const minY = Math.max(0, Math.floor(cy - radius - scatter));
  const maxY = Math.min(canvasHeight - 1, Math.ceil(cy + radius + scatter));

  for (let py = minY; py <= maxY; py++) {
    for (let px = minX; px <= maxX; px++) {
      const dx = px - cx;
      const dy = py - cy;
      const dist2 = dx * dx + dy * dy;

      if (dist2 <= r2) {
        // Inside core circle — always include
        points.push([px, py]);
      } else if (scatter > 0 && dist2 <= (radius + scatter) * (radius + scatter)) {
        // In scatter zone — include with probability based on distance
        const h = hash(px, py, cx + cy * 1000);
        const prob = 1.0 - (Math.sqrt(dist2) - radius) / scatter;
        if ((h % 1000) / 1000 < prob * 0.5) {
          points.push([px, py]);
        }
      }
    }
  }

  return points;
}

/**
 * Expand a Bresenham line of cursor positions into dab points,
 * respecting spacing to avoid over-painting.
 *
 * Returns deduplicated [x, y] pairs.
 */
export function expandStrokeDabs(
  cursorPoints: [number, number][],
  params: DabParams & { spacing: number },
): [number, number][] {
  if (cursorPoints.length === 0) return [];

  const { spacing, size } = params;
  const step = Math.max(1, Math.round(size * spacing));
  const seen = new Set<string>();
  const result: [number, number][] = [];

  let accumulated = step; // Place first dab immediately

  for (let i = 0; i < cursorPoints.length; i++) {
    accumulated++;
    if (accumulated >= step || i === 0) {
      accumulated = 0;
      const [cx, cy] = cursorPoints[i];
      const dab = expandDab(cx, cy, params);
      for (const [px, py] of dab) {
        const key = `${px},${py}`;
        if (!seen.has(key)) {
          seen.add(key);
          result.push([px, py]);
        }
      }
    }
  }

  return result;
}
