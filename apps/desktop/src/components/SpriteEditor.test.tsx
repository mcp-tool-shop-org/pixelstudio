import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSpriteEditorStore, samplePixel, setPixel, clonePixelBuffer } from '@glyphstudio/state';
import type { Rgba } from '@glyphstudio/state';
import { createBlankPixelBuffer } from '@glyphstudio/domain';

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
});
