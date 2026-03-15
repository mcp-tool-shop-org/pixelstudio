import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useScenePlaybackStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';

import { ScenePlaybackControls } from '../components/ScenePlaybackControls';

function seedStore(overrides: Partial<ReturnType<typeof useScenePlaybackStore.getState>> = {}) {
  useScenePlaybackStore.setState({
    isPlaying: false,
    fps: 12,
    looping: true,
    elapsedMs: 0,
    currentTick: 0,
    lastTickTime: 0,
    playbackState: null,
    totalTicks: 1,
    cameraX: 0,
    cameraY: 0,
    cameraZoom: 1.0,
    baseCameraX: 0,
    baseCameraY: 0,
    baseCameraZoom: 1.0,
    cameraKeyframes: [],
    selectedKeyframeTick: null,
    ...overrides,
  });
}

const PLAYBACK_STATE_WITH_INSTANCES = {
  fps: 12,
  looping: true,
  instances: [
    { instanceId: 'i1', clipId: 'c1', clipName: 'idle', frameCount: 4, clipFps: null, clipLoop: false, status: 'resolved' as const, frameIndex: 0, totalFrames: 4 },
  ],
};

const EMPTY_PLAYBACK_STATE = {
  fps: 12,
  looping: true,
  instances: [],
};

