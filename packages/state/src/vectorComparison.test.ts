import { describe, it, expect } from 'vitest';
import {
  rasterizeAllProfiles,
  analyzeReduction,
  generateMultiSizeLayout,
  summarizeReduction,
} from './vectorComparison';
import {
  createVectorMasterDocument,
  createRectShape,
  createEllipseShape,
  createPolygonShape,
  BUILT_IN_SIZE_PROFILES,
} from '@glyphstudio/domain';
import type { VectorMasterDocument, SizeProfile, ReductionReport } from '@glyphstudio/domain';

function makeDoc(): VectorMasterDocument {
  const doc = createVectorMasterDocument('ranger');
  // Body — large rect in center
  const body = createRectShape('torso', 150, 100, 200, 300, [80, 60, 50, 255]);
  body.id = 'torso';
  body.zOrder = 0;
  // Head — ellipse
  const head = createEllipseShape('head', 250, 80, 60, 60, [200, 160, 120, 255]);
  head.id = 'head';
  head.zOrder = 1;
  // Hood — triangle
  const hood = createPolygonShape(
    'hood',
    [{ x: 190, y: 20 }, { x: 310, y: 20 }, { x: 250, y: 120 }],
    [60, 50, 40, 255],
  );
  hood.id = 'hood';
  hood.zOrder = 2;
  hood.reduction = { cueTag: 'hood', survivalHint: 'must-survive' };
  // Tiny buckle — will collapse at small sizes
  const buckle = createRectShape('buckle', 240, 250, 3, 3, [200, 180, 50, 255]);
  buckle.id = 'buckle';
  buckle.zOrder = 3;
  buckle.reduction = { cueTag: 'buckle', survivalHint: 'droppable', dropPriority: 10 };

  doc.shapes = [body, head, hood, buckle];
  return doc;
}

const TWO_PROFILES: SizeProfile[] = [
  { id: 'sp_16x32', name: '16×32', targetWidth: 16, targetHeight: 32, notes: '' },
  { id: 'sp_48x48', name: '48×48', targetWidth: 48, targetHeight: 48, notes: '' },
];

