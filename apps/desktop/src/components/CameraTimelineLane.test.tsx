import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useScenePlaybackStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { SceneCameraKeyframe } from '@pixelstudio/domain';

import { CameraTimelineLane } from '../components/CameraTimelineLane';

const KF_A: SceneCameraKeyframe = { tick: 0, x: 0, y: 0, zoom: 1.0, interpolation: 'linear', name: 'Start' };
const KF_B: SceneCameraKeyframe = { tick: 24, x: 100, y: 50, zoom: 2.0, interpolation: 'hold', name: 'Mid' };

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

describe('CameraTimelineLane', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
  });

  afterEach(() => {
    cleanup();
    useScenePlaybackStore.getState().clearAll();
  });

  // ── Empty state ──

  it('shows empty message when no keyframes', () => {
    seedStore({ cameraKeyframes: [] });
    render(<CameraTimelineLane />);
    expect(screen.getByText(/No camera keyframes/)).toBeInTheDocument();
  });

  it('shows Camera label', () => {
    seedStore();
    render(<CameraTimelineLane />);
    expect(screen.getByText(/Camera/)).toBeInTheDocument();
  });

  // ── Lane actions — empty ──

  it('shows + button for adding keyframe', () => {
    seedStore();
    render(<CameraTimelineLane />);
    expect(screen.getByTitle('Add key at playhead (K)')).toBeInTheDocument();
  });

  it('delete button disabled when nothing selected', () => {
    seedStore({ cameraKeyframes: [KF_A], selectedKeyframeTick: null });
    render(<CameraTimelineLane />);
    expect(screen.getByTitle('Delete selected key (Del)')).toBeDisabled();
  });

  it('prev/next buttons disabled with no keyframes', () => {
    seedStore({ cameraKeyframes: [] });
    render(<CameraTimelineLane />);
    expect(screen.getByTitle('Previous key ([)')).toBeDisabled();
    expect(screen.getByTitle('Next key (])')).toBeDisabled();
  });

  // ── With keyframes ──

  it('renders markers for each keyframe', () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60 });
    render(<CameraTimelineLane />);
    const markers = document.querySelectorAll('.cam-lane-marker');
    expect(markers.length).toBe(2);
  });

  it('renders shot span bars', () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60 });
    render(<CameraTimelineLane />);
    const shots = document.querySelectorAll('.cam-lane-shot');
    expect(shots.length).toBe(2); // KF_A→KF_B, KF_B→end
  });

  it('renders playhead element', () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 10 });
    render(<CameraTimelineLane />);
    const playhead = document.querySelector('.cam-lane-playhead');
    expect(playhead).not.toBeNull();
  });

  it('shows current shot name when playhead is in a shot', () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 5 });
    render(<CameraTimelineLane />);
    // currentTick 5 → in first shot (KF_A: ticks 0-24) — name appears in header + shot bar
    const currentShotLabel = document.querySelector('.cam-lane-current-shot');
    expect(currentShotLabel).not.toBeNull();
    expect(currentShotLabel!.textContent).toBe('Start');
  });

  // ── Lane actions with keyframes ──

  it('add key invokes add_scene_camera_keyframe', async () => {
    mock.on('add_scene_camera_keyframe', () => [KF_A, KF_B]);
    seedStore({ cameraKeyframes: [KF_A], totalTicks: 60, currentTick: 24, cameraX: 100, cameraY: 50, cameraZoom: 2.0 });
    render(<CameraTimelineLane />);
    await act(async () => {
      await userEvent.click(screen.getByTitle('Add key at playhead (K)'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('add_scene_camera_keyframe');
  });

  it('delete selected invokes delete_scene_camera_keyframe', async () => {
    mock.on('delete_scene_camera_keyframe', () => [KF_A]);
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, selectedKeyframeTick: 24 });
    render(<CameraTimelineLane />);
    await act(async () => {
      await userEvent.click(screen.getByTitle('Delete selected key (Del)'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('delete_scene_camera_keyframe');
  });

  it('prev key navigates to earlier keyframe', async () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 30 });
    render(<CameraTimelineLane />);
    await act(async () => {
      await userEvent.click(screen.getByTitle('Previous key ([)'));
    });
    expect(useScenePlaybackStore.getState().currentTick).toBe(24);
  });

  it('next key navigates to later keyframe', async () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 5 });
    render(<CameraTimelineLane />);
    await act(async () => {
      await userEvent.click(screen.getByTitle('Next key (])'));
    });
    expect(useScenePlaybackStore.getState().currentTick).toBe(24);
  });

  it('jump to selected button appears when keyframe selected', () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, selectedKeyframeTick: 24 });
    render(<CameraTimelineLane />);
    expect(screen.getByTitle('Jump to selected (J)')).toBeInTheDocument();
  });

  it('jump to selected button hidden when no selection', () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, selectedKeyframeTick: null });
    render(<CameraTimelineLane />);
    expect(screen.queryByTitle('Jump to selected (J)')).not.toBeInTheDocument();
  });

  it('jump to selected seeks to selected tick', async () => {
    seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 0, selectedKeyframeTick: 24 });
    render(<CameraTimelineLane />);
    await act(async () => {
      await userEvent.click(screen.getByTitle('Jump to selected (J)'));
    });
    expect(useScenePlaybackStore.getState().currentTick).toBe(24);
  });

  // ── Keyboard shortcuts ──

  describe('hotkeys', () => {
    function pressKey(key: string, opts?: { shiftKey?: boolean }) {
      const event = new KeyboardEvent('keydown', {
        key,
        shiftKey: opts?.shiftKey ?? false,
        ctrlKey: false,
        metaKey: false,
        altKey: false,
        bubbles: true,
      });
      window.dispatchEvent(event);
    }

    it('[ navigates to previous key', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 30 });
      render(<CameraTimelineLane />);
      act(() => pressKey('['));
      expect(useScenePlaybackStore.getState().currentTick).toBe(24);
      expect(useScenePlaybackStore.getState().selectedKeyframeTick).toBe(24);
    });

    it('] navigates to next key', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 5 });
      render(<CameraTimelineLane />);
      act(() => pressKey(']'));
      expect(useScenePlaybackStore.getState().currentTick).toBe(24);
      expect(useScenePlaybackStore.getState().selectedKeyframeTick).toBe(24);
    });

    it('[ is no-op when no earlier key exists', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 0 });
      render(<CameraTimelineLane />);
      act(() => pressKey('['));
      expect(useScenePlaybackStore.getState().currentTick).toBe(0);
    });

    it('] is no-op when no later key exists', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 30 });
      render(<CameraTimelineLane />);
      act(() => pressKey(']'));
      // No key after tick 24, currentTick 30 is after last key
      expect(useScenePlaybackStore.getState().currentTick).toBe(30);
    });

    it('[ and ] are no-ops with no keyframes', () => {
      seedStore({ cameraKeyframes: [], totalTicks: 60, currentTick: 10 });
      render(<CameraTimelineLane />);
      act(() => pressKey('['));
      expect(useScenePlaybackStore.getState().currentTick).toBe(10);
      act(() => pressKey(']'));
      expect(useScenePlaybackStore.getState().currentTick).toBe(10);
    });

    it('K adds key at playhead', async () => {
      mock.on('add_scene_camera_keyframe', () => [KF_A, KF_B]);
      seedStore({ cameraKeyframes: [KF_A], totalTicks: 60, currentTick: 24, cameraX: 100, cameraY: 50, cameraZoom: 2.0 });
      render(<CameraTimelineLane />);
      await act(async () => pressKey('k'));
      expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('add_scene_camera_keyframe');
    });

    it('J jumps to selected key', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 0, selectedKeyframeTick: 24 });
      render(<CameraTimelineLane />);
      act(() => pressKey('j'));
      expect(useScenePlaybackStore.getState().currentTick).toBe(24);
    });

    it('J is no-op when nothing selected', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 10, selectedKeyframeTick: null });
      render(<CameraTimelineLane />);
      act(() => pressKey('j'));
      expect(useScenePlaybackStore.getState().currentTick).toBe(10);
    });

    it('Delete deletes selected key', async () => {
      mock.on('delete_scene_camera_keyframe', () => [KF_A]);
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, selectedKeyframeTick: 24 });
      render(<CameraTimelineLane />);
      await act(async () => pressKey('Delete'));
      expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('delete_scene_camera_keyframe');
    });

    it('Delete is no-op when nothing selected', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, selectedKeyframeTick: null });
      render(<CameraTimelineLane />);
      act(() => pressKey('Delete'));
      // No invoke call for delete
      expect(mock.fn.mock.calls.length).toBe(0);
    });

    it('Shift+[ navigates to previous shot', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 30 });
      render(<CameraTimelineLane />);
      // Shift+[ produces { on US keyboard
      act(() => pressKey('{', { shiftKey: true }));
      // At tick 30 (inside shot B starting at 24), should go to start of shot B
      expect(useScenePlaybackStore.getState().currentTick).toBe(24);
    });

    it('Shift+] navigates to next shot', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 5 });
      render(<CameraTimelineLane />);
      // Shift+] produces } on US keyboard
      act(() => pressKey('}', { shiftKey: true }));
      expect(useScenePlaybackStore.getState().currentTick).toBe(24);
    });

    it('hotkeys suppressed when typing in input', () => {
      seedStore({ cameraKeyframes: [KF_A, KF_B], totalTicks: 60, currentTick: 5 });
      render(<CameraTimelineLane />);
      // Simulate keydown from an input element
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const event = new KeyboardEvent('keydown', {
        key: ']',
        bubbles: true,
      });
      Object.defineProperty(event, 'target', { value: input });
      window.dispatchEvent(event);
      // Should NOT navigate
      expect(useScenePlaybackStore.getState().currentTick).toBe(5);
      document.body.removeChild(input);
    });
  });
});
