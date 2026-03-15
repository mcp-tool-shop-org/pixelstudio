import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useTimelineStore, useAnchorStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { MotionPresetSummary, PresetCompatibility, PresetPreviewResult } from '@pixelstudio/domain';

import { PresetPanel } from '../components/PresetPanel';

const PRESET_LOCO: MotionPresetSummary = {
  id: 'p1',
  name: 'Walk Cycle',
  kind: 'locomotion',
  description: 'Standard 4-frame walk',
  anchorCount: 3,
  hasHierarchy: true,
  templateId: 'biped-walk',
  createdAt: '2026-03-10T00:00:00Z',
  modifiedAt: '2026-03-15T00:00:00Z',
};

const PRESET_SEC: MotionPresetSummary = {
  id: 'p2',
  name: 'Hair Sway',
  kind: 'secondary_motion',
  description: null,
  anchorCount: 2,
  hasHierarchy: false,
  templateId: null,
  createdAt: '2026-03-12T00:00:00Z',
  modifiedAt: '2026-03-14T00:00:00Z',
};

const COMPAT_MATCH: PresetCompatibility = {
  tier: 'compatible',
  matchingAnchors: ['hip', 'knee', 'foot'],
  missingAnchors: [],
  extraAnchors: [],
  wouldExceedLimit: false,
  notes: [],
};

const COMPAT_PARTIAL: PresetCompatibility = {
  tier: 'partial',
  matchingAnchors: ['hair_root'],
  missingAnchors: ['hair_tip'],
  extraAnchors: [],
  wouldExceedLimit: false,
  notes: ['Missing anchor: hair_tip'],
};

function seedFrames(count: number) {
  useTimelineStore.setState({
    frames: Array.from({ length: count }, (_, i) => ({
      id: `f${i}`,
      layerCels: [],
    })),
  });
}

