import { describe, it, expect } from 'vitest';
import {
  extractChangedFields,
  summarizeMultiFieldChange,
  summarizeScalarChange,
  fallbackSummary,
  classifySummaryFamily,
  fmtNumber,
  fmtPercent,
  fmtBool,
  fmtString,
  CAMERA_FIELD_CONFIGS,
  KEYFRAME_FIELD_CONFIGS,
  POSITION_FIELD_CONFIGS,
  PLAYBACK_FIELD_CONFIGS,
  type FieldConfig,
  type FieldChange,
} from './structuredValueSummary';

// ── Formatters ──

describe('fmtNumber', () => {
  it('formats integer without decimal', () => {
    expect(fmtNumber(42)).toBe('42');
  });

  it('formats float with 1 decimal', () => {
    expect(fmtNumber(1.5)).toBe('1.5');
  });

  it('formats zero as "0"', () => {
    expect(fmtNumber(0)).toBe('0');
  });

  it('handles non-number gracefully', () => {
    expect(fmtNumber('hello')).toBe('hello');
    expect(fmtNumber(undefined)).toBe('');
    expect(fmtNumber(null)).toBe('');
  });
});

describe('fmtPercent', () => {
  it('formats 1.0 as 100%', () => {
    expect(fmtPercent(1.0)).toBe('100%');
  });

  it('formats 0.5 as 50%', () => {
    expect(fmtPercent(0.5)).toBe('50%');
  });

  it('formats 0 as 0%', () => {
    expect(fmtPercent(0)).toBe('0%');
  });

  it('handles non-number', () => {
    expect(fmtPercent(undefined)).toBe('');
  });
});

describe('fmtBool', () => {
  it('formats true as Yes', () => {
    expect(fmtBool(true)).toBe('Yes');
  });

  it('formats false as No', () => {
    expect(fmtBool(false)).toBe('No');
  });

  it('formats truthy as Yes', () => {
    expect(fmtBool(1)).toBe('Yes');
  });

  it('formats falsy as No', () => {
    expect(fmtBool(0)).toBe('No');
    expect(fmtBool('')).toBe('No');
    expect(fmtBool(null)).toBe('No');
  });
});

describe('fmtString', () => {
  it('passes through strings', () => {
    expect(fmtString('linear')).toBe('linear');
  });

  it('converts undefined to empty', () => {
    expect(fmtString(undefined)).toBe('');
  });

  it('converts number to string', () => {
    expect(fmtString(42)).toBe('42');
  });
});

// ── Changed-field extraction ──

describe('extractChangedFields', () => {
  const configs: FieldConfig[] = [
    { key: 'x', label: 'X', format: fmtNumber },
    { key: 'y', label: 'Y', format: fmtNumber },
    { key: 'zoom', label: 'Zoom', format: fmtNumber },
  ];

  it('returns empty array when nothing changed', () => {
    const obj = { x: 10, y: 20, zoom: 1.0 };
    expect(extractChangedFields(obj, { ...obj }, configs)).toEqual([]);
  });

  it('returns only changed fields', () => {
    const before = { x: 10, y: 20, zoom: 1.0 };
    const after = { x: 50, y: 20, zoom: 1.0 };
    const changes = extractChangedFields(before, after, configs);
    expect(changes).toHaveLength(1);
    expect(changes[0].field).toBe('x');
    expect(changes[0].before).toBe('10');
    expect(changes[0].after).toBe('50');
  });

  it('preserves config order, not object key order', () => {
    const before = { zoom: 1.0, y: 20, x: 10 };
    const after = { zoom: 2.0, y: 40, x: 10 };
    const changes = extractChangedFields(before, after, configs);
    expect(changes.map((c) => c.field)).toEqual(['y', 'zoom']);
  });

  it('uses custom formatter', () => {
    const pctConfig: FieldConfig[] = [
      { key: 'opacity', label: 'Opacity', format: fmtPercent },
    ];
    const changes = extractChangedFields(
      { opacity: 0.5 },
      { opacity: 1.0 },
      pctConfig,
    );
    expect(changes[0].before).toBe('50%');
    expect(changes[0].after).toBe('100%');
  });

  it('uses default string formatter when none specified', () => {
    const noFmt: FieldConfig[] = [{ key: 'mode', label: 'Mode' }];
    const changes = extractChangedFields(
      { mode: 'linear' },
      { mode: 'hold' },
      noFmt,
    );
    expect(changes[0].before).toBe('linear');
    expect(changes[0].after).toBe('hold');
  });

  it('detects all fields changed', () => {
    const before = { x: 0, y: 0, zoom: 1.0 };
    const after = { x: 100, y: 200, zoom: 3.0 };
    const changes = extractChangedFields(before, after, configs);
    expect(changes).toHaveLength(3);
    expect(changes.map((c) => c.field)).toEqual(['x', 'y', 'zoom']);
  });

  it('handles undefined → value transition', () => {
    const configs: FieldConfig[] = [{ key: 'name', label: 'Name' }];
    const changes = extractChangedFields(
      { name: undefined },
      { name: 'Shot 1' },
      configs,
    );
    expect(changes).toHaveLength(1);
    expect(changes[0].before).toBe('');
    expect(changes[0].after).toBe('Shot 1');
  });
});

