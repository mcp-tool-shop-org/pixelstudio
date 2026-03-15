import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { SceneAssetInstance } from '@glyphstudio/domain';
import { useSceneEditorStore, createEmptySceneHistoryState, resetProvenanceSequence } from '@glyphstudio/state';
import { SceneProvenancePanel } from './SceneProvenancePanel';

// ── Fixtures ──

const INST_A: SceneAssetInstance = {
  instanceId: 'i1',
  name: 'Tree',
  sourcePath: '/assets/tree.pxs',
  x: 50,
  y: 100,
  zOrder: 0,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
};

const INST_CHAR: SceneAssetInstance = {
  instanceId: 'i2',
  name: 'Knight',
  sourcePath: '',
  x: 30,
  y: 40,
  zOrder: 3,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
  instanceKind: 'character',
  sourceCharacterBuildId: 'build-1',
  sourceCharacterBuildName: 'Knight Build',
  characterSlotSnapshot: {
    slots: { head: 'helm-iron', torso: 'plate-steel' },
    equippedCount: 2,
    totalSlots: 12,
  },
};

const INST_CHAR_UNLINKED: SceneAssetInstance = {
  ...INST_CHAR,
  instanceId: 'i3',
  name: 'Rogue',
  characterLinkMode: 'unlinked',
};

const INST_CHAR_WITH_OVERRIDES: SceneAssetInstance = {
  ...INST_CHAR,
  instanceId: 'i4',
  name: 'Paladin',
  characterOverrides: {
    head: { slot: 'head', mode: 'replace', replacementPartId: 'helm-gold' },
    torso: { slot: 'torso', mode: 'remove' },
  },
};

// ── Setup ──

beforeEach(() => {
  resetProvenanceSequence();
  useSceneEditorStore.setState({
    instances: [],
    history: createEmptySceneHistoryState(),
    provenance: [],
    canUndo: false,
    canRedo: false,
  });
});

afterEach(() => {
  cleanup();
});

// ── Helper ──

function applyTestEdit(
  kind: string,
  nextInstances: SceneAssetInstance[],
  metadata?: Record<string, unknown>,
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSceneEditorStore.getState().applyEdit(kind as any, nextInstances, metadata as any);
}

// ── Rendering tests ──

describe('SceneProvenancePanel — rendering', () => {
  it('empty state renders when provenance is empty', () => {
    render(<SceneProvenancePanel />);
    expect(screen.getByText('No scene changes recorded yet.')).toBeDefined();
  });

  it('empty state shows session hint', () => {
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Edits you make this session/)).toBeDefined();
  });

  it('single provenance entry renders label', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Move Instance/)).toBeDefined();
  });

  it('single provenance entry renders timestamp', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    // Timestamp should be rendered (HH:MM:SS format)
    const timeElements = document.querySelectorAll('.scene-provenance-time');
    expect(timeElements.length).toBe(1);
    expect(timeElements[0].textContent!.length).toBeGreaterThan(0);
  });

  it('multiple entries render in newest-first order', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('set-instance-visibility', [{ ...INST_A, x: 100, visible: false }], { instanceId: 'i1' });
    applyTestEdit('set-instance-opacity', [{ ...INST_A, x: 100, visible: false, opacity: 0.5 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const labels = document.querySelectorAll('.scene-provenance-label');
    expect(labels.length).toBe(3);
    // Newest first: opacity → visibility → move
    expect(labels[0].textContent).toContain('Opacity');
    expect(labels[1].textContent).toContain('Visibility');
    expect(labels[2].textContent).toContain('Move');
  });

  it('shows entry count badge', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    expect(screen.getByText('2')).toBeDefined();
  });
});

// ── Distinctness tests ──

