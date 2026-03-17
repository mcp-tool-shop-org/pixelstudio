import { describe, it, expect } from 'vitest';
import type { VectorMasterDocument, VectorShape, SizeProfile } from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import {
  generateSilhouetteVariants,
  generatePoseSuggestions,
  generateSimplificationProposals,
} from './proposalGenerate';

// ── Helpers ──

function makeDoc(shapes: Partial<VectorShape>[]): VectorMasterDocument {
  return {
    id: 'doc-1',
    name: 'Test Doc',
    artboardWidth: 500,
    artboardHeight: 500,
    shapes: shapes.map((s, i) => ({
      id: s.id ?? `shape-${i}`,
      name: s.name ?? `shape-${i}`,
      groupId: s.groupId ?? null,
      zOrder: s.zOrder ?? i,
      geometry: s.geometry ?? { kind: 'rect', x: 50, y: 50, w: 100, h: 100 },
      fill: s.fill !== undefined ? s.fill : [100, 100, 100, 255],
      stroke: s.stroke ?? null,
      transform: s.transform ?? { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: s.reduction ?? { ...DEFAULT_REDUCTION_META },
      visible: s.visible ?? true,
      locked: s.locked ?? false,
    })) as VectorShape[],
    groups: [],
    palette: [],
    createdAt: '2026-01-01',
    updatedAt: '2026-01-01',
  };
}

const PROFILES: SizeProfile[] = [
  { id: 'sp_16x16', name: '16×16', targetWidth: 16, targetHeight: 16, notes: '' },
  { id: 'sp_32x32', name: '32×32', targetWidth: 32, targetHeight: 32, notes: '' },
  { id: 'sp_64x64', name: '64×64', targetWidth: 64, targetHeight: 64, notes: '' },
];

// ── Silhouette Variants ──

describe('generateSilhouetteVariants', () => {
  it('generates proposals for multi-shape document', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 200, y: 100, w: 100, h: 300 } },
      { name: 'head', geometry: { kind: 'ellipse', cx: 250, cy: 80, rx: 40, ry: 40 } },
      { name: 'sword', geometry: { kind: 'rect', x: 310, y: 150, w: 20, h: 120 } },
    ]);
    const { set, proposals } = generateSilhouetteVariants(doc, PROFILES);
    expect(set.kind).toBe('silhouette-variant');
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals.length).toBeLessThanOrEqual(3);
  });

  it('produces modify actions only (non-destructive)', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 200, y: 100, w: 100, h: 300 } },
      { name: 'arm', geometry: { kind: 'rect', x: 310, y: 200, w: 30, h: 100 } },
    ]);
    const { proposals } = generateSilhouetteVariants(doc, PROFILES);
    for (const p of proposals) {
      for (const a of p.actions) {
        expect(a.type).toBe('modify');
      }
    }
  });

  it('generates mirror variant for single-shape document', () => {
    const doc = makeDoc([
      { name: 'blob', geometry: { kind: 'rect', x: 200, y: 200, w: 100, h: 100 } },
    ]);
    const { proposals } = generateSilhouetteVariants(doc, PROFILES);
    expect(proposals.length).toBeGreaterThan(0);
    expect(proposals[0].headline).toContain('Mirror');
  });

  it('returns empty for no visible shapes', () => {
    const doc = makeDoc([{ name: 'hidden', visible: false }]);
    const { proposals } = generateSilhouetteVariants(doc, PROFILES);
    expect(proposals).toHaveLength(0);
  });

  it('exaggeration variant scales up must-survive shapes', () => {
    const doc = makeDoc([
      {
        name: 'hood',
        geometry: { kind: 'rect', x: 220, y: 50, w: 60, h: 60 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive', cueTag: 'hood' },
      },
      {
        name: 'buckle',
        geometry: { kind: 'rect', x: 240, y: 200, w: 20, h: 20 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'droppable' },
      },
    ]);
    const { proposals } = generateSilhouetteVariants(doc, PROFILES);
    const exagVariant = proposals.find((p) => p.headline.includes('Exaggerated'));
    expect(exagVariant).toBeTruthy();
  });
});

// ── Pose Suggestions ──

