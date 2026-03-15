import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { WorkspaceMode } from '@glyphstudio/domain';

// Mock heavy child panels — we're testing the dock's tab routing, not the panels
vi.mock('../components/LayerPanel', () => ({
  LayerPanel: () => <div data-testid="layer-panel">LayerPanel</div>,
}));
vi.mock('../components/AssetBrowserPanel', () => ({
  AssetBrowserPanel: () => <div data-testid="asset-browser-panel">AssetBrowserPanel</div>,
}));
vi.mock('../components/SceneInstancesPanel', () => ({
  SceneInstancesPanel: () => <div data-testid="scene-instances-panel">SceneInstancesPanel</div>,
}));
vi.mock('../components/CameraKeyframePanel', () => ({
  CameraKeyframePanel: () => <div data-testid="camera-keyframe-panel">CameraKeyframePanel</div>,
}));
vi.mock('../components/CharacterBuilderPanel', () => ({
  CharacterBuilderPanel: () => <div data-testid="char-builder-panel">CharacterBuilderPanel</div>,
}));

// Import after mocks are declared
import { RightDock } from '../components/RightDock';

describe('RightDock', () => {
  afterEach(cleanup);

  describe('tab rendering per mode', () => {
    const modeTabs: [WorkspaceMode, string[]][] = [
      ['edit', ['Layers', 'Character', 'Properties', 'Palette', 'Assets']],
      ['animate', ['Layers', 'Character', 'Properties', 'Palette', 'Locomotion']],
      ['palette', ['Palette Props', 'Validation']],
      ['ai', ['AI Assist', 'Layers', 'Provenance']],
      ['locomotion', ['Locomotion', 'Layers', 'Validation']],
      ['validate', ['Validation', 'Properties', 'Provenance']],
      ['export', ['Export Settings']],
      ['scene', ['Instances', 'Camera', 'Assets']],
    ];

    it.each(modeTabs)('%s mode shows correct tabs', (mode, expectedTabs) => {
      render(<RightDock activeMode={mode} />);
      const buttons = screen.getAllByRole('button');
      expect(buttons.map((b) => b.textContent)).toEqual(expectedTabs);
    });

    it('project-home mode shows no tabs', () => {
      render(<RightDock activeMode="project-home" />);
      const buttons = screen.queryAllByRole('button');
      expect(buttons).toHaveLength(0);
    });
  });

  describe('tab count per mode', () => {
    it('edit has 5 tabs', () => {
      render(<RightDock activeMode="edit" />);
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });

    it('export has 1 tab', () => {
      render(<RightDock activeMode="export" />);
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('scene has 3 tabs', () => {
      render(<RightDock activeMode="scene" />);
      expect(screen.getAllByRole('button')).toHaveLength(3);
    });
  });

  describe('tab selection', () => {
    it('first tab is active by default', () => {
      render(<RightDock activeMode="edit" />);
      const firstTab = screen.getByText('Layers');
      expect(firstTab.className).toContain('active');
    });

    it('clicking a tab switches active state', async () => {
      render(<RightDock activeMode="edit" />);
      const paletteTab = screen.getByText('Palette');

      await act(async () => {
        await userEvent.click(paletteTab);
      });

      expect(paletteTab.className).toContain('active');
      // Previous tab should no longer be active
      expect(screen.getByText('Layers').className).not.toContain('active');
    });

    it('tab index resets when mode changes to one with fewer tabs', () => {
      const { rerender } = render(<RightDock activeMode="edit" />);
      // edit has 4 tabs. Switch to export which has 1 tab.
      rerender(<RightDock activeMode="export" />);
      // Should not crash and should show the single tab as active
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].className).toContain('active');
    });
  });

  describe('panel content routing', () => {
    it('edit mode first tab renders LayerPanel', () => {
      render(<RightDock activeMode="edit" />);
      expect(screen.getByTestId('layer-panel')).toBeInTheDocument();
    });

    it('edit mode Character tab renders CharacterBuilderPanel', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByText('Character'));
      });
      expect(screen.getByTestId('char-builder-panel')).toBeInTheDocument();
    });

    it('edit mode Assets tab renders AssetBrowserPanel', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByText('Assets'));
      });
      expect(screen.getByTestId('asset-browser-panel')).toBeInTheDocument();
    });

    it('scene mode first tab renders SceneInstancesPanel', () => {
      render(<RightDock activeMode="scene" />);
      expect(screen.getByTestId('scene-instances-panel')).toBeInTheDocument();
    });

    it('scene mode Camera tab renders CameraKeyframePanel', async () => {
      render(<RightDock activeMode="scene" />);
      await act(async () => {
        await userEvent.click(screen.getByText('Camera'));
      });
      expect(screen.getByTestId('camera-keyframe-panel')).toBeInTheDocument();
    });

    it('unhandled tab name renders placeholder', () => {
      render(<RightDock activeMode="palette" />);
      // First tab "Palette Props" has no dedicated component → placeholder
      const placeholder = document.querySelector('.dock-panel-placeholder');
      expect(placeholder).not.toBeNull();
      const label = placeholder!.querySelector('.placeholder-label');
      expect(label?.textContent).toBe('Palette Props');
    });

    it('non-first placeholder tabs work', async () => {
      render(<RightDock activeMode="edit" />);
      // Click "Properties" which is a placeholder panel
      await act(async () => {
        await userEvent.click(screen.getByText('Properties'));
      });
      const placeholder = document.querySelector('.dock-panel-placeholder');
      expect(placeholder).not.toBeNull();
    });
  });

  describe('mode transition resilience', () => {
    it('switching from mode with many tabs to fewer does not crash', () => {
      const { rerender } = render(<RightDock activeMode="edit" />);
      rerender(<RightDock activeMode="project-home" />);
      // project-home has 0 tabs — should not throw
      expect(screen.queryAllByRole('button')).toHaveLength(0);
    });

    it('switching from project-home to edit works', () => {
      const { rerender } = render(<RightDock activeMode="project-home" />);
      rerender(<RightDock activeMode="edit" />);
      expect(screen.getAllByRole('button')).toHaveLength(5);
    });

    it('rapidly switching modes does not break active tab', () => {
      const { rerender } = render(<RightDock activeMode="edit" />);
      rerender(<RightDock activeMode="scene" />);
      rerender(<RightDock activeMode="validate" />);
      rerender(<RightDock activeMode="export" />);
      // Should show single export tab, active
      const buttons = screen.getAllByRole('button');
      expect(buttons).toHaveLength(1);
      expect(buttons[0].className).toContain('active');
    });
  });
});
