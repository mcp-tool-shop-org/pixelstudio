import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ProjectHome } from '../components/ProjectHome';

describe('ProjectHome', () => {
  afterEach(cleanup);

  describe('rendering', () => {
    it('shows PixelStudio title', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('PixelStudio')).toBeInTheDocument();
    });

    it('shows tagline', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText(/Build sprites with deterministic tools/)).toBeInTheDocument();
    });

    it('shows New Project button', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('New Project')).toBeInTheDocument();
    });

    it('shows Open Project button', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('Open Project')).toBeInTheDocument();
    });

    it('shows Recent Projects section', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('Recent Projects')).toBeInTheDocument();
      expect(screen.getByText('No recent projects')).toBeInTheDocument();
    });

    it('shows Templates section', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('Templates')).toBeInTheDocument();
    });

    it('renders all 4 template cards', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('Blank Sprite')).toBeInTheDocument();
      expect(screen.getByText('Character Animation')).toBeInTheDocument();
      expect(screen.getByText('Modular Character Kit')).toBeInTheDocument();
      expect(screen.getByText('Faction Palette Study')).toBeInTheDocument();
    });

    it('template cards show descriptions', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('64×64, RGB')).toBeInTheDocument();
      expect(screen.getByText('64×64, 8 frames')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('clicking New Project calls onEnterWorkspace', async () => {
      const onEnter = vi.fn();
      render(<ProjectHome onEnterWorkspace={onEnter} />);
      await act(async () => {
        await userEvent.click(screen.getByText('New Project'));
      });
      expect(onEnter).toHaveBeenCalledOnce();
    });

    it('clicking Open Project calls onEnterWorkspace', async () => {
      const onEnter = vi.fn();
      render(<ProjectHome onEnterWorkspace={onEnter} />);
      await act(async () => {
        await userEvent.click(screen.getByText('Open Project'));
      });
      expect(onEnter).toHaveBeenCalledOnce();
    });

    it('clicking a template card calls onEnterWorkspace', async () => {
      const onEnter = vi.fn();
      render(<ProjectHome onEnterWorkspace={onEnter} />);
      await act(async () => {
        await userEvent.click(screen.getByText('Blank Sprite'));
      });
      expect(onEnter).toHaveBeenCalledOnce();
    });

    it('clicking different templates each fire onEnterWorkspace', async () => {
      const onEnter = vi.fn();
      render(<ProjectHome onEnterWorkspace={onEnter} />);
      await act(async () => {
        await userEvent.click(screen.getByText('Character Animation'));
      });
      await act(async () => {
        await userEvent.click(screen.getByText('Modular Character Kit'));
      });
      expect(onEnter).toHaveBeenCalledTimes(2);
    });
  });
});
