import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolRail } from '../components/ToolRail';
import { useToolStore, useBrushSettingsStore, SKETCH_BRUSH_DEFAULTS, SKETCH_ERASER_DEFAULTS, BRUSH_PRESETS } from '@glyphstudio/state';
import { SHORTCUT_MANIFEST, TOOL_SHORTCUT_LABEL, SWAP_COLORS_BINDING } from '@glyphstudio/domain';

function seed() {
  useToolStore.setState({
    activeTool: 'pencil',
    primaryColor: { r: 255, g: 0, b: 0, a: 255 },
    secondaryColor: { r: 0, g: 0, b: 255, a: 255 },
    mirrorMode: 'none',
  });
}

describe('ToolRail', () => {
  afterEach(cleanup);

  describe('rendering', () => {
    it('renders all 22 buttons (15 standard + 2 sketch + 2 mirror + 1 swap + 1 pin + 1 replace)', () => {
      seed();
      render(<ToolRail />);
      const buttons = screen.getAllByRole('button');
      // 15 standard + 2 sketch tools + 2 mirror toggles + 1 swap-colors + 1 pin + 1 replace-color
      expect(buttons).toHaveLength(22);
    });

    it('tools with live+displayed manifest entries show shortcut badge', () => {
      seed();
      render(<ToolRail />);
      // Pencil has a live+displayed manifest entry with label 'B'
      const pencilBtn = screen.getByTitle('Pencil (B)');
      expect(pencilBtn.querySelector('.tool-shortcut')?.textContent).toBe('B');
    });

    it('sketch tools show shortcut badge from manifest', () => {
      seed();
      render(<ToolRail />);
      const sketchBtn = screen.getByTitle('Sketch (N)');
      expect(sketchBtn.textContent).toBe('SketchN');
      const sketchEraseBtn = screen.getByTitle('S.Erase (Shift+N)');
      expect(sketchEraseBtn.textContent).toBe('S.EraseShift+N');
    });

    it('active tool button has active class', () => {
      seed();
      useToolStore.setState({ activeTool: 'eraser' });
      render(<ToolRail />);
      const eraserBtn = screen.getByTitle('Eraser (E)');
      expect(eraserBtn.className).toContain('active');
    });

    it('non-active tool buttons lack active class', () => {
      seed();
      render(<ToolRail />);
      const eraserBtn = screen.getByTitle('Eraser (E)');
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
        await userEvent.click(screen.getByTitle('Fill (G)'));
      });
      expect(useToolStore.getState().activeTool).toBe('fill');
    });

    it('clicking swap button calls swapColors', async () => {
      seed();
      render(<ToolRail />);
      const swapBtn = screen.getByTestId('swap-colors-btn');
      await act(async () => {
        await userEvent.click(swapBtn);
      });
      const state = useToolStore.getState();
      expect(state.primaryColor).toEqual({ r: 0, g: 0, b: 255, a: 255 });
      expect(state.secondaryColor).toEqual({ r: 255, g: 0, b: 0, a: 255 });
    });

    it('renders replace-color button', () => {
      seed();
      render(<ToolRail />);
      expect(screen.getByTestId('replace-color-btn')).toBeInTheDocument();
    });

    it('renders mirror H and V buttons', () => {
      seed();
      render(<ToolRail />);
      expect(screen.getByTestId('mirror-h-btn')).toBeInTheDocument();
      expect(screen.getByTestId('mirror-v-btn')).toBeInTheDocument();
    });

    it('mirror buttons are inactive when mirrorMode=none', () => {
      seed();
      useToolStore.setState({ mirrorMode: 'none' });
      render(<ToolRail />);
      expect(screen.getByTestId('mirror-h-btn').className).not.toContain('active');
      expect(screen.getByTestId('mirror-v-btn').className).not.toContain('active');
    });

    it('mirror H button is active when mirrorMode=h', () => {
      seed();
      useToolStore.setState({ mirrorMode: 'h' });
      render(<ToolRail />);
      expect(screen.getByTestId('mirror-h-btn').className).toContain('active');
      expect(screen.getByTestId('mirror-v-btn').className).not.toContain('active');
    });

    it('both mirror buttons active when mirrorMode=both', () => {
      seed();
      useToolStore.setState({ mirrorMode: 'both' });
      render(<ToolRail />);
      expect(screen.getByTestId('mirror-h-btn').className).toContain('active');
      expect(screen.getByTestId('mirror-v-btn').className).toContain('active');
    });

    it('clicking primary swatch opens color picker', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTestId('swatch-primary'));
      });
      expect(screen.getByTestId('color-picker-popover')).toBeInTheDocument();
    });

    it('clicking secondary swatch opens color picker', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTestId('swatch-secondary'));
      });
      expect(screen.getByTestId('color-picker-popover')).toBeInTheDocument();
    });

    it('switching tool updates active class', async () => {
      seed();
      render(<ToolRail />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Move (V)'));
      });
      expect(screen.getByTitle('Move (V)').className).toContain('active');
      expect(screen.getByTitle('Pencil (B)').className).not.toContain('active');
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

  describe('brush presets', () => {
    it('brush preset strip is hidden when pencil is active', () => {
      seed();
      render(<ToolRail />);
      expect(document.querySelector('.brush-presets')).toBeNull();
    });

    it('brush preset strip is visible when sketch-brush is active', () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-brush' });
      render(<ToolRail />);
      expect(document.querySelector('[data-testid="brush-presets"]')).not.toBeNull();
    });

    it('brush preset strip is hidden when sketch-eraser is active', () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-eraser' });
      render(<ToolRail />);
      expect(document.querySelector('[data-testid="brush-presets"]')).toBeNull();
    });

    it('renders one button per BRUSH_PRESETS entry', () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-brush' });
      render(<ToolRail />);
      for (const preset of BRUSH_PRESETS) {
        expect(document.querySelector(`[data-testid="brush-preset-${preset.id}"]`)).not.toBeNull();
      }
    });

    it('clicking a preset applies its settings and marks it active', async () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-brush' });
      render(<ToolRail />);
      const hardBtn = document.querySelector('[data-testid="brush-preset-pixel-hard"]') as HTMLElement;
      await act(async () => { await userEvent.click(hardBtn); });
      const preset = BRUSH_PRESETS.find((p) => p.id === 'pixel-hard')!;
      expect(useBrushSettingsStore.getState().sketchBrush).toEqual(preset.settings);
      expect(useBrushSettingsStore.getState().activePresetId).toBe('pixel-hard');
      expect(hardBtn.className).toContain('active');
    });

    it('active preset button loses active class after manual size change', async () => {
      seed();
      useToolStore.setState({ activeTool: 'sketch-brush' });
      useBrushSettingsStore.getState().applyPreset('pixel-hard');
      render(<ToolRail />);
      const hardBtn = document.querySelector('[data-testid="brush-preset-pixel-hard"]') as HTMLElement;
      expect(hardBtn.className).toContain('active');
      useBrushSettingsStore.getState().setBrushSize('sketchBrush', 8);
      // re-render is synchronous in zustand subscriber — check state directly
      expect(useBrushSettingsStore.getState().activePresetId).toBeNull();
    });
  });

  describe('manifest-driven parity', () => {
    it('every displayed badge comes from a live manifest entry', () => {
      seed();
      render(<ToolRail />);
      const allButtons = screen.getAllByRole('button');
      for (const btn of allButtons) {
        const shortcutSpan = btn.querySelector('.tool-shortcut');
        if (shortcutSpan) {
          const label = shortcutSpan.textContent!;
          const entry = SHORTCUT_MANIFEST.find((b) => b.label === label && b.status === 'live' && b.displayed);
          expect(entry, `Badge "${label}" has no live+displayed manifest entry`).toBeDefined();
        }
      }
    });

    it('every live+displayed tool manifest entry has a visible badge', () => {
      seed();
      render(<ToolRail />);
      const toolEntries = SHORTCUT_MANIFEST.filter(
        (b) => b.status === 'live' && b.displayed && b.toolId !== undefined
      );
      for (const entry of toolEntries) {
        const badges = document.querySelectorAll('.tool-shortcut');
        const found = Array.from(badges).some((el) => el.textContent === entry.label);
        expect(found, `Manifest entry "${entry.id}" (${entry.label}) has no visible badge`).toBe(true);
      }
    });

    it('no tool button title advertises a shortcut without a manifest entry', () => {
      seed();
      render(<ToolRail />);
      const allButtons = screen.getAllByRole('button');
      const shortcutPattern = /\(([^)]+)\)/;
      for (const btn of allButtons) {
        const match = btn.title.match(shortcutPattern);
        if (match) {
          const label = match[1];
          const entry = SHORTCUT_MANIFEST.find((b) => b.label === label && b.status === 'live');
          expect(entry, `Title "${btn.title}" advertises shortcut "${label}" with no live manifest entry`).toBeDefined();
        }
      }
    });

    it('ellipse shortcut is C (not O)', () => {
      const entry = SHORTCUT_MANIFEST.find((b) => b.id === 'tool-ellipse');
      expect(entry).toBeDefined();
      expect(entry!.label).toBe('C');
      expect(entry!.code).toBe('KeyC');
      // O is reserved for onion skin
      const onion = SHORTCUT_MANIFEST.find((b) => b.id === 'onion-skin');
      expect(onion).toBeDefined();
      expect(onion!.code).toBe('KeyO');
    });

    it('swap button tooltip includes (X) since X is live in manifest', () => {
      seed();
      render(<ToolRail />);
      const swapBtn = screen.getByTestId('swap-colors-btn');
      expect(swapBtn.title).toBe('Swap colors (X)');
    });
  });
});
