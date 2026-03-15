import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useScenePlaybackStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { SceneCameraKeyframe } from '@pixelstudio/domain';

import { CameraKeyframePanel } from '../components/CameraKeyframePanel';

const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear', name: 'Start' };
const KF_B: SceneCameraKeyframe = { tick: 24, x: 100, y: 50, zoom: 2.0, interpolation: 'hold', name: 'Mid' };
const KF_C: SceneCameraKeyframe = { tick: 48, x: 200, y: 100, zoom: 1.5, interpolation: 'linear', name: null };

function seedStore(overrides: Partial<ReturnType<typeof useScenePlaybackStore.getState>> = {}) {
  useScenePlaybackStore.setState({
    isPlaying: false,
    fps: 12,
    looping: true,
    elapsedMs: 0,
    currentTick: 0,
    lastTickTime: 0,
    playbackState: null,
    totalTicks: 60,
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

describe('CameraKeyframePanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('list_scene_camera_keyframes', () => []);
  });

  afterEach(() => {
    cleanup();
    useScenePlaybackStore.getState().clearAll();
  });

  // ── Empty state ──

  it('shows empty state when no keyframes', async () => {
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText('Camera Keyframes')).toBeInTheDocument();
    expect(screen.getByText(/Camera follows base position/)).toBeInTheDocument();
  });

  it('shows "Add Key at Tick N" button with current tick', async () => {
    seedStore({ currentTick: 7 });
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText(/Add Key at Tick 7/)).toBeInTheDocument();
  });

  it('add button in empty state invokes add_scene_camera_keyframe', async () => {
    seedStore({ currentTick: 5, cameraX: 10, cameraY: 20, cameraZoom: 1.5 });
    mock.on('add_scene_camera_keyframe', () => [{ tick: 5, x: 10, y: 20, zoom: 1.5, interpolation: 'linear', name: null }]);
    await act(async () => { render(<CameraKeyframePanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText(/Add Key at Tick 5/));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('add_scene_camera_keyframe');
  });

  // ── With keyframes ──

  it('renders keyframe list in keyframes view', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B, KF_C]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText('Start')).toBeInTheDocument();
    expect(screen.getByText('Mid')).toBeInTheDocument();
    // KF_C has null name → shows em dash
    expect(screen.getByText('\u2014')).toBeInTheDocument();
  });

  it('shows tick column with keyframe data', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    // Tick values visible in the rows
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('24')).toBeInTheDocument();
  });

  it('shows zoom as percentage', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.getByText('200%')).toBeInTheDocument();
  });

  it('shows interpolation badge L for linear, H for hold', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    // KF_A = linear → L, KF_B = hold → H
    expect(screen.getByText('L')).toBeInTheDocument();
    expect(screen.getByText('H')).toBeInTheDocument();
  });

  it('shows diamond indicator when playhead is on a keyframe', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore({ currentTick: 0 });
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText(/tick 0.*\u25C6/)).toBeInTheDocument();
  });

  it('shows view toggle with Keyframes and Shots buttons', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText('Keyframes')).toBeInTheDocument();
    expect(screen.getByText('Shots')).toBeInTheDocument();
  });

  it('Keyframes view button has active class by default', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    const kfBtn = screen.getByText('Keyframes');
    expect(kfBtn.className).toContain('active');
  });

  // ── Shots view ──

  it('switches to shots view and shows shot names', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore({ totalTicks: 60 });
    await act(async () => { render(<CameraKeyframePanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText('Shots'));
    });
    // Shot names derived from keyframe names — may appear multiple times
    expect(screen.getAllByText('Start').length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText('Mid').length).toBeGreaterThanOrEqual(1);
    // Shots view column headers
    expect(screen.getByText('Shot')).toBeInTheDocument();
    expect(screen.getByText('Dur')).toBeInTheDocument();
  });

  it('shots view shows duration in ticks', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore({ totalTicks: 60 });
    await act(async () => { render(<CameraKeyframePanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText('Shots'));
    });
    expect(screen.getByText('24t')).toBeInTheDocument(); // KF_A shot: 0→24 = 24 ticks
    expect(screen.getByText('36t')).toBeInTheDocument(); // KF_B shot: 24→60 = 36 ticks
  });

  // ── Toolbar actions ──

  it('has "+ Key" button that invokes add_scene_camera_keyframe', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A]);
    mock.on('add_scene_camera_keyframe', () => [KF_A, KF_B]);
    seedStore({ currentTick: 24, cameraX: 100, cameraY: 50, cameraZoom: 2.0 });
    await act(async () => { render(<CameraKeyframePanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText('+ Key'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('add_scene_camera_keyframe');
  });

  // ── Row actions ──

  it('jump button seeks playhead to keyframe tick', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore({ currentTick: 0, totalTicks: 60 });
    await act(async () => { render(<CameraKeyframePanel />); });
    // Find jump buttons (▶)
    const jumpBtns = screen.getAllByTitle('Jump to tick');
    await act(async () => {
      await userEvent.click(jumpBtns[1]); // Second row = KF_B at tick 24
    });
    expect(useScenePlaybackStore.getState().currentTick).toBe(24);
  });

  it('delete button invokes delete_scene_camera_keyframe', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    mock.on('delete_scene_camera_keyframe', () => [KF_A]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    const delBtns = screen.getAllByTitle('Delete');
    await act(async () => {
      await userEvent.click(delBtns[1]); // Delete KF_B
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('delete_scene_camera_keyframe');
  });

  // ── Editor (selected keyframe) ──

  it('clicking a keyframe row selects it and shows editor', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A, KF_B]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    // Click on the row for KF_A (tick 0, name "Start")
    const rows = document.querySelectorAll('.camkf-row');
    await act(async () => {
      await userEvent.click(rows[0] as HTMLElement);
    });
    // Editor should appear
    expect(screen.getByText(/Key @ tick 0/)).toBeInTheDocument();
  });

  it('editor shows Name field and Delete button', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    // Click to select
    const rows = document.querySelectorAll('.camkf-row');
    await act(async () => { await userEvent.click(rows[0] as HTMLElement); });
    expect(screen.getByText(/Key @ tick 0/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('(unnamed)')).toBeInTheDocument();
    expect(screen.getByText('Delete Key')).toBeInTheDocument();
  });

  it('editor Save invokes update_scene_camera_keyframe when dirty', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A]);
    mock.on('update_scene_camera_keyframe', () => [KF_A]);
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    const rows = document.querySelectorAll('.camkf-row');
    await act(async () => { await userEvent.click(rows[0] as HTMLElement); });
    // Modify name to make editor dirty
    const nameInput = screen.getByPlaceholderText('(unnamed)');
    await act(async () => {
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'Renamed');
    });
    await act(async () => {
      await userEvent.click(screen.getByText('Save Changes'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('update_scene_camera_keyframe');
  });

  // ── Resolved camera display ──

  it('shows resolved camera values at current tick', async () => {
    mock.on('list_scene_camera_keyframes', () => [KF_A]);
    seedStore({ cameraX: 0, cameraY: 0, cameraZoom: 1.0, currentTick: 0 });
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(screen.getByText(/Resolved @ 0/)).toBeInTheDocument();
    expect(screen.getByText(/\(0\.0, 0\.0\) 100%/)).toBeInTheDocument();
  });

  // ── Backend load ──

  it('calls list_scene_camera_keyframes on mount', async () => {
    seedStore();
    await act(async () => { render(<CameraKeyframePanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('list_scene_camera_keyframes');
  });
});
