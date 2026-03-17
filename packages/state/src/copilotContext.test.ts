import { describe, it, expect } from 'vitest';
import type { VectorMasterDocument, VectorShape, SizeProfile } from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import { captureCopilotContext, captureCopilotRaster } from './copilotContext';

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
  { id: 'sp_16x16', name: '16×16 micro', targetWidth: 16, targetHeight: 16, notes: '' },
  { id: 'sp_32x32', name: '32×32 standard', targetWidth: 32, targetHeight: 32, notes: '' },
  { id: 'sp_64x64', name: '64×64 detail', targetWidth: 64, targetHeight: 64, notes: '' },
];

// ── Tests ──

describe('captureCopilotContext', () => {
  it('captures basic document info', () => {
    const doc = makeDoc([{ name: 'body' }, { name: 'head' }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.documentName).toBe('Test Doc');
    expect(ctx.artboardWidth).toBe(500);
    expect(ctx.artboardHeight).toBe(500);
    expect(ctx.totalShapes).toBe(2);
    expect(ctx.visibleShapes).toBe(2);
    expect(ctx.capturedAt).toBeTruthy();
  });

  it('excludes hidden shapes from visible count and summaries', () => {
    const doc = makeDoc([
      { name: 'visible-shape' },
      { name: 'hidden-shape', visible: false },
    ]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.totalShapes).toBe(2);
    expect(ctx.visibleShapes).toBe(1);
    expect(ctx.shapes.length).toBe(1);
    expect(ctx.shapes[0].name).toBe('visible-shape');
  });

  it('computes per-shape area estimates for rect', () => {
    const doc = makeDoc([{
      name: 'big-rect',
      geometry: { kind: 'rect', x: 0, y: 0, w: 200, h: 200 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.shapes[0].areaEstimate).toBe(40000);
    expect(ctx.shapes[0].areaPct).toBe(16); // 40000 / 250000 * 100
  });

  it('computes per-shape area estimates for ellipse', () => {
    const doc = makeDoc([{
      name: 'circle',
      geometry: { kind: 'ellipse', cx: 250, cy: 250, rx: 50, ry: 50 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.shapes[0].areaEstimate).toBeGreaterThan(7000); // π*50*50 ≈ 7854
    expect(ctx.shapes[0].areaEstimate).toBeLessThan(8000);
  });

  it('generates per-profile summaries', () => {
    const doc = makeDoc([{
      name: 'body',
      geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 300 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.profiles.length).toBe(3);
    expect(ctx.profiles[0].profileId).toBe('sp_16x16');
    expect(ctx.profiles[0].survivedCount).toBeGreaterThanOrEqual(0);
    expect(ctx.profiles[0].fillPercent).toBeGreaterThanOrEqual(0);
  });

  it('identifies collapse per profile per shape', () => {
    // Tiny shape that collapses at 16×16 but survives at 64×64
    const doc = makeDoc([{
      name: 'tiny-detail',
      geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    const shape = ctx.shapes[0];
    // 8/500 * 16 = 0.256 → collapses at 16×16
    expect(shape.collapseByProfile['sp_16x16']).toBe(true);
    // 8/500 * 64 = 1.024 → survives at 64×64
    expect(shape.collapseByProfile['sp_64x64']).toBe(false);
  });

  it('identifies at-risk shapes', () => {
    const doc = makeDoc([{
      name: 'edge-case',
      geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.atRiskShapeNames).toContain('edge-case');
  });

  it('identifies critical risk when must-survive collapses', () => {
    const doc = makeDoc([{
      name: 'hood',
      geometry: { kind: 'rect', x: 200, y: 200, w: 8, h: 8 },
      reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive', cueTag: 'hood' },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.criticalRiskShapeNames).toContain('hood');
  });

  it('detects reduction metadata presence', () => {
    const noMeta = makeDoc([{ name: 'a' }, { name: 'b' }, { name: 'c' }]);
    expect(captureCopilotContext(noMeta, PROFILES).hasReductionMetadata).toBe(false);

    const withMeta = makeDoc([{
      name: 'tagged',
      reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive' },
    }]);
    expect(captureCopilotContext(withMeta, PROFILES).hasReductionMetadata).toBe(true);
  });

  it('picks strongest and weakest profiles', () => {
    const doc = makeDoc([{
      name: 'body',
      geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 400 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.strongestProfileId).toBeTruthy();
    expect(ctx.weakestProfileId).toBeTruthy();
    // Larger profiles should generally score better
    expect(ctx.strongestProfileId).not.toBe(ctx.weakestProfileId);
  });

  it('includes fill color as hex', () => {
    const doc = makeDoc([{
      name: 'red-shape',
      fill: [255, 0, 0, 255],
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.shapes[0].fillHex).toBe('#ff0000');
  });

  it('handles null fill', () => {
    const doc = makeDoc([{
      name: 'no-fill',
      fill: null,
      stroke: { color: [255, 255, 255, 255], width: 2 },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.shapes[0].fillHex).toBeNull();
    expect(ctx.shapes[0].hasStroke).toBe(true);
  });

  it('includes group name when shape is grouped', () => {
    const doc = makeDoc([{
      name: 'hood',
      groupId: 'g-1',
    }]);
    doc.groups = [{ id: 'g-1', name: 'head', zOrder: 0, visible: true, locked: false }];
    const ctx = captureCopilotContext(doc, PROFILES);
    expect(ctx.shapes[0].groupName).toBe('head');
    expect(ctx.groupCount).toBe(1);
  });

  it('handles empty profiles array', () => {
    const doc = makeDoc([{ name: 'body' }]);
    const ctx = captureCopilotContext(doc, []);
    expect(ctx.profiles.length).toBe(0);
    expect(ctx.strongestProfileId).toBeNull();
    expect(ctx.weakestProfileId).toBeNull();
  });

  it('handles polygon area with shoelace formula', () => {
    const doc = makeDoc([{
      name: 'triangle',
      geometry: {
        kind: 'polygon',
        points: [{ x: 0, y: 0 }, { x: 200, y: 0 }, { x: 100, y: 200 }],
      },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    // Shoelace: 0.5 * |0*0 - 200*0 + 200*200 - 100*0 + 100*0 - 0*200| = 0.5 * 40000 = 20000
    expect(ctx.shapes[0].areaEstimate).toBe(20000);
  });

  it('handles path area with bounding box estimate', () => {
    const doc = makeDoc([{
      name: 'curve',
      geometry: {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' as const },
          { x: 100, y: 0, pointType: 'smooth' as const },
          { x: 100, y: 100, pointType: 'corner' as const },
        ],
        segments: [{ kind: 'line' as const }, { kind: 'line' as const }],
        closed: false,
      },
    }]);
    const ctx = captureCopilotContext(doc, PROFILES);
    // bbox = 100×100, × 0.6 fill factor = 6000
    expect(ctx.shapes[0].areaEstimate).toBe(6000);
  });
});

describe('captureCopilotRaster', () => {
  it('returns a pixel buffer at the requested size', () => {
    const doc = makeDoc([{
      name: 'body',
      geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 400 },
    }]);
    const buf = captureCopilotRaster(doc, 32, 32);
    expect(buf.width).toBe(32);
    expect(buf.height).toBe(32);
    expect(buf.data.length).toBe(32 * 32 * 4);
  });

  it('raster has filled pixels for visible shapes', () => {
    const doc = makeDoc([{
      name: 'body',
      geometry: { kind: 'rect', x: 100, y: 100, w: 300, h: 300 },
      fill: [200, 100, 50, 255],
    }]);
    const buf = captureCopilotRaster(doc, 32, 32);
    // Check that some pixels have alpha > 0
    let filledCount = 0;
    for (let i = 3; i < buf.data.length; i += 4) {
      if (buf.data[i] > 0) filledCount++;
    }
    expect(filledCount).toBeGreaterThan(0);
  });
});
