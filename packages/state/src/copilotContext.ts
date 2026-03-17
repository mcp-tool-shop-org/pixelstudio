/**
 * Visual Copilot — context capture.
 *
 * Packages the current vector document state, reduction analysis,
 * and shape metadata into a structured snapshot that the copilot
 * analysis engine can reason over.
 *
 * No AI here — just data preparation.
 */

import type {
  VectorMasterDocument,
  VectorShape,
  SizeProfile,
  ReductionReport,
  SpritePixelBuffer,
} from '@glyphstudio/domain';
import { analyzeReduction } from './vectorComparison';
import { rasterizeVectorMaster, wouldShapeCollapse } from './vectorRasterize';

// ── Types ──

/** Per-shape copilot summary — what the copilot sees about one shape. */
export interface CopilotShapeSummary {
  id: string;
  name: string;
  kind: string;
  /** Shape area estimate in artboard pixels. */
  areaEstimate: number;
  /** Percentage of artboard area this shape covers. */
  areaPct: number;
  /** Fill color as hex string, or null if no fill. */
  fillHex: string | null;
  /** Whether the shape has a stroke. */
  hasStroke: boolean;
  /** Survival hint from reduction metadata. */
  survivalHint: string | null;
  /** Cue tag from reduction metadata. */
  cueTag: string | null;
  /** Drop priority (higher = drops first). */
  dropPriority: number;
  /** Per-profile collapse status. */
  collapseByProfile: Record<string, boolean>;
  /** Design notes from the artist. */
  notes: string | null;
  /** Group name this shape belongs to, or null. */
  groupName: string | null;
}

/** Per-profile copilot summary — what the copilot sees about one size. */
export interface CopilotProfileSummary {
  profileId: string;
  name: string;
  targetWidth: number;
  targetHeight: number;
  fillPercent: number;
  survivedCount: number;
  collapsedCount: number;
  /** Names of collapsed shapes (for readable feedback). */
  collapsedNames: string[];
  /** Names of shapes marked must-survive that collapsed. */
  criticalLosses: string[];
  /** Silhouette coverage as fraction of target area. */
  silhouetteCoverage: number;
  /** Silhouette aspect ratio (w/h). */
  silhouetteAspect: number;
}

/** The complete copilot context snapshot. */
export interface CopilotContext {
  /** Document name. */
  documentName: string;
  /** Artboard dimensions. */
  artboardWidth: number;
  artboardHeight: number;
  /** Total shape count (visible + hidden). */
  totalShapes: number;
  /** Visible shape count. */
  visibleShapes: number;
  /** Group count. */
  groupCount: number;
  /** Per-shape summaries (visible shapes only). */
  shapes: CopilotShapeSummary[];
  /** Per-profile summaries. */
  profiles: CopilotProfileSummary[];
  /** Which profile has the strongest readability (highest fill% with fewest critical losses). */
  strongestProfileId: string | null;
  /** Which profile has the worst readability. */
  weakestProfileId: string | null;
  /** Shapes near the collapse threshold (survive at some profiles, collapse at others). */
  atRiskShapeNames: string[];
  /** Shapes marked must-survive that collapse at any active profile. */
  criticalRiskShapeNames: string[];
  /** Whether any shapes have reduction metadata set. */
  hasReductionMetadata: boolean;
  /** Timestamp of capture. */
  capturedAt: string;
}

// ── Helpers ──

function rgbaToHex(c: [number, number, number, number]): string {
  return '#' + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
}

/**
 * Estimate the area of a shape in artboard pixels.
 * Rough but good enough for copilot prioritization.
 */
