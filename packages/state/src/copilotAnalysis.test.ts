import { describe, it, expect } from 'vitest';
import type { CopilotContext, CopilotShapeSummary, CopilotProfileSummary } from './copilotContext';
import {
  analyzeTopChanges,
  analyzeCollapse,
  analyzeProfileStrength,
  analyzeExaggeration,
  runFullAnalysis,
} from './copilotAnalysis';

// ── Helpers ──

function makeShape(overrides: Partial<CopilotShapeSummary> = {}): CopilotShapeSummary {
  return {
    id: overrides.id ?? 'shape-1',
    name: overrides.name ?? 'test-shape',
    kind: overrides.kind ?? 'rect',
    areaEstimate: overrides.areaEstimate ?? 10000,
    areaPct: overrides.areaPct ?? 4,
    fillHex: overrides.fillHex ?? '#646464',
    hasStroke: overrides.hasStroke ?? false,
    survivalHint: overrides.survivalHint ?? null,
    cueTag: overrides.cueTag ?? null,
    dropPriority: overrides.dropPriority ?? 0,
    collapseByProfile: overrides.collapseByProfile ?? {},
    notes: overrides.notes ?? null,
    groupName: overrides.groupName ?? null,
  };
}

function makeProfile(overrides: Partial<CopilotProfileSummary> = {}): CopilotProfileSummary {
  return {
    profileId: overrides.profileId ?? 'sp_32x32',
    name: overrides.name ?? '32×32 standard',
    targetWidth: overrides.targetWidth ?? 32,
    targetHeight: overrides.targetHeight ?? 32,
    fillPercent: overrides.fillPercent ?? 25,
    survivedCount: overrides.survivedCount ?? 3,
    collapsedCount: overrides.collapsedCount ?? 0,
    collapsedNames: overrides.collapsedNames ?? [],
    criticalLosses: overrides.criticalLosses ?? [],
    silhouetteCoverage: overrides.silhouetteCoverage ?? 40,
    silhouetteAspect: overrides.silhouetteAspect ?? 0.7,
  };
}

function makeCtx(overrides: Partial<CopilotContext> = {}): CopilotContext {
  return {
    documentName: 'Test',
    artboardWidth: 500,
    artboardHeight: 500,
    totalShapes: overrides.shapes?.length ?? 3,
    visibleShapes: overrides.shapes?.length ?? 3,
    groupCount: 0,
    shapes: overrides.shapes ?? [
      makeShape({ name: 'body', areaPct: 20 }),
      makeShape({ name: 'head', areaPct: 8 }),
      makeShape({ name: 'detail', areaPct: 2 }),
    ],
    profiles: overrides.profiles ?? [makeProfile()],
    strongestProfileId: overrides.strongestProfileId ?? 'sp_32x32',
    weakestProfileId: overrides.weakestProfileId ?? 'sp_16x16',
    atRiskShapeNames: overrides.atRiskShapeNames ?? [],
    criticalRiskShapeNames: overrides.criticalRiskShapeNames ?? [],
    hasReductionMetadata: overrides.hasReductionMetadata ?? false,
    capturedAt: '2026-01-01T00:00:00Z',
  };
}

// ── analyzeTopChanges ──

