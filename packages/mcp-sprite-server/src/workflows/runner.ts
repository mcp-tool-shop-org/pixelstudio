/**
 * MCP workflow runner — executes workflow definitions through the real MCP protocol.
 *
 * Uses InMemoryTransport to connect a Client ↔ Server pair in-process.
 * Every tool call goes through the full MCP JSON-RPC path. No shortcuts.
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createGlyphStudioServer } from '../server.js';
import { writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type {
  WorkflowDefinition,
  WorkflowManifest,
  WorkflowContext,
  WorkflowArtifact,
  StepResult,
} from './types.js';

export interface RunWorkflowOptions {
  /** Base output directory. Workflow outputs go to <outputBase>/<workflow.name>/ */
  outputBase: string;
  /** If true, write the manifest JSON to the output directory. Default true. */
  writeManifest?: boolean;
}

/**
 * Execute a workflow definition through the real MCP server.
 *
 * 1. Creates a GlyphStudio MCP server
 * 2. Connects a Client via InMemoryTransport
 * 3. Runs the workflow, recording every tool call
 * 4. Writes manifest and returns it
 */
export async function runWorkflow(
  workflow: WorkflowDefinition,
  options: RunWorkflowOptions,
): Promise<WorkflowManifest> {
  const outputDir = join(options.outputBase, workflow.name);
  await mkdir(outputDir, { recursive: true });

  // Wire up client ↔ server over in-memory transport
  const { server } = createGlyphStudioServer();
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

  await server.connect(serverTransport);
  const client = new Client({ name: 'dogfood-runner', version: '1.0.0' });
  await client.connect(clientTransport);

  const steps: StepResult[] = [];
  const artifacts: WorkflowArtifact[] = [];
  const startedAt = new Date();

  // Build context for the workflow function
  const ctx: WorkflowContext = {
    outputDir,

    async callTool(tool: string, args: Record<string, unknown>) {
      const stepIndex = steps.length;
      const t0 = performance.now();

      const response = await client.callTool({ name: tool, arguments: args });
      const durationMs = Math.round(performance.now() - t0);

      // Extract text and image content from MCP response
      const contentBlocks = response.content as Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
      const text = contentBlocks.find((c) => c.type === 'text')?.text ?? '{}';
      let parsed: Record<string, unknown>;
      try {
        parsed = JSON.parse(text) as Record<string, unknown>;
      } catch {
        // MCP-level errors may return non-JSON text
        parsed = { ok: false, code: 'mcp_error', message: text };
      }

      // Attach image data if the tool returned an image content block
      const imageBlock = contentBlocks.find((c) => c.type === 'image');
      if (imageBlock?.data) {
        parsed._imageBase64 = imageBlock.data;
        parsed._imageMimeType = imageBlock.mimeType ?? 'image/png';
      }

      const step: StepResult = {
        step: stepIndex,
        tool,
        args,
        result: parsed,
        ok: parsed.ok === true,
        durationMs,
      };
      steps.push(step);

      if (!step.ok) {
        throw new WorkflowStepError(step);
      }

      return parsed;
    },

    async saveArtifact(name: string, base64: string, mimeType: string) {
      const buf = Buffer.from(base64, 'base64');
      const filePath = join(outputDir, name);
      await writeFile(filePath, buf);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      const artifact: WorkflowArtifact = {
        name,
        path: name,
        mimeType,
        byteLength: buf.length,
        sha256,
      };
      artifacts.push(artifact);
      return artifact;
    },

    async saveJsonArtifact(name: string, data: unknown) {
      const json = JSON.stringify(data, null, 2);
      const buf = Buffer.from(json, 'utf-8');
      const filePath = join(outputDir, name);
      await writeFile(filePath, buf);
      const sha256 = createHash('sha256').update(buf).digest('hex');
      const artifact: WorkflowArtifact = {
        name,
        path: name,
        mimeType: 'application/json',
        byteLength: buf.length,
        sha256,
      };
      artifacts.push(artifact);
      return artifact;
    },
  };

  // Run the workflow
  try {
    await workflow.run(ctx);
  } finally {
    await client.close();
    await server.close();
  }

  const completedAt = new Date();
  const manifest: WorkflowManifest = {
    workflow: workflow.name,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    totalDurationMs: completedAt.getTime() - startedAt.getTime(),
    steps,
    artifacts,
    summary: {
      toolCalls: steps.length,
      succeeded: steps.filter((s) => s.ok).length,
      failed: steps.filter((s) => !s.ok).length,
      artifactCount: artifacts.length,
    },
  };

  if (options.writeManifest !== false) {
    const manifestPath = join(outputDir, 'manifest.json');
    await writeFile(manifestPath, JSON.stringify(manifest, null, 2));
  }

  return manifest;
}

/** Error thrown when a workflow step fails. */
export class WorkflowStepError extends Error {
  public readonly step: StepResult;

  constructor(step: StepResult) {
    const code = (step.result as Record<string, unknown>).code ?? 'unknown';
    const msg = (step.result as Record<string, unknown>).message ?? 'Tool call failed';
    super(`Step ${step.step} (${step.tool}) failed: [${code}] ${msg}`);
    this.name = 'WorkflowStepError';
    this.step = step;
  }
}
