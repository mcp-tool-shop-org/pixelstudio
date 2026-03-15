import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { RecoveryPrompt } from '../components/RecoveryPrompt';
import { useProjectStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';
import { getMockInvoke } from '../test/helpers';

const ITEMS = [
  {
    projectId: 'p1',
    name: 'My Sprite',
    recoveryPath: '/tmp/p1.json',
    updatedAt: '2026-01-15T10:30:00Z',
  },
  {
    projectId: 'p2',
    name: 'Walk Cycle',
    recoveryPath: '/tmp/p2.json',
    updatedAt: '2026-01-14T08:00:00Z',
  },
];

const MOCK_FRAME = {
  width: 32,
  height: 32,
  layers: [],
  layerOrder: [],
  composited: new Array(32 * 32 * 4).fill(0),
  palette: null,
};

const MOCK_PROJECT_INFO = {
  projectId: 'p1',
  name: 'My Sprite',
  filePath: '/saved/sprite.pxs',
  isDirty: false,
  frame: MOCK_FRAME,
};

describe('RecoveryPrompt', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
  });
  afterEach(cleanup);

  describe('rendering', () => {
    it('shows dialog title', () => {
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);
      expect(screen.getByText('Recover Unsaved Work')).toBeInTheDocument();
    });

    it('shows description text', () => {
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);
      expect(screen.getByText(/unsaved work from a previous session/)).toBeInTheDocument();
    });

    it('renders one list item per recovery item', () => {
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);
      expect(screen.getByText('My Sprite')).toBeInTheDocument();
      expect(screen.getByText('Walk Cycle')).toBeInTheDocument();
    });

    it('shows formatted dates', () => {
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);
      // The date gets formatted via toLocaleString — just check it rendered something
      const listItems = screen.getAllByRole('listitem');
      expect(listItems).toHaveLength(2);
    });

    it('renders a Restore button per item', () => {
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);
      const buttons = screen.getAllByText('Restore');
      expect(buttons).toHaveLength(2);
    });

    it('renders Discard All button', () => {
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);
      expect(screen.getByText('Discard All')).toBeInTheDocument();
    });

    it('shows nothing with empty items', () => {
      render(<RecoveryPrompt items={[]} onDone={vi.fn()} />);
      expect(screen.queryAllByText('Restore')).toHaveLength(0);
    });
  });

  describe('restore flow', () => {
    it('invokes restore_recovery with correct projectId', async () => {
      mock.on('restore_recovery', () => MOCK_PROJECT_INFO);
      mock.on('discard_recovery', () => null);
      const onDone = vi.fn();
      render(<RecoveryPrompt items={ITEMS} onDone={onDone} />);

      const buttons = screen.getAllByText('Restore');
      await act(async () => {
        await userEvent.click(buttons[0]);
      });

      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('restore_recovery', { projectId: 'p1' });
      });
    });

    it('calls onDone after successful restore', async () => {
      mock.on('restore_recovery', () => MOCK_PROJECT_INFO);
      mock.on('discard_recovery', () => null);
      const onDone = vi.fn();
      render(<RecoveryPrompt items={ITEMS} onDone={onDone} />);

      await act(async () => {
        await userEvent.click(screen.getAllByText('Restore')[0]);
      });

      await waitFor(() => {
        expect(onDone).toHaveBeenCalled();
      });
    });

    it('sets project store after restore', async () => {
      mock.on('restore_recovery', () => MOCK_PROJECT_INFO);
      mock.on('discard_recovery', () => null);
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);

      await act(async () => {
        await userEvent.click(screen.getAllByText('Restore')[0]);
      });

      await waitFor(() => {
        const state = useProjectStore.getState();
        expect(state.projectId).toBe('p1');
        expect(state.name).toBe('My Sprite');
      });
    });

    it('sets canvas frame store after restore', async () => {
      mock.on('restore_recovery', () => MOCK_PROJECT_INFO);
      mock.on('discard_recovery', () => null);
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);

      await act(async () => {
        await userEvent.click(screen.getAllByText('Restore')[0]);
      });

      await waitFor(() => {
        const frame = useCanvasFrameStore.getState().frame;
        expect(frame).toBeTruthy();
      });
    });

    it('discards other items after restoring one', async () => {
      mock.on('restore_recovery', () => MOCK_PROJECT_INFO);
      mock.on('discard_recovery', () => null);
      const onDone = vi.fn();
      render(<RecoveryPrompt items={ITEMS} onDone={onDone} />);

      await act(async () => {
        await userEvent.click(screen.getAllByText('Restore')[0]);
      });

      await waitFor(() => {
        // p2 should be discarded (p1 was restored)
        expect(mock.fn).toHaveBeenCalledWith('discard_recovery', { projectId: 'p2' });
      });
    });

    it('shows error on restore failure', async () => {
      mock.on('restore_recovery', () => { throw new Error('Corrupt file'); });
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);

      await act(async () => {
        await userEvent.click(screen.getAllByText('Restore')[0]);
      });

      await waitFor(() => {
        expect(screen.getByText(/Restore failed: Corrupt file/)).toBeInTheDocument();
      });
    });

    it('disables buttons while loading', async () => {
      // Use a slow handler to keep loading state active
      let resolveRestore: (v: any) => void;
      mock.on('restore_recovery', () => new Promise((r) => { resolveRestore = r; }));
      render(<RecoveryPrompt items={ITEMS} onDone={vi.fn()} />);

      // Click first restore — starts loading
      await act(async () => {
        await userEvent.click(screen.getAllByText('Restore')[0]);
      });

      // All restore buttons should be disabled while loading
      const restoreButtons = screen.getAllByText('Restore');
      restoreButtons.forEach((btn) => expect(btn).toBeDisabled());
      expect(screen.getByText('Discard All')).toBeDisabled();

      // Unblock
      await act(async () => {
        resolveRestore!(MOCK_PROJECT_INFO);
      });
    });
  });

  describe('discard flow', () => {
    it('invokes discard_recovery for each item', async () => {
      mock.on('discard_recovery', () => null);
      const onDone = vi.fn();
      render(<RecoveryPrompt items={ITEMS} onDone={onDone} />);

      await act(async () => {
        await userEvent.click(screen.getByText('Discard All'));
      });

      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('discard_recovery', { projectId: 'p1' });
        expect(mock.fn).toHaveBeenCalledWith('discard_recovery', { projectId: 'p2' });
      });
    });

    it('calls onDone after discarding all', async () => {
      mock.on('discard_recovery', () => null);
      const onDone = vi.fn();
      render(<RecoveryPrompt items={ITEMS} onDone={onDone} />);

      await act(async () => {
        await userEvent.click(screen.getByText('Discard All'));
      });

      await waitFor(() => {
        expect(onDone).toHaveBeenCalled();
      });
    });
  });
});
