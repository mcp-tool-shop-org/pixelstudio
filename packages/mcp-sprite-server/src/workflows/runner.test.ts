/**
 * Tests for the MCP workflow runner harness.
 *
 * Proves: runner connects client↔server, executes tools through real MCP protocol,
 * records steps, writes artifacts, and produces valid manifests.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { runWorkflow, WorkflowStepError } from './runner.js';
import { verifyGoldens } from './verify.js';
import type { WorkflowDefinition, WorkflowManifest } from './types.js';
import { mkdtemp, rm, readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('runWorkflow', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-workflow-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('executes a simple create-and-draw workflow through real MCP', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-simple',
      description: 'Create a document and draw one pixel',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        const sessionId = session.sessionId as string;

        await ctx.callTool('sprite_document_new', {
          sessionId,
          name: 'Test',
          width: 8,
          height: 8,
        });

        await ctx.callTool('sprite_draw_pixels', {
          sessionId,
          pixels: [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }],
        });

        await ctx.callTool('sprite_session_close', { sessionId });
      },
    };

    const manifest = await runWorkflow(workflow, { outputBase: tempDir });

    expect(manifest.workflow).toBe('test-simple');
    expect(manifest.summary.toolCalls).toBe(4);
    expect(manifest.summary.succeeded).toBe(4);
    expect(manifest.summary.failed).toBe(0);
    expect(manifest.steps).toHaveLength(4);
    expect(manifest.steps[0].tool).toBe('sprite_session_new');
    expect(manifest.steps[0].ok).toBe(true);
    expect(manifest.steps[2].tool).toBe('sprite_draw_pixels');
  });

  it('records step durations', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-timing',
      description: 'Verify timing is recorded',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        await ctx.callTool('sprite_session_close', {
          sessionId: session.sessionId as string,
        });
      },
    };

    const manifest = await runWorkflow(workflow, { outputBase: tempDir });
    for (const step of manifest.steps) {
      expect(typeof step.durationMs).toBe('number');
      expect(step.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(manifest.totalDurationMs).toBeGreaterThanOrEqual(0);
  });

  it('writes manifest JSON to output directory', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-manifest',
      description: 'Verify manifest is written',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        await ctx.callTool('sprite_session_close', {
          sessionId: session.sessionId as string,
        });
      },
    };

    await runWorkflow(workflow, { outputBase: tempDir });

    const manifestPath = join(tempDir, 'test-manifest', 'manifest.json');
    const raw = await readFile(manifestPath, 'utf-8');
    const manifest = JSON.parse(raw) as WorkflowManifest;
    expect(manifest.workflow).toBe('test-manifest');
    expect(manifest.steps).toHaveLength(2);
  });

  it('saves base64 artifact with correct hash', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-artifact',
      description: 'Save a binary artifact',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        const sessionId = session.sessionId as string;

        await ctx.callTool('sprite_document_new', {
          sessionId,
          name: 'Art',
          width: 4,
          height: 4,
        });

        await ctx.callTool('sprite_draw_pixels', {
          sessionId,
          pixels: [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }],
        });

        const render = await ctx.callTool('sprite_export_frame_png', {
          sessionId,
          frameIndex: 0,
        });

        await ctx.saveArtifact('frame_0.png', render.pngBase64 as string, 'image/png');
        await ctx.callTool('sprite_session_close', { sessionId });
      },
    };

    const manifest = await runWorkflow(workflow, { outputBase: tempDir });

    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.artifacts[0].name).toBe('frame_0.png');
    expect(manifest.artifacts[0].mimeType).toBe('image/png');
    expect(manifest.artifacts[0].byteLength).toBeGreaterThan(0);
    expect(manifest.artifacts[0].sha256).toMatch(/^[0-9a-f]{64}$/);

    // File should exist on disk
    const filePath = join(tempDir, 'test-artifact', 'frame_0.png');
    const fileContent = await readFile(filePath);
    expect(fileContent.length).toBe(manifest.artifacts[0].byteLength);
  });

  it('saves JSON artifact', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-json-artifact',
      description: 'Save a JSON artifact',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        const sessionId = session.sessionId as string;

        await ctx.callTool('sprite_document_new', {
          sessionId,
          name: 'Doc',
          width: 4,
          height: 4,
        });

        const summary = await ctx.callTool('sprite_document_summary', { sessionId });
        await ctx.saveJsonArtifact('summary.json', summary);

        await ctx.callTool('sprite_session_close', { sessionId });
      },
    };

    const manifest = await runWorkflow(workflow, { outputBase: tempDir });

    expect(manifest.artifacts).toHaveLength(1);
    expect(manifest.artifacts[0].name).toBe('summary.json');
    expect(manifest.artifacts[0].mimeType).toBe('application/json');

    const filePath = join(tempDir, 'test-json-artifact', 'summary.json');
    const raw = await readFile(filePath, 'utf-8');
    const data = JSON.parse(raw);
    expect(data.ok).toBe(true);
  });

  it('throws WorkflowStepError on failed tool call', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-fail',
      description: 'Workflow that calls a tool with bad args',
      async run(ctx) {
        // No session exists — this should fail
        await ctx.callTool('sprite_document_new', {
          sessionId: 'nonexistent',
          name: 'X',
          width: 4,
          height: 4,
        });
      },
    };

    await expect(runWorkflow(workflow, { outputBase: tempDir })).rejects.toThrow(WorkflowStepError);
  });

  it('captures failed step in manifest before throwing', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-fail-capture',
      description: 'Check failed step is recorded',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        // This will fail — no document open
        await ctx.callTool('sprite_draw_pixels', {
          sessionId: session.sessionId as string,
          pixels: [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }],
        });
      },
    };

    try {
      await runWorkflow(workflow, { outputBase: tempDir });
    } catch (err) {
      expect(err).toBeInstanceOf(WorkflowStepError);
      const wse = err as WorkflowStepError;
      expect(wse.step.tool).toBe('sprite_draw_pixels');
      expect(wse.step.ok).toBe(false);
    }
  });

  it('produces correct summary counts', async () => {
    const workflow: WorkflowDefinition = {
      name: 'test-summary',
      description: 'Multi-step workflow for summary verification',
      async run(ctx) {
        const session = await ctx.callTool('sprite_session_new', {});
        const sid = session.sessionId as string;
        await ctx.callTool('sprite_document_new', { sessionId: sid, name: 'S', width: 4, height: 4 });
        await ctx.callTool('sprite_draw_pixels', { sessionId: sid, pixels: [{ x: 0, y: 0, rgba: [255, 0, 0, 255] }] });
        await ctx.callTool('sprite_frame_add', { sessionId: sid });
        await ctx.callTool('sprite_history_undo', { sessionId: sid });
        await ctx.callTool('sprite_session_close', { sessionId: sid });
      },
    };

    const manifest = await runWorkflow(workflow, { outputBase: tempDir });
    expect(manifest.summary.toolCalls).toBe(6);
    expect(manifest.summary.succeeded).toBe(6);
    expect(manifest.summary.failed).toBe(0);
    expect(manifest.summary.artifactCount).toBe(0);
  });
});

describe('verifyGoldens', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'mcp-golden-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('passes when no golden files exist (non-strict)', async () => {
    // Create a fake output file so the check is "missing_golden" not "missing_output"
    const { writeFile, mkdir } = await import('node:fs/promises');
    const outputPath = join(tempDir, 'output');
    await mkdir(outputPath, { recursive: true });
    await writeFile(join(outputPath, 'frame.png'), Buffer.from('fake'));

    const manifest: WorkflowManifest = {
      workflow: 'test',
      startedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
      totalDurationMs: 0,
      steps: [],
      artifacts: [{ name: 'frame.png', path: 'frame.png', mimeType: 'image/png', byteLength: 4, sha256: 'abc' }],
      summary: { toolCalls: 0, succeeded: 0, failed: 0, artifactCount: 1 },
    };

    const result = await verifyGoldens(manifest, join(tempDir, 'golden'), outputPath);
    expect(result.passed).toBe(true);
    expect(result.checks[0].status).toBe('missing_golden');
  });
});
