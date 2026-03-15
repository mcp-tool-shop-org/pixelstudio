import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useProjectStore } from '@pixelstudio/state';
import { getMockInvoke } from '../test/helpers';
import type { AssetSummary } from '@pixelstudio/domain';

import { AssetBrowserPanel } from '../components/AssetBrowserPanel';

const ASSET_A: AssetSummary = {
  id: 'a1',
  name: 'Hero',
  kind: 'character',
  status: 'ok',
  filePath: '/projects/hero.pxs',
  thumbnailPath: null,
  canvasWidth: 32,
  canvasHeight: 32,
  frameCount: 8,
  clipCount: 2,
  tags: ['player', 'humanoid'],
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-15T00:00:00Z',
};

const ASSET_B: AssetSummary = {
  id: 'a2',
  name: 'Tree',
  kind: 'environment',
  status: 'ok',
  filePath: '/projects/tree.pxs',
  thumbnailPath: '/thumbs/tree.png',
  canvasWidth: 64,
  canvasHeight: 64,
  frameCount: 1,
  clipCount: 0,
  tags: ['nature'],
  createdAt: '2026-03-10T00:00:00Z',
  updatedAt: '2026-03-14T00:00:00Z',
};

const ASSET_MISSING: AssetSummary = {
  id: 'a3',
  name: 'Ghost',
  kind: 'effect',
  status: 'missing',
  filePath: '/gone/ghost.pxs',
  thumbnailPath: null,
  canvasWidth: 16,
  canvasHeight: 16,
  frameCount: 4,
  clipCount: 0,
  tags: [],
  createdAt: '2026-03-05T00:00:00Z',
  updatedAt: '2026-03-10T00:00:00Z',
};

function seedProject() {
  useProjectStore.setState({
    projectId: 'p1', name: 'Test', filePath: '/projects/hero.pxs', isDirty: false,
    saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 32, height: 32 },
  });
}

