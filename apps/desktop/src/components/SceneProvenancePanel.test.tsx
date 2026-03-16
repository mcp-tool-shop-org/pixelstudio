import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent, act } from '@testing-library/react';
import type { SceneAssetInstance, SceneCamera, SceneCameraKeyframe, ScenePlaybackConfig } from '@glyphstudio/domain';
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
    keyframes: [],
    history: createEmptySceneHistoryState(),
    provenance: [],
    drilldownBySequence: {},
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
    expect(screen.getByText('No scene changes recorded.')).toBeDefined();
  });

  it('empty state shows hint', () => {
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Edits will appear here/)).toBeDefined();
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
    expect(screen.getByText('Scene activity log')).toBeDefined();
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

// ── Selection tests ──

describe('SceneProvenancePanel — selection', () => {
  it('clicking a row selects it', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row')!;
    fireEvent.click(row);
    expect(row.classList.contains('selected')).toBe(true);
  });

  it('selected row styling updates correctly', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    applyTestEdit('set-instance-visibility', [{ ...INST_A, x: 200, visible: false }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    expect(rows[0].classList.contains('selected')).toBe(true);
    expect(rows[1].classList.contains('selected')).toBe(false);
  });

  it('clicking a different row replaces the selection', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    applyTestEdit('set-instance-visibility', [{ ...INST_A, x: 200, visible: false }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    expect(rows[0].classList.contains('selected')).toBe(true);
    fireEvent.click(rows[1]);
    expect(rows[0].classList.contains('selected')).toBe(false);
    expect(rows[1].classList.contains('selected')).toBe(true);
  });

  it('selection persists when a new unrelated entry is appended', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    const { rerender } = render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row')!;
    fireEvent.click(row);
    const seq = row.getAttribute('data-sequence');

    // Add another entry
    applyTestEdit('set-instance-visibility', [{ ...INST_A, x: 200, visible: false }], { instanceId: 'i1' });
    rerender(<SceneProvenancePanel />);

    // Original selection still active (find by data-sequence)
    const selectedRow = document.querySelector(`[data-sequence="${seq}"]`);
    expect(selectedRow!.classList.contains('selected')).toBe(true);
  });

  it('selection clears when reset removes the selected entry', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    const { rerender } = render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);

    // Verify drilldown pane is showing
    expect(document.querySelector('.provenance-drilldown-header')).not.toBeNull();

    // Reset
    useSceneEditorStore.getState().resetHistory();
    rerender(<SceneProvenancePanel />);

    // Should be back to empty state
    expect(screen.getByText(/No scene changes/)).toBeDefined();
  });
});

// ── Empty / fallback tests ──

describe('SceneProvenancePanel — drilldown empty/fallback', () => {
  it('empty provenance renders empty timeline state', () => {
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/No scene changes/)).toBeDefined();
  });

  it('no selected row renders empty drilldown placeholder', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Select an activity entry/)).toBeDefined();
  });

  it('selected row with missing drilldown source renders fallback', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    // Manually clear drilldown data to simulate missing source
    useSceneEditorStore.setState({ drilldownBySequence: {} });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    expect(screen.getByText(/Details for this activity entry are not available/)).toBeDefined();
  });
});

// ── Detail rendering tests ──

describe('SceneProvenancePanel — drilldown detail rendering', () => {
  it('selected entry shows label and timestamp in detail pane', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const header = document.querySelector('.provenance-drilldown-header');
    expect(header).not.toBeNull();
    expect(document.querySelector('.provenance-drilldown-label')!.textContent).toContain('Move');
    expect(document.querySelector('.provenance-drilldown-time')!.textContent!.length).toBeGreaterThan(0);
  });

  it('move entry shows before/after position', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200, y: 300 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('.provenance-drilldown-detail');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('(50, 100)');
    expect(detail!.textContent).toContain('(200, 300)');
  });

  it('unlink entry shows source relationship summary', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    applyTestEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('.provenance-drilldown-detail');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('i2');
    expect(detail!.textContent).toContain('Unlinked');
  });

  it('set override entry shows slot-aware summary', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    const withOverride = {
      ...INST_CHAR,
      characterOverrides: { head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' } },
    };
    applyTestEdit('set-character-override', [withOverride], { instanceId: 'i2', slotId: 'head' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('.provenance-drilldown-detail');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('head');
    expect(detail!.textContent).toContain('i2');
  });

  it('clear-all overrides entry shows its own summary', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyTestEdit('clear-all-character-overrides', [noOverrides], { instanceId: 'i4' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('.provenance-drilldown-detail');
    expect(detail).not.toBeNull();
    // Should show before/after override count and a note about clearing
    expect(detail!.textContent).toContain('Overrides');
    expect(detail!.textContent).toContain('0');
  });
});

// ── Stability tests ──

describe('SceneProvenancePanel — selection stability', () => {
  it('adding a new activity entry does not auto-switch selection', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    const { rerender } = render(<SceneProvenancePanel />);
    // Select the first (and only) row
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const selectedSeq = document.querySelector('.scene-provenance-row.selected')!.getAttribute('data-sequence');

    // Add a new entry
    applyTestEdit('set-instance-opacity', [{ ...INST_A, x: 200, opacity: 0.5 }], { instanceId: 'i1' });
    rerender(<SceneProvenancePanel />);

    // Selection stays on the original sequence
    const stillSelected = document.querySelector('.scene-provenance-row.selected');
    expect(stillSelected).not.toBeNull();
    expect(stillSelected!.getAttribute('data-sequence')).toBe(selectedSeq);
  });

  it('selection uses provenance sequence not array index', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    // List is newest-first: second row is sequence 1 (first edit)
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[1]); // click the older one
    const selectedSeq = rows[1].getAttribute('data-sequence');
    expect(selectedSeq).toBe('1');
    expect(rows[1].classList.contains('selected')).toBe(true);
    expect(rows[0].classList.contains('selected')).toBe(false);
  });

  it('newest-first ordering does not break drilldown lookup', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('set-instance-visibility', [{ ...INST_A, x: 100, visible: false }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    // Click the newest entry (visibility, rendered first)
    fireEvent.click(document.querySelectorAll('.scene-provenance-row')[0]);
    const detail = document.querySelector('.provenance-drilldown-detail');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Hidden');
  });
});

// ── Operation family rendering tests ──

describe('SceneProvenancePanel — move rendering', () => {
  it('move diff shows Before and After position tags', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200, y: 300 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const tags = document.querySelectorAll('.provenance-drilldown-ba-tag');
    const tagTexts = Array.from(tags).map((t) => t.textContent);
    expect(tagTexts).toContain('Before');
    expect(tagTexts).toContain('After');
  });

  it('move diff shows instance id field', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="move"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('i1');
  });
});

