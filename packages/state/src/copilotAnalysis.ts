/**
 * Visual Copilot — analysis engine.
 *
 * Answers the 5 core copilot questions from a CopilotContext snapshot.
 * Pure functions — no AI, no side effects, no network calls.
 *
 * The "what does this read as?" question requires Ollama vision
 * and is handled separately in copilotVision.ts.
 */

import type { CopilotContext, CopilotShapeSummary, CopilotProfileSummary } from './copilotContext';

// ── Response types ──

/** A single actionable critique item. */
export interface CopilotCritique {
  /** Short headline (e.g. "Hood shape too small"). */
  headline: string;
  /** Explanation of why this matters for reduction. */
  reason: string;
  /** Concrete suggestion (e.g. "Scale hood width by 1.5× before reduction"). */
  suggestion: string;
  /** Severity: critical = must fix, warning = should fix, info = optional. */
  severity: 'critical' | 'warning' | 'info';
  /** Shape name(s) this critique applies to, if specific. */
  affectedShapes: string[];
}

/** Response to "What 3 changes matter most?" */
export interface TopChangesResponse {
  critiques: CopilotCritique[];
}

/** Response to "What will die at current target size?" */
export interface CollapseResponse {
  /** Shapes that collapse at every active profile. */
  alwaysDead: string[];
  /** Shapes that collapse at some profiles but survive others. */
  atRisk: string[];
  /** Shapes marked must-survive that collapse somewhere. */
  criticalLosses: string[];
  /** Summary sentence. */
  summary: string;
}

/** A single profile strength assessment. */
export interface ProfileStrength {
  profileId: string;
  name: string;
  size: string;
  /** 0-100 readability score. */
  score: number;
  /** Why this score. */
  reason: string;
}

/** Response to "Which size profile reads strongest?" */
export interface ProfileComparisonResponse {
  ranked: ProfileStrength[];
  summary: string;
}

/** A single exaggeration recommendation. */
export interface ExaggerationRec {
  shapeName: string;
  /** What to exaggerate (scale, position, contrast). */
  action: string;
  /** Why — what happens without it. */
  reason: string;
}

/** Response to "What should be exaggerated before reduction?" */
export interface ExaggerationResponse {
  recommendations: ExaggerationRec[];
  summary: string;
}

// ── Analysis functions ──

/**
 * "What 3 changes matter most?"
 *
 * Analyzes the context for the highest-impact improvements.
 * Prioritizes: critical losses > at-risk shapes > missing metadata > composition.
 */
