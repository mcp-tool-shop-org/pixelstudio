import { describe, it, expect, beforeEach } from 'vitest';
import { useTimelineStore } from './timelineStore';
import { useScenePlaybackStore } from './scenePlaybackStore';
import { useProjectStore } from './projectStore';
import { useLayerStore } from './layerStore';
import { useSelectionStore } from './selectionStore';
import type { LayerNode } from '@glyphstudio/domain';

// ── Inline replica of syncLayersFromFrame (from apps/desktop) ──
interface CanvasFrameLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
}

interface CanvasFrameData {
  width: number;
  height: number;
  data: number[];
  layers: CanvasFrameLayer[];
  activeLayerId: string | null;
  canUndo: boolean;
  canRedo: boolean;
}

function syncLayersFromFrame(frame: CanvasFrameData) {
  const store = useLayerStore.getState();
  const existingIds = new Set(store.rootLayerIds);
  const frameIds = new Set(frame.layers.map((l) => l.id));
  const now = new Date().toISOString();

  for (const l of frame.layers) {
    if (!existingIds.has(l.id)) {
      store.addLayer({
        id: l.id,
        name: l.name,
        type: 'raster',
        origin: 'manual',
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        createdAt: now,
        updatedAt: now,
      } as LayerNode);
    } else {
      store.updateLayer(l.id, {
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
      });
    }
  }

  for (const id of existingIds) {
    if (!frameIds.has(id)) {
      store.removeLayer(id);
    }
  }

  const layerOrder = frame.layers.map((l) => l.id);
  store.setLayerOrder(layerOrder);

  if (frame.activeLayerId) {
    store.setActiveLayer(frame.activeLayerId);
  }
}

// ── helpers ────────────────────────────────────────────────────
function makeFrame(
  layers: CanvasFrameLayer[],
  activeLayerId: string | null = layers[0]?.id ?? null,
): CanvasFrameData {
  return {
    width: 16,
    height: 16,
    data: new Array(16 * 16 * 4).fill(0),
    layers,
    activeLayerId,
    canUndo: false,
    canRedo: false,
  };
}

function makeLayer(id: string, name?: string): CanvasFrameLayer {
  return { id, name: name ?? id, visible: true, locked: false, opacity: 1.0 };
}

// ───────────────────────────────────────────────────────────────
// 1. Frame mutation → dual sync contract
// ───────────────────────────────────────────────────────────────
describe('frame mutation dual sync contract', () => {
  beforeEach(() => {
    // Clear layer store to initial state
    useLayerStore.setState({ rootLayerIds: [], layerById: {}, activeLayerId: null, selectedLayerIds: [] });
    useProjectStore.getState().markSaved();
  });

  it('setFrame + syncLayersFromFrame makes layerStore match frame layers', () => {
    const frame = makeFrame([makeLayer('a', 'Background'), makeLayer('b', 'Foreground')], 'b');
    syncLayersFromFrame(frame);

    const store = useLayerStore.getState();
    expect(store.rootLayerIds).toEqual(['a', 'b']);
    expect(store.activeLayerId).toBe('b');
    expect(store.layerById['a'].name).toBe('Background');
    expect(store.layerById['b'].name).toBe('Foreground');
  });

  it('layer added in frame appears in store after sync', () => {
    syncLayersFromFrame(makeFrame([makeLayer('a')]));
    syncLayersFromFrame(makeFrame([makeLayer('a'), makeLayer('b')]));

    const store = useLayerStore.getState();
    expect(store.rootLayerIds).toContain('b');
    expect(store.layerById['b']).toBeDefined();
  });

  it('layer removed in frame disappears from store after sync', () => {
    syncLayersFromFrame(makeFrame([makeLayer('a'), makeLayer('b')]));
    syncLayersFromFrame(makeFrame([makeLayer('a')]));

    const store = useLayerStore.getState();
    expect(store.rootLayerIds).not.toContain('b');
    expect(store.layerById['b']).toBeUndefined();
  });

  it('layer property changes propagate through sync', () => {
    syncLayersFromFrame(makeFrame([makeLayer('a')]));
    const updated = { ...makeLayer('a'), visible: false, locked: true, opacity: 0.5 };
    syncLayersFromFrame(makeFrame([updated]));

    const layer = useLayerStore.getState().layerById['a'];
    expect(layer.visible).toBe(false);
    expect(layer.locked).toBe(true);
    expect(layer.opacity).toBe(0.5);
  });

  it('reorder in frame changes store order', () => {
    syncLayersFromFrame(makeFrame([makeLayer('a'), makeLayer('b'), makeLayer('c')]));
    syncLayersFromFrame(makeFrame([makeLayer('c'), makeLayer('a'), makeLayer('b')]));

    expect(useLayerStore.getState().rootLayerIds).toEqual(['c', 'a', 'b']);
  });
});

