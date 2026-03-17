import { create } from 'zustand';
import type {
  VectorMasterDocument,
  VectorMasterId,
  VectorShape,
  VectorShapeId,
  VectorGroup,
  VectorGroupId,
  VectorGeometry,
  VectorTransform,
  VectorReductionMeta,
  VectorStroke,
  Rgba,
} from '@glyphstudio/domain';
import {
  createVectorMasterDocument,
  generateVectorShapeId,
  generateVectorGroupId,
  DEFAULT_VECTOR_TRANSFORM,
  DEFAULT_REDUCTION_META,
} from '@glyphstudio/domain';

// ── State interface ──

interface VectorMasterState {
  /** The active vector master document (null = no document open). */
  document: VectorMasterDocument | null;

  /** Currently selected shape IDs. */
  selectedShapeIds: VectorShapeId[];

  /** Currently selected group ID (null = no group selected). */
  selectedGroupId: VectorGroupId | null;

  // ── Document lifecycle ──

  /** Create a new vector master document. */
  createDocument: (name: string, artboardWidth?: number, artboardHeight?: number) => VectorMasterId;
  /** Load an existing document. */
  loadDocument: (doc: VectorMasterDocument) => void;
  /** Close the current document. */
  closeDocument: () => void;
  /** Rename the document. */
  renameDocument: (name: string) => void;

  // ── Shape CRUD ──

  /** Add a shape to the document. Returns the shape ID. */
  addShape: (shape: Omit<VectorShape, 'id' | 'zOrder'>) => VectorShapeId;
  /** Remove a shape by ID. */
  removeShape: (id: VectorShapeId) => void;
  /** Duplicate a shape. Returns the new shape ID. */
  duplicateShape: (id: VectorShapeId) => VectorShapeId | null;

  // ── Shape property setters ──

  setShapeName: (id: VectorShapeId, name: string) => void;
  setShapeGeometry: (id: VectorShapeId, geometry: VectorGeometry) => void;
  setShapeFill: (id: VectorShapeId, fill: Rgba | null) => void;
  setShapeStroke: (id: VectorShapeId, stroke: VectorStroke | null) => void;
  setShapeTransform: (id: VectorShapeId, transform: Partial<VectorTransform>) => void;
  setShapeReduction: (id: VectorShapeId, reduction: Partial<VectorReductionMeta>) => void;
  setShapeVisible: (id: VectorShapeId, visible: boolean) => void;
  setShapeLocked: (id: VectorShapeId, locked: boolean) => void;
  setShapeGroup: (id: VectorShapeId, groupId: VectorGroupId | null) => void;

  // ── Shape z-order ──

  /** Move a shape up one z-order level. */
  moveShapeUp: (id: VectorShapeId) => void;
  /** Move a shape down one z-order level. */
  moveShapeDown: (id: VectorShapeId) => void;
  /** Move a shape to the top of the z-order stack. */
  moveShapeToTop: (id: VectorShapeId) => void;
  /** Move a shape to the bottom of the z-order stack. */
  moveShapeToBottom: (id: VectorShapeId) => void;

  // ── Group CRUD ──

  /** Add a group. Returns the group ID. */
  addGroup: (name: string) => VectorGroupId;
  /** Remove a group (shapes in it become ungrouped). */
  removeGroup: (id: VectorGroupId) => void;
  /** Rename a group. */
  renameGroup: (id: VectorGroupId, name: string) => void;
  /** Toggle group visibility. */
  setGroupVisible: (id: VectorGroupId, visible: boolean) => void;
  /** Toggle group lock. */
  setGroupLocked: (id: VectorGroupId, locked: boolean) => void;

  // ── Selection ──

  selectShape: (id: VectorShapeId) => void;
  deselectShape: (id: VectorShapeId) => void;
  toggleShapeSelection: (id: VectorShapeId) => void;
  selectAllShapes: () => void;
  deselectAllShapes: () => void;
  selectGroup: (id: VectorGroupId | null) => void;

  // ── Palette ──

  addPaletteColor: (color: Rgba) => void;
  removePaletteColor: (index: number) => void;
  setPaletteColor: (index: number, color: Rgba) => void;
}

// ── Helpers ──

function touchDoc(doc: VectorMasterDocument): VectorMasterDocument {
  return { ...doc, updatedAt: new Date().toISOString() };
}

function updateShape(
  shapes: VectorShape[],
  id: VectorShapeId,
  patch: Partial<VectorShape>,
): VectorShape[] {
  return shapes.map((s) => (s.id === id ? { ...s, ...patch } : s));
}

