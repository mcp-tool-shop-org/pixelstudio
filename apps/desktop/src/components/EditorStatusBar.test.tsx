import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { EditorStatusBar } from './EditorStatusBar';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';

function seedStores(overrides: {
  zoom?: number;
  cursorX?: number | null;
  cursorY?: number | null;
  canvasWidth?: number;
  canvasHeight?: number;
  undoDepth?: number;
  redoDepth?: number;
  canUndo?: boolean;
  canRedo?: boolean;
} = {}) {
  useCanvasViewStore.setState({
    zoom: overrides.zoom ?? 8,
    cursorPixelX: overrides.cursorX ?? null,
    cursorPixelY: overrides.cursorY ?? null,
  });
  useProjectStore.setState({
    canvasSize: {
      width: overrides.canvasWidth ?? 64,
      height: overrides.canvasHeight ?? 64,
    },
  });
  if (overrides.undoDepth !== undefined || overrides.canUndo !== undefined) {
    useCanvasFrameStore.setState({
      frame: {
        width: 64, height: 64, data: [], layers: [], activeLayerId: null,
        canUndo: overrides.canUndo ?? (overrides.undoDepth ?? 0) > 0,
        canRedo: overrides.canRedo ?? false,
        undoDepth: overrides.undoDepth ?? 0,
        redoDepth: overrides.redoDepth ?? 0,
      },
    });
  } else {
    useCanvasFrameStore.setState({ frame: null });
  }
}

afterEach(cleanup);

describe('EditorStatusBar', () => {
  it('renders the status bar', () => {
    seedStores();
    render(<EditorStatusBar />);
    expect(screen.getByTestId('editor-status-bar')).toBeInTheDocument();
  });

  it('shows zoom level', () => {
    seedStores({ zoom: 8 });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-zoom').textContent).toBe('8x');
  });

  it('shows canvas dimensions', () => {
    seedStores({ canvasWidth: 32, canvasHeight: 48 });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-canvas-size').textContent).toBe('32×48');
  });

  it('shows em-dash when cursor is outside canvas', () => {
    seedStores({ cursorX: null, cursorY: null });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-cursor').textContent).toBe('—');
  });

  it('shows pixel coordinates when cursor is inside canvas', () => {
    seedStores({ cursorX: 15, cursorY: 22 });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-cursor').textContent).toBe('15, 22');
  });

  it('shows undo depth as 0 when no frame', () => {
    seedStores();
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-undo').textContent).toContain('0');
  });

  it('shows undo depth from frame', () => {
    seedStores({ undoDepth: 5, canUndo: true });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-undo').textContent).toContain('5');
  });

  it('shows redo indicator when redo is available', () => {
    seedStores({ undoDepth: 2, canUndo: true, canRedo: true });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-undo').textContent).toContain('↩');
  });

  it('does not show redo indicator when no redo', () => {
    seedStores({ undoDepth: 2, canUndo: true, canRedo: false });
    render(<EditorStatusBar />);
    expect(screen.getByTestId('status-undo').textContent).not.toContain('↩');
  });
});
