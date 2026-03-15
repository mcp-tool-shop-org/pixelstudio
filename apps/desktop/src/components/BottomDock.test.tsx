import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkspaceMode } from '@glyphstudio/domain';
import { useTimelineStore, useProjectStore, useSelectionStore, useScenePlaybackStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';

// Mock heavy child panels — we're testing the dock's orchestration, not the panels
vi.mock('../components/MotionPanel', () => ({
  MotionPanel: () => <div data-testid="motion-panel">MotionPanel</div>,
}));
vi.mock('../components/AnchorPanel', () => ({
  AnchorPanel: () => <div data-testid="anchor-panel">AnchorPanel</div>,
}));
vi.mock('../components/SandboxPanel', () => ({
  SandboxPanel: () => <div data-testid="sandbox-panel">SandboxPanel</div>,
}));
vi.mock('../components/PresetPanel', () => ({
  PresetPanel: () => <div data-testid="preset-panel">PresetPanel</div>,
}));
vi.mock('../components/ClipPanel', () => ({
  ClipPanel: () => <div data-testid="clip-panel">ClipPanel</div>,
}));
vi.mock('../components/ExportPreviewPanel', () => ({
  ExportPreviewPanel: () => <div data-testid="export-preview-panel">ExportPreviewPanel</div>,
}));
vi.mock('../components/ScenePlaybackControls', () => ({
  ScenePlaybackControls: () => <div data-testid="scene-playback">ScenePlayback</div>,
}));
vi.mock('../components/CameraTimelineLane', () => ({
  CameraTimelineLane: () => <div data-testid="camera-lane">CameraLane</div>,
}));

import { BottomDock } from '../components/BottomDock';

const MOCK_FRAME = {
  width: 32,
  height: 32,
  layers: [],
  layerOrder: [],
  composited: new Array(32 * 32 * 4).fill(0),
  palette: null,
};

const MOCK_TIMELINE_RESULT = {
  frames: [
    { id: 'f0', name: 'Frame 1', index: 0, durationMs: null },
    { id: 'f1', name: 'Frame 2', index: 1, durationMs: null },
    { id: 'f2', name: 'Frame 3', index: 2, durationMs: null },
  ],
  activeFrameIndex: 0,
  activeFrameId: 'f0',
  frame: MOCK_FRAME,
};

function seedTimeline(frameCount = 3) {
  const frames = Array.from({ length: frameCount }, (_, i) => ({
    id: `f${i}`, name: `Frame ${i + 1}`, index: i, durationMs: null,
  }));
  useTimelineStore.setState({
    frames,
    activeFrameId: 'f0',
    activeFrameIndex: 0,
    fps: 8,
    playing: false,
    loop: true,
    onionSkinEnabled: false,
    onionSkinShowPrev: true,
    onionSkinShowNext: false,
  });
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: null, isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 32, height: 32 },
  });
  useSelectionStore.setState({
    hasSelection: false, isTransforming: false, selectionBounds: null,
  });
  useScenePlaybackStore.setState({ isPlaying: false });
}

