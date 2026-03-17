/**
 * Multi-size vector comparison and reduction analysis.
 *
 * Rasterizes a vector master to multiple size profiles and analyzes
 * which shapes survive, collapse, and how readable the result is.
 */

import type {
  VectorMasterDocument,
  SpritePixelBuffer,
  SizeProfile,
  ReductionReport,
  Rgba,
} from '@glyphstudio/domain';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import { rasterizeVectorMaster, wouldShapeCollapse } from './vectorRasterize';
import { pixelPerfectUpscale, countFilledPixels } from './translationComparison';

// ── Multi-target rasterization ──

/**
 * Rasterize a vector master to all given size profiles.
 * Returns a Map from profile ID to rasterized pixel buffer.
 */
export function rasterizeAllProfiles(
  doc: VectorMasterDocument,
  profiles: readonly SizeProfile[],
): Map<string, SpritePixelBuffer> {
  const results = new Map<string, SpritePixelBuffer>();
  for (const profile of profiles) {
    results.set(
      profile.id,
      rasterizeVectorMaster(doc, profile.targetWidth, profile.targetHeight),
    );
  }
  return results;
}

// ── Reduction analysis ──

/**
 * Analyze how a vector master survives reduction to each size profile.
 *
 * For each profile, reports filled pixel count, coverage percentage,
 * which shapes collapsed below 1px, and silhouette bounding box.
 */
export function analyzeReduction(
  doc: VectorMasterDocument,
  profiles: readonly SizeProfile[],
): ReductionReport[] {
  const reports: ReductionReport[] = [];

  for (const profile of profiles) {
    const buf = rasterizeVectorMaster(doc, profile.targetWidth, profile.targetHeight);
    const totalPixels = profile.targetWidth * profile.targetHeight;
    const filledPixelCount = countFilledPixels(buf);

    // Determine which shapes collapsed
    const collapsedShapeIds: string[] = [];
    const survivedShapeIds: string[] = [];
    for (const shape of doc.shapes) {
      if (!shape.visible) continue;
      if (wouldShapeCollapse(shape, doc.artboardWidth, doc.artboardHeight, profile.targetWidth, profile.targetHeight)) {
        collapsedShapeIds.push(shape.id);
      } else {
        survivedShapeIds.push(shape.id);
      }
    }

    // Compute silhouette bounding box
    const bounds = computeSilhouetteBounds(buf);

    reports.push({
      profileId: profile.id,
      targetWidth: profile.targetWidth,
      targetHeight: profile.targetHeight,
      filledPixelCount,
      totalPixels,
      fillPercent: totalPixels > 0 ? (filledPixelCount / totalPixels) * 100 : 0,
      collapsedShapeIds,
      survivedShapeIds,
      silhouetteBounds: bounds,
    });
  }

  return reports;
}

// ── Silhouette bounds ──

function computeSilhouetteBounds(buf: SpritePixelBuffer): { x: number; y: number; w: number; h: number } {
  let minX = buf.width, minY = buf.height, maxX = -1, maxY = -1;

  for (let y = 0; y < buf.height; y++) {
    for (let x = 0; x < buf.width; x++) {
      const i = (y * buf.width + x) * 4 + 3;
      if (buf.data[i] > 0) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  if (maxX < 0) return { x: 0, y: 0, w: 0, h: 0 };
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

// ── Multi-size comparison layout ──

/**
 * Generate a horizontal strip showing the vector master rasterized at
 * multiple target sizes, each upscaled to a common display height.
 *
 * Layout: [size1 upscaled] [gap] [size2 upscaled] [gap] ...
 *
 * The display height is the largest target height × upscale factor.
 */
export function generateMultiSizeLayout(
  doc: VectorMasterDocument,
  profiles: readonly SizeProfile[],
  options: {
    displayHeight?: number;
    gap?: number;
    backgroundColor?: Rgba;
    labelHeight?: number;
  } = {},
): SpritePixelBuffer {
  const {
    displayHeight = 256,
    gap = 8,
    backgroundColor = [40, 40, 40, 255],
    labelHeight = 0,
  } = options;

  if (profiles.length === 0) {
    return createBlankPixelBuffer(1, 1);
  }

  // Rasterize each profile and upscale to display height
  const panels: SpritePixelBuffer[] = [];
  for (const profile of profiles) {
    const rasterized = rasterizeVectorMaster(doc, profile.targetWidth, profile.targetHeight);
    const scale = Math.max(1, Math.floor(displayHeight / profile.targetHeight));
    panels.push(pixelPerfectUpscale(rasterized, scale));
  }

  // Calculate total layout width
  const totalWidth = panels.reduce((sum, p) => sum + p.width, 0) + gap * (panels.length - 1);
  const totalHeight = displayHeight + labelHeight;
  const layout = createBlankPixelBuffer(totalWidth, totalHeight);

  // Fill background
  for (let i = 0; i < layout.data.length; i += 4) {
    layout.data[i] = backgroundColor[0];
    layout.data[i + 1] = backgroundColor[1];
    layout.data[i + 2] = backgroundColor[2];
    layout.data[i + 3] = backgroundColor[3];
  }

  // Blit panels
  let xOffset = 0;
  for (const panel of panels) {
    const yOffset = Math.floor((displayHeight - panel.height) / 2);
    blitPanel(layout, panel, xOffset, yOffset);
    xOffset += panel.width + gap;
  }

  return layout;
}

function blitPanel(
  target: SpritePixelBuffer,
  source: SpritePixelBuffer,
  offsetX: number,
  offsetY: number,
): void {
  for (let sy = 0; sy < source.height; sy++) {
    const ty = offsetY + sy;
    if (ty < 0 || ty >= target.height) continue;
    for (let sx = 0; sx < source.width; sx++) {
      const tx = offsetX + sx;
      if (tx < 0 || tx >= target.width) continue;
      const si = (sy * source.width + sx) * 4;
      const ti = (ty * target.width + tx) * 4;
      if (source.data[si + 3] > 0) {
        target.data[ti] = source.data[si];
        target.data[ti + 1] = source.data[si + 1];
        target.data[ti + 2] = source.data[si + 2];
        target.data[ti + 3] = source.data[si + 3];
      }
    }
  }
}

/**
 * Quick summary of a reduction report — one-line human-readable string.
 */
export function summarizeReduction(report: ReductionReport): string {
  const size = `${report.targetWidth}×${report.targetHeight}`;
  const fill = report.fillPercent.toFixed(1);
  const survived = report.survivedShapeIds.length;
  const collapsed = report.collapsedShapeIds.length;
  return `${size}: ${fill}% fill, ${survived} survived, ${collapsed} collapsed`;
}
