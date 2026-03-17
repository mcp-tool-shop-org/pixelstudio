import { describe, it, expect } from 'vitest';
import {
  rasterizeVectorMaster,
  rasterizeShape,
  wouldShapeCollapse,
  transformPoint,
} from './vectorRasterize';
import {
  createVectorMasterDocument,
  createRectShape,
  createEllipseShape,
  createLineShape,
  createPolygonShape,
  createPathShape,
  createBlankPixelBuffer,
  DEFAULT_VECTOR_TRANSFORM,
} from '@glyphstudio/domain';
import type { VectorShape, SpritePixelBuffer, Rgba, PathPoint, PathSegment } from '@glyphstudio/domain';

function readPixel(buf: SpritePixelBuffer, x: number, y: number): Rgba {
  const i = (y * buf.width + x) * 4;
  return [buf.data[i], buf.data[i + 1], buf.data[i + 2], buf.data[i + 3]];
}

function isOpaque(buf: SpritePixelBuffer, x: number, y: number): boolean {
  return readPixel(buf, x, y)[3] > 0;
}

function countFilledPixels(buf: SpritePixelBuffer): number {
  let count = 0;
  for (let i = 3; i < buf.data.length; i += 4) {
    if (buf.data[i] > 0) count++;
  }
  return count;
}

