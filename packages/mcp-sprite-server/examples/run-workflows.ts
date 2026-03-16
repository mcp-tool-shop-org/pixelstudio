#!/usr/bin/env npx tsx
/**
 * CLI entry point for running MCP dogfood workflows.
 *
 * Usage:
 *   npx tsx packages/mcp-sprite-server/examples/run-workflows.ts [workflow-name] [--update-goldens] [--verify]
 *
 * Examples:
 *   npx tsx packages/mcp-sprite-server/examples/run-workflows.ts              # run all
 *   npx tsx packages/mcp-sprite-server/examples/run-workflows.ts walk-cycle   # run one
 *   npx tsx packages/mcp-sprite-server/examples/run-workflows.ts --verify     # verify goldens
 *   npx tsx packages/mcp-sprite-server/examples/run-workflows.ts --update-goldens  # update goldens
 */

import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runWorkflow } from '../src/workflows/runner.js';
import { verifyGoldens, updateGoldens } from '../src/workflows/verify.js';
import type { WorkflowDefinition, WorkflowManifest } from '../src/workflows/types.js';

// Workflow registry — workflows are added here as they're built
const registry: WorkflowDefinition[] = [];

/** Register a workflow. Called by workflow modules. */
export function registerWorkflow(def: WorkflowDefinition): void {
  registry.push(def);
}

// ── Paths ──
const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');
const fixturesDir = resolve(pkgRoot, 'fixtures');
const outputDir = resolve(fixturesDir, 'output');
const goldenDir = resolve(fixturesDir, 'golden');

// ── Parse CLI args ──
const args = process.argv.slice(2);
const updateGoldensFlag = args.includes('--update-goldens');
const verifyFlag = args.includes('--verify');
const workflowFilter = args.find((a) => !a.startsWith('--'));

async function main() {
  // Dynamic imports of workflow modules (they self-register)
  // Added in MCP.5.2–5.4 slices:
  // await import('../src/workflows/walkCycle.js');
  // await import('../src/workflows/cleanupSheet.js');
  // await import('../src/workflows/stressTest.js');

  const workflows = workflowFilter
    ? registry.filter((w) => w.name === workflowFilter)
    : registry;

  if (workflows.length === 0 && registry.length === 0) {
    console.log('No workflows registered yet. Workflows are added in MCP.5.2–5.4.');
    process.exit(0);
  }

  if (workflows.length === 0) {
    console.error(`Unknown workflow: ${workflowFilter}`);
    console.error(`Available: ${registry.map((w) => w.name).join(', ')}`);
    process.exit(1);
  }

  const results: Array<{ name: string; manifest: WorkflowManifest }> = [];

  for (const wf of workflows) {
    console.log(`\n▸ Running workflow: ${wf.name}`);
    console.log(`  ${wf.description}`);

    const manifest = await runWorkflow(wf, { outputBase: outputDir });

    console.log(`  ✓ ${manifest.summary.toolCalls} tool calls, ${manifest.summary.artifactCount} artifacts, ${manifest.totalDurationMs}ms`);
    results.push({ name: wf.name, manifest });

    if (updateGoldensFlag) {
      const wfOutputDir = resolve(outputDir, wf.name);
      const wfGoldenDir = resolve(goldenDir, wf.name);
      const copied = await updateGoldens(manifest, wfOutputDir, wfGoldenDir);
      console.log(`  ✓ Updated ${copied.length} golden files`);
    }

    if (verifyFlag || !updateGoldensFlag) {
      const wfOutputDir = resolve(outputDir, wf.name);
      const wfGoldenDir = resolve(goldenDir, wf.name);
      const result = await verifyGoldens(manifest, wfGoldenDir, wfOutputDir);

      for (const check of result.checks) {
        const icon = check.status === 'match' ? '✓' : check.status === 'missing_golden' ? '?' : '✗';
        console.log(`  ${icon} ${check.artifact}: ${check.status}${check.detail ? ` — ${check.detail}` : ''}`);
      }

      if (!result.passed) {
        console.error(`  ✗ Golden verification failed for ${wf.name}`);
        process.exitCode = 1;
      }
    }
  }

  // Summary
  console.log(`\n── Summary ──`);
  for (const { name, manifest } of results) {
    console.log(`  ${name}: ${manifest.summary.succeeded}/${manifest.summary.toolCalls} OK, ${manifest.summary.artifactCount} artifacts`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
