import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
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
import { VectorWorkspace } from '../components/VectorWorkspace';
import { VectorSourceBanner } from '../components/VectorSourceBanner';
import { EditorStatusBar } from '../components/EditorStatusBar';
import { ToastStack } from '../components/ToastStack';
import { ShortcutHelpOverlay } from '../components/ShortcutHelpOverlay';
import { toast } from '../lib/toast';

const AUTOSAVE_INTERVAL_MS = 30_000; // 30 seconds

export function AppShell() {
  const [mode, setMode] = useState<WorkspaceMode>('project-home');
  const [showHelp, setShowHelp] = useState(false);
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

  // Check for recoverable projects — deferred until the browser is idle so it
  // does not block the initial paint or project-home mount.
  useEffect(() => {
    const run = () => {
      invoke<Array<{ projectId: string; name: string; recoveryPath: string; updatedAt: string }>>('check_recovery')
        .then((items) => {
          if (items.length > 0) setRecoveryItems(items);
        })
        .catch(() => {});
    };

    // requestIdleCallback is not available in all WebViews; fall back to a
    // short timeout which still yields to the renderer before the IPC call.
    if (typeof requestIdleCallback === 'function') {
      const id = requestIdleCallback(run, { timeout: 2000 });
      return () => cancelIdleCallback(id);
    } else {
      const id = setTimeout(run, 200);
      return () => clearTimeout(id);
    }
  }, []);

  // Save handler
  const handleSave = useCallback(async () => {
    const state = useProjectStore.getState();
    if (!state.isDirty && state.filePath) return;

    if (!state.filePath) {
      setSaveStatus('saving');
      try {
        const chosen = await save({
          title: 'Save Project As',
          defaultPath: `${state.name || 'untitled'}.pxs`,
          filters: [{ name: 'GlyphStudio Project', extensions: ['pxs'] }],
        });
        if (!chosen) { setSaveStatus('idle'); return; }
        const savedPath = await invoke<string>('save_project', { filePath: chosen });
        markSaved(savedPath);
      } catch (err) {
        console.error('Save As failed:', err);
        setSaveStatus('error');
        toast.error('Save failed — check file permissions');
      }
      return;
    }

    setSaveStatus('saving');
    try {
      const savedPath = await invoke<string>('save_project', { filePath: state.filePath });
      markSaved(savedPath);
    } catch (err) {
      console.error('Save failed:', err);
      setSaveStatus('error');
      toast.error('Save failed — check file permissions');
    }
  }, [setSaveStatus, markSaved]);

  // Ctrl+S keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.code === 'KeyS' && !e.shiftKey) {
        e.preventDefault();
        handleSave();
      }
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) {
        const tag = (e.target as HTMLElement).tagName;
        if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
          setShowHelp((v) => !v);
        }
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

  // Listen for vector-to-sprite handoff events
  useEffect(() => {
    const handleHandoff = () => setMode('edit');
    window.addEventListener('glyphstudio:handoff-to-edit', handleHandoff);
    return () => window.removeEventListener('glyphstudio:handoff-to-edit', handleHandoff);
  }, []);

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
      <ToastStack />
      <ShortcutHelpOverlay isOpen={showHelp} onClose={() => setShowHelp(false)} />
      <TopBar activeMode={mode} onModeChange={setMode} onShowHelp={() => setShowHelp(true)} onSave={handleSave} />
      {mode === 'edit' && <VectorSourceBanner />}
      <TransformBar />
      <div className="workspace-body">
        {mode === 'vector' ? (
          <VectorWorkspace />
        ) : (
          <>
            <ToolRail />
            {mode === 'scene' ? <SceneCanvas /> : <Canvas />}
          </>
        )}
        <RightDock activeMode={mode} />
      </div>
      <EditorStatusBar />
      <BottomDock activeMode={mode} />
    </div>
  );
}
