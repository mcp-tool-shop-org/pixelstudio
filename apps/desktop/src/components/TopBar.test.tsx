import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from '../components/TopBar';
import { useProjectStore } from '@pixelstudio/state';

function seed(overrides: Partial<ReturnType<typeof useProjectStore.getState>> = {}) {
  useProjectStore.setState({
    projectId: 'proj-1',
    name: 'Untitled',
    filePath: null,
    isDirty: false,
    saveStatus: 'idle',
    colorMode: 'rgb',
    canvasWidth: 64,
    canvasHeight: 64,
    ...overrides,
  });
}

describe('TopBar', () => {
  afterEach(cleanup);

  describe('rendering', () => {
    it('shows PixelStudio title', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('PixelStudio')).toBeInTheDocument();
    });

    it('shows project name when no filePath', () => {
      seed({ name: 'My Sprite' });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('My Sprite')).toBeInTheDocument();
    });

    it('shows filename from filePath without .pxs extension', () => {
      seed({ filePath: 'C:\\Users\\me\\docs\\hero.pxs' });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('hero')).toBeInTheDocument();
    });

    it('shows dirty indicator when isDirty', () => {
      seed({ name: 'Test', isDirty: true });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText(/Test\s*\u2022/)).toBeInTheDocument();
    });

    it('shows no dirty indicator when clean', () => {
      seed({ name: 'Test', isDirty: false });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('Test')).toBeInTheDocument();
      expect(screen.queryByText(/\u2022/)).toBeNull();
    });

    it('shows Saving... badge', () => {
      seed({ saveStatus: 'saving' });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('Saving...')).toBeInTheDocument();
    });

    it('shows Saved badge', () => {
      seed({ saveStatus: 'saved' });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('Saved')).toBeInTheDocument();
    });

    it('shows Save Error badge', () => {
      seed({ saveStatus: 'error' });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('Save Error')).toBeInTheDocument();
    });
  });

  describe('mode tabs', () => {
    it('renders all 8 mode tabs', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      const modeLabels = ['Edit', 'Animate', 'Palette', 'AI Assist', 'Locomotion', 'Validate', 'Export', 'Scene'];
      modeLabels.forEach((label) => {
        expect(screen.getByText(label)).toBeInTheDocument();
      });
    });

    it('active mode tab has active class', () => {
      seed();
      render(<TopBar activeMode="locomotion" onModeChange={vi.fn()} />);
      expect(screen.getByText('Locomotion').className).toContain('active');
    });

    it('non-active mode tabs lack active class', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('Animate').className).not.toContain('active');
    });

    it('clicking mode tab calls onModeChange', async () => {
      seed();
      const onModeChange = vi.fn();
      render(<TopBar activeMode="edit" onModeChange={onModeChange} />);
      await act(async () => {
        await userEvent.click(screen.getByText('Scene'));
      });
      expect(onModeChange).toHaveBeenCalledWith('scene');
    });

    it('clicking multiple mode tabs fires correct mode ids', async () => {
      seed();
      const onModeChange = vi.fn();
      render(<TopBar activeMode="edit" onModeChange={onModeChange} />);
      await act(async () => {
        await userEvent.click(screen.getByText('Export'));
      });
      await act(async () => {
        await userEvent.click(screen.getByText('AI Assist'));
      });
      expect(onModeChange).toHaveBeenCalledWith('export');
      expect(onModeChange).toHaveBeenCalledWith('ai');
    });
  });

  describe('static badges', () => {
    it('shows RGB badge', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('RGB')).toBeInTheDocument();
    });

    it('shows Valid badge', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('Valid')).toBeInTheDocument();
    });
  });
});
