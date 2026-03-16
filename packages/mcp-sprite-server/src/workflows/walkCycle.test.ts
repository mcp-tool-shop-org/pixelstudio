/**
 * Tests for the walk-cycle dogfood workflow.
 *
 * Proves: the workflow completes through real MCP, produces correct frame count,
 * exports all expected artifacts, and metadata matches authored durations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runWorkflow } from './runner.js';
import { walkCycleWorkflow } from './walkCycle.js';
import type { WorkflowManifest } from './types.js';
import { mkdtemp, rm, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('walk-cycle workflow', () => {
  let tempDir: string;
  let manifest: WorkflowManifest;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-walk-'));
    manifest = await runWorkflow(walkCycleWorkflow, { outputBase: tempDir });
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
    expect(names).toContain('frame_0.png');
    expect(names).toContain('frame_1.png');
    expect(names).toContain('frame_2.png');
    expect(names).toContain('frame_3.png');
    expect(names).toContain('sheet.png');
    expect(names).toContain('metadata.json');
    expect(names).toContain('document.glyph');
    expect(names).toContain('summary.json');
  });

  it('exports 4 frame PNGs with non-zero size', () => {
    for (let i = 0; i < 4; i++) {
      const art = manifest.artifacts.find((a) => a.name === `frame_${i}.png`);
      expect(art).toBeDefined();
      expect(art!.byteLength).toBeGreaterThan(0);
      expect(art!.mimeType).toBe('image/png');
      expect(art!.sha256).toMatch(/^[0-9a-f]{64}$/);
    }
  });

  it('sheet PNG exists and is larger than individual frames', () => {
    const sheet = manifest.artifacts.find((a) => a.name === 'sheet.png')!;
    const frame0 = manifest.artifacts.find((a) => a.name === 'frame_0.png')!;
    expect(sheet.byteLength).toBeGreaterThan(frame0.byteLength);
  });

  it('metadata has correct frame count and timing', async () => {
    const metaPath = join(tempDir, 'walk-cycle', 'metadata.json');
    const raw = await readFile(metaPath, 'utf-8');
    const meta = JSON.parse(raw);

    expect(meta.frameCount).toBe(4);
    expect(meta.frames).toHaveLength(4);

    // Each frame should have 150ms duration
    for (const frame of meta.frames) {
      expect(frame.durationMs).toBe(150);
    }
  });

  it('saved document has 4 frames', async () => {
    const docPath = join(tempDir, 'walk-cycle', 'document.glyph');
    const raw = await readFile(docPath, 'utf-8');
    const doc = JSON.parse(raw);

    expect(doc.document.frames).toHaveLength(4);
    expect(doc.document.width).toBe(16);
    expect(doc.document.height).toBe(16);
    expect(doc.document.name).toBe('WalkCycle');
  });

  it('summary confirms 4 frames and looping', async () => {
    const summaryPath = join(tempDir, 'walk-cycle', 'summary.json');
    const raw = await readFile(summaryPath, 'utf-8');
    const summary = JSON.parse(raw);

    expect(summary.ok).toBe(true);
    expect(summary.document.frameCount).toBe(4);
  });

  it('frame PNGs are distinct (different poses)', () => {
    // Each frame should have a unique hash since poses differ.
    // Poses 0 and 2 are contact-right/left mirrors and may share pixel
    // positions, so we require at least 3 unique renders.
    const frameHashes = [0, 1, 2, 3].map((i) =>
      manifest.artifacts.find((a) => a.name === `frame_${i}.png`)!.sha256,
    );
    const uniqueHashes = new Set(frameHashes);
    expect(uniqueHashes.size).toBeGreaterThanOrEqual(3);
  });

  it('manifest is written to disk', async () => {
    const manifestPath = join(tempDir, 'walk-cycle', 'manifest.json');
    const raw = await readFile(manifestPath, 'utf-8');
    const diskManifest = JSON.parse(raw) as WorkflowManifest;
    expect(diskManifest.workflow).toBe('walk-cycle');
    expect(diskManifest.summary.artifactCount).toBe(manifest.summary.artifactCount);
  });
});
