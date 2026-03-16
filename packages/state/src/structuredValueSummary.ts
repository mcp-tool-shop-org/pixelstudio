/**
 * Structured value summary contract for provenance drilldown.
 *
 * Provides reusable helpers for summarizing multi-field before/after
 * changes in a stable, human-readable way. Used by drilldown renderers
 * to show only meaningful changed fields without inline duplication.
 *
 * ## Diff-depth audit (Stage 23.1)
 *
 * Classification of all 20 operation kinds:
 *
 * **Good enough (19/20):**
 * - Instance lifecycle (2): add/remove — name, position, instanceId
 * - Instance move (1): before/after position
 * - Instance properties (5): visibility, opacity, layer, clip, parallax — focused before/after
 * - Character source (3): unlink/relink/reapply — build name, slot changes
 * - Character overrides (3): set/remove/clear-all — slot, mode, count
 * - Camera (1): changed fields with before/after values (already uses changedFields filtering)
 * - Keyframes (4): add/remove shows full state, move shows tick transition,
 *   edited already shows only changed fields with before/after
 *
 * **Correct but shallow (1/20):**
 * - Playback (1): `PlaybackDiff` is `{ type: 'playback' }` — zero detail about
 *   FPS/looping values. Needs before/after playback config in drilldown source.
 *
 * **Improvement targets for 23.2+:**
 * - Deepen PlaybackDiff: capture before/after FPS + looping via PLAYBACK_FIELD_CONFIGS
 * - Camera renderer: adopt CAMERA_FIELD_CONFIGS for human-readable labels (Pan X/Pan Y/Zoom)
 * - Keyframe-edited renderer: use KEYFRAME_FIELD_CONFIGS for stable changed-field extraction
 * - Keyframe-moved renderer: suppress unchanged position/zoom/interpolation fields (noise)
 */

// ── Types ──

/** A single field change extracted from before/after comparison. */
export interface FieldChange {
  /** Stable field key (e.g., 'x', 'zoom', 'interpolation'). */
  field: string;
  /** Human-readable label (e.g., 'Pan X', 'Zoom'). */
  label: string;
  /** Formatted before value. */
  before: string;
  /** Formatted after value. */
  after: string;
}

/** Configuration for a field that can be compared. */
export interface FieldConfig {
  /** Field key on the source object. */
  key: string;
  /** Human-readable label for display. */
  label: string;
  /** Optional formatter. Defaults to String(). */
  format?: (value: unknown) => string;
}

/** Summary of a structured multi-field change. */
export interface StructuredValueSummary {
  /** Fields that actually changed (stable order matching fieldConfigs). */
  changes: FieldChange[];
  /** All field keys that changed (stable order). */
  changedFieldKeys: string[];
  /** True if no fields changed. */
  isNoOp: boolean;
  /** Compact one-line description of what changed. */
  description: string;
}

/** Summary family classification. */
export type SummaryFamily =
  | 'scalar'
  | 'position'
  | 'multi-field'
  | 'state-transition'
  | 'fallback';

// ── Formatters ──

/** Format a number with up to 1 decimal, integers shown without decimal. */
export function fmtNumber(v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '');
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Format a percentage from 0–1. */
export function fmtPercent(v: unknown): string {
  if (typeof v !== 'number') return String(v ?? '');
  return `${Math.round(v * 100)}%`;
}

/** Format a boolean as a human-readable state. */
export function fmtBool(v: unknown): string {
  return v ? 'Yes' : 'No';
}

/** Pass-through string formatter. */
export function fmtString(v: unknown): string {
  return String(v ?? '');
}

// ── Changed-field extraction ──

/**
 * Extract changed fields from before/after objects using field configs.
 *
 * Returns fields in the order specified by fieldConfigs (stable, intentional).
 * Only includes fields where the before and after values differ.
 */
