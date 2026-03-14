import type { WorkspaceMode } from '@pixelstudio/domain';
import { useState } from 'react';

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
};

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
        <div className="dock-panel-placeholder">
          <span className="placeholder-label">{tabs[activeTab] ?? 'No panel'}</span>
        </div>
      </div>
    </aside>
  );
}
