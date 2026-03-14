import type { WorkspaceMode } from '@pixelstudio/domain';
import { useState } from 'react';
import { LayerPanel } from './LayerPanel';
import { AssetBrowserPanel } from './AssetBrowserPanel';
import { SceneInstancesPanel } from './SceneInstancesPanel';
import { CameraKeyframePanel } from './CameraKeyframePanel';

interface RightDockProps {
  activeMode: WorkspaceMode;
}

const MODE_TABS: Record<WorkspaceMode, string[]> = {
  'project-home': [],
  edit: ['Layers', 'Properties', 'Palette', 'Assets'],
  animate: ['Layers', 'Properties', 'Palette', 'Locomotion'],
  palette: ['Palette Props', 'Validation'],
  ai: ['AI Assist', 'Layers', 'Provenance'],
  locomotion: ['Locomotion', 'Layers', 'Validation'],
  validate: ['Validation', 'Properties', 'Provenance'],
  export: ['Export Settings'],
  scene: ['Instances', 'Camera', 'Assets'],
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

  return (
    <div className="dock-panel-placeholder">
      <span className="placeholder-label">{tabName}</span>
    </div>
  );
}

export function RightDock({ activeMode }: RightDockProps) {
  const tabs = MODE_TABS[activeMode] ?? [];
  const [activeTab, setActiveTab] = useState(0);

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
