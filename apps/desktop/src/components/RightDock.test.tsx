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
vi.mock('../components/AnalysisPanel', () => ({
  AnalysisPanel: () => <div data-testid="analysis-panel">AnalysisPanel</div>,
}));
vi.mock('../components/PalettePropsPanel', () => ({
  PalettePropsPanel: () => <div data-testid="palette-props-panel">PalettePropsPanel</div>,
}));
vi.mock('../components/ValidationPanel', () => ({
  ValidationPanel: () => <div data-testid="validation-panel">ValidationPanel</div>,
}));
vi.mock('../components/ReferencePanel', () => ({
  ReferencePanel: () => <div data-testid="reference-panel">ReferencePanel</div>,
}));
vi.mock('../components/SceneProvenancePanel', () => ({
  SceneProvenancePanel: () => <div data-testid="scene-provenance-panel">SceneProvenancePanel</div>,
}));
vi.mock('../components/SnapshotPanel', () => ({
  SnapshotPanel: () => <div data-testid="snapshot-panel">SnapshotPanel</div>,
}));
vi.mock('../components/CopilotPanel', () => ({
  CopilotPanel: () => <div data-testid="copilot-panel">CopilotPanel</div>,
}));
vi.mock('../components/ComfyUIGeneratePanel', () => ({
  ComfyUIGeneratePanel: () => <div data-testid="comfyui-generate-panel">ComfyUIGeneratePanel</div>,
}));
vi.mock('../components/AISettingsPanel', () => ({
  AISettingsPanel: () => <div data-testid="ai-settings-panel">AISettingsPanel</div>,
}));
vi.mock('../components/TemplateBrowserPanel', () => ({
  TemplateBrowserPanel: () => <div data-testid="template-browser-panel">TemplateBrowserPanel</div>,
}));

// Import after mocks are declared
import { RightDock } from '../components/RightDock';