describe('analyzeTopChanges', () => {
  it('returns max 3 critiques', () => {
    const ctx = makeCtx({
      criticalRiskShapeNames: ['a', 'b', 'c', 'd'],
      shapes: [
        makeShape({ name: 'a', survivalHint: 'must-survive' }),
        makeShape({ name: 'b', survivalHint: 'must-survive' }),
        makeShape({ name: 'c', survivalHint: 'must-survive' }),
        makeShape({ name: 'd', survivalHint: 'must-survive' }),
      ],
    });
    const result = analyzeTopChanges(ctx);
    expect(result.critiques.length).toBeLessThanOrEqual(3);
  });

  it('flags critical losses as highest severity', () => {
    const ctx = makeCtx({
      criticalRiskShapeNames: ['hood'],
      shapes: [makeShape({ name: 'hood', survivalHint: 'must-survive' })],
    });
    const result = analyzeTopChanges(ctx);
    expect(result.critiques[0].severity).toBe('critical');
    expect(result.critiques[0].affectedShapes).toContain('hood');
  });

  it('warns about missing reduction metadata', () => {
    const ctx = makeCtx({
      hasReductionMetadata: false,
      shapes: [
        makeShape({ name: 'a' }),
        makeShape({ name: 'b' }),
        makeShape({ name: 'c' }),
      ],
    });
    const result = analyzeTopChanges(ctx);
    const metaCritique = result.critiques.find((c) => c.headline.includes('reduction metadata'));
    expect(metaCritique).toBeTruthy();
    expect(metaCritique!.severity).toBe('warning');
  });

  it('warns about at-risk shapes', () => {
    const ctx = makeCtx({
      atRiskShapeNames: ['cape'],
      shapes: [makeShape({ name: 'cape', areaPct: 3 })],
    });
    const result = analyzeTopChanges(ctx);
    const riskCritique = result.critiques.find((c) => c.affectedShapes.includes('cape'));
    expect(riskCritique).toBeTruthy();
    expect(riskCritique!.severity).toBe('warning');
  });

  it('warns about low fill percentage', () => {
    const ctx = makeCtx({
      profiles: [makeProfile({ profileId: 'sp_32x32', fillPercent: 5 })],
      strongestProfileId: 'sp_32x32',
    });
    const result = analyzeTopChanges(ctx);
    const fillCritique = result.critiques.find((c) => c.headline.includes('fill'));
    expect(fillCritique).toBeTruthy();
  });

  it('sorts critiques by severity', () => {
    const ctx = makeCtx({
      criticalRiskShapeNames: ['hood'],
      atRiskShapeNames: ['cape'],
      hasReductionMetadata: false,
      shapes: [
        makeShape({ name: 'hood', survivalHint: 'must-survive' }),
        makeShape({ name: 'cape' }),
        makeShape({ name: 'body' }),
      ],
    });
    const result = analyzeTopChanges(ctx);
    if (result.critiques.length >= 2) {
      const severityOrder = { critical: 0, warning: 1, info: 2 };
      for (let i = 1; i < result.critiques.length; i++) {
        expect(severityOrder[result.critiques[i].severity])
          .toBeGreaterThanOrEqual(severityOrder[result.critiques[i - 1].severity]);
      }
    }
  });
});

// ── analyzeCollapse ──

describe('analyzeCollapse', () => {
  it('identifies shapes that always collapse', () => {
    const ctx = makeCtx({
      shapes: [makeShape({
        name: 'tiny',
        collapseByProfile: { sp_16x16: true, sp_32x32: true, sp_64x64: true },
      })],
    });
    const result = analyzeCollapse(ctx);
    expect(result.alwaysDead).toContain('tiny');
  });

  it('identifies at-risk shapes', () => {
    const ctx = makeCtx({
      shapes: [makeShape({
        name: 'edge',
        collapseByProfile: { sp_16x16: true, sp_32x32: false, sp_64x64: false },
      })],
    });
    const result = analyzeCollapse(ctx);
    expect(result.atRisk).toContain('edge');
  });

  it('includes critical losses in summary', () => {
    const ctx = makeCtx({ criticalRiskShapeNames: ['hood'] });
    const result = analyzeCollapse(ctx);
    expect(result.criticalLosses).toContain('hood');
    expect(result.summary).toContain('CRITICAL');
  });

  it('reports all-clear when nothing collapses', () => {
    const ctx = makeCtx({
      criticalRiskShapeNames: [],
      shapes: [makeShape({
        name: 'safe',
        collapseByProfile: { sp_16x16: false, sp_32x32: false },
      })],
    });
    const result = analyzeCollapse(ctx);
    expect(result.alwaysDead.length).toBe(0);
    expect(result.atRisk.length).toBe(0);
    expect(result.summary).toContain('survive');
  });
});

// ── analyzeProfileStrength ──

