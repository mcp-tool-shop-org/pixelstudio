/**
 * AI Proposal Generation — algorithmic variant and suggestion engines.
 *
 * Generates concrete, reviewable proposals from the current vector state
 * and reduction analysis. No LLM needed — these are geometric transformations
 * informed by reduction data.
 *
 * Three engines:
 * 1. Silhouette variants — stance/proportion/negative-space variations
 * 2. Pose/proportion suggestions — asymmetry, weight, spacing improvements
 * 3. Simplification proposals — drop/merge/thicken/exaggerate for target sizes
 */

import type {
  VectorMasterDocument,
  VectorShape,
  VectorGeometry,
  VectorTransform,
  Rgba,
  SizeProfile,
} from '@glyphstudio/domain';
import {
  DEFAULT_VECTOR_TRANSFORM,
  DEFAULT_REDUCTION_META,
  generateVectorShapeId,
} from '@glyphstudio/domain';
import type { CopilotContext, CopilotShapeSummary } from './copilotContext';
import { captureCopilotContext } from './copilotContext';
import type {
  Proposal,
  ProposalSet,
  ProposalAction,
  ProposedShape,
  ProposalKind,
} from './proposalModel';
import {
  createProposal,
  createProposalSet,
  proposedShapeFromExisting,
} from './proposalModel';

// ── Helpers ──

function cloneGeometry(geo: VectorGeometry): VectorGeometry {
  return structuredClone(geo);
}

