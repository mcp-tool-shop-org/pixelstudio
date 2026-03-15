import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useAnchorStore, useSelectionStore, useTimelineStore, useProjectStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { Anchor } from '@pixelstudio/domain';

import { AnchorPanel } from '../components/AnchorPanel';

const ANCHOR_HEAD: Anchor = {
  id: 'a1', name: 'head_0', kind: 'head', x: 16, y: 4,
  bounds: null, parentName: null, falloffWeight: 1.0,
};

const ANCHOR_TORSO: Anchor = {
  id: 'a2', name: 'torso_0', kind: 'torso', x: 16, y: 16,
  bounds: { x: 12, y: 12, width: 8, height: 8 }, parentName: null, falloffWeight: 1.0,
};

const ANCHOR_ARM: Anchor = {
  id: 'a3', name: 'arm_left_0', kind: 'arm_left', x: 8, y: 12,
  bounds: null, parentName: 'torso_0', falloffWeight: 0.8,
};

function seedStores() {
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: null, isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 32, height: 32 },
  });
  useTimelineStore.setState({
    frames: [
      { id: 'f0', name: 'Frame 1', index: 0, durationMs: null },
      { id: 'f1', name: 'Frame 2', index: 1, durationMs: null },
    ],
    activeFrameId: 'f0',
    activeFrameIndex: 0,
    fps: 8,
    playing: false,
    loop: true,
    onionSkinEnabled: false,
    onionSkinShowPrev: true,
    onionSkinShowNext: false,
  });
  useSelectionStore.setState({
    hasSelection: false, isTransforming: false, selectionBounds: null,
  });
  useAnchorStore.getState().reset();
}

function toResult(a: Anchor) {
  return {
    id: a.id, name: a.name, kind: a.kind, x: a.x, y: a.y,
    bounds: a.bounds, parentName: a.parentName, falloffWeight: a.falloffWeight ?? 1.0,
  };
}