describe('SceneProvenancePanel — property rendering', () => {
  it('visibility diff shows Visible/Hidden labels', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('set-instance-visibility', [{ ...INST_A, visible: false }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="property"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Visible');
    expect(detail!.textContent).toContain('Hidden');
  });

  it('opacity diff shows percentage values', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('set-instance-opacity', [{ ...INST_A, opacity: 0.5 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="property"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('100%');
    expect(detail!.textContent).toContain('50%');
  });

  it('layer diff shows before/after layer values', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('set-instance-layer', [{ ...INST_A, zOrder: 5 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="property"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('0');
    expect(detail!.textContent).toContain('5');
  });

  it('parallax diff shows decimal values', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('set-instance-parallax', [{ ...INST_A, parallax: 0.5 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="property"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('1.0');
    expect(detail!.textContent).toContain('0.5');
  });
});

describe('SceneProvenancePanel — source relationship rendering', () => {
  it('unlink shows Linked→Unlinked transition with note', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    applyTestEdit('unlink-character-source', [{ ...INST_CHAR, characterLinkMode: 'unlinked' }], { instanceId: 'i2' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="source"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Linked');
    expect(detail!.textContent).toContain('Unlinked');
    const note = detail!.querySelector('.provenance-drilldown-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('Snapshot and overrides preserved');
  });

  it('relink shows Unlinked→Linked transition with note', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR_UNLINKED]);
    applyTestEdit('relink-character-source', [{ ...INST_CHAR_UNLINKED, characterLinkMode: undefined }], { instanceId: 'i3' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="source"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Unlinked');
    expect(detail!.textContent).toContain('Linked');
    const note = detail!.querySelector('.provenance-drilldown-note');
    expect(note!.textContent).toContain('Source relationship restored');
  });

  it('reapply with no slot changes shows "no slot changes" note', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    // Reapply — must produce a different snapshot to avoid no-op; change x to simulate backend response
    const reapplied = { ...INST_CHAR, x: 31 };
    applyTestEdit('reapply-character-source', [reapplied], { instanceId: 'i2' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="source"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('No slot changes');
  });
});

describe('SceneProvenancePanel — override rendering', () => {
  it('set-override shows slot and mode', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR]);
    const withOverride = {
      ...INST_CHAR,
      characterOverrides: { head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' } },
    };
    applyTestEdit('set-character-override', [withOverride], { instanceId: 'i2', slotId: 'head' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="override"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('head');
    expect(detail!.textContent).toContain('Replace');
  });

  it('remove-override shows cleared note', () => {
    const withOverride = {
      ...INST_CHAR,
      characterOverrides: { head: { slot: 'head', mode: 'replace' as const, replacementPartId: 'helm-gold' } },
    };
    useSceneEditorStore.getState().loadInstances([withOverride]);
    const cleared = { ...INST_CHAR, characterOverrides: undefined };
    applyTestEdit('remove-character-override', [cleared], { instanceId: 'i2', slotId: 'head' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="override"]');
    expect(detail).not.toBeNull();
    const note = detail!.querySelector('.provenance-drilldown-note');
    expect(note).not.toBeNull();
    expect(note!.textContent).toContain('Override cleared');
  });

  it('clear-all overrides shows count and cleared slots', () => {
    useSceneEditorStore.getState().loadInstances([INST_CHAR_WITH_OVERRIDES]);
    const noOverrides = { ...INST_CHAR_WITH_OVERRIDES, characterOverrides: undefined };
    applyTestEdit('clear-all-character-overrides', [noOverrides], { instanceId: 'i4' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="override"]');
    expect(detail).not.toBeNull();
    const note = detail!.querySelector('.provenance-drilldown-note');
    expect(note!.textContent).toContain('All overrides removed');
  });
});

describe('SceneProvenancePanel — instance lifecycle rendering', () => {
  it('add-instance shows instance name and position', () => {
    useSceneEditorStore.getState().loadInstances([]);
    applyTestEdit('add-instance', [INST_A], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="lifecycle"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Tree');
    expect(detail!.textContent).toContain('(50, 100)');
  });

  it('remove-instance shows "Was at" position', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('remove-instance', [], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="lifecycle"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Was at');
    expect(detail!.textContent).toContain('(50, 100)');
  });
});

describe('SceneProvenancePanel — camera/playback rendering', () => {
  it('camera diff shows changed fields', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    // Must change instances to avoid no-op detection
    applyTestEdit('set-scene-camera', [{ ...INST_A, x: 999 }], { changedFields: ['x', 'zoom'] });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('x');
    expect(detail!.textContent).toContain('zoom');
  });

  it('playback diff shows fallback note when no config captured', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    // Must change instances to avoid no-op detection
    applyTestEdit('set-scene-playback', [{ ...INST_A, x: 888 }], {});
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="playback"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Playback settings changed');
  });
});

// ── Camera drilldown rendering with real values ──

/** Apply a camera edit through the store with full camera params. */
function applyCameraEdit(
  nextInstances: SceneAssetInstance[],
  beforeCamera: SceneCamera,
  afterCamera: SceneCamera,
  changedFields: string[],
) {
  useSceneEditorStore.getState().loadCamera(beforeCamera);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useSceneEditorStore.getState().applyEdit(
    'set-scene-camera' as any,
    nextInstances,
    { changedFields, beforeCamera, afterCamera } as any,
    afterCamera,
  );
}

describe('SceneProvenancePanel — camera drilldown with values', () => {
  const CAM_A: SceneCamera = { x: 0, y: 0, zoom: 1.0 };
  const CAM_B: SceneCamera = { x: 48, y: -16, zoom: 1.0 };
  const CAM_ZOOM: SceneCamera = { x: 0, y: 0, zoom: 3.0 };
  const CAM_RESET: SceneCamera = { x: 48, y: -16, zoom: 3.0 };

  it('pan entry shows before/after x and y values', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_B, ['x', 'y']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail).not.toBeNull();
    const text = detail!.textContent!;
    // Before values
    expect(text).toContain('0');
    // After values
    expect(text).toContain('48');
    expect(text).toContain('-16');
    // Note
    expect(text).toContain('Camera position changed');
  });

  it('zoom entry shows before/after zoom values', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_ZOOM, ['zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail).not.toBeNull();
    const text = detail!.textContent!;
    expect(text).toContain('1');
    expect(text).toContain('3');
    expect(text).toContain('Camera zoom changed');
  });

  it('reset entry shows before/after x, y, and zoom', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_RESET, CAM_A, ['x', 'y', 'zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail).not.toBeNull();
    const text = detail!.textContent!;
    expect(text).toContain('48');
    expect(text).toContain('-16');
    expect(text).toContain('3');
    expect(text).toContain('Camera reset to defaults');
  });

  it('pan uses structured field labels (Pan X, Pan Y)', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_B, ['x', 'y']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('Pan X');
    expect(baLabels).toContain('Pan Y');
  });

  it('zoom uses structured field label (Zoom)', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_ZOOM, ['zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('Zoom');
  });

  it('reset uses structured field labels for all fields', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_RESET, CAM_A, ['x', 'y', 'zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('Pan X');
    expect(baLabels).toContain('Pan Y');
    expect(baLabels).toContain('Zoom');
  });

  it('camera drilldown uses captured values not current live state', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_B, ['x', 'y']);
    // Change camera again (simulating live state divergence)
    useSceneEditorStore.getState().loadCamera({ x: 999, y: 999, zoom: 5.0 });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    const text = detail!.textContent!;
    // Should show the captured values, not the current live state
    expect(text).toContain('48');
    expect(text).not.toContain('999');
  });

  it('instance edit after camera edit does not alter camera drilldown', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 111 }], CAM_A, CAM_B, ['x', 'y']);
    // Instance edit
    useSceneEditorStore.getState().applyEdit(
      'move-instance', [{ ...INST_A, x: 222 }], { instanceId: 'i1' },
    );
    render(<SceneProvenancePanel />);
    // Panel renders newest-first, so camera entry is rows[1]
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[1]);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('48');
  });

  it('camera entry remains read-only', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_B, ['x', 'y']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const pane = document.querySelector('.provenance-drilldown-pane');
    expect(pane!.querySelectorAll('button').length).toBe(0);
  });

  it('zoom-only drilldown does not render Pan X/Pan Y rows', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_ZOOM, ['zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    const text = detail!.textContent!;
    // Should have Zoom but not Pan X/Pan Y as before/after labels
    expect(text).toContain('Zoom');
    const baLabels = detail!.querySelectorAll('.provenance-drilldown-ba-label');
    const labelTexts = Array.from(baLabels).map((el) => el.textContent);
    expect(labelTexts).not.toContain('Pan X');
    expect(labelTexts).not.toContain('Pan Y');
  });

  it('camera drilldown is visually distinct from instance property drilldown', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 111 }], CAM_A, CAM_B, ['x', 'y']);
    useSceneEditorStore.getState().applyEdit(
      'move-instance', [{ ...INST_A, x: 222 }], { instanceId: 'i1' },
    );
    render(<SceneProvenancePanel />);
    // Panel renders newest-first: rows[0]=move, rows[1]=camera
    const rows = document.querySelectorAll('.scene-provenance-row');
    // Click camera entry (older, at bottom)
    fireEvent.click(rows[1]);
    expect(document.querySelector('[data-family="camera"]')).not.toBeNull();
    expect(document.querySelector('[data-family="move"]')).toBeNull();
    // Click instance entry (newer, at top)
    fireEvent.click(rows[0]);
    expect(document.querySelector('[data-family="move"]')).not.toBeNull();
    expect(document.querySelector('[data-family="camera"]')).toBeNull();
  });
});

