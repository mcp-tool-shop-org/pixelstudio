import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QuickPaletteStrip } from '../components/QuickPaletteStrip';
import { useToolStore } from '@glyphstudio/state';

function seedStore(overrides?: {
  primaryColor?: { r: number; g: number; b: number; a: number };
  recentColors?: Array<{ r: number; g: number; b: number; a: number }>;
  pinnedColors?: Array<{ r: number; g: number; b: number; a: number }>;
}) {
  useToolStore.setState({
    primaryColor: overrides?.primaryColor ?? { r: 255, g: 255, b: 255, a: 255 },
    secondaryColor: { r: 0, g: 0, b: 0, a: 255 },
    recentColors: overrides?.recentColors ?? [],
    pinnedColors: overrides?.pinnedColors ?? [],
  });
}

describe('QuickPaletteStrip', () => {
  afterEach(cleanup);

  it('renders the strip container', () => {
    seedStore();
    render(<QuickPaletteStrip />);
    expect(screen.getByTestId('quick-palette-strip')).toBeInTheDocument();
  });

  it('shows pin button always', () => {
    seedStore();
    render(<QuickPaletteStrip />);
    expect(screen.getByTestId('qps-pin-btn')).toBeInTheDocument();
  });

  describe('empty state', () => {
    it('shows only pin button with no recent or pinned', () => {
      seedStore();
      render(<QuickPaletteStrip />);
      expect(screen.queryByTestId('qps-recent')).toBeNull();
      expect(screen.queryByTestId('qps-pinned')).toBeNull();
    });
  });

  describe('recent colors', () => {
    it('shows recent section when recent colors exist', () => {
      seedStore({ recentColors: [{ r: 255, g: 0, b: 0, a: 255 }] });
      render(<QuickPaletteStrip />);
      expect(screen.getByTestId('qps-recent')).toBeInTheDocument();
    });

    it('renders one swatch per recent color', () => {
      seedStore({
        recentColors: [
          { r: 255, g: 0, b: 0, a: 255 },
          { r: 0, g: 255, b: 0, a: 255 },
        ],
      });
      render(<QuickPaletteStrip />);
      expect(screen.getByTestId('qps-recent-0')).toBeInTheDocument();
      expect(screen.getByTestId('qps-recent-1')).toBeInTheDocument();
    });

    it('clicking a recent swatch sets primary color', async () => {
      const user = userEvent.setup();
      seedStore({ recentColors: [{ r: 200, g: 100, b: 50, a: 255 }] });
      render(<QuickPaletteStrip />);
      await user.click(screen.getByTestId('qps-recent-0').querySelector('.qps-swatch')!);
      expect(useToolStore.getState().primaryColor).toEqual({ r: 200, g: 100, b: 50, a: 255 });
    });
  });

  describe('pinned colors', () => {
    it('shows pinned section when pins exist', () => {
      seedStore({ pinnedColors: [{ r: 128, g: 0, b: 255, a: 255 }] });
      render(<QuickPaletteStrip />);
      expect(screen.getByTestId('qps-pinned')).toBeInTheDocument();
    });

    it('renders one swatch per pinned color', () => {
      seedStore({
        pinnedColors: [
          { r: 10, g: 20, b: 30, a: 255 },
          { r: 40, g: 50, b: 60, a: 255 },
        ],
      });
      render(<QuickPaletteStrip />);
      expect(screen.getByTestId('qps-pinned-0')).toBeInTheDocument();
      expect(screen.getByTestId('qps-pinned-1')).toBeInTheDocument();
    });

    it('each pinned swatch has a remove button', () => {
      seedStore({ pinnedColors: [{ r: 10, g: 20, b: 30, a: 255 }] });
      render(<QuickPaletteStrip />);
      expect(screen.getByTestId('qps-pinned-0-remove')).toBeInTheDocument();
    });

    it('clicking remove button unpins the color', async () => {
      const user = userEvent.setup();
      seedStore({
        pinnedColors: [
          { r: 10, g: 20, b: 30, a: 255 },
          { r: 40, g: 50, b: 60, a: 255 },
        ],
      });
      render(<QuickPaletteStrip />);
      await user.click(screen.getByTestId('qps-pinned-0-remove'));
      expect(useToolStore.getState().pinnedColors).toHaveLength(1);
      expect(useToolStore.getState().pinnedColors[0].r).toBe(40);
    });

    it('clicking pin button pins current primary color', async () => {
      const user = userEvent.setup();
      seedStore({ primaryColor: { r: 77, g: 88, b: 99, a: 255 } });
      render(<QuickPaletteStrip />);
      await user.click(screen.getByTestId('qps-pin-btn'));
      expect(useToolStore.getState().pinnedColors).toHaveLength(1);
      expect(useToolStore.getState().pinnedColors[0]).toEqual({ r: 77, g: 88, b: 99, a: 255 });
    });

    it('clicking a pinned swatch sets primary color', async () => {
      const user = userEvent.setup();
      seedStore({ pinnedColors: [{ r: 11, g: 22, b: 33, a: 255 }] });
      render(<QuickPaletteStrip />);
      await user.click(screen.getByTestId('qps-pinned-0').querySelector('.qps-swatch')!);
      expect(useToolStore.getState().primaryColor).toEqual({ r: 11, g: 22, b: 33, a: 255 });
    });
  });

  describe('both sections', () => {
    it('shows both pinned and recent sections together', () => {
      seedStore({
        pinnedColors: [{ r: 1, g: 2, b: 3, a: 255 }],
        recentColors: [{ r: 4, g: 5, b: 6, a: 255 }],
      });
      render(<QuickPaletteStrip />);
      expect(screen.getByTestId('qps-pinned')).toBeInTheDocument();
      expect(screen.getByTestId('qps-recent')).toBeInTheDocument();
    });
  });
});
