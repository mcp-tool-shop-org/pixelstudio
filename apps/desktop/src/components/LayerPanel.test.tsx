import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LayerPanel } from '../components/LayerPanel';
import { useLayerStore, useProjectStore } from '@glyphstudio/state';
import { getMockInvoke } from '../test/helpers';

function mkLayer(id: string, name: string, overrides?: Record<string, unknown>) {
  return {
    id, name, type: 'raster' as const, parentId: null, childIds: [],
    visible: true, locked: false, opacity: 255, blendMode: 'normal',
    pixelRefId: null, maskLayerId: null, socketIds: [], origin: 'manual' as const,
    acceptedFromCandidateId: null, createdAt: '', updatedAt: '', metadata: {},
    ...overrides,
  };
}

const MOCK_FRAME = {
  width: 32,
  height: 32,
  layers: [mkLayer('L1', 'Background'), mkLayer('L2', 'Foreground')],
  layerOrder: ['L1', 'L2'],
  composited: new Array(32 * 32 * 4).fill(0),
  palette: null,
};

function seedLayers() {
  useLayerStore.setState({
    rootLayerIds: ['L1', 'L2'],
    activeLayerId: 'L1',
    layerById: {
      L1: mkLayer('L1', 'Background'),
      L2: mkLayer('L2', 'Foreground'),
    },
  });
  useProjectStore.setState({
    projectId: 'proj-1',
    name: 'Test',
    filePath: null,
    isDirty: false,
    saveStatus: 'idle',
    colorMode: 'rgb',
    canvasSize: { width: 32, height: 32 },
  });
}