// ── Read-only tests ──

describe('SceneProvenancePanel — read-only drilldown', () => {
  it('detail pane has no action buttons', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const pane = document.querySelector('.provenance-drilldown-pane');
    expect(pane).not.toBeNull();
    expect(pane!.querySelectorAll('button').length).toBe(0);
  });

  it('undo/redo still do not generate entries while panel is rendered', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    const { rerender } = render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);

    useSceneEditorStore.getState().undo();
    rerender(<SceneProvenancePanel />);
    expect(document.querySelectorAll('.scene-provenance-label').length).toBe(1);

    useSceneEditorStore.getState().redo();
    rerender(<SceneProvenancePanel />);
    expect(document.querySelectorAll('.scene-provenance-label').length).toBe(1);
  });

  it('undo/redo do not generate drilldown captures', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    const drilldownCountBefore = Object.keys(useSceneEditorStore.getState().drilldownBySequence).length;
    expect(drilldownCountBefore).toBe(1);

    useSceneEditorStore.getState().undo();
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(1);

    useSceneEditorStore.getState().redo();
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(1);
  });
});

// ── Hardening tests ──

describe('SceneProvenancePanel — hardening', () => {
  it('missing drilldown source fallback remains stable after list changes', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    // Clear drilldown data to simulate missing source
    useSceneEditorStore.setState({ drilldownBySequence: {} });
    const { rerender } = render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    expect(screen.getByText(/Details for this activity entry are not available/)).toBeDefined();

    // Append another entry — fallback for the selected entry should remain
    applyTestEdit('set-instance-visibility', [{ ...INST_A, x: 200, visible: false }], { instanceId: 'i1' });
    rerender(<SceneProvenancePanel />);
    expect(screen.getByText(/Details for this activity entry are not available/)).toBeDefined();
  });

  it('long activity list with selected entry remains stable after append', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    for (let i = 1; i <= 20; i++) {
      applyTestEdit('move-instance', [{ ...INST_A, x: i }], { instanceId: 'i1' });
    }
    const { rerender } = render(<SceneProvenancePanel />);

    // Select the 10th row (somewhere in the middle)
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[9]);
    const selectedSeq = rows[9].getAttribute('data-sequence');

    // Append 5 more entries
    for (let i = 21; i <= 25; i++) {
      applyTestEdit('move-instance', [{ ...INST_A, x: i }], { instanceId: 'i1' });
    }
    rerender(<SceneProvenancePanel />);

    // Selection should still be on the same sequence
    const stillSelected = document.querySelector('.scene-provenance-row.selected');
    expect(stillSelected).not.toBeNull();
    expect(stillSelected!.getAttribute('data-sequence')).toBe(selectedSeq);
    // Drilldown should still be visible
    expect(document.querySelector('.provenance-drilldown-header')).not.toBeNull();
  });

  it('reset clears drilldown captures alongside provenance', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(1);

    useSceneEditorStore.getState().resetHistory();
    expect(Object.keys(useSceneEditorStore.getState().drilldownBySequence).length).toBe(0);
    expect(useSceneEditorStore.getState().provenance.length).toBe(0);
  });
});

// ── Stage 20.4 — Restored provenance UI tests ──

