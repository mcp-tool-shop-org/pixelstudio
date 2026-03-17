/**
 * Collapse overlay — computes per-shape risk status for canvas rendering.
 *
 * Three risk levels:
 * - 'safe'       — shape survives at all active profiles
 * - 'at-risk'    — shape survives at some profiles but collapses at others
 * - 'collapses'  — shape collapses at the selected target profile
 *
 * The overlay also annotates droppable shapes so the canvas can dim them.
 */

import type { VectorMasterDocument, VectorShape, SizeProfile } from '@glyphstudio/domain';
import { wouldShapeCollapse } from './vectorRasterize';

export type ShapeRiskLevel = 'safe' | 'at-risk' | 'collapses';

export interface ShapeRiskInfo {
  shapeId: string;
  level: ShapeRiskLevel;
  /** True if reduction.survivalHint === 'droppable' */
  droppable: boolean;
  /** True if reduction.survivalHint === 'must-survive' */
  mustSurvive: boolean;
  /** Profile IDs where this shape collapses */
  collapsesAt: string[];
  /** Profile IDs where this shape survives */
  survivesAt: string[];
}

export interface CollapseOverlayData {
  /** Map from shape ID to risk info */
  shapes: Map<string, ShapeRiskInfo>;
  /** The target profile used for primary risk level */
  targetProfileId: string;
  /** Total counts */
  safeCount: number;
  atRiskCount: number;
  collapsesCount: number;
}

/**
 * Compute collapse overlay data for all visible shapes.
 *
 * @param doc - The vector master document
 * @param activeProfiles - All profiles to check against
 * @param targetProfile - The primary target profile (determines 'collapses' vs 'at-risk')
 */
export function computeCollapseOverlay(
  doc: VectorMasterDocument,
  activeProfiles: readonly SizeProfile[],
  targetProfile: SizeProfile,
): CollapseOverlayData {
  const shapes = new Map<string, ShapeRiskInfo>();
  let safeCount = 0;
  let atRiskCount = 0;
  let collapsesCount = 0;

  for (const shape of doc.shapes) {
    if (!shape.visible) continue;

    const collapsesAt: string[] = [];
    const survivesAt: string[] = [];

    for (const profile of activeProfiles) {
      if (wouldShapeCollapse(shape, doc.artboardWidth, doc.artboardHeight, profile.targetWidth, profile.targetHeight)) {
        collapsesAt.push(profile.id);
      } else {
        survivesAt.push(profile.id);
      }
    }

    const collapsesAtTarget = wouldShapeCollapse(
      shape, doc.artboardWidth, doc.artboardHeight,
      targetProfile.targetWidth, targetProfile.targetHeight,
    );

    let level: ShapeRiskLevel;
    if (collapsesAtTarget) {
      level = 'collapses';
      collapsesCount++;
    } else if (collapsesAt.length > 0) {
      level = 'at-risk';
      atRiskCount++;
    } else {
      level = 'safe';
      safeCount++;
    }

    shapes.set(shape.id, {
      shapeId: shape.id,
      level,
      droppable: shape.reduction.survivalHint === 'droppable',
      mustSurvive: shape.reduction.survivalHint === 'must-survive',
      collapsesAt,
      survivesAt,
    });
  }

  return {
    shapes,
    targetProfileId: targetProfile.id,
    safeCount,
    atRiskCount,
    collapsesCount,
  };
}
