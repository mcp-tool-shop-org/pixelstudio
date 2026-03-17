import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TopBar } from '../components/TopBar';
import { useProjectStore } from '@glyphstudio/state';

function seed(overrides: Partial<ReturnType<typeof useProjectStore.getState>> = {}) {
  useProjectStore.setState({
    projectId: 'proj-1',
    name: 'Untitled',
    filePath: null,
    isDirty: false,
    saveStatus: 'idle',
    colorMode: 'rgb',
    canvasSize: { width: 64, height: 64 },
    ...overrides,
  });
}

describe('TopBar', () => {
  afterEach(cleanup);

  describe('rendering', () => {
    it('shows GlyphStudio title', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.getByText('GlyphStudio')).toBeInTheDocument();
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
    it('renders all 9 mode tabs', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      const modeLabels = ['Edit', 'Animate', 'Palette', 'AI Assist', 'Locomotion', 'Validate', 'Export', 'Scene', 'Vector'];
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

  describe('controls area', () => {
    it('does not show hardcoded RGB badge', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.queryByText('RGB')).toBeNull();
    });

    it('does not show hardcoded Valid badge', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.queryByText('Valid')).toBeNull();
    });

    it('does not show help button when onShowHelp is not provided', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.queryByTestId('topbar-help-btn')).toBeNull();
    });

    it('shows help button when onShowHelp is provided', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onShowHelp={vi.fn()} />);
      expect(screen.getByTestId('topbar-help-btn')).toBeInTheDocument();
    });

    it('clicking help button calls onShowHelp', async () => {
      seed();
      const onShowHelp = vi.fn();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onShowHelp={onShowHelp} />);
      await act(async () => { await userEvent.click(screen.getByTestId('topbar-help-btn')); });
      expect(onShowHelp).toHaveBeenCalledOnce();
    });

    it('does not show save button when onSave is not provided', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} />);
      expect(screen.queryByTestId('topbar-save-btn')).toBeNull();
    });

    it('shows save button when onSave is provided', () => {
      seed();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByTestId('topbar-save-btn')).toBeInTheDocument();
    });

    it('save button shows "Save" when filePath is set', () => {
      seed({ filePath: 'C:\\projects\\hero.pxs' });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByTestId('topbar-save-btn')).toHaveTextContent('Save');
    });

    it('save button shows "Save As…" when no filePath', () => {
      seed({ filePath: null });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByTestId('topbar-save-btn')).toHaveTextContent('Save As\u2026');
    });

    it('clicking save button calls onSave', async () => {
      seed();
      const onSave = vi.fn();
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onSave={onSave} />);
      await act(async () => { await userEvent.click(screen.getByTestId('topbar-save-btn')); });
      expect(onSave).toHaveBeenCalledOnce();
    });

    it('save button has dirty class when isDirty', () => {
      seed({ isDirty: true });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByTestId('topbar-save-btn').className).toContain('dirty');
    });

    it('save button lacks dirty class when not isDirty', () => {
      seed({ isDirty: false });
      render(<TopBar activeMode="edit" onModeChange={vi.fn()} onSave={vi.fn()} />);
      expect(screen.getByTestId('topbar-save-btn').className).not.toContain('dirty');
    });
  });
});