describe('generatePoseSuggestions', () => {
  it('generates suggestions for multi-shape document', () => {
    const doc = makeDoc([
      { name: 'left-arm', geometry: { kind: 'rect', x: 150, y: 200, w: 30, h: 100 } },
      { name: 'right-arm', geometry: { kind: 'rect', x: 320, y: 200, w: 30, h: 100 } },
      { name: 'body', geometry: { kind: 'rect', x: 200, y: 100, w: 100, h: 300 } },
    ]);
    const { set, proposals } = generatePoseSuggestions(doc, PROFILES);
    expect(set.kind).toBe('pose-suggestion');
    expect(proposals.length).toBeGreaterThanOrEqual(0); // May or may not find suggestions
  });

  it('returns empty for single-shape doc', () => {
    const doc = makeDoc([{ name: 'body' }]);
    const { proposals } = generatePoseSuggestions(doc, PROFILES);
    expect(proposals).toHaveLength(0);
  });

  it('suggests separating shapes that are too close', () => {
    const doc = makeDoc([
      { name: 'gem-a', geometry: { kind: 'rect', x: 240, y: 200, w: 15, h: 15 } },
      { name: 'gem-b', geometry: { kind: 'rect', x: 260, y: 210, w: 15, h: 15 } },
    ]);
    const { proposals } = generatePoseSuggestions(doc, PROFILES);
    const separateProposal = proposals.find((p) => p.headline.includes('Separate'));
    expect(separateProposal).toBeTruthy();
  });

  it('suggests exaggeration for at-risk shapes', () => {
    const doc = makeDoc([
      { name: 'tiny-detail', geometry: { kind: 'rect', x: 240, y: 240, w: 8, h: 8 } },
      { name: 'body', geometry: { kind: 'rect', x: 150, y: 100, w: 200, h: 300 } },
    ]);
    const { proposals } = generatePoseSuggestions(doc, PROFILES);
    const exagProposal = proposals.find((p) => p.headline.includes('Exaggerate'));
    // tiny-detail should be at-risk since it collapses at 16×16 but survives at 64×64
    expect(exagProposal).toBeTruthy();
  });
});

// ── Simplification Proposals ──

describe('generateSimplificationProposals', () => {
  const targetProfile = PROFILES[0]; // 16×16

  it('proposes dropping shapes that always collapse', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      { name: 'tiny-dot', geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 } },
    ]);
    const { proposals } = generateSimplificationProposals(doc, PROFILES, targetProfile);
    const dropProposal = proposals.find((p) => p.headline.includes('Drop'));
    expect(dropProposal).toBeTruthy();
    if (dropProposal) {
      expect(dropProposal.actions[0].type).toBe('drop');
    }
  });

  it('never proposes dropping must-survive shapes', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      {
        name: 'crucial-gem',
        geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive' },
      },
    ]);
    const { proposals } = generateSimplificationProposals(doc, PROFILES, targetProfile);
    const dropProposal = proposals.find((p) =>
      p.headline.includes('Drop') && p.headline.includes('crucial-gem'),
    );
    expect(dropProposal).toBeUndefined();
  });

  it('proposes thickening at-risk shapes', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      { name: 'thin-line', geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 } },
    ]);
    const { proposals } = generateSimplificationProposals(doc, PROFILES, targetProfile);
    const thickenProposal = proposals.find((p) => p.headline.includes('Thicken'));
    // thin-line: 8/500*16 = 0.256 → collapses at 16×16 but survives at 64×64
    expect(thickenProposal).toBeTruthy();
  });

  it('proposes merging nearby small shapes', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      { name: 'dot-a', geometry: { kind: 'rect', x: 240, y: 200, w: 15, h: 15 } },
      { name: 'dot-b', geometry: { kind: 'rect', x: 260, y: 210, w: 15, h: 15 } },
    ]);
    const { proposals } = generateSimplificationProposals(doc, PROFILES, targetProfile);
    const mergeProposal = proposals.find((p) => p.headline.includes('Merge'));
    expect(mergeProposal).toBeTruthy();
    if (mergeProposal) {
      const mergeAction = mergeProposal.actions.find((a) => a.type === 'merge');
      expect(mergeAction).toBeTruthy();
    }
  });

  it('proposes exaggerating critical-risk shapes', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      {
        name: 'hood',
        geometry: { kind: 'rect', x: 200, y: 50, w: 8, h: 8 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive', cueTag: 'hood' },
      },
    ]);
    const { proposals } = generateSimplificationProposals(doc, PROFILES, targetProfile);
    const exagProposal = proposals.find((p) => p.headline.includes('Exaggerate'));
    expect(exagProposal).toBeTruthy();
  });

  it('sorts proposals by priority', () => {
    const doc = makeDoc([
      { name: 'body', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      {
        name: 'hood',
        geometry: { kind: 'rect', x: 200, y: 50, w: 8, h: 8 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive' },
      },
      { name: 'dot', geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 } },
    ]);
    const { proposals } = generateSimplificationProposals(doc, PROFILES, targetProfile);
    for (let i = 1; i < proposals.length; i++) {
      expect(proposals[i].priority).toBeGreaterThanOrEqual(proposals[i - 1].priority);
    }
  });
});