// ── Multi-field summary ──

describe('summarizeMultiFieldChange', () => {
  const configs: FieldConfig[] = [
    { key: 'x', label: 'X', format: fmtNumber },
    { key: 'y', label: 'Y', format: fmtNumber },
    { key: 'zoom', label: 'Zoom', format: fmtNumber },
  ];

  it('reports no-op when nothing changed', () => {
    const obj = { x: 10, y: 20, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(obj, { ...obj }, configs);
    expect(summary.isNoOp).toBe(true);
    expect(summary.changes).toEqual([]);
    expect(summary.changedFieldKeys).toEqual([]);
  });

  it('reports no-op with context label', () => {
    const obj = { x: 10, y: 20, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(obj, { ...obj }, configs, 'Camera');
    expect(summary.description).toBe('Camera: no changes');
  });

  it('single-field change produces inline description', () => {
    const before = { x: 10, y: 20, zoom: 1.0 };
    const after = { x: 50, y: 20, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(before, after, configs);
    expect(summary.changes).toHaveLength(1);
    expect(summary.description).toBe('X: 10 → 50');
  });

  it('single-field change with context label', () => {
    const before = { x: 10, y: 20, zoom: 1.0 };
    const after = { x: 50, y: 20, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(before, after, configs, 'Camera');
    expect(summary.description).toBe('Camera: X 10 → 50');
  });

  it('multi-field change lists labels', () => {
    const before = { x: 0, y: 0, zoom: 1.0 };
    const after = { x: 100, y: 200, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(before, after, configs);
    expect(summary.changedFieldKeys).toEqual(['x', 'y']);
    expect(summary.description).toBe('X, Y');
  });

  it('multi-field change with context label', () => {
    const before = { x: 0, y: 0, zoom: 1.0 };
    const after = { x: 100, y: 200, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(before, after, configs, 'Keyframe');
    expect(summary.description).toBe('Keyframe: X, Y');
  });

  it('changedFieldKeys is stable regardless of object key order', () => {
    const before = { zoom: 1.0, y: 0, x: 0 };
    const after = { zoom: 2.0, y: 50, x: 0 };
    const summary = summarizeMultiFieldChange(before, after, configs);
    expect(summary.changedFieldKeys).toEqual(['y', 'zoom']);
  });
});

// ── Scalar summary ──

describe('summarizeScalarChange', () => {
  it('detects change', () => {
    const summary = summarizeScalarChange('Visibility', 'Visible', 'Hidden');
    expect(summary.isNoOp).toBe(false);
    expect(summary.changes).toHaveLength(1);
    expect(summary.description).toBe('Visibility: Visible → Hidden');
  });

  it('detects no-op', () => {
    const summary = summarizeScalarChange('Opacity', '50%', '50%');
    expect(summary.isNoOp).toBe(true);
    expect(summary.changes).toEqual([]);
    expect(summary.description).toBe('Opacity: no change');
  });
});

// ── Fallback summary ──

describe('fallbackSummary', () => {
  it('returns honest text with no changes', () => {
    const summary = fallbackSummary('Settings changed (details unavailable)');
    expect(summary.isNoOp).toBe(false);
    expect(summary.changes).toEqual([]);
    expect(summary.description).toBe('Settings changed (details unavailable)');
  });
});

// ── Family classification ──

describe('classifySummaryFamily', () => {
  it('empty configs → fallback', () => {
    expect(classifySummaryFamily([])).toBe('fallback');
  });

  it('single config → scalar', () => {
    expect(classifySummaryFamily([{ key: 'opacity', label: 'Opacity' }])).toBe('scalar');
  });

  it('x + y → position', () => {
    expect(classifySummaryFamily(POSITION_FIELD_CONFIGS)).toBe('position');
  });

  it('x + y + zoom → position (3 fields with x/y)', () => {
    expect(classifySummaryFamily(CAMERA_FIELD_CONFIGS)).toBe('position');
  });

  it('more than 3 fields → multi-field', () => {
    expect(classifySummaryFamily(KEYFRAME_FIELD_CONFIGS)).toBe('multi-field');
  });

  it('2 fields without x/y → multi-field', () => {
    expect(classifySummaryFamily(PLAYBACK_FIELD_CONFIGS)).toBe('multi-field');
  });
});

// ── Pre-defined configs ──

describe('pre-defined field configs', () => {
  it('CAMERA_FIELD_CONFIGS has 3 fields in stable order', () => {
    expect(CAMERA_FIELD_CONFIGS.map((c) => c.key)).toEqual(['x', 'y', 'zoom']);
  });

  it('KEYFRAME_FIELD_CONFIGS has 5 fields in stable order', () => {
    expect(KEYFRAME_FIELD_CONFIGS.map((c) => c.key)).toEqual([
      'x', 'y', 'zoom', 'interpolation', 'name',
    ]);
  });

  it('POSITION_FIELD_CONFIGS has 2 fields', () => {
    expect(POSITION_FIELD_CONFIGS.map((c) => c.key)).toEqual(['x', 'y']);
  });

  it('PLAYBACK_FIELD_CONFIGS has 2 fields', () => {
    expect(PLAYBACK_FIELD_CONFIGS.map((c) => c.key)).toEqual(['fps', 'looping']);
  });
});

// ── Integration: camera diff via structured summary ──

describe('camera structured summary integration', () => {
  it('camera pan produces position-family change', () => {
    const before = { x: 0, y: 0, zoom: 1.0 };
    const after = { x: 50, y: 0, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(before, after, CAMERA_FIELD_CONFIGS, 'Camera');
    expect(summary.changedFieldKeys).toEqual(['x']);
    expect(summary.changes[0].label).toBe('Pan X');
    expect(summary.description).toBe('Camera: Pan X 0 → 50');
  });

  it('camera zoom produces single-field change', () => {
    const before = { x: 0, y: 0, zoom: 1.0 };
    const after = { x: 0, y: 0, zoom: 2.5 };
    const summary = summarizeMultiFieldChange(before, after, CAMERA_FIELD_CONFIGS, 'Camera');
    expect(summary.changedFieldKeys).toEqual(['zoom']);
    expect(summary.changes[0].label).toBe('Zoom');
    expect(summary.description).toBe('Camera: Zoom 1 → 2.5');
  });

  it('camera reset produces all-fields change', () => {
    const before = { x: 100, y: 200, zoom: 3.0 };
    const after = { x: 0, y: 0, zoom: 1.0 };
    const summary = summarizeMultiFieldChange(before, after, CAMERA_FIELD_CONFIGS, 'Camera');
    expect(summary.changedFieldKeys).toEqual(['x', 'y', 'zoom']);
    expect(summary.description).toBe('Camera: Pan X, Pan Y, Zoom');
  });
});

// ── Integration: keyframe edit via structured summary ──

describe('keyframe structured summary integration', () => {
  it('keyframe position edit shows only changed fields', () => {
    const before = { x: 0, y: 0, zoom: 1.0, interpolation: 'linear', name: undefined };
    const after = { x: 50, y: 100, zoom: 1.0, interpolation: 'linear', name: undefined };
    const summary = summarizeMultiFieldChange(before, after, KEYFRAME_FIELD_CONFIGS, 'Keyframe');
    expect(summary.changedFieldKeys).toEqual(['x', 'y']);
    expect(summary.changes).toHaveLength(2);
  });

  it('keyframe interpolation change shows mode transition', () => {
    const before = { x: 0, y: 0, zoom: 1.0, interpolation: 'linear', name: undefined };
    const after = { x: 0, y: 0, zoom: 1.0, interpolation: 'hold', name: undefined };
    const summary = summarizeMultiFieldChange(before, after, KEYFRAME_FIELD_CONFIGS);
    expect(summary.changedFieldKeys).toEqual(['interpolation']);
    expect(summary.changes[0].before).toBe('linear');
    expect(summary.changes[0].after).toBe('hold');
  });

  it('keyframe name addition shows name transition', () => {
    const before = { x: 0, y: 0, zoom: 1.0, interpolation: 'linear', name: undefined as string | undefined };
    const after = { x: 0, y: 0, zoom: 1.0, interpolation: 'linear', name: 'Hero Shot' as string | undefined };
    const summary = summarizeMultiFieldChange(before, after, KEYFRAME_FIELD_CONFIGS);
    expect(summary.changedFieldKeys).toEqual(['name']);
    expect(summary.changes[0].before).toBe('');
    expect(summary.changes[0].after).toBe('Hero Shot');
  });
});

// ── Integration: playback config via structured summary ──

describe('playback structured summary integration', () => {
  it('FPS change produces scalar summary', () => {
    const before = { fps: 12, looping: true };
    const after = { fps: 24, looping: true };
    const summary = summarizeMultiFieldChange(before, after, PLAYBACK_FIELD_CONFIGS, 'Playback');
    expect(summary.changedFieldKeys).toEqual(['fps']);
    expect(summary.changes[0].before).toBe('12');
    expect(summary.changes[0].after).toBe('24');
    expect(summary.description).toBe('Playback: FPS 12 → 24');
  });

  it('looping change produces boolean summary', () => {
    const before = { fps: 12, looping: false };
    const after = { fps: 12, looping: true };
    const summary = summarizeMultiFieldChange(before, after, PLAYBACK_FIELD_CONFIGS, 'Playback');
    expect(summary.changedFieldKeys).toEqual(['looping']);
    expect(summary.changes[0].before).toBe('No');
    expect(summary.changes[0].after).toBe('Yes');
  });

  it('both FPS and looping change', () => {
    const before = { fps: 12, looping: false };
    const after = { fps: 24, looping: true };
    const summary = summarizeMultiFieldChange(before, after, PLAYBACK_FIELD_CONFIGS, 'Playback');
    expect(summary.changedFieldKeys).toEqual(['fps', 'looping']);
    expect(summary.description).toBe('Playback: FPS, Looping');
  });
});

// ── Boundary: fallback path does not masquerade as semantic understanding ──

describe('fallback boundary', () => {
  it('fallback summary has no changes array', () => {
    const summary = fallbackSummary('Unknown operation');
    expect(summary.changes).toEqual([]);
    expect(summary.changedFieldKeys).toEqual([]);
  });

  it('fallback description is the exact text provided', () => {
    const text = 'Details unavailable for this track type';
    expect(fallbackSummary(text).description).toBe(text);
  });

  it('fallback isNoOp is false (something happened, we just cannot detail it)', () => {
    expect(fallbackSummary('Something changed').isNoOp).toBe(false);
  });
});

// ── Stability: field order is deterministic ──

describe('field order stability', () => {
  it('extractChangedFields preserves config order across multiple calls', () => {
    const configs: FieldConfig[] = [
      { key: 'a', label: 'A' },
      { key: 'b', label: 'B' },
      { key: 'c', label: 'C' },
    ];
    const before = { a: 1, b: 2, c: 3 };
    const after = { a: 1, b: 99, c: 77 };

    const run1 = extractChangedFields(before, after, configs);
    const run2 = extractChangedFields(before, after, configs);
    expect(run1.map((c) => c.field)).toEqual(run2.map((c) => c.field));
    expect(run1.map((c) => c.field)).toEqual(['b', 'c']);
  });

  it('config order overrides object property iteration order', () => {
    const configs: FieldConfig[] = [
      { key: 'zoom', label: 'Zoom' },
      { key: 'x', label: 'X' },
      { key: 'y', label: 'Y' },
    ];
    const before = { x: 0, y: 0, zoom: 1 };
    const after = { x: 5, y: 10, zoom: 2 };
    const changes = extractChangedFields(before, after, configs);
    expect(changes.map((c) => c.field)).toEqual(['zoom', 'x', 'y']);
  });
});
