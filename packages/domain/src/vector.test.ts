import { describe, it, expect } from 'vitest';
import {
  createVectorMasterDocument,
  createRectShape,
  createEllipseShape,
  createLineShape,
  createPolygonShape,
  createPathShape,
  createVectorGroup,
  generateVectorMasterId,
  generateVectorShapeId,
  generateVectorGroupId,
  DEFAULT_ARTBOARD_WIDTH,
  DEFAULT_ARTBOARD_HEIGHT,
  DEFAULT_VECTOR_TRANSFORM,
  DEFAULT_REDUCTION_META,
  flattenPath,
  evalQuadratic,
  pathAddPoint,
  pathMovePoint,
  pathDeletePoint,
  pathSetPointType,
  pathConvertSegment,
  pathToggleClosed,
  pathMoveControlPoint,
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
  PathGeometry,
  PathPoint,
  PathSegment,
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

    it('PathGeometry discriminates on kind', () => {
      const path: VectorGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 100, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }],
        closed: false,
      };
      expect(path.kind).toBe('path');
    });
  });

  // ── Path factory ──

  describe('createPathShape', () => {
    const pts: PathPoint[] = [
      { x: 0, y: 0, pointType: 'corner' },
      { x: 100, y: 0, pointType: 'smooth' },
      { x: 100, y: 100, pointType: 'corner' },
    ];

    it('creates open path with line segments', () => {
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }];
      const s = createPathShape('cape-edge', pts, segs, false);
      expect(s.geometry.kind).toBe('path');
      const geo = s.geometry as PathGeometry;
      expect(geo.points).toHaveLength(3);
      expect(geo.segments).toHaveLength(2);
      expect(geo.closed).toBe(false);
    });

    it('creates closed path', () => {
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }];
      const s = createPathShape('flame', pts, segs, true);
      const geo = s.geometry as PathGeometry;
      expect(geo.closed).toBe(true);
      expect(geo.segments).toHaveLength(3); // N segments for N points closed
    });

    it('creates path with mixed line and curve segments', () => {
      const segs: PathSegment[] = [
        { kind: 'line' },
        { kind: 'quadratic', cpX: 150, cpY: 50 },
      ];
      const s = createPathShape('tail', pts, segs, false);
      const geo = s.geometry as PathGeometry;
      expect(geo.segments[0].kind).toBe('line');
      expect(geo.segments[1].kind).toBe('quadratic');
    });

    it('accepts fill color', () => {
      const segs: PathSegment[] = [{ kind: 'line' }, { kind: 'line' }];
      const s = createPathShape('shape', pts, segs, false, [255, 0, 0, 255]);
      expect(s.fill).toEqual([255, 0, 0, 255]);
    });

    it('rejects path with fewer than 2 points', () => {
      expect(() => createPathShape('bad', [{ x: 0, y: 0, pointType: 'corner' }], [], false))
        .toThrow('Path requires at least 2 points');
    });

    it('rejects path with wrong segment count (open)', () => {
      // Open path with 3 points needs 2 segments
      expect(() => createPathShape('bad', pts, [{ kind: 'line' }], false))
        .toThrow('requires 2 segments, got 1');
    });

    it('rejects path with wrong segment count (closed)', () => {
      // Closed path with 3 points needs 3 segments
      expect(() => createPathShape('bad', pts, [{ kind: 'line' }, { kind: 'line' }], true))
        .toThrow('requires 3 segments, got 2');
    });
  });

  // ── Quadratic Bézier evaluation ──

  describe('evalQuadratic', () => {
    it('returns start point at t=0', () => {
      const p = evalQuadratic(0, 0, 50, 100, 100, 0, 0);
      expect(p.x).toBeCloseTo(0);
      expect(p.y).toBeCloseTo(0);
    });

    it('returns end point at t=1', () => {
      const p = evalQuadratic(0, 0, 50, 100, 100, 0, 1);
      expect(p.x).toBeCloseTo(100);
      expect(p.y).toBeCloseTo(0);
    });

    it('midpoint is pulled toward control point', () => {
      const p = evalQuadratic(0, 0, 50, 100, 100, 0, 0.5);
      expect(p.x).toBeCloseTo(50);
      expect(p.y).toBeCloseTo(50); // pulled up toward cp at (50,100)
    });

    it('straight line when control point is on midpoint', () => {
      const p = evalQuadratic(0, 0, 50, 50, 100, 100, 0.5);
      expect(p.x).toBeCloseTo(50);
      expect(p.y).toBeCloseTo(50);
    });
  });

  // ── Path flattening ──

  describe('flattenPath', () => {
    it('flattens all-line path to points', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
          { x: 100, y: 100, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }, { kind: 'line' }],
        closed: false,
      };
      const flat = flattenPath(geo);
      expect(flat).toHaveLength(3);
      expect(flat[0]).toEqual({ x: 0, y: 0 });
      expect(flat[1]).toEqual({ x: 100, y: 0 });
      expect(flat[2]).toEqual({ x: 100, y: 100 });
    });

    it('flattens closed line path to include closing segment', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
          { x: 50, y: 80, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }],
        closed: true,
      };
      const flat = flattenPath(geo);
      // Start + 3 segments → 4 points (last returns to first)
      expect(flat).toHaveLength(4);
      expect(flat[3]).toEqual({ x: 0, y: 0 });
    });

    it('subdivides quadratic curve into multiple points', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 200, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'quadratic', cpX: 100, cpY: 200 }],
        closed: false,
      };
      const flat = flattenPath(geo, 5);
      // Should have more than 2 points (curve was subdivided)
      expect(flat.length).toBeGreaterThan(2);
      // First and last match anchor points
      expect(flat[0]).toEqual({ x: 0, y: 0 });
      expect(flat[flat.length - 1]).toEqual({ x: 200, y: 0 });
      // Some intermediate point should have positive Y (curve bulges toward control point)
      const midPoints = flat.slice(1, -1);
      expect(midPoints.some(p => p.y > 0)).toBe(true);
    });

    it('handles mixed line and curve segments', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
          { x: 200, y: 0, pointType: 'corner' },
        ],
        segments: [
          { kind: 'line' },
          { kind: 'quadratic', cpX: 150, cpY: 100 },
        ],
        closed: false,
      };
      const flat = flattenPath(geo, 5);
      expect(flat.length).toBeGreaterThan(3);
      // Line segment part
      expect(flat[0]).toEqual({ x: 0, y: 0 });
      expect(flat[1]).toEqual({ x: 100, y: 0 });
      // Curve part has intermediate points
      expect(flat[flat.length - 1]).toEqual({ x: 200, y: 0 });
    });

    it('flat curve produces few points', () => {
      // Control point on the line between anchors — practically straight
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'quadratic', cpX: 50, cpY: 0 }],
        closed: false,
      };
      const flat = flattenPath(geo, 2);
      // Nearly straight curve → should produce just start + end (or very few)
      expect(flat.length).toBeLessThanOrEqual(3);
    });
  });

  // ── Path point editing ──

  describe('pathMovePoint', () => {
    const geo: PathGeometry = {
      kind: 'path',
      points: [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 100, y: 0, pointType: 'corner' },
        { x: 100, y: 100, pointType: 'corner' },
      ],
      segments: [{ kind: 'line' }, { kind: 'line' }],
      closed: false,
    };

    it('moves a point to new position', () => {
      const result = pathMovePoint(geo, 1, 50, 50);
      expect(result.points[1].x).toBe(50);
      expect(result.points[1].y).toBe(50);
    });

    it('preserves point type', () => {
      const withSmooth: PathGeometry = {
        ...geo,
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'smooth' },
          { x: 100, y: 100, pointType: 'corner' },
        ],
      };
      const result = pathMovePoint(withSmooth, 1, 50, 50);
      expect(result.points[1].pointType).toBe('smooth');
    });

    it('preserves other points', () => {
      const result = pathMovePoint(geo, 1, 50, 50);
      expect(result.points[0]).toEqual(geo.points[0]);
      expect(result.points[2]).toEqual(geo.points[2]);
    });

    it('throws for out-of-bounds index', () => {
      expect(() => pathMovePoint(geo, 5, 0, 0)).toThrow('out of bounds');
    });
  });

  describe('pathDeletePoint', () => {
    const geo: PathGeometry = {
      kind: 'path',
      points: [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 100, y: 0, pointType: 'corner' },
        { x: 200, y: 0, pointType: 'corner' },
      ],
      segments: [{ kind: 'line' }, { kind: 'line' }],
      closed: false,
    };

    it('deletes first point', () => {
      const result = pathDeletePoint(geo, 0);
      expect(result.points).toHaveLength(2);
      expect(result.segments).toHaveLength(1);
      expect(result.points[0].x).toBe(100);
    });

    it('deletes last point', () => {
      const result = pathDeletePoint(geo, 2);
      expect(result.points).toHaveLength(2);
      expect(result.segments).toHaveLength(1);
    });

    it('deletes middle point and merges segments', () => {
      const result = pathDeletePoint(geo, 1);
      expect(result.points).toHaveLength(2);
      expect(result.segments).toHaveLength(1);
      expect(result.segments[0].kind).toBe('line');
    });

    it('refuses to delete below 2 points', () => {
      const tiny: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }],
        closed: false,
      };
      expect(() => pathDeletePoint(tiny, 0)).toThrow('at least 2 points');
    });
  });

  describe('pathAddPoint', () => {
    const geo: PathGeometry = {
      kind: 'path',
      points: [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 200, y: 0, pointType: 'corner' },
      ],
      segments: [{ kind: 'line' }],
      closed: false,
    };

    it('adds point at end of open path', () => {
      const result = pathAddPoint(geo, 2, { x: 200, y: 200, pointType: 'corner' });
      expect(result.points).toHaveLength(3);
      expect(result.segments).toHaveLength(2);
      expect(result.points[2].x).toBe(200);
    });

    it('splits line segment when inserting in the middle', () => {
      const result = pathAddPoint(geo, 1, { x: 100, y: 50, pointType: 'smooth' });
      expect(result.points).toHaveLength(3);
      expect(result.segments).toHaveLength(2);
      expect(result.segments[0].kind).toBe('line');
      expect(result.segments[1].kind).toBe('line');
    });

    it('splits quadratic segment preserving curve shape', () => {
      const curveGeo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 200, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'quadratic', cpX: 100, cpY: 200 }],
        closed: false,
      };
      const result = pathAddPoint(curveGeo, 1, { x: 100, y: 100, pointType: 'smooth' });
      expect(result.points).toHaveLength(3);
      expect(result.segments).toHaveLength(2);
      // Both sub-segments should be quadratic
      expect(result.segments[0].kind).toBe('quadratic');
      expect(result.segments[1].kind).toBe('quadratic');
    });
  });

  describe('pathSetPointType', () => {
    it('changes point type', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }],
        closed: false,
      };
      const result = pathSetPointType(geo, 0, 'smooth');
      expect(result.points[0].pointType).toBe('smooth');
      expect(result.points[1].pointType).toBe('corner'); // unchanged
    });
  });

  describe('pathConvertSegment', () => {
    const geo: PathGeometry = {
      kind: 'path',
      points: [
        { x: 0, y: 0, pointType: 'corner' },
        { x: 100, y: 100, pointType: 'corner' },
      ],
      segments: [{ kind: 'line' }],
      closed: false,
    };

    it('converts line to quadratic with midpoint control', () => {
      const result = pathConvertSegment(geo, 0, 'quadratic');
      expect(result.segments[0].kind).toBe('quadratic');
      const seg = result.segments[0] as { kind: 'quadratic'; cpX: number; cpY: number };
      expect(seg.cpX).toBe(50); // midpoint
      expect(seg.cpY).toBe(50);
    });

    it('converts quadratic back to line', () => {
      const curved: PathGeometry = {
        ...geo,
        segments: [{ kind: 'quadratic', cpX: 50, cpY: 200 }],
      };
      const result = pathConvertSegment(curved, 0, 'line');
      expect(result.segments[0].kind).toBe('line');
    });

    it('no-op when converting to same kind', () => {
      const result = pathConvertSegment(geo, 0, 'line');
      expect(result).toBe(geo); // same reference
    });
  });

  describe('pathToggleClosed', () => {
    it('closes an open path', () => {
      const open: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
          { x: 100, y: 100, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }, { kind: 'line' }],
        closed: false,
      };
      const result = pathToggleClosed(open);
      expect(result.closed).toBe(true);
      expect(result.segments).toHaveLength(3); // added closing segment
      expect(result.segments[2].kind).toBe('line');
    });

    it('opens a closed path', () => {
      const closed: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
          { x: 100, y: 100, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }, { kind: 'line' }, { kind: 'line' }],
        closed: true,
      };
      const result = pathToggleClosed(closed);
      expect(result.closed).toBe(false);
      expect(result.segments).toHaveLength(2); // removed closing segment
    });
  });

  describe('pathMoveControlPoint', () => {
    it('moves a control point on a quadratic segment', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 200, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'quadratic', cpX: 100, cpY: 100 }],
        closed: false,
      };
      const result = pathMoveControlPoint(geo, 0, 80, 150);
      const seg = result.segments[0] as { kind: 'quadratic'; cpX: number; cpY: number };
      expect(seg.cpX).toBe(80);
      expect(seg.cpY).toBe(150);
    });

    it('throws when moving control point on a line segment', () => {
      const geo: PathGeometry = {
        kind: 'path',
        points: [
          { x: 0, y: 0, pointType: 'corner' },
          { x: 100, y: 0, pointType: 'corner' },
        ],
        segments: [{ kind: 'line' }],
        closed: false,
      };
      expect(() => pathMoveControlPoint(geo, 0, 50, 50)).toThrow('Cannot move control point on a line');
    });
  });
});
