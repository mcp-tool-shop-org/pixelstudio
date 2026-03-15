import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useScenePlaybackStore, useProjectStore, useCharacterStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { SceneAssetInstance } from '@glyphstudio/domain';

import { SceneInstancesPanel } from '../components/SceneInstancesPanel';

const INST_A: SceneAssetInstance = {
  instanceId: 'i1',
  name: 'Hero',
  sourcePath: '/assets/hero.pxs',
  x: 10,
  y: 20,
  zOrder: 2,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
  clipId: 'c1',
};

const INST_B: SceneAssetInstance = {
  instanceId: 'i2',
  name: 'BG Tree',
  sourcePath: '/assets/tree.pxs',
  x: 50,
  y: 100,
  zOrder: 0,
  visible: false,
  opacity: 0.5,
  parallax: 0.5,
  clipId: undefined,
};

const INST_C: SceneAssetInstance = {
  instanceId: 'i3',
  name: 'FG Grass',
  sourcePath: '/assets/grass.pxs',
  x: 0,
  y: 80,
  zOrder: 5,
  visible: true,
  opacity: 1.0,
  parallax: 1.5,
  clipId: undefined,
};

const INST_CHAR: SceneAssetInstance = {
  instanceId: 'i4',
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

const INST_CHAR_ORPHAN: SceneAssetInstance = {
  instanceId: 'i5',
  name: 'Deleted Hero',
  sourcePath: '',
  x: 0,
  y: 0,
  zOrder: 1,
  visible: true,
  opacity: 1.0,
  parallax: 1.0,
  instanceKind: 'character',
  sourceCharacterBuildId: 'build-gone',
  sourceCharacterBuildName: 'Old Build',
  characterSlotSnapshot: {
    slots: { head: 'helm-old' },
    equippedCount: 1,
    totalSlots: 12,
  },
};

const PLAYBACK_STATE = {
  fps: 12,
  looping: true,
  instances: [
    { instanceId: 'i1', clipId: 'c1', clipName: 'idle', frameCount: 4, clipFps: null, clipLoop: false, status: 'resolved' as const, frameIndex: 0, totalFrames: 4 },
    { instanceId: 'i2', clipId: null, clipName: null, frameCount: 0, clipFps: null, clipLoop: false, status: 'no_clip' as const, frameIndex: 0, totalFrames: 0 },
    { instanceId: 'i3', clipId: null, clipName: null, frameCount: 0, clipFps: null, clipLoop: false, status: 'no_clip' as const, frameIndex: 0, totalFrames: 0 },
  ],
};

interface SeedBuild {
  id: string;
  name: string;
  slots: Record<string, unknown>;
}

function seedStores(opts?: { libraryBuildIds?: string[]; libraryBuilds?: SeedBuild[] }) {
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: null, isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 64, height: 64 },
  });
  useScenePlaybackStore.setState({ playbackState: PLAYBACK_STATE });
  // Seed character build library (array-based, matches real CharacterBuildLibrary)
  const builds = (opts?.libraryBuilds ?? (opts?.libraryBuildIds ?? []).map((id) => ({
    id, name: `Build ${id}`, slots: {}, createdAt: '', updatedAt: '',
  }))) as never[];
  useCharacterStore.setState({
    buildLibrary: { schemaVersion: 1, builds },
  });
}

