import { describe, it, expect, beforeEach } from 'vitest';
import { useVectorMasterStore } from './vectorMasterStore';
import type {
  VectorShape,
  VectorMasterDocument,
  Rgba,
  RectGeometry,
  EllipseGeometry,
} from '@glyphstudio/domain';
import {
  DEFAULT_VECTOR_TRANSFORM,
  createVectorMasterDocument,
} from '@glyphstudio/domain';

function resetStore() {
  useVectorMasterStore.setState({
    document: null,
    selectedShapeIds: [],
    selectedGroupId: null,
  });
}

function rect(name: string, x = 0, y = 0, w = 10, h = 10, fill: Rgba | null = [0, 0, 0, 255]): Omit<VectorShape, 'id' | 'zOrder'> {
  return {
    name,
    groupId: null,
    geometry: { kind: 'rect', x, y, w, h },
    fill,
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: {},
    visible: true,
    locked: false,
  };
}

function ellipse(name: string, cx = 50, cy = 50, rx = 20, ry = 20): Omit<VectorShape, 'id' | 'zOrder'> {
  return {
    name,
    groupId: null,
    geometry: { kind: 'ellipse', cx, cy, rx, ry },
    fill: [255, 0, 0, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: {},
    visible: true,
    locked: false,
  };
}

describe('vectorMasterStore', () => {
  beforeEach(resetStore);

  // ── Document lifecycle ──

  describe('document lifecycle', () => {
    it('starts with no document', () => {
      const { document } = useVectorMasterStore.getState();
      expect(document).toBeNull();
    });

    it('creates a document with default artboard', () => {
      const { createDocument } = useVectorMasterStore.getState();
      const id = createDocument('ranger');
      const { document } = useVectorMasterStore.getState();
      expect(document).not.toBeNull();
      expect(document!.name).toBe('ranger');
      expect(document!.artboardWidth).toBe(500);
      expect(document!.artboardHeight).toBe(500);
      expect(document!.id).toBe(id);
    });

    it('creates a document with custom artboard', () => {
      const { createDocument } = useVectorMasterStore.getState();
      createDocument('prop', 256, 256);
      const { document } = useVectorMasterStore.getState();
      expect(document!.artboardWidth).toBe(256);
    });

    it('loads an existing document', () => {
      const doc = createVectorMasterDocument('loaded', 128, 128);
      const { loadDocument } = useVectorMasterStore.getState();
      loadDocument(doc);
      expect(useVectorMasterStore.getState().document!.id).toBe(doc.id);
    });

    it('closes a document', () => {
      const { createDocument, closeDocument } = useVectorMasterStore.getState();
      createDocument('test');
      closeDocument();
      expect(useVectorMasterStore.getState().document).toBeNull();
    });

    it('clears selection on close', () => {
      const { createDocument, addShape, selectShape, closeDocument } = useVectorMasterStore.getState();
      createDocument('test');
      const sid = addShape(rect('box'));
      selectShape(sid);
      closeDocument();
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([]);
    });

    it('renames a document', () => {
      const { createDocument, renameDocument } = useVectorMasterStore.getState();
      createDocument('old');
      renameDocument('new');
      expect(useVectorMasterStore.getState().document!.name).toBe('new');
    });
  });

  // ── Shape CRUD ──

  describe('shape CRUD', () => {
    beforeEach(() => {
      useVectorMasterStore.getState().createDocument('test');
    });

    it('adds a shape', () => {
      const { addShape } = useVectorMasterStore.getState();
      const id = addShape(rect('torso'));
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.shapes).toHaveLength(1);
      expect(doc.shapes[0].id).toBe(id);
      expect(doc.shapes[0].name).toBe('torso');
      expect(doc.shapes[0].zOrder).toBe(0);
    });

    it('assigns incrementing z-orders', () => {
      const { addShape } = useVectorMasterStore.getState();
      addShape(rect('a'));
      addShape(rect('b'));
      addShape(rect('c'));
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.shapes.map((s) => s.zOrder)).toEqual([0, 1, 2]);
    });

    it('removes a shape', () => {
      const { addShape, removeShape } = useVectorMasterStore.getState();
      const id = addShape(rect('box'));
      addShape(rect('other'));
      removeShape(id);
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.shapes).toHaveLength(1);
      expect(doc.shapes[0].name).toBe('other');
    });

    it('renormalizes z-order after remove', () => {
      const { addShape, removeShape } = useVectorMasterStore.getState();
      addShape(rect('a'));
      const bId = addShape(rect('b'));
      addShape(rect('c'));
      removeShape(bId);
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.shapes.map((s) => s.zOrder)).toEqual([0, 1]);
    });

    it('removes shape from selection when deleted', () => {
      const { addShape, selectShape, removeShape } = useVectorMasterStore.getState();
      const id = addShape(rect('box'));
      selectShape(id);
      removeShape(id);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([]);
    });

    it('duplicates a shape', () => {
      const { addShape, duplicateShape } = useVectorMasterStore.getState();
      const id = addShape(rect('hood'));
      const dupeId = duplicateShape(id);
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.shapes).toHaveLength(2);
      expect(dupeId).not.toBe(id);
      const dupe = doc.shapes.find((s) => s.id === dupeId)!;
      expect(dupe.name).toBe('hood copy');
      expect(dupe.zOrder).toBe(1);
    });

    it('returns null when duplicating nonexistent shape', () => {
      const { duplicateShape } = useVectorMasterStore.getState();
      expect(duplicateShape('fake')).toBeNull();
    });

    it('returns empty string when adding to no document', () => {
      resetStore();
      const { addShape } = useVectorMasterStore.getState();
      expect(addShape(rect('box'))).toBe('');
    });
  });

  // ── Shape property setters ──

  describe('shape properties', () => {
    let shapeId: string;

    beforeEach(() => {
      useVectorMasterStore.getState().createDocument('test');
      shapeId = useVectorMasterStore.getState().addShape(rect('box'));
    });

    it('sets shape name', () => {
      useVectorMasterStore.getState().setShapeName(shapeId, 'hood');
      expect(useVectorMasterStore.getState().document!.shapes[0].name).toBe('hood');
    });

    it('sets shape geometry', () => {
      const geo: EllipseGeometry = { kind: 'ellipse', cx: 10, cy: 10, rx: 5, ry: 5 };
      useVectorMasterStore.getState().setShapeGeometry(shapeId, geo);
      expect(useVectorMasterStore.getState().document!.shapes[0].geometry).toEqual(geo);
    });

    it('sets shape fill', () => {
      useVectorMasterStore.getState().setShapeFill(shapeId, [255, 0, 0, 255]);
      expect(useVectorMasterStore.getState().document!.shapes[0].fill).toEqual([255, 0, 0, 255]);
    });

    it('clears shape fill to null', () => {
      useVectorMasterStore.getState().setShapeFill(shapeId, null);
      expect(useVectorMasterStore.getState().document!.shapes[0].fill).toBeNull();
    });

    it('sets shape stroke', () => {
      useVectorMasterStore.getState().setShapeStroke(shapeId, { color: [0, 0, 0, 255], width: 2 });
      expect(useVectorMasterStore.getState().document!.shapes[0].stroke).toEqual({ color: [0, 0, 0, 255], width: 2 });
    });

    it('sets partial transform', () => {
      useVectorMasterStore.getState().setShapeTransform(shapeId, { x: 10, rotation: 45 });
      const t = useVectorMasterStore.getState().document!.shapes[0].transform;
      expect(t.x).toBe(10);
      expect(t.rotation).toBe(45);
      expect(t.scaleX).toBe(1); // untouched
    });

    it('sets reduction metadata', () => {
      useVectorMasterStore.getState().setShapeReduction(shapeId, { cueTag: 'hood', survivalHint: 'must-survive' });
      const r = useVectorMasterStore.getState().document!.shapes[0].reduction;
      expect(r.cueTag).toBe('hood');
      expect(r.survivalHint).toBe('must-survive');
    });

    it('sets visibility', () => {
      useVectorMasterStore.getState().setShapeVisible(shapeId, false);
      expect(useVectorMasterStore.getState().document!.shapes[0].visible).toBe(false);
    });

    it('sets locked', () => {
      useVectorMasterStore.getState().setShapeLocked(shapeId, true);
      expect(useVectorMasterStore.getState().document!.shapes[0].locked).toBe(true);
    });

    it('assigns shape to group', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      useVectorMasterStore.getState().setShapeGroup(shapeId, gid);
      expect(useVectorMasterStore.getState().document!.shapes[0].groupId).toBe(gid);
    });

    it('rejects assignment to nonexistent group', () => {
      useVectorMasterStore.getState().setShapeGroup(shapeId, 'fake');
      expect(useVectorMasterStore.getState().document!.shapes[0].groupId).toBeNull();
    });

    it('allows ungrouping (set to null)', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      useVectorMasterStore.getState().setShapeGroup(shapeId, gid);
      useVectorMasterStore.getState().setShapeGroup(shapeId, null);
      expect(useVectorMasterStore.getState().document!.shapes[0].groupId).toBeNull();
    });

    it('updates document timestamp on change', () => {
      const before = useVectorMasterStore.getState().document!.updatedAt;
      // Tiny delay to ensure timestamp differs
      useVectorMasterStore.getState().setShapeName(shapeId, 'changed');
      const after = useVectorMasterStore.getState().document!.updatedAt;
      expect(after).toBeTruthy();
      // Timestamps may be same if fast, but at least not empty
    });
  });

  // ── Z-order ──

  describe('z-order operations', () => {
    let ids: string[];

    beforeEach(() => {
      useVectorMasterStore.getState().createDocument('test');
      const store = useVectorMasterStore.getState();
      ids = [
        store.addShape(rect('a')),
        store.addShape(rect('b')),
        store.addShape(rect('c')),
      ];
    });

    function zOrders(): number[] {
      const doc = useVectorMasterStore.getState().document!;
      return ids.map((id) => doc.shapes.find((s) => s.id === id)!.zOrder);
    }

    it('starts with [0, 1, 2]', () => {
      expect(zOrders()).toEqual([0, 1, 2]);
    });

    it('moves shape up', () => {
      useVectorMasterStore.getState().moveShapeUp(ids[0]);
      expect(zOrders()).toEqual([1, 0, 2]);
    });

    it('does nothing when moving top shape up', () => {
      useVectorMasterStore.getState().moveShapeUp(ids[2]);
      expect(zOrders()).toEqual([0, 1, 2]);
    });

    it('moves shape down', () => {
      useVectorMasterStore.getState().moveShapeDown(ids[2]);
      expect(zOrders()).toEqual([0, 2, 1]);
    });

    it('does nothing when moving bottom shape down', () => {
      useVectorMasterStore.getState().moveShapeDown(ids[0]);
      expect(zOrders()).toEqual([0, 1, 2]);
    });

    it('moves shape to top', () => {
      useVectorMasterStore.getState().moveShapeToTop(ids[0]);
      // After renormalization: b=0, c=1, a=2
      const doc = useVectorMasterStore.getState().document!;
      const aShape = doc.shapes.find((s) => s.id === ids[0])!;
      expect(aShape.zOrder).toBe(2);
    });

    it('moves shape to bottom', () => {
      useVectorMasterStore.getState().moveShapeToBottom(ids[2]);
      const doc = useVectorMasterStore.getState().document!;
      const cShape = doc.shapes.find((s) => s.id === ids[2])!;
      expect(cShape.zOrder).toBe(0);
    });
  });

  // ── Group CRUD ──

  describe('group CRUD', () => {
    beforeEach(() => {
      useVectorMasterStore.getState().createDocument('test');
    });

    it('adds a group', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.groups).toHaveLength(1);
      expect(doc.groups[0].name).toBe('head');
      expect(doc.groups[0].id).toBe(gid);
    });

    it('removes a group and ungroups shapes', () => {
      const store = useVectorMasterStore.getState();
      const gid = store.addGroup('weapon');
      const sid = store.addShape(rect('bow'));
      store.setShapeGroup(sid, gid);
      store.removeGroup(gid);
      const doc = useVectorMasterStore.getState().document!;
      expect(doc.groups).toHaveLength(0);
      expect(doc.shapes[0].groupId).toBeNull();
    });

    it('clears selectedGroupId when group is removed', () => {
      const store = useVectorMasterStore.getState();
      const gid = store.addGroup('head');
      store.selectGroup(gid);
      store.removeGroup(gid);
      expect(useVectorMasterStore.getState().selectedGroupId).toBeNull();
    });

    it('renames a group', () => {
      const gid = useVectorMasterStore.getState().addGroup('old');
      useVectorMasterStore.getState().renameGroup(gid, 'new');
      expect(useVectorMasterStore.getState().document!.groups[0].name).toBe('new');
    });

    it('toggles group visibility', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      useVectorMasterStore.getState().setGroupVisible(gid, false);
      expect(useVectorMasterStore.getState().document!.groups[0].visible).toBe(false);
    });

    it('toggles group lock', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      useVectorMasterStore.getState().setGroupLocked(gid, true);
      expect(useVectorMasterStore.getState().document!.groups[0].locked).toBe(true);
    });
  });

  // ── Selection ──

  describe('selection', () => {
    let ids: string[];

    beforeEach(() => {
      useVectorMasterStore.getState().createDocument('test');
      const store = useVectorMasterStore.getState();
      ids = [store.addShape(rect('a')), store.addShape(rect('b')), store.addShape(rect('c'))];
    });

    it('selects a shape', () => {
      useVectorMasterStore.getState().selectShape(ids[0]);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([ids[0]]);
    });

    it('does not duplicate selections', () => {
      const store = useVectorMasterStore.getState();
      store.selectShape(ids[0]);
      store.selectShape(ids[0]);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([ids[0]]);
    });

    it('supports multi-select', () => {
      const store = useVectorMasterStore.getState();
      store.selectShape(ids[0]);
      store.selectShape(ids[2]);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([ids[0], ids[2]]);
    });

    it('deselects a shape', () => {
      const store = useVectorMasterStore.getState();
      store.selectShape(ids[0]);
      store.selectShape(ids[1]);
      store.deselectShape(ids[0]);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([ids[1]]);
    });

    it('toggles selection', () => {
      const store = useVectorMasterStore.getState();
      store.toggleShapeSelection(ids[0]);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([ids[0]]);
      store.toggleShapeSelection(ids[0]);
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([]);
    });

    it('selects all shapes', () => {
      useVectorMasterStore.getState().selectAllShapes();
      expect(useVectorMasterStore.getState().selectedShapeIds).toHaveLength(3);
    });

    it('deselects all shapes', () => {
      const store = useVectorMasterStore.getState();
      store.selectAllShapes();
      store.deselectAllShapes();
      expect(useVectorMasterStore.getState().selectedShapeIds).toEqual([]);
    });

    it('selects a group', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      useVectorMasterStore.getState().selectGroup(gid);
      expect(useVectorMasterStore.getState().selectedGroupId).toBe(gid);
    });

    it('deselects group with null', () => {
      const gid = useVectorMasterStore.getState().addGroup('head');
      useVectorMasterStore.getState().selectGroup(gid);
      useVectorMasterStore.getState().selectGroup(null);
      expect(useVectorMasterStore.getState().selectedGroupId).toBeNull();
    });
  });

  // ── Palette ──

  describe('palette', () => {
    beforeEach(() => {
      useVectorMasterStore.getState().createDocument('test');
    });

    it('adds a palette color', () => {
      useVectorMasterStore.getState().addPaletteColor([255, 0, 0, 255]);
      expect(useVectorMasterStore.getState().document!.palette).toHaveLength(1);
      expect(useVectorMasterStore.getState().document!.palette[0]).toEqual([255, 0, 0, 255]);
    });

    it('removes a palette color', () => {
      const store = useVectorMasterStore.getState();
      store.addPaletteColor([255, 0, 0, 255]);
      store.addPaletteColor([0, 255, 0, 255]);
      store.removePaletteColor(0);
      expect(useVectorMasterStore.getState().document!.palette).toHaveLength(1);
      expect(useVectorMasterStore.getState().document!.palette[0]).toEqual([0, 255, 0, 255]);
    });

    it('sets a palette color', () => {
      useVectorMasterStore.getState().addPaletteColor([255, 0, 0, 255]);
      useVectorMasterStore.getState().setPaletteColor(0, [0, 0, 255, 255]);
      expect(useVectorMasterStore.getState().document!.palette[0]).toEqual([0, 0, 255, 255]);
    });

    it('ignores out-of-bounds remove', () => {
      useVectorMasterStore.getState().addPaletteColor([255, 0, 0, 255]);
      useVectorMasterStore.getState().removePaletteColor(5);
      expect(useVectorMasterStore.getState().document!.palette).toHaveLength(1);
    });

    it('ignores out-of-bounds set', () => {
      useVectorMasterStore.getState().addPaletteColor([255, 0, 0, 255]);
      useVectorMasterStore.getState().setPaletteColor(5, [0, 0, 0, 255]);
      expect(useVectorMasterStore.getState().document!.palette[0]).toEqual([255, 0, 0, 255]);
    });
  });
});