describe('vectorRasterize', () => {
  // ── transformPoint ──

  describe('transformPoint', () => {
    it('identity transform returns same point', () => {
      const [x, y] = transformPoint(10, 20, DEFAULT_VECTOR_TRANSFORM);
      expect(x).toBe(10);
      expect(y).toBe(20);
    });

    it('applies translation', () => {
      const [x, y] = transformPoint(10, 20, { ...DEFAULT_VECTOR_TRANSFORM, x: 5, y: -3 });
      expect(x).toBe(15);
      expect(y).toBe(17);
    });

    it('applies scale', () => {
      const [x, y] = transformPoint(10, 20, { ...DEFAULT_VECTOR_TRANSFORM, scaleX: 2, scaleY: 0.5 });
      expect(x).toBe(20);
      expect(y).toBe(10);
    });

    it('applies flipX', () => {
      const [x, y] = transformPoint(10, 20, { ...DEFAULT_VECTOR_TRANSFORM, flipX: true });
      expect(x).toBe(-10);
      expect(y).toBe(20);
    });

    it('applies flipY', () => {
      const [x, y] = transformPoint(10, 20, { ...DEFAULT_VECTOR_TRANSFORM, flipY: true });
      expect(x).toBe(10);
      expect(y).toBe(-20);
    });

    it('applies 90° rotation', () => {
      const [x, y] = transformPoint(10, 0, { ...DEFAULT_VECTOR_TRANSFORM, rotation: 90 });
      expect(x).toBeCloseTo(0, 5);
      expect(y).toBeCloseTo(10, 5);
    });
  });

  // ── Rect rasterization ──

  describe('rasterizeShape — rect', () => {
    it('fills a rectangle', () => {
      const shape = createRectShape('box', 0, 0, 250, 250, [255, 0, 0, 255]);
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      // 250/500 * 10 = 5 → fills 5×5 = 25 pixels
      expect(countFilledPixels(buf)).toBe(25);
      expect(readPixel(buf, 0, 0)).toEqual([255, 0, 0, 255]);
      expect(readPixel(buf, 4, 4)).toEqual([255, 0, 0, 255]);
      expect(isOpaque(buf, 5, 5)).toBe(false);
    });

    it('full artboard rect fills entire target', () => {
      const shape = createRectShape('bg', 0, 0, 500, 500, [0, 255, 0, 255]);
      const buf = createBlankPixelBuffer(8, 8);
      rasterizeShape(shape, buf, 500, 500);
      expect(countFilledPixels(buf)).toBe(64);
    });

    it('skips invisible shapes', () => {
      const shape = createRectShape('hidden', 0, 0, 500, 500, [255, 0, 0, 255]);
      shape.visible = false;
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      expect(countFilledPixels(buf)).toBe(0);
    });

    it('renders rect with stroke', () => {
      const shape = createRectShape('outline', 50, 50, 400, 400, null);
      shape.stroke = { color: [0, 0, 255, 255], width: 25 };
      const buf = createBlankPixelBuffer(20, 20);
      rasterizeShape(shape, buf, 500, 500);
      // Should have some stroked pixels but not be fully filled
      const filled = countFilledPixels(buf);
      expect(filled).toBeGreaterThan(0);
      expect(filled).toBeLessThan(20 * 20);
    });
  });

  // ── Ellipse rasterization ──

  describe('rasterizeShape — ellipse', () => {
    it('fills an ellipse', () => {
      const shape = createEllipseShape('head', 250, 250, 125, 125, [255, 0, 0, 255]);
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      const filled = countFilledPixels(buf);
      // Circle radius ~2.5px in a 10×10 → should fill some pixels
      expect(filled).toBeGreaterThan(0);
      // Center pixel should be filled
      expect(isOpaque(buf, 5, 5)).toBe(true);
    });

    it('very small ellipse still renders at least 1px', () => {
      // Tiny ellipse: 5×5 on 500×500 → 0.1px on 10×10 → clamped to 1px
      const shape = createEllipseShape('dot', 250, 250, 2.5, 2.5, [255, 0, 0, 255]);
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      expect(countFilledPixels(buf)).toBeGreaterThan(0);
    });
  });

  // ── Line rasterization ──

  describe('rasterizeShape — line', () => {
    it('renders a horizontal line', () => {
      const shape = createLineShape('staff', 0, 250, 500, 250, { color: [255, 255, 0, 255], width: 10 });
      const buf = createBlankPixelBuffer(20, 20);
      rasterizeShape(shape, buf, 500, 500);
      // Should have filled pixels along the middle row
      const filled = countFilledPixels(buf);
      expect(filled).toBeGreaterThan(0);
      expect(isOpaque(buf, 10, 10)).toBe(true);
    });

    it('line without stroke produces no pixels', () => {
      const shape = createLineShape('invisible', 0, 0, 500, 500, null);
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      expect(countFilledPixels(buf)).toBe(0);
    });
  });

  // ── Polygon rasterization ──

  describe('rasterizeShape — polygon', () => {
    it('fills a triangle', () => {
      // Triangle covering roughly half the artboard
      const shape = createPolygonShape(
        'hood',
        [{ x: 250, y: 0 }, { x: 500, y: 500 }, { x: 0, y: 500 }],
        [100, 80, 60, 255],
      );
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      const filled = countFilledPixels(buf);
      expect(filled).toBeGreaterThan(0);
      // Top-center should be empty-ish (above triangle peak area)
      // Bottom should be filled
      expect(isOpaque(buf, 5, 9)).toBe(true);
    });

    it('fills a diamond (4-point polygon)', () => {
      const shape = createPolygonShape(
        'gem',
        [{ x: 250, y: 50 }, { x: 450, y: 250 }, { x: 250, y: 450 }, { x: 50, y: 250 }],
        [200, 0, 0, 255],
      );
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      // Center should be filled
      expect(isOpaque(buf, 5, 5)).toBe(true);
      // Corners should be empty
      expect(isOpaque(buf, 0, 0)).toBe(false);
    });
  });

  // ── Full document rasterization ──

  describe('rasterizeVectorMaster', () => {
    it('rasterizes empty document to blank buffer', () => {
      const doc = createVectorMasterDocument('empty');
      const buf = rasterizeVectorMaster(doc, 32, 32);
      expect(buf.width).toBe(32);
      expect(buf.height).toBe(32);
      expect(countFilledPixels(buf)).toBe(0);
    });

    it('composites shapes in z-order', () => {
      const doc = createVectorMasterDocument('test');
      // Red background (z=0)
      const bg = createRectShape('bg', 0, 0, 500, 500, [255, 0, 0, 255]);
      bg.zOrder = 0;
      bg.id = 'bg';
      // Green overlay (z=1)
      const overlay = createRectShape('overlay', 0, 0, 500, 500, [0, 255, 0, 255]);
      overlay.zOrder = 1;
      overlay.id = 'overlay';
      doc.shapes = [overlay, bg]; // intentionally out of order in array

      const buf = rasterizeVectorMaster(doc, 4, 4);
      // Green should be on top (painted last)
      expect(readPixel(buf, 0, 0)).toEqual([0, 255, 0, 255]);
    });

    it('skips hidden shapes', () => {
      const doc = createVectorMasterDocument('test');
      const shape = createRectShape('hidden', 0, 0, 500, 500, [255, 0, 0, 255]);
      shape.visible = false;
      shape.id = 'h';
      doc.shapes = [shape];

      const buf = rasterizeVectorMaster(doc, 4, 4);
      expect(countFilledPixels(buf)).toBe(0);
    });

    it('rasterizes to different target sizes', () => {
      const doc = createVectorMasterDocument('test');
      const shape = createRectShape('box', 0, 0, 500, 500, [128, 128, 128, 255]);
      shape.id = 's1';
      doc.shapes = [shape];

      const small = rasterizeVectorMaster(doc, 16, 16);
      const large = rasterizeVectorMaster(doc, 64, 64);
      expect(countFilledPixels(small)).toBe(16 * 16);
      expect(countFilledPixels(large)).toBe(64 * 64);
    });

    it('handles alpha compositing between shapes', () => {
      const doc = createVectorMasterDocument('test');
      const bg = createRectShape('bg', 0, 0, 500, 500, [255, 0, 0, 255]);
      bg.id = 'bg';
      bg.zOrder = 0;
      // Semi-transparent overlay
      const overlay = createRectShape('overlay', 0, 0, 500, 500, [0, 0, 255, 128]);
      overlay.id = 'ov';
      overlay.zOrder = 1;
      doc.shapes = [bg, overlay];

      const buf = rasterizeVectorMaster(doc, 4, 4);
      const px = readPixel(buf, 0, 0);
      // Should be a blend of red and blue, not pure blue
      expect(px[0]).toBeGreaterThan(0); // some red
      expect(px[2]).toBeGreaterThan(0); // some blue
      expect(px[3]).toBe(255); // fully opaque result
    });
  });

  // ── Collapse detection ──

  describe('wouldShapeCollapse', () => {
    it('large rect does not collapse', () => {
      const shape = createRectShape('big', 0, 0, 250, 250);
      expect(wouldShapeCollapse(shape, 500, 500, 48, 48)).toBe(false);
    });

    it('tiny rect collapses at small target', () => {
      // 2px on 500 artboard → 0.064px at 16×16
      const shape = createRectShape('buckle', 100, 100, 2, 2);
      expect(wouldShapeCollapse(shape, 500, 500, 16, 16)).toBe(true);
    });

    it('tiny rect does not collapse at large target', () => {
      const shape = createRectShape('buckle', 100, 100, 10, 10);
      expect(wouldShapeCollapse(shape, 500, 500, 64, 64)).toBe(false);
    });

    it('detects ellipse collapse', () => {
      const shape = createEllipseShape('dot', 250, 250, 1, 1);
      expect(wouldShapeCollapse(shape, 500, 500, 16, 16)).toBe(true);
    });

    it('detects polygon collapse', () => {
      const shape = createPolygonShape('tiny', [
        { x: 100, y: 100 }, { x: 102, y: 100 }, { x: 101, y: 102 },
      ]);
      expect(wouldShapeCollapse(shape, 500, 500, 16, 16)).toBe(true);
    });

    it('detects line collapse', () => {
      // Vertical line of 1px on 500 artboard
      const shape = createLineShape('tick', 100, 100, 100, 101, { color: [0, 0, 0, 255], width: 1 });
      expect(wouldShapeCollapse(shape, 500, 500, 16, 16)).toBe(true);
    });

    it('long line does not collapse', () => {
      const shape = createLineShape('staff', 0, 250, 500, 250, { color: [0, 0, 0, 255], width: 1 });
      expect(wouldShapeCollapse(shape, 500, 500, 16, 16)).toBe(false);
    });

    it('respects transform scale', () => {
      const shape = createRectShape('scaled', 0, 0, 50, 50);
      shape.transform = { ...DEFAULT_VECTOR_TRANSFORM, scaleX: 0.01, scaleY: 0.01 };
      expect(wouldShapeCollapse(shape, 500, 500, 48, 48)).toBe(true);
    });

    it('detects path collapse', () => {
      const pts: PathPoint[] = [
        { x: 100, y: 100, pointType: 'corner' },
        { x: 102, y: 100, pointType: 'corner' },
        { x: 101, y: 102, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }];
      const shape = createPathShape('tiny-path', pts, segs, true);
      expect(wouldShapeCollapse(shape, 500, 500, 16, 16)).toBe(true);
    });

    it('large path does not collapse', () => {
      const pts: PathPoint[] = [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 250, y: 0, pointType: 'corner' },
        { x: 250, y: 250, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }];
      const shape = createPathShape('big-path', pts, segs, true);
      expect(wouldShapeCollapse(shape, 500, 500, 32, 32)).toBe(false);
    });

    it('curved path uses bounding box including curve bulge', () => {
      // Path with curve that bulges far from anchor points
      const pts: PathPoint[] = [
        { x: 100, y: 250, pointType: 'corner' },
        { x: 400, y: 250, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [{ kind: 'quadratic', cpX: 250, cpY: 0 }];
      const shape = createPathShape('arched-path', pts, segs, false);
      // Curve bulges up to ~y=125 → vertical extent is ~125px → shouldn't collapse at 32×32
      expect(wouldShapeCollapse(shape, 500, 500, 32, 32)).toBe(false);
    });
  });

  // ── Path rasterization ──

  describe('rasterizeShape — path', () => {
    it('fills a closed triangle path', () => {
      const pts: PathPoint[] = [
        { x: 250, y: 50, pointType: 'corner' },
        { x: 450, y: 450, pointType: 'corner' },
        { x: 50, y: 450, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }];
      const shape = createPathShape('tri', pts, segs, true, [255, 0, 0, 255]);
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      const filled = countFilledPixels(buf);
      expect(filled).toBeGreaterThan(0);
      // Bottom center should be filled
      expect(isOpaque(buf, 5, 8)).toBe(true);
    });

    it('fills a closed curved path (teardrop flame)', () => {
      // Teardrop: narrow top, wide bottom with curves
      const pts: PathPoint[] = [
        { x: 250, y: 50, pointType: 'corner' },   // top tip
        { x: 350, y: 300, pointType: 'smooth' },   // right
        { x: 250, y: 450, pointType: 'smooth' },   // bottom
        { x: 150, y: 300, pointType: 'smooth' },   // left
      ];
      const segs: PathSegment[] = [
        { kind: 'quadratic', cpX: 400, cpY: 150 },  // right bulge
        { kind: 'quadratic', cpX: 350, cpY: 400 },   // right-bottom curve
        { kind: 'quadratic', cpX: 150, cpY: 400 },   // left-bottom curve
        { kind: 'quadratic', cpX: 100, cpY: 150 },   // left bulge back to top
      ];
      const shape = createPathShape('flame', pts, segs, true, [255, 160, 0, 255]);
      const buf = createBlankPixelBuffer(16, 16);
      rasterizeShape(shape, buf, 500, 500);
      const filled = countFilledPixels(buf);
      expect(filled).toBeGreaterThan(10);
      // Center should be filled
      expect(isOpaque(buf, 8, 8)).toBe(true);
    });

    it('renders open path stroke only (no fill)', () => {
      const pts: PathPoint[] = [
        { x: 0, y: 250, pointType: 'corner' },
        { x: 250, y: 50, pointType: 'smooth' },
        { x: 500, y: 250, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [
        { kind: 'quadratic', cpX: 125, cpY: 50 },
        { kind: 'quadratic', cpX: 375, cpY: 50 },
      ];
      const shape = createPathShape('arc', pts, segs, false, null);
      shape.stroke = { color: [0, 255, 0, 255], width: 20 };
      const buf = createBlankPixelBuffer(20, 20);
      rasterizeShape(shape, buf, 500, 500);
      const filled = countFilledPixels(buf);
      expect(filled).toBeGreaterThan(0);
      // Should NOT fill center (open path, no fill)
      // But should have stroked pixels along the arc
    });

    it('open path without fill has no scanline fill', () => {
      const pts: PathPoint[] = [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 500, y: 500, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [{ kind: 'line' }];
      const shape = createPathShape('diagonal', pts, segs, false, [255, 0, 0, 255]);
      // Even though fill is set, open path should NOT scanline-fill
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      // Open path with only 2 points can't form a polygon → no fill
      expect(countFilledPixels(buf)).toBe(0);
    });

    it('path with transform is rasterized correctly', () => {
      const pts: PathPoint[] = [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 100, y: 0, pointType: 'corner' },
        { x: 100, y: 100, pointType: 'corner' },
        { x: 0, y: 100, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [
        { kind: 'line' }, { kind: 'line' }, { kind: 'line' }, { kind: 'line' },
      ];
      const shape = createPathShape('square-path', pts, segs, true, [0, 0, 255, 255]);
      shape.transform = { ...DEFAULT_VECTOR_TRANSFORM, x: 200, y: 200 };
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      // Shape at (200,200)-(300,300) → pixels at (4,4)-(6,6) on 10×10
      expect(isOpaque(buf, 4, 4)).toBe(true);
      expect(isOpaque(buf, 0, 0)).toBe(false);
    });

    it('mixed line+curve path rasterizes', () => {
      const pts: PathPoint[] = [
        { x: 100, y: 100, pointType: 'corner' },
        { x: 400, y: 100, pointType: 'corner' },
        { x: 400, y: 400, pointType: 'smooth' },
        { x: 100, y: 400, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [
        { kind: 'line' },                              // top edge: straight
        { kind: 'quadratic', cpX: 500, cpY: 250 },     // right edge: curved outward
        { kind: 'line' },                              // bottom edge: straight
        { kind: 'quadratic', cpX: 0, cpY: 250 },       // left edge: curved outward
      ];
      const shape = createPathShape('rounded-rect', pts, segs, true, [128, 128, 128, 255]);
      const buf = createBlankPixelBuffer(16, 16);
      rasterizeShape(shape, buf, 500, 500);
      const filled = countFilledPixels(buf);
      // Should fill more than a plain rectangle due to curve bulges
      expect(filled).toBeGreaterThan(20);
    });
  });

  // ── Path in full document ──

  describe('rasterizeVectorMaster — paths', () => {
    it('rasterizes document with path shapes', () => {
      const doc = createVectorMasterDocument('test');
      const pts: PathPoint[] = [
        { x: 100, y: 100, pointType: 'corner' },
        { x: 400, y: 100, pointType: 'corner' },
        { x: 250, y: 400, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }];
      const shape = createPathShape('triangle', pts, segs, true, [255, 0, 0, 255]);
      shape.id = 'path1';
      doc.shapes = [shape];
      const buf = rasterizeVectorMaster(doc, 32, 32);
      expect(countFilledPixels(buf)).toBeGreaterThan(0);
    });

    it('composites paths with other shapes', () => {
      const doc = createVectorMasterDocument('composite');
      const bg = createRectShape('bg', 0, 0, 500, 500, [100, 100, 100, 255]);
      bg.id = 'bg';
      bg.zOrder = 0;

      const pts: PathPoint[] = [
        { x: 150, y: 150, pointType: 'corner' },
        { x: 350, y: 150, pointType: 'corner' },
        { x: 350, y: 350, pointType: 'smooth' },
        { x: 150, y: 350, pointType: 'corner' },
      ];
      const segs: PathSegment[] = [
        { kind: 'line' },
        { kind: 'quadratic', cpX: 450, cpY: 250 },
        { kind: 'line' },
        { kind: 'line' },
      ];
      const pathShape = createPathShape('overlay', pts, segs, true, [255, 0, 0, 255]);
      pathShape.id = 'path1';
      pathShape.zOrder = 1;
      doc.shapes = [bg, pathShape];

      const buf = rasterizeVectorMaster(doc, 16, 16);
      // Everything should be filled (bg covers all)
      expect(countFilledPixels(buf)).toBe(16 * 16);
      // Center area should have some red from the path overlay
      const centerPx = readPixel(buf, 8, 8);
      expect(centerPx[0]).toBe(255); // red
    });
  });

  // ── Transform integration ──

  describe('transform integration', () => {
    it('translated rect renders at correct position', () => {
      const shape = createRectShape('moved', 0, 0, 250, 250, [255, 0, 0, 255]);
      shape.transform = { ...DEFAULT_VECTOR_TRANSFORM, x: 250, y: 250 };
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      // Shape at (250,250)-(500,500) on artboard → (5,5)-(10,10) on 10×10
      expect(isOpaque(buf, 5, 5)).toBe(true);
      expect(isOpaque(buf, 0, 0)).toBe(false);
    });

    it('scaled rect renders larger', () => {
      // 100×100 rect scaled 2x → 200×200
      const shape = createRectShape('scaled', 0, 0, 100, 100, [0, 255, 0, 255]);
      shape.transform = { ...DEFAULT_VECTOR_TRANSFORM, scaleX: 2, scaleY: 2 };
      const buf = createBlankPixelBuffer(10, 10);
      rasterizeShape(shape, buf, 500, 500);
      // 200/500 * 10 = 4 → fills 4×4 = 16
      expect(countFilledPixels(buf)).toBe(16);
    });
  });
});
