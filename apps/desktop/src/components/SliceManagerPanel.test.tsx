import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SliceManagerPanel } from './SliceManagerPanel';
import { useSliceStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';

// ── Tauri mock ──────────────────────────────────────────────────────────────

type InvokeHandler = (args?: Record<string, unknown>) => unknown;
const invokeHandlers = new Map<string, InvokeHandler>();

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((cmd: string, args?: Record<string, unknown>) => {
    const handler = invokeHandlers.get(cmd);
    if (handler) return Promise.resolve(handler(args));
    return Promise.resolve(null);
  }),
}));

function onCmd(cmd: string, fn: InvokeHandler) {
  invokeHandlers.set(cmd, fn);
}

const EMPTY_FRAME = {
  width: 16, height: 16, data: [], layers: [], activeLayerIndex: 0,
  version: 0, undoDepth: 0, redoDepth: 0,
};

function seedPanel(overrides?: {
  sliceRegions?: Array<{ id: string; name: string; x: number; y: number; width: number; height: number }>;
  selectedSliceId?: string | null;
  selectionBounds?: { x: number; y: number; width: number; height: number } | null;
}) {
  useSliceStore.setState({
    sliceRegions: overrides?.sliceRegions ?? [],
    selectedSliceId: overrides?.selectedSliceId ?? null,
  });
  useSelectionStore.setState({
    selectionBounds: overrides?.selectionBounds ?? null,
    hasSelection: !!overrides?.selectionBounds,
  } as never);
  useCanvasFrameStore.setState({ frame: EMPTY_FRAME as never, version: 0 });
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('SliceManagerPanel', () => {
  beforeEach(() => {
    invokeHandlers.clear();
    onCmd('list_slice_regions', () => []);
    onCmd('create_slice_region', () => EMPTY_FRAME);
    onCmd('delete_slice_region', () => EMPTY_FRAME);
    onCmd('clear_slice_regions', () => EMPTY_FRAME);
    onCmd('mark_dirty', () => null);
  });

  afterEach(cleanup);

  // ── Empty state ─────────────────────────────────────────────────

  it('renders empty state when no slices', () => {
    seedPanel();
    render(<SliceManagerPanel />);
    expect(screen.getByTestId('slice-empty-state')).toBeInTheDocument();
    expect(screen.queryByTestId('slice-list')).toBeNull();
  });

  it('create-from-selection button is disabled when no selection', () => {
    seedPanel();
    render(<SliceManagerPanel />);
    const btn = screen.getByTestId('slice-create-from-sel-btn');
    expect(btn).toBeDisabled();
  });

  it('create-from-selection button is enabled when selection exists', () => {
    seedPanel({ selectionBounds: { x: 0, y: 0, width: 8, height: 8 } });
    render(<SliceManagerPanel />);
    const btn = screen.getByTestId('slice-create-from-sel-btn');
    expect(btn).not.toBeDisabled();
  });

  // ── Slice list ───────────────────────────────────────────────────

  it('renders slice list items when slices exist', () => {
    seedPanel({
      sliceRegions: [
        { id: 'r1', name: 'slice_1', x: 0, y: 0, width: 16, height: 16 },
        { id: 'r2', name: 'slice_2', x: 2, y: 4, width: 8, height: 8 },
      ],
    });
    render(<SliceManagerPanel />);
    expect(screen.getByTestId('slice-list')).toBeInTheDocument();
    expect(screen.getByTestId('slice-item-r1')).toBeInTheDocument();
    expect(screen.getByTestId('slice-item-r2')).toBeInTheDocument();
    expect(screen.queryByTestId('slice-empty-state')).toBeNull();
  });

  it('shows Clear All button when slices exist', () => {
    seedPanel({
      sliceRegions: [{ id: 'r1', name: 'slice_1', x: 0, y: 0, width: 8, height: 8 }],
    });
    render(<SliceManagerPanel />);
    expect(screen.getByTestId('slice-clear-all-btn')).toBeInTheDocument();
  });

  it('does not show Clear All button when no slices', () => {
    seedPanel();
    render(<SliceManagerPanel />);
    expect(screen.queryByTestId('slice-clear-all-btn')).toBeNull();
  });

  // ── Selection ───────────────────────────────────────────────────

  it('clicking a slice selects it', async () => {
    seedPanel({
      sliceRegions: [{ id: 'r1', name: 'slice_1', x: 0, y: 0, width: 8, height: 8 }],
    });
    render(<SliceManagerPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('slice-item-r1'));
    });
    expect(useSliceStore.getState().selectedSliceId).toBe('r1');
    expect(screen.getByTestId('slice-item-r1').className).toContain('active');
  });

  it('clicking the selected slice deselects it', async () => {
    seedPanel({
      sliceRegions: [{ id: 'r1', name: 'slice_1', x: 0, y: 0, width: 8, height: 8 }],
      selectedSliceId: 'r1',
    });
    render(<SliceManagerPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('slice-item-r1'));
    });
    expect(useSliceStore.getState().selectedSliceId).toBeNull();
  });

  // ── Delete ──────────────────────────────────────────────────────

  it('delete button calls delete_slice_region and reloads', async () => {
    seedPanel({
      sliceRegions: [{ id: 'r1', name: 'slice_1', x: 0, y: 0, width: 8, height: 8 }],
    });
    const { invoke } = await import('@tauri-apps/api/core');
    render(<SliceManagerPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('slice-delete-r1'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([cmd]: [string]) => cmd === 'delete_slice_region')).toBe(true);
  });

  it('deleting selected slice clears selectedSliceId', async () => {
    seedPanel({
      sliceRegions: [{ id: 'r1', name: 'slice_1', x: 0, y: 0, width: 8, height: 8 }],
      selectedSliceId: 'r1',
    });
    render(<SliceManagerPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('slice-delete-r1'));
    });
    expect(useSliceStore.getState().selectedSliceId).toBeNull();
  });

  // ── Create from selection ───────────────────────────────────────

  it('clicking + From Sel invokes create_slice_region with selection bounds', async () => {
    seedPanel({ selectionBounds: { x: 2, y: 3, width: 10, height: 12 } });
    const { invoke } = await import('@tauri-apps/api/core');
    render(<SliceManagerPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('slice-create-from-sel-btn'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    const createCall = calls.find(([cmd]: [string]) => cmd === 'create_slice_region');
    expect(createCall).toBeDefined();
    const args = createCall[1] as { x: number; y: number; width: number; height: number };
    expect(args.x).toBe(2);
    expect(args.y).toBe(3);
    expect(args.width).toBe(10);
    expect(args.height).toBe(12);
  });

  // ── Clear All ───────────────────────────────────────────────────

  it('Clear All invokes clear_slice_regions and empties the list', async () => {
    seedPanel({
      sliceRegions: [{ id: 'r1', name: 'slice_1', x: 0, y: 0, width: 8, height: 8 }],
    });
    const { invoke } = await import('@tauri-apps/api/core');
    render(<SliceManagerPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('slice-clear-all-btn'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([cmd]: [string]) => cmd === 'clear_slice_regions')).toBe(true);
    expect(useSliceStore.getState().sliceRegions).toHaveLength(0);
  });
});