describe('LayerPanel', () => {
  const mock = getMockInvoke();

  beforeEach(() => {
    mock.reset();
    // Default handlers
    mock.on('select_layer', () => MOCK_FRAME);
    mock.on('create_layer', () => MOCK_FRAME);
    mock.on('delete_layer', () => MOCK_FRAME);
    mock.on('rename_layer', () => MOCK_FRAME);
    mock.on('set_layer_visibility', () => MOCK_FRAME);
    mock.on('set_layer_lock', () => MOCK_FRAME);
    mock.on('reorder_layer', () => MOCK_FRAME);
    mock.on('mark_dirty', () => null);
  });
  afterEach(cleanup);

  describe('rendering', () => {
    it('shows panel title', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getByText('Layers')).toBeInTheDocument();
    });

    it('shows add layer button', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getByTitle('Add layer')).toBeInTheDocument();
    });

    it('renders layer names', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getByText('Background')).toBeInTheDocument();
      expect(screen.getByText('Foreground')).toBeInTheDocument();
    });

    it('layers display in reverse order (top layer first)', () => {
      seedLayers();
      render(<LayerPanel />);
      const names = screen.getAllByText(/Background|Foreground/).map((el) => el.textContent);
      // Foreground (index 1) rendered first, Background (index 0) rendered second
      expect(names).toEqual(['Foreground', 'Background']);
    });

    it('active layer has active class', () => {
      seedLayers();
      render(<LayerPanel />);
      const bg = screen.getByText('Background').closest('.layer-item');
      expect(bg?.className).toContain('active');
    });

    it('shows visibility buttons', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getAllByTitle('Hide layer')).toHaveLength(2);
    });

    it('shows lock buttons', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getAllByTitle('Lock layer')).toHaveLength(2);
    });

    it('shows delete button when multiple layers', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getAllByTitle('Delete layer')).toHaveLength(2);
    });

    it('hides delete button with single layer', () => {
      useLayerStore.setState({
        rootLayerIds: ['L1'],
        activeLayerId: 'L1',
        layerById: { L1: mkLayer('L1', 'Solo') },
      });
      useProjectStore.setState({ projectId: 'p', name: 'T', filePath: null, isDirty: false, saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 32, height: 32 } });
      render(<LayerPanel />);
      expect(screen.queryByTitle('Delete layer')).toBeNull();
    });
  });

  describe('layer selection', () => {
    it('clicking a layer invokes select_layer', async () => {
      seedLayers();
      render(<LayerPanel />);
      await act(async () => {
        await userEvent.click(screen.getByText('Foreground'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('select_layer', { layerId: 'L2' });
      });
    });
  });

  describe('add layer', () => {
    it('clicking + invokes create_layer', async () => {
      seedLayers();
      render(<LayerPanel />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Add layer'));
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('create_layer', { name: null });
      });
    });

    it('marks project dirty after adding', async () => {
      seedLayers();
      render(<LayerPanel />);
      await act(async () => {
        await userEvent.click(screen.getByTitle('Add layer'));
      });
      await waitFor(() => {
        const calls = mock.fn.mock.calls.map((c: any[]) => c[0]);
        expect(calls).toContain('mark_dirty');
      });
    });
  });

  describe('delete layer', () => {
    it('clicking delete invokes delete_layer', async () => {
      seedLayers();
      render(<LayerPanel />);
      const delBtns = screen.getAllByTitle('Delete layer');
      await act(async () => {
        await userEvent.click(delBtns[0]); // First rendered = Foreground (reversed)
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('delete_layer', { layerId: 'L2' });
      });
    });
  });

  describe('visibility toggle', () => {
    it('clicking visibility invokes set_layer_visibility', async () => {
      seedLayers();
      render(<LayerPanel />);
      const visBtns = screen.getAllByTitle('Hide layer');
      await act(async () => {
        await userEvent.click(visBtns[0]); // First = Foreground
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('set_layer_visibility', { layerId: 'L2', visible: false });
      });
    });
  });

  describe('lock toggle', () => {
    it('clicking lock invokes set_layer_lock', async () => {
      seedLayers();
      render(<LayerPanel />);
      const lockBtns = screen.getAllByTitle('Lock layer');
      await act(async () => {
        await userEvent.click(lockBtns[0]); // First = Foreground
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('set_layer_lock', { layerId: 'L2', locked: true });
      });
    });
  });

  describe('rename', () => {
    it('double-clicking layer name shows rename input', async () => {
      seedLayers();
      render(<LayerPanel />);
      const nameSpan = screen.getByText('Background');
      await act(async () => {
        await userEvent.dblClick(nameSpan);
      });
      const input = screen.getByDisplayValue('Background');
      expect(input).toBeInTheDocument();
    });

    it('pressing Enter commits rename', async () => {
      seedLayers();
      render(<LayerPanel />);
      await act(async () => {
        await userEvent.dblClick(screen.getByText('Background'));
      });
      const input = screen.getByDisplayValue('Background');
      await act(async () => {
        await userEvent.clear(input);
        await userEvent.type(input, 'Ground{Enter}');
      });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('rename_layer', { layerId: 'L1', name: 'Ground' });
      });
    });

    it('pressing Escape cancels rename without invoke', async () => {
      seedLayers();
      render(<LayerPanel />);
      await act(async () => {
        await userEvent.dblClick(screen.getByText('Background'));
      });
      const input = screen.getByDisplayValue('Background');
      await act(async () => {
        await userEvent.type(input, '{Escape}');
      });
      // No rename_layer call
      expect(mock.fn).not.toHaveBeenCalledWith('rename_layer', expect.anything());
    });

    it('rename button (✎) opens rename input', async () => {
      seedLayers();
      render(<LayerPanel />);
      const btn = screen.getByTestId('layer-rename-btn-L1');
      await act(async () => { await userEvent.click(btn); });
      expect(screen.getByDisplayValue('Background')).toBeInTheDocument();
    });
  });

  describe('reorder controls', () => {
    it('shows up/down buttons for each layer when multiple layers', () => {
      seedLayers();
      render(<LayerPanel />);
      expect(screen.getByTestId('layer-up-btn-L1')).toBeInTheDocument();
      expect(screen.getByTestId('layer-down-btn-L1')).toBeInTheDocument();
      expect(screen.getByTestId('layer-up-btn-L2')).toBeInTheDocument();
      expect(screen.getByTestId('layer-down-btn-L2')).toBeInTheDocument();
    });

    it('top display layer (L2, backendIndex=1) up-button is disabled', () => {
      seedLayers();
      render(<LayerPanel />);
      // displayLayers = [L2, L1] (reversed), so L2 is displayIndex 0 → canMoveUp = false
      expect(screen.getByTestId('layer-up-btn-L2')).toBeDisabled();
    });

    it('bottom display layer (L1, backendIndex=0) down-button is disabled', () => {
      seedLayers();
      render(<LayerPanel />);
      // L1 is at displayIndex 1 → canMoveDown = false
      expect(screen.getByTestId('layer-down-btn-L1')).toBeDisabled();
    });

    it('clicking up on L1 calls reorder_layer with newIndex=1', async () => {
      seedLayers();
      render(<LayerPanel />);
      // L1 is at displayIndex 1, backendIndex 0; up = backendIndex + 1 = 1
      await act(async () => { await userEvent.click(screen.getByTestId('layer-up-btn-L1')); });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('reorder_layer', { layerId: 'L1', newIndex: 1 });
      });
    });

    it('clicking down on L2 calls reorder_layer with newIndex=0', async () => {
      seedLayers();
      render(<LayerPanel />);
      // L2 is at displayIndex 0, backendIndex 1; down = backendIndex - 1 = 0
      await act(async () => { await userEvent.click(screen.getByTestId('layer-down-btn-L2')); });
      await waitFor(() => {
        expect(mock.fn).toHaveBeenCalledWith('reorder_layer', { layerId: 'L2', newIndex: 0 });
      });
    });

    it('hides reorder buttons for single layer', () => {
      useLayerStore.setState({
        rootLayerIds: ['L1'],
        activeLayerId: 'L1',
        layerById: { L1: mkLayer('L1', 'Solo') },
      });
      useProjectStore.setState({ projectId: 'p', name: 'T', filePath: null, isDirty: false, saveStatus: 'idle', colorMode: 'rgb', canvasSize: { width: 32, height: 32 } });
      render(<LayerPanel />);
      expect(screen.queryByTestId('layer-up-btn-L1')).toBeNull();
      expect(screen.queryByTestId('layer-down-btn-L1')).toBeNull();
    });
  });
});