describe('analyzeProfileStrength', () => {
  it('ranks profiles by score', () => {
    const ctx = makeCtx({
      profiles: [
        makeProfile({ profileId: 'sp_16x16', name: '16×16', fillPercent: 10, collapsedCount: 2 }),
        makeProfile({ profileId: 'sp_64x64', name: '64×64', fillPercent: 35, collapsedCount: 0 }),
      ],
    });
    const result = analyzeProfileStrength(ctx);
    expect(result.ranked[0].profileId).toBe('sp_64x64');
    expect(result.ranked[0].score).toBeGreaterThan(result.ranked[1].score);
  });

  it('penalizes critical losses heavily', () => {
    const ctx = makeCtx({
      profiles: [
        makeProfile({ profileId: 'a', name: 'A', fillPercent: 40, criticalLosses: ['hood'] }),
        makeProfile({ profileId: 'b', name: 'B', fillPercent: 20, criticalLosses: [] }),
      ],
    });
    const result = analyzeProfileStrength(ctx);
    // Despite higher fill%, profile A should score lower due to critical loss
    const aScore = result.ranked.find((r) => r.profileId === 'a')!.score;
    const bScore = result.ranked.find((r) => r.profileId === 'b')!.score;
    expect(bScore).toBeGreaterThan(aScore);
  });

  it('provides a summary', () => {
    const ctx = makeCtx({
      profiles: [
        makeProfile({ profileId: 'a', name: 'Small' }),
        makeProfile({ profileId: 'b', name: 'Large' }),
      ],
    });
    const result = analyzeProfileStrength(ctx);
    expect(result.summary).toBeTruthy();
    expect(result.summary.length).toBeGreaterThan(10);
  });

  it('handles single profile', () => {
    const ctx = makeCtx({ profiles: [makeProfile()] });
    const result = analyzeProfileStrength(ctx);
    expect(result.ranked.length).toBe(1);
    expect(result.summary).toContain('Only one profile');
  });

  it('handles no profiles', () => {
    const ctx = makeCtx({ profiles: [] });
    const result = analyzeProfileStrength(ctx);
    expect(result.ranked.length).toBe(0);
    expect(result.summary).toContain('No active');
  });
});

// ── analyzeExaggeration ──

describe('analyzeExaggeration', () => {
  it('recommends scaling up at-risk shapes', () => {
    const ctx = makeCtx({
      atRiskShapeNames: ['cape'],
      shapes: [makeShape({
        name: 'cape',
        collapseByProfile: { sp_16x16: true, sp_32x32: false },
      })],
      profiles: [
        makeProfile({ profileId: 'sp_16x16', name: '16×16' }),
        makeProfile({ profileId: 'sp_32x32', name: '32×32' }),
      ],
    });
    const result = analyzeExaggeration(ctx);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].shapeName).toBe('cape');
    expect(result.recommendations[0].action).toContain('Scale up');
  });

  it('recommends scaling up small must-survive shapes', () => {
    const ctx = makeCtx({
      atRiskShapeNames: [],
      shapes: [makeShape({
        name: 'gem',
        survivalHint: 'must-survive',
        areaPct: 1.5,
      })],
    });
    const result = analyzeExaggeration(ctx);
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations[0].shapeName).toBe('gem');
  });

  it('reports no recommendations when all shapes are comfortable', () => {
    const ctx = makeCtx({
      atRiskShapeNames: [],
      shapes: [makeShape({
        name: 'body',
        areaPct: 20,
        collapseByProfile: { sp_16x16: false, sp_32x32: false },
      })],
    });
    const result = analyzeExaggeration(ctx);
    expect(result.recommendations.length).toBe(0);
    expect(result.summary).toContain('No shapes need exaggeration');
  });
});

// ── runFullAnalysis ──

describe('runFullAnalysis', () => {
  it('returns all four analysis results', () => {
    const ctx = makeCtx();
    const bundle = runFullAnalysis(ctx);
    expect(bundle.topChanges).toBeTruthy();
    expect(bundle.collapse).toBeTruthy();
    expect(bundle.profileStrength).toBeTruthy();
    expect(bundle.exaggeration).toBeTruthy();
  });

  it('produces consistent results between individual and bundled calls', () => {
    const ctx = makeCtx({
      criticalRiskShapeNames: ['hood'],
      shapes: [makeShape({ name: 'hood', survivalHint: 'must-survive' })],
    });
    const bundle = runFullAnalysis(ctx);
    const standalone = analyzeTopChanges(ctx);
    expect(bundle.topChanges.critiques.length).toBe(standalone.critiques.length);
  });
});