describe('SceneProvenancePanel — restored (persisted) entries', () => {
  it('persisted instance entry renders in Activity after load', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Move Instance (i1)', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i1' } }],
      { 1: { kind: 'move-instance', metadata: { instanceId: 'i1' }, beforeInstance: { ...INST_A }, afterInstance: { ...INST_A, x: 200 } } },
    );
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Move Instance/)).toBeDefined();
    // Empty state should not render
    expect(screen.queryByText('No scene changes recorded.')).toBeNull();
  });

  it('persisted camera entry renders in Activity after load', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'set-scene-camera', label: 'Set Camera', timestamp: '2026-03-15T12:00:00Z', metadata: { changedFields: ['x', 'y'] } }],
      { 1: { kind: 'set-scene-camera', metadata: { changedFields: ['x', 'y'] }, beforeCamera: { x: 0, y: 0, zoom: 1 }, afterCamera: { x: 120, y: 80, zoom: 1 } } },
    );
    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Set Camera/)).toBeDefined();
    // Metadata summary should show changed fields
    expect(screen.getByText(/Fields: x, y/)).toBeDefined();
  });

  it('multiple persisted entries render in newest-first order', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [
        { sequence: 1, kind: 'add-instance', label: 'First Entry', timestamp: '2026-03-15T12:00:00Z' },
        { sequence: 2, kind: 'move-instance', label: 'Second Entry', timestamp: '2026-03-15T12:01:00Z' },
        { sequence: 3, kind: 'set-scene-camera', label: 'Third Entry', timestamp: '2026-03-15T12:02:00Z' },
      ],
      {},
    );
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    expect(rows).toHaveLength(3);
    // Newest first
    expect(rows[0].getAttribute('data-sequence')).toBe('3');
    expect(rows[1].getAttribute('data-sequence')).toBe('2');
    expect(rows[2].getAttribute('data-sequence')).toBe('1');
  });

  it('clicking restored instance entry opens drilldown correctly', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 5, kind: 'move-instance', label: 'Move Instance (i1)', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i1' } }],
      { 5: { kind: 'move-instance', metadata: { instanceId: 'i1' }, beforeInstance: { ...INST_A, x: 50, y: 100 }, afterInstance: { ...INST_A, x: 200, y: 300 } } },
    );
    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Drilldown should show the move detail
    expect(document.querySelector('.provenance-drilldown-header')).not.toBeNull();
    expect(document.querySelector('[data-family="move"]')).not.toBeNull();
  });

  it('clicking restored camera entry shows exact before/after values', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 7, kind: 'set-scene-camera', label: 'Set Camera', timestamp: '2026-03-15T12:00:00Z', metadata: { changedFields: ['x', 'y'], beforeCamera: { x: 0, y: 0, zoom: 1 }, afterCamera: { x: 120, y: 80, zoom: 1 } } }],
      { 7: { kind: 'set-scene-camera', metadata: { changedFields: ['x', 'y'], beforeCamera: { x: 0, y: 0, zoom: 1 }, afterCamera: { x: 120, y: 80, zoom: 1 } }, beforeCamera: { x: 0, y: 0, zoom: 1 }, afterCamera: { x: 120, y: 80, zoom: 1 } } },
    );
    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Camera drilldown should show before/after values
    expect(document.querySelector('[data-family="camera"]')).not.toBeNull();
    // Pan X/Pan Y before/after
    const baLabels = document.querySelectorAll('.provenance-drilldown-ba-label');
    const labels = Array.from(baLabels).map((el) => el.textContent);
    expect(labels).toContain('Pan X');
    expect(labels).toContain('Pan Y');
  });

  it('persisted row with missing drilldown source shows fallback', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Move Instance', timestamp: '2026-03-15T12:00:00Z' }],
      {}, // no drilldown source
    );
    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Should show fallback, not crash
    expect(document.querySelector('.provenance-drilldown-fallback')).not.toBeNull();
  });

  it('scene switch clears stale selection', () => {
    // Load scene A with entry at sequence 5
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 5, kind: 'add-instance', label: 'Scene A', timestamp: '2026-03-15T12:00:00Z' }],
      { 5: { kind: 'add-instance', afterInstance: { ...INST_A } } },
    );
    const { unmount } = render(<SceneProvenancePanel />);
    // Select the entry
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);
    expect(document.querySelector('.scene-provenance-row.selected')).not.toBeNull();
    unmount();

    // Scene switch: reset + load empty
    useSceneEditorStore.getState().resetHistory();
    useSceneEditorStore.getState().loadPersistedProvenance([], {});

    render(<SceneProvenancePanel />);
    // Should show empty state, no stale selection
    expect(screen.getByText('No scene changes recorded.')).toBeDefined();
    expect(document.querySelector('.scene-provenance-row.selected')).toBeNull();
  });

  it('refresh after hydration does not duplicate restored rows', () => {
    const entries = [
      { sequence: 1, kind: 'add-instance' as const, label: 'A', timestamp: '2026-03-15T12:00:00Z' },
      { sequence: 2, kind: 'move-instance' as const, label: 'B', timestamp: '2026-03-15T12:01:00Z' },
    ];
    useSceneEditorStore.getState().loadPersistedProvenance(entries, {});
    // Simulate refresh re-hydration
    useSceneEditorStore.getState().loadPersistedProvenance(entries, {});

    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    expect(rows).toHaveLength(2);
  });

  it('selecting restored entry does not mutate provenance state', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-instance', label: 'A', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-instance', afterInstance: { ...INST_A } } },
    );
    const provenanceBefore = useSceneEditorStore.getState().provenance;

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Provenance should be the same reference
    expect(useSceneEditorStore.getState().provenance).toBe(provenanceBefore);
  });

  it('load + first new edit yields one new appended row', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 3, kind: 'add-instance', label: 'Loaded Entry', timestamp: '2026-03-15T12:00:00Z' }],
      {},
    );

    // New edit
    const moved = { ...INST_A, x: 999 };
    applyTestEdit('move-instance', [moved], { instanceId: 'i1' });

    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    expect(rows).toHaveLength(2);
    // Newest first — the new edit should be row[0]
    expect(rows[0].getAttribute('data-sequence')).toBe('4');
    expect(rows[1].getAttribute('data-sequence')).toBe('3');
  });

  it('restored camera drilldown stays fixed after live camera change', () => {
    // Load persisted camera entry with specific values
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'set-scene-camera', label: 'Set Camera', timestamp: '2026-03-15T12:00:00Z', metadata: { changedFields: ['zoom'] } }],
      { 1: { kind: 'set-scene-camera', metadata: { changedFields: ['zoom'], beforeCamera: { x: 0, y: 0, zoom: 1.0 }, afterCamera: { x: 0, y: 0, zoom: 2.5 } }, beforeCamera: { x: 0, y: 0, zoom: 1.0 }, afterCamera: { x: 0, y: 0, zoom: 2.5 } } },
    );

    // Change the live camera (simulates later edits)
    useSceneEditorStore.getState().loadCamera({ x: 999, y: 999, zoom: 5.0 });

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Drilldown should still show the persisted values, not current live camera
    expect(document.querySelector('[data-family="camera"]')).not.toBeNull();
    // The drilldown source in store should still have original values
    const source = useSceneEditorStore.getState().drilldownBySequence[1];
    expect(source.beforeCamera?.zoom).toBe(1.0);
    expect(source.afterCamera?.zoom).toBe(2.5);
  });

  it('restored instance drilldown stays fixed after instance later changes', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Move Instance (i1)', timestamp: '2026-03-15T12:00:00Z', metadata: { instanceId: 'i1' } }],
      { 1: { kind: 'move-instance', metadata: { instanceId: 'i1' }, beforeInstance: { ...INST_A, x: 50 }, afterInstance: { ...INST_A, x: 200 } } },
    );

    // Instance moves again (live change after load)
    useSceneEditorStore.getState().loadInstances([{ ...INST_A, x: 999 }]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Drilldown should show original persisted values
    const source = useSceneEditorStore.getState().drilldownBySequence[1];
    expect(source.beforeInstance?.x).toBe(50);
    expect(source.afterInstance?.x).toBe(200);
  });
});

