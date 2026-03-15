import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTimelineStore, useProjectStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { ClipInfo } from '@glyphstudio/domain';

import { ClipPanel } from '../components/ClipPanel';

const CLIP_A: ClipInfo = {
  id: 'c1',
  name: 'Idle',
  startFrame: 0,
  endFrame: 3,
  frameCount: 4,
  loopClip: true,
  validity: 'valid',
  warnings: [],
  fpsOverride: null,
  pivot: null,
  tags: ['idle'],
};

const CLIP_B: ClipInfo = {
  id: 'c2',
  name: 'Walk',
  startFrame: 4,
  endFrame: 7,
  frameCount: 4,
  loopClip: false,
  validity: 'warning',
  warnings: ['Range extends past last frame'],
  fpsOverride: 24,
  pivot: { mode: 'center', customPoint: null },
  tags: [],
};

const CLIP_INVALID: ClipInfo = {
  id: 'c3',
  name: 'Bad',
  startFrame: 10,
  endFrame: 5,
  frameCount: 0,
  loopClip: false,
  validity: 'invalid',
  warnings: ['End before start'],
  fpsOverride: null,
  pivot: null,
  tags: [],
};

function seedStores() {
  useTimelineStore.setState({
    frames: Array.from({ length: 8 }, (_, i) => ({
      id: `f${i}`, name: `Frame ${i + 1}`, index: i, durationMs: null,
    })),
    activeFrameId: 'f0',
    activeFrameIndex: 0,
    fps: 8,
    playing: false,
    loop: true,
    onionSkinEnabled: false,
    onionSkinShowPrev: true,
    onionSkinShowNext: false,
  });
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: null, isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 32, height: 32 },
  });
}

describe('ClipPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('list_clips', () => []);
  });

  afterEach(() => {
    cleanup();
  });

  // ── Empty state ──

  it('shows empty state when no clips', async () => {
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByText('No clips defined')).toBeInTheDocument();
  });

  it('shows Clips title', async () => {
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByText('Clips')).toBeInTheDocument();
  });

  it('shows + Clip button', async () => {
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByText('+ Clip')).toBeInTheDocument();
  });

  // ── Create clip ──

  it('create clip invokes create_clip when prompt returns a name', async () => {
    seedStores();
    window.prompt = vi.fn(() => 'Run');
    mock.on('create_clip', () => ({ id: 'c4', name: 'Run', startFrame: 0, endFrame: 7, frameCount: 8, loopClip: false, validity: 'valid', warnings: [], fpsOverride: null, pivot: null, tags: [] }));
    await act(async () => { render(<ClipPanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText('+ Clip'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('create_clip');
  });

  it('create clip does nothing when prompt is cancelled', async () => {
    seedStores();
    window.prompt = vi.fn(() => null);
    await act(async () => { render(<ClipPanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText('+ Clip'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).not.toContain('create_clip');
  });

  // ── Clip list rendering ──

  it('renders clip names', async () => {
    mock.on('list_clips', () => [CLIP_A, CLIP_B]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByText('Idle')).toBeInTheDocument();
    expect(screen.getByText('Walk')).toBeInTheDocument();
  });

  it('shows frame range in 1-indexed format', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByText('1–4 (4f)')).toBeInTheDocument();
  });

  it('shows loop badge for looping clips', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByText('\u21BB')).toBeInTheDocument();
  });

  // ── Validity badges ──

  it('shows valid badge ✓', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByTitle('Valid')).toBeInTheDocument();
  });

  it('shows warning badge ⚠', async () => {
    mock.on('list_clips', () => [CLIP_B]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByTitle('Has warnings')).toBeInTheDocument();
  });

  it('shows invalid badge ✗', async () => {
    mock.on('list_clips', () => [CLIP_INVALID]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(screen.getByTitle('Invalid range')).toBeInTheDocument();
  });

  // ── Selected clip actions ──

  it('clicking a clip shows action buttons', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => {
      await userEvent.click(screen.getByText('Idle'));
    });
    expect(screen.getByText('Rename')).toBeInTheDocument();
    expect(screen.getByText('Edit Range')).toBeInTheDocument();
    expect(screen.getByText('Loop')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
  });

  it('delete invokes delete_clip', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    mock.on('delete_clip', () => undefined);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Idle')); });
    await act(async () => { await userEvent.click(screen.getByText('Delete')); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('delete_clip');
  });

  it('loop toggle invokes update_clip', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    mock.on('update_clip', () => ({ ...CLIP_A, loopClip: false }));
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Idle')); });
    await act(async () => { await userEvent.click(screen.getByText('Loop')); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('update_clip');
  });

  it('rename invokes update_clip when prompt returns new name', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    mock.on('update_clip', () => ({ ...CLIP_A, name: 'Sprint' }));
    window.prompt = vi.fn(() => 'Sprint');
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Idle')); });
    await act(async () => { await userEvent.click(screen.getByText('Rename')); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('update_clip');
  });

  // ── Warnings display ──

  it('shows clip warnings when selected', async () => {
    mock.on('list_clips', () => [CLIP_B]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Walk')); });
    expect(screen.getByText('Range extends past last frame')).toBeInTheDocument();
  });

  it('shows fps override when present', async () => {
    mock.on('list_clips', () => [CLIP_B]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Walk')); });
    expect(screen.getByText('24 fps override')).toBeInTheDocument();
  });

  // ── Pivot editor ──

  it('shows pivot section with current mode', async () => {
    mock.on('list_clips', () => [CLIP_B]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Walk')); });
    expect(screen.getByText(/Pivot: Center/)).toBeInTheDocument();
  });

  it('pivot center button invokes set_clip_pivot', async () => {
    mock.on('list_clips', () => [CLIP_A]); // CLIP_A has no pivot
    mock.on('set_clip_pivot', () => ({ ...CLIP_A, pivot: { mode: 'center', customPoint: null } }));
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Idle')); });
    await act(async () => { await userEvent.click(screen.getByText('Center')); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('set_clip_pivot');
  });

  // ── Tag editor ──

  it('shows existing tags as chips', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Idle')); });
    expect(screen.getByText('idle')).toBeInTheDocument();
    expect(screen.getByText('Tags (1)')).toBeInTheDocument();
  });

  it('shows "No tags" for clip without tags', async () => {
    mock.on('list_clips', () => [CLIP_B]);
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Walk')); });
    expect(screen.getByText('No tags')).toBeInTheDocument();
  });

  it('shows quick tag buttons for unset tags', async () => {
    mock.on('list_clips', () => [CLIP_B]); // CLIP_B has no tags
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Walk')); });
    // Quick tags include +idle, +walk, etc.
    expect(screen.getByText('+idle')).toBeInTheDocument();
    expect(screen.getByText('+walk')).toBeInTheDocument();
  });

  it('quick tag click invokes add_clip_tag', async () => {
    mock.on('list_clips', () => [CLIP_B]);
    mock.on('add_clip_tag', () => ({ ...CLIP_B, tags: ['idle'] }));
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Walk')); });
    await act(async () => { await userEvent.click(screen.getByText('+idle')); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('add_clip_tag');
  });

  it('tag remove button invokes remove_clip_tag', async () => {
    mock.on('list_clips', () => [CLIP_A]);
    mock.on('remove_clip_tag', () => ({ ...CLIP_A, tags: [] }));
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Idle')); });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Remove "idle"'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('remove_clip_tag');
  });

  // ── Backend calls ──

  it('calls list_clips on mount', async () => {
    seedStores();
    await act(async () => { render(<ClipPanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('list_clips');
  });
});
