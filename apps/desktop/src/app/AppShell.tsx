import { useState } from 'react';
import type { WorkspaceMode } from '@pixelstudio/domain';
import { TopBar } from '../components/TopBar';
import { ToolRail } from '../components/ToolRail';
import { Canvas } from '../components/Canvas';
import { RightDock } from '../components/RightDock';
import { BottomDock } from '../components/BottomDock';
import { ProjectHome } from '../components/ProjectHome';

export function AppShell() {
  const [mode, setMode] = useState<WorkspaceMode>('project-home');

  if (mode === 'project-home') {
    return <ProjectHome onEnterWorkspace={() => setMode('edit')} />;
  }

  return (
    <div className="app-shell">
      <TopBar activeMode={mode} onModeChange={setMode} />
      <div className="workspace-body">
        <ToolRail />
        <Canvas />
        <RightDock activeMode={mode} />
      </div>
      <BottomDock activeMode={mode} />
    </div>
  );
}
