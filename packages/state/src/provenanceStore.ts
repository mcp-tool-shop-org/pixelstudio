import { create } from 'zustand';
import type { OperationKind } from '@pixelstudio/domain';

interface ProvenanceEntry {
  id: string;
  operationName: string;
  kind: OperationKind;
  timestamp: string;
  affectedLayerIds: string[];
  affectedFrameIds: string[];
  replayable: boolean;
}

interface ProvenanceState {
  entries: ProvenanceEntry[];
  selectedEntryId: string | null;

  addEntry: (entry: ProvenanceEntry) => void;
  selectEntry: (id: string | null) => void;
}

export const useProvenanceStore = create<ProvenanceState>((set) => ({
  entries: [],
  selectedEntryId: null,

  addEntry: (entry) => set((s) => ({ entries: [entry, ...s.entries] })),
  selectEntry: (id) => set({ selectedEntryId: id }),
}));
