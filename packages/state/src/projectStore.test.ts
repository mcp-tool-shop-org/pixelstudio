import { describe, it, expect, beforeEach } from 'vitest';
import { useProjectStore } from './projectStore';

beforeEach(() => {
  useProjectStore.setState({
    projectId: null,
    name: 'Untitled',
    filePath: null,
    isDirty: false,
    saveStatus: 'idle',
    colorMode: 'rgb',
    canvasSize: { width: 64, height: 64 },
    activePaletteContractId: null,
  });
});

describe('markDirty / markSaved', () => {
  it('marks project as dirty', () => {
    useProjectStore.getState().markDirty();
    expect(useProjectStore.getState().isDirty).toBe(true);
    expect(useProjectStore.getState().saveStatus).toBe('idle');
  });

  it('markSaved clears dirty flag', () => {
    useProjectStore.getState().markDirty();
    useProjectStore.getState().markSaved();
    expect(useProjectStore.getState().isDirty).toBe(false);
    expect(useProjectStore.getState().saveStatus).toBe('saved');
  });

  it('markSaved optionally updates filePath', () => {
    useProjectStore.getState().markSaved('/new/path.pxs');
    expect(useProjectStore.getState().filePath).toBe('/new/path.pxs');
  });

  it('markSaved preserves existing filePath when none provided', () => {
    useProjectStore.getState().setFilePath('/original/path.pxs');
    useProjectStore.getState().markSaved();
    expect(useProjectStore.getState().filePath).toBe('/original/path.pxs');
  });
});

describe('setProject', () => {
  it('initializes project state and clears dirty', () => {
    useProjectStore.getState().markDirty();
    useProjectStore.getState().setProject('proj-1', 'Test', '/file.pxs', 'indexed', 32, 32);
    const s = useProjectStore.getState();
    expect(s.projectId).toBe('proj-1');
    expect(s.name).toBe('Test');
    expect(s.filePath).toBe('/file.pxs');
    expect(s.colorMode).toBe('indexed');
    expect(s.canvasSize).toEqual({ width: 32, height: 32 });
    expect(s.isDirty).toBe(false);
    expect(s.saveStatus).toBe('idle');
  });
});

describe('setColorMode', () => {
  it('marks project dirty on color mode change', () => {
    useProjectStore.getState().setColorMode('indexed');
    expect(useProjectStore.getState().colorMode).toBe('indexed');
    expect(useProjectStore.getState().isDirty).toBe(true);
  });
});

describe('saveStatus lifecycle', () => {
  it('follows idle → saving → saved flow', () => {
    const store = useProjectStore;
    expect(store.getState().saveStatus).toBe('idle');
    store.getState().setSaveStatus('saving');
    expect(store.getState().saveStatus).toBe('saving');
    store.getState().markSaved();
    expect(store.getState().saveStatus).toBe('saved');
  });

  it('setSaveStatus can set error', () => {
    useProjectStore.getState().setSaveStatus('error');
    expect(useProjectStore.getState().saveStatus).toBe('error');
  });
});
