import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { WorkspaceMode } from '@glyphstudio/domain';
import { useProjectStore } from '@glyphstudio/state';
import { TopBar } from '../components/TopBar';
import { ToolRail } from '../components/ToolRail';
import { Canvas } from '../components/Canvas';
import { SceneCanvas } from '../components/SceneCanvas';
import { RightDock } from '../components/RightDock';
import { BottomDock } from '../components/BottomDock';
import { ProjectHome } from '../components/ProjectHome';
import { RecoveryPrompt } from '../components/RecoveryPrompt';
import { TransformBar } from '../components/TransformBar';

const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

export function AppShell() {
  const [mode, setMode] = useState<WorkspaceMode>('project-home');
  const [recoveryItems, setRecoveryItems] = useState<Array<{
    projectId: string;
    name: string;
    recoveryPath: string;
    updatedAt: string;
  }>>([]);

  const isDirty = useProjectStore((s) => s.isDirty);
  const setSaveStatus = useProjectStore((s) => s.setSaveStatus);
  const markSaved = useProjectStore((s) => s.markSaved);
  const filePath = useProjectStore((s) => s.filePath);

  // Check for recoverable projects on startup
  useEffect(() => {
    invoke<Array<{ projectId: string; name: string; recoveryPath: string; updatedAt: string }>>('check_recovery')
      .then((items) => {
        if (items.length > 0) {
          setRecoveryItems(items);
        }
      })
      .catch(() => {});
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    const state = useProjectStore.getState();
    if (!state.isDirty && state.filePath) return;

    if (!state.filePath) {
      // Need Save As — for now just log. Full file dialog comes later.
      console.log('Save As not yet wired — no file path set');
      return;
    }

    setSaveStatus('saving');
    try {
      const savedPath = await invoke<string>('save_project', { filePath: state.filePath });
      markSaved(savedPath);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
    }
  }, [setSaveStatus, markSaved]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  // Autosave interval — writes to recovery channel, not the project file
  useEffect(() => {
    if (mode === 'project-home') return;

    const interval = setInterval(() => {
      if (useProjectStore.getState().isDirty) {
        invoke('autosave_recovery').catch((err: unknown) => {
          console.error('Autosave failed:', err);
        });
      }
    }, AUTOSAVE_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [mode]);

  // Window title with dirty indicator
  useEffect(() => {
    const state = useProjectStore.getState();
    const title = `GlyphStudio — ${state.name}${state.isDirty ? ' \u2022' : ''}`;
    document.title = title;
  }, [isDirty]);

  if (recoveryItems.length > 0) {
    return (
      <RecoveryPrompt
        items={recoveryItems}
        onDone={() => {
          setRecoveryItems([]);
          setMode('project-home');
        }}
      />
    );
  }

  if (mode === 'project-home') {
    return <ProjectHome onEnterWorkspace={(m) => setMode(m ?? 'edit')} />;
  }

  return (
    <div className="app-shell">
      <TopBar activeMode={mode} onModeChange={setMode} />
      <TransformBar />
      <div className="workspace-body">
        <ToolRail />
        {mode === 'scene' ? <SceneCanvas /> : <Canvas />}
        <RightDock activeMode={mode} />
      </div>
      <BottomDock activeMode={mode} />
    </div>
  );
}
