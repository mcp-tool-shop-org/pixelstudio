import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSpriteEditorStore } from '@glyphstudio/state';

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
});
