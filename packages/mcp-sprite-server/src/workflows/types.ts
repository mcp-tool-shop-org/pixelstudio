/**
 * Types for MCP dogfood workflow harness.
 *
 * Workflows are sequences of MCP tool calls that produce artifacts.
 * The harness records every call, captures outputs, and writes a manifest.
 */

/** A single MCP tool call in a workflow. */
export interface WorkflowStep {
  /** Tool name (e.g. 'sprite_session_new') */
  tool: string;
  /** Arguments passed to the tool */
  args: Record<string, unknown>;
}

/** Result of a single tool call. */
export interface StepResult {
  step: number;
  tool: string;
  args: Record<string, unknown>;
  /** Parsed JSON from the tool's text response */
  result: Record<string, unknown>;
  /** Whether result.ok === true */
  ok: boolean;
  /** Wall-clock ms for this call */
  durationMs: number;
}

/** An artifact produced by a workflow. */
export interface WorkflowArtifact {
  /** Logical name (e.g. 'frame_0.png', 'sheet.png', 'metadata.json') */
  name: string;
  /** Relative path from the output directory */
  path: string;
  /** MIME type */
  mimeType: string;
  /** File size in bytes */
  byteLength: number;
  /** SHA-256 hex digest */
  sha256: string;
}

/** Workflow manifest — written after a successful run. */
export interface WorkflowManifest {
  /** Workflow identifier (e.g. 'walk-cycle', 'cleanup-sheet', 'stress-test') */
  workflow: string;
  /** ISO 8601 timestamp of run start */
  startedAt: string;
  /** ISO 8601 timestamp of run end */
  completedAt: string;
  /** Total wall-clock ms */
  totalDurationMs: number;
  /** Ordered list of tool calls with results */
  steps: StepResult[];
  /** Artifacts produced */
  artifacts: WorkflowArtifact[];
  /** Summary stats */
  summary: {
    toolCalls: number;
    succeeded: number;
    failed: number;
    artifactCount: number;
  };
}

/** A workflow definition — a named function that drives the runner. */
export interface WorkflowDefinition {
  /** Stable identifier used in manifest and file paths */
  name: string;
  /** Human-readable description */
  description: string;
  /** The workflow function. Receives a runner context and produces artifacts. */
  run: (ctx: WorkflowContext) => Promise<void>;
}

/** Context passed to workflow functions. */
export interface WorkflowContext {
  /** Call an MCP tool. Throws on transport failure. Returns parsed result. */
  callTool: (tool: string, args: Record<string, unknown>) => Promise<Record<string, unknown>>;
  /** Save a base64-encoded artifact to disk. Returns the artifact metadata. */
  saveArtifact: (name: string, base64: string, mimeType: string) => Promise<WorkflowArtifact>;
  /** Save a JSON artifact to disk. Returns the artifact metadata. */
  saveJsonArtifact: (name: string, data: unknown) => Promise<WorkflowArtifact>;
  /** The output directory for this workflow run. */
  outputDir: string;
}
