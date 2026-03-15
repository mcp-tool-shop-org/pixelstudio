import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MotionPanel } from '../components/MotionPanel';
import { useMotionStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import { useAnchorStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';

function seedStores(overrides?: {
  sessionId?: string | null;
  status?: string;
  playing?: boolean;
  isTransforming?: boolean;
  hasSelection?: boolean;
  selectedAnchorId?: string | null;
  panelMode?: string;
}) {
  const o = overrides ?? {};
  useMotionStore.setState({
    sessionId: o.sessionId ?? null,
    intent: 'idle_bob',
    direction: 'right',
    outputFrameCount: 4,
    targetMode: 'whole_frame',
    proposals: [],
    selectedProposalId: null,
    status: (o.status as 'configuring') ?? 'configuring',
    lastError: null,
    sourceFrameId: null,
    panelMode: (o.panelMode as 'locomotion') ?? 'locomotion',
  });
  useSelectionStore.setState({
    hasSelection: o.hasSelection ?? false,
    isTransforming: o.isTransforming ?? false,
  });
  useTimelineStore.setState({
    playing: o.playing ?? false,
    activeFrameId: 'f0',
    frames: [{ id: 'f0', name: 'Frame 0', index: 0, durationMs: null }],
    activeFrameIndex: 0,
  });
  useAnchorStore.setState({
    selectedAnchorId: o.selectedAnchorId ?? null,
    anchors: o.selectedAnchorId ? [
      { id: o.selectedAnchorId, name: 'Head', kind: 'head', x: 16, y: 8, bounds: { x: 12, y: 4, width: 8, height: 8 }, parentName: null, falloffWeight: 1.0 },
    ] : [],
  });
  useProjectStore.setState({ canvasSize: { width: 32, height: 32 } });
}

describe('MotionPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('list_motion_templates', () => []);
    mock.on('list_secondary_motion_templates', () => []);
    mock.on('check_secondary_readiness', () => ({
      tier: 'ready', missingAnchors: [], presentAnchors: [],
      rootAnchors: [], childAnchors: [], notes: [], fixHints: [],
    }));
  });
  afterEach(cleanup);

  describe('idle config rendering', () => {
    it('shows Locomotion and Secondary mode buttons', () => {
      seedStores();
      render(<MotionPanel />);
      expect(screen.getByText('Locomotion')).toBeInTheDocument();
      expect(screen.getByText('Secondary')).toBeInTheDocument();
    });

    it('shows intent buttons in locomotion mode', () => {
      seedStores({ panelMode: 'locomotion' });
      render(<MotionPanel />);
      expect(screen.getByText('Idle Bob')).toBeInTheDocument();
      expect(screen.getByText('Walk Cycle')).toBeInTheDocument();
      expect(screen.getByText('Run Cycle')).toBeInTheDocument();
      expect(screen.getByText('Hop')).toBeInTheDocument();
    });

    it('shows direction buttons', () => {
      seedStores();
      render(<MotionPanel />);
      // Arrow symbols for direction
      expect(screen.getByText('\u2190')).toBeInTheDocument();
      expect(screen.getByText('\u2192')).toBeInTheDocument();
      expect(screen.getByText('\u2191')).toBeInTheDocument();
      expect(screen.getByText('\u2193')).toBeInTheDocument();
    });

    it('shows frame count buttons', () => {
      seedStores();
      render(<MotionPanel />);
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('4')).toBeInTheDocument();
    });
  });

  describe('canStart gating', () => {
    it('Start button enabled when not transforming and not playing', () => {
      seedStores({ isTransforming: false, playing: false });
      render(<MotionPanel />);
      const startBtn = screen.getByText('Start Motion Session');
      expect(startBtn).not.toBeDisabled();
    });

    it('Start button disabled when transforming', () => {
      seedStores({ isTransforming: true, playing: false });
      render(<MotionPanel />);
      const startBtn = screen.getByText('Start Motion Session');
      expect(startBtn).toBeDisabled();
    });

    it('Start button disabled when playing', () => {
      seedStores({ isTransforming: false, playing: true });
      render(<MotionPanel />);
      const startBtn = screen.getByText('Start Motion Session');
      expect(startBtn).toBeDisabled();
    });
  });

  describe('resolvedTargetMode priority', () => {
    // Test indirectly via the target label displayed

    it('shows "Whole Frame" when no selection and no anchor', () => {
      seedStores({ hasSelection: false, selectedAnchorId: null });
      render(<MotionPanel />);
      expect(screen.getByText(/Whole Frame/)).toBeInTheDocument();
    });

    it('shows "Selection" when selection is active', () => {
      seedStores({ hasSelection: true, selectedAnchorId: null });
      render(<MotionPanel />);
      expect(screen.getByText(/Selection/)).toBeInTheDocument();
    });

    it('shows anchor info when anchor selected (no selection)', () => {
      seedStores({ hasSelection: false, selectedAnchorId: 'a1' });
      render(<MotionPanel />);
      expect(screen.getByText(/Head/)).toBeInTheDocument();
    });

    it('selection takes priority over anchor', () => {
      seedStores({ hasSelection: true, selectedAnchorId: 'a1' });
      render(<MotionPanel />);
      expect(screen.getByText(/Selection/)).toBeInTheDocument();
    });
  });

  describe('mode switching', () => {
    it('clicking Secondary switches panelMode', async () => {
      seedStores({ panelMode: 'locomotion' });
      const { unmount } = render(<MotionPanel />);
      const btn = screen.getByText('Secondary');
      await act(async () => {
        await userEvent.click(btn);
      });
      expect(useMotionStore.getState().panelMode).toBe('secondary');
      unmount();
    });

    it('clicking Locomotion switches back', async () => {
      seedStores({ panelMode: 'secondary' });
      const { unmount } = render(<MotionPanel />);
      const btn = screen.getByText('Locomotion');
      await act(async () => {
        await userEvent.click(btn);
      });
      expect(useMotionStore.getState().panelMode).toBe('locomotion');
      unmount();
    });
  });

  describe('session invalidation', () => {
    it('resets store when active frame changes during active session', () => {
      seedStores({ sessionId: 'sess-1', status: 'reviewing' });
      useMotionStore.setState({ sourceFrameId: 'f0' });
      mock.on('cancel_motion_session', () => {});
      render(<MotionPanel />);
      // Simulate frame change
      act(() => {
        useTimelineStore.setState({ activeFrameId: 'f1' });
      });
      // Store should be reset
      expect(useMotionStore.getState().sessionId).toBe(null);
    });
  });
});
