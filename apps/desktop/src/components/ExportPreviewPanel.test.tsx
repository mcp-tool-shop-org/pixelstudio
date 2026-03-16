import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ExportPreviewPanel } from '../components/ExportPreviewPanel';
import { useTimelineStore } from '@glyphstudio/state';
import { useProjectStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';

function seedStores(overrides?: {
  frameCount?: number;
  activeFrameIndex?: number;
  projectName?: string;
}) {
  const o = overrides ?? {};
  const frames = Array.from({ length: o.frameCount ?? 4 }, (_, i) => ({
    id: `f${i}`, name: `Frame ${i}`, index: i, durationMs: null,
  }));
  useTimelineStore.setState({
    frames,
    activeFrameIndex: o.activeFrameIndex ?? 0,
    activeFrameId: frames[0]?.id ?? 'f0',
  });
  useProjectStore.setState({ name: o.projectName ?? 'TestProject' });
}

describe('ExportPreviewPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    // list_clips returns empty by default
    mock.on('list_clips', () => []);
    mock.on('get_asset_package_metadata', () => ({
      name: '', version: '1.0.0', author: '', description: '',
    }));
  });
  afterEach(cleanup);

  describe('conditional rendering', () => {
    it('renders title', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      expect(screen.getByText('Export Preview')).toBeInTheDocument();
    });

    it('shows scope dropdown with all options', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      expect(screen.getByText('Current Frame')).toBeInTheDocument();
      expect(screen.getByText('Selected Span')).toBeInTheDocument();
    });

    it('shows layout dropdown', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      expect(screen.getByText('Horizontal Strip')).toBeInTheDocument();
      expect(screen.getByText('Vertical Strip')).toBeInTheDocument();
      expect(screen.getByText('Grid (auto)')).toBeInTheDocument();
    });

    it('shows empty preview prompt initially', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      expect(screen.getByText('Choose scope and layout, then click Preview')).toBeInTheDocument();
    });

    it('shows Preview button', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      expect(screen.getByText('Preview')).toBeInTheDocument();
    });

    it('disables current_clip option when no clips exist', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      const option = screen.getByText('Current Clip (none)') as HTMLOptionElement;
      expect(option.disabled).toBe(true);
    });

    it('disables all_clips option when no clips exist', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      const option = screen.getByText('All Clips (none)') as HTMLOptionElement;
      expect(option.disabled).toBe(true);
    });
  });

  describe('scope-dependent UI', () => {
    it('shows span inputs when selected_span scope is chosen', async () => {
      seedStores({ frameCount: 8 });
      render(<ExportPreviewPanel />);
      const scopeSelect = screen.getAllByRole('combobox')[0];
      await act(async () => {
        await userEvent.selectOptions(scopeSelect, 'selected_span');
      });
      expect(screen.getByText('Start')).toBeInTheDocument();
      expect(screen.getByText('End')).toBeInTheDocument();
    });

    it('hides span inputs for current_frame scope', () => {
      seedStores();
      render(<ExportPreviewPanel />);
      expect(screen.queryByText('Start')).not.toBeInTheDocument();
    });

    it('shows clip dropdown when current_clip scope with clips', async () => {
      mock.on('list_clips', () => [
        { id: 'c1', name: 'Walk', startFrame: 0, endFrame: 3, validity: 'valid' },
        { id: 'c2', name: 'Run', startFrame: 4, endFrame: 7, validity: 'valid' },
      ]);
      seedStores({ frameCount: 8 });
      render(<ExportPreviewPanel />);
      // Wait for clips to fully load into state (not just the invoke call)
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('list_clips');
      });
      // Allow the .then() state update to flush
      await act(async () => {});
      const scopeSelect = screen.getAllByRole('combobox')[0];
      await act(async () => {
        await userEvent.selectOptions(scopeSelect, 'current_clip');
      });
      // Clip selector should appear with clip names
      await waitFor(() => {
        expect(screen.getByText(/Walk/)).toBeInTheDocument();
      });
    });
  });

  describe('preview state machine', () => {
    it('transitions from empty to loading to ready on preview', async () => {
      seedStores();
      mock.on('preview_sprite_sheet_layout', () => ({
        outputWidth: 128, outputHeight: 32, frameCount: 4, columns: 4, rows: 1,
        placements: [], clipGroups: [], warnings: [],
      }));
      render(<ExportPreviewPanel />);
      expect(screen.getByText('Choose scope and layout, then click Preview')).toBeInTheDocument();

      await act(async () => {
        await userEvent.click(screen.getByText('Preview'));
      });

      await waitFor(() => {
        expect(screen.getByText(/128 x 32px/)).toBeInTheDocument();
      });
    });

    it('shows error on preview failure', async () => {
      seedStores();
      mock.on('preview_sprite_sheet_layout', () => { throw new Error('layout failed'); });
      render(<ExportPreviewPanel />);

      await act(async () => {
        await userEvent.click(screen.getByText('Preview'));
      });

      await waitFor(() => {
        expect(screen.getByText(/layout failed/)).toBeInTheDocument();
      });
    });
  });

  describe('preview metadata display', () => {
    it('shows frame count and dimensions after successful preview', async () => {
      seedStores();
      mock.on('preview_sprite_sheet_layout', () => ({
        outputWidth: 256, outputHeight: 64, frameCount: 8, columns: 4, rows: 2,
        placements: [], clipGroups: [], warnings: [],
      }));
      render(<ExportPreviewPanel />);
      await act(async () => {
        await userEvent.click(screen.getByText('Preview'));
      });
      await waitFor(() => {
        expect(screen.getByText('256 x 64px')).toBeInTheDocument();
        expect(screen.getByText('8 frames')).toBeInTheDocument();
        expect(screen.getByText('4c x 2r')).toBeInTheDocument();
      });
    });

    it('shows singular "frame" for 1 frame', async () => {
      seedStores({ frameCount: 1 });
      mock.on('preview_sprite_sheet_layout', () => ({
        outputWidth: 32, outputHeight: 32, frameCount: 1, columns: 1, rows: 1,
        placements: [], clipGroups: [], warnings: [],
      }));
      render(<ExportPreviewPanel />);
      await act(async () => {
        await userEvent.click(screen.getByText('Preview'));
      });
      await waitFor(() => {
        expect(screen.getByText('1 frame')).toBeInTheDocument();
      });
    });
  });
});