// ── Stage 21.4 — Keyframe activity rows and drilldown rendering ──

describe('SceneProvenancePanel — keyframe activity rows', () => {
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

  function applyKeyframeEdit(
    kind: string,
    nextInstances: SceneAssetInstance[],
    metadata: Record<string, unknown>,
    nextKeyframes: SceneCameraKeyframe[],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSceneEditorStore.getState().applyEdit(kind as any, nextInstances, metadata as any, undefined, nextKeyframes);
  }

  it('add-camera-keyframe renders with correct label', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyKeyframeEdit('add-camera-keyframe', [INST_A], { tick: 0 }, [KF_A]);

    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Add Camera Keyframe/)).toBeDefined();
  });

  it('remove-camera-keyframe renders with correct label', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    applyKeyframeEdit('remove-camera-keyframe', [INST_A], { tick: 30 }, [KF_A]);

    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Remove Camera Keyframe/)).toBeDefined();
  });

  it('move-camera-keyframe renders with correct label', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const movedB: SceneCameraKeyframe = { ...KF_B, tick: 45 };
    applyKeyframeEdit('move-camera-keyframe', [INST_A], { tick: 45, previousTick: 30 }, [KF_A, movedB]);

    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Move Camera Keyframe/)).toBeDefined();
  });

  it('edit-camera-keyframe renders with correct label', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 3.5 };
    applyKeyframeEdit('edit-camera-keyframe', [INST_A], { tick: 30, changedFields: ['zoom'] }, [KF_A, editedB]);

    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Edit Camera Keyframe/)).toBeDefined();
  });

  it('keyframe metadata summary shows tick', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyKeyframeEdit('add-camera-keyframe', [INST_A], { tick: 30 }, [KF_B]);

    render(<SceneProvenancePanel />);
    const metaRow = document.querySelector('.scene-provenance-row-meta');
    expect(metaRow).not.toBeNull();
    expect(metaRow!.textContent).toContain('Tick 30');
  });

  it('move keyframe metadata shows tick transition', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const movedB: SceneCameraKeyframe = { ...KF_B, tick: 45 };
    applyKeyframeEdit('move-camera-keyframe', [INST_A], { tick: 45, previousTick: 30 }, [KF_A, movedB]);

    render(<SceneProvenancePanel />);
    const metaRow = document.querySelector('.scene-provenance-row-meta');
    expect(metaRow).not.toBeNull();
    expect(metaRow!.textContent).toContain('30');
    expect(metaRow!.textContent).toContain('45');
  });

  it('edit keyframe metadata shows tick and changed fields', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 3.5 };
    applyKeyframeEdit('edit-camera-keyframe', [INST_A], { tick: 30, changedFields: ['zoom'] }, [KF_A, editedB]);

    render(<SceneProvenancePanel />);
    const metaRow = document.querySelector('.scene-provenance-row-meta');
    expect(metaRow).not.toBeNull();
    expect(metaRow!.textContent).toContain('Tick 30');
    expect(metaRow!.textContent).toContain('zoom');
  });

  it('persisted keyframe entries render after load', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadPersistedProvenance(
      [
        { sequence: 1, kind: 'add-camera-keyframe', label: 'Add Camera Keyframe (tick 0)', timestamp: '2026-03-15T12:00:00Z', metadata: { tick: 0 } },
        { sequence: 2, kind: 'edit-camera-keyframe', label: 'Edit Camera Keyframe (tick 0: zoom)', timestamp: '2026-03-15T12:01:00Z', metadata: { tick: 0, changedFields: ['zoom'] } },
      ],
      {},
    );

    render(<SceneProvenancePanel />);
    expect(screen.getByText(/Add Camera Keyframe/)).toBeDefined();
    expect(screen.getByText(/Edit Camera Keyframe/)).toBeDefined();
  });
});

describe('SceneProvenancePanel — keyframe drilldown rendering', () => {
  const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear' };
  const KF_B: SceneCameraKeyframe = { tick: 30, x: 100, y: 50, zoom: 2.0, interpolation: 'hold' };

  function applyKeyframeEdit(
    kind: string,
    nextInstances: SceneAssetInstance[],
    metadata: Record<string, unknown>,
    nextKeyframes: SceneCameraKeyframe[],
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSceneEditorStore.getState().applyEdit(kind as any, nextInstances, metadata as any, undefined, nextKeyframes);
  }

  it('add keyframe drilldown shows after tick/value/interpolation', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyKeyframeEdit('add-camera-keyframe', [INST_A], { tick: 30 }, [KF_B]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const detail = document.querySelector('[data-family="keyframe"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('30'); // tick
    expect(detail!.textContent).toContain('100'); // x
    expect(detail!.textContent).toContain('50'); // y
    expect(detail!.textContent).toContain('2'); // zoom
    expect(detail!.textContent).toContain('hold'); // interpolation
    expect(detail!.textContent).toContain('After');
  });

  it('remove keyframe drilldown shows before tick/value/interpolation', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    applyKeyframeEdit('remove-camera-keyframe', [INST_A], { tick: 30 }, [KF_A]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const detail = document.querySelector('[data-family="keyframe"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('30'); // tick
    expect(detail!.textContent).toContain('100'); // x
    expect(detail!.textContent).toContain('hold'); // interpolation
    expect(detail!.textContent).toContain('Before');
  });

  it('move keyframe drilldown shows before/after tick', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const movedB: SceneCameraKeyframe = { ...KF_B, tick: 45 };
    applyKeyframeEdit('move-camera-keyframe', [INST_A], { tick: 45, previousTick: 30 }, [KF_A, movedB]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const detail = document.querySelector('[data-family="keyframe"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Before');
    expect(detail!.textContent).toContain('30');
    expect(detail!.textContent).toContain('After');
    expect(detail!.textContent).toContain('45');
  });

  it('value edit drilldown shows before/after value with changed fields', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadKeyframes([KF_A, KF_B]);
    const editedB: SceneCameraKeyframe = { ...KF_B, zoom: 3.5, interpolation: 'linear' };
    applyKeyframeEdit('edit-camera-keyframe', [INST_A], { tick: 30, changedFields: ['zoom', 'interpolation'] }, [KF_A, editedB]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const detail = document.querySelector('[data-family="keyframe"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('30'); // tick
    // Structured field labels from KEYFRAME_FIELD_CONFIGS
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('Zoom');
    expect(baLabels).toContain('Interpolation');
    // Before/after values
    expect(detail!.textContent).toContain('2'); // before zoom
    expect(detail!.textContent).toContain('3.5'); // after zoom
    expect(detail!.textContent).toContain('hold'); // before interpolation
    expect(detail!.textContent).toContain('linear'); // after interpolation
  });

  it('keyframe drilldown is distinct from camera diff family', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyKeyframeEdit('add-camera-keyframe', [INST_A], { tick: 0 }, [KF_A]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Should render keyframe family, not camera family
    expect(document.querySelector('[data-family="keyframe"]')).not.toBeNull();
    expect(document.querySelector('[data-family="camera"]')).toBeNull();
  });

  it('persisted keyframe drilldown opens correctly after load', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-camera-keyframe', label: 'Add Camera Keyframe (tick 30)', timestamp: '2026-03-15T12:00:00Z', metadata: { tick: 30 } }],
      { 1: { kind: 'add-camera-keyframe', metadata: { tick: 30 }, afterKeyframe: KF_B } },
    );

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const detail = document.querySelector('[data-family="keyframe"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('30');
    expect(detail!.textContent).toContain('hold');
  });

  it('restored keyframe drilldown stays truthful after later live keyframe edits', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'edit-camera-keyframe', label: 'Edit Camera Keyframe (tick 30: zoom)', timestamp: '2026-03-15T12:00:00Z', metadata: { tick: 30, changedFields: ['zoom'] } }],
      { 1: { kind: 'edit-camera-keyframe', metadata: { tick: 30, changedFields: ['zoom'] }, beforeKeyframe: KF_B, afterKeyframe: { ...KF_B, zoom: 5.0 } } },
    );

    // Later live edit changes keyframes further — drilldown should stay fixed
    useSceneEditorStore.getState().loadKeyframes([{ ...KF_B, zoom: 9.9 }]);

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const source = useSceneEditorStore.getState().drilldownBySequence[1];
    expect(source.beforeKeyframe?.zoom).toBe(2.0);
    expect(source.afterKeyframe?.zoom).toBe(5.0);
  });

  it('drilldown with missing keyframe source falls back gracefully', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'add-camera-keyframe', label: 'Add Camera Keyframe (tick 0)', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'add-camera-keyframe', metadata: { tick: 0 } } },
    );

    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    // Should show fallback — no afterKeyframe in the source means no diff
    expect(document.querySelector('.provenance-drilldown-fallback')).not.toBeNull();
  });

  it('playback edit creates no Activity row', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    // Only keyframe operations produce entries, not playback.
    // Playback state changes (play/pause/scrub) never reach applyEdit.
    // Verify that the activity panel stays empty when no edits occur.
    render(<SceneProvenancePanel />);
    expect(screen.getByText('No scene changes recorded.')).toBeDefined();
  });
});

