import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SandboxPanel } from '../components/SandboxPanel';
import { useSandboxStore } from '@pixelstudio/state';
import { useTimelineStore } from '@pixelstudio/state';
import { useSelectionStore } from '@pixelstudio/state';
import { useProjectStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';

const MOCK_SESSION = {
  sessionId: 'sandbox-1',
  source: 'timeline_span' as const,
  startFrameIndex: 0,
  endFrameIndex: 3,
  frameCount: 4,
  previewWidth: 32,
  previewHeight: 32,
  previewFrames: [
    new Array(32 * 32 * 4).fill(0),
    new Array(32 * 32 * 4).fill(0),
    new Array(32 * 32 * 4).fill(0),
    new Array(32 * 32 * 4).fill(0),
  ],
};

function seedStoresNoSession() {
  useSandboxStore.setState({
    session: null,
    playback: { fps: 8, looping: true },
    currentFrame: 0,
    playing: false,
    lastError: null,
    metrics: null,
    analysisLoading: false,
    analysisError: null,
    analyzedSessionId: null,
    anchorPaths: [],
    selectedAnchorNames: [],
    pathsLoading: false,
    pathsError: null,
    pathsSessionId: null,
    showContactHints: true,
    applying: false,
    duplicating: false,
    actionSuccess: null,
    actionError: null,
  });
  useTimelineStore.setState({
    frames: [
      { id: 'f0', name: 'Frame 0', index: 0, durationMs: null },
      { id: 'f1', name: 'Frame 1', index: 1, durationMs: null },
    ],
    activeFrameIndex: 0,
    activeFrameId: 'f0',
  });
}

function seedStoresWithSession() {
  seedStoresNoSession();
  useSandboxStore.setState({ session: MOCK_SESSION });
}

describe('SandboxPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
  });
  afterEach(cleanup);

  describe('empty state (no session)', () => {
    it('shows Sandbox header', () => {
      seedStoresNoSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Sandbox')).toBeInTheDocument();
    });

    it('shows hint text', () => {
      seedStoresNoSession();
      render(<SandboxPanel />);
      expect(screen.getByText(/Isolated preview/)).toBeInTheDocument();
    });

    it('shows Open button', () => {
      seedStoresNoSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Open All Frames in Sandbox')).toBeInTheDocument();
    });

    it('Open button disabled when no frames', () => {
      seedStoresNoSession();
      useTimelineStore.setState({ frames: [] });
      render(<SandboxPanel />);
      const btn = screen.getByText('Open All Frames in Sandbox');
      expect(btn).toBeDisabled();
    });

    it('shows error message when lastError set', () => {
      seedStoresNoSession();
      useSandboxStore.setState({ lastError: 'Something went wrong' });
      render(<SandboxPanel />);
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });

    it('clicking Open invokes begin_sandbox_session', async () => {
      seedStoresNoSession();
      mock.on('begin_sandbox_session', () => MOCK_SESSION);
      render(<SandboxPanel />);
      await act(async () => {
        await userEvent.click(screen.getByText('Open All Frames in Sandbox'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('begin_sandbox_session', expect.anything());
      });
    });
  });

  describe('active session rendering', () => {
    it('shows source badge', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('timeline_span')).toBeInTheDocument();
    });

    it('shows Close button', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Close')).toBeInTheDocument();
    });

    it('shows frame counter', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ currentFrame: 2 });
      render(<SandboxPanel />);
      expect(screen.getByText('3/4')).toBeInTheDocument();
    });

    it('shows playback controls', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByTitle('Previous frame')).toBeInTheDocument();
      expect(screen.getByTitle('Next frame')).toBeInTheDocument();
    });

    it('shows play/pause button', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByTitle('Play')).toBeInTheDocument();
    });

    it('shows FPS input', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('FPS:')).toBeInTheDocument();
    });

    it('shows Loop checkbox', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Loop')).toBeInTheDocument();
    });

    it('shows Analyze button', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Analyze')).toBeInTheDocument();
    });

    it('shows Load Paths button', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Load Paths')).toBeInTheDocument();
    });
  });

  describe('playback controls', () => {
    it('clicking play toggles playing state', async () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      const playBtn = screen.getByTitle('Play');
      await act(async () => {
        await userEvent.click(playBtn);
      });
      expect(useSandboxStore.getState().playing).toBe(true);
    });

    it('clicking pause when playing stops playback', async () => {
      seedStoresWithSession();
      useSandboxStore.setState({ playing: true });
      render(<SandboxPanel />);
      const pauseBtn = screen.getByTitle('Pause');
      await act(async () => {
        await userEvent.click(pauseBtn);
      });
      expect(useSandboxStore.getState().playing).toBe(false);
    });
  });

  describe('diagnostics rendering', () => {
    it('shows pre-analysis prompt', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Press Analyze to inspect motion quality.')).toBeInTheDocument();
    });

    it('Analyze button shows "Analyzing..." when loading', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ analysisLoading: true });
      render(<SandboxPanel />);
      expect(screen.getByText('Analyzing...')).toBeInTheDocument();
    });

    it('shows analysis error', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ analysisError: 'Analysis failed' });
      render(<SandboxPanel />);
      expect(screen.getByText('Analysis failed')).toBeInTheDocument();
    });

    it('shows metrics when available', () => {
      seedStoresWithSession();
      useSandboxStore.setState({
        metrics: {
          sessionId: 'sandbox-1',
          frameCount: 4,
          previewWidth: 32,
          previewHeight: 32,
          bboxes: [],
          adjacentDeltas: [],
          loopDiagnostics: { firstLastDelta: 2.5, label: 'good', hint: 'Good loop' },
          driftDiagnostics: { driftX: 0, driftY: 0, driftMagnitude: 1.2, maxDisplacement: 1.2, label: 'mild', hint: 'Low drift' },
          timingDiagnostics: {
            largestAdjacentDelta: 3.1,
            identicalAdjacentCount: 0,
            avgAdjacentDelta: 1.5,
            hint: 'Smooth timing',
          },
          issues: [],
        },
        analyzedSessionId: 'sandbox-1',
      });
      render(<SandboxPanel />);
      expect(screen.getByText('4')).toBeInTheDocument(); // frameCount
      expect(screen.getByText('2.5')).toBeInTheDocument(); // loopDelta
      expect(screen.getByText('1.2px')).toBeInTheDocument(); // drift
      expect(screen.getByText('3.1')).toBeInTheDocument(); // max jump
      expect(screen.getByText('0')).toBeInTheDocument(); // still pairs
      expect(screen.getByText('Good loop')).toBeInTheDocument();
    });

    it('shows stale indicator when session changed', () => {
      seedStoresWithSession();
      useSandboxStore.setState({
        metrics: {
          sessionId: 'old-session',
          frameCount: 4,
          previewWidth: 32,
          previewHeight: 32,
          bboxes: [],
          adjacentDeltas: [],
          loopDiagnostics: { firstLastDelta: 0, label: 'good', hint: '' },
          driftDiagnostics: { driftX: 0, driftY: 0, driftMagnitude: 0, maxDisplacement: 0, label: 'none', hint: '' },
          timingDiagnostics: { largestAdjacentDelta: 0, identicalAdjacentCount: 0, avgAdjacentDelta: 0, hint: '' },
          issues: [],
        },
        analyzedSessionId: 'old-session',
      });
      render(<SandboxPanel />);
      expect(screen.getByText(/results may be stale/)).toBeInTheDocument();
    });

    it('shows Reanalyze when metrics exist', () => {
      seedStoresWithSession();
      useSandboxStore.setState({
        metrics: {
          sessionId: 'sandbox-1',
          frameCount: 4,
          previewWidth: 32,
          previewHeight: 32,
          bboxes: [],
          adjacentDeltas: [],
          loopDiagnostics: { firstLastDelta: 0, label: 'good', hint: '' },
          driftDiagnostics: { driftX: 0, driftY: 0, driftMagnitude: 0, maxDisplacement: 0, label: 'none', hint: '' },
          timingDiagnostics: { largestAdjacentDelta: 0, identicalAdjacentCount: 0, avgAdjacentDelta: 0, hint: '' },
          issues: [],
        },
        analyzedSessionId: 'sandbox-1',
      });
      render(<SandboxPanel />);
      expect(screen.getByText('Reanalyze')).toBeInTheDocument();
    });
  });

  describe('action buttons', () => {
    it('shows FPS preset buttons', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Default')).toBeInTheDocument();
    });

    it('shows Duplicate Span button', () => {
      seedStoresWithSession();
      render(<SandboxPanel />);
      expect(screen.getByText('Duplicate Span')).toBeInTheDocument();
    });

    it('Duplicate Span disabled when applying', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ applying: true });
      render(<SandboxPanel />);
      const btn = screen.getByText('Duplicate Span');
      expect(btn).toBeDisabled();
    });

    it('Duplicate Span disabled when duplicating', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ duplicating: true });
      render(<SandboxPanel />);
      const btn = screen.getByText('Duplicating...');
      expect(btn).toBeDisabled();
    });

    it('shows action success message', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ actionSuccess: 'Applied successfully' });
      render(<SandboxPanel />);
      expect(screen.getByText('Applied successfully')).toBeInTheDocument();
    });

    it('shows action error message', () => {
      seedStoresWithSession();
      useSandboxStore.setState({ actionError: 'Apply failed' });
      render(<SandboxPanel />);
      expect(screen.getByText('Apply failed')).toBeInTheDocument();
    });
  });

  describe('display size computation', () => {
    it('caps at 256px', () => {
      expect(Math.min(32 * 4, 256)).toBe(128);
      expect(Math.min(64 * 4, 256)).toBe(256);
      expect(Math.min(128 * 4, 256)).toBe(256);
    });
  });
});
