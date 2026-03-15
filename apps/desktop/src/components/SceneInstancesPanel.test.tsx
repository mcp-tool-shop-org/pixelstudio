import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useScenePlaybackStore, useProjectStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { SceneAssetInstance } from '@pixelstudio/domain';

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
  clipId: null,
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
  clipId: null,
};

const PLAYBACK_STATE = {
  fps: 12,
  looping: true,
  instances: [
    { instanceId: 'i1', status: 'resolved' as const, clipName: 'idle', frameIndex: 0, totalFrames: 4 },
    { instanceId: 'i2', status: 'no_clip' as const, clipName: null, frameIndex: 0, totalFrames: 0 },
    { instanceId: 'i3', status: 'no_clip' as const, clipName: null, frameIndex: 0, totalFrames: 0 },
  ],
};

function seedStores() {
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: null, isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasWidth: 64, canvasHeight: 64,
  });
  useScenePlaybackStore.setState({ playbackState: PLAYBACK_STATE });
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
});
