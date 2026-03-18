import React, { Suspense, useEffect, useRef, useState } from 'react';
import type { WorkspaceMode } from '@glyphstudio/domain';

// Lazy-load all panels: deferred until first activation, not evaluated at startup.
const LayerPanel = React.lazy(() => import('./LayerPanel').then((m) => ({ default: m.LayerPanel })));
const AssetBrowserPanel = React.lazy(() => import('./AssetBrowserPanel').then((m) => ({ default: m.AssetBrowserPanel })));
const SceneInstancesPanel = React.lazy(() => import('./SceneInstancesPanel').then((m) => ({ default: m.SceneInstancesPanel })));
const CameraKeyframePanel = React.lazy(() => import('./CameraKeyframePanel').then((m) => ({ default: m.CameraKeyframePanel })));
const CharacterBuilderPanel = React.lazy(() => import('./CharacterBuilderPanel').then((m) => ({ default: m.CharacterBuilderPanel })));
const SceneProvenancePanel = React.lazy(() => import('./SceneProvenancePanel').then((m) => ({ default: m.SceneProvenancePanel })));
const AnalysisPanel = React.lazy(() => import('./AnalysisPanel').then((m) => ({ default: m.AnalysisPanel })));
const PalettePropsPanel = React.lazy(() => import('./PalettePropsPanel').then((m) => ({ default: m.PalettePropsPanel })));
const ValidationPanel = React.lazy(() => import('./ValidationPanel').then((m) => ({ default: m.ValidationPanel })));
const ReferencePanel = React.lazy(() => import('./ReferencePanel').then((m) => ({ default: m.ReferencePanel })));
const SnapshotPanel = React.lazy(() => import('./SnapshotPanel').then((m) => ({ default: m.SnapshotPanel })));
const VectorShapesPanel = React.lazy(() => import('./VectorShapesPanel').then((m) => ({ default: m.VectorShapesPanel })));
const VectorPropertiesPanel = React.lazy(() => import('./VectorPropertiesPanel').then((m) => ({ default: m.VectorPropertiesPanel })));
const VectorReductionPanel = React.lazy(() => import('./VectorReductionPanel').then((m) => ({ default: m.VectorReductionPanel })));
const VectorCopilotPanel = React.lazy(() => import('./VectorCopilotPanel').then((m) => ({ default: m.VectorCopilotPanel })));
const VectorAICreationPanel = React.lazy(() => import('./VectorAICreationPanel').then((m) => ({ default: m.VectorAICreationPanel })));
const AISettingsPanel = React.lazy(() => import('./AISettingsPanel').then((m) => ({ default: m.AISettingsPanel })));
const ComfyUIGeneratePanel = React.lazy(() => import('./ComfyUIGeneratePanel').then((m) => ({ default: m.ComfyUIGeneratePanel })));
const CopilotPanel = React.lazy(() => import('./CopilotPanel').then((m) => ({ default: m.CopilotPanel })));
const TemplateBrowserPanel = React.lazy(() => import('./TemplateBrowserPanel').then((m) => ({ default: m.TemplateBrowserPanel })));
const SliceManagerPanel = React.lazy(() => import('./SliceManagerPanel').then((m) => ({ default: m.SliceManagerPanel })));
const OutputPresetsPanel = React.lazy(() => import('./OutputPresetsPanel').then((m) => ({ default: m.OutputPresetsPanel })));
const PaletteSetsPanel = React.lazy(() => import('./PaletteSetsPanel').then((m) => ({ default: m.PaletteSetsPanel })));
const PartsPanel = React.lazy(() => import('./PartsPanel').then((m) => ({ default: m.PartsPanel })));
const BundlePanel = React.lazy(() => import('./BundlePanel').then((m) => ({ default: m.BundlePanel })));

interface RightDockProps {
  activeMode: WorkspaceMode;
}

/**
 * Declarative tab → component registry.
 *
 * To wire a new panel: add its tab label as a key and the component as the value.
 * Tabs present in MODE_TABS but absent from this registry render a placeholder.
 */
export const PANEL_REGISTRY: Record<string, React.LazyExoticComponent<React.ComponentType>> = {
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
  'Presets': OutputPresetsPanel,
  'Palette Sets': PaletteSetsPanel,
  'Parts': PartsPanel,
  'Bundle': BundlePanel,
};

/**
 * Which tabs appear in each workspace mode, in display order.
 * Tabs beyond TAB_OVERFLOW_THRESHOLD are accessible via the overflow menu.
 */
export const MODE_TABS: Record<WorkspaceMode, string[]> = {
  'project-home': [],
  edit: ['Layers', 'Slices', 'Reference', 'Snapshots', 'Parts', 'Analysis', 'Character', 'Canvas Props', 'Palette', 'Palette Sets', 'Copilot', 'Templates', 'Assets', 'Presets'],
  animate: ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Canvas Props', 'Palette', 'Palette Sets', 'Locomotion'],
  palette: ['Palette Props', 'Palette Sets', 'Validation'],
  ai: ['Copilot', 'Generate', 'Templates', 'AI Settings', 'Layers', 'Provenance'],
  locomotion: ['Locomotion', 'Layers', 'Validation'],
  validate: ['Validation', 'Sprite Props', 'Provenance'],
  export: ['Export Settings', 'Bundle'],
  scene: ['Instances', 'Camera', 'Assets', 'Activity'],
  vector: ['Shapes', 'Shape Props', 'Reduction', 'Vec Copilot', 'AI Create'],
};

const TAB_OVERFLOW_THRESHOLD = 6;

const PANEL_FALLBACK = (
  <div className="dock-panel-placeholder">
    <span className="placeholder-label">Loading…</span>
  </div>
);

function PanelContent({ tabName }: { tabName: string }) {
  const Component = PANEL_REGISTRY[tabName];
  if (Component) {
    return (
      <Suspense fallback={PANEL_FALLBACK}>
        <Component />
      </Suspense>
    );
  }
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
