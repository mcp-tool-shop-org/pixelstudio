import { describe, it, expect } from 'vitest';
import {
  createVectorMasterDocument,
  createRectShape,
  createEllipseShape,
  createLineShape,
  createPolygonShape,
  createVectorGroup,
  generateVectorMasterId,
  generateVectorShapeId,
  generateVectorGroupId,
  DEFAULT_ARTBOARD_WIDTH,
  DEFAULT_ARTBOARD_HEIGHT,
  DEFAULT_VECTOR_TRANSFORM,
  DEFAULT_REDUCTION_META,
} from './vector';
import type {
  VectorMasterDocument,
  VectorShape,
  VectorGroup,
  VectorTransform,
  VectorReductionMeta,
  VectorGeometry,
  RectGeometry,
  EllipseGeometry,
  LineGeometry,
  PolygonGeometry,
  Rgba,
  VectorStroke,
  VectorSourceLink,
  SurvivalHint,
} from './vector';

describe('vector domain types', () => {
  // ── Defaults ──

  describe('defaults', () => {
    it('default artboard is 500×500', () => {
      expect(DEFAULT_ARTBOARD_WIDTH).toBe(500);
      expect(DEFAULT_ARTBOARD_HEIGHT).toBe(500);
    });

    it('default transform is identity', () => {
      expect(DEFAULT_VECTOR_TRANSFORM).toEqual({
        x: 0, y: 0, scaleX: 1, scaleY: 1, rotation: 0, flipX: false, flipY: false,
      });
    });

    it('default reduction meta is empty', () => {
      expect(DEFAULT_REDUCTION_META).toEqual({});
    });
  });

  // ── ID generators ──

  describe('ID generators', () => {
    it('generates unique master IDs', () => {
      const a = generateVectorMasterId();
      const b = generateVectorMasterId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^vm_/);
    });

    it('generates unique shape IDs', () => {
      const a = generateVectorShapeId();
      const b = generateVectorShapeId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^vs_/);
    });

    it('generates unique group IDs', () => {
      const a = generateVectorGroupId();
      const b = generateVectorGroupId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^vg_/);
    });
  });

  // ── Document factory ──

  describe('createVectorMasterDocument', () => {
    it('creates with default artboard size', () => {
      const doc = createVectorMasterDocument('ranger');
      expect(doc.name).toBe('ranger');
      expect(doc.artboardWidth).toBe(500);
      expect(doc.artboardHeight).toBe(500);
    });

    it('creates with custom artboard size', () => {
      const doc = createVectorMasterDocument('prop', 256, 256);
      expect(doc.artboardWidth).toBe(256);
      expect(doc.artboardHeight).toBe(256);
    });

    it('starts with empty shapes and groups', () => {
      const doc = createVectorMasterDocument('test');
      expect(doc.shapes).toEqual([]);
      expect(doc.groups).toEqual([]);
      expect(doc.palette).toEqual([]);
    });

    it('has timestamps', () => {
      const doc = createVectorMasterDocument('test');
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
    });

    it('generates unique IDs', () => {
      const a = createVectorMasterDocument('a');
      const b = createVectorMasterDocument('b');
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── Shape factories ──

  describe('createRectShape', () => {
    it('creates rect with geometry', () => {
      const s = createRectShape('torso', 10, 20, 50, 80);
      expect(s.name).toBe('torso');
      expect(s.geometry).toEqual({ kind: 'rect', x: 10, y: 20, w: 50, h: 80 });
      expect(s.fill).toBeNull();
      expect(s.stroke).toBeNull();
    });

    it('accepts fill color', () => {
      const fill: Rgba = [100, 50, 30, 255];
      const s = createRectShape('belt', 0, 0, 10, 5, fill);
      expect(s.fill).toEqual([100, 50, 30, 255]);
    });

    it('has identity transform', () => {
      const s = createRectShape('box', 0, 0, 10, 10);
      expect(s.transform).toEqual(DEFAULT_VECTOR_TRANSFORM);
    });

    it('is visible and unlocked by default', () => {
      const s = createRectShape('box', 0, 0, 10, 10);
      expect(s.visible).toBe(true);
      expect(s.locked).toBe(false);
    });

    it('has empty reduction meta', () => {
      const s = createRectShape('box', 0, 0, 10, 10);
      expect(s.reduction).toEqual({});
    });

    it('is ungrouped by default', () => {
      const s = createRectShape('box', 0, 0, 10, 10);
      expect(s.groupId).toBeNull();
    });
  });

  describe('createEllipseShape', () => {
    it('creates ellipse with geometry', () => {
      const s = createEllipseShape('head', 50, 30, 20, 25);
      expect(s.geometry).toEqual({ kind: 'ellipse', cx: 50, cy: 30, rx: 20, ry: 25 });
    });

    it('accepts fill color', () => {
      const s = createEllipseShape('eye', 10, 10, 3, 3, [0, 0, 0, 255]);
      expect(s.fill).toEqual([0, 0, 0, 255]);
    });
  });

  describe('createLineShape', () => {
    it('creates line with geometry', () => {
      const s = createLineShape('bowstring', 10, 20, 10, 80);
      expect(s.geometry).toEqual({ kind: 'line', x1: 10, y1: 20, x2: 10, y2: 80 });
    });

    it('has no fill (lines are stroke-only)', () => {
      const s = createLineShape('staff', 0, 0, 100, 100);
      expect(s.fill).toBeNull();
    });

    it('accepts stroke', () => {
      const stroke: VectorStroke = { color: [80, 60, 40, 255], width: 3 };
      const s = createLineShape('staff', 0, 0, 100, 100, stroke);
      expect(s.stroke).toEqual(stroke);
    });
  });

  describe('createPolygonShape', () => {
    it('creates polygon with points', () => {
      const points = [{ x: 0, y: 0 }, { x: 50, y: 0 }, { x: 25, y: 40 }];
      const s = createPolygonShape('hood', points);
      expect(s.geometry.kind).toBe('polygon');
      expect((s.geometry as PolygonGeometry).points).toEqual(points);
    });

    it('accepts fill', () => {
      const points = [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 5, y: 10 }];
      const s = createPolygonShape('cape', points, [60, 40, 30, 255]);
      expect(s.fill).toEqual([60, 40, 30, 255]);
    });

    it('rejects polygons with fewer than 3 points', () => {
      expect(() => createPolygonShape('bad', [{ x: 0, y: 0 }, { x: 1, y: 1 }]))
        .toThrow('Polygon requires at least 3 points');
    });

    it('rejects empty polygon', () => {
      expect(() => createPolygonShape('bad', []))
        .toThrow('Polygon requires at least 3 points');
    });
  });

  // ── Group factory ──

  describe('createVectorGroup', () => {
    it('creates a group', () => {
      const g = createVectorGroup('head');
      expect(g.name).toBe('head');
      expect(g.zOrder).toBe(0);
      expect(g.visible).toBe(true);
      expect(g.locked).toBe(false);
    });

    it('accepts custom zOrder', () => {
      const g = createVectorGroup('weapon', 5);
      expect(g.zOrder).toBe(5);
    });

    it('generates unique IDs', () => {
      const a = createVectorGroup('a');
      const b = createVectorGroup('b');
      expect(a.id).not.toBe(b.id);
    });
  });

  // ── Type assertions (compile-time correctness) ──

  describe('type contracts', () => {
    it('VectorGeometry discriminates on kind', () => {
      const rect: VectorGeometry = { kind: 'rect', x: 0, y: 0, w: 10, h: 10 };
      const ellipse: VectorGeometry = { kind: 'ellipse', cx: 5, cy: 5, rx: 3, ry: 3 };
      const line: VectorGeometry = { kind: 'line', x1: 0, y1: 0, x2: 10, y2: 10 };
      const poly: VectorGeometry = { kind: 'polygon', points: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 0, y: 1 }] };
      expect(rect.kind).toBe('rect');
      expect(ellipse.kind).toBe('ellipse');
      expect(line.kind).toBe('line');
      expect(poly.kind).toBe('polygon');
    });

    it('SurvivalHint covers all variants', () => {
      const hints: SurvivalHint[] = ['must-survive', 'prefer-survive', 'droppable'];
      expect(hints).toHaveLength(3);
    });

    it('VectorSourceLink has all provenance fields', () => {
      const link: VectorSourceLink = {
        sourceFile: 'ranger.glyphvec',
        sourceArtboardWidth: 500,
        sourceArtboardHeight: 500,
        profileId: 'sp_48x48',
        rasterizedAt: new Date().toISOString(),
      };
      expect(link.sourceFile).toBe('ranger.glyphvec');
    });

    it('VectorReductionMeta fields are optional', () => {
      const meta: VectorReductionMeta = {};
      expect(meta.cueTag).toBeUndefined();
      expect(meta.survivalHint).toBeUndefined();
      expect(meta.dropPriority).toBeUndefined();
      expect(meta.notes).toBeUndefined();
    });

    it('VectorReductionMeta accepts all fields', () => {
      const meta: VectorReductionMeta = {
        cueTag: 'hood',
        survivalHint: 'must-survive',
        dropPriority: 0,
        notes: 'Identity-critical shape',
      };
      expect(meta.cueTag).toBe('hood');
      expect(meta.survivalHint).toBe('must-survive');
    });
  });
});
