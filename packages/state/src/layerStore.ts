import { create } from 'zustand';
import { produce } from 'immer';
import type { LayerNode } from '@pixelstudio/domain';

interface LayerState {
  rootLayerIds: string[];
  layerById: Record<string, LayerNode>;
  activeLayerId: string | null;
  selectedLayerIds: string[];

  setActiveLayer: (id: string | null) => void;
  addLayer: (layer: LayerNode) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, updates: Partial<LayerNode>) => void;
  setLayerOrder: (rootIds: string[]) => void;
}

export const useLayerStore = create<LayerState>((set) => ({
  rootLayerIds: [],
  layerById: {},
  activeLayerId: null,
  selectedLayerIds: [],

  setActiveLayer: (id) => set({ activeLayerId: id }),
  addLayer: (layer) =>
    set(
      produce((s: LayerState) => {
        s.layerById[layer.id] = layer;
        if (!layer.parentId) {
          s.rootLayerIds.push(layer.id);
        }
        s.activeLayerId = layer.id;
      }),
    ),
  removeLayer: (id) =>
    set(
      produce((s: LayerState) => {
        delete s.layerById[id];
        s.rootLayerIds = s.rootLayerIds.filter((lid) => lid !== id);
        if (s.activeLayerId === id) s.activeLayerId = null;
      }),
    ),
  updateLayer: (id, updates) =>
    set(
      produce((s: LayerState) => {
        if (s.layerById[id]) {
          Object.assign(s.layerById[id], updates);
        }
      }),
    ),
  setLayerOrder: (rootIds) => set({ rootLayerIds: rootIds }),
}));
