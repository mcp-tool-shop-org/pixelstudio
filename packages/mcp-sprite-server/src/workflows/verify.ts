/**
 * Golden fixture verification — compares workflow output against checked-in golden files.
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import type { WorkflowManifest, WorkflowArtifact } from './types.js';

export interface VerifyResult {
  workflow: string;
  passed: boolean;
  checks: VerifyCheck[];
}

export interface VerifyCheck {
  artifact: string;
  status: 'match' | 'mismatch' | 'missing_golden' | 'missing_output';
  expected?: string;
  actual?: string;
  detail?: string;
}

/**
 * Verify a workflow's output against golden fixtures.
 *
 * Strategy:
 * - JSON/manifest files: exact byte equality
 * - PNG files: SHA-256 comparison (deterministic rendering assumed)
 * - If golden doesn't exist for an artifact: 'missing_golden' (not a failure by default)
 */
export async function verifyGoldens(
  manifest: WorkflowManifest,
  goldenDir: string,
  outputDir: string,
  options?: { strictMissingGolden?: boolean },
): Promise<VerifyResult> {
  const checks: VerifyCheck[] = [];
  const strict = options?.strictMissingGolden ?? false;

  // Also verify manifest itself if golden manifest exists
  const goldenManifestPath = join(goldenDir, 'manifest.json');
  const hasGoldenManifest = await fileExists(goldenManifestPath);

  if (hasGoldenManifest) {
    const goldenManifestRaw = await readFile(goldenManifestPath, 'utf-8');
    const goldenManifest = JSON.parse(goldenManifestRaw) as WorkflowManifest;

    // Compare summary shape (not timestamps or durations)
    checks.push(verifySummaryShape(manifest, goldenManifest));
  }

  for (const artifact of manifest.artifacts) {
    const goldenPath = join(goldenDir, artifact.path);
    const outputPath = join(outputDir, artifact.path);

    const goldenExists = await fileExists(goldenPath);
    const outputExists = await fileExists(outputPath);

    if (!outputExists) {
      checks.push({
        artifact: artifact.name,
        status: 'missing_output',
        detail: `Output file not found: ${outputPath}`,
      });
      continue;
    }

    if (!goldenExists) {
      checks.push({
        artifact: artifact.name,
        status: 'missing_golden',
        detail: `No golden file at ${goldenPath}. Run with --update-goldens to create.`,
      });
      continue;
    }

    // Compare by SHA-256
    const goldenBuf = await readFile(goldenPath);
    const outputBuf = await readFile(outputPath);
    const goldenHash = createHash('sha256').update(goldenBuf).digest('hex');
    const outputHash = createHash('sha256').update(outputBuf).digest('hex');

    if (goldenHash === outputHash) {
      checks.push({
        artifact: artifact.name,
        status: 'match',
        expected: goldenHash,
        actual: outputHash,
      });
    } else {
      checks.push({
        artifact: artifact.name,
        status: 'mismatch',
        expected: goldenHash,
        actual: outputHash,
        detail: `Golden: ${goldenHash.slice(0, 12)}… Output: ${outputHash.slice(0, 12)}…`,
      });
    }
  }

  const passed = checks.every(
    (c) =>
      c.status === 'match' ||
      (c.status === 'missing_golden' && !strict),
  );

  return { workflow: manifest.workflow, passed, checks };
}

/**
 * Copy output artifacts to the golden directory (for updating goldens).
 */
export async function updateGoldens(
  manifest: WorkflowManifest,
  outputDir: string,
  goldenDir: string,
): Promise<string[]> {
  const { mkdir, copyFile } = await import('node:fs/promises');
  await mkdir(goldenDir, { recursive: true });

  const copied: string[] = [];
  for (const artifact of manifest.artifacts) {
    const src = join(outputDir, artifact.path);
    const dst = join(goldenDir, artifact.path);
    await copyFile(src, dst);
    copied.push(artifact.name);
  }

  // Also copy manifest
  const manifestSrc = join(outputDir, 'manifest.json');
  const manifestDst = join(goldenDir, 'manifest.json');
  if (await fileExists(manifestSrc)) {
    await copyFile(manifestSrc, manifestDst);
    copied.push('manifest.json');
  }

  return copied;
}

/** Compare manifest summary shapes (ignoring timestamps and durations). */
function verifySummaryShape(actual: WorkflowManifest, golden: WorkflowManifest): VerifyCheck {
  const a = actual.summary;
  const g = golden.summary;

  if (
    a.toolCalls === g.toolCalls &&
    a.succeeded === g.succeeded &&
    a.failed === g.failed &&
    a.artifactCount === g.artifactCount
  ) {
    return { artifact: 'manifest.json', status: 'match', detail: 'Summary shape matches' };
  }

  return {
    artifact: 'manifest.json',
    status: 'mismatch',
    detail: `Summary mismatch: expected ${g.toolCalls} calls/${g.artifactCount} artifacts, got ${a.toolCalls} calls/${a.artifactCount} artifacts`,
  };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await readFile(path);
    return true;
  } catch {
    return false;
  }
}