describe('PresetPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('list_motion_presets', () => []);
    mock.on('list_anchors', () => []);
    seedFrames(1);
  });

  afterEach(() => {
    cleanup();
  });

  // ── Collapsed state ──

  it('renders collapsed by default with title', async () => {
    await act(async () => { render(<PresetPanel />); });
    expect(screen.getByText('Presets')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument(); // count
    expect(screen.getByText('\u25B6')).toBeInTheDocument(); // right arrow (collapsed)
  });

  it('does not show body when collapsed', async () => {
    await act(async () => { render(<PresetPanel />); });
    expect(document.querySelector('.preset-body')).not.toBeInTheDocument();
  });

  // ── Expanded state ──

  it('expands on header click', async () => {
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    expect(document.querySelector('.preset-body')).toBeInTheDocument();
    expect(screen.getByText('\u25BC')).toBeInTheDocument(); // down arrow (expanded)
  });

  it('shows empty state when expanded with no presets', async () => {
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    expect(screen.getByText(/No saved presets/)).toBeInTheDocument();
  });

  // ── Preset list ──

  it('shows preset names when expanded', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO, PRESET_SEC]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      expect(screen.getByText('Walk Cycle')).toBeInTheDocument();
      expect(screen.getByText('Hair Sway')).toBeInTheDocument();
    });
  });

  it('shows kind badges', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO, PRESET_SEC]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      const badges = document.querySelectorAll('.preset-kind-badge');
      const texts = [...badges].map((b) => b.textContent);
      expect(texts).toContain('Locomotion');
      expect(texts).toContain('Secondary');
    });
  });

  it('shows preset count in header', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO, PRESET_SEC]);
    await act(async () => { render(<PresetPanel />); });
    await waitFor(() => {
      expect(screen.getByText('2')).toBeInTheDocument();
    });
  });

  it('shows anchor count and hierarchy', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      expect(screen.getByText(/3 anchors/)).toBeInTheDocument();
      expect(screen.getByText(/hierarchy/)).toBeInTheDocument();
      expect(screen.getByText(/biped-walk/)).toBeInTheDocument();
    });
  });

  it('shows description on presets', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      expect(screen.getByText('Standard 4-frame walk')).toBeInTheDocument();
    });
  });

  // ── Compatibility badges ──

  it('shows Match badge for compatible preset', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      expect(screen.getByText('Match')).toBeInTheDocument();
    });
  });

  it('shows Partial badge and notes for partial preset', async () => {
    mock.on('list_motion_presets', () => [PRESET_SEC]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_PARTIAL);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      expect(screen.getByText('Partial')).toBeInTheDocument();
      expect(screen.getByText('Missing anchor: hair_tip')).toBeInTheDocument();
    });
  });

  // ── Filter/search ──

  it('filter by kind shows only matching presets', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO, PRESET_SEC]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const kindSelect = document.querySelector('.preset-kind-filter') as HTMLSelectElement;
    await act(async () => { await userEvent.selectOptions(kindSelect, 'secondary_motion'); });
    await waitFor(() => {
      expect(screen.queryByText('Walk Cycle')).not.toBeInTheDocument();
      expect(screen.getByText('Hair Sway')).toBeInTheDocument();
    });
  });

  it('search filters by name', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO, PRESET_SEC]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const searchInput = screen.getByPlaceholderText('Search...');
    await act(async () => { await userEvent.type(searchInput, 'hair'); });
    await waitFor(() => {
      expect(screen.queryByText('Walk Cycle')).not.toBeInTheDocument();
      expect(screen.getByText('Hair Sway')).toBeInTheDocument();
    });
  });

  it('shows no-match message when filters exclude all', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const searchInput = screen.getByPlaceholderText('Search...');
    await act(async () => { await userEvent.type(searchInput, 'zzzzz'); });
    await waitFor(() => {
      expect(screen.getByText('No presets match filters.')).toBeInTheDocument();
    });
  });

  // ── Scope selector ──

  it('does not show scope bar with 1 frame', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    seedFrames(1);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    expect(document.querySelector('.preset-scope-bar')).not.toBeInTheDocument();
  });

  it('shows scope bar when multiple frames', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    seedFrames(4);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    expect(screen.getByText('Current')).toBeInTheDocument();
    expect(screen.getByText('Span')).toBeInTheDocument();
    expect(screen.getByText('All Frames')).toBeInTheDocument();
  });

  it('shows span inputs when scope is span', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    seedFrames(4);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await act(async () => { await userEvent.click(screen.getByText('Span')); });
    expect(screen.getByText('From:')).toBeInTheDocument();
    expect(screen.getByText('To:')).toBeInTheDocument();
  });

  // ── Override controls ──

  it('override controls hidden by default', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    expect(document.querySelector('.preset-overrides-body')).not.toBeInTheDocument();
  });

  it('shows override controls on toggle', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await act(async () => { await userEvent.click(screen.getByText('Overrides')); });
    expect(document.querySelector('.preset-overrides-body')).toBeInTheDocument();
    expect(screen.getByText('Strength')).toBeInTheDocument();
    expect(screen.getByText('Direction')).toBeInTheDocument();
    expect(screen.getByText('Phase')).toBeInTheDocument();
    expect(screen.getByText('Reset')).toBeInTheDocument();
  });

  // ── Apply button labels ──

  it('apply button says "Apply" for current scope', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => {
      expect(document.querySelector('.preset-apply-btn')).toHaveTextContent('Apply');
    });
  });

  it('apply button says "Apply to All" for all scope', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    seedFrames(4);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await act(async () => { await userEvent.click(screen.getByText('All Frames')); });
    await waitFor(() => {
      expect(document.querySelector('.preset-apply-btn')).toHaveTextContent('Apply to All');
    });
  });

  // ── Actions ──

  it('apply invokes apply_motion_preset for current scope', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    mock.on('apply_motion_preset', () => ({
      createdAnchors: ['hip'], updatedAnchors: [], skipped: [], warnings: [],
    }));
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const applyBtn = document.querySelector('.preset-apply-btn') as HTMLElement;
    await act(async () => { await userEvent.click(applyBtn); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('apply_motion_preset');
  });

  it('apply invokes apply_motion_preset_to_all_frames for all scope', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    mock.on('apply_motion_preset_to_all_frames', () => ({
      totalFrames: 4, appliedFrames: 4, skippedFrames: 0, perFrame: [], summary: ['4 applied'],
    }));
    seedFrames(4);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await act(async () => { await userEvent.click(screen.getByText('All Frames')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const applyBtn = document.querySelector('.preset-apply-btn') as HTMLElement;
    await act(async () => { await userEvent.click(applyBtn); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('apply_motion_preset_to_all_frames');
  });

  it('delete invokes delete_motion_preset', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    mock.on('delete_motion_preset', () => true);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const deleteBtn = document.querySelector('.preset-delete-btn') as HTMLElement;
    await act(async () => { await userEvent.click(deleteBtn); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('delete_motion_preset');
  });

  it('rename invokes rename_motion_preset via prompt', async () => {
    window.prompt = vi.fn(() => 'Run Cycle');
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    mock.on('rename_motion_preset', () => true);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const renameBtn = document.querySelector('.preset-rename-btn') as HTMLElement;
    await act(async () => { await userEvent.click(renameBtn); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('rename_motion_preset');
  });

  // ── Preview ──

  it('shows preview button for non-current scope', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    seedFrames(4);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await act(async () => { await userEvent.click(screen.getByText('All Frames')); });
    await waitFor(() => {
      expect(document.querySelector('.preset-preview-btn')).toBeInTheDocument();
    });
  });

  it('no preview button for current scope', async () => {
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    expect(document.querySelector('.preset-preview-btn')).not.toBeInTheDocument();
  });

  it('preview invokes preview_motion_preset_apply and renders panel', async () => {
    const mockPreview: PresetPreviewResult = {
      presetName: 'Walk Cycle',
      presetKind: 'locomotion',
      anchorDiffs: [
        { name: 'hip', action: 'create', changes: [] },
        { name: 'knee', action: 'update', changes: ['x', 'y'] },
      ],
      effectiveSettings: {} as any,
      warnings: ['Low precision'],
      scopeFrames: 4,
    };
    mock.on('list_motion_presets', () => [PRESET_LOCO]);
    mock.on('check_motion_preset_compatibility', () => COMPAT_MATCH);
    mock.on('preview_motion_preset_apply', () => mockPreview);
    seedFrames(4);
    await act(async () => { render(<PresetPanel />); });
    await act(async () => { await userEvent.click(screen.getByText('Presets')); });
    await act(async () => { await userEvent.click(screen.getByText('All Frames')); });
    await waitFor(() => { expect(screen.getByText('Walk Cycle')).toBeInTheDocument(); });
    const previewBtn = document.querySelector('.preset-preview-btn') as HTMLElement;
    await act(async () => { await userEvent.click(previewBtn); });
    await waitFor(() => {
      expect(document.querySelector('.preset-preview-panel')).toBeInTheDocument();
      expect(screen.getByText('hip')).toBeInTheDocument();
      expect(screen.getByText('knee')).toBeInTheDocument();
      expect(screen.getByText('x, y')).toBeInTheDocument();
      expect(screen.getByText('Low precision')).toBeInTheDocument();
      expect(screen.getByText('Apply Now')).toBeInTheDocument();
    });
  });

  // ── Calls list_motion_presets on mount ──

  it('calls list_motion_presets on mount', async () => {
    await act(async () => { render(<PresetPanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('list_motion_presets');
  });
});
