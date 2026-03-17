import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ShortcutHelpOverlay } from './ShortcutHelpOverlay';

afterEach(cleanup);

describe('ShortcutHelpOverlay', () => {
  describe('visibility', () => {
    it('renders nothing when isOpen=false', () => {
      render(<ShortcutHelpOverlay isOpen={false} onClose={vi.fn()} />);
      expect(screen.queryByTestId('shortcut-overlay')).toBeNull();
    });

    it('renders overlay when isOpen=true', () => {
      render(<ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByTestId('shortcut-overlay')).toBeInTheDocument();
    });

    it('shows "Keyboard Shortcuts" heading', () => {
      render(<ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
    });
  });

  describe('content', () => {
    it('shows section headings', () => {
      render(<ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('Tools')).toBeInTheDocument();
      expect(screen.getByText('History')).toBeInTheDocument();
      expect(screen.getByText('File')).toBeInTheDocument();
      expect(screen.getByText('Canvas')).toBeInTheDocument();
    });

    it('shows tool shortcuts', () => {
      render(<ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('B')).toBeInTheDocument();
      expect(screen.getByText('Pencil')).toBeInTheDocument();
      expect(screen.getByText('E')).toBeInTheDocument();
      expect(screen.getByText('Eraser')).toBeInTheDocument();
    });

    it('shows Ctrl+S shortcut', () => {
      render(<ShortcutHelpOverlay isOpen={true} onClose={vi.fn()} />);
      expect(screen.getByText('Ctrl+S')).toBeInTheDocument();
    });
  });

  describe('closing', () => {
    it('close button calls onClose', async () => {
      const onClose = vi.fn();
      render(<ShortcutHelpOverlay isOpen={true} onClose={onClose} />);
      await act(async () => { await userEvent.click(screen.getByTestId('shortcut-overlay-close')); });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('clicking backdrop calls onClose', async () => {
      const onClose = vi.fn();
      render(<ShortcutHelpOverlay isOpen={true} onClose={onClose} />);
      await act(async () => { await userEvent.click(screen.getByTestId('shortcut-overlay-backdrop')); });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('clicking inside overlay does not call onClose', async () => {
      const onClose = vi.fn();
      render(<ShortcutHelpOverlay isOpen={true} onClose={onClose} />);
      await act(async () => { await userEvent.click(screen.getByTestId('shortcut-overlay')); });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('Escape key calls onClose', async () => {
      const onClose = vi.fn();
      render(<ShortcutHelpOverlay isOpen={true} onClose={onClose} />);
      await act(async () => { await userEvent.keyboard('{Escape}'); });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('Escape does not fire when isOpen=false', async () => {
      const onClose = vi.fn();
      render(<ShortcutHelpOverlay isOpen={false} onClose={onClose} />);
      await act(async () => { await userEvent.keyboard('{Escape}'); });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