describe('SceneProvenancePanel — label distinctness', () => {
  it('unlink, relink, reapply render distinct labels', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    applyTestEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    applyTestEdit('relink-character-source', [{ ...INST_CHAR, characterLinkMode: undefined }], { instanceId: 'i2' });
    const reapplied = { ...INST_CHAR, characterSlotSnapshot: { slots: { head: 'helm-v2' }, equippedCount: 1, totalSlots: 12 } };
    applyTestEdit('reapply-character-source', [reapplied], { instanceId: 'i2' });
    render(<SceneProvenancePanel />);
    const labels = document.querySelectorAll('.scene-provenance-label');
    const texts = Array.from(labels).map((el) => el.textContent);
    const unique = new Set(texts);
    expect(unique.size).toBe(3);
  });

  it('set/remove override render distinct labels', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    applyTestEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES], { instanceId: 'i2', slotId: 'head' });
    const cleared = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyTestEdit('remove-character-override', [cleared], { instanceId: 'i4', slotId: 'head' });
    render(<SceneProvenancePanel />);
    const labels = document.querySelectorAll('.scene-provenance-label');
    expect(labels[0].textContent).not.toBe(labels[1].textContent);
  });

  it('clear-all overrides renders its own label', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyTestEdit('clear-all-character-overrides', [noOverrides], { instanceId: 'i4' });
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Clear All Overrides/)).toBeDefined();
  });
});

// ── Metadata tests ──

describe('SceneProvenancePanel — metadata display', () => {
  it('instance-targeted entry shows instance id', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const meta = document.querySelector('.scene-provenance-row-meta');
    expect(meta).not.toBeNull();
    expect(meta!.textContent).toContain('i1');
  });

  it('override entry shows slot id', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    applyTestEdit('set-character-override', [INST_CHAR_WITH_OVERRIDES], { instanceId: 'i2', slotId: 'head' });
    render(<SceneProvenancePanel />);
    const meta = document.querySelector('.scene-provenance-row-meta');
    expect(meta!.textContent).toContain('head');
    expect(meta!.textContent).toContain('Slot');
  });

  it('entry without metadata renders cleanly', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }]);
    render(<SceneProvenancePanel />);
    const meta = document.querySelector('.scene-provenance-row-meta');
    expect(meta).toBeNull();
  });

  it('changedFields render for camera entries', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('set-scene-camera', [{ ...INST_A, x: 10 }], { changedFields: ['x', 'zoom'] });
    render(<SceneProvenancePanel />);
    const meta = document.querySelector('.scene-provenance-row-meta');
    expect(meta!.textContent).toContain('x');
    expect(meta!.textContent).toContain('zoom');
  });
});

// ── Live update tests ──

describe('SceneProvenancePanel — live updates', () => {
  it('successful edit appears in timeline', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    const { rerender } = render(<SceneProvenancePanel />);
    expect(screen.getByText(/No scene changes/)).toBeDefined();

    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    rerender(<SceneProvenancePanel />);
    expect(screen.getByText(/Move Instance/)).toBeDefined();
  });

  it('no-op edit does not appear', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [INST_A], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/No scene changes/)).toBeDefined();
  });

  it('undo does not add timeline entry', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    useSceneEditorStore.getState().undo();
    render(<SceneProvenancePanel />);
    const labels = document.querySelectorAll('.scene-provenance-label');
    expect(labels.length).toBe(1);
  });

  it('redo does not add timeline entry', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    useSceneEditorStore.getState().undo();
    useSceneEditorStore.getState().redo();
    render(<SceneProvenancePanel />);
    const labels = document.querySelectorAll('.scene-provenance-label');
    expect(labels.length).toBe(1);
  });

  it('loadInstances refresh does not add entry', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadInstances([{ ...INST_A, x: 999 }]);
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/No scene changes/)).toBeDefined();
  });
});

// ── UI sanity tests ──

describe('SceneProvenancePanel — UI sanity', () => {
  it('panel is read-only (no buttons in entries)', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    for (const row of rows) {
      expect(row.querySelectorAll('button').length).toBe(0);
    }
  });

  it('panel does not crash with many entries', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    for (let i = 1; i <= 50; i++) {
      applyTestEdit('move-instance', [{ ...INST_A, x: i }], { instanceId: 'i1' });
    }
    render(<SceneProvenancePanel />);
    const labels = document.querySelectorAll('.scene-provenance-label');
    expect(labels.length).toBe(50);
  });

  it('session-scoped footer is visible', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    expect(screen.getByText('Session activity only')).toBeDefined();
  });

  it('long instance ids truncate with ellipsis class', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'very-long-instance-id-that-should-truncate' });
    render(<SceneProvenancePanel />);
    const meta = document.querySelector('.scene-provenance-row-meta');
    expect(meta).not.toBeNull();
    expect(meta!.getAttribute('title')).toContain('very-long-instance-id');
  });
});