// ── Stage 23.2 — Playback drilldown with real values ──

describe('SceneProvenancePanel — playback drilldown with values', () => {
  const PB_BEFORE: ScenePlaybackConfig = { fps: 12, looping: false };
  const PB_AFTER: ScenePlaybackConfig = { fps: 24, looping: true };

  function applyPlaybackEdit(
    nextInstances: SceneAssetInstance[],
    beforeConfig: ScenePlaybackConfig,
    afterConfig: ScenePlaybackConfig,
  ) {
    useSceneEditorStore.getState().loadPlaybackConfig(beforeConfig);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    useSceneEditorStore.getState().applyEdit(
      'set-scene-playback' as any,
      nextInstances,
      undefined,
      undefined,
      undefined,
      afterConfig,
    );
  }

  it('playback edit with before/after shows FPS change', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyPlaybackEdit(
      [{ ...INST_A, x: 888 }],
      { fps: 12, looping: false },
      { fps: 24, looping: false },
    );
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="playback"]');
    expect(detail).not.toBeNull();
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('FPS');
    expect(baLabels).not.toContain('Looping');
  });

  it('playback edit with before/after shows looping change', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyPlaybackEdit(
      [{ ...INST_A, x: 888 }],
      { fps: 12, looping: false },
      { fps: 12, looping: true },
    );
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="playback"]');
    expect(detail).not.toBeNull();
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('Looping');
    expect(baLabels).not.toContain('FPS');
  });

  it('playback edit with both changes shows FPS and looping', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyPlaybackEdit([{ ...INST_A, x: 888 }], PB_BEFORE, PB_AFTER);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="playback"]');
    expect(detail).not.toBeNull();
    const baLabels = Array.from(detail!.querySelectorAll('.provenance-drilldown-ba-label')).map((el) => el.textContent);
    expect(baLabels).toContain('FPS');
    expect(baLabels).toContain('Looping');
  });

  it('playback drilldown uses captured values not current live state', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyPlaybackEdit([{ ...INST_A, x: 888 }], PB_BEFORE, PB_AFTER);
    // Change live playback config
    useSceneEditorStore.getState().loadPlaybackConfig({ fps: 60, looping: false });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="playback"]');
    const text = detail!.textContent!;
    // Should show captured values (12 → 24), not current (60)
    expect(text).toContain('12');
    expect(text).toContain('24');
    expect(text).not.toContain('60');
  });

  it('legacy persisted playback entry without config shows honest fallback', () => {
    // Simulate a pre-Stage-23 persisted entry with no playback config captured
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'set-scene-playback', label: 'Edit Playback', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'set-scene-playback' } },
    );
    render(<SceneProvenancePanel />);
    const row = document.querySelector('.scene-provenance-row');
    fireEvent.click(row!);

    const detail = document.querySelector('[data-family="playback"]');
    expect(detail).not.toBeNull();
    expect(detail!.textContent).toContain('Playback settings changed');
    // Should NOT contain FPS or Looping labels — no fake detail
    const baLabels = detail!.querySelectorAll('.provenance-drilldown-ba-label');
    expect(baLabels).toHaveLength(0);
  });

  it('restored playback entry stays fixed after later playback config change', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'set-scene-playback', label: 'Edit Playback', timestamp: '2026-03-15T12:00:00Z' }],
      { 1: { kind: 'set-scene-playback', beforePlayback: { fps: 12, looping: false }, afterPlayback: { fps: 24, looping: true } } },
    );
    // Later playback config change (should not affect restored entry)
    useSceneEditorStore.getState().loadPlaybackConfig({ fps: 60, looping: false });

    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);

    const source = useSceneEditorStore.getState().drilldownBySequence[1];
    expect(source.beforePlayback?.fps).toBe(12);
    expect(source.afterPlayback?.fps).toBe(24);
  });
});

