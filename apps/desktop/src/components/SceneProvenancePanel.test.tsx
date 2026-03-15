import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { SceneAssetInstance, SceneCamera } from '@glyphstudio/domain';
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

  it('playback diff shows note', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    // Must change instances to avoid no-op detection
    applyTestEdit('set-scene-playback', [{ ...INST_A, x: 888 }], {});
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
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

  it('changed fields summary renders correctly for pan', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_B, ['x', 'y']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail!.textContent).toContain('x, y');
  });

  it('changed fields summary renders correctly for zoom', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_ZOOM, ['zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail!.textContent).toContain('zoom');
  });

  it('changed fields summary renders correctly for reset', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_RESET, CAM_A, ['x', 'y', 'zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    expect(detail!.textContent).toContain('x, y, zoom');
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

  it('zoom-only drilldown does not render x/y rows', () => {
    useSceneEditorStore.getState().loadInstances([INST_A]);
    applyCameraEdit([{ ...INST_A, x: 999 }], CAM_A, CAM_ZOOM, ['zoom']);
    render(<SceneProvenancePanel />);
    fireEvent.click(document.querySelector('.scene-provenance-row')!);
    const detail = document.querySelector('[data-family="camera"]');
    const text = detail!.textContent!;
    // Should have Zoom but not X/Y as before/after labels
    expect(text).toContain('Zoom');
    // X and Y should not appear as before/after labeled rows
    const baLabels = detail!.querySelectorAll('.provenance-drilldown-ba-label');
    const labelTexts = Array.from(baLabels).map((el) => el.textContent);
    expect(labelTexts).not.toContain('X');
    expect(labelTexts).not.toContain('Y');
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
    // X before/after
    const baLabels = document.querySelectorAll('.provenance-drilldown-ba-label');
    const labels = Array.from(baLabels).map((el) => el.textContent);
    expect(labels).toContain('X');
    expect(labels).toContain('Y');
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