function updateGroup(
  groups: VectorGroup[],
  id: VectorGroupId,
  patch: Partial<VectorGroup>,
): VectorGroup[] {
  return groups.map((g) => (g.id === id ? { ...g, ...patch } : g));
}

function renormalizeZOrder(shapes: VectorShape[]): VectorShape[] {
  return [...shapes]
    .sort((a, b) => a.zOrder - b.zOrder)
    .map((s, i) => (s.zOrder === i ? s : { ...s, zOrder: i }));
}

// ── Store ──

export const useVectorMasterStore = create<VectorMasterState>((set, get) => ({
  document: null,
  selectedShapeIds: [],
  selectedGroupId: null,

  // ── Document lifecycle ──

  createDocument: (name, artboardWidth, artboardHeight) => {
    const doc = createVectorMasterDocument(name, artboardWidth, artboardHeight);
    set({ document: doc, selectedShapeIds: [], selectedGroupId: null });
    return doc.id;
  },

  loadDocument: (doc) => {
    set({ document: doc, selectedShapeIds: [], selectedGroupId: null });
  },

  closeDocument: () => {
    set({ document: null, selectedShapeIds: [], selectedGroupId: null });
  },

  renameDocument: (name) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, name }) });
  },

  // ── Shape CRUD ──

  addShape: (shapeData) => {
    const { document: doc } = get();
    if (!doc) return '';
    const id = generateVectorShapeId();
    const zOrder = doc.shapes.length;
    const shape: VectorShape = {
      ...shapeData,
      id,
      zOrder,
    };
    set({ document: touchDoc({ ...doc, shapes: [...doc.shapes, shape] }) });
    return id;
  },

  removeShape: (id) => {
    const { document: doc, selectedShapeIds } = get();
    if (!doc) return;
    const filtered = doc.shapes.filter((s) => s.id !== id);
    set({
      document: touchDoc({ ...doc, shapes: renormalizeZOrder(filtered) }),
      selectedShapeIds: selectedShapeIds.filter((sid) => sid !== id),
    });
  },

  duplicateShape: (id) => {
    const { document: doc } = get();
    if (!doc) return null;
    const source = doc.shapes.find((s) => s.id === id);
    if (!source) return null;
    const newId = generateVectorShapeId();
    const dupe: VectorShape = {
      ...source,
      id: newId,
      name: `${source.name} copy`,
      zOrder: doc.shapes.length,
    };
    set({ document: touchDoc({ ...doc, shapes: [...doc.shapes, dupe] }) });
    return newId;
  },

  // ── Shape property setters ──

  setShapeName: (id, name) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { name }) }) });
  },

  setShapeGeometry: (id, geometry) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { geometry }) }) });
  },

  setShapeFill: (id, fill) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { fill }) }) });
  },

  setShapeStroke: (id, stroke) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { stroke }) }) });
  },

  setShapeTransform: (id, partial) => {
    const { document: doc } = get();
    if (!doc) return;
    const shape = doc.shapes.find((s) => s.id === id);
    if (!shape) return;
    const transform = { ...shape.transform, ...partial };
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { transform }) }) });
  },

  setShapeReduction: (id, partial) => {
    const { document: doc } = get();
    if (!doc) return;
    const shape = doc.shapes.find((s) => s.id === id);
    if (!shape) return;
    const reduction = { ...shape.reduction, ...partial };
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { reduction }) }) });
  },

  setShapeVisible: (id, visible) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { visible }) }) });
  },

  setShapeLocked: (id, locked) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { locked }) }) });
  },

  setShapeGroup: (id, groupId) => {
    const { document: doc } = get();
    if (!doc) return;
    if (groupId !== null && !doc.groups.find((g) => g.id === groupId)) return;
    set({ document: touchDoc({ ...doc, shapes: updateShape(doc.shapes, id, { groupId }) }) });
  },

  // ── Shape z-order ──

  moveShapeUp: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    const sorted = [...doc.shapes].sort((a, b) => a.zOrder - b.zOrder);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx < 0 || idx >= sorted.length - 1) return;
    // Swap z-orders
    const current = sorted[idx];
    const above = sorted[idx + 1];
    const shapes = doc.shapes.map((s) => {
      if (s.id === current.id) return { ...s, zOrder: above.zOrder };
      if (s.id === above.id) return { ...s, zOrder: current.zOrder };
      return s;
    });
    set({ document: touchDoc({ ...doc, shapes }) });
  },

  moveShapeDown: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    const sorted = [...doc.shapes].sort((a, b) => a.zOrder - b.zOrder);
    const idx = sorted.findIndex((s) => s.id === id);
    if (idx <= 0) return;
    const current = sorted[idx];
    const below = sorted[idx - 1];
    const shapes = doc.shapes.map((s) => {
      if (s.id === current.id) return { ...s, zOrder: below.zOrder };
      if (s.id === below.id) return { ...s, zOrder: current.zOrder };
      return s;
    });
    set({ document: touchDoc({ ...doc, shapes }) });
  },

  moveShapeToTop: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    const maxZ = Math.max(0, ...doc.shapes.map((s) => s.zOrder));
    const shape = doc.shapes.find((s) => s.id === id);
    if (!shape || shape.zOrder === maxZ) return;
    const shapes = doc.shapes.map((s) =>
      s.id === id ? { ...s, zOrder: maxZ + 1 } : s,
    );
    set({ document: touchDoc({ ...doc, shapes: renormalizeZOrder(shapes) }) });
  },

  moveShapeToBottom: (id) => {
    const { document: doc } = get();
    if (!doc) return;
    const shape = doc.shapes.find((s) => s.id === id);
    if (!shape || shape.zOrder === 0) return;
    const shapes = doc.shapes.map((s) =>
      s.id === id ? { ...s, zOrder: -1 } : s,
    );
    set({ document: touchDoc({ ...doc, shapes: renormalizeZOrder(shapes) }) });
  },

  // ── Group CRUD ──

  addGroup: (name) => {
    const { document: doc } = get();
    if (!doc) return '';
    const id = generateVectorGroupId();
    const zOrder = doc.groups.length;
    const group: VectorGroup = { id, name, zOrder, visible: true, locked: false };
    set({ document: touchDoc({ ...doc, groups: [...doc.groups, group] }) });
    return id;
  },

  removeGroup: (id) => {
    const { document: doc, selectedGroupId } = get();
    if (!doc) return;
    // Ungroup all shapes in this group
    const shapes = doc.shapes.map((s) =>
      s.groupId === id ? { ...s, groupId: null } : s,
    );
    const groups = doc.groups.filter((g) => g.id !== id);
    set({
      document: touchDoc({ ...doc, shapes, groups }),
      selectedGroupId: selectedGroupId === id ? null : selectedGroupId,
    });
  },

  renameGroup: (id, name) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, groups: updateGroup(doc.groups, id, { name }) }) });
  },

  setGroupVisible: (id, visible) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, groups: updateGroup(doc.groups, id, { visible }) }) });
  },

  setGroupLocked: (id, locked) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, groups: updateGroup(doc.groups, id, { locked }) }) });
  },

  // ── Selection ──

  selectShape: (id) => {
    const { selectedShapeIds } = get();
    if (selectedShapeIds.includes(id)) return;
    set({ selectedShapeIds: [...selectedShapeIds, id] });
  },

  deselectShape: (id) => {
    set((s) => ({ selectedShapeIds: s.selectedShapeIds.filter((sid) => sid !== id) }));
  },

  toggleShapeSelection: (id) => {
    const { selectedShapeIds } = get();
    if (selectedShapeIds.includes(id)) {
      set({ selectedShapeIds: selectedShapeIds.filter((sid) => sid !== id) });
    } else {
      set({ selectedShapeIds: [...selectedShapeIds, id] });
    }
  },

  selectAllShapes: () => {
    const { document: doc } = get();
    if (!doc) return;
    set({ selectedShapeIds: doc.shapes.map((s) => s.id) });
  },

  deselectAllShapes: () => {
    set({ selectedShapeIds: [] });
  },

  selectGroup: (id) => {
    set({ selectedGroupId: id });
  },

  // ── Palette ──

  addPaletteColor: (color) => {
    const { document: doc } = get();
    if (!doc) return;
    set({ document: touchDoc({ ...doc, palette: [...doc.palette, color] }) });
  },

  removePaletteColor: (index) => {
    const { document: doc } = get();
    if (!doc || index < 0 || index >= doc.palette.length) return;
    const palette = [...doc.palette];
    palette.splice(index, 1);
    set({ document: touchDoc({ ...doc, palette }) });
  },

  setPaletteColor: (index, color) => {
    const { document: doc } = get();
    if (!doc || index < 0 || index >= doc.palette.length) return;
    const palette = [...doc.palette];
    palette[index] = color;
    set({ document: touchDoc({ ...doc, palette }) });
  },
}));
