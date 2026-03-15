import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
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
});
