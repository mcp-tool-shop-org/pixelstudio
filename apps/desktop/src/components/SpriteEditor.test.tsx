import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSpriteEditorStore, samplePixel, setPixel, clonePixelBuffer, extractSelection } from '@glyphstudio/state';
import type { Rgba } from '@glyphstudio/state';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import type { SpriteSelectionRect } from '@glyphstudio/domain';

import { SpriteEditor } from '../components/SpriteEditor';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
}

function openTestDoc(width = 16, height = 16) {
  useSpriteEditorStore.getState().newDocument('test-sprite', width, height);
}

describe('SpriteEditor', () => {
  beforeEach(() => resetStore());
  afterEach(() => cleanup());

  // ── Empty state ──

  it('shows empty message when no document is open', () => {
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-editor-empty')).toBeDefined();
    expect(screen.getByText(/no sprite document open/i)).toBeDefined();
  });

  // ── With document ──

  it('renders the editor shell when document is open', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-editor')).toBeDefined();
  });

  it('renders tool rail', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-tool-rail')).toBeDefined();
  });

  it('renders canvas area', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-canvas-area')).toBeDefined();
  });

  it('renders palette panel', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-palette-panel')).toBeDefined();
  });

  it('renders frame strip', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-frame-strip')).toBeDefined();
  });

  // ── Canvas area ──

  it('shows canvas dimensions', () => {
    openTestDoc(32, 24);
    render(<SpriteEditor />);
    expect(screen.getByTestId('canvas-dimensions').textContent).toBe('32 x 24');
  });

  it('shows current zoom', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('canvas-zoom').textContent).toBe('8x');
  });

  it('shows frame info', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('canvas-frame').textContent).toBe('Frame 1/1');
  });

  // ── Tool rail ──

  it('shows tool buttons', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByText('Pencil')).toBeDefined();
    expect(screen.getByText('Eraser')).toBeDefined();
    expect(screen.getByText('Fill')).toBeDefined();
    expect(screen.getByText('Eyedropper')).toBeDefined();
  });

  it('clicking a tool button changes the active tool', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Eraser'));
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('eraser');
  });

  it('shows brush size input', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('brush-size-input')).toBeDefined();
  });

  // ── Frame strip ──

  it('shows add frame button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('add-frame-btn')).toBeDefined();
  });

  it('clicking add frame creates a new frame', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('add-frame-btn'));
    expect(useSpriteEditorStore.getState().document!.frames).toHaveLength(2);
  });

  it('shows remove frame button when multiple frames exist', async () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().addFrame());
    render(<SpriteEditor />);
    expect(screen.getByTestId('remove-frame-btn')).toBeDefined();
  });

  it('does not show remove frame button with single frame', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.queryByTestId('remove-frame-btn')).toBeNull();
  });

  // ── Palette panel ──

  it('shows palette grid', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('palette-grid')).toBeDefined();
  });

  it('shows swap button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('palette-swap')).toBeDefined();
  });

  it('clicking swap swaps foreground and background colors', async () => {
    openTestDoc();
    act(() => {
      useSpriteEditorStore.getState().setForegroundColor(5);
      useSpriteEditorStore.getState().setBackgroundColor(3);
    });
    render(<SpriteEditor />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('palette-swap'));
    const palette = useSpriteEditorStore.getState().document!.palette;
    expect(palette.foregroundIndex).toBe(3);
    expect(palette.backgroundIndex).toBe(5);
  });

  // ── Canvas rendering ──

  it('renders a canvas element when document is open', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-canvas')).toBeDefined();
  });

  it('renders canvas info overlay', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-canvas-info')).toBeDefined();
  });

  it('no document open still shows empty state safely', () => {
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-editor-empty')).toBeDefined();
    expect(screen.queryByTestId('sprite-canvas')).toBeNull();
  });

  // ── Store-level pixel editing integration ──

  it('committing pixels via store updates only active frame', () => {
    openTestDoc(4, 4);
    act(() => useSpriteEditorStore.getState().addFrame());
    // Active frame is now 1
    const state = useSpriteEditorStore.getState();
    const frame0Id = state.document!.frames[0].id;
    const frame1Id = state.document!.frames[1].id;

    const buf = createBlankPixelBuffer(4, 4);
    const RED: Rgba = [255, 0, 0, 255];
    setPixel(buf, 2, 2, RED);

    act(() => useSpriteEditorStore.getState().commitPixels(buf));

    // Active frame (1) has red pixel
    const buf1 = useSpriteEditorStore.getState().pixelBuffers[frame1Id];
    expect(samplePixel(buf1, 2, 2)).toEqual(RED);

    // Frame 0 is untouched
    const buf0 = useSpriteEditorStore.getState().pixelBuffers[frame0Id];
    expect(samplePixel(buf0, 2, 2)).toEqual([0, 0, 0, 0]);
  });

  it('eyedropper action updates foreground color in store', () => {
    openTestDoc(4, 4);
    act(() => {
      useSpriteEditorStore.getState().setForegroundColorByRgba([128, 64, 32, 255]);
    });
    const palette = useSpriteEditorStore.getState().document!.palette;
    const fg = palette.colors[palette.foregroundIndex];
    expect(fg.rgba).toEqual([128, 64, 32, 255]);
  });

  it('eraser semantics: erase to transparent', () => {
    openTestDoc(4, 4);
    // Paint a pixel
    const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
    const buf = clonePixelBuffer(useSpriteEditorStore.getState().pixelBuffers[frameId]);
    setPixel(buf, 1, 1, [255, 0, 0, 255]);
    act(() => useSpriteEditorStore.getState().commitPixels(buf));

    // Erase it
    const buf2 = clonePixelBuffer(useSpriteEditorStore.getState().pixelBuffers[frameId]);
    setPixel(buf2, 1, 1, [0, 0, 0, 0]); // transparent
    act(() => useSpriteEditorStore.getState().commitPixels(buf2));

    const final = useSpriteEditorStore.getState().pixelBuffers[frameId];
    expect(samplePixel(final, 1, 1)).toEqual([0, 0, 0, 0]);
  });

  it('active frame info updates after adding frame', () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().addFrame());
    render(<SpriteEditor />);
    expect(screen.getByTestId('canvas-frame').textContent).toBe('Frame 2/2');
  });

  it('tool buttons affect store state correctly', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const user = userEvent.setup();

    await user.click(screen.getByText('Fill'));
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('fill');

    await user.click(screen.getByText('Eyedropper'));
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('eyedropper');

    await user.click(screen.getByText('Pencil'));
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('pencil');
  });

  // ── Frame strip ──

  it('duplicate frame button exists', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('duplicate-frame-btn')).toBeDefined();
  });

  it('clicking duplicate frame creates a new frame', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('duplicate-frame-btn'));
    expect(useSpriteEditorStore.getState().document!.frames).toHaveLength(2);
  });

  it('frame strip reflects current frame count after adding frames', () => {
    openTestDoc();
    act(() => {
      useSpriteEditorStore.getState().addFrame();
      useSpriteEditorStore.getState().addFrame();
    });
    render(<SpriteEditor />);
    const thumbs = screen.getAllByText(/^\d+$/);
    expect(thumbs.length).toBe(3);
  });

  it('delete frame disabled when only one frame', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.queryByTestId('remove-frame-btn')).toBeNull();
  });

  it('drawing on frame A does not affect frame B', () => {
    openTestDoc(4, 4);
    act(() => useSpriteEditorStore.getState().addFrame());
    // Active is now frame 1. Paint red at (1,1)
    const frame1Id = useSpriteEditorStore.getState().document!.frames[1].id;
    const buf = clonePixelBuffer(useSpriteEditorStore.getState().pixelBuffers[frame1Id]);
    setPixel(buf, 1, 1, [255, 0, 0, 255]);
    act(() => useSpriteEditorStore.getState().commitPixels(buf));

    // Frame 0 should be untouched
    const frame0Id = useSpriteEditorStore.getState().document!.frames[0].id;
    const buf0 = useSpriteEditorStore.getState().pixelBuffers[frame0Id];
    expect(samplePixel(buf0, 1, 1)).toEqual([0, 0, 0, 0]);
  });

  // ── Onion skin controls ──

  it('shows onion skin controls', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('onion-skin-controls')).toBeDefined();
  });

  it('onion skin toggle changes store state', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const user = userEvent.setup();
    const toggle = screen.getByTestId('onion-skin-toggle');
    await user.click(toggle);
    expect(useSpriteEditorStore.getState().onionSkin.enabled).toBe(true);
  });

  it('onion skin controls show before/after/opacity when enabled', async () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().setOnionSkin({ enabled: true }));
    render(<SpriteEditor />);
    expect(screen.getByTestId('onion-frames-before')).toBeDefined();
    expect(screen.getByTestId('onion-frames-after')).toBeDefined();
    expect(screen.getByTestId('onion-opacity')).toBeDefined();
  });

  it('onion skin controls hidden when disabled', () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().setOnionSkin({ enabled: false }));
    render(<SpriteEditor />);
    expect(screen.queryByTestId('onion-frames-before')).toBeNull();
  });

  // ── Onion skin safety ──

  it('onion skin rendering does not alter frame buffers', () => {
    openTestDoc(4, 4);
    // Paint frame 0 red
    const frame0Id = useSpriteEditorStore.getState().document!.frames[0].id;
    const buf0 = clonePixelBuffer(useSpriteEditorStore.getState().pixelBuffers[frame0Id]);
    setPixel(buf0, 0, 0, [255, 0, 0, 255]);
    act(() => {
      useSpriteEditorStore.getState().commitPixels(buf0);
    });

    // Add frame 1 and paint green
    act(() => useSpriteEditorStore.getState().addFrame());
    const frame1Id = useSpriteEditorStore.getState().document!.frames[1].id;
    const buf1 = clonePixelBuffer(useSpriteEditorStore.getState().pixelBuffers[frame1Id]);
    setPixel(buf1, 1, 1, [0, 255, 0, 255]);
    act(() => {
      useSpriteEditorStore.getState().commitPixels(buf1);
      useSpriteEditorStore.getState().setOnionSkin({ enabled: true, framesBefore: 1 });
    });

    // Render the editor (which triggers canvas render with onion skin)
    render(<SpriteEditor />);

    // Verify frame 0 buffer is unmodified
    const storedBuf0 = useSpriteEditorStore.getState().pixelBuffers[frame0Id];
    expect(samplePixel(storedBuf0, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(samplePixel(storedBuf0, 1, 1)).toEqual([0, 0, 0, 0]);

    // Verify frame 1 buffer is unmodified
    const storedBuf1 = useSpriteEditorStore.getState().pixelBuffers[frame1Id];
    expect(samplePixel(storedBuf1, 1, 1)).toEqual([0, 255, 0, 255]);
    expect(samplePixel(storedBuf1, 0, 0)).toEqual([0, 0, 0, 0]);
  });

  // ── Select tool ──

  it('shows Select tool button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByText('Select')).toBeDefined();
  });

  it('clicking Select tool changes active tool', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const user = userEvent.setup();
    await user.click(screen.getByText('Select'));
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('select');
  });

  // ── Selection state integration ──

  it('selection cleared on frame switch', () => {
    openTestDoc(8, 8);
    act(() => useSpriteEditorStore.getState().addFrame());
    const rect: SpriteSelectionRect = { x: 0, y: 0, width: 2, height: 2 };
    const buf = createBlankPixelBuffer(2, 2);
    act(() => useSpriteEditorStore.getState().setSelection(rect, buf));
    expect(useSpriteEditorStore.getState().selectionRect).not.toBeNull();
    act(() => useSpriteEditorStore.getState().setActiveFrame(0));
    expect(useSpriteEditorStore.getState().selectionRect).toBeNull();
  });

  it('clearSelection does not mutate pixel buffers', () => {
    openTestDoc(4, 4);
    const frameId = useSpriteEditorStore.getState().document!.frames[0].id;
    const origBuf = clonePixelBuffer(useSpriteEditorStore.getState().pixelBuffers[frameId]);
    const RED: Rgba = [255, 0, 0, 255];
    setPixel(origBuf, 1, 1, RED);
    act(() => useSpriteEditorStore.getState().commitPixels(origBuf));

    const rect: SpriteSelectionRect = { x: 0, y: 0, width: 2, height: 2 };
    const selBuf = createBlankPixelBuffer(2, 2);
    act(() => useSpriteEditorStore.getState().setSelection(rect, selBuf));
    act(() => useSpriteEditorStore.getState().clearSelection());

    // Pixel buffer should be unchanged
    const stored = useSpriteEditorStore.getState().pixelBuffers[frameId];
    expect(samplePixel(stored, 1, 1)).toEqual(RED);
  });

  // ── Palette panel ──

  it('palette swatches have data-testid attributes', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('palette-swatch-0')).toBeDefined();
    expect(screen.getByTestId('palette-swatch-1')).toBeDefined();
  });

  it('double-clicking a swatch selects color and switches to pencil', async () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().setTool('eraser'));
    render(<SpriteEditor />);
    const user = userEvent.setup();
    await user.dblClick(screen.getByTestId('palette-swatch-3'));
    const state = useSpriteEditorStore.getState();
    expect(state.document!.palette.foregroundIndex).toBe(3);
    expect(state.tool.activeTool).toBe('pencil');
  });

  // ── Import/export bar ──

  it('renders import/export bar when document is open', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-import-export-bar')).toBeDefined();
  });

  it('shows import button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-import-btn')).toBeDefined();
  });

  it('shows export sheet button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-export-sheet-btn')).toBeDefined();
  });

  it('shows export frame button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-export-frame-btn')).toBeDefined();
  });

  it('no import/export bar when no document', () => {
    render(<SpriteEditor />);
    expect(screen.queryByTestId('sprite-import-export-bar')).toBeNull();
  });

  // ── View exclusion law ──

  it('exported frame is not affected by onion skin', () => {
    openTestDoc(4, 4);
    const f0Buf = createBlankPixelBuffer(4, 4);
    setPixel(f0Buf, 0, 0, [255, 0, 0, 255]);
    act(() => useSpriteEditorStore.getState().commitPixels(f0Buf));

    act(() => useSpriteEditorStore.getState().addFrame());
    const f1Buf = createBlankPixelBuffer(4, 4);
    setPixel(f1Buf, 1, 1, [0, 255, 0, 255]);
    act(() => {
      useSpriteEditorStore.getState().commitPixels(f1Buf);
      useSpriteEditorStore.getState().setOnionSkin({ enabled: true, framesBefore: 1 });
    });

    // Export active frame (frame 1) — should NOT contain frame 0's pixels
    const exported = useSpriteEditorStore.getState().exportCurrentFrame()!;
    expect(samplePixel(exported, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(samplePixel(exported, 1, 1)).toEqual([0, 255, 0, 255]);
  });

  // ── Keyboard shortcuts ──

  it('tool shortcut B activates pencil', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    act(() => useSpriteEditorStore.getState().setTool('select'));
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('select');
    await userEvent.keyboard('b');
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('pencil');
  });

  it('tool shortcut E activates eraser', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    await userEvent.keyboard('e');
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('eraser');
  });

  it('tool shortcut M activates select', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    await userEvent.keyboard('m');
    expect(useSpriteEditorStore.getState().tool.activeTool).toBe('select');
  });

  it('comma key navigates to previous frame', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    act(() => useSpriteEditorStore.getState().addFrame());
    expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
    await userEvent.keyboard(',');
    expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
  });

  it('period key navigates to next frame', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    act(() => useSpriteEditorStore.getState().addFrame());
    act(() => useSpriteEditorStore.getState().setActiveFrame(0));
    expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(0);
    await userEvent.keyboard('.');
    expect(useSpriteEditorStore.getState().activeFrameIndex).toBe(1);
  });

  it('N key adds a blank frame', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(useSpriteEditorStore.getState().document!.frames.length).toBe(1);
    await userEvent.keyboard('n');
    expect(useSpriteEditorStore.getState().document!.frames.length).toBe(2);
  });

  it('Shift+D duplicates the current frame', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(useSpriteEditorStore.getState().document!.frames.length).toBe(1);
    await userEvent.keyboard('{Shift>}d{/Shift}');
    expect(useSpriteEditorStore.getState().document!.frames.length).toBe(2);
  });

  it('X key swaps foreground and background colors', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const before = useSpriteEditorStore.getState().document!.palette;
    const origFg = before.foregroundIndex;
    const origBg = before.backgroundIndex;
    await userEvent.keyboard('x');
    const after = useSpriteEditorStore.getState().document!.palette;
    expect(after.foregroundIndex).toBe(origBg);
    expect(after.backgroundIndex).toBe(origFg);
  });

  it('shows RGBA label for foreground color', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('palette-rgba-label')).toBeDefined();
  });

  it('shows color picker input', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('palette-color-picker')).toBeDefined();
  });

  // ── Preview bar ──

  it('renders preview bar when document is open', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('sprite-preview-bar')).toBeDefined();
  });

  it('no preview bar when no document', () => {
    render(<SpriteEditor />);
    expect(screen.queryByTestId('sprite-preview-bar')).toBeNull();
  });

  it('shows play button', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('preview-play-btn')).toBeDefined();
  });

  it('shows loop toggle', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('preview-loop-btn')).toBeDefined();
  });

  it('shows frame counter', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('preview-frame-counter').textContent).toBe('1 / 1');
  });

  it('shows scrubber', () => {
    openTestDoc();
    render(<SpriteEditor />);
    expect(screen.getByTestId('preview-scrubber')).toBeDefined();
  });

  it('Space key toggles play (requires 2+ frames)', async () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().addFrame());
    act(() => useSpriteEditorStore.getState().setActiveFrame(0));
    render(<SpriteEditor />);
    expect(useSpriteEditorStore.getState().isPlaying).toBe(false);
    await userEvent.keyboard(' ');
    expect(useSpriteEditorStore.getState().isPlaying).toBe(true);
    await userEvent.keyboard(' ');
    expect(useSpriteEditorStore.getState().isPlaying).toBe(false);
  });

  it('= key zooms in', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    const before = useSpriteEditorStore.getState().zoom;
    await userEvent.keyboard('=');
    expect(useSpriteEditorStore.getState().zoom).toBeGreaterThan(before);
  });

  it('- key zooms out', async () => {
    openTestDoc();
    render(<SpriteEditor />);
    // Zoom in first so we can zoom out
    act(() => useSpriteEditorStore.getState().zoomIn());
    const before = useSpriteEditorStore.getState().zoom;
    await userEvent.keyboard('-');
    expect(useSpriteEditorStore.getState().zoom).toBeLessThan(before);
  });

  // ── Frame reorder buttons ──

  it('shows move frame buttons when multiple frames', () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().addFrame());
    render(<SpriteEditor />);
    expect(screen.getByTestId('move-frame-left-btn')).toBeDefined();
    expect(screen.getByTestId('move-frame-right-btn')).toBeDefined();
  });

  it('move left button is disabled on first frame', () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().addFrame());
    act(() => useSpriteEditorStore.getState().setActiveFrame(0));
    render(<SpriteEditor />);
    expect(screen.getByTestId('move-frame-left-btn').hasAttribute('disabled')).toBe(true);
  });

  it('move right button is disabled on last frame', () => {
    openTestDoc();
    act(() => useSpriteEditorStore.getState().addFrame());
    // Active is frame 1 (last)
    render(<SpriteEditor />);
    expect(screen.getByTestId('move-frame-right-btn').hasAttribute('disabled')).toBe(true);
  });

  it('export after frame operations reflects final state', () => {
    openTestDoc(2, 2);
    // Paint frame 0
    const f0Buf = createBlankPixelBuffer(2, 2);
    setPixel(f0Buf, 0, 0, [255, 0, 0, 255]);
    act(() => useSpriteEditorStore.getState().commitPixels(f0Buf));

    // Add frame 1
    act(() => useSpriteEditorStore.getState().addFrame());
    const f1Buf = createBlankPixelBuffer(2, 2);
    setPixel(f1Buf, 0, 0, [0, 255, 0, 255]);
    act(() => useSpriteEditorStore.getState().commitPixels(f1Buf));

    // Duplicate frame 1
    act(() => useSpriteEditorStore.getState().duplicateFrame());

    // Delete the middle frame (frame 1)
    const f1Id = useSpriteEditorStore.getState().document!.frames[1].id;
    act(() => useSpriteEditorStore.getState().removeFrame(f1Id));

    // Export should reflect RED, GREEN (from duplicate)
    const result = useSpriteEditorStore.getState().exportSpriteSheet();
    expect(typeof result).not.toBe('string');
    if (typeof result === 'string') return;
    expect(result.width).toBe(4);
    expect(samplePixel(result, 0, 0)).toEqual([255, 0, 0, 255]);
    expect(samplePixel(result, 2, 0)).toEqual([0, 255, 0, 255]);
  });
});