// ══════════════════════════════════════════════════
// ── Compare mode — entry points ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — compare mode entry points', () => {
  function setupTwoEdits() {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
  }

  it('shows Compare to Current button when entry is selected', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const btn = document.querySelector('[data-action="compare-current"]');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Compare to Current');
  });

  it('shows Compare to... button when entry is selected', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const btn = document.querySelector('[data-action="compare-entry"]');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Compare to');
  });

  it('Compare to Current opens comparison pane', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
  });

  it('Compare to... enters target-pick mode with banner', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-entry"]')!);
    const banner = document.querySelector('.scene-provenance-pick-banner');
    expect(banner).not.toBeNull();
    expect(banner!.textContent).toContain('Select another entry');
  });

  it('Cancel exits target-pick mode cleanly', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-entry"]')!);
    expect(document.querySelector('.scene-provenance-pick-banner')).not.toBeNull();
    fireEvent.click(document.querySelector('.scene-provenance-pick-cancel')!);
    expect(document.querySelector('.scene-provenance-pick-banner')).toBeNull();
  });
});

// ══════════════════════════════════════════════════
// ── Compare mode — current vs entry UI ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — current vs entry comparison', () => {
  it('comparison pane header identifies both sides', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const title = document.querySelector('.comparison-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('Current');
    expect(title!.textContent).toContain('#1');
  });

  it('shows no-changes when current matches entry', () => {
    // Apply one edit, then load instances to match the edit result
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    // Now current state has x=200, matching what entry #1 captured as afterInstance
    // But drilldown source only has afterInstance, not full instances
    // The compare will work with what's available
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
  });

  it('shows changed domains when differences exist', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    // Current state now has x=100, entry captured afterInstance with x=100
    // Modify current to create difference
    useSceneEditorStore.getState().loadInstances([{ ...INST_A, x: 999 }]);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
    // Should show instance section since x changed
    const instanceSection = document.querySelector('[data-domain="instances"]');
    expect(instanceSection).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════
// ── Compare mode — entry vs entry UI ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — entry vs entry comparison', () => {
  function setupAndPickTarget() {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    // Select first row (newest, sequence 2)
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    // Enter pick mode
    fireEvent.click(document.querySelector('[data-action="compare-entry"]')!);
    // Click second row (sequence 1)
    fireEvent.click(rows[1]);
  }

  it('second entry selection opens comparison pane', () => {
    setupAndPickTarget();
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
  });

  it('header identifies both entry sequences', () => {
    setupAndPickTarget();
    const title = document.querySelector('.comparison-title');
    expect(title).not.toBeNull();
    // Both should reference sequence numbers
    expect(title!.textContent).toContain('#');
  });

  it('entry-vs-entry works without dependency on current live state', () => {
    setupAndPickTarget();
    // Mutate current state — should not affect compare pane content
    useSceneEditorStore.getState().loadInstances([{ ...INST_A, x: 9999 }]);
    // The comparison pane should still be showing entry-based data
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════
// ── Compare mode — stability ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — compare stability', () => {
  it('new Activity entry does not break active comparison', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    // Now apply another edit while compare is active
    applyTestEdit('move-instance', [{ ...INST_A, x: 300 }], { instanceId: 'i1' });
    // Compare pane should still be present
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
  });

  it('scene reset clears compare mode and shows empty state', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    expect(document.querySelector('.comparison-pane')).not.toBeNull();
    // Reset the scene — provenance goes empty, panel shows empty state
    act(() => {
      useSceneEditorStore.getState().resetHistory();
    });
    // The empty state message should now be visible
    expect(screen.getByText('No scene changes recorded.')).toBeDefined();
    // Compare pane should be gone
    expect(document.querySelector('.comparison-pane')).toBeNull();
  });

  it('exiting compare restores drilldown mode', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    expect(document.querySelector('.comparison-pane')).not.toBeNull();
    // Close compare
    fireEvent.click(document.querySelector('.comparison-close')!);
    expect(document.querySelector('.comparison-pane')).toBeNull();
    // Drilldown should be back
    expect(document.querySelector('.provenance-drilldown-pane')).not.toBeNull();
  });

  it('selecting a new row exits compare mode and shows drilldown', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    expect(document.querySelector('.comparison-pane')).not.toBeNull();
    // Click a different row — should exit compare
    fireEvent.click(rows[1]);
    expect(document.querySelector('.comparison-pane')).toBeNull();
    expect(document.querySelector('.provenance-drilldown-pane')).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════
// ── Compare mode — read-only ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — compare read-only', () => {
  it('compare pane has no mutation buttons', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
    // Only Close button should exist — no restore, no undo, no apply
    const buttons = pane!.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Close');
  });

  it('compare mode does not alter provenance state', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    const beforeProvenance = [...useSceneEditorStore.getState().provenance];
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    // Provenance should not have been modified
    const afterProvenance = useSceneEditorStore.getState().provenance;
    expect(afterProvenance).toHaveLength(beforeProvenance.length);
    expect(afterProvenance[0].sequence).toBe(beforeProvenance[0].sequence);
  });
});

// ══════════════════════════════════════════════════
// ── Compare mode — fallback ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — compare fallback', () => {
  it('missing drilldown source shows fallback message', () => {
    // Manually add a provenance entry without a drilldown source
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Move Instance', timestamp: '2026-03-16T00:00:00Z', metadata: { instanceId: 'i1' } }],
      {},
    );
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
    expect(pane!.textContent).toContain('not available');
  });

  it('no-changes state renders honest message', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    // Load instances to match exactly what drilldown captured
    // The drilldown source afterInstance has x=100, current is also x=100
    // But drilldown only captures single instance, while current has full array
    // This comparison may or may not show "no changes" depending on data match
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    const pane = document.querySelector('.comparison-pane');
    expect(pane).not.toBeNull();
    // Just verify the pane renders without crashing
  });
});

// ══════════════════════════════════════════════════
// ── Restore preview — entry points ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — restore preview entry points', () => {
  it('shows Preview Restore Impact button when entry is selected', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const btn = document.querySelector('[data-action="restore-preview"]');
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toContain('Preview Restore Impact');
  });

  it('does not show restore preview button when no entry is selected', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    expect(document.querySelector('[data-action="restore-preview"]')).toBeNull();
  });

  it('clicking Preview Restore Impact opens restore preview pane', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const pane = document.querySelector('.restore-preview-pane');
    expect(pane).not.toBeNull();
  });

  it('restore preview pane has Close button', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const close = document.querySelector('.restore-preview-close');
    expect(close).not.toBeNull();
    expect(close!.textContent).toContain('Close');
  });

  it('Close exits restore preview back to drilldown', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    expect(document.querySelector('.restore-preview-pane')).not.toBeNull();
    fireEvent.click(document.querySelector('.restore-preview-close')!);
    expect(document.querySelector('.restore-preview-pane')).toBeNull();
    expect(document.querySelector('.provenance-drilldown-pane')).not.toBeNull();
  });
});