describe('ScenePlaybackControls', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('get_scene_playback_state', () => PLAYBACK_STATE_WITH_INSTANCES);
    mock.on('get_scene_timeline_summary', () => ({ totalTicks: 48 }));
  });

  afterEach(() => {
    cleanup();
    useScenePlaybackStore.getState().clearAll();
  });

  // ── Rendering ──

  it('renders transport buttons', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48 });
    render(<ScenePlaybackControls />);
    expect(screen.getByTitle('Stop and reset')).toBeInTheDocument();
    expect(screen.getByTitle('Step back')).toBeInTheDocument();
    expect(screen.getByTitle('Play')).toBeInTheDocument();
    expect(screen.getByTitle('Step forward')).toBeInTheDocument();
    expect(screen.getByTitle('Toggle loop')).toBeInTheDocument();
  });

  it('renders FPS input with current value', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, fps: 12 });
    render(<ScenePlaybackControls />);
    const fpsInput = screen.getByTitle('Scene FPS');
    expect(fpsInput).toHaveValue(12);
  });

  it('shows tick readout as currentTick / totalTicks', () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, currentTick: 5, totalTicks: 48 });
    render(<ScenePlaybackControls />);
    expect(screen.getByText('5 / 48')).toBeInTheDocument();
  });

  it('shows time readout in seconds', () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, currentTick: 12, totalTicks: 48, elapsedMs: 1000, fps: 12 });
    render(<ScenePlaybackControls />);
    expect(screen.getByText('1.0s / 4.0s')).toBeInTheDocument();
  });

  it('renders scrubber with correct range', () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, currentTick: 10 });
    render(<ScenePlaybackControls />);
    const scrubber = screen.getByRole('slider');
    expect(scrubber).toHaveAttribute('min', '0');
    expect(scrubber).toHaveAttribute('max', '47');
  });

  it('renders Export Frame button', () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES });
    render(<ScenePlaybackControls />);
    expect(screen.getByTitle('Export camera frame at current tick as PNG')).toBeInTheDocument();
  });

  // ── No instances → disabled ──

  it('disables transport when no instances', () => {
    seedStore({ playbackState: EMPTY_PLAYBACK_STATE });
    render(<ScenePlaybackControls />);
    expect(screen.getByTitle('Stop and reset')).toBeDisabled();
    expect(screen.getByTitle('Step back')).toBeDisabled();
    expect(screen.getByTitle('Play')).toBeDisabled();
    expect(screen.getByTitle('Step forward')).toBeDisabled();
  });

  it('disables scrubber when no instances', () => {
    seedStore({ playbackState: EMPTY_PLAYBACK_STATE });
    render(<ScenePlaybackControls />);
    const scrubber = screen.getByRole('slider');
    expect(scrubber).toBeDisabled();
  });

  it('disables export when no instances', () => {
    seedStore({ playbackState: EMPTY_PLAYBACK_STATE });
    render(<ScenePlaybackControls />);
    expect(screen.getByTitle('Export camera frame at current tick as PNG')).toBeDisabled();
  });

  // ── Transport interactions ──

  it('play button sets isPlaying to true', async () => {
    // Mock rAF to prevent infinite loop in happy-dom
    const rafSpy = vi.spyOn(globalThis, 'requestAnimationFrame').mockReturnValue(0);
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48 });
    render(<ScenePlaybackControls />);
    const playBtn = screen.getByTitle('Play');
    await act(async () => { await userEvent.click(playBtn); });
    expect(useScenePlaybackStore.getState().isPlaying).toBe(true);
    rafSpy.mockRestore();
  });

  it('pause button shows when playing', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, isPlaying: true });
    render(<ScenePlaybackControls />);
    expect(screen.getByTitle('Pause')).toBeInTheDocument();
  });

  it('stop resets clock', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, currentTick: 10, elapsedMs: 833 });
    render(<ScenePlaybackControls />);
    await act(async () => { await userEvent.click(screen.getByTitle('Stop and reset')); });
    const state = useScenePlaybackStore.getState();
    expect(state.currentTick).toBe(0);
    expect(state.elapsedMs).toBe(0);
  });

  it('step forward advances tick by 1', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, currentTick: 5 });
    render(<ScenePlaybackControls />);
    await act(async () => { await userEvent.click(screen.getByTitle('Step forward')); });
    expect(useScenePlaybackStore.getState().currentTick).toBe(6);
  });

  it('step back decreases tick by 1', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, currentTick: 5 });
    render(<ScenePlaybackControls />);
    await act(async () => { await userEvent.click(screen.getByTitle('Step back')); });
    expect(useScenePlaybackStore.getState().currentTick).toBe(4);
  });

  // ── Loop toggle ──

  it('toggles looping and invokes set_scene_loop', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, looping: true });
    render(<ScenePlaybackControls />);
    await act(async () => { await userEvent.click(screen.getByTitle('Toggle loop')); });
    expect(useScenePlaybackStore.getState().looping).toBe(false);
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('set_scene_loop');
  });

  // ── FPS change ──

  it('changes FPS and invokes set_scene_playback_fps', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, fps: 12 });
    render(<ScenePlaybackControls />);
    const fpsInput = screen.getByTitle('Scene FPS');
    await act(async () => {
      await userEvent.tripleClick(fpsInput);
      await userEvent.type(fpsInput, '24');
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('set_scene_playback_fps');
  });

  // ── Jump buttons ──

  it('jump to start seeks to tick 0', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, currentTick: 20 });
    render(<ScenePlaybackControls />);
    await act(async () => { await userEvent.click(screen.getByTitle('Jump to start')); });
    expect(useScenePlaybackStore.getState().currentTick).toBe(0);
  });

  it('jump to end seeks to last tick', async () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, totalTicks: 48, currentTick: 0 });
    render(<ScenePlaybackControls />);
    await act(async () => { await userEvent.click(screen.getByTitle('Jump to end')); });
    expect(useScenePlaybackStore.getState().currentTick).toBe(47);
  });

  // ── Playing indicator ──

  it('shows playing indicator when isPlaying', () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, isPlaying: true });
    render(<ScenePlaybackControls />);
    expect(screen.getByText('\u25CF')).toBeInTheDocument();
  });

  it('hides playing indicator when paused', () => {
    seedStore({ playbackState: PLAYBACK_STATE_WITH_INSTANCES, isPlaying: false });
    render(<ScenePlaybackControls />);
    expect(screen.queryByText('\u25CF')).not.toBeInTheDocument();
  });

  // ── Backend load on mount ──

  it('loads playback state and timeline summary on mount', async () => {
    seedStore();
    await act(async () => { render(<ScenePlaybackControls />); });
    await waitFor(() => {
      const cmds = mock.fn.mock.calls.map((c: unknown[]) => c[0]);
      expect(cmds).toContain('get_scene_playback_state');
      expect(cmds).toContain('get_scene_timeline_summary');
    });
  });
});
