/**
 * Size profile types for vector-to-sprite rasterization.
 *
 * A size profile defines a target sprite resolution that a vector master
 * can be rasterized to. The pipeline: design at artboard size → rasterize
 * to each profile → inspect readability → pixel cleanup per size.
 */

// ── Size profile ──

/** Unique size profile identifier. */
export type SizeProfileId = string;

/**
 * A target sprite size for rasterization.
 *
 * Each profile represents a game-facing resolution where the vector master
 * will be evaluated for readability.
 */
export interface SizeProfile {
  id: SizeProfileId;
  /** Human-readable name (e.g. "16×32 mini", "48×48 large"). */
  name: string;
  /** Target width in pixels. */
  targetWidth: number;
  /** Target height in pixels. */
  targetHeight: number;
  /** Usage notes (e.g. "good for overworld", "detail tier"). */
  notes: string;
}

// ── Built-in profiles ──

/** Common sprite size profiles for game art. */
export const BUILT_IN_SIZE_PROFILES: readonly SizeProfile[] = [
  { id: 'sp_16x16', name: '16×16 micro', targetWidth: 16, targetHeight: 16, notes: 'Items, icons, tiny props' },
  { id: 'sp_16x32', name: '16×32 mini', targetWidth: 16, targetHeight: 32, notes: 'Classic RPG overworld characters' },
  { id: 'sp_24x24', name: '24×24 small', targetWidth: 24, targetHeight: 24, notes: 'Small icons, compact props' },
  { id: 'sp_32x32', name: '32×32 standard', targetWidth: 32, targetHeight: 32, notes: 'Standard props, small characters' },
  { id: 'sp_32x48', name: '32×48 tall', targetWidth: 32, targetHeight: 48, notes: 'Tall characters, standard RPG' },
  { id: 'sp_48x48', name: '48×48 large', targetWidth: 48, targetHeight: 48, notes: 'Detailed characters, large props' },
  { id: 'sp_64x64', name: '64×64 detail', targetWidth: 64, targetHeight: 64, notes: 'High detail, portraits, bosses' },
] as const;

// ── Reduction report ──

/**
 * Analysis of how a vector master survives rasterization at a given size.
 *
 * Produced by the reduction analyzer to show which shapes survived,
 * which collapsed, and overall fill coverage.
 */
export interface ReductionReport {
  /** Size profile this report was generated for. */
  profileId: SizeProfileId;
  /** Target dimensions. */
  targetWidth: number;
  targetHeight: number;
  /** Number of filled (non-transparent) pixels in the rasterized output. */
  filledPixelCount: number;
  /** Total pixels in the target buffer. */
  totalPixels: number;
  /** Fill percentage (0–100). */
  fillPercent: number;
  /** Shape IDs that collapsed below 1px at this size. */
  collapsedShapeIds: string[];
  /** Shape IDs that rendered with >= 1px at this size. */
  survivedShapeIds: string[];
  /** Bounding box of the rasterized silhouette. */
  silhouetteBounds: { x: number; y: number; w: number; h: number };
}

// ── Factory ──

/** Generate a unique size profile ID. */
export function generateSizeProfileId(): SizeProfileId {
  return `sp_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create a custom size profile. */
export function createSizeProfile(
  name: string,
  targetWidth: number,
  targetHeight: number,
  notes: string = '',
): SizeProfile {
  if (targetWidth < 1 || targetHeight < 1) {
    throw new Error('Target dimensions must be at least 1×1');
  }
  return {
    id: generateSizeProfileId(),
    name,
    targetWidth,
    targetHeight,
    notes,
  };
}
