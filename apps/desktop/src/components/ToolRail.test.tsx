import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolRail, BOUND_SHORTCUTS } from '../components/ToolRail';
import { useToolStore, useBrushSettingsStore, SKETCH_BRUSH_DEFAULTS, SKETCH_ERASER_DEFAULTS } from '@glyphstudio/state';

function seed() {
  useToolStore.setState({
    activeTool: 'pencil',
    primaryColor: { r: 255, g: 0, b: 0, a: 255 },
    secondaryColor: { r: 0, g: 0, b: 255, a: 255 },
  });
}

describe('ToolRail', () => {
  afterEach(cleanup);

  describe('rendering', () => {
    it('renders all 17 tool buttons (15 standard + 2 sketch)', () => {
      seed();
      render(<ToolRail />);
      const buttons = screen.getAllByRole('button');
      // 15 standard + 2 sketch tools (color swatch area uses a div with onClick, not a button)
      expect(buttons).toHaveLength(17);
    });

    it('bound tools show label and shortcut badge', () => {
      seed();
      render(<ToolRail />);
      // Sketch tools are bound (N, Shift+N)
      const sketchBtn = screen.getByTitle('Sketch (N)');
      expect(sketchBtn.textContent).toBe('SketchN');
    });

    it('unbound tools show label only, no shortcut badge', () => {
      seed();
      render(<ToolRail />);
      // Pencil shortcut B is not yet bound — title has no shortcut
      const pencilBtn = screen.getByTitle('Pencil');
      expect(pencilBtn.textContent).toBe('Pencil');
      // No shortcut span inside
      expect(pencilBtn.querySelector('.tool-shortcut')).toBeNull();
    });

    it('unbound tools have label-only title (no stale shortcut in tooltip)', () => {
      seed();
      render(<ToolRail />);
      expect(screen.getByTitle('Pencil')).toBeInTheDocument();
      expect(screen.getByTitle('Eraser')).toBeInTheDocument();
      expect(screen.getByTitle('Fill')).toBeInTheDocument();
      expect(screen.getByTitle('Move')).toBeInTheDocument();
      // No title should contain "(B)", "(E)", etc. for unbound tools
      expect(screen.queryByTitle('Pencil (B)')).not.toBeInTheDocument();
      expect(screen.queryByTitle('Eraser (E)')).not.toBeInTheDocument();
    });

    it('active tool button has active class', () => {
      seed();
      useToolStore.setState({ activeTool: 'eraser' });
      render(<ToolRail />);
      const eraserBtn = screen.getByTitle('Eraser');
      expect(eraserBtn.className).toContain('active');
    });

    it('non-active tool buttons lack active class', () => {
      seed();
      render(<ToolRail />);
      const eraserBtn = screen.getByTitle('Eraser');
      expect(eraserBtn.className).not.toContain('active');
    });

    it('shows primary color swatch', () => {
      seed();
      render(<ToolRail />);
      const primary = document.querySelector('.color-swatch.primary') as HTMLElement;
      expect(primary).not.toBeNull();
      expect(primary.style.backgroundColor).toBe('rgb(255, 0, 0)');
    });

    it('shows secondary color swatch', () => {
      seed();
      render(<ToolRail />);
      const secondary = document.querySelector('.color-swatch.secondary') as HTMLElement;
      expect(secondary).not.toBeNull();
      expect(secondary.style.backgroundColor).toBe('rgb(0, 0, 255)');
    });
  });

  describe('interactions', () => {
    it('clicking a tool button sets active tool', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Fill'));
      });
      expect(useToolStore.getState().activeTool).toBe('fill');
    });

    it('clicking color swatches calls swapColors', async () => {
      seed();
      render(<ToolRail />);
      const swap = document.querySelector('.tool-colors') as HTMLElement;
      expect(swap).not.toBeNull();
      await act(async () => {
        await userEvent.click(swap);
      });
      const state = useToolStore.getState();
      // After swap, primary should be blue, secondary red
      expect(state.primaryColor).toEqual({ r: 0, g: 0, b: 255, a: 255 });
      expect(state.secondaryColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('switching tool updates active class', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Move'));
      });
      expect(screen.getByTitle('Move').className).toContain('active');
      expect(screen.getByTitle('Pencil').className).not.toContain('active');
    });

    it('clicking sketch-brush activates sketch tool', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Sketch (N)'));
      });
      expect(useToolStore.getState().activeTool).toBe('sketch-brush');
    });

    it('clicking sketch-eraser activates sketch eraser', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('S.Erase (Shift+N)'));
      });
      expect(useToolStore.getState().activeTool).toBe('sketch-eraser');
    });
  });

  describe('sketch settings', () => {
    it('shows sketch settings when sketch-brush is active', () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-brush' });
      render(<ToolRail />);
      expect(document.querySelector('.sketch-settings')).not.toBeNull();
    });

    it('hides sketch settings when pencil is active', () => {
      seed();
      render(<ToolRail />);
      expect(document.querySelector('.sketch-settings')).toBeNull();
    });

    it('sketch button has sketch-tool class', () => {
      seed();
      render(<ToolRail />);
      const sketchBtn = screen.getByTitle('Sketch (N)');
      expect(sketchBtn.className).toContain('sketch-tool');
    });

    it('reset button restores defaults', async () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-brush' });
      useBrushSettingsStore.getState().setBrushSize('sketchBrush', 20);
      render(<ToolRail />);
      const resetBtn = screen.getByText('Reset');
      await act(async () => {
        await userEvent.click(resetBtn);
      });
      expect(useBrushSettingsStore.getState().sketchBrush.size).toBe(SKETCH_BRUSH_DEFAULTS.size);
    });
  });

  describe('shortcut badge truthfulness (P0)', () => {
    it('no shortcut badge is rendered for unbound tools', () => {
      seed();
      render(<ToolRail />);
      const allButtons = screen.getAllByRole('button');
      for (const btn of allButtons) {
        const shortcutSpan = btn.querySelector('.tool-shortcut');
        if (shortcutSpan) {
          // Every rendered badge must be in BOUND_SHORTCUTS
          expect(BOUND_SHORTCUTS.has(shortcutSpan.textContent!)).toBe(true);
        }
      }
    });

    it('bound sketch tools render their shortcut badges', () => {
      seed();
      render(<ToolRail />);
      const sketchBtn = screen.getByTitle('Sketch (N)');
      expect(sketchBtn.querySelector('.tool-shortcut')?.textContent).toBe('N');
      const sketchEraseBtn = screen.getByTitle('S.Erase (Shift+N)');
      expect(sketchEraseBtn.querySelector('.tool-shortcut')?.textContent).toBe('Shift+N');
    });

    it('ellipse has no shortcut badge (O conflict resolved)', () => {
      seed();
      render(<ToolRail />);
      const ellipseBtn = screen.getByTitle('Ellipse');
      expect(ellipseBtn.querySelector('.tool-shortcut')).toBeNull();
      // No stale O shortcut in title
      expect(screen.queryByTitle('Ellipse (O)')).not.toBeInTheDocument();
    });

    it('swap colors tooltip has no stale (X) reference', () => {
      seed();
      render(<ToolRail />);
      const swapArea = document.querySelector('.tool-colors') as HTMLElement;
      expect(swapArea.title).toBe('Click to swap colors');
      expect(swapArea.title).not.toContain('X');
    });
  });
});
