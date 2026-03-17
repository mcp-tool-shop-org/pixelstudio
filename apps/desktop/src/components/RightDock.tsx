import type { WorkspaceMode } from '@glyphstudio/domain';
import { useEffect, useRef, useState } from 'react';
import type { ComponentType } from 'react';
import { LayerPanel } from './LayerPanel';
import { AssetBrowserPanel } from './AssetBrowserPanel';
import { SceneInstancesPanel } from './SceneInstancesPanel';
import { CameraKeyframePanel } from './CameraKeyframePanel';
import { CharacterBuilderPanel } from './CharacterBuilderPanel';
import { SceneProvenancePanel } from './SceneProvenancePanel';
import { AnalysisPanel } from './AnalysisPanel';
import { PalettePropsPanel } from './PalettePropsPanel';
import { ValidationPanel } from './ValidationPanel';
import { ReferencePanel } from './ReferencePanel';
import { SnapshotPanel } from './SnapshotPanel';
import { VectorShapesPanel } from './VectorShapesPanel';
import { VectorPropertiesPanel } from './VectorPropertiesPanel';
import { VectorReductionPanel } from './VectorReductionPanel';
import { VectorCopilotPanel } from './VectorCopilotPanel';
import { VectorAICreationPanel } from './VectorAICreationPanel';
import { AISettingsPanel } from './AISettingsPanel';
import { ComfyUIGeneratePanel } from './ComfyUIGeneratePanel';
import { CopilotPanel } from './CopilotPanel';
import { TemplateBrowserPanel } from './TemplateBrowserPanel';
import { SliceManagerPanel } from './SliceManagerPanel';

interface RightDockProps {
  activeMode: WorkspaceMode;
}

/**
 * Declarative tab → component registry.
 *
 * To wire a new panel: add its tab label as a key and the component as the value.
 * Tabs present in MODE_TABS but absent from this registry render a placeholder.
 */
export const PANEL_REGISTRY: Record<string, ComponentType> = {
  'Layers': LayerPanel,
  'Assets': AssetBrowserPanel,
  'Instances': SceneInstancesPanel,
  'Camera': CameraKeyframePanel,
  'Character': CharacterBuilderPanel,
  'Activity': SceneProvenancePanel,
  'Reference': ReferencePanel,
  'Snapshots': SnapshotPanel,
  'Analysis': AnalysisPanel,
  'Palette Props': PalettePropsPanel,
  'Validation': ValidationPanel,
  'Shapes': VectorShapesPanel,
  'Shape Props': VectorPropertiesPanel,
  'Reduction': VectorReductionPanel,
  'Vec Copilot': VectorCopilotPanel,
  'AI Create': VectorAICreationPanel,
  'Copilot': CopilotPanel,
  'Generate': ComfyUIGeneratePanel,
  'Templates': TemplateBrowserPanel,
  'AI Settings': AISettingsPanel,
  'Slices': SliceManagerPanel,
};

/**
 * Which tabs appear in each workspace mode, in display order.
 * Tabs beyond TAB_OVERFLOW_THRESHOLD are accessible via the overflow menu.
 */
export const MODE_TABS: Record<WorkspaceMode, string[]> = {
  'project-home': [],
  edit: ['Layers', 'Slices', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Canvas Props', 'Palette', 'Copilot', 'Templates', 'Assets'],
  animate: ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Canvas Props', 'Palette', 'Locomotion'],
  palette: ['Palette Props', 'Validation'],
  ai: ['Copilot', 'Generate', 'Templates', 'AI Settings', 'Layers', 'Provenance'],
  locomotion: ['Locomotion', 'Layers', 'Validation'],
  validate: ['Validation', 'Sprite Props', 'Provenance'],
  export: ['Export Settings'],
  scene: ['Instances', 'Camera', 'Assets', 'Activity'],
  vector: ['Shapes', 'Shape Props', 'Reduction', 'Vec Copilot', 'AI Create'],
};

const TAB_OVERFLOW_THRESHOLD = 6;

function PanelContent({ tabName }: { tabName: string }) {
  const Component = PANEL_REGISTRY[tabName];
  if (Component) return <Component />;
  return (
    <div className="dock-panel-placeholder">
      <span className="placeholder-label">{tabName}</span>
    </div>
  );
}

export function RightDock({ activeMode }: RightDockProps) {
  const tabs = MODE_TABS[activeMode] ?? [];
  // Per-mode tab memory: switching modes and back restores the last selected tab
  const [tabByMode, setTabByMode] = useState<Partial<Record<WorkspaceMode, number>>>({});
  const savedIndex = tabByMode[activeMode] ?? 0;
  // Clamp in case the tab list ever shrinks (e.g. mode reconfiguration)
  const activeTab = savedIndex < tabs.length ? savedIndex : 0;

  // Overflow dropdown state
  const [overflowOpen, setOverflowOpen] = useState(false);
  const overflowRef = useRef<HTMLDivElement>(null);

  // Close overflow when clicking outside
  useEffect(() => {
    if (!overflowOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (overflowRef.current && !overflowRef.current.contains(e.target as Node)) {
        setOverflowOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [overflowOpen]);

  const handleTabClick = (mode: WorkspaceMode, index: number) => {
    setTabByMode((prev) => ({ ...prev, [mode]: index }));
    setOverflowOpen(false);
  };

  const visibleTabs = tabs.length > TAB_OVERFLOW_THRESHOLD ? tabs.slice(0, TAB_OVERFLOW_THRESHOLD) : tabs;
  const overflowTabs = tabs.length > TAB_OVERFLOW_THRESHOLD ? tabs.slice(TAB_OVERFLOW_THRESHOLD) : [];
  const activeIsOverflow = activeTab >= TAB_OVERFLOW_THRESHOLD;

  return (
    <aside className="right-dock">
      <div className="dock-tabs">
        {visibleTabs.map((tab, i) => (
          <button
            key={tab}
            className={`dock-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => handleTabClick(activeMode, i)}
          >
            {tab}
          </button>
        ))}
        {overflowTabs.length > 0 && (
          <div className="dock-overflow" ref={overflowRef}>
            <button
              className={`dock-tab dock-overflow-trigger ${activeIsOverflow ? 'active' : ''}`}
              onClick={() => setOverflowOpen((o) => !o)}
              data-testid="dock-overflow-btn"
              aria-haspopup="true"
              aria-expanded={overflowOpen}
            >
              {activeIsOverflow ? tabs[activeTab] : 'More'} ▾
            </button>
            {overflowOpen && (
              <div className="dock-overflow-menu" data-testid="dock-overflow-menu">
                {overflowTabs.map((tab, i) => {
                  const globalIndex = TAB_OVERFLOW_THRESHOLD + i;
                  return (
                    <button
                      key={tab}
                      className={`dock-overflow-item ${activeTab === globalIndex ? 'active' : ''}`}
                      onClick={() => handleTabClick(activeMode, globalIndex)}
                    >
                      {tab}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="dock-content">
        <PanelContent tabName={tabs[activeTab] ?? 'No panel'} />
      </div>
    </aside>
  );
}
