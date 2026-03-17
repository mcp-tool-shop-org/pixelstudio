/**
 * Workflow executor — runs workflow steps against the Tauri backend and stores.
 *
 * Each workflow step calls invoke() or store actions, then reports results
 * back through the workflowStore.
 */

import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { useWorkflowStore, useProjectStore, useSpriteEditorStore, useValidationStore, runSpriteValidation } from '@glyphstudio/state';
import type { WorkflowDef, WorkflowStepResult, WorkflowStepStatus } from '@glyphstudio/domain';

type StepRunner = (inputs: WorkflowInputs) => Promise<WorkflowStepResult>;

export interface WorkflowInputs {
  /** Sprite name for creation workflows. */
  name?: string;
  /** Canvas width. */
  width?: number;
  /** Canvas height. */
  height?: number;
  /** Number of frames for animation workflows. */
  frameCount?: number;
  /** Frame duration in ms. */
  frameDurationMs?: number;
  /** Callback to switch workspace mode. */
  setMode?: (mode: string) => void;
}

function ok(stepId: string, summary: string, durationMs: number): WorkflowStepResult {
  return { stepId, status: 'completed', summary, durationMs };
}
function skip(stepId: string, summary: string): WorkflowStepResult {
  return { stepId, status: 'skipped', summary };
}
function fail(stepId: string, error: string, durationMs: number): WorkflowStepResult {
  return { stepId, status: 'failed', error, durationMs };
}

// ── Step implementations ──

