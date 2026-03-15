import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToolRail } from '../components/ToolRail';
import { useToolStore } from '@pixelstudio/state';

function seed() {
  useToolStore.setState({
    activeTool: 'pencil',
    primaryColor: { r: 255, g: 0, b: 0, a: 255 },
    secondaryColor: { r: 0, g: 0, b: 255, a: 255 },
    brushSize: 1,
  });
}

describe('ToolRail', () => {
  afterEach(cleanup);

  describe('rendering', () => {
    it('renders all 15 tool buttons', () => {
      seed();
      render(<ToolRail />);
      const buttons = screen.getAllByRole('button');
      // 15 tool buttons (color swatch area uses a div with onClick, not a button)
      expect(buttons).toHaveLength(15);
    });

    it('each button shows first letter of tool label as icon', () => {
      seed();
      render(<ToolRail />);
      // Verify via title which is unique per tool
      const pencilBtn = screen.getByTitle('Pencil (B)');
      expect(pencilBtn.textContent).toBe('P');
      const fillBtn = screen.getByTitle('Fill (G)');
      expect(fillBtn.textContent).toBe('F');
      const rectBtn = screen.getByTitle('Rect (U)');
      expect(rectBtn.textContent).toBe('R');
      const moveBtn = screen.getByTitle('Move (V)');
      expect(moveBtn.textContent).toBe('M');
    });

    it('each button has label+shortcut in title', () => {
      seed();
      render(<ToolRail />);
      expect(screen.getByTitle('Pencil (B)')).toBeInTheDocument();
      expect(screen.getByTitle('Eraser (E)')).toBeInTheDocument();
      expect(screen.getByTitle('Fill (G)')).toBeInTheDocument();
      expect(screen.getByTitle('Move (V)')).toBeInTheDocument();
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
        await userEvent.click(screen.getByTitle('Move (V)'));
      });
      expect(screen.getByTitle('Move (V)').className).toContain('active');
      expect(screen.getByTitle('Pencil (B)').className).not.toContain('active');
    });
  });
});