function estimateShapeArea(shape: VectorShape, artW: number, artH: number): number {
  const g = shape.geometry;
  const sx = Math.abs(shape.transform.scaleX);
  const sy = Math.abs(shape.transform.scaleY);
  switch (g.kind) {
    case 'rect':
      return g.w * g.h * sx * sy;
    case 'ellipse':
      return Math.PI * g.rx * g.ry * sx * sy;
    case 'line':
      // Lines have no area, but they have visual presence via stroke
      return Math.sqrt((g.x2 - g.x1) ** 2 + (g.y2 - g.y1) ** 2) * (shape.stroke?.width ?? 1) * sx;
    case 'polygon': {
      // Shoelace formula
      let area = 0;
      const pts = g.points;
      for (let i = 0; i < pts.length; i++) {
        const j = (i + 1) % pts.length;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      return Math.abs(area) / 2 * sx * sy;
    }
    case 'path': {
      // For paths, use bounding box as rough estimate
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const pt of g.points) {
        if (pt.x < minX) minX = pt.x;
        if (pt.x > maxX) maxX = pt.x;
        if (pt.y < minY) minY = pt.y;
        if (pt.y > maxY) maxY = pt.y;
      }
      // Include control points in bounds
      for (const seg of g.segments) {
        if (seg.kind === 'quadratic') {
          if (seg.cpX < minX) minX = seg.cpX;
          if (seg.cpX > maxX) maxX = seg.cpX;
          if (seg.cpY < minY) minY = seg.cpY;
          if (seg.cpY > maxY) maxY = seg.cpY;
        }
      }
      if (!isFinite(minX)) return 0;
      return (maxX - minX) * (maxY - minY) * 0.6 * sx * sy; // 0.6 for organic shape fill factor
    }
    default:
      return 0;
  }
}

// ── Main capture ──

/**
 * Capture the full copilot context from the current vector state.
 *
 * This is the single function the copilot analysis engine calls
 * to get everything it needs for structured critique.
 */
