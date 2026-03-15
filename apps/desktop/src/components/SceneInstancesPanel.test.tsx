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

function seedStores(opts?: { libraryBuildIds?: string[] }) {
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: null, isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 64, height: 64 },
  });
  useScenePlaybackStore.setState({ playbackState: PLAYBACK_STATE });
  // Seed character library with build IDs (for source availability checks)
  const builds: Record<string, unknown> = {};
  for (const id of opts?.libraryBuildIds ?? []) {
    builds[id] = { id, name: `Build ${id}`, slots: {}, createdAt: '', updatedAt: '' };
  }
  useCharacterStore.setState({
    library: { builds: builds as Record<string, never>, order: Object.keys(builds) },
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
});
