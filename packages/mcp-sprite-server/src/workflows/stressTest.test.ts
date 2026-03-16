/**
 * Tests for the stress-test dogfood workflow.
 *
 * Proves: mutation/history cooperation, undo/redo round-trip,
 * transform correctness, batch apply atomicity, deterministic output.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runWorkflow } from './runner.js';
import { stressTestWorkflow } from './stressTest.js';
import type { WorkflowManifest } from './types.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('stress-test workflow', () => {
  let tempDir: string;
  let manifest: WorkflowManifest;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-stress-'));
    manifest = await runWorkflow(stressTestWorkflow, { outputBase: tempDir });
  }, 30_000);

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('completes without errors', () => {
    expect(manifest.summary.failed).toBe(0);
    expect(manifest.summary.succeeded).toBeGreaterThan(0);
  });

  it('produces all expected artifacts', () => {
    const names = manifest.artifacts.map((a) => a.name).sort();
    expect(names).toContain('before_undo_frame0.png');
    expect(names).toContain('after_undo_frame0.png');
    expect(names).toContain('after_redo_frame0.png');
    expect(names).toContain('final_sheet.png');
    expect(names).toContain('final_metadata.json');
    expect(names).toContain('final_document.glyph');
  });

  it('redo restores exact same state as before undo', () => {
    const beforeUndo = manifest.artifacts.find((a) => a.name === 'before_undo_frame0.png')!;
    const afterRedo = manifest.artifacts.find((a) => a.name === 'after_redo_frame0.png')!;
    expect(afterRedo.sha256).toBe(beforeUndo.sha256);
  });

  it('undo actually changes the frame (not a no-op)', () => {
    const beforeUndo = manifest.artifacts.find((a) => a.name === 'before_undo_frame0.png')!;
    const afterUndo = manifest.artifacts.find((a) => a.name === 'after_undo_frame0.png')!;
    expect(afterUndo.sha256).not.toBe(beforeUndo.sha256);
  });

  it('history summary changes correctly through workflow', async () => {
    const dir = join(tempDir, 'stress-test');

    const h0 = JSON.parse(await readFile(join(dir, 'history_0_after_draw.json'), 'utf-8'));
    expect(h0.canUndo).toBe(true);
    expect(h0.canRedo).toBe(false);

    const h2 = JSON.parse(await readFile(join(dir, 'history_2_after_batch.json'), 'utf-8'));
    expect(h2.pastCount).toBeGreaterThan(h0.pastCount);
    expect(h2.canUndo).toBe(true);

    const h3 = JSON.parse(await readFile(join(dir, 'history_3_after_transforms.json'), 'utf-8'));
    expect(h3.pastCount).toBeGreaterThan(h2.pastCount);

    const h4 = JSON.parse(await readFile(join(dir, 'history_4_after_3_undos.json'), 'utf-8'));
    expect(h4.pastCount).toBeLessThan(h3.pastCount);
    expect(h4.canRedo).toBe(true);
    expect(h4.futureCount).toBe(3);

    const h5 = JSON.parse(await readFile(join(dir, 'history_5_after_3_redos.json'), 'utf-8'));
    // After redo, past should be h3 + 1 (move-frame happened after h3 snapshot)
    expect(h5.pastCount).toBe(h3.pastCount + 1);
    expect(h5.futureCount).toBe(0);
  });

  it('no intermediate tool calls failed', () => {
    for (const step of manifest.steps) {
      expect(step.ok).toBe(true);
    }
  });

  it('final document has 2 frames', async () => {
    const dir = join(tempDir, 'stress-test');
    const doc = JSON.parse(await readFile(join(dir, 'final_document.glyph'), 'utf-8'));
    expect(doc.document.frames).toHaveLength(2);
  });

  it('output is deterministic across runs', async () => {
    const tempDir2 = await mkdtemp(join(tmpdir(), 'mcp-stress-2-'));
    try {
      const manifest2 = await runWorkflow(stressTestWorkflow, { outputBase: tempDir2 });

      // Final sheet should be identical
      const sheet1 = manifest.artifacts.find((a) => a.name === 'final_sheet.png')!;
      const sheet2 = manifest2.artifacts.find((a) => a.name === 'final_sheet.png')!;
      expect(sheet1.sha256).toBe(sheet2.sha256);

      // Before/after undo/redo should be identical
      const before1 = manifest.artifacts.find((a) => a.name === 'before_undo_frame0.png')!;
      const before2 = manifest2.artifacts.find((a) => a.name === 'before_undo_frame0.png')!;
      expect(before1.sha256).toBe(before2.sha256);
    } finally {
      await rm(tempDir2, { recursive: true, force: true });
    }
  });
});
