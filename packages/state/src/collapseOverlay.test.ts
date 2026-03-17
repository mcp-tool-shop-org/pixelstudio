import { describe, it, expect } from 'vitest';
import type { VectorMasterDocument, VectorShape, SizeProfile } from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import { computeCollapseOverlay } from './collapseOverlay';

function makeDoc(shapes: Partial<VectorShape>[]): VectorMasterDocument {
  return {
    id: 'doc-1',
    name: 'Test',
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
  { id: 'sp_16x16', name: '16x16', targetWidth: 16, targetHeight: 16, notes: '' },
  { id: 'sp_32x32', name: '32x32', targetWidth: 32, targetHeight: 32, notes: '' },
  { id: 'sp_64x64', name: '64x64', targetWidth: 64, targetHeight: 64, notes: '' },
];

describe('computeCollapseOverlay', () => {
  it('marks large shapes as safe', () => {
    const doc = makeDoc([
      { name: 'big', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]);
    const info = overlay.shapes.get('shape-0')!;
    expect(info.level).toBe('safe');
    expect(overlay.safeCount).toBe(1);
    expect(overlay.collapsesCount).toBe(0);
  });

  it('marks tiny shapes as collapsing at small target', () => {
    const doc = makeDoc([
      { name: 'tiny', geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 } },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]); // 16x16
    const info = overlay.shapes.get('shape-0')!;
    expect(info.level).toBe('collapses');
    expect(info.collapsesAt).toContain('sp_16x16');
    expect(overlay.collapsesCount).toBe(1);
  });

  it('marks shapes as at-risk when they collapse at some but not target', () => {
    // 8px shape: 8/500*16 = 0.256 → collapses at 16x16; 8/500*64 = 1.024 → survives at 64x64
    const doc = makeDoc([
      { name: 'medium', geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 } },
    ]);
    // Target is 64x64 where it survives, but it collapses at 16x16
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[2]); // 64x64
    const info = overlay.shapes.get('shape-0')!;
    expect(info.level).toBe('at-risk');
    expect(info.collapsesAt.length).toBeGreaterThan(0);
    expect(info.survivesAt).toContain('sp_64x64');
  });

  it('skips hidden shapes', () => {
    const doc = makeDoc([
      { name: 'hidden', visible: false, geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 } },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]);
    expect(overlay.shapes.size).toBe(0);
    expect(overlay.safeCount).toBe(0);
  });

  it('annotates droppable shapes', () => {
    const doc = makeDoc([
      {
        name: 'droppable-dot',
        geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'droppable' },
      },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]);
    const info = overlay.shapes.get('shape-0')!;
    expect(info.droppable).toBe(true);
    expect(info.mustSurvive).toBe(false);
  });

  it('annotates must-survive shapes', () => {
    const doc = makeDoc([
      {
        name: 'critical',
        geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 },
        reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive' },
      },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]);
    const info = overlay.shapes.get('shape-0')!;
    expect(info.mustSurvive).toBe(true);
    expect(info.droppable).toBe(false);
  });

  it('counts all three categories correctly', () => {
    const doc = makeDoc([
      { name: 'big', geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 } },
      { name: 'medium', geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 } },
      { name: 'tiny', geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 } },
    ]);
    // Target 64x64: big=safe, medium might be at-risk, tiny=collapses
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]); // 16x16
    expect(overlay.safeCount + overlay.atRiskCount + overlay.collapsesCount).toBe(3);
  });

  it('records collapsesAt profile IDs', () => {
    const doc = makeDoc([
      { name: 'tiny', geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 } },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]);
    const info = overlay.shapes.get('shape-0')!;
    // 3/500 = 0.006; * 16 = 0.096, * 32 = 0.192, * 64 = 0.384 → all collapse
    expect(info.collapsesAt).toContain('sp_16x16');
    expect(info.collapsesAt).toContain('sp_32x32');
    expect(info.collapsesAt).toContain('sp_64x64');
  });

  it('handles ellipse geometry', () => {
    const doc = makeDoc([
      { name: 'dot', geometry: { kind: 'ellipse', cx: 250, cy: 250, rx: 2, ry: 2 } },
    ]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[0]);
    const info = overlay.shapes.get('shape-0')!;
    // extent = 4px; 4/500*16 = 0.128 → collapses
    expect(info.level).toBe('collapses');
  });

  it('stores target profile ID in overlay', () => {
    const doc = makeDoc([{ name: 'x' }]);
    const overlay = computeCollapseOverlay(doc, PROFILES, PROFILES[1]);
    expect(overlay.targetProfileId).toBe('sp_32x32');
  });
});
