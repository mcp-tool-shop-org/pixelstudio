import type { WorkspaceMode } from '@glyphstudio/domain';
import { useEffect, useState } from 'react';
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

interface RightDockProps {
  activeMode: WorkspaceMode;
}

const MODE_TABS: Record<WorkspaceMode, string[]> = {
  'project-home': [],
  edit: ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Properties', 'Palette', 'Assets'],
  animate: ['Layers', 'Reference', 'Snapshots', 'Analysis', 'Character', 'Properties', 'Palette', 'Locomotion'],
  palette: ['Palette Props', 'Validation'],
  ai: ['AI Assist', 'Layers', 'Provenance'],
  locomotion: ['Locomotion', 'Layers', 'Validation'],
  validate: ['Validation', 'Properties', 'Provenance'],
  export: ['Export Settings'],
  scene: ['Instances', 'Camera', 'Assets', 'Activity'],
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

  return (
    <div className="dock-panel-placeholder">
      <span className="placeholder-label">{tabName}</span>
    </div>
  );
}

export function RightDock({ activeMode }: RightDockProps) {
  const tabs = MODE_TABS[activeMode] ?? [];
  const [activeTab, setActiveTab] = useState(0);

  // Reset tab index when mode changes or when current index exceeds available tabs
  useEffect(() => {
    setActiveTab((prev) => (prev >= tabs.length ? 0 : prev));
  }, [activeMode, tabs.length]);

  return (
    <aside className="right-dock">
      <div className="dock-tabs">
        {tabs.map((tab, i) => (
          <button
            key={tab}
            className={`dock-tab ${activeTab === i ? 'active' : ''}`}
            onClick={() => setActiveTab(i)}
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