export function analyzeTopChanges(ctx: CopilotContext): TopChangesResponse {
  const critiques: CopilotCritique[] = [];

  // 1. Critical losses — must-survive shapes that collapse
  for (const name of ctx.criticalRiskShapeNames) {
    critiques.push({
      headline: `"${name}" marked must-survive but collapses`,
      reason: `This shape is tagged as essential for character identity but disappears at one or more target sizes.`,
      suggestion: `Scale up "${name}" or simplify its geometry so it survives reduction. Consider merging with adjacent shapes.`,
      severity: 'critical',
      affectedShapes: [name],
    });
  }

  // 2. At-risk shapes (not already covered by critical losses)
  for (const name of ctx.atRiskShapeNames) {
    if (ctx.criticalRiskShapeNames.includes(name)) continue;
    const shape = ctx.shapes.find((s) => s.name === name);
    if (!shape) continue;
    critiques.push({
      headline: `"${name}" survives some sizes but dies at others`,
      reason: `This shape is on the edge of visibility. Small changes in its size or position determine whether it reads.`,
      suggestion: `Increase "${name}" area by ~30% or merge with a neighboring shape to ensure it survives at all target sizes.`,
      severity: 'warning',
      affectedShapes: [name],
    });
  }

  // 3. Missing reduction metadata
  if (!ctx.hasReductionMetadata && ctx.visibleShapes > 2) {
    critiques.push({
      headline: 'No reduction metadata on any shape',
      reason: 'Without survival hints and cue tags, the copilot cannot distinguish identity-critical shapes from droppable detail.',
      suggestion: 'Tag your 2-3 most important shapes as "must-survive" with cue tags (e.g. "hood", "sword", "cape").',
      severity: 'warning',
      affectedShapes: [],
    });
  }

  // 4. Tiny shapes with no survival hint
  for (const shape of ctx.shapes) {
    if (shape.areaPct < 1 && !shape.survivalHint) {
      const allCollapse = Object.values(shape.collapseByProfile).every((v) => v);
      if (allCollapse && critiques.length < 6) {
        critiques.push({
          headline: `"${shape.name}" is tiny (${shape.areaPct}% of artboard) and always collapses`,
          reason: 'This shape takes up less than 1% of the artboard and vanishes at every target size.',
          suggestion: `Either scale up "${shape.name}", merge it into a larger shape, or mark it as "droppable" if it's intentional detail.`,
          severity: 'info',
          affectedShapes: [shape.name],
        });
      }
    }
  }

  // 5. Low fill percentage at the strongest profile
  const strongestProfile = ctx.profiles.find((p) => p.profileId === ctx.strongestProfileId);
  if (strongestProfile && strongestProfile.fillPercent < 15) {
    critiques.push({
      headline: `Low fill (${strongestProfile.fillPercent}%) even at ${strongestProfile.name}`,
      reason: 'The design uses less than 15% of the target canvas. At small sizes, the character will be hard to see.',
      suggestion: 'Scale up the overall design or add background/platform shapes to increase visual mass.',
      severity: 'warning',
      affectedShapes: [],
    });
  }

  // 6. Very similar fill colors between adjacent shapes
  const colorGroups = new Map<string, string[]>();
  for (const shape of ctx.shapes) {
    if (!shape.fillHex) continue;
    // Group by approximate color (round to nearest 32)
    const approx = shape.fillHex.replace(/#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i, (_, r, g, b) => {
      const rr = (Math.round(parseInt(r, 16) / 32) * 32).toString(16).padStart(2, '0');
      const gg = (Math.round(parseInt(g, 16) / 32) * 32).toString(16).padStart(2, '0');
      const bb = (Math.round(parseInt(b, 16) / 32) * 32).toString(16).padStart(2, '0');
      return `#${rr}${gg}${bb}`;
    });
    const existing = colorGroups.get(approx) ?? [];
    existing.push(shape.name);
    colorGroups.set(approx, existing);
  }
  for (const [, names] of colorGroups) {
    if (names.length >= 3 && critiques.length < 6) {
      critiques.push({
        headline: `${names.length} shapes share similar fill colors`,
        reason: 'At small sizes, shapes with similar colors merge visually and lose distinction.',
        suggestion: `Add color contrast between: ${names.join(', ')}. Even a 20% brightness shift helps.`,
        severity: 'info',
        affectedShapes: names,
      });
    }
  }

  // Sort by severity and return top 3
  const severityOrder = { critical: 0, warning: 1, info: 2 };
  critiques.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

  return { critiques: critiques.slice(0, 3) };
}

/**
 * "What will die at the current target size?"
 *
 * Reports which shapes collapse across active profiles.
 */
export function analyzeCollapse(ctx: CopilotContext): CollapseResponse {
  const alwaysDead: string[] = [];
  const atRisk: string[] = [];

  for (const shape of ctx.shapes) {
    const collapseValues = Object.values(shape.collapseByProfile);
    if (collapseValues.length === 0) continue;
    const allCollapse = collapseValues.every((v) => v);
    const someCollapse = collapseValues.some((v) => v);
    const someSurvive = collapseValues.some((v) => !v);

    if (allCollapse) {
      alwaysDead.push(shape.name);
    } else if (someCollapse && someSurvive) {
      atRisk.push(shape.name);
    }
  }

  const parts: string[] = [];
  if (alwaysDead.length > 0) {
    parts.push(`${alwaysDead.length} shape(s) collapse at every size: ${alwaysDead.join(', ')}`);
  }
  if (atRisk.length > 0) {
    parts.push(`${atRisk.length} shape(s) are at risk: ${atRisk.join(', ')}`);
  }
  if (ctx.criticalRiskShapeNames.length > 0) {
    parts.push(`CRITICAL: ${ctx.criticalRiskShapeNames.join(', ')} marked must-survive but collapse`);
  }
  if (parts.length === 0) {
    parts.push('All visible shapes survive at every active target size.');
  }

  return {
    alwaysDead,
    atRisk,
    criticalLosses: ctx.criticalRiskShapeNames,
    summary: parts.join('. ') + '.',
  };
}

/**
 * "Which size profile reads strongest?"
 *
 * Ranks active profiles by readability.
 */
