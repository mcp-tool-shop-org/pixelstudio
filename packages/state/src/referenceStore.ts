import { create } from 'zustand';

export interface ReferenceImage {
  id: string;
  /** Absolute path on disk */
  filePath: string;
  /** Display name (filename without extension) */
  name: string;
  opacity: number;
  scale: number;
  panX: number;
  panY: number;
  visible: boolean;
  locked: boolean;
}

interface ReferenceState {
  images: ReferenceImage[];
  activeImageId: string | null;
  panelCollapsed: boolean;

  addImage: (filePath: string, name: string) => string;
  removeImage: (id: string) => void;
  clearAll: () => void;
  setActiveImage: (id: string | null) => void;
  setOpacity: (id: string, opacity: number) => void;
  setScale: (id: string, scale: number) => void;
  setPan: (id: string, x: number, y: number) => void;
  panBy: (id: string, dx: number, dy: number) => void;
  toggleVisible: (id: string) => void;
  toggleLocked: (id: string) => void;
  setPanelCollapsed: (collapsed: boolean) => void;
}

let nextId = 1;

function generateId(): string {
  return `ref-${nextId++}-${Date.now()}`;
}

function updateImage(
  images: ReferenceImage[],
  id: string,
  patch: Partial<ReferenceImage>,
): ReferenceImage[] {
  return images.map((img) => (img.id === id ? { ...img, ...patch } : img));
}

export const useReferenceStore = create<ReferenceState>((set) => ({
  images: [],
  activeImageId: null,
  panelCollapsed: false,

  addImage: (filePath, name) => {
    const id = generateId();
    set((s) => ({
      images: [
        ...s.images,
        {
          id,
          filePath,
          name,
          opacity: 0.5,
          scale: 1,
          panX: 0,
          panY: 0,
          visible: true,
          locked: false,
        },
      ],
      activeImageId: id,
    }));
    return id;
  },

  removeImage: (id) =>
    set((s) => ({
      images: s.images.filter((img) => img.id !== id),
      activeImageId: s.activeImageId === id ? null : s.activeImageId,
    })),

  clearAll: () => set({ images: [], activeImageId: null }),

  setActiveImage: (id) => set({ activeImageId: id }),

  setOpacity: (id, opacity) =>
    set((s) => ({
      images: updateImage(s.images, id, {
        opacity: Math.max(0, Math.min(1, opacity)),
      }),
    })),

  setScale: (id, scale) =>
    set((s) => ({
      images: updateImage(s.images, id, {
        scale: Math.max(0.1, Math.min(10, scale)),
      }),
    })),

  setPan: (id, x, y) =>
    set((s) => ({ images: updateImage(s.images, id, { panX: x, panY: y }) })),

  panBy: (id, dx, dy) =>
    set((s) => ({
      images: updateImage(
        s.images,
        id,
        s.images.reduce(
          (acc, img) =>
            img.id === id ? { panX: img.panX + dx, panY: img.panY + dy } : acc,
          { panX: 0, panY: 0 },
        ),
      ),
    })),

  toggleVisible: (id) =>
    set((s) => {
      const img = s.images.find((i) => i.id === id);
      if (!img) return s;
      return { images: updateImage(s.images, id, { visible: !img.visible }) };
    }),

  toggleLocked: (id) =>
    set((s) => {
      const img = s.images.find((i) => i.id === id);
      if (!img) return s;
      return { images: updateImage(s.images, id, { locked: !img.locked }) };
    }),

  setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
}));
