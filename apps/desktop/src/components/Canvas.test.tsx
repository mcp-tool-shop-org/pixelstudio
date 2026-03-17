import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import { Canvas } from '../components/Canvas';
import { useCanvasViewStore } from '@glyphstudio/state';
import { useToolStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { useSelectionStore } from '@glyphstudio/state';
import { useTimelineStore } from '@glyphstudio/state';
import { useCanvasFrameStore } from '../lib/canvasFrameStore';
import { getMockInvoke } from '../test/helpers';
import type { ToolId } from '@glyphstudio/domain';
import { SHORTCUT_MANIFEST } from '@glyphstudio/domain';

// ── Helpers ────────────────────────────────────────────────────
function seedStores(overrides?: {
  canvasSize?: { width: number; height: number };
  zoom?: number;
  activeTool?: ToolId;
  primaryColor?: { r: number; g: number; b: number; a: number };
  hasSelection?: boolean;
  isTransforming?: boolean;
  playing?: boolean;
  onionSkinEnabled?: boolean;
  frameCount?: number;
  activeFrameIndex?: number;
  canUndo?: boolean;
  canRedo?: boolean;
  selectionBounds?: { x: number; y: number; width: number; height: number } | null;
}) {
  const o = overrides ?? {};
  useProjectStore.setState({ canvasSize: o.canvasSize ?? { width: 32, height: 32 } });
  useCanvasViewStore.setState({ zoom: o.zoom ?? 1 });
  useToolStore.setState({ activeTool: o.activeTool ?? 'pencil', primaryColor: o.primaryColor ?? { r: 255, g: 0, b: 0, a: 255 } });
  useSelectionStore.setState({
    hasSelection: o.hasSelection ?? false,
    isTransforming: o.isTransforming ?? false,
    selectionBounds: o.selectionBounds ?? null,
  });

  const frames = Array.from({ length: o.frameCount ?? 1 }, (_, i) => ({
    id: `f${i}`,
    name: `Frame ${i}`,
    index: i,
    durationMs: null,
  }));
  useTimelineStore.setState({
    frames,
    activeFrameIndex: o.activeFrameIndex ?? 0,
    activeFrameId: frames[o.activeFrameIndex ?? 0]?.id ?? 'f0',
    playing: o.playing ?? false,
    onionSkinEnabled: o.onionSkinEnabled ?? false,
  });

  useCanvasFrameStore.setState({
    frame: {
      width: (o.canvasSize ?? { width: 32 }).width,
      height: (o.canvasSize ?? { height: 32 }).height,
      data: new Array((o.canvasSize?.width ?? 32) * (o.canvasSize?.height ?? 32) * 4).fill(0),
      layers: [{ id: 'l1', name: 'Layer 1', visible: true, locked: false, opacity: 1 }],
      activeLayerId: 'l1',
      canUndo: o.canUndo ?? false,
      canRedo: o.canRedo ?? false,
    },
    version: 0,
  });
}

// ── Test suite ─────────────────────────────────────────────────
describe('Canvas component', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('init_canvas', () => ({
      width: 32, height: 32,
      data: new Array(32 * 32 * 4).fill(0),
      layers: [{ id: 'l1', name: 'Layer 1', visible: true, locked: false, opacity: 1 }],
      activeLayerId: 'l1',
      canUndo: false, canRedo: false,
    }));
  });
  afterEach(cleanup);

  describe('status bar rendering', () => {
    it('shows canvas dimensions', () => {
      seedStores({ canvasSize: { width: 64, height: 48 } });
      render(<Canvas />);
      expect(screen.getByText('64\u00d748')).toBeInTheDocument();
    });

    it('shows zoom percentage', () => {
      seedStores({ zoom: 2 });
      render(<Canvas />);
      expect(screen.getByText('200%')).toBeInTheDocument();
    });

    it('shows active tool name', () => {
      seedStores({ activeTool: 'eraser' });
      render(<Canvas />);
      expect(screen.getByText('eraser')).toBeInTheDocument();
    });

    it('shows primary color hex', () => {
      seedStores({ primaryColor: { r: 0, g: 255, b: 0, a: 255 } });
      render(<Canvas />);
      expect(screen.getByText('#00ff00')).toBeInTheDocument();
    });

    it('shows selection dimensions when selection exists', () => {
      seedStores({
        hasSelection: true,
        selectionBounds: { x: 0, y: 0, width: 10, height: 5 },
      });
      render(<Canvas />);
      expect(screen.getByTitle('Selection')).toHaveTextContent('10\u00d75');
    });

    it('hides selection info when no selection', () => {
      seedStores({ hasSelection: false });
      render(<Canvas />);
      expect(screen.queryByTitle('Selection')).not.toBeInTheDocument();
    });

    it('shows transform indicator when transforming', () => {
      seedStores({ isTransforming: true });
      render(<Canvas />);
      expect(screen.getByTitle('Enter to commit, Esc to cancel')).toHaveTextContent('transform');
    });

    it('hides transform indicator when not transforming', () => {
      seedStores({ isTransforming: false });
      render(<Canvas />);
      expect(screen.queryByTitle('Enter to commit, Esc to cancel')).not.toBeInTheDocument();
    });

    it('shows frame counter when multiple frames', () => {
      seedStores({ frameCount: 4, activeFrameIndex: 2 });
      render(<Canvas />);
      expect(screen.getByTitle(', / . to switch')).toHaveTextContent('F3/4');
    });

    it('hides frame counter with single frame', () => {
      seedStores({ frameCount: 1 });
      render(<Canvas />);
      expect(screen.queryByTitle(', / . to switch')).not.toBeInTheDocument();
    });

    it('shows playing indicator when playing', () => {
      seedStores({ playing: true, frameCount: 2 });
      render(<Canvas />);
      expect(screen.getByTitle('Space to pause')).toHaveTextContent('playing');
    });

    it('shows onion skin indicator when enabled with multiple frames', () => {
      seedStores({ onionSkinEnabled: true, frameCount: 3 });
      render(<Canvas />);
      expect(screen.getByTitle('O to toggle')).toHaveTextContent('onion');
    });

    it('hides onion skin indicator with single frame', () => {
      seedStores({ onionSkinEnabled: true, frameCount: 1 });
      render(<Canvas />);
      expect(screen.queryByTitle('O to toggle')).not.toBeInTheDocument();
    });

    it('shows undo badge when canUndo', () => {
      seedStores({ canUndo: true });
      render(<Canvas />);
      expect(screen.getByTitle('Ctrl+Z')).toHaveTextContent('undo');
    });

    it('shows redo badge when canRedo', () => {
      seedStores({ canRedo: true });
      render(<Canvas />);
      expect(screen.getByTitle('Ctrl+Shift+Z')).toHaveTextContent('redo');
    });

    it('hides undo/redo badges when both false', () => {
      seedStores({ canUndo: false, canRedo: false });
      render(<Canvas />);
      expect(screen.queryByTitle('Ctrl+Z')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Ctrl+Shift+Z')).not.toBeInTheDocument();
    });
  });

  describe('cursor style', () => {
    it('uses move cursor when transforming', () => {
      seedStores({ isTransforming: true });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('move');
    });

    it('uses crosshair for pencil', () => {
      seedStores({ activeTool: 'pencil' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for eraser', () => {
      seedStores({ activeTool: 'eraser' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for marquee', () => {
      seedStores({ activeTool: 'marquee' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses move cursor for move tool', () => {
      seedStores({ activeTool: 'move' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('move');
    });

    it('uses crosshair for line tool', () => {
      seedStores({ activeTool: 'line' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for rectangle tool', () => {
      seedStores({ activeTool: 'rectangle' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for ellipse tool', () => {
      seedStores({ activeTool: 'ellipse' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for fill tool', () => {
      seedStores({ activeTool: 'fill' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses copy cursor for color-select (eyedropper)', () => {
      seedStores({ activeTool: 'color-select' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('copy');
    });

    it('uses move cursor for transform tool', () => {
      seedStores({ activeTool: 'transform' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('move');
    });

    it('uses crosshair for measure tool', () => {
      seedStores({ activeTool: 'measure' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for lasso tool', () => {
      seedStores({ activeTool: 'lasso' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses crosshair for magic-select tool', () => {
      seedStores({ activeTool: 'magic-select' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });

    it('uses cell cursor for socket tool', () => {
      seedStores({ activeTool: 'socket' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('cell');
    });

    it('uses crosshair for slice tool', () => {
      seedStores({ activeTool: 'slice' });
      render(<Canvas />);
      const canvas = document.querySelector('.pixel-canvas') as HTMLElement;
      expect(canvas.style.cursor).toBe('crosshair');
    });
  });

  describe('keyboard dispatch', () => {
    it('Ctrl+Z invokes undo', async () => {
      seedStores();
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true }));
      });
      // Wait for async invoke
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('undo');
      });
    });

    it('Ctrl+Shift+Z invokes redo', async () => {
      seedStores();
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, shiftKey: true, bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('redo');
      });
    });

    it('Delete invokes delete_selection when selection exists', async () => {
      seedStores({ hasSelection: true });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('delete_selection');
      });
    });

    it('Delete does nothing without selection', async () => {
      seedStores({ hasSelection: false });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Delete', bubbles: true }));
      });
      // Small wait then assert no delete_selection call
      await new Promise((r) => setTimeout(r, 50));
      expect(mock.fn).not.toHaveBeenCalledWith('delete_selection');
    });

    it('Escape during transform invokes cancel_selection_transform', async () => {
      seedStores({ isTransforming: true });
      mock.on('cancel_selection_transform', () => ({
        width: 32, height: 32, data: new Array(32 * 32 * 4).fill(0),
        layers: [{ id: 'l1', name: 'L1', visible: true, locked: false, opacity: 1 }],
        activeLayerId: 'l1', canUndo: false, canRedo: false,
      }));
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('cancel_selection_transform');
      });
    });

    it('Escape without transform invokes clear_selection', async () => {
      seedStores({ isTransforming: false });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Escape', bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('clear_selection');
      });
    });

    it('O toggles onion skin', async () => {
      seedStores();
      const before = useTimelineStore.getState().onionSkinEnabled;
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', bubbles: true }));
      });
      expect(useTimelineStore.getState().onionSkinEnabled).toBe(!before);
    });

    it('Arrow keys during transform invoke nudge_selection', async () => {
      seedStores({ isTransforming: true });
      mock.on('nudge_selection', () => ({
        sourceX: 0, sourceY: 0, payloadWidth: 10, payloadHeight: 10,
        offsetX: 1, offsetY: 0, payloadData: [],
        frame: {
          width: 32, height: 32, data: new Array(32 * 32 * 4).fill(0),
          layers: [{ id: 'l1', name: 'L1', visible: true, locked: false, opacity: 1 }],
          activeLayerId: 'l1', canUndo: false, canRedo: false,
        },
      }));
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('nudge_selection', { dx: 1, dy: 0 });
      });
    });

    it('Arrow keys without transform do not invoke nudge_selection', async () => {
      seedStores({ isTransforming: false });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'ArrowRight', bubbles: true }));
      });
      await new Promise((r) => setTimeout(r, 50));
      expect(mock.fn).not.toHaveBeenCalledWith('nudge_selection', expect.anything());
    });

    it('Comma navigates to prev frame', async () => {
      seedStores({ frameCount: 3, activeFrameIndex: 1 });
      mock.on('select_frame', () => ({
        frames: [
          { id: 'f0', name: 'Frame 0', index: 0, durationMs: null },
          { id: 'f1', name: 'Frame 1', index: 1, durationMs: null },
          { id: 'f2', name: 'Frame 2', index: 2, durationMs: null },
        ],
        activeFrameIndex: 0,
        activeFrameId: 'f0',
        frame: {
          width: 32, height: 32, data: new Array(32 * 32 * 4).fill(0),
          layers: [{ id: 'l1', name: 'L1', visible: true, locked: false, opacity: 1 }],
          activeLayerId: 'l1', canUndo: false, canRedo: false,
        },
      }));
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Comma', bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('select_frame', { frameId: 'f0' });
      });
    });

    it('Space toggles playback with multiple frames', async () => {
      seedStores({ frameCount: 3, playing: false });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      });
      expect(useTimelineStore.getState().playing).toBe(true);
    });

    it('Space does not start playback when transform active', async () => {
      seedStores({ frameCount: 3, playing: false, isTransforming: true });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', bubbles: true }));
      });
      expect(useTimelineStore.getState().playing).toBe(false);
    });
  });

  describe('focus guard', () => {
    it('blocks canvas shortcuts when an input is focused', async () => {
      seedStores();
      render(<Canvas />);
      // Create and focus an input element to simulate typing
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      const before = useTimelineStore.getState().onionSkinEnabled;
      await act(async () => {
        // Dispatch O (onion skin toggle) from the focused input
        input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', bubbles: true }));
      });
      // O should NOT have toggled onion skin
      expect(useTimelineStore.getState().onionSkinEnabled).toBe(before);
      document.body.removeChild(input);
    });

    it('blocks canvas shortcuts when a textarea is focused', async () => {
      seedStores();
      render(<Canvas />);
      const textarea = document.createElement('textarea');
      document.body.appendChild(textarea);
      textarea.focus();
      await act(async () => {
        textarea.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyN', bubbles: true }));
      });
      // N should NOT have switched to sketch-brush
      expect(useToolStore.getState().activeTool).toBe('pencil');
      document.body.removeChild(textarea);
    });

    it('allows Ctrl+Z undo even when input is focused', async () => {
      seedStores();
      render(<Canvas />);
      const input = document.createElement('input');
      document.body.appendChild(input);
      input.focus();
      await act(async () => {
        input.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyZ', ctrlKey: true, bubbles: true }));
      });
      await vi.waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('undo');
      });
      document.body.removeChild(input);
    });

    it('shortcuts fire normally when no input is focused', async () => {
      seedStores();
      const before = useTimelineStore.getState().onionSkinEnabled;
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyO', bubbles: true }));
      });
      expect(useTimelineStore.getState().onionSkinEnabled).toBe(!before);
    });
  });

  describe('manifest-driven tool shortcuts', () => {
    // Generate a test for every live, unmodified tool shortcut in the manifest
    const toolBindings = SHORTCUT_MANIFEST.filter(
      (b) => b.status === 'live' && b.toolId !== undefined && b.scope === 'canvas' &&
        !b.modifiers.ctrl && !b.modifiers.alt
    );

    for (const binding of toolBindings) {
      it(`${binding.label} activates ${binding.toolId}`, async () => {
        seedStores({ activeTool: 'pencil' });
        render(<Canvas />);
        await act(async () => {
          window.dispatchEvent(new KeyboardEvent('keydown', {
            code: binding.code,
            shiftKey: binding.modifiers.shift ?? false,
            bubbles: true,
          }));
        });
        expect(useToolStore.getState().activeTool).toBe(binding.toolId);
      });
    }

    it('X swaps colors', async () => {
      seedStores();
      useToolStore.setState({
        primaryColor: { r: 255, g: 0, b: 0, a: 255 },
        secondaryColor: { r: 0, g: 0, b: 255, a: 255 },
      });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyX', bubbles: true }));
      });
      expect(useToolStore.getState().primaryColor).toEqual({ r: 0, g: 0, b: 255, a: 255 });
      expect(useToolStore.getState().secondaryColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('tool shortcuts do not fire during active transform', async () => {
      seedStores({ activeTool: 'pencil', isTransforming: true });
      render(<Canvas />);
      await act(async () => {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: 'KeyB', bubbles: true }));
      });
      // Should remain pencil, not switch to pencil via B shortcut
      // (transform mode intercepts H/V/R, and tool dispatch is skipped)
      expect(useToolStore.getState().activeTool).toBe('pencil');
    });
  });
});