describe('BottomDock', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('get_timeline', () => MOCK_TIMELINE_RESULT);
    mock.on('select_frame', () => MOCK_TIMELINE_RESULT);
    mock.on('create_frame', () => MOCK_TIMELINE_RESULT);
    mock.on('duplicate_frame', () => MOCK_TIMELINE_RESULT);
    mock.on('delete_frame', () => MOCK_TIMELINE_RESULT);
    mock.on('reorder_frame', () => MOCK_TIMELINE_RESULT);
    mock.on('insert_frame_at', () => MOCK_TIMELINE_RESULT);
    mock.on('mark_dirty', () => null);
    mock.on('clear_selection', () => null);
  });
  afterEach(cleanup);

  describe('mode-based layout', () => {
    it('scene mode renders ScenePlaybackControls + CameraTimelineLane', () => {
      seedTimeline();
      render(<BottomDock activeMode="scene" />);
      expect(screen.getByTestId('scene-playback')).toBeInTheDocument();
      expect(screen.getByTestId('camera-lane')).toBeInTheDocument();
    });

    it('scene mode does NOT render timeline', () => {
      seedTimeline();
      render(<BottomDock activeMode="scene" />);
      expect(screen.queryByText(/fps/)).toBeNull();
    });

    it('project-home mode shows mode label only', () => {
      seedTimeline();
      render(<BottomDock activeMode="project-home" />);
      expect(screen.getByText('project-home')).toBeInTheDocument();
      expect(screen.queryByText('Play')).toBeNull();
    });

    it.each(['edit', 'animate', 'locomotion'] as WorkspaceMode[])(
      '%s mode shows timeline panel',
      (mode) => {
        seedTimeline();
        render(<BottomDock activeMode={mode} />);
        expect(screen.getByText('fps')).toBeInTheDocument();
      },
    );

    it('ai mode shows mode label, no timeline', () => {
      seedTimeline();
      render(<BottomDock activeMode="ai" />);
      expect(screen.getByText('ai')).toBeInTheDocument();
    });

    it('locomotion mode shows motion sub-panels', () => {
      seedTimeline();
      render(<BottomDock activeMode="locomotion" />);
      expect(screen.getByTestId('motion-panel')).toBeInTheDocument();
      expect(screen.getByTestId('anchor-panel')).toBeInTheDocument();
      expect(screen.getByTestId('sandbox-panel')).toBeInTheDocument();
      expect(screen.getByTestId('preset-panel')).toBeInTheDocument();
    });

    it('edit mode does NOT show locomotion sub-panels', () => {
      seedTimeline();
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByTestId('motion-panel')).toBeNull();
      expect(screen.queryByTestId('anchor-panel')).toBeNull();
    });
  });

  describe('timeline frame buttons', () => {
    it('renders frame buttons matching frame count', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('active frame button has active class', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      const btn1 = screen.getByText('1').closest('.timeline-frame');
      expect(btn1?.className).toContain('active');
    });

    it('clicking a frame button invokes select_frame', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByText('2'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('select_frame', { frameId: 'f1' });
      });
    });

    it('frame info shows count', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByText('3 frames')).toBeInTheDocument();
    });

    it('single frame says "frame" not "frames"', () => {
      seedTimeline(1);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByText('1 frame')).toBeInTheDocument();
    });
  });

  describe('transport controls', () => {
    it('play button disabled with single frame', () => {
      seedTimeline(1);
      render(<BottomDock activeMode="edit" />);
      const playBtn = screen.getByTitle('Play (Space)');
      expect(playBtn).toBeDisabled();
    });

    it('play button enabled with multiple frames', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      const playBtn = screen.getByTitle('Play (Space)');
      expect(playBtn).not.toBeDisabled();
    });

    it('clicking play sets playing state', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Play (Space)'));
      });
      expect(useTimelineStore.getState().playing).toBe(true);
    });

    it('play blocked when isTransforming', async () => {
      seedTimeline(3);
      useSelectionStore.setState({ isTransforming: true });
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Play (Space)'));
      });
      expect(useTimelineStore.getState().playing).toBe(false);
    });

    it('loop toggle updates store', async () => {
      seedTimeline(3);
      useTimelineStore.setState({ loop: false });
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Toggle loop'));
      });
      expect(useTimelineStore.getState().loop).toBe(true);
    });

    it('loop button shows active class when looping', () => {
      seedTimeline(3);
      useTimelineStore.setState({ loop: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Toggle loop').className).toContain('active');
    });
  });

  describe('frame management buttons', () => {
    it('shows new frame button when not playing', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('New frame')).toBeInTheDocument();
    });

    it('shows duplicate frame button when not playing', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Duplicate frame')).toBeInTheDocument();
    });

    it('shows delete frame button when >1 frame', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Delete frame')).toBeInTheDocument();
    });

    it('hides delete frame button with single frame', () => {
      seedTimeline(1);
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByTitle('Delete frame')).toBeNull();
    });

    it('clicking new frame invokes create_frame', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('New frame'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('create_frame', { name: null });
      });
    });

    it('clicking duplicate invokes duplicate_frame', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Duplicate frame'));
      });
      await waitFor(() => {
        const calls = mock.fn.mock.calls.map((c: any[]) => c[0]);
        expect(calls).toContain('duplicate_frame');
      });
    });

    it('clicking delete invokes delete_frame', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Delete frame'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('delete_frame', { frameId: 'f0' });
      });
    });
  });

  describe('frame reorder buttons', () => {
    it('move left disabled at first frame', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Move frame left')).toBeDisabled();
    });

    it('move right disabled at last frame', () => {
      seedTimeline(3);
      useTimelineStore.setState({ activeFrameIndex: 2, activeFrameId: 'f2' });
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Move frame right')).toBeDisabled();
    });

    it('clicking move right invokes reorder_frame', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Move frame right'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('reorder_frame', { frameId: 'f0', newIndex: 1 });
      });
    });
  });

  describe('insert frame buttons', () => {
    it('shows insert before and after buttons', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Insert blank before')).toBeInTheDocument();
      expect(screen.getByTitle('Insert blank after')).toBeInTheDocument();
    });

    it('insert before invokes insert_frame_at with current position', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Insert blank before'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('insert_frame_at', { position: 0, name: null });
      });
    });

    it('insert after invokes insert_frame_at with position+1', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Insert blank after'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('insert_frame_at', { position: 1, name: null });
      });
    });
  });

  describe('onion skin controls', () => {
    it('onion skin button toggles store', async () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Toggle onion skin (O)'));
      });
      expect(useTimelineStore.getState().onionSkinEnabled).toBe(true);
    });

    it('onion skin active class when enabled', () => {
      seedTimeline(3);
      useTimelineStore.setState({ onionSkinEnabled: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Toggle onion skin (O)').className).toContain('active');
    });

    it('shows prev/next checkboxes when onion skin enabled', () => {
      seedTimeline(3);
      useTimelineStore.setState({ onionSkinEnabled: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByText('prev')).toBeInTheDocument();
      expect(screen.getByText('next')).toBeInTheDocument();
    });

    it('hides prev/next checkboxes when onion skin disabled', () => {
      seedTimeline(3);
      useTimelineStore.setState({ onionSkinEnabled: false });
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByText('prev')).toBeNull();
      expect(screen.queryByText('next')).toBeNull();
    });
  });

  describe('FPS input', () => {
    it('shows current FPS value', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      const input = screen.getByTitle('Frames per second') as HTMLInputElement;
      expect(input.value).toBe('8');
    });
  });

  describe('export buttons', () => {
    it('shows Seq and Strip buttons with multiple frames', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Export PNG sequence')).toBeInTheDocument();
      expect(screen.getByTitle('Export sprite strip')).toBeInTheDocument();
    });
  });

  describe('playing state UI', () => {
    it('hides frame management buttons when playing', () => {
      seedTimeline(3);
      useTimelineStore.setState({ playing: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByTitle('New frame')).toBeNull();
      expect(screen.queryByTitle('Duplicate frame')).toBeNull();
      expect(screen.queryByTitle('Delete frame')).toBeNull();
    });

    it('hides reorder/insert buttons when playing', () => {
      seedTimeline(3);
      useTimelineStore.setState({ playing: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByTitle('Move frame left')).toBeNull();
      expect(screen.queryByTitle('Insert blank before')).toBeNull();
    });

    it('shows playing indicator when playing', () => {
      seedTimeline(3);
      useTimelineStore.setState({ playing: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByText('playing')).toBeInTheDocument();
    });

    it('prev/next buttons disabled during playback', () => {
      seedTimeline(3);
      useTimelineStore.setState({ playing: true });
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTitle('Previous frame (,)')).toBeDisabled();
      expect(screen.getByTitle('Next frame (.)')).toBeDisabled();
    });
  });

  describe('conditional sub-panels', () => {
    it('ClipPanel shown when >1 frame in timeline mode', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTestId('clip-panel')).toBeInTheDocument();
    });

    it('ExportPreviewPanel shown when >1 frame in timeline mode', () => {
      seedTimeline(3);
      render(<BottomDock activeMode="edit" />);
      expect(screen.getByTestId('export-preview-panel')).toBeInTheDocument();
    });

    it('ClipPanel hidden with single frame', () => {
      seedTimeline(1);
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByTestId('clip-panel')).toBeNull();
    });

    it('ExportPreviewPanel hidden with single frame', () => {
      seedTimeline(1);
      render(<BottomDock activeMode="edit" />);
      expect(screen.queryByTestId('export-preview-panel')).toBeNull();
    });
  });
});
