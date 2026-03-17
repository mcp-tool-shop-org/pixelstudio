import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { OutputPresetsPanel } from './OutputPresetsPanel';
import { useProjectStore } from '@glyphstudio/state';

// ── Tauri mocks ─────────────────────────────────────────────────────────────

let saveMockValue: string | null = '/tmp/output/sprite.png';
vi.mock('@tauri-apps/plugin-dialog', () => ({
  save: vi.fn(() => Promise.resolve(saveMockValue)),
}));

const EXPORT_RESULT = {
  files: [{ path: '/tmp/output/sprite.png', width: 16, height: 16 }],
  frame_count: 1,
  was_suffixed: false,
  warnings: [],
};

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn((_cmd: string) => Promise.resolve(EXPORT_RESULT)),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function seedStore(name?: string) {
  useProjectStore.setState({ projectName: name ?? 'my_sprite' } as never);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('OutputPresetsPanel', () => {
  beforeEach(async () => {
    saveMockValue = '/tmp/output/sprite.png';
    seedStore();
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockClear();
  });

  afterEach(cleanup);

  it('renders all four preset buttons', () => {
    render(<OutputPresetsPanel />);
    expect(screen.getByTestId('preset-btn-static_sprite')).toBeInTheDocument();
    expect(screen.getByTestId('preset-btn-horizontal_strip')).toBeInTheDocument();
    expect(screen.getByTestId('preset-btn-sprite_sheet')).toBeInTheDocument();
    expect(screen.getByTestId('preset-btn-portrait_crop')).toBeInTheDocument();
  });

  it('clicking Static Sprite invokes export_preset with static_sprite', async () => {
    render(<OutputPresetsPanel />);
    const { invoke } = await import('@tauri-apps/api/core');
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-static_sprite'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    const exportCall = calls.find(([cmd]: [string]) => cmd === 'export_preset');
    expect(exportCall).toBeDefined();
    expect((exportCall[1] as { preset: string }).preset).toBe('static_sprite');
  });

  it('clicking H. Strip invokes export_preset with horizontal_strip', async () => {
    render(<OutputPresetsPanel />);
    const { invoke } = await import('@tauri-apps/api/core');
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-horizontal_strip'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    const exportCall = calls.find(([cmd]: [string]) => cmd === 'export_preset');
    expect((exportCall[1] as { preset: string }).preset).toBe('horizontal_strip');
  });

  it('clicking Sprite Sheet invokes export_preset with sprite_sheet', async () => {
    render(<OutputPresetsPanel />);
    const { invoke } = await import('@tauri-apps/api/core');
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-sprite_sheet'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    const exportCall = calls.find(([cmd]: [string]) => cmd === 'export_preset');
    expect((exportCall[1] as { preset: string }).preset).toBe('sprite_sheet');
  });

  it('clicking Portrait Crop invokes export_preset with portrait_crop', async () => {
    render(<OutputPresetsPanel />);
    const { invoke } = await import('@tauri-apps/api/core');
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-portrait_crop'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    const exportCall = calls.find(([cmd]: [string]) => cmd === 'export_preset');
    expect((exportCall[1] as { preset: string }).preset).toBe('portrait_crop');
  });

  it('shows success result after export', async () => {
    render(<OutputPresetsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-static_sprite'));
    });
    expect(screen.getByTestId('preset-result-static_sprite')).toBeInTheDocument();
    expect(screen.getByTestId('preset-result-static_sprite').textContent).toContain('16×16');
  });

  it('cancelling the dialog does not invoke export_preset', async () => {
    saveMockValue = null;
    render(<OutputPresetsPanel />);
    const { invoke } = await import('@tauri-apps/api/core');
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-static_sprite'));
    });
    const calls = (invoke as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.some(([cmd]: [string]) => cmd === 'export_preset')).toBe(false);
  });

  it('shows error result when export fails', async () => {
    const { invoke } = await import('@tauri-apps/api/core');
    (invoke as ReturnType<typeof vi.fn>).mockImplementationOnce((_cmd: string) =>
      Promise.reject(new Error('disk full')),
    );
    render(<OutputPresetsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-static_sprite'));
    });
    const result = screen.getByTestId('preset-result-static_sprite');
    expect(result.textContent).toContain('Error');
    expect(result.className).toContain('error');
  });

  it('buttons re-enable after export completes', async () => {
    render(<OutputPresetsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('preset-btn-static_sprite'));
    });
    // After export finishes all buttons should be enabled again
    expect(screen.getByTestId('preset-btn-horizontal_strip')).not.toBeDisabled();
    expect(screen.getByTestId('preset-btn-sprite_sheet')).not.toBeDisabled();
  });
});