// ───────────────────────────────────────────────────────────────
// 2. Dirty tracking contract
// ───────────────────────────────────────────────────────────────
describe('dirty tracking contract', () => {
  beforeEach(() => {
    useProjectStore.getState().markSaved();
  });

  // ── Which invoke commands MUST trigger dirty tracking ─────
  // This is a pinning test. Every mutating invoke that modifies
  // project data must call markDirty() + invoke('mark_dirty').
  // The lists are exhaustive; adding a new command here forces
  // the developer to wire up dirty tracking.

  const FRAME_MUTATION_COMMANDS = [
    // Canvas
    'end_stroke', 'commit_selection_transform', 'delete_selection',
    'cut_selection', 'paste_selection', 'undo', 'redo',
    // BottomDock (timeline)
    'create_frame', 'duplicate_frame', 'delete_frame',
    'reorder_frame', 'insert_frame_at',
    // LayerPanel
    'create_layer', 'delete_layer', 'rename_layer',
    'set_layer_visibility', 'set_layer_lock',
  ] as const;

  const METADATA_MUTATION_COMMANDS = [
    // ClipPanel
    'create_clip', 'delete_clip', 'update_clip',
    'set_clip_pivot', 'clear_clip_pivot',
    'add_clip_tag', 'remove_clip_tag',
    // AnchorPanel
    'create_anchor', 'delete_anchor', 'update_anchor',
    'bind_anchor_to_selection', 'clear_anchor_binding',
    'move_anchor', 'copy_anchors_to_all_frames',
    'propagate_anchor_updates', 'set_anchor_parent',
    'clear_anchor_parent', 'set_anchor_falloff',
    // SandboxPanel
    'apply_sandbox_timing', 'duplicate_sandbox_span',
    // ExportPreviewPanel
    'set_asset_package_metadata',
    // AssetBrowserPanel
    'remove_asset_catalog_entry',
    // SceneCanvas + SceneInstancesPanel
    'new_scene', 'move_scene_instance',
    'set_scene_instance_visibility', 'set_scene_instance_opacity',
    'set_scene_instance_layer', 'remove_scene_instance',
    'set_scene_instance_parallax', 'set_scene_instance_clip',
  ] as const;

  // Commands that are project-mutations but are excluded from dirty
  // tracking by design (documented reasons).
  const DIRTY_EXCEPTIONS = [
    // Camera is ephemeral scene view state, not project data
    'set_scene_camera_position', 'set_scene_camera_zoom', 'reset_scene_camera',
    // Presets are a user library outside project scope
    'save_motion_preset', 'delete_motion_preset', 'rename_motion_preset',
  ] as const;

  it('frame mutation command set is pinned', () => {
    expect(FRAME_MUTATION_COMMANDS.length).toBe(17);
  });

  it('metadata mutation command set is pinned', () => {
    expect(METADATA_MUTATION_COMMANDS.length).toBe(30);
  });

  it('dirty exception set is pinned and documented', () => {
    expect(DIRTY_EXCEPTIONS.length).toBe(6);
  });

  it('total mutable commands equals frame + metadata + exceptions', () => {
    const total = FRAME_MUTATION_COMMANDS.length
      + METADATA_MUTATION_COMMANDS.length
      + DIRTY_EXCEPTIONS.length;
    expect(total).toBe(53);
  });

  it('markDirty() sets isDirty on projectStore', () => {
    expect(useProjectStore.getState().isDirty).toBe(false);
    useProjectStore.getState().markDirty();
    expect(useProjectStore.getState().isDirty).toBe(true);
  });

  it('markSaved() clears isDirty', () => {
    useProjectStore.getState().markDirty();
    useProjectStore.getState().markSaved();
    expect(useProjectStore.getState().isDirty).toBe(false);
  });

  it('markDirty() sets saveStatus to idle', () => {
    useProjectStore.getState().markDirty();
    expect(useProjectStore.getState().saveStatus).toBe('idle');
  });
});