describe('RightDock', () => {
  afterEach(cleanup);

  describe('tab rendering per mode', () => {
    // For modes with >6 tabs, only the first 6 are shown plus a "More ▾" overflow trigger.
    // animate has exactly 8 tabs but threshold is 6, so it also overflows.
    const modeTabs: [WorkspaceMode, string[]][] = [
      ['edit', ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Canvas Props', 'More ▾']],
      ['animate', ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Canvas Props', 'More ▾']],
      ['palette', ['Palette Props', 'Validation']],
      ['ai', ['Copilot', 'Generate', 'Templates', 'AI Settings', 'Layers', 'Provenance']],
      ['locomotion', ['Locomotion', 'Layers', 'Validation']],
      ['validate', ['Validation', 'Sprite Props', 'Provenance']],
      ['export', ['Export Settings']],
      ['scene', ['Instances', 'Camera', 'Assets', 'Activity']],
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
    it('edit shows 6 visible tabs + 1 overflow trigger (10 total tabs, overflow threshold=6)', () => {
      render(<RightDock activeMode="edit" />);
      // 6 visible + 1 "More ▾" overflow trigger = 7 buttons in the tab bar
      expect(screen.getAllByRole('button')).toHaveLength(7);
    });

    it('export has 1 tab', () => {
      render(<RightDock activeMode="export" />);
      expect(screen.getAllByRole('button')).toHaveLength(1);
    });

    it('scene has 4 tabs (no overflow)', () => {
      render(<RightDock activeMode="scene" />);
      expect(screen.getAllByRole('button')).toHaveLength(4);
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
      // 'Analysis' is visible tab index 3 (within the first 6)
      const analysisTab = screen.getByText('Analysis');

      await act(async () => {
        await userEvent.click(analysisTab);
      });

      expect(analysisTab.className).toContain('active');
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

    it('edit mode Analysis tab renders AnalysisPanel', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => {
        await userEvent.click(screen.getByText('Analysis'));
      });
      expect(screen.getByTestId('analysis-panel')).toBeInTheDocument();
    });

    it('edit mode Assets tab (overflow) renders AssetBrowserPanel', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => { await userEvent.click(screen.getByTestId('dock-overflow-btn')); });
      await act(async () => { await userEvent.click(screen.getByText('Assets')); });
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

    it('palette mode first tab renders PalettePropsPanel', () => {
      render(<RightDock activeMode="palette" />);
      expect(screen.getByTestId('palette-props-panel')).toBeInTheDocument();
    });

    it('validate mode first tab renders ValidationPanel', () => {
      render(<RightDock activeMode="validate" />);
      expect(screen.getByTestId('validation-panel')).toBeInTheDocument();
    });

    it('palette mode second tab renders ValidationPanel', async () => {
      render(<RightDock activeMode="palette" />);
      await act(async () => {
        await userEvent.click(screen.getByText('Validation'));
      });
      expect(screen.getByTestId('validation-panel')).toBeInTheDocument();
    });

    it('unhandled tab name renders placeholder', () => {
      render(<RightDock activeMode="export" />);
      // "Export Settings" has no dedicated component → placeholder
      const placeholder = document.querySelector('.dock-panel-placeholder');
      expect(placeholder).not.toBeNull();
      const label = placeholder!.querySelector('.placeholder-label');
      expect(label?.textContent).toBe('Export Settings');
    });

    it('non-first placeholder tabs work', async () => {
      render(<RightDock activeMode="edit" />);
      // Click "Canvas Props" which is a placeholder panel
      await act(async () => {
        await userEvent.click(screen.getByText('Canvas Props'));
      });
      const placeholder = document.querySelector('.dock-panel-placeholder');
      expect(placeholder).not.toBeNull();
    });
  });

  describe('overflow menu', () => {
    it('shows overflow trigger button for edit mode', () => {
      render(<RightDock activeMode="edit" />);
      expect(screen.getByTestId('dock-overflow-btn')).toBeInTheDocument();
    });

    it('does not show overflow trigger for scene mode (4 tabs)', () => {
      render(<RightDock activeMode="scene" />);
      expect(screen.queryByTestId('dock-overflow-btn')).toBeNull();
    });

    it('overflow menu is hidden by default', () => {
      render(<RightDock activeMode="edit" />);
      expect(screen.queryByTestId('dock-overflow-menu')).toBeNull();
    });

    it('clicking overflow trigger opens the menu', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => { await userEvent.click(screen.getByTestId('dock-overflow-btn')); });
      expect(screen.getByTestId('dock-overflow-menu')).toBeInTheDocument();
    });

    it('overflow menu contains the hidden tabs', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => { await userEvent.click(screen.getByTestId('dock-overflow-btn')); });
      const menu = screen.getByTestId('dock-overflow-menu');
      // edit tabs 7-10: Palette, Copilot, Templates, Assets
      expect(menu).toHaveTextContent('Palette');
      expect(menu).toHaveTextContent('Copilot');
      expect(menu).toHaveTextContent('Templates');
      expect(menu).toHaveTextContent('Assets');
    });

    it('selecting an overflow tab closes the menu and renders the panel', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => { await userEvent.click(screen.getByTestId('dock-overflow-btn')); });
      await act(async () => { await userEvent.click(screen.getByText('Copilot')); });
      expect(screen.queryByTestId('dock-overflow-menu')).toBeNull();
      expect(screen.getByTestId('copilot-panel')).toBeInTheDocument();
    });

    it('overflow trigger shows active tab name when an overflow tab is selected', async () => {
      render(<RightDock activeMode="edit" />);
      await act(async () => { await userEvent.click(screen.getByTestId('dock-overflow-btn')); });
      await act(async () => { await userEvent.click(screen.getByText('Assets')); });
      expect(screen.getByTestId('dock-overflow-btn').textContent).toContain('Assets');
    });
  });

  describe('tab memory per mode', () => {
    it('returns to the previously selected tab when switching back to a mode', async () => {
      const { rerender } = render(<RightDock activeMode="edit" />);
      // Select Analysis (visible tab index 3) in edit mode
      await act(async () => { await userEvent.click(screen.getByText('Analysis')); });
      expect(screen.getByText('Analysis').className).toContain('active');

      // Switch to scene mode
      rerender(<RightDock activeMode="scene" />);
      expect(screen.getByText('Instances').className).toContain('active');

      // Switch back to edit — Analysis should still be active
      rerender(<RightDock activeMode="edit" />);
      expect(screen.getByText('Analysis').className).toContain('active');
      expect(screen.getByText('Layers').className).not.toContain('active');
    });

    it('each mode independently tracks its own tab', async () => {
      const { rerender } = render(<RightDock activeMode="edit" />);
      // Select Character (visible tab index 4) in edit mode
      await act(async () => { await userEvent.click(screen.getByText('Character')); });

      rerender(<RightDock activeMode="scene" />);
      await act(async () => { await userEvent.click(screen.getByText('Camera')); });

      // Back to edit — Character still active
      rerender(<RightDock activeMode="edit" />);
      expect(screen.getByText('Character').className).toContain('active');

      // Back to scene — Camera still active
      rerender(<RightDock activeMode="scene" />);
      expect(screen.getByText('Camera').className).toContain('active');
    });

    it('overflow tab selection is remembered when switching modes and back', async () => {
      const { rerender } = render(<RightDock activeMode="edit" />);
      // Select Assets (overflow tab) via the overflow menu
      await act(async () => { await userEvent.click(screen.getByTestId('dock-overflow-btn')); });
      await act(async () => { await userEvent.click(screen.getByText('Assets')); });

      // Switch away and back
      rerender(<RightDock activeMode="scene" />);
      rerender(<RightDock activeMode="edit" />);

      // Overflow trigger should show Assets (the remembered overflow tab)
      expect(screen.getByTestId('dock-overflow-btn').textContent).toContain('Assets');
      expect(screen.getByTestId('asset-browser-panel')).toBeInTheDocument();
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
      // edit shows 6 visible + 1 overflow trigger
      expect(screen.getAllByRole('button')).toHaveLength(7);
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
