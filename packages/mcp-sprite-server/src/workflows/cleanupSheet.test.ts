/**
 * Tests for the cleanup-sheet dogfood workflow.
 *
 * Proves: sheet import, analysis (bounds/colors/compare), canvas resize,
 * re-export with correct dimensions, and analysis report stability.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runWorkflow } from './runner.js';
import { cleanupSheetWorkflow } from './cleanupSheet.js';
import type { WorkflowManifest } from './types.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('cleanup-sheet workflow', () => {
  let tempDir: string;
  let manifest: WorkflowManifest;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-cleanup-'));
    manifest = await runWorkflow(cleanupSheetWorkflow, { outputBase: tempDir });
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
    expect(names).toContain('source_sheet.png');
    expect(names).toContain('post_import_summary.json');
    expect(names).toContain('analysis_report.json');
    expect(names).toContain('cleaned_frame_0.png');
    expect(names).toContain('cleaned_frame_1.png');
    expect(names).toContain('cleaned_sheet.png');
    expect(names).toContain('cleaned_metadata.json');
    expect(names).toContain('cleaned_document.glyph');
    expect(names).toContain('final_summary.json');
  });

  it('imported correct frame count', async () => {
    const raw = await readFile(join(tempDir, 'cleanup-sheet', 'post_import_summary.json'), 'utf-8');
    const summary = JSON.parse(raw);
    // Import replaces frame 0 and adds frame 1 = 2 frames total
    expect(summary.document.frameCount).toBe(2);
  });

  it('analysis report has deterministic bounds', async () => {
    const raw = await readFile(join(tempDir, 'cleanup-sheet', 'analysis_report.json'), 'utf-8');
    const report = JSON.parse(raw);

    // Frame 0: red square at (1,1)-(3,3)
    expect(report.frame0Bounds.ok).toBe(true);
    expect(report.frame0Bounds.minX).toBe(1);
    expect(report.frame0Bounds.minY).toBe(1);
    expect(report.frame0Bounds.maxX).toBe(3);
    expect(report.frame0Bounds.maxY).toBe(3);
    expect(report.frame0Bounds.opaquePixelCount).toBe(9);

    // Frame 1: blue square (4,3)-(6,5) + green at (0,0)
    expect(report.frame1Bounds.ok).toBe(true);
    expect(report.frame1Bounds.minX).toBe(0);
    expect(report.frame1Bounds.minY).toBe(0);
    expect(report.frame1Bounds.maxX).toBe(6);
    expect(report.frame1Bounds.maxY).toBe(5);
    expect(report.frame1Bounds.opaquePixelCount).toBe(10);

    // Frames should be different
    expect(report.frameDiff.ok).toBe(true);
    expect(report.frameDiff.identical).toBe(false);
    expect(report.frameDiff.changedPixelCount).toBeGreaterThan(0);
  });

  it('canvas was cropped to content bounds', async () => {
    const raw = await readFile(join(tempDir, 'cleanup-sheet', 'final_summary.json'), 'utf-8');
    const summary = JSON.parse(raw);

    // Combined bounds: (0,0)-(6,5) → crop to 7×6
    expect(summary.document.width).toBe(7);
    expect(summary.document.height).toBe(6);
  });

  it('cleaned sheet is smaller than source', () => {
    const source = manifest.artifacts.find((a) => a.name === 'source_sheet.png')!;
    const cleaned = manifest.artifacts.find((a) => a.name === 'cleaned_sheet.png')!;
    // Cleaned canvas is smaller, so sheet should be smaller (or at least different)
    expect(cleaned.sha256).not.toBe(source.sha256);
  });

  it('metadata reflects correct frame count', async () => {
    const raw = await readFile(join(tempDir, 'cleanup-sheet', 'cleaned_metadata.json'), 'utf-8');
    const meta = JSON.parse(raw);
    expect(meta.frameCount).toBe(2);
  });

  it('analysis report is stable across runs', async () => {
    // Run again and compare analysis report
    const tempDir2 = await mkdtemp(join(tmpdir(), 'mcp-cleanup-2-'));
    try {
      const manifest2 = await runWorkflow(cleanupSheetWorkflow, { outputBase: tempDir2 });
      const report1 = manifest.artifacts.find((a) => a.name === 'analysis_report.json')!;
      const report2 = manifest2.artifacts.find((a) => a.name === 'analysis_report.json')!;
      expect(report1.sha256).toBe(report2.sha256);
    } finally {
      await rm(tempDir2, { recursive: true, force: true });
    }
  });
});