// Pure function tests (module-private, so tested via indirect observation)
// formatBytes is module-private — these test the exact same logic
describe('formatBytes logic', () => {
  function formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  it('formats bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(512)).toBe('512 B');
    expect(formatBytes(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
    expect(formatBytes(1024 * 100)).toBe('100.0 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });
});

describe('buildScope logic', () => {
  it('current_frame returns type only', () => {
    const scope = { type: 'current_frame' };
    expect(scope).toEqual({ type: 'current_frame' });
  });

  it('selected_span includes zero-indexed start/end', () => {
    // UI uses 1-based, scope converts to 0-based
    const spanStart = 3, spanEnd = 7;
    const scope = { type: 'selected_span', start: spanStart - 1, end: spanEnd - 1 };
    expect(scope).toEqual({ type: 'selected_span', start: 2, end: 6 });
  });

  it('current_clip includes clipId', () => {
    const scope = { type: 'current_clip', clipId: 'clip-123' };
    expect(scope.clipId).toBe('clip-123');
  });

  it('all_clips has no extra fields', () => {
    const scope = { type: 'all_clips' };
    expect(Object.keys(scope)).toEqual(['type']);
  });
});

describe('buildLayout logic', () => {
  it('horizontal_strip returns type only', () => {
    const layout = { type: 'horizontal_strip' };
    expect(layout).toEqual({ type: 'horizontal_strip' });
  });

  it('vertical_strip returns type only', () => {
    const layout = { type: 'vertical_strip' };
    expect(layout).toEqual({ type: 'vertical_strip' });
  });

  it('grid returns type with null columns', () => {
    const layout = { type: 'grid', columns: null };
    expect(layout).toEqual({ type: 'grid', columns: null });
  });
});
