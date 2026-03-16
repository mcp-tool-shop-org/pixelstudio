import { describe, it, expect, beforeEach } from 'vitest';
import { useSnapshotStore } from './snapshotStore';

function getState() {
  return useSnapshotStore.getState();
}

const SAMPLE_DATA = [255, 0, 0, 255, 0, 255, 0, 255];

beforeEach(() => {
  useSnapshotStore.setState({ snapshots: [] });
});

describe('snapshotStore — createSnapshot', () => {
  it('creates a snapshot with correct fields', () => {
    const id = getState().createSnapshot('Test', 2, 1, SAMPLE_DATA);
    const snap = getState().snapshots.find((s) => s.id === id)!;
    expect(snap).toBeDefined();
    expect(snap.name).toBe('Test');
    expect(snap.width).toBe(2);
    expect(snap.height).toBe(1);
    expect(snap.data).toEqual(SAMPLE_DATA);
    expect(snap.createdAt).toBeTruthy();
  });

  it('returns a unique id', () => {
    const id1 = getState().createSnapshot('A', 1, 1, [0, 0, 0, 0]);
    const id2 = getState().createSnapshot('B', 1, 1, [0, 0, 0, 0]);
    expect(id1).not.toBe(id2);
  });

  it('deep-copies pixel data', () => {
    const data = [10, 20, 30, 255];
    getState().createSnapshot('Copy', 1, 1, data);
    data[0] = 999;
    expect(getState().snapshots[0].data[0]).toBe(10);
  });

  it('appends snapshots in order', () => {
    getState().createSnapshot('First', 1, 1, [0, 0, 0, 0]);
    getState().createSnapshot('Second', 1, 1, [0, 0, 0, 0]);
    expect(getState().snapshots).toHaveLength(2);
    expect(getState().snapshots[0].name).toBe('First');
    expect(getState().snapshots[1].name).toBe('Second');
  });
});

describe('snapshotStore — deleteSnapshot', () => {
  it('removes a snapshot by id', () => {
    const id = getState().createSnapshot('ToDelete', 1, 1, [0, 0, 0, 0]);
    expect(getState().snapshots).toHaveLength(1);
    getState().deleteSnapshot(id);
    expect(getState().snapshots).toHaveLength(0);
  });

  it('no-ops for unknown id', () => {
    getState().createSnapshot('Keep', 1, 1, [0, 0, 0, 0]);
    getState().deleteSnapshot('nonexistent');
    expect(getState().snapshots).toHaveLength(1);
  });

  it('only removes the targeted snapshot', () => {
    getState().createSnapshot('A', 1, 1, [0, 0, 0, 0]);
    const id = getState().createSnapshot('B', 1, 1, [0, 0, 0, 0]);
    getState().createSnapshot('C', 1, 1, [0, 0, 0, 0]);
    getState().deleteSnapshot(id);
    expect(getState().snapshots.map((s) => s.name)).toEqual(['A', 'C']);
  });
});

describe('snapshotStore — renameSnapshot', () => {
  it('renames a snapshot', () => {
    const id = getState().createSnapshot('Old', 1, 1, [0, 0, 0, 0]);
    getState().renameSnapshot(id, 'New');
    expect(getState().snapshots[0].name).toBe('New');
  });

  it('trims whitespace from name', () => {
    const id = getState().createSnapshot('A', 1, 1, [0, 0, 0, 0]);
    getState().renameSnapshot(id, '  Trimmed  ');
    expect(getState().snapshots[0].name).toBe('Trimmed');
  });

  it('keeps old name if new name is empty', () => {
    const id = getState().createSnapshot('Keep', 1, 1, [0, 0, 0, 0]);
    getState().renameSnapshot(id, '');
    expect(getState().snapshots[0].name).toBe('Keep');
  });

  it('no-ops for unknown id', () => {
    getState().createSnapshot('A', 1, 1, [0, 0, 0, 0]);
    getState().renameSnapshot('nonexistent', 'B');
    expect(getState().snapshots[0].name).toBe('A');
  });
});

describe('snapshotStore — clearAll', () => {
  it('removes all snapshots', () => {
    getState().createSnapshot('A', 1, 1, [0, 0, 0, 0]);
    getState().createSnapshot('B', 1, 1, [0, 0, 0, 0]);
    getState().clearAll();
    expect(getState().snapshots).toHaveLength(0);
  });
});
