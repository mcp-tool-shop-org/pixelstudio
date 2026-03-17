import type { WorkspaceMode } from '@glyphstudio/domain';
import { useEffect, useRef, useState } from 'react';

const TAB_OVERFLOW_THRESHOLD = 6;
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

interface RightDockProps {
  activeMode: WorkspaceMode;
}

const MODE_TABS: Record<WorkspaceMode, string[]> = {
  'project-home': [],
  edit: ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Properties', 'Palette', 'Copilot', 'Templates', 'Assets'],
  animate: ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Properties', 'Palette', 'Locomotion'],
  palette: ['Palette Props', 'Validation'],
  ai: ['Copilot', 'Generate', 'Templates', 'AI Settings', 'Layers', 'Provenance'],
  locomotion: ['Locomotion', 'Layers', 'Validation'],
  validate: ['Validation', 'Properties', 'Provenance'],
  export: ['Export Settings'],
  scene: ['Instances', 'Camera', 'Assets', 'Activity'],
  vector: ['Shapes', 'Properties', 'Reduction', 'Vec Copilot', 'AI Create'],
};

function PanelContent({ tabName }: { tabName: string }) {
  if (tabName === 'Layers') {
    return <LayerPanel />;
  }
  if (tabName === 'Assets') {
    return <AssetBrowserPanel />;
  }
  if (tabName === 'Instances') {
    return <SceneInstancesPanel />;
  }
  if (tabName === 'Camera') {
    return <CameraKeyframePanel />;
  }
  if (tabName === 'Character') {
    return <CharacterBuilderPanel />;
  }
  if (tabName === 'Activity') {
    return <SceneProvenancePanel />;
  }
  if (tabName === 'Reference') {
    return <ReferencePanel />;
  }
  if (tabName === 'Snapshots') {
    return <SnapshotPanel />;
  }
  if (tabName === 'Analysis') {
    return <AnalysisPanel />;
  }
  if (tabName === 'Palette Props') {
    return <PalettePropsPanel />;
  }
  if (tabName === 'Validation') {
    return <ValidationPanel />;
  }
  if (tabName === 'Shapes') {
    return <VectorShapesPanel />;
  }
  if (tabName === 'Properties') {
    return <VectorPropertiesPanel />;
  }
  if (tabName === 'Reduction') {
    return <VectorReductionPanel />;
  }
  if (tabName === 'Vec Copilot') {
    return <VectorCopilotPanel />;
  }
  if (tabName === 'AI Create') {
    return <VectorAICreationPanel />;
  }
  if (tabName === 'Copilot') {
    return <CopilotPanel />;
  }
  if (tabName === 'Generate') {
    return <ComfyUIGeneratePanel />;
  }
  if (tabName === 'Templates') {
    return <TemplateBrowserPanel />;
  }
  if (tabName === 'AI Settings') {
    return <AISettingsPanel />;
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
