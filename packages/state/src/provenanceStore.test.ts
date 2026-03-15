import { describe, it, expect, beforeEach } from 'vitest';
import { useProvenanceStore } from './provenanceStore';
import type { OperationKind } from '@glyphstudio/domain';

function makeEntry(id: string, name: string, kind: OperationKind = 'deterministic') {
  return {
    id,
    operationName: name,
    kind,
    timestamp: '2026-01-01T00:00:00Z',
    affectedLayerIds: ['l1'],
    affectedFrameIds: ['f1'],
    replayable: true,
  };
}

describe('provenanceStore', () => {
  beforeEach(() => {
    useProvenanceStore.setState({ entries: [], selectedEntryId: null });
  });

  it('starts empty', () => {
    const s = useProvenanceStore.getState();
    expect(s.entries).toEqual([]);
    expect(s.selectedEntryId).toBeNull();
  });

  it('addEntry prepends (newest first)', () => {
    useProvenanceStore.getState().addEntry(makeEntry('e1', 'Brush stroke'));
    useProvenanceStore.getState().addEntry(makeEntry('e2', 'Fill'));
    const entries = useProvenanceStore.getState().entries;
    expect(entries).toHaveLength(2);
    expect(entries[0].id).toBe('e2'); // newest first
    expect(entries[1].id).toBe('e1');
  });

  it('selectEntry sets selected entry', () => {
    useProvenanceStore.getState().addEntry(makeEntry('e1', 'Brush'));
    useProvenanceStore.getState().selectEntry('e1');
    expect(useProvenanceStore.getState().selectedEntryId).toBe('e1');
  });

  it('selectEntry with null clears', () => {
    useProvenanceStore.getState().selectEntry('e1');
    useProvenanceStore.getState().selectEntry(null);
    expect(useProvenanceStore.getState().selectedEntryId).toBeNull();
  });

  it('entries preserve all fields', () => {
    const entry = makeEntry('e1', 'Erase', 'probabilistic');
    entry.affectedLayerIds = ['l1', 'l2'];
    entry.affectedFrameIds = ['f1', 'f2', 'f3'];
    entry.replayable = false;
    useProvenanceStore.getState().addEntry(entry);
    const stored = useProvenanceStore.getState().entries[0];
    expect(stored.operationName).toBe('Erase');
    expect(stored.kind).toBe('probabilistic');
    expect(stored.affectedLayerIds).toEqual(['l1', 'l2']);
    expect(stored.affectedFrameIds).toEqual(['f1', 'f2', 'f3']);
    expect(stored.replayable).toBe(false);
  });
});