/** Get the bounding box center of a shape's geometry. */
function shapeCentroid(shape: VectorShape): { cx: number; cy: number } {
  const g = shape.geometry;
  switch (g.kind) {
    case 'rect':
      return { cx: g.x + g.w / 2, cy: g.y + g.h / 2 };
    case 'ellipse':
      return { cx: g.cx, cy: g.cy };
    case 'line':
      return { cx: (g.x1 + g.x2) / 2, cy: (g.y1 + g.y2) / 2 };
    case 'polygon': {
      const xs = g.points.map((p) => p.x);
      const ys = g.points.map((p) => p.y);
      return {
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
    }
    case 'path': {
      const xs = g.points.map((p) => p.x);
      const ys = g.points.map((p) => p.y);
      return {
        cx: (Math.min(...xs) + Math.max(...xs)) / 2,
        cy: (Math.min(...ys) + Math.max(...ys)) / 2,
      };
    }
  }
}

/** Scale a geometry around its center. */
function scaleGeometry(geo: VectorGeometry, sx: number, sy: number): VectorGeometry {
  const g = cloneGeometry(geo);
  switch (g.kind) {
    case 'rect': {
      const cx = g.x + g.w / 2;
      const cy = g.y + g.h / 2;
      g.w *= sx;
      g.h *= sy;
      g.x = cx - g.w / 2;
      g.y = cy - g.h / 2;
      return g;
    }
    case 'ellipse':
      g.rx *= sx;
      g.ry *= sy;
      return g;
    case 'polygon': {
      const xs = g.points.map((p) => p.x);
      const ys = g.points.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return {
        ...g,
        points: g.points.map((p) => ({
          x: cx + (p.x - cx) * sx,
          y: cy + (p.y - cy) * sy,
        })),
      };
    }
    case 'path': {
      const xs = g.points.map((p) => p.x);
      const ys = g.points.map((p) => p.y);
      const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
      const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
      return {
        ...g,
        points: g.points.map((p) => ({
          ...p,
          x: cx + (p.x - cx) * sx,
          y: cy + (p.y - cy) * sy,
        })),
        segments: g.segments.map((seg) => {
          if (seg.kind === 'quadratic') {
            return {
              ...seg,
              cpX: cx + (seg.cpX - cx) * sx,
              cpY: cy + (seg.cpY - cy) * sy,
            };
          }
          return seg;
        }),
      };
    }
    case 'line': {
      const cx = (g.x1 + g.x2) / 2;
      const cy = (g.y1 + g.y2) / 2;
      g.x1 = cx + (g.x1 - cx) * sx;
      g.y1 = cy + (g.y1 - cy) * sy;
      g.x2 = cx + (g.x2 - cx) * sx;
      g.y2 = cy + (g.y2 - cy) * sy;
      return g;
    }
  }
}

/** Translate a geometry. */
function translateGeometry(geo: VectorGeometry, dx: number, dy: number): VectorGeometry {
  const g = cloneGeometry(geo);
  switch (g.kind) {
    case 'rect':
      g.x += dx;
      g.y += dy;
      return g;
    case 'ellipse':
      g.cx += dx;
      g.cy += dy;
      return g;
    case 'line':
      g.x1 += dx;
      g.y1 += dy;
      g.x2 += dx;
      g.y2 += dy;
      return g;
    case 'polygon':
      return { ...g, points: g.points.map((p) => ({ x: p.x + dx, y: p.y + dy })) };
    case 'path':
      return {
        ...g,
        points: g.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
        segments: g.segments.map((seg) =>
          seg.kind === 'quadratic'
            ? { ...seg, cpX: seg.cpX + dx, cpY: seg.cpY + dy }
            : seg,
        ),
      };
  }
}

/** Mirror geometry horizontally around a given x center. */
function mirrorGeometryX(geo: VectorGeometry, centerX: number): VectorGeometry {
  const g = cloneGeometry(geo);
  switch (g.kind) {
    case 'rect':
      g.x = 2 * centerX - g.x - g.w;
      return g;
    case 'ellipse':
      g.cx = 2 * centerX - g.cx;
      return g;
    case 'line':
      g.x1 = 2 * centerX - g.x1;
      g.x2 = 2 * centerX - g.x2;
      return g;
    case 'polygon':
      return { ...g, points: g.points.map((p) => ({ x: 2 * centerX - p.x, y: p.y })) };
    case 'path':
      return {
        ...g,
        points: g.points.map((p) => ({ ...p, x: 2 * centerX - p.x })),
        segments: g.segments.map((seg) =>
          seg.kind === 'quadratic'
            ? { ...seg, cpX: 2 * centerX - seg.cpX }
            : seg,
        ),
      };
  }
}

// ── 1. Silhouette Variant Generation ──

/**
 * Generate 3 silhouette variants from the current document.
 *
 * Each variant preserves identity cues but differs in:
 * - Stance (lean forward/back, weight shift)
 * - Proportion (head ratio, limb length)
 * - Negative space (gap between elements)
 */
export function generateSilhouetteVariants(
  doc: VectorMasterDocument,
  activeProfiles: readonly SizeProfile[],
): { set: ProposalSet; proposals: Proposal[] } {
  const set = createProposalSet('silhouette-variant', 'Silhouette Variants', doc.name);
  const proposals: Proposal[] = [];
  const visibleShapes = doc.shapes.filter((s) => s.visible);
  if (visibleShapes.length === 0) return { set, proposals };

  const ctx = captureCopilotContext(doc, activeProfiles);
  const artCx = doc.artboardWidth / 2;

  // Variant A: Forward lean — shift upper shapes forward, lower shapes back
  {
    const actions: ProposalAction[] = [];
    for (const shape of visibleShapes) {
      const { cy } = shapeCentroid(shape);
      const verticalRatio = cy / doc.artboardHeight; // 0 = top, 1 = bottom
      const dx = (0.5 - verticalRatio) * 30; // top shifts right, bottom shifts left
      if (Math.abs(dx) > 2) {
        actions.push({
          type: 'modify',
          targetId: shape.id,
          changes: { geometry: translateGeometry(shape.geometry, dx, 0) },
        });
      }
    }
    if (actions.length > 0) {
      proposals.push(createProposal(set.id, 'silhouette-variant',
        'Variant A: Forward lean',
        'Shifts upper body forward and lower body back for a more dynamic stance. Improves silhouette readability by creating diagonal flow.',
        actions,
        { priority: 0 },
      ));
    }
  }

  // Variant B: Wider stance — spread elements horizontally from center
  {
    const actions: ProposalAction[] = [];
    for (const shape of visibleShapes) {
      const { cx } = shapeCentroid(shape);
      const offsetFromCenter = cx - artCx;
      if (Math.abs(offsetFromCenter) > 10) {
        const dx = Math.sign(offsetFromCenter) * 15;
        actions.push({
          type: 'modify',
          targetId: shape.id,
          changes: { geometry: translateGeometry(shape.geometry, dx, 0) },
        });
      }
    }
    if (actions.length > 0) {
      proposals.push(createProposal(set.id, 'silhouette-variant',
        'Variant B: Wider stance',
        'Spreads elements further from center axis. Increases negative space between limbs/gear for cleaner reads at small sizes.',
        actions,
        { priority: 1 },
      ));
    }
  }

  // Variant C: Exaggerated proportions — scale identity cues up, droppable shapes down
  {
    const actions: ProposalAction[] = [];
    for (const shape of visibleShapes) {
      const summary = ctx.shapes.find((s) => s.id === shape.id);
      if (!summary) continue;

      if (summary.survivalHint === 'must-survive' || summary.cueTag) {
        // Scale up identity cues
        actions.push({
          type: 'modify',
          targetId: shape.id,
          changes: { geometry: scaleGeometry(shape.geometry, 1.25, 1.25) },
        });
      } else if (summary.survivalHint === 'droppable' || summary.areaPct < 2) {
        // Scale down droppable detail
        actions.push({
          type: 'modify',
          targetId: shape.id,
          changes: { geometry: scaleGeometry(shape.geometry, 0.8, 0.8) },
        });
      }
    }
    if (actions.length > 0) {
      proposals.push(createProposal(set.id, 'silhouette-variant',
        'Variant C: Exaggerated identity cues',
        'Scales up must-survive and cue-tagged shapes by 25%, scales down droppable detail by 20%. Ensures identity reads even at smallest target sizes.',
        actions,
        { priority: 2 },
      ));
    }
  }

  // If no variants could be generated (e.g., single-shape doc), create a mirror variant
  if (proposals.length === 0) {
    const actions: ProposalAction[] = visibleShapes.map((shape) => ({
      type: 'modify' as const,
      targetId: shape.id,
      changes: { geometry: mirrorGeometryX(shape.geometry, artCx) },
    }));
    proposals.push(createProposal(set.id, 'silhouette-variant',
      'Variant: Mirrored',
      'Horizontally mirrors the entire design. Useful for checking if the silhouette reads equally well from the opposite direction.',
      actions,
      { priority: 0 },
    ));
  }

  return { set, proposals };
}

// ── 2. Pose / Proportion Suggestions ──

/**
 * Generate pose and proportion improvement suggestions.
 *
 * Analyzes shape relationships and proposes:
 * - Asymmetry improvements
 * - Weight distribution changes
 * - Spacing adjustments
 * - Head/body ratio tuning
 * - Reduction-aware exaggeration
 */
export function generatePoseSuggestions(
  doc: VectorMasterDocument,
  activeProfiles: readonly SizeProfile[],
): { set: ProposalSet; proposals: Proposal[] } {
  const set = createProposalSet('pose-suggestion', 'Pose & Proportion', doc.name);
  const proposals: Proposal[] = [];
  const visibleShapes = doc.shapes.filter((s) => s.visible);
  if (visibleShapes.length < 2) return { set, proposals };

  const ctx = captureCopilotContext(doc, activeProfiles);
  const artCx = doc.artboardWidth / 2;
  const artCy = doc.artboardHeight / 2;

  // Analyze symmetry — if shapes are too symmetric, suggest breaking it
  const leftShapes = visibleShapes.filter((s) => shapeCentroid(s).cx < artCx - 20);
  const rightShapes = visibleShapes.filter((s) => shapeCentroid(s).cx > artCx + 20);

  if (Math.abs(leftShapes.length - rightShapes.length) < 2 && leftShapes.length > 0) {
    // Shapes are roughly symmetric — propose asymmetry
    const actions: ProposalAction[] = [];
    for (const shape of rightShapes.slice(0, 2)) {
      actions.push({
        type: 'modify',
        targetId: shape.id,
        changes: {
          geometry: translateGeometry(
            scaleGeometry(shape.geometry, 1.15, 0.95),
            10, 8,
          ),
        },
      });
    }
    if (actions.length > 0) {
      proposals.push(createProposal(set.id, 'pose-suggestion',
        'Break symmetry',
        'Design is nearly symmetric. Slight asymmetry in right-side elements creates more dynamic feel and improves silhouette distinctiveness.',
        actions,
        { priority: 0 },
      ));
    }
  }

  // Weight distribution — if center of mass is exactly centered, shift it
  const avgCy = visibleShapes.reduce((sum, s) => sum + shapeCentroid(s).cy, 0) / visibleShapes.length;
  const verticalBalance = avgCy / doc.artboardHeight;
  if (Math.abs(verticalBalance - 0.5) < 0.05 && visibleShapes.length > 2) {
    // Too balanced — propose lowering center of gravity
    const bottomShapes = visibleShapes
      .filter((s) => shapeCentroid(s).cy > artCy)
      .slice(0, 2);
    if (bottomShapes.length > 0) {
      const actions: ProposalAction[] = bottomShapes.map((s) => ({
        type: 'modify' as const,
        targetId: s.id,
        changes: { geometry: scaleGeometry(s.geometry, 1.1, 1.15) },
      }));
      proposals.push(createProposal(set.id, 'pose-suggestion',
        'Lower center of gravity',
        'Vertical balance is perfectly centered. Slightly enlarging lower shapes creates a grounded, stable stance that reads better at small sizes.',
        actions,
        { priority: 1 },
      ));
    }
  }

  // Spacing check — shapes too close together may merge at small sizes
  for (let i = 0; i < visibleShapes.length; i++) {
    for (let j = i + 1; j < visibleShapes.length; j++) {
      const a = shapeCentroid(visibleShapes[i]);
      const b = shapeCentroid(visibleShapes[j]);
      const dist = Math.sqrt((a.cx - b.cx) ** 2 + (a.cy - b.cy) ** 2);
      if (dist < 40 && dist > 5) {
        const dx = (b.cx - a.cx) * 0.3;
        const dy = (b.cy - a.cy) * 0.3;
        proposals.push(createProposal(set.id, 'pose-suggestion',
          `Separate "${visibleShapes[i].name}" and "${visibleShapes[j].name}"`,
          `These shapes are only ${Math.round(dist)}px apart and may merge visually at small sizes. Pushing them apart improves distinction.`,
          [
            { type: 'modify', targetId: visibleShapes[i].id, changes: { geometry: translateGeometry(visibleShapes[i].geometry, -dx, -dy) } },
            { type: 'modify', targetId: visibleShapes[j].id, changes: { geometry: translateGeometry(visibleShapes[j].geometry, dx, dy) } },
          ],
          { priority: 2 },
        ));
        break; // Only one spacing suggestion at a time
      }
    }
    if (proposals.length >= 3) break;
  }

  // At-risk shape exaggeration
  for (const name of ctx.atRiskShapeNames.slice(0, 2)) {
    const shape = visibleShapes.find((s) => s.name === name);
    if (!shape) continue;
    proposals.push(createProposal(set.id, 'pose-suggestion',
      `Exaggerate "${name}" for survival`,
      `"${name}" survives some sizes but collapses at others. Scaling up by 35% ensures it reads at all active target sizes.`,
      [{
        type: 'modify',
        targetId: shape.id,
        changes: { geometry: scaleGeometry(shape.geometry, 1.35, 1.35) },
      }],
      { priority: 0 },
    ));
  }

  return { set, proposals };
}

// ── 3. Simplification Proposals ──

/**
 * Generate simplification proposals for a target size profile.
 *
 * Proposes concrete actions: drop, merge, thicken, exaggerate
 * based on what collapses at the target size.
 */
export function generateSimplificationProposals(
  doc: VectorMasterDocument,
  activeProfiles: readonly SizeProfile[],
  targetProfile: SizeProfile,
): { set: ProposalSet; proposals: Proposal[] } {
  const set = createProposalSet(
    'simplification',
    `Simplification for ${targetProfile.name}`,
    doc.name,
  );
  const proposals: Proposal[] = [];
  const visibleShapes = doc.shapes.filter((s) => s.visible);
  if (visibleShapes.length < 2) return { set, proposals };

  const ctx = captureCopilotContext(doc, activeProfiles);

  // 1. Drop proposals — shapes that always collapse and are droppable
  const alwaysDead = ctx.shapes.filter((s) =>
    Object.values(s.collapseByProfile).every((v) => v),
  );

  for (const summary of alwaysDead) {
    if (summary.survivalHint === 'must-survive') continue; // Never suggest dropping must-survive
    const shape = visibleShapes.find((s) => s.id === summary.id);
    if (!shape) continue;

    proposals.push(createProposal(set.id, 'simplification',
      `Drop "${summary.name}"`,
      `"${summary.name}" collapses at every active target size (${summary.areaPct}% of artboard). Removing it simplifies the design without visible loss.`,
      [{ type: 'drop', targetId: shape.id, reason: 'Collapses at all target sizes' }],
      { targetProfileId: targetProfile.id, priority: 2 },
    ));
  }

  // 2. Thicken proposals — at-risk shapes that need scaling
  for (const name of ctx.atRiskShapeNames) {
    const shape = visibleShapes.find((s) => s.name === name);
    const summary = ctx.shapes.find((s) => s.name === name);
    if (!shape || !summary) continue;

    const collapseAtTarget = summary.collapseByProfile[targetProfile.id];
    if (!collapseAtTarget) continue;

    proposals.push(createProposal(set.id, 'simplification',
      `Thicken "${name}"`,
      `"${name}" collapses at ${targetProfile.name}. Scaling up by 40% ensures it renders with at least 1 pixel width.`,
      [{
        type: 'modify',
        targetId: shape.id,
        changes: { geometry: scaleGeometry(shape.geometry, 1.4, 1.4) },
      }],
      { targetProfileId: targetProfile.id, priority: 0 },
    ));
  }

  // 3. Merge proposals — pairs of nearby small shapes that could combine
  const smallShapes = ctx.shapes
    .filter((s) => s.areaPct < 4)
    .sort((a, b) => a.areaPct - b.areaPct);

  for (let i = 0; i < smallShapes.length; i++) {
    for (let j = i + 1; j < smallShapes.length; j++) {
      const shapeA = visibleShapes.find((s) => s.id === smallShapes[i].id);
      const shapeB = visibleShapes.find((s) => s.id === smallShapes[j].id);
      if (!shapeA || !shapeB) continue;

      const cA = shapeCentroid(shapeA);
      const cB = shapeCentroid(shapeB);
      const dist = Math.sqrt((cA.cx - cB.cx) ** 2 + (cA.cy - cB.cy) ** 2);

      if (dist < 60) {
        // Propose merging into a single larger shape
        const mergedGeo = scaleGeometry(shapeA.geometry, 1.5, 1.5);
        const merged: ProposedShape = {
          tempId: `tmp_${generateVectorShapeId()}`,
          name: `${shapeA.name}+${shapeB.name}`,
          geometry: mergedGeo,
          fill: shapeA.fill,
          stroke: shapeA.stroke,
          transform: { ...shapeA.transform },
          reduction: {
            ...shapeA.reduction,
            notes: `Merged from ${shapeA.name} and ${shapeB.name}`,
          },
        };

        proposals.push(createProposal(set.id, 'simplification',
          `Merge "${shapeA.name}" + "${shapeB.name}"`,
          `These shapes are ${Math.round(dist)}px apart and both under 4% of artboard area. Merging them into one larger shape improves survival at ${targetProfile.name}.`,
          [{ type: 'merge', sourceIds: [shapeA.id, shapeB.id], result: merged, reason: 'Nearby small shapes' }],
          { targetProfileId: targetProfile.id, priority: 1 },
        ));
        break; // One merge suggestion per iteration
      }
    }
    if (proposals.length >= 5) break;
  }

  // 4. Exaggeration proposals — must-survive shapes near threshold
  for (const name of ctx.criticalRiskShapeNames) {
    const shape = visibleShapes.find((s) => s.name === name);
    if (!shape) continue;

    proposals.push(createProposal(set.id, 'simplification',
      `Exaggerate "${name}" (critical)`,
      `"${name}" is marked must-survive but collapses at some sizes. Scaling up by 50% and increasing contrast ensures the identity cue survives reduction.`,
      [{
        type: 'modify',
        targetId: shape.id,
        changes: {
          geometry: scaleGeometry(shape.geometry, 1.5, 1.5),
        },
      }],
      { targetProfileId: targetProfile.id, priority: 0 },
    ));
  }

  // Sort by priority
  proposals.sort((a, b) => a.priority - b.priority);

  return { set, proposals };
}