describe('SceneInstancesPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('get_scene_instances', () => []);
    mock.on('get_scene_playback_state', () => PLAYBACK_STATE);
    mock.on('list_source_clips', () => []);
  });

  afterEach(() => {
    cleanup();
  });

  // ── Empty state ──

  it('shows empty state when no instances', async () => {
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    expect(screen.getByText('Instances')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/No instances in scene/)).toBeInTheDocument();
    });
  });

  // ── With instances ──

  it('renders instance names sorted by z-order descending', async () => {
    mock.on('get_scene_instances', () => [INST_A, INST_B, INST_C]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => {
      expect(screen.getByText('Hero')).toBeInTheDocument();
      expect(screen.getByText('BG Tree')).toBeInTheDocument();
      expect(screen.getByText('FG Grass')).toBeInTheDocument();
    });
    // First in list should be highest z-order (INST_C, z=5)
    const rows = document.querySelectorAll('.scene-instance-row');
    expect(rows[0].textContent).toContain('FG Grass');
  });

  it('shows instance count', async () => {
    mock.on('get_scene_instances', () => [INST_A, INST_B, INST_C]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => {
      expect(screen.getByText('3')).toBeInTheDocument();
    });
  });

  it('shows position and z-order for each instance', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => {
      expect(screen.getByText('(10, 20) z2')).toBeInTheDocument();
    });
  });

  // ── Visibility toggle ──

  it('visibility toggle invokes set_scene_instance_visibility', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    mock.on('set_scene_instance_visibility', () => undefined);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    // INST_A is visible → button title "Hide"
    await act(async () => {
      await userEvent.click(screen.getByTitle('Hide'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('set_scene_instance_visibility');
  });

  // ── Z-order controls ──

  it('bring forward invokes set_scene_instance_layer', async () => {
    mock.on('get_scene_instances', () => [INST_A, INST_B]);
    mock.on('set_scene_instance_layer', () => undefined);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    // Bring forward buttons (▲)
    const fwdBtns = screen.getAllByTitle('Bring forward');
    await act(async () => {
      await userEvent.click(fwdBtns[fwdBtns.length - 1]); // BG Tree (z=0)
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('set_scene_instance_layer');
  });

  // ── Remove ──

  it('remove invokes remove_scene_instance', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    mock.on('remove_scene_instance', () => undefined);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Remove instance'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('remove_scene_instance');
  });

  // ── Selected instance detail ──

  it('clicking an instance shows detail pane with source', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.getByText('Source')).toBeInTheDocument();
    expect(screen.getByText('hero.pxs')).toBeInTheDocument();
  });

  it('detail pane shows opacity slider', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.getByText('Opacity')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });

  it('detail pane shows depth controls with parallax presets', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.getByText('Depth')).toBeInTheDocument();
    expect(screen.getByText('BG')).toBeInTheDocument();
    expect(screen.getByText('MG')).toBeInTheDocument();
    expect(screen.getByText('FG')).toBeInTheDocument();
  });

  it('MG preset active when parallax is 1.0', async () => {
    mock.on('get_scene_instances', () => [INST_A]); // INST_A has parallax=1.0
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    const mgBtn = screen.getByText('MG');
    expect(mgBtn.className).toContain('active');
  });

  it('parallax hint shows "normal" for 1.0', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.getByText('normal')).toBeInTheDocument();
  });

  // ── Backend calls ──

  it('calls get_scene_instances on mount', async () => {
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('get_scene_instances');
  });

  it('calls get_scene_playback_state on mount', async () => {
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('get_scene_playback_state');
  });

  // ── Character instance rendering ──

  it('shows "Character" badge on character instance rows', async () => {
    mock.on('get_scene_instances', () => [INST_A, INST_CHAR]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => {
      expect(screen.getByText('Knight')).toBeInTheDocument();
    });
    // Character badge should appear
    expect(screen.getByText('Character')).toBeInTheDocument();
    // Plain asset row (Hero) should NOT have a badge
    const rows = document.querySelectorAll('.scene-instance-row');
    const heroRow = Array.from(rows).find((r) => r.textContent?.includes('Hero'));
    expect(heroRow?.textContent).not.toContain('Character');
  });

  it('shows source build name on character instance row', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => {
      expect(screen.getByText(/from: Knight Build/)).toBeInTheDocument();
    });
  });

  it('does not show source info on plain asset rows', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => {
      expect(screen.getByText('Hero')).toBeInTheDocument();
    });
    expect(screen.queryByText(/from:/)).toBeNull();
  });

  // ── Character detail pane ──

  it('detail pane shows character-specific info when character instance selected', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Kind badge in detail
    expect(screen.getAllByText('Character').length).toBeGreaterThanOrEqual(1);
    // Build name
    expect(screen.getByText('Knight Build')).toBeInTheDocument();
    // Slot snapshot
    expect(screen.getByText('2/12 equipped')).toBeInTheDocument();
    // Source status — linked (build-1 is in library)
    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('detail pane shows "Source missing" when source build not in library', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR_ORPHAN]);
    seedStores({ libraryBuildIds: [] }); // empty library
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Deleted Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Deleted Hero')); });
    expect(screen.getByText('Source missing')).toBeInTheDocument();
  });

  it('detail pane does NOT show character sections for plain asset instances', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    // Should show Source (file path) but NOT character-specific fields
    expect(screen.getByText('hero.pxs')).toBeInTheDocument();
    expect(screen.queryByText('Kind')).toBeNull();
    expect(screen.queryByText('Build')).toBeNull();
    expect(screen.queryByText(/equipped/)).toBeNull();
  });

  it('character instance with linked source shows "Linked" status', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const statusEl = document.querySelector('.scene-instance-source-status');
    expect(statusEl?.textContent).toBe('Linked');
    expect(statusEl?.className).toContain('source-linked');
  });

  it('character instance with missing source shows warning status', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR_ORPHAN]);
    seedStores({ libraryBuildIds: ['build-1'] }); // build-gone NOT in library
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Deleted Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Deleted Hero')); });
    const statusEl = document.querySelector('.scene-instance-source-status');
    expect(statusEl?.textContent).toBe('Source missing');
    expect(statusEl?.className).toContain('source-missing');
  });

  // ── Reapply from Source ──

  it('shows "Reapply from Source" button for linked character instance', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const btn = screen.getByText('Reapply from Source');
    expect(btn).toBeInTheDocument();
    expect(btn).not.toBeDisabled();
  });

  it('does not show reapply button for plain asset instances', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.queryByText('Reapply from Source')).toBeNull();
  });

  it('disables reapply button when source build is missing', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR_ORPHAN]);
    seedStores({ libraryBuildIds: [] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Deleted Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Deleted Hero')); });
    const btn = screen.getByText('Reapply from Source');
    expect(btn).toBeDisabled();
    expect(screen.getByText('Build not in library')).toBeInTheDocument();
  });

  it('clicking reapply updates displayed build name and snapshot', async () => {
    // Source build in library has updated name and different slots
    const updatedBuild = {
      id: 'build-1', name: 'Knight v2', slots: { head: { sourceId: 'helm-gold', layerId: 'head' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [updatedBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Before reapply — shows original snapshot data
    expect(screen.getByText('Knight Build')).toBeInTheDocument();
    expect(screen.getByText('2/12 equipped')).toBeInTheDocument();
    // Click reapply
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // After reapply — shows updated data
    expect(screen.getByText('Knight v2')).toBeInTheDocument();
    expect(screen.getByText('1/12 equipped')).toBeInTheDocument();
  });

  it('selected instance remains selected after reapply', async () => {
    const updatedBuild = {
      id: 'build-1', name: 'Knight v2', slots: { head: { sourceId: 'helm-gold', layerId: 'head' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_A, INST_CHAR]);
    seedStores({ libraryBuilds: [updatedBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Reapply
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // Detail pane still visible (instance still selected)
    expect(screen.getByText('Knight v2')).toBeInTheDocument();
    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('reapply does not affect unrelated instances', async () => {
    const updatedBuild = {
      id: 'build-1', name: 'Knight v2', slots: { head: { sourceId: 'helm-gold', layerId: 'head' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_A, INST_CHAR]);
    seedStores({ libraryBuilds: [updatedBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // Hero (plain asset) is still rendered with original data
    expect(screen.getByText('Hero')).toBeInTheDocument();
  });

  it('missing source reapply click does nothing destructive', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR_ORPHAN]);
    seedStores({ libraryBuildIds: [] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Deleted Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Deleted Hero')); });
    // Button is disabled — clicking it should not change anything
    const btn = screen.getByText('Reapply from Source');
    expect(btn).toBeDisabled();
    // Original data still shown
    expect(screen.getByText('Old Build')).toBeInTheDocument();
    expect(screen.getByText('1/12 equipped')).toBeInTheDocument();
  });

  it('source build rename is reflected after reapply', async () => {
    const renamedBuild = {
      id: 'build-1', name: 'Paladin', slots: { head: { sourceId: 'helm-iron', layerId: 'head' }, torso: { sourceId: 'plate-steel', layerId: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [renamedBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Row still shows old source name
    expect(screen.getByText('Knight Build')).toBeInTheDocument();
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // After reapply — build name updated to renamed version
    expect(screen.getByText('Paladin')).toBeInTheDocument();
    expect(screen.queryByText('Knight Build')).toBeNull();
  });

  // ── Edge cases + terminology consistency ──

  it('character row shows "Unknown build" when source name is missing', async () => {
    const noNameChar: SceneAssetInstance = {
      ...INST_CHAR,
      instanceId: 'i6',
      sourceCharacterBuildName: undefined,
    };
    mock.on('get_scene_instances', () => [noNameChar]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    expect(screen.getByText(/from: Unknown build/)).toBeInTheDocument();
  });

  it('detail pane shows "Unknown build" for empty source name', async () => {
    const emptyNameChar: SceneAssetInstance = {
      ...INST_CHAR,
      instanceId: 'i7',
      sourceCharacterBuildName: '',
    };
    mock.on('get_scene_instances', () => [emptyNameChar]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Unknown build')).toBeInTheDocument();
  });

  it('detail pane uses "Snapshot" label for slot summary', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Snapshot')).toBeInTheDocument();
  });

  it('shows "Out of date" stale hint when source differs from snapshot', async () => {
    // Source build has 3 slots (different from INST_CHAR's 2-slot snapshot)
    const changedBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', layerId: 'head' }, torso: { sourceId: 'plate-steel', layerId: 'torso' }, legs: { sourceId: 'greaves', layerId: 'legs' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [changedBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Out of date')).toBeInTheDocument();
  });

  it('does not show stale hint when snapshot matches source', async () => {
    // Source build matches INST_CHAR's 2-slot snapshot exactly
    const matchingBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', layerId: 'head' }, torso: { sourceId: 'plate-steel', layerId: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [matchingBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.queryByText('Out of date')).toBeNull();
  });

  it('does not show stale hint when source is missing', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR_ORPHAN]);
    seedStores({ libraryBuildIds: [] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Deleted Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Deleted Hero')); });
    expect(screen.queryByText('Out of date')).toBeNull();
  });

  it('stale hint clears after reapply', async () => {
    const changedBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', layerId: 'head' }, torso: { sourceId: 'plate-steel', layerId: 'torso' }, legs: { sourceId: 'greaves', layerId: 'legs' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [changedBuild as never] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Stale before reapply
    expect(screen.getByText('Out of date')).toBeInTheDocument();
    // Reapply
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // Stale hint should be gone after reapply
    expect(screen.queryByText('Out of date')).toBeNull();
  });

  // ── Instance Overrides section ──

  it('overrides section appears for character instances', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Instance Overrides')).toBeInTheDocument();
  });

  it('overrides section absent for asset instances', async () => {
    mock.on('get_scene_instances', () => [INST_A]);
    seedStores();
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.queryByText('Instance Overrides')).toBeNull();
  });

  it('renders all 12 canonical slots in order', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const slotRows = document.querySelectorAll('.scene-override-slot-row');
    expect(slotRows.length).toBe(12);
    // First slot should be Head, last should be Offhand
    const names = Array.from(slotRows).map((r) => r.querySelector('.scene-override-slot-name')?.textContent);
    expect(names[0]).toBe('Head');
    expect(names[names.length - 1]).toBe('Offhand');
  });

  it('inherited slot rows show Inherited badge', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // head has a part → Inherited badge
    const slotRows = document.querySelectorAll('.scene-override-slot-row');
    const headRow = slotRows[0]; // head is first
    expect(headRow.querySelector('.scene-override-slot-badge')?.textContent).toBe('Inherited');
    expect(headRow.querySelector('.scene-override-slot-badge')?.classList.contains('badge-inherited')).toBe(true);
  });

  it('equipped inherited slots show part ID and Remove button', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // head slot has part 'helm-iron'
    const slotRows = document.querySelectorAll('.scene-override-slot-row');
    const headRow = slotRows[0];
    expect(headRow.querySelector('.scene-override-slot-part')?.textContent).toBe('helm-iron');
    // Should have Replace and Remove buttons
    const btns = headRow.querySelectorAll('.scene-override-action-btn');
    expect(btns[0]?.textContent).toBe('Replace');
    expect(btns[1]?.textContent).toBe('Remove');
  });

  it('empty inherited slots show dash and Replace button only', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // face slot (index 1) has no part
    const slotRows = document.querySelectorAll('.scene-override-slot-row');
    const faceRow = slotRows[1];
    expect(faceRow.querySelector('.scene-override-slot-part')?.textContent).toBe('\u2014');
    // Should only have Replace button (no Remove since slot is empty)
    const btns = faceRow.querySelectorAll('.scene-override-action-btn');
    expect(btns.length).toBe(1);
    expect(btns[0]?.textContent).toBe('Replace');
  });

  it('shows summary counts', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // INST_CHAR has 2 equipped slots, no overrides
    expect(screen.getByText('2/12 effective')).toBeInTheDocument();
    expect(screen.getByText('No local overrides')).toBeInTheDocument();
  });

  it('shows scene-local explanatory text', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Local overrides affect only this scene instance. Reapply refreshes inherited slots.')).toBeInTheDocument();
  });

  it('clicking Remove locally sets remove override and updates row', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Find head slot Remove button (second action btn, after Replace) and click it
    const slotRows = document.querySelectorAll('.scene-override-slot-row');
    const headBtns = slotRows[0].querySelectorAll('.scene-override-action-btn');
    const headRemoveBtn = headBtns[1] as HTMLElement;
    expect(headRemoveBtn.textContent).toBe('Remove');
    await act(async () => { await userEvent.click(headRemoveBtn); });
    // After remove: head row should show Local Remove badge and Clear button
    const updatedRows = document.querySelectorAll('.scene-override-slot-row');
    const headRow = updatedRows[0];
    expect(headRow.querySelector('.scene-override-slot-badge')?.textContent).toBe('Local Remove');
    expect(headRow.querySelector('.scene-override-slot-badge')?.classList.contains('badge-remove')).toBe(true);
    const updatedBtns = headRow.querySelectorAll('.scene-override-action-btn');
    expect(updatedBtns[0]?.textContent).toBe('Replace');
    expect(updatedBtns[1]?.textContent).toBe('Clear');
    // Part should show dash (removed)
    expect(headRow.querySelector('.scene-override-slot-part')?.textContent).toBe('\u2014');
  });

  it('clicking Remove updates override count summary', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Remove head slot (second action btn, after Replace)
    const headRemoveBtn = document.querySelectorAll('.scene-override-slot-row')[0].querySelectorAll('.scene-override-action-btn')[1] as HTMLElement;
    await act(async () => { await userEvent.click(headRemoveBtn); });
    expect(screen.getByText('1/12 effective')).toBeInTheDocument();
    expect(screen.getByText('1 local override')).toBeInTheDocument();
  });

  it('clicking Clear override restores inherited state', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Remove head slot (second action btn, after Replace)
    const headRemoveBtn = document.querySelectorAll('.scene-override-slot-row')[0].querySelectorAll('.scene-override-action-btn')[1] as HTMLElement;
    await act(async () => { await userEvent.click(headRemoveBtn); });
    // Now clear the override (second btn after Replace)
    const clearBtn = document.querySelectorAll('.scene-override-slot-row')[0].querySelectorAll('.scene-override-action-btn')[1] as HTMLElement;
    expect(clearBtn.textContent).toBe('Clear');
    await act(async () => { await userEvent.click(clearBtn); });
    // Head row should be back to Inherited with part restored
    const headRow = document.querySelectorAll('.scene-override-slot-row')[0];
    expect(headRow.querySelector('.scene-override-slot-badge')?.textContent).toBe('Inherited');
    expect(headRow.querySelector('.scene-override-slot-part')?.textContent).toBe('helm-iron');
    expect(screen.getByText('No local overrides')).toBeInTheDocument();
  });

  it('overrides section shows override state from instance data', async () => {
    const instWithOverrides: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'remove' },
      },
    };
    mock.on('get_scene_instances', () => [instWithOverrides]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // head should show Local Remove
    const headRow = document.querySelectorAll('.scene-override-slot-row')[0];
    expect(headRow.querySelector('.scene-override-slot-badge')?.textContent).toBe('Local Remove');
    expect(screen.getByText('1 local override')).toBeInTheDocument();
    expect(screen.getByText('1/12 effective')).toBeInTheDocument();
  });

  it('replaced override row shows Local Replace badge', async () => {
    const instWithReplace: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
      },
    };
    mock.on('get_scene_instances', () => [instWithReplace]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const headRow = document.querySelectorAll('.scene-override-slot-row')[0];
    expect(headRow.querySelector('.scene-override-slot-badge')?.textContent).toBe('Local Replace');
    expect(headRow.querySelector('.scene-override-slot-badge')?.classList.contains('badge-replace')).toBe(true);
    expect(headRow.querySelector('.scene-override-slot-part')?.textContent).toBe('crown-gold');
    // Should have Replace and Clear buttons
    const btns = headRow.querySelectorAll('.scene-override-action-btn');
    expect(btns[0]?.textContent).toBe('Replace');
    expect(btns[1]?.textContent).toBe('Clear');
  });

  it('Clear all button appears when overrides exist and clears them', async () => {
    const instWithOverrides: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'remove' },
        torso: { slot: 'torso', mode: 'remove' },
      },
    };
    mock.on('get_scene_instances', () => [instWithOverrides]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Clear all button should exist
    const clearAllBtn = screen.getByText('Clear all');
    expect(clearAllBtn).toBeInTheDocument();
    await act(async () => { await userEvent.click(clearAllBtn); });
    // All overrides cleared
    expect(screen.getByText('No local overrides')).toBeInTheDocument();
    expect(screen.getByText('2/12 effective')).toBeInTheDocument();
    // Clear all button should be gone
    expect(screen.queryByText('Clear all')).toBeNull();
  });

  it('Clear all button absent when no overrides', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.queryByText('Clear all')).toBeNull();
  });

  it('source build/snapshot labels unchanged after local remove', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Remove head locally (second action btn, after Replace)
    const headRemoveBtn = document.querySelectorAll('.scene-override-slot-row')[0].querySelectorAll('.scene-override-action-btn')[1] as HTMLElement;
    await act(async () => { await userEvent.click(headRemoveBtn); });
    // Build name and snapshot labels should still show original values
    expect(screen.getByText('Knight Build')).toBeInTheDocument();
    expect(screen.getByText('2/12 equipped')).toBeInTheDocument(); // snapshot unchanged
    expect(screen.getByText('Linked')).toBeInTheDocument();
  });

  it('non-character instances unaffected by override features', async () => {
    mock.on('get_scene_instances', () => [INST_A, INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    // Select plain asset
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    expect(screen.queryByText('Instance Overrides')).toBeNull();
    expect(screen.queryByText(/local override/)).toBeNull();
  });

  // ── Replace picker ──

  it('every slot row shows a Replace button', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    expect(replaceBtns.length).toBe(12); // one per canonical slot
  });

  it('clicking Replace opens picker for that slot', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    // Click Replace on first slot (head)
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.getByText('Replace Head')).toBeInTheDocument();
  });

  it('picker shows empty message when no presets available', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.getByText('No candidates available for this slot.')).toBeInTheDocument();
  });

  it('picker shows classified presets with compatibility badges', async () => {
    const presets = [
      { sourceId: 'helm-gold', slot: 'head' as const, name: 'Gold Helm' },
      { sourceId: 'boots-iron', slot: 'feet' as const, name: 'Iron Boots' },
    ];
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel partCatalog={presets} />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Open picker for head slot
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    // Compatible preset for head
    expect(screen.getByText('Gold Helm')).toBeInTheDocument();
    expect(screen.getByText('Compatible')).toBeInTheDocument();
    // Incompatible preset for feet should also show (classifyAll returns all)
    expect(screen.getByText('Iron Boots')).toBeInTheDocument();
    expect(screen.getByText('Incompatible')).toBeInTheDocument();
  });

  it('applying a preset from picker creates a replace override', async () => {
    const presets = [
      { sourceId: 'helm-gold', slot: 'head' as const, name: 'Gold Helm' },
    ];
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel partCatalog={presets} />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Open picker for head
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    // Click Apply
    const applyBtn = screen.getByText('Apply');
    await act(async () => { await userEvent.click(applyBtn); });
    // Picker should close
    expect(screen.queryByText('Replace Head')).toBeNull();
    // Head slot should now show Local Replace badge and the new part
    expect(screen.getByText('helm-gold')).toBeInTheDocument();
    expect(screen.getByText('Local Replace')).toBeInTheDocument();
  });

  it('incompatible candidates have disabled Apply button', async () => {
    const presets = [
      { sourceId: 'boots-iron', slot: 'feet' as const, name: 'Iron Boots' },
    ];
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel partCatalog={presets} />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Open picker for head — boots are incompatible with head slot
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    const applyBtn = screen.getByText('Apply');
    expect(applyBtn).toBeDisabled();
  });

  it('clicking Replace again on same slot closes picker', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    // Open
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.getByText('Replace Head')).toBeInTheDocument();
    // Close by clicking same Replace button
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.queryByText('Replace Head')).toBeNull();
  });

  it('close button closes the picker', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.getByText('Replace Head')).toBeInTheDocument();
    // Close via X button
    const closeBtn = screen.getByTitle('Close picker');
    await act(async () => { await userEvent.click(closeBtn); });
    expect(screen.queryByText('Replace Head')).toBeNull();
  });

  it('replace on empty snapshot slot adds part via override', async () => {
    const presets = [
      { sourceId: 'iron-boots', slot: 'feet' as const, name: 'Iron Boots' },
    ];
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel partCatalog={presets} />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Feet is the 8th slot (index 7) in canonical order
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[7]); });
    expect(screen.getByText('Replace Feet')).toBeInTheDocument();
    // Apply
    const applyBtn = screen.getByText('Apply');
    await act(async () => { await userEvent.click(applyBtn); });
    // Feet should now show the replacement part
    expect(screen.getByText('iron-boots')).toBeInTheDocument();
  });

  it('picker shows preset description when available', async () => {
    const presets = [
      { sourceId: 'helm-gold', slot: 'head' as const, name: 'Gold Helm', description: 'Shiny golden helmet' },
    ];
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel partCatalog={presets} />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.getByText('Shiny golden helmet')).toBeInTheDocument();
  });

  it('clear all closes open picker', async () => {
    const instWithOverride: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
      },
    };
    mock.on('get_scene_instances', () => [instWithOverride]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Open picker on torso
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[3]); }); // torso is index 3
    expect(screen.getByText('Replace Torso')).toBeInTheDocument();
    // Clear all
    await act(async () => { await userEvent.click(screen.getByText('Clear all')); });
    // Picker should be closed
    expect(screen.queryByText('Replace Torso')).toBeNull();
  });

  it('warning-tier presets show reasons and have enabled Apply', async () => {
    const presets = [
      {
        sourceId: 'helm-magic',
        slot: 'head' as const,
        name: 'Magic Helm',
        requiredSockets: ['mana-crystal'],
      },
    ];
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel partCatalog={presets} />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const replaceBtns = screen.getAllByTitle('Replace locally');
    await act(async () => { await userEvent.click(replaceBtns[0]); });
    expect(screen.getByText('Warning')).toBeInTheDocument();
    expect(screen.getByText(/mana-crystal/)).toBeInTheDocument();
    const applyBtn = screen.getByText('Apply');
    expect(applyBtn).not.toBeDisabled();
  });

  // ── Reapply + overrides UI ──

  it('override hint text communicates reapply law', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Local overrides affect only this scene instance. Reapply refreshes inherited slots.')).toBeInTheDocument();
  });

  it('reapply button tooltip mentions keeping overrides', async () => {
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuildIds: ['build-1'] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    const reapplyBtn = screen.getByText('Reapply from Source');
    expect(reapplyBtn.getAttribute('title')).toBe('Refresh inherited slots from source build (keeps local overrides)');
  });

  it('overridden slot stays overridden after reapply', async () => {
    // Instance with head override
    const instWithOverride: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
      },
    };
    // Source build with updated slots (torso changed)
    const sourceBuild = {
      id: 'build-1', name: 'Knight Build v2',
      slots: { head: { sourceId: 'helm-iron', slot: 'head' }, torso: { sourceId: 'chain-mail', slot: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [instWithOverride]);
    seedStores({ libraryBuilds: [sourceBuild] as never[] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Reapply
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // Head should still show Local Replace with crown-gold
    expect(screen.getByText('crown-gold')).toBeInTheDocument();
    expect(screen.getByText('Local Replace')).toBeInTheDocument();
  });

  it('inherited slot updates after reapply', async () => {
    // Instance snapshot has torso: plate-steel, source now has torso: chain-mail
    const sourceBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', slot: 'head' }, torso: { sourceId: 'chain-mail', slot: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [sourceBuild] as never[] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Before reapply: torso shows plate-steel
    expect(screen.getByText('plate-steel')).toBeInTheDocument();
    // Reapply
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // After reapply: torso shows chain-mail
    expect(screen.getByText('chain-mail')).toBeInTheDocument();
    expect(screen.queryByText('plate-steel')).toBeNull();
  });

  it('clearing override after reapply reveals updated inherited slot', async () => {
    // Instance has head override, source changed head to helm-v2
    const instWithOverride: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
      },
    };
    const sourceBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-v2', slot: 'head' }, torso: { sourceId: 'plate-steel', slot: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [instWithOverride]);
    seedStores({ libraryBuilds: [sourceBuild] as never[] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    // Reapply first
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // Head still shows crown-gold (overridden)
    expect(screen.getByText('crown-gold')).toBeInTheDocument();
    // Clear the head override (second btn after Replace)
    const headRow = document.querySelectorAll('.scene-override-slot-row')[0];
    const clearBtn = headRow.querySelectorAll('.scene-override-action-btn')[1] as HTMLElement;
    expect(clearBtn.textContent).toBe('Clear');
    await act(async () => { await userEvent.click(clearBtn); });
    // Should now show helm-v2 (from reapplied source), not helm-iron (original)
    expect(screen.getByText('helm-v2')).toBeInTheDocument();
  });

  it('override count remains stable after reapply', async () => {
    const instWithOverrides: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
        torso: { slot: 'torso', mode: 'remove' },
      },
    };
    const sourceBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', slot: 'head' }, torso: { sourceId: 'plate-steel', slot: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [instWithOverrides]);
    seedStores({ libraryBuilds: [sourceBuild] as never[] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('2 local overrides')).toBeInTheDocument();
    // Reapply
    await act(async () => { await userEvent.click(screen.getByText('Reapply from Source')); });
    // Override count unchanged
    expect(screen.getByText('2 local overrides')).toBeInTheDocument();
  });

  it('stale hint appears for snapshot/source drift, not override-only', async () => {
    // Source has different slot count than snapshot (triggers stale)
    const sourceBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', slot: 'head' } }, // 1 slot vs snapshot's 2
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [INST_CHAR]);
    seedStores({ libraryBuilds: [sourceBuild] as never[] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.getByText('Out of date')).toBeInTheDocument();
  });

  it('no false stale hint for override-only state', async () => {
    // Source matches snapshot exactly — overrides exist but should NOT trigger stale
    const instWithOverride: SceneAssetInstance = {
      ...INST_CHAR,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown-gold' },
      },
    };
    const sourceBuild = {
      id: 'build-1', name: 'Knight Build',
      slots: { head: { sourceId: 'helm-iron', slot: 'head' }, torso: { sourceId: 'plate-steel', slot: 'torso' } },
      createdAt: '', updatedAt: '',
    };
    mock.on('get_scene_instances', () => [instWithOverride]);
    seedStores({ libraryBuilds: [sourceBuild] as never[] });
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Knight')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Knight')); });
    expect(screen.queryByText('Out of date')).toBeNull();
  });

  it('missing-source still disables reapply with overrides present', async () => {
    const instWithOverride: SceneAssetInstance = {
      ...INST_CHAR_ORPHAN,
      characterOverrides: {
        head: { slot: 'head', mode: 'replace', replacementPartId: 'crown' },
      },
    };
    mock.on('get_scene_instances', () => [instWithOverride]);
    seedStores({ libraryBuildIds: [] }); // no builds in library
    await act(async () => { render(<SceneInstancesPanel />); });
    await waitFor(() => { expect(screen.getByText('Deleted Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Deleted Hero')); });
    const reapplyBtn = screen.getByText('Reapply from Source');
    expect(reapplyBtn).toBeDisabled();
  });
});
