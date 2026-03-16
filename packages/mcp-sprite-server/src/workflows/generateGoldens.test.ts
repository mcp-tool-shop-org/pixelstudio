/**
 * Golden generation and verification test.
 *
 * Run with: pnpm --filter @glyphstudio/mcp-sprite-server test -- src/workflows/generateGoldens.test.ts
 *
 * Set UPDATE_GOLDENS=1 to update golden fixtures:
 *   UPDATE_GOLDENS=1 pnpm --filter @glyphstudio/mcp-sprite-server test -- src/workflows/generateGoldens.test.ts
 */

import { describe, it, expect } from 'vitest';
import { runWorkflow } from './runner.js';
import { verifyGoldens, updateGoldens } from './verify.js';
import { walkCycleWorkflow } from './walkCycle.js';
import { cleanupSheetWorkflow } from './cleanupSheet.js';
import { stressTestWorkflow } from './stressTest.js';
import type { WorkflowDefinition } from './types.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '../..');
const fixturesDir = resolve(pkgRoot, 'fixtures');
const outputDir = resolve(fixturesDir, 'output');
const goldenDir = resolve(fixturesDir, 'golden');
const shouldUpdate = process.env.UPDATE_GOLDENS === '1';

const workflows: WorkflowDefinition[] = [
  walkCycleWorkflow,
  cleanupSheetWorkflow,
  stressTestWorkflow,
];

describe('golden fixtures', () => {
  for (const wf of workflows) {
    describe(wf.name, () => {
      it(`runs and ${shouldUpdate ? 'updates goldens' : 'verifies against goldens'}`, async () => {
        const manifest = await runWorkflow(wf, { outputBase: outputDir });
        expect(manifest.summary.failed).toBe(0);

        const wfOutputDir = resolve(outputDir, wf.name);
        const wfGoldenDir = resolve(goldenDir, wf.name);

        if (shouldUpdate) {
          const copied = await updateGoldens(manifest, wfOutputDir, wfGoldenDir);
          expect(copied.length).toBeGreaterThan(0);
          console.log(`  Updated ${copied.length} golden files for ${wf.name}`);
        } else {
          const result = await verifyGoldens(manifest, wfGoldenDir, wfOutputDir);
          for (const check of result.checks) {
            if (check.status === 'mismatch') {
              console.error(`  Mismatch: ${check.artifact} — ${check.detail}`);
            }
          }
          // Non-strict: missing goldens are OK (first run before goldens exist)
          expect(result.passed).toBe(true);
        }
      }, 30_000);
    });
  }
});