export function extractChangedFields<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldConfigs: FieldConfig[],
): FieldChange[] {
  const changes: FieldChange[] = [];
  for (const config of fieldConfigs) {
    const bVal = before[config.key];
    const aVal = after[config.key];
    if (bVal !== aVal) {
      const fmt = config.format ?? fmtString;
      changes.push({
        field: config.key,
        label: config.label,
        before: fmt(bVal),
        after: fmt(aVal),
      });
    }
  }
  return changes;
}

/**
 * Summarize a multi-field structured value change.
 *
 * Compares before/after objects across configured fields, returns only
 * changed fields in stable config order with formatted values.
 */
export function summarizeMultiFieldChange<T extends Record<string, unknown>>(
  before: T,
  after: T,
  fieldConfigs: FieldConfig[],
  contextLabel?: string,
): StructuredValueSummary {
  const changes = extractChangedFields(before, after, fieldConfigs);
  const changedFieldKeys = changes.map((c) => c.field);
  const isNoOp = changes.length === 0;

  let description: string;
  if (isNoOp) {
    description = contextLabel ? `${contextLabel}: no changes` : 'No changes';
  } else if (changes.length === 1) {
    const c = changes[0];
    description = contextLabel
      ? `${contextLabel}: ${c.label} ${c.before} → ${c.after}`
      : `${c.label}: ${c.before} → ${c.after}`;
  } else {
    const labels = changes.map((c) => c.label).join(', ');
    description = contextLabel
      ? `${contextLabel}: ${labels}`
      : labels;
  }

  return { changes, changedFieldKeys, isNoOp, description };
}

/**
 * Create a single-field summary (scalar change).
 */
export function summarizeScalarChange(
  label: string,
  before: string,
  after: string,
): StructuredValueSummary {
  const isNoOp = before === after;
  return {
    changes: isNoOp ? [] : [{ field: label.toLowerCase(), label, before, after }],
    changedFieldKeys: isNoOp ? [] : [label.toLowerCase()],
    isNoOp,
    description: isNoOp ? `${label}: no change` : `${label}: ${before} → ${after}`,
  };
}

/**
 * Create an honest fallback summary when structure is unknown or partial.
 */
export function fallbackSummary(text: string): StructuredValueSummary {
  return {
    changes: [],
    changedFieldKeys: [],
    isNoOp: false,
    description: text,
  };
}

// ── Classify summary family ──

/**
 * Classify what kind of summary a set of field configs represents.
 */
export function classifySummaryFamily(fieldConfigs: FieldConfig[]): SummaryFamily {
  if (fieldConfigs.length === 0) return 'fallback';
  if (fieldConfigs.length === 1) return 'scalar';

  const keys = new Set(fieldConfigs.map((f) => f.key));
  if (keys.has('x') && keys.has('y') && fieldConfigs.length <= 3) return 'position';

  return 'multi-field';
}

// ── Pre-defined field configs for known domains ──

/** Camera field configs in stable display order. */
export const CAMERA_FIELD_CONFIGS: FieldConfig[] = [
  { key: 'x', label: 'Pan X', format: fmtNumber },
  { key: 'y', label: 'Pan Y', format: fmtNumber },
  { key: 'zoom', label: 'Zoom', format: fmtNumber },
];

/** Keyframe field configs in stable display order. */
export const KEYFRAME_FIELD_CONFIGS: FieldConfig[] = [
  { key: 'x', label: 'X', format: fmtNumber },
  { key: 'y', label: 'Y', format: fmtNumber },
  { key: 'zoom', label: 'Zoom', format: fmtNumber },
  { key: 'interpolation', label: 'Interpolation', format: fmtString },
  { key: 'name', label: 'Name', format: fmtString },
];

/** Instance position field configs. */
export const POSITION_FIELD_CONFIGS: FieldConfig[] = [
  { key: 'x', label: 'X', format: fmtNumber },
  { key: 'y', label: 'Y', format: fmtNumber },
];

/** Playback config field configs (for deepening the shallow playback diff). */
export const PLAYBACK_FIELD_CONFIGS: FieldConfig[] = [
  { key: 'fps', label: 'FPS', format: fmtNumber },
  { key: 'looping', label: 'Looping', format: fmtBool },
];