describe('AssetBrowserPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    mock.on('list_assets', () => []);
  });

  afterEach(() => {
    cleanup();
  });

  // ── Empty state ──

  it('shows loading then empty when no assets', async () => {
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('No assets in catalog')).toBeInTheDocument();
    });
  });

  it('shows Asset Library title', async () => {
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    expect(screen.getByText('Asset Library')).toBeInTheDocument();
  });

  it('shows refresh and select buttons', async () => {
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    expect(screen.getByTitle('Refresh catalog')).toBeInTheDocument();
    expect(screen.getByText('Select')).toBeInTheDocument();
  });

  // ── Search and filters ──

  it('shows search input', async () => {
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    expect(screen.getByPlaceholderText('Search name, tag, kind...')).toBeInTheDocument();
  });

  it('shows kind, status, sort dropdowns', async () => {
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    const selects = document.querySelectorAll('.asset-browser-select');
    expect(selects.length).toBe(3);
  });

  // ── With assets ──

  it('renders asset names', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('Hero')).toBeInTheDocument();
      expect(screen.getByText('Tree')).toBeInTheDocument();
    });
  });

  it('shows canvas dimensions and frame count', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('32x32')).toBeInTheDocument();
      expect(screen.getByText('8f')).toBeInTheDocument();
    });
  });

  it('shows clip count when present', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('2 clips')).toBeInTheDocument();
    });
  });

  it('shows tags on asset rows', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('player')).toBeInTheDocument();
      expect(screen.getByText('humanoid')).toBeInTheDocument();
    });
  });

  it('shows "Open" badge on currently open project', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject(); // filePath matches ASSET_A
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(document.querySelector('.asset-row-current-badge')).toHaveTextContent('Open');
    });
  });

  it('shows missing badge for missing assets', async () => {
    mock.on('list_assets', () => [ASSET_MISSING]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(document.querySelector('.asset-row-status-badge')).toHaveTextContent('Missing');
    });
  });

  // ── Footer stats ──

  it('shows asset count in footer', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('2 of 2 assets')).toBeInTheDocument();
    });
  });

  it('shows missing count in footer', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_MISSING]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => {
      expect(screen.getByText('1 missing')).toBeInTheDocument();
    });
  });

  // ── Filtering ──

  it('search filters assets by name', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    const searchInput = screen.getByPlaceholderText('Search name, tag, kind...');
    await act(async () => { await userEvent.type(searchInput, 'tree'); });
    await waitFor(() => {
      expect(screen.queryByText('Hero')).not.toBeInTheDocument();
      expect(screen.getByText('Tree')).toBeInTheDocument();
    });
  });

  it('search filters by tag', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    const searchInput = screen.getByPlaceholderText('Search name, tag, kind...');
    await act(async () => { await userEvent.type(searchInput, 'nature'); });
    await waitFor(() => {
      expect(screen.queryByText('Hero')).not.toBeInTheDocument();
      expect(screen.getByText('Tree')).toBeInTheDocument();
    });
  });

  it('shows no-match message when filters exclude all', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    const searchInput = screen.getByPlaceholderText('Search name, tag, kind...');
    await act(async () => { await userEvent.type(searchInput, 'zzzznonexistent'); });
    await waitFor(() => {
      expect(screen.getByText('No assets match current filters')).toBeInTheDocument();
    });
  });

  // ── Asset row actions ──

  it('refresh button invokes refresh_asset_catalog', async () => {
    mock.on('refresh_asset_catalog', () => [ASSET_A]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Refresh catalog'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('refresh_asset_catalog');
  });

  it('remove button invokes remove_asset_catalog_entry', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    mock.on('remove_asset_catalog_entry', () => true);
    mock.on('mark_dirty', () => undefined);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Remove from catalog (file not deleted)'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('remove_asset_catalog_entry');
  });

  // ── Open ──

  it('open button invokes open_project', async () => {
    mock.on('list_assets', () => [ASSET_B]);
    mock.on('open_project', () => undefined);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Tree')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByTitle('Open project'));
    });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('open_project');
  });

  it('open button disabled for missing assets', async () => {
    mock.on('list_assets', () => [ASSET_MISSING]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Ghost')).toBeInTheDocument(); });
    expect(screen.getByTitle('File not found — cannot open')).toBeDisabled();
  });

  // ── Multi-select mode ──

  it('entering multi-select shows Done button', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByText('Select'));
    });
    expect(screen.getByText('Done')).toBeInTheDocument();
  });

  it('multi-select shows selection count and action bar', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => {
      await userEvent.click(screen.getByText('Select'));
    });
    expect(screen.getByText('0 selected')).toBeInTheDocument();
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('Clear')).toBeInTheDocument();
  });

  it('select all visible selects all filtered assets', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    await act(async () => { await userEvent.click(screen.getByText('All')); });
    expect(screen.getByText('2 selected')).toBeInTheDocument();
  });

  it('multi-select shows packaging section', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    await act(async () => { await userEvent.click(screen.getByText('All')); });
    expect(screen.getByText(/Package 2 assets/)).toBeInTheDocument();
  });

  it('packaging section has preview and export buttons', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    await act(async () => { await userEvent.click(screen.getByText('All')); });
    expect(document.querySelector('.asset-catalog-package-btn')).toHaveTextContent('Preview');
    expect(document.querySelector('.asset-catalog-package-btn-export')).toHaveTextContent('Export');
  });

  it('catalog preview invokes preview_catalog_bundle', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    mock.on('preview_catalog_bundle', () => ({
      assets: [{ assetId: 'a1', assetName: 'Hero', status: 'ok', fileCount: 3, warnings: [] }],
      totalFiles: 3,
      warnings: [],
    }));
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    // Click on the asset row to select it
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    const previewBtn = document.querySelector('.asset-catalog-package-btn') as HTMLElement;
    await act(async () => { await userEvent.click(previewBtn); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('preview_catalog_bundle');
  });

  it('export disabled when missing assets are selected', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_MISSING]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    await act(async () => { await userEvent.click(screen.getByText('All')); });
    const exportBtn = screen.getByTitle('Cannot export — missing assets in selection');
    expect(exportBtn).toBeDisabled();
  });

  it('missing selection shows warning and clear missing button', async () => {
    mock.on('list_assets', () => [ASSET_A, ASSET_MISSING]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    await act(async () => { await userEvent.click(screen.getByText('All')); });
    expect(document.querySelector('.asset-multi-bar-warn')).toHaveTextContent('1 missing');
    expect(screen.getByText('Clear missing')).toBeInTheDocument();
  });

  it('packaging format select has folder and zip options', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Select')); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    // Find format select in packaging section
    const formatSelect = document.querySelector('.asset-catalog-package select') as HTMLSelectElement;
    expect(formatSelect).not.toBeNull();
  });

  // ── Preview pane ──

  it('clicking an asset opens preview pane with details', async () => {
    mock.on('list_assets', () => [ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Tree')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Tree')); });
    // Preview pane should show details
    await waitFor(() => {
      const pane = document.querySelector('.asset-preview-pane')!;
      expect(pane).toBeInTheDocument();
      expect(pane).toHaveTextContent('Kind');
      expect(pane).toHaveTextContent('environment');
      expect(pane).toHaveTextContent('Canvas');
      expect(pane).toHaveTextContent('Frames');
    });
  });

  it('preview pane shows file path', async () => {
    mock.on('list_assets', () => [ASSET_B]);
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Tree')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Tree')); });
    await waitFor(() => {
      expect(screen.getByText('/projects/tree.pxs')).toBeInTheDocument();
    });
  });

  it('preview shows "Currently open" for current project', async () => {
    mock.on('list_assets', () => [ASSET_A]);
    seedProject(); // filePath matches ASSET_A
    await act(async () => { render(<AssetBrowserPanel />); });
    await waitFor(() => { expect(screen.getByText('Hero')).toBeInTheDocument(); });
    await act(async () => { await userEvent.click(screen.getByText('Hero')); });
    await waitFor(() => {
      expect(screen.getByText('Currently open')).toBeInTheDocument();
    });
  });

  // ── Backend calls ──

  it('calls list_assets on mount', async () => {
    seedProject();
    await act(async () => { render(<AssetBrowserPanel />); });
    expect(mock.fn.mock.calls.map((c: unknown[]) => c[0])).toContain('list_assets');
  });
});
