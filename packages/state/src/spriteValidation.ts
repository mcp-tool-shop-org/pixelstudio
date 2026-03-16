/**
 * Client-side validation rules for sprite documents.
 *
 * Runs against the spriteEditorStore document — no Rust backend needed.
 * Each rule returns zero or more ValidationIssue objects.
 */

import type { SpriteDocument, SpriteColor, SpriteFrame, SpriteLayer } from '@glyphstudio/domain';
import type { ValidationIssue, ValidationReport } from '@glyphstudio/api-contract';
import type { ValidationCategory } from '@glyphstudio/domain';

let issueCounter = 0;
function issueId(): string {
  return `vi_${++issueCounter}`;
}

// ── Palette rules ──

function checkDuplicateColors(doc: SpriteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const seen = new Map<string, number>();

  for (let i = 0; i < doc.palette.colors.length; i++) {
    const c = doc.palette.colors[i];
    const key = c.rgba.join(',');
    if (seen.has(key)) {
      issues.push({
        id: issueId(),
        category: 'palette',
        severity: 'warning',
        ruleId: 'palette-duplicate-color',
        message: `Color ${i} (${c.name ?? 'unnamed'}) is a duplicate of color ${seen.get(key)}`,
        affectedLayerIds: [],
        affectedFrameIds: [],
        suggestedRepairIds: [],
      });
    } else {
      seen.set(key, i);
    }
  }
  return issues;
}

function checkUnnamedColors(doc: SpriteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (let i = 0; i < doc.palette.colors.length; i++) {
    const c = doc.palette.colors[i];
    if (!c.name || c.name.trim() === '') {
      issues.push({
        id: issueId(),
        category: 'palette',
        severity: 'info',
        ruleId: 'palette-unnamed-color',
        message: `Color ${i} has no name — naming improves clarity`,
        affectedLayerIds: [],
        affectedFrameIds: [],
        suggestedRepairIds: [],
      });
    }
  }
  return issues;
}

function checkPaletteSize(doc: SpriteDocument): ValidationIssue[] {
  if (doc.palette.colors.length > 64) {
    return [{
      id: issueId(),
      category: 'palette',
      severity: 'warning',
      ruleId: 'palette-too-many-colors',
      message: `Palette has ${doc.palette.colors.length} colors — pixel art palettes typically use 64 or fewer`,
      affectedLayerIds: [],
      affectedFrameIds: [],
      suggestedRepairIds: [],
    }];
  }
  return [];
}

// ── Animation rules ──

function checkEmptyFrames(doc: SpriteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const frame of doc.frames) {
    if (frame.layers.length === 0) {
      issues.push({
        id: issueId(),
        category: 'animation',
        severity: 'error',
        ruleId: 'animation-empty-frame',
        message: `Frame ${frame.index} has no layers`,
        affectedLayerIds: [],
        affectedFrameIds: [frame.id],
        suggestedRepairIds: [],
      });
    }
  }
  return issues;
}

function checkInconsistentLayerCount(doc: SpriteDocument): ValidationIssue[] {
  if (doc.frames.length <= 1) return [];
  const counts = doc.frames.map((f) => f.layers.length);
  const first = counts[0];
  const mismatched = doc.frames.filter((f) => f.layers.length !== first);
  if (mismatched.length === 0) return [];

  return [{
    id: issueId(),
    category: 'animation',
    severity: 'warning',
    ruleId: 'animation-inconsistent-layers',
    message: `Frame layer counts vary (${[...new Set(counts)].join(', ')}) — this may cause unexpected compositing`,
    affectedLayerIds: [],
    affectedFrameIds: mismatched.map((f) => f.id),
    suggestedRepairIds: [],
  }];
}

function checkFrameTiming(doc: SpriteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  for (const frame of doc.frames) {
    if (frame.durationMs <= 0) {
      issues.push({
        id: issueId(),
        category: 'animation',
        severity: 'error',
        ruleId: 'animation-zero-duration',
        message: `Frame ${frame.index} has zero or negative duration (${frame.durationMs}ms)`,
        affectedLayerIds: [],
        affectedFrameIds: [frame.id],
        suggestedRepairIds: [],
      });
    }
  }
  return issues;
}

function checkSingleFrame(doc: SpriteDocument): ValidationIssue[] {
  if (doc.frames.length === 1) {
    return [{
      id: issueId(),
      category: 'animation',
      severity: 'info',
      ruleId: 'animation-single-frame',
      message: 'Document has only 1 frame — animations require multiple frames',
      affectedLayerIds: [],
      affectedFrameIds: [],
      suggestedRepairIds: [],
    }];
  }
  return [];
}

// ── Export rules ──

function checkCanvasSize(doc: SpriteDocument): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  if (doc.width > 512 || doc.height > 512) {
    issues.push({
      id: issueId(),
      category: 'export',
      severity: 'info',
      ruleId: 'export-large-canvas',
      message: `Canvas size ${doc.width}×${doc.height} is larger than typical sprite dimensions`,
      affectedLayerIds: [],
      affectedFrameIds: [],
      suggestedRepairIds: [],
    });
  }
  if (doc.width <= 0 || doc.height <= 0) {
    issues.push({
      id: issueId(),
      category: 'export',
      severity: 'error',
      ruleId: 'export-invalid-canvas',
      message: `Canvas dimensions are invalid: ${doc.width}×${doc.height}`,
      affectedLayerIds: [],
      affectedFrameIds: [],
      suggestedRepairIds: [],
    });
  }
  return issues;
}

// ── Rule registry ──

type RuleFn = (doc: SpriteDocument) => ValidationIssue[];

const ALL_RULES: { category: ValidationCategory; fn: RuleFn }[] = [
  { category: 'palette', fn: checkDuplicateColors },
  { category: 'palette', fn: checkUnnamedColors },
  { category: 'palette', fn: checkPaletteSize },
  { category: 'animation', fn: checkEmptyFrames },
  { category: 'animation', fn: checkInconsistentLayerCount },
  { category: 'animation', fn: checkFrameTiming },
  { category: 'animation', fn: checkSingleFrame },
  { category: 'export', fn: checkCanvasSize },
];

/**
 * Run validation rules against a sprite document.
 * If categories is provided, only rules in those categories are run.
 */
export function runSpriteValidation(
  doc: SpriteDocument,
  categories?: ValidationCategory[],
): ValidationReport {
  const rules = categories
    ? ALL_RULES.filter((r) => categories.includes(r.category))
    : ALL_RULES;

  const issues: ValidationIssue[] = [];
  for (const rule of rules) {
    issues.push(...rule.fn(doc));
  }

  return {
    reportId: `vr_${Date.now()}`,
    createdAt: new Date().toISOString(),
    summary: {
      infoCount: issues.filter((i) => i.severity === 'info').length,
      warningCount: issues.filter((i) => i.severity === 'warning').length,
      errorCount: issues.filter((i) => i.severity === 'error').length,
      stale: false,
    },
    issues,
  };
}