export function analyzeProfileStrength(ctx: CopilotContext): ProfileComparisonResponse {
  const ranked: ProfileStrength[] = ctx.profiles.map((p) => {
    // Score components
    const fillScore = Math.min(p.fillPercent, 60) / 60 * 40; // 0-40 points for fill (capped at 60%)
    const survivalRatio = p.survivedCount / Math.max(1, ctx.visibleShapes);
    const survivalScore = survivalRatio * 30; // 0-30 points for shape survival
    const criticalPenalty = p.criticalLosses.length * 15; // -15 per critical loss
    const coverageScore = Math.min(p.silhouetteCoverage, 80) / 80 * 20; // 0-20 for silhouette coverage
    const aspectPenalty = Math.abs(p.silhouetteAspect - 0.6) > 0.8 ? 10 : 0; // penalize very wide/narrow

    const score = Math.max(0, Math.min(100, Math.round(
      fillScore + survivalScore + coverageScore - criticalPenalty - aspectPenalty,
    )));

    // Build reason
    const reasons: string[] = [];
    if (p.collapsedCount === 0) reasons.push('all shapes survive');
    else reasons.push(`${p.collapsedCount} shape(s) lost`);
    if (p.criticalLosses.length > 0) reasons.push(`${p.criticalLosses.length} critical loss(es)`);
    reasons.push(`${p.fillPercent}% fill`);

    return {
      profileId: p.profileId,
      name: p.name,
      size: `${p.targetWidth}×${p.targetHeight}`,
      score,
      reason: reasons.join(', '),
    };
  });

  ranked.sort((a, b) => b.score - a.score);

  const best = ranked[0];
  const worst = ranked[ranked.length - 1];
  let summary = '';
  if (ranked.length === 0) {
    summary = 'No active size profiles to compare.';
  } else if (ranked.length === 1) {
    summary = `Only one profile active: ${best.name} scores ${best.score}/100.`;
  } else {
    summary = `${best.name} reads strongest (${best.score}/100). ${worst.name} is weakest (${worst.score}/100).`;
  }

  return { ranked, summary };
}

/**
 * "What should be exaggerated before reduction?"
 *
 * Identifies shapes near the collapse threshold that would benefit
 * from scale/position exaggeration before rasterizing down.
 */
export function analyzeExaggeration(ctx: CopilotContext): ExaggerationResponse {
  const recommendations: ExaggerationRec[] = [];

  // 1. At-risk shapes — survive some, collapse others
  for (const name of ctx.atRiskShapeNames) {
    const shape = ctx.shapes.find((s) => s.name === name);
    if (!shape) continue;

    const survivingProfiles = Object.entries(shape.collapseByProfile)
      .filter(([, collapses]) => !collapses)
      .map(([pid]) => ctx.profiles.find((p) => p.profileId === pid)?.name ?? pid);
    const collapsingProfiles = Object.entries(shape.collapseByProfile)
      .filter(([, collapses]) => collapses)
      .map(([pid]) => ctx.profiles.find((p) => p.profileId === pid)?.name ?? pid);

    recommendations.push({
      shapeName: name,
      action: `Scale up by 30-50% to survive at ${collapsingProfiles.join(', ')}`,
      reason: `Currently survives at ${survivingProfiles.join(', ')} but collapses at ${collapsingProfiles.join(', ')}.`,
    });
  }

  // 2. Must-survive shapes that are small relative to artboard
  for (const shape of ctx.shapes) {
    if (shape.survivalHint !== 'must-survive') continue;
    if (ctx.atRiskShapeNames.includes(shape.name)) continue; // already covered
    if (shape.areaPct < 3) {
      recommendations.push({
        shapeName: shape.name,
        action: 'Scale up — identity cue is under 3% of artboard area',
        reason: `"${shape.name}" is marked must-survive but only covers ${shape.areaPct}% of the artboard. At small sizes this may become a single indistinct pixel.`,
      });
    }
  }

  // 3. Shapes that are very close together (could merge at small sizes)
  // Skipped for MVP — would need spatial data we don't have in the summary

  // 4. Low-contrast shapes (similar fill to many others)
  // Already handled by analyzeTopChanges color grouping

  let summary: string;
  if (recommendations.length === 0) {
    summary = 'No shapes need exaggeration — all survive comfortably at active target sizes.';
  } else {
    summary = `${recommendations.length} shape(s) should be exaggerated before reduction to maintain readability.`;
  }

  return { recommendations, summary };
}

/**
 * Run all analytical copilot questions at once.
 * Returns a unified response bundle.
 */
export interface CopilotAnalysisBundle {
  topChanges: TopChangesResponse;
  collapse: CollapseResponse;
  profileStrength: ProfileComparisonResponse;
  exaggeration: ExaggerationResponse;
}

export function runFullAnalysis(ctx: CopilotContext): CopilotAnalysisBundle {
  return {
    topChanges: analyzeTopChanges(ctx),
    collapse: analyzeCollapse(ctx),
    profileStrength: analyzeProfileStrength(ctx),
    exaggeration: analyzeExaggeration(ctx),
  };
}