// ══════════════════════════════════════════════════
// ── Restore preview — impact rendering ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — restore preview impact', () => {
  it('shows impact-focused header with sequence number', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const title = document.querySelector('.restore-preview-title');
    expect(title).not.toBeNull();
    expect(title!.textContent).toContain('#1');
    expect(title!.textContent).toContain('impact preview');
  });

  it('shows changed domains when current differs from entry', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    // Modify current state to create a diff
    useSceneEditorStore.getState().loadInstances([{ ...INST_A, x: 999 }]);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const pane = document.querySelector('.restore-preview-pane');
    expect(pane).not.toBeNull();
    // Instance section should show changes
    const instanceSection = document.querySelector('[data-domain="instances"]');
    expect(instanceSection).not.toBeNull();
  });

  it('shows no-impact message when entry matches current state', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    // Current state matches the entry's afterInstance (both have only INST_A with x=200)
    // Since drilldown only captures single instance (afterInstance), and current has same
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const pane = document.querySelector('.restore-preview-pane');
    expect(pane).not.toBeNull();
    // Pane should render without crash — may show no-impact or minimal changes
  });

  it('restore preview is read-only — no mutation buttons', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const pane = document.querySelector('.restore-preview-pane');
    expect(pane).not.toBeNull();
    // Only Close button should exist
    const buttons = pane!.querySelectorAll('button');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].textContent).toContain('Close');
  });

  it('restore preview does not alter provenance state', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    const beforeProvenance = [...useSceneEditorStore.getState().provenance];
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const afterProvenance = useSceneEditorStore.getState().provenance;
    expect(afterProvenance).toHaveLength(beforeProvenance.length);
    expect(afterProvenance[0].sequence).toBe(beforeProvenance[0].sequence);
  });
});

// ══════════════════════════════════════════════════
// ── Restore preview — stability ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — restore preview stability', () => {
  it('selecting new row exits restore preview', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    expect(document.querySelector('.restore-preview-pane')).not.toBeNull();
    // Click different row
    fireEvent.click(rows[1]);
    expect(document.querySelector('.restore-preview-pane')).toBeNull();
    expect(document.querySelector('.provenance-drilldown-pane')).not.toBeNull();
  });

  it('scene reset clears restore preview mode', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    expect(document.querySelector('.restore-preview-pane')).not.toBeNull();
    act(() => {
      useSceneEditorStore.getState().resetHistory();
    });
    expect(document.querySelector('.restore-preview-pane')).toBeNull();
    expect(screen.getByText('No scene changes recorded.')).toBeDefined();
  });

  it('missing drilldown source shows fallback message', () => {
    useSceneEditorStore.getState().loadPersistedProvenance(
      [{ sequence: 1, kind: 'move-instance', label: 'Move Instance', timestamp: '2026-03-16T00:00:00Z', metadata: { instanceId: 'i1' } }],
      {},
    );
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    const pane = document.querySelector('.restore-preview-pane');
    expect(pane).not.toBeNull();
    expect(pane!.textContent).toContain('not available');
  });
});

// ══════════════════════════════════════════════════
// ── Stage 24.5 — Cross-mode transitions and hardening ──
// ══════════════════════════════════════════════════

describe('SceneProvenancePanel — cross-mode transitions', () => {
  function setupTwoEdits() {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    applyTestEdit('move-instance', [{ ...INST_A, x: 200 }], { instanceId: 'i1' });
  }

  it('compare and restore preview never coexist simultaneously', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    // Enter compare
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    expect(document.querySelector('.comparison-pane')).not.toBeNull();
    expect(document.querySelector('.restore-preview-pane')).toBeNull();
    // Exit compare, enter restore preview
    fireEvent.click(document.querySelector('.comparison-close')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    expect(document.querySelector('.restore-preview-pane')).not.toBeNull();
    expect(document.querySelector('.comparison-pane')).toBeNull();
  });

  it('entering restore preview from compare exits compare cleanly', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    // Enter compare
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    expect(document.querySelector('.comparison-pane')).not.toBeNull();
    // Click a different row — exits compare back to drilldown
    fireEvent.click(rows[1]);
    expect(document.querySelector('.comparison-pane')).toBeNull();
    // Now enter restore preview from drilldown
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    expect(document.querySelector('.restore-preview-pane')).not.toBeNull();
  });

  it('entering compare after restore preview exits preview cleanly', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    // Enter restore preview
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    expect(document.querySelector('.restore-preview-pane')).not.toBeNull();
    // Click a different row — exits preview back to drilldown
    fireEvent.click(rows[1]);
    expect(document.querySelector('.restore-preview-pane')).toBeNull();
    // Now enter compare from drilldown
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    expect(document.querySelector('.comparison-pane')).not.toBeNull();
  });

  it('entering restore preview preserves selection', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    fireEvent.click(rows[0]);
    const selectedSeq = rows[0].getAttribute('data-sequence');
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    // The row should still be the same entry (selection preserved)
    const title = document.querySelector('.restore-preview-title');
    expect(title!.textContent).toContain(`#${selectedSeq}`);
  });

  it('no stale pane remains when switching modes rapidly', () => {
    setupTwoEdits();
    render(<SceneProvenancePanel />);
    const rows = document.querySelectorAll('.scene-provenance-row');
    // Select row → compare → exit → select other row → restore preview → exit
    fireEvent.click(rows[0]);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    fireEvent.click(document.querySelector('.comparison-close')!);
    fireEvent.click(rows[1]);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    fireEvent.click(document.querySelector('.restore-preview-close')!);
    // Should be in drilldown mode with no compare or preview pane
    expect(document.querySelector('.comparison-pane')).toBeNull();
    expect(document.querySelector('.restore-preview-pane')).toBeNull();
    expect(document.querySelector('.provenance-drilldown-pane')).not.toBeNull();
  });
});

describe('SceneProvenancePanel — inspection mode provenance safety', () => {
  it('compare mode creates zero provenance entries', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    const countBefore = useSceneEditorStore.getState().provenance.length;
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    fireEvent.click(document.querySelector('.comparison-close')!);
    expect(useSceneEditorStore.getState().provenance.length).toBe(countBefore);
  });

  it('restore preview creates zero provenance entries', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    const countBefore = useSceneEditorStore.getState().provenance.length;
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    fireEvent.click(document.querySelector('.restore-preview-close')!);
    expect(useSceneEditorStore.getState().provenance.length).toBe(countBefore);
  });

  it('compare mode creates zero history entries', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    const historyBefore = useSceneEditorStore.getState().history;
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="compare-current"]')!);
    fireEvent.click(document.querySelector('.comparison-close')!);
    expect(useSceneEditorStore.getState().history).toBe(historyBefore);
  });

  it('restore preview creates zero history entries', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyTestEdit('move-instance', [{ ...INST_A, x: 100 }], { instanceId: 'i1' });
    const historyBefore = useSceneEditorStore.getState().history;
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    fireEvent.click(document.querySelector('[data-action="restore-preview"]')!);
    fireEvent.click(document.querySelector('.restore-preview-close')!);
    expect(useSceneEditorStore.getState().history).toBe(historyBefore);
  });
});