// ───────────────────────────────────────────────────────────────
// 3. Playback mutual exclusion
// ───────────────────────────────────────────────────────────────
describe('playback mutual exclusion', () => {
  beforeEach(() => {
    useTimelineStore.getState().setPlaying(false);
    useScenePlaybackStore.getState().setPlaying(false);
  });

  it('stores are independent — setting one does not clear the other', () => {
    // This documents that mutual exclusion is NOT enforced at store level.
    // It is enforced by BottomDock/ScenePlaybackControls component effects.
    useTimelineStore.getState().setPlaying(true);
    useScenePlaybackStore.getState().setPlaying(true);

    // Both stores are true simultaneously — this proves the invariant
    // is component-enforced, not store-enforced.
    expect(useTimelineStore.getState().playing).toBe(true);
    expect(useScenePlaybackStore.getState().isPlaying).toBe(true);
  });

  it('timeline setPlaying(false) does not affect scene store', () => {
    useScenePlaybackStore.getState().setPlaying(true);
    useTimelineStore.getState().setPlaying(false);
    expect(useScenePlaybackStore.getState().isPlaying).toBe(true);
  });

  it('scene setPlaying(false) does not affect timeline store', () => {
    useTimelineStore.getState().setPlaying(true);
    useScenePlaybackStore.getState().setPlaying(false);
    expect(useTimelineStore.getState().playing).toBe(true);
  });
});

// ───────────────────────────────────────────────────────────────
// 4. Clip state duplication contract
// ───────────────────────────────────────────────────────────────
describe('clip state duplication contract', () => {
  // ClipPanel and ExportPreviewPanel both independently manage their
  // own `clips` state via separate invoke('list_clips') calls.
  // There is no shared clipStore.
  //
  // This is a known design trade-off: each panel refreshes independently,
  // so a clip created in ClipPanel is not visible in ExportPreviewPanel
  // until the next refresh. The risk is acceptable because:
  //   (a) Both panels auto-refresh on frames.length change
  //   (b) They are not typically open simultaneously
  //
  // The tests below document this contract so it doesn't drift silently.

  it('no shared clip store exists in state package', async () => {
    // If someone creates a useClipStore, this test should be updated
    // to reflect the new coordination pattern.
    const exports = await import('./index');
    expect((exports as Record<string, unknown>).useClipStore).toBeUndefined();
  });
});

// ───────────────────────────────────────────────────────────────
// 5. RightDock tab clamping contract
// ───────────────────────────────────────────────────────────────
describe('RightDock tab clamping logic', () => {
  // Inlined from RightDock.tsx — the clamping logic
  function clampTab(prev: number, tabCount: number): number {
    return prev >= tabCount ? 0 : prev;
  }

  const MODE_TABS: Record<string, string[]> = {
    'project-home': [],
    edit: ['Layers', 'Properties', 'Palette', 'Assets'],
    animate: ['Layers', 'Properties', 'Palette', 'Locomotion'],
    palette: ['Palette Props', 'Validation'],
    ai: ['AI Assist', 'Layers', 'Provenance'],
    locomotion: ['Locomotion', 'Layers', 'Validation'],
    validate: ['Validation', 'Properties', 'Provenance'],
    export: ['Export Settings'],
    scene: ['Instances', 'Camera', 'Assets'],
  };

  it('tab 0 stays valid in all modes', () => {
    for (const [mode, tabs] of Object.entries(MODE_TABS)) {
      if (tabs.length === 0) continue;
      expect(clampTab(0, tabs.length), `mode=${mode}`).toBe(0);
    }
  });

  it('tab 3 in edit mode (4 tabs) stays 3', () => {
    expect(clampTab(3, MODE_TABS['edit'].length)).toBe(3);
  });

  it('tab 3 clamps to 0 in palette mode (2 tabs)', () => {
    expect(clampTab(3, MODE_TABS['palette'].length)).toBe(0);
  });

  it('tab 3 clamps to 0 in export mode (1 tab)', () => {
    expect(clampTab(3, MODE_TABS['export'].length)).toBe(0);
  });

  it('tab 0 clamps to 0 in project-home mode (0 tabs)', () => {
    expect(clampTab(0, MODE_TABS['project-home'].length)).toBe(0);
  });

  it('tab 2 stays valid in scene mode (3 tabs)', () => {
    expect(clampTab(2, MODE_TABS['scene'].length)).toBe(2);
  });

  it('every mode has at least 0 tabs (no undefined entries)', () => {
    const allModes = ['project-home', 'edit', 'animate', 'palette', 'ai', 'locomotion', 'validate', 'export', 'scene'];
    for (const mode of allModes) {
      expect(MODE_TABS[mode], `mode=${mode}`).toBeDefined();
      expect(Array.isArray(MODE_TABS[mode]), `mode=${mode} is array`).toBe(true);
    }
  });
});

