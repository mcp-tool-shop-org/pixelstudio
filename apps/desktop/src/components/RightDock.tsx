import type { WorkspaceMode } from '@glyphstudio/domain';
import { useState } from 'react';
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

  const handleTabClick = (mode: WorkspaceMode, index: number) => {
    setTabByMode((prev) => ({ ...prev, [mode]: index }));
  };

  return (
    <aside className="right-dock">
      <div className="dock-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`dock-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => handleTabClick(activeMode, i)}
          >
            {tab}
          </button>
        ))}
      </div>
      <div className="dock-content">
        <PanelContent tabName={tabs[activeTab] ?? 'No panel'} />
      </div>
    </aside>
  );
}