describe('AnchorPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('list_anchors', () => []);
    mock.on('mark_dirty', () => undefined);
  });

  afterEach(() => {
    cleanup();
    useAnchorStore.getState().reset();
  });

  // ── Empty state ──

  it('shows empty message when no anchors', async () => {
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByText('No anchors on this frame')).toBeInTheDocument();
    });
  });

  it('shows Anchors title', async () => {
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    expect(screen.getByText('Anchors')).toBeInTheDocument();
  });

  it('shows kind select and + button', async () => {
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    expect(screen.getByTitle('Add anchor')).toBeInTheDocument();
    // Kind select with default "Custom"
    const select = document.querySelector('.anchor-kind-select') as HTMLSelectElement;
    expect(select).not.toBeNull();
    expect(select.value).toBe('custom');
  });

  it('overlay toggle is present', async () => {
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    const overlayBtn = screen.getByTitle(/anchor overlay/);
    expect(overlayBtn).toBeInTheDocument();
  });

  // ── Create anchor ──

  it('add button invokes create_anchor with selected kind', async () => {
    seedStores();
    mock.on('create_anchor', () => toResult(ANCHOR_HEAD));
    await act(async () => { render(<AnchorPanel />); });
    // Change kind to 'head'
    const select = document.querySelector('.anchor-kind-select') as HTMLSelectElement;
    await act(async () => {
      await userEvent.selectOptions(select, 'head');
    });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Add anchor'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('create_anchor');
  });

  // ── With anchors ──

  it('renders anchor names from backend', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD), toResult(ANCHOR_TORSO)]);
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByDisplayValue('head_0')).toBeInTheDocument();
      expect(screen.getByDisplayValue('torso_0')).toBeInTheDocument();
    });
  });

  it('shows coordinates for each anchor', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByText('(16, 4)')).toBeInTheDocument();
    });
  });

  it('shows bound region indicator for anchors with bounds', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_TORSO)]);
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByTitle('Has bound region')).toBeInTheDocument();
    });
  });

  it('shows parent badge for child anchors', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_TORSO), toResult(ANCHOR_ARM)]);
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByTitle('Child of torso_0')).toBeInTheDocument();
    });
  });

  // ── Selection ──

  it('clicking an anchor selects it', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => { expect(screen.getByDisplayValue('head_0')).toBeInTheDocument(); });
    const item = document.querySelector('.anchor-item') as HTMLElement;
    await act(async () => { await userEvent.click(item); });
    expect(useAnchorStore.getState().selectedAnchorId).toBe('a1');
  });

  it('clicking selected anchor deselects it', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    useAnchorStore.setState({ selectedAnchorId: 'a1' });
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => { expect(screen.getByDisplayValue('head_0')).toBeInTheDocument(); });
    const item = document.querySelector('.anchor-item') as HTMLElement;
    await act(async () => { await userEvent.click(item); });
    expect(useAnchorStore.getState().selectedAnchorId).toBeNull();
  });

  // ── Delete ──

  it('delete button invokes delete_anchor', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    mock.on('delete_anchor', () => undefined);
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => { expect(screen.getByDisplayValue('head_0')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Delete anchor'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('delete_anchor');
  });

  // ── Binding area (selected anchor) ──

  it('shows binding area when anchor is selected', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    useAnchorStore.setState({
      anchors: [ANCHOR_HEAD],
      selectedAnchorId: 'a1',
    });
    await act(async () => { render(<AnchorPanel />); });
    expect(screen.getByText('Bind Selection')).toBeInTheDocument();
    expect(screen.getByText(/Region:.*None/)).toBeInTheDocument();
  });

  it('bind selection disabled when no selection exists', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    useAnchorStore.setState({
      anchors: [ANCHOR_HEAD],
      selectedAnchorId: 'a1',
    });
    await act(async () => { render(<AnchorPanel />); });
    expect(screen.getByText('Bind Selection')).toBeDisabled();
  });

  it('shows region dimensions when anchor has bounds', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_TORSO)]);
    seedStores();
    useAnchorStore.setState({
      anchors: [ANCHOR_TORSO],
      selectedAnchorId: 'a2',
    });
    await act(async () => { render(<AnchorPanel />); });
    expect(screen.getByText(/8\u00D78 at \(12, 12\)/)).toBeInTheDocument();
  });

  // ── Hierarchy ──

  it('shows parent dropdown for selected anchor', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_TORSO), toResult(ANCHOR_ARM)]);
    seedStores();
    useAnchorStore.setState({
      anchors: [ANCHOR_TORSO, ANCHOR_ARM],
      selectedAnchorId: 'a3',
    });
    await act(async () => { render(<AnchorPanel />); });
    const parentSelect = document.querySelector('.anchor-parent-select') as HTMLSelectElement;
    expect(parentSelect).not.toBeNull();
    expect(parentSelect.value).toBe('torso_0');
  });

  it('shows falloff slider for selected anchor', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_ARM)]);
    seedStores();
    useAnchorStore.setState({
      anchors: [ANCHOR_ARM],
      selectedAnchorId: 'a3',
    });
    await act(async () => { render(<AnchorPanel />); });
    expect(screen.getByText('0.8')).toBeInTheDocument();
  });

  // ── Propagate (multi-frame) ──

  it('shows propagate section when multiple frames exist', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    // Ensure anchors are in store for render
    useAnchorStore.setState({ anchors: [ANCHOR_HEAD] });
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByText('Copy to all frames')).toBeInTheDocument();
    });
  });

  it('copy to all invokes copy_anchors_to_all_frames', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    mock.on('copy_anchors_to_all_frames', () => ({ copied: 1, skipped: 0, replaced: 0, targetFrameCount: 1 }));
    seedStores();
    useAnchorStore.setState({ anchors: [ANCHOR_HEAD] });
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => { expect(screen.getByText('Copy to all frames')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByText('Copy to all frames'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('copy_anchors_to_all_frames');
  });

  it('conflict policy select defaults to skip', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    useAnchorStore.setState({ anchors: [ANCHOR_HEAD] });
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      const select = document.querySelector('.anchor-conflict-select') as HTMLSelectElement;
      expect(select.value).toBe('skip');
    });
  });

  // ── Save as preset ──

  it('shows Save Anchors as Preset button', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    seedStores();
    useAnchorStore.setState({ anchors: [ANCHOR_HEAD] });
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => {
      expect(screen.getByText('Save Anchors as Preset')).toBeInTheDocument();
    });
  });

  it('save preset invokes save_motion_preset', async () => {
    mock.on('list_anchors', () => [toResult(ANCHOR_HEAD)]);
    mock.on('save_motion_preset', () => ({ name: 'My Preset' }));
    window.prompt = vi.fn(() => 'My Preset');
    seedStores();
    useAnchorStore.setState({ anchors: [ANCHOR_HEAD] });
    await act(async () => { render(<AnchorPanel />); });
    await waitFor(() => { expect(screen.getByText('Save Anchors as Preset')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByText('Save Anchors as Preset'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('save_motion_preset');
  });

  // ── Backend calls ──

  it('calls list_anchors on mount', async () => {
    seedStores();
    await act(async () => { render(<AnchorPanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('list_anchors');
  });
});