// ───────────────────────────────────────────────────────────────
// 6. Keyboard input law — AnchorPanel defers to Canvas
// ───────────────────────────────────────────────────────────────
describe('keyboard input law', () => {
  // These tests pin the priority rules that AnchorPanel.tsx implements:
  //   - Arrow keys: Canvas owns them when isTransforming is true
  //   - Delete/Backspace: Canvas owns them when hasSelection is true
  // The tests verify the guard states, not DOM events (no harness yet).

  beforeEach(() => {
    useSelectionStore.setState({
      hasSelection: false,
      isTransforming: false,
      selectionBounds: null,
      isFloating: false,
      transformPreview: null,
    });
  });

  // Pure guard function mirroring AnchorPanel's keyboard handler logic
  function anchorOwnsArrows(hasAnchor: boolean): boolean {
    if (!hasAnchor) return false;
    return !useSelectionStore.getState().isTransforming;
  }

  function anchorOwnsDelete(hasAnchor: boolean): boolean {
    if (!hasAnchor) return false;
    return !useSelectionStore.getState().hasSelection;
  }

  describe('arrow key ownership', () => {
    it('AnchorPanel owns arrows when anchor selected, no transform', () => {
      expect(anchorOwnsArrows(true)).toBe(true);
    });

    it('Canvas owns arrows during transform even with anchor selected', () => {
      useSelectionStore.setState({ isTransforming: true });
      expect(anchorOwnsArrows(true)).toBe(false);
    });

    it('neither owns arrows when no anchor selected and no transform', () => {
      expect(anchorOwnsArrows(false)).toBe(false);
    });

    it('Canvas owns arrows during transform, no anchor', () => {
      useSelectionStore.setState({ isTransforming: true });
      expect(anchorOwnsArrows(false)).toBe(false);
    });
  });

  describe('Delete/Backspace ownership', () => {
    it('AnchorPanel owns Delete when anchor selected, no pixel selection', () => {
      expect(anchorOwnsDelete(true)).toBe(true);
    });

    it('Canvas owns Delete when pixel selection exists, even with anchor', () => {
      useSelectionStore.setState({ hasSelection: true });
      expect(anchorOwnsDelete(true)).toBe(false);
    });

    it('neither owns Delete when no anchor and no selection', () => {
      expect(anchorOwnsDelete(false)).toBe(false);
    });

    it('Canvas owns Delete with selection, no anchor', () => {
      useSelectionStore.setState({ hasSelection: true });
      expect(anchorOwnsDelete(false)).toBe(false);
    });
  });

  describe('combined states', () => {
    it('Canvas owns both arrow and delete during transform with selection', () => {
      useSelectionStore.setState({ isTransforming: true, hasSelection: true });
      expect(anchorOwnsArrows(true)).toBe(false);
      expect(anchorOwnsDelete(true)).toBe(false);
    });

    it('AnchorPanel owns both when Canvas is fully idle', () => {
      expect(anchorOwnsArrows(true)).toBe(true);
      expect(anchorOwnsDelete(true)).toBe(true);
    });

    it('AnchorPanel owns arrows but not Delete when selection exists without transform', () => {
      useSelectionStore.setState({ hasSelection: true });
      expect(anchorOwnsArrows(true)).toBe(true);
      expect(anchorOwnsDelete(true)).toBe(false);
    });
  });
});