const STEP_RUNNERS: Record<string, Record<string, StepRunner>> = {
  'new-static-sprite': {
    'create-project': async (inputs) => {
      const t0 = Date.now();
      try {
        const result = await invoke<{ projectId: string; name: string }>('new_project', {
          input: {
            name: inputs.name ?? 'Untitled',
            width: inputs.width ?? 64,
            height: inputs.height ?? 64,
            colorMode: 'rgb',
          },
        });
        useProjectStore.getState().setProject(
          result.projectId, result.name, null, 'rgb',
          inputs.width ?? 64, inputs.height ?? 64,
        );
        return ok('create-project', `Created "${result.name}" (${inputs.width ?? 64}×${inputs.height ?? 64})`, Date.now() - t0);
      } catch (e: any) {
        return fail('create-project', String(e), Date.now() - t0);
      }
    },
    'init-canvas': async (inputs) => {
      const t0 = Date.now();
      try {
        await invoke('init_canvas', { width: inputs.width ?? 64, height: inputs.height ?? 64 });
        return ok('init-canvas', 'Canvas initialized with default layer', Date.now() - t0);
      } catch (e: any) {
        return fail('init-canvas', String(e), Date.now() - t0);
      }
    },
    'configure-palette': async () => {
      return skip('configure-palette', 'Using default palette');
    },
    'enter-editor': async (inputs) => {
      const t0 = Date.now();
      inputs.setMode?.('edit');
      return ok('enter-editor', 'Opened edit mode', Date.now() - t0);
    },
  },

  'new-animation-sprite': {
    'create-project': async (inputs) => {
      const t0 = Date.now();
      try {
        const result = await invoke<{ projectId: string; name: string }>('new_project', {
          input: {
            name: inputs.name ?? 'Untitled Animation',
            width: inputs.width ?? 64,
            height: inputs.height ?? 64,
            colorMode: 'rgb',
          },
        });
        useProjectStore.getState().setProject(
          result.projectId, result.name, null, 'rgb',
          inputs.width ?? 64, inputs.height ?? 64,
        );
        return ok('create-project', `Created "${result.name}" (${inputs.width ?? 64}×${inputs.height ?? 64})`, Date.now() - t0);
      } catch (e: any) {
        return fail('create-project', String(e), Date.now() - t0);
      }
    },
    'init-canvas': async (inputs) => {
      const t0 = Date.now();
      try {
        await invoke('init_canvas', { width: inputs.width ?? 64, height: inputs.height ?? 64 });
        return ok('init-canvas', 'Canvas initialized', Date.now() - t0);
      } catch (e: any) {
        return fail('init-canvas', String(e), Date.now() - t0);
      }
    },
    'create-frames': async (inputs) => {
      const t0 = Date.now();
      const count = (inputs.frameCount ?? 4) - 1; // first frame already exists
      try {
        for (let i = 0; i < count; i++) {
          await invoke('create_frame');
        }
        if (inputs.frameDurationMs) {
          const timeline = await invoke<{ frames: Array<{ id: string }> }>('get_timeline');
          for (const frame of timeline.frames) {
            await invoke('set_frame_duration', { frameId: frame.id, durationMs: inputs.frameDurationMs });
          }
        }
        return ok('create-frames', `Created ${count + 1} frames${inputs.frameDurationMs ? ` at ${inputs.frameDurationMs}ms each` : ''}`, Date.now() - t0);
      } catch (e: any) {
        return fail('create-frames', String(e), Date.now() - t0);
      }
    },
    'configure-palette': async () => {
      return skip('configure-palette', 'Using default palette');
    },
    'enter-editor': async (inputs) => {
      const t0 = Date.now();
      inputs.setMode?.('animate');
      return ok('enter-editor', 'Opened animate mode', Date.now() - t0);
    },
  },

  'analyze-sprite': {
    'check-document': async () => {
      const t0 = Date.now();
      const state = useSpriteEditorStore.getState();
      if (!state.document) {
        return fail('check-document', 'No sprite document loaded', Date.now() - t0);
      }
      return ok('check-document', `Document: "${state.document.name}" (${state.document.width}×${state.document.height})`, Date.now() - t0);
    },
    'analyze-bounds': async () => {
      const t0 = Date.now();
      try {
        const result = await invoke<{ empty: boolean; width?: number; height?: number; opaquePixelCount?: number }>('analyze_bounds', { frameIndex: 0 });
        if (result.empty) {
          return ok('analyze-bounds', 'Frame is empty (no opaque pixels)', Date.now() - t0);
        }
        return ok('analyze-bounds', `Bounds: ${result.width}×${result.height}, ${result.opaquePixelCount} opaque pixels`, Date.now() - t0);
      } catch (e: any) {
        return fail('analyze-bounds', String(e), Date.now() - t0);
      }
    },
    'analyze-colors': async () => {
      const t0 = Date.now();
      try {
        const result = await invoke<{ uniqueColors: number; opaqueCount: number }>('analyze_colors', { frameIndex: 0, maxColors: 256 });
        return ok('analyze-colors', `${result.uniqueColors} unique colors, ${result.opaqueCount} opaque pixels`, Date.now() - t0);
      } catch (e: any) {
        return fail('analyze-colors', String(e), Date.now() - t0);
      }
    },
    'compare-frames': async () => {
      const t0 = Date.now();
      const doc = useSpriteEditorStore.getState().document;
      if (!doc || doc.frames.length < 2) {
        return skip('compare-frames', 'Single-frame document — no comparison needed');
      }
      try {
        const result = await invoke<{ identical: boolean; changedPixelCount: number; changedPercent: number }>('compare_frames', { frameA: 0, frameB: 1 });
        if (result.identical) {
          return ok('compare-frames', 'Frames 0 and 1 are identical', Date.now() - t0);
        }
        return ok('compare-frames', `${result.changedPixelCount} pixels changed (${result.changedPercent.toFixed(1)}%)`, Date.now() - t0);
      } catch (e: any) {
        return fail('compare-frames', String(e), Date.now() - t0);
      }
    },
  },

  'validate-sprite': {
    'check-document': async () => {
      const t0 = Date.now();
      const doc = useSpriteEditorStore.getState().document;
      if (!doc) return fail('check-document', 'No sprite document loaded', Date.now() - t0);
      return ok('check-document', `Document: "${doc.name}"`, Date.now() - t0);
    },
    'run-validation': async () => {
      const t0 = Date.now();
      const doc = useSpriteEditorStore.getState().document;
      if (!doc) return fail('run-validation', 'No document', Date.now() - t0);
      const report = runSpriteValidation(doc);
      useValidationStore.getState().setReport(report);
      return ok('run-validation', `Found ${report.issues.length} issues (${report.summary.errorCount} errors, ${report.summary.warningCount} warnings)`, Date.now() - t0);
    },
    'show-results': async (inputs) => {
      const t0 = Date.now();
      inputs.setMode?.('validate');
      return ok('show-results', 'Switched to validate mode', Date.now() - t0);
    },
  },

  'export-review-pack': {
    'check-document': async () => {
      const t0 = Date.now();
      const name = useProjectStore.getState().name;
      if (!name || name === 'Untitled') {
        return fail('check-document', 'No project loaded', Date.now() - t0);
      }
      return ok('check-document', `Project: "${name}"`, Date.now() - t0);
    },
    'export-png': async () => {
      const t0 = Date.now();
      try {
        const filePath = await save({ filters: [{ name: 'PNG', extensions: ['png'] }] });
        if (!filePath) return skip('export-png', 'Export cancelled by user');
        await invoke('export_png', { filePath, frameIndex: 0 });
        return ok('export-png', `Saved to ${filePath}`, Date.now() - t0);
      } catch (e: any) {
        return fail('export-png', String(e), Date.now() - t0);
      }
    },
    'export-gif': async () => {
      const t0 = Date.now();
      const doc = useSpriteEditorStore.getState().document;
      if (!doc || doc.frames.length < 2) {
        return skip('export-gif', 'Single-frame document — GIF skipped');
      }
      try {
        const filePath = await save({ filters: [{ name: 'GIF', extensions: ['gif'] }] });
        if (!filePath) return skip('export-gif', 'Export cancelled by user');
        await invoke('export_animated_gif', { filePath, fps: 12 });
        return ok('export-gif', `Saved to ${filePath}`, Date.now() - t0);
      } catch (e: any) {
        return fail('export-gif', String(e), Date.now() - t0);
      }
    },
    'export-report': async () => {
      const t0 = Date.now();
      const doc = useSpriteEditorStore.getState().document;
      if (!doc) return fail('export-report', 'No document', Date.now() - t0);
      const report = runSpriteValidation(doc);
      const summary = [
        `Validation: ${report.summary.errorCount} errors, ${report.summary.warningCount} warnings, ${report.summary.infoCount} info`,
        `Frames: ${doc.frames.length}`,
        `Canvas: ${doc.width}×${doc.height}`,
        `Palette: ${doc.palette.colors.length} colors`,
      ].join('\n');
      return ok('export-report', summary, Date.now() - t0);
    },
  },
};

/**
 * Execute a workflow step-by-step, updating the store as each step completes.
 */
export async function executeWorkflow(def: WorkflowDef, inputs: WorkflowInputs): Promise<void> {
  const store = useWorkflowStore.getState();
  store.startRun(def.id);

  const runners = STEP_RUNNERS[def.id];
  if (!runners) {
    store.failRun(`No runner registered for workflow "${def.id}"`);
    return;
  }

  for (const step of def.steps) {
    const runner = runners[step.id];
    if (!runner) {
      store.advanceStep(skip(step.id, 'No runner for this step'));
      continue;
    }

    try {
      const result = await runner(inputs);
      store.advanceStep(result);

      // If a step failed and isn't skippable, abort the workflow
      if (result.status === 'failed' && !step.skippable) {
        store.failRun(result.error ?? 'Step failed');
        return;
      }
    } catch (e: any) {
      store.advanceStep(fail(step.id, String(e), 0));
      if (!step.skippable) {
        store.failRun(String(e));
        return;
      }
    }
  }

  // If we got here and the store hasn't already marked complete (via advanceStep),
  // mark it now
  const run = useWorkflowStore.getState().activeRun;
  if (run && run.status === 'running') {
    store.completeRun();
  }
}