describe('vectorComparison', () => {
  // ── rasterizeAllProfiles ──

  describe('rasterizeAllProfiles', () => {
    it('returns a buffer for each profile', () => {
      const doc = makeDoc();
      const results = rasterizeAllProfiles(doc, TWO_PROFILES);
      expect(results.size).toBe(2);
      expect(results.get('sp_16x32')!.width).toBe(16);
      expect(results.get('sp_16x32')!.height).toBe(32);
      expect(results.get('sp_48x48')!.width).toBe(48);
      expect(results.get('sp_48x48')!.height).toBe(48);
    });

    it('returns empty map for no profiles', () => {
      const doc = makeDoc();
      expect(rasterizeAllProfiles(doc, []).size).toBe(0);
    });

    it('buffers have filled pixels', () => {
      const doc = makeDoc();
      const results = rasterizeAllProfiles(doc, TWO_PROFILES);
      // Both should have some content
      for (const [, buf] of results) {
        let filled = 0;
        for (let i = 3; i < buf.data.length; i += 4) {
          if (buf.data[i] > 0) filled++;
        }
        expect(filled).toBeGreaterThan(0);
      }
    });
  });

  // ── analyzeReduction ──

  describe('analyzeReduction', () => {
    it('produces a report for each profile', () => {
      const doc = makeDoc();
      const reports = analyzeReduction(doc, TWO_PROFILES);
      expect(reports).toHaveLength(2);
      expect(reports[0].profileId).toBe('sp_16x32');
      expect(reports[1].profileId).toBe('sp_48x48');
    });

    it('reports correct target dimensions', () => {
      const doc = makeDoc();
      const reports = analyzeReduction(doc, TWO_PROFILES);
      expect(reports[0].targetWidth).toBe(16);
      expect(reports[0].targetHeight).toBe(32);
    });

    it('reports fill percentage', () => {
      const doc = makeDoc();
      const reports = analyzeReduction(doc, TWO_PROFILES);
      for (const r of reports) {
        expect(r.fillPercent).toBeGreaterThan(0);
        expect(r.fillPercent).toBeLessThanOrEqual(100);
        expect(r.filledPixelCount).toBeGreaterThan(0);
        expect(r.totalPixels).toBe(r.targetWidth * r.targetHeight);
      }
    });

    it('identifies collapsed shapes at small sizes', () => {
      const doc = makeDoc();
      const reports = analyzeReduction(doc, TWO_PROFILES);
      // At 16×32, the 3×3 buckle should collapse
      const small = reports[0];
      expect(small.collapsedShapeIds).toContain('buckle');
    });

    it('identifies survived shapes', () => {
      const doc = makeDoc();
      const reports = analyzeReduction(doc, TWO_PROFILES);
      const large = reports[1]; // 48×48
      expect(large.survivedShapeIds).toContain('torso');
      expect(large.survivedShapeIds).toContain('head');
    });

    it('computes silhouette bounds', () => {
      const doc = makeDoc();
      const reports = analyzeReduction(doc, TWO_PROFILES);
      for (const r of reports) {
        expect(r.silhouetteBounds.w).toBeGreaterThan(0);
        expect(r.silhouetteBounds.h).toBeGreaterThan(0);
      }
    });

    it('empty document has zero fill', () => {
      const doc = createVectorMasterDocument('empty');
      const reports = analyzeReduction(doc, TWO_PROFILES);
      for (const r of reports) {
        expect(r.filledPixelCount).toBe(0);
        expect(r.fillPercent).toBe(0);
        expect(r.collapsedShapeIds).toEqual([]);
        expect(r.survivedShapeIds).toEqual([]);
      }
    });
  });

  // ── generateMultiSizeLayout ──

  describe('generateMultiSizeLayout', () => {
    it('produces a buffer with correct dimensions', () => {
      const doc = makeDoc();
      const layout = generateMultiSizeLayout(doc, TWO_PROFILES, { displayHeight: 128, gap: 4 });
      expect(layout.height).toBe(128);
      // Width = panel1.width + gap + panel2.width
      expect(layout.width).toBeGreaterThan(0);
    });

    it('returns tiny buffer for empty profiles', () => {
      const doc = makeDoc();
      const layout = generateMultiSizeLayout(doc, [], { displayHeight: 128 });
      expect(layout.width).toBe(1);
      expect(layout.height).toBe(1);
    });

    it('fills background', () => {
      const doc = createVectorMasterDocument('empty');
      const bg: [number, number, number, number] = [100, 100, 100, 255];
      const layout = generateMultiSizeLayout(doc, TWO_PROFILES, { backgroundColor: bg, displayHeight: 64, gap: 2 });
      // Should have background color in corners
      const i = 0;
      expect(layout.data[i]).toBe(100);
      expect(layout.data[i + 3]).toBe(255);
    });

    it('single profile produces strip', () => {
      const doc = makeDoc();
      const oneProfile = [TWO_PROFILES[0]];
      const layout = generateMultiSizeLayout(doc, oneProfile, { displayHeight: 64 });
      expect(layout.height).toBe(64);
      // Width = upscaled panel width (16 * scale factor)
      expect(layout.width).toBeGreaterThan(0);
    });
  });

  // ── summarizeReduction ──

  describe('summarizeReduction', () => {
    it('produces a readable summary', () => {
      const report: ReductionReport = {
        profileId: 'sp_48x48',
        targetWidth: 48,
        targetHeight: 48,
        filledPixelCount: 1200,
        totalPixels: 2304,
        fillPercent: 52.08,
        collapsedShapeIds: ['buckle'],
        survivedShapeIds: ['torso', 'head', 'hood'],
        silhouetteBounds: { x: 5, y: 2, w: 38, h: 44 },
      };
      const summary = summarizeReduction(report);
      expect(summary).toContain('48×48');
      expect(summary).toContain('52.1% fill');
      expect(summary).toContain('3 survived');
      expect(summary).toContain('1 collapsed');
    });
  });

  // ── Full pipeline integration ──

  describe('full pipeline', () => {
    it('rasterize → analyze → layout round-trip works', () => {
      const doc = makeDoc();
      const profiles = BUILT_IN_SIZE_PROFILES.slice(0, 3); // 16×16, 16×32, 24×24

      // Rasterize
      const buffers = rasterizeAllProfiles(doc, profiles);
      expect(buffers.size).toBe(3);

      // Analyze
      const reports = analyzeReduction(doc, profiles);
      expect(reports).toHaveLength(3);

      // Layout
      const layout = generateMultiSizeLayout(doc, profiles, { displayHeight: 128 });
      expect(layout.width).toBeGreaterThan(0);
      expect(layout.height).toBe(128);

      // Summaries
      for (const r of reports) {
        const s = summarizeReduction(r);
        expect(s.length).toBeGreaterThan(0);
      }
    });
  });
});