export function captureCopilotContext(
  doc: VectorMasterDocument,
  activeProfiles: readonly SizeProfile[],
): CopilotContext {
  const artboardArea = doc.artboardWidth * doc.artboardHeight;

  // Run reduction analysis
  const reports = analyzeReduction(doc, activeProfiles);
  const reportMap = new Map<string, ReductionReport>();
  for (const r of reports) reportMap.set(r.profileId, r);

  // Build shape name lookup
  const shapeNameMap = new Map<string, string>();
  for (const s of doc.shapes) shapeNameMap.set(s.id, s.name || s.id.slice(0, 8));

  // Build group name lookup
  const groupNameMap = new Map<string, string>();
  for (const g of doc.groups) groupNameMap.set(g.id, g.name);

  // Visible shapes only
  const visibleShapes = doc.shapes.filter((s) => s.visible);

  // Per-shape summaries
  const shapes: CopilotShapeSummary[] = visibleShapes.map((shape) => {
    const area = estimateShapeArea(shape, doc.artboardWidth, doc.artboardHeight);
    const collapseByProfile: Record<string, boolean> = {};
    for (const profile of activeProfiles) {
      collapseByProfile[profile.id] = wouldShapeCollapse(
        shape,
        doc.artboardWidth,
        doc.artboardHeight,
        profile.targetWidth,
        profile.targetHeight,
      );
    }
    return {
      id: shape.id,
      name: shape.name || shape.id.slice(0, 8),
      kind: shape.geometry.kind,
      areaEstimate: Math.round(area),
      areaPct: artboardArea > 0 ? Math.round((area / artboardArea) * 1000) / 10 : 0,
      fillHex: shape.fill ? rgbaToHex(shape.fill) : null,
      hasStroke: shape.stroke !== null,
      survivalHint: shape.reduction.survivalHint ?? null,
      cueTag: shape.reduction.cueTag ?? null,
      dropPriority: shape.reduction.dropPriority ?? 0,
      collapseByProfile,
      notes: shape.reduction.notes ?? null,
      groupName: shape.groupId ? (groupNameMap.get(shape.groupId) ?? null) : null,
    };
  });

  // Per-profile summaries
  const profiles: CopilotProfileSummary[] = activeProfiles.map((profile) => {
    const report = reportMap.get(profile.id);
    if (!report) {
      return {
        profileId: profile.id,
        name: profile.name,
        targetWidth: profile.targetWidth,
        targetHeight: profile.targetHeight,
        fillPercent: 0,
        survivedCount: 0,
        collapsedCount: 0,
        collapsedNames: [],
        criticalLosses: [],
        silhouetteCoverage: 0,
        silhouetteAspect: 1,
      };
    }

    const collapsedNames = report.collapsedShapeIds.map(
      (id) => shapeNameMap.get(id) ?? id.slice(0, 8),
    );

    // Find must-survive shapes that collapsed
    const criticalLosses = report.collapsedShapeIds
      .filter((id) => {
        const shape = doc.shapes.find((s) => s.id === id);
        return shape?.reduction.survivalHint === 'must-survive';
      })
      .map((id) => shapeNameMap.get(id) ?? id.slice(0, 8));

    const targetArea = report.targetWidth * report.targetHeight;
    const silhouetteArea = report.silhouetteBounds.w * report.silhouetteBounds.h;

    return {
      profileId: profile.id,
      name: profile.name,
      targetWidth: report.targetWidth,
      targetHeight: report.targetHeight,
      fillPercent: Math.round(report.fillPercent * 10) / 10,
      survivedCount: report.survivedShapeIds.length,
      collapsedCount: report.collapsedShapeIds.length,
      collapsedNames,
      criticalLosses,
      silhouetteCoverage: targetArea > 0 ? Math.round((silhouetteArea / targetArea) * 1000) / 10 : 0,
      silhouetteAspect: report.silhouetteBounds.h > 0
        ? Math.round((report.silhouetteBounds.w / report.silhouetteBounds.h) * 100) / 100
        : 1,
    };
  });

  // Find strongest/weakest profiles
  // Score: high fill% with zero critical losses is strongest
  const profileScores = profiles.map((p) => ({
    id: p.profileId,
    score: p.fillPercent * (p.criticalLosses.length === 0 ? 1 : 0.3) * (1 - p.collapsedCount / Math.max(1, visibleShapes.length) * 0.5),
  }));
  profileScores.sort((a, b) => b.score - a.score);
  const strongestProfileId = profileScores.length > 0 ? profileScores[0].id : null;
  const weakestProfileId = profileScores.length > 0 ? profileScores[profileScores.length - 1].id : null;

  // At-risk shapes: survive at some profiles, collapse at others
  const atRiskShapeNames: string[] = [];
  const criticalRiskShapeNames: string[] = [];
  for (const shape of shapes) {
    const collapseValues = Object.values(shape.collapseByProfile);
    const someCollapse = collapseValues.some((v) => v);
    const someSurvive = collapseValues.some((v) => !v);
    if (someCollapse && someSurvive) {
      atRiskShapeNames.push(shape.name);
    }
    if (someCollapse && shape.survivalHint === 'must-survive') {
      criticalRiskShapeNames.push(shape.name);
    }
  }

  const hasReductionMetadata = visibleShapes.some(
    (s) => s.reduction.survivalHint || s.reduction.cueTag || (s.reduction.dropPriority && s.reduction.dropPriority > 0),
  );

  return {
    documentName: doc.name,
    artboardWidth: doc.artboardWidth,
    artboardHeight: doc.artboardHeight,
    totalShapes: doc.shapes.length,
    visibleShapes: visibleShapes.length,
    groupCount: doc.groups.length,
    shapes,
    profiles,
    strongestProfileId,
    weakestProfileId,
    atRiskShapeNames,
    criticalRiskShapeNames,
    hasReductionMetadata,
    capturedAt: new Date().toISOString(),
  };
}

/**
 * Rasterize the document at a given profile for vision AI input.
 *
 * Returns raw pixel buffer — the UI layer converts to canvas/PNG
 * for Ollama vision.
 */
export function captureCopilotRaster(
  doc: VectorMasterDocument,
  targetWidth: number,
  targetHeight: number,
): SpritePixelBuffer {
  return rasterizeVectorMaster(doc, targetWidth, targetHeight);
}
