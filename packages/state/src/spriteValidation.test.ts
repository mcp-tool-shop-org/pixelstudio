import { describe, it, expect } from 'vitest';
import { runSpriteValidation } from './spriteValidation';
import { createSpriteDocument } from '@glyphstudio/domain';
import type { SpriteDocument } from '@glyphstudio/domain';

function makeDoc(overrides?: Partial<SpriteDocument>): SpriteDocument {
  const doc = createSpriteDocument('Test', 32, 32);
  return { ...doc, ...overrides };
}

describe('spriteValidation', () => {
  describe('palette rules', () => {
    it('reports duplicate colors', () => {
      const doc = makeDoc();
      // Add a duplicate of Black (index 1)
      doc.palette.colors.push({ rgba: [0, 0, 0, 255], name: 'Also Black' });
      const report = runSpriteValidation(doc, ['palette']);
      const dupes = report.issues.filter((i) => i.ruleId === 'palette-duplicate-color');
      expect(dupes.length).toBe(1);
      expect(dupes[0].severity).toBe('warning');
    });

    it('reports unnamed colors', () => {
      const doc = makeDoc();
      doc.palette.colors.push({ rgba: [42, 42, 42, 255] });
      const report = runSpriteValidation(doc, ['palette']);
      const unnamed = report.issues.filter((i) => i.ruleId === 'palette-unnamed-color');
      expect(unnamed.length).toBe(1);
      expect(unnamed[0].severity).toBe('info');
    });

    it('warns on large palettes', () => {
      const doc = makeDoc();
      for (let i = 0; i < 60; i++) {
        doc.palette.colors.push({ rgba: [i, i * 2, i * 3, 255], name: `c${i}` });
      }
      // Now > 64 total (10 default + 60)
      const report = runSpriteValidation(doc, ['palette']);
      const big = report.issues.filter((i) => i.ruleId === 'palette-too-many-colors');
      expect(big.length).toBe(1);
    });

    it('passes clean palette', () => {
      const doc = makeDoc();
      const report = runSpriteValidation(doc, ['palette']);
      expect(report.summary.errorCount).toBe(0);
      expect(report.summary.warningCount).toBe(0);
    });
  });

  describe('animation rules', () => {
    it('reports empty frames', () => {
      const doc = makeDoc();
      doc.frames.push({ id: 'f_empty', index: 1, durationMs: 100, layers: [] });
      const report = runSpriteValidation(doc, ['animation']);
      const empty = report.issues.filter((i) => i.ruleId === 'animation-empty-frame');
      expect(empty.length).toBe(1);
      expect(empty[0].severity).toBe('error');
      expect(empty[0].affectedFrameIds).toContain('f_empty');
    });

    it('reports inconsistent layer counts', () => {
      const doc = makeDoc();
      doc.frames.push({
        id: 'f2',
        index: 1,
        durationMs: 100,
        layers: [
          { id: 'l1', name: 'Layer 1', visible: true, index: 0 },
          { id: 'l2', name: 'Layer 2', visible: true, index: 1 },
        ],
      });
      const report = runSpriteValidation(doc, ['animation']);
      const inconsistent = report.issues.filter((i) => i.ruleId === 'animation-inconsistent-layers');
      expect(inconsistent.length).toBe(1);
      expect(inconsistent[0].severity).toBe('warning');
    });

    it('reports zero-duration frames', () => {
      const doc = makeDoc();
      doc.frames[0].durationMs = 0;
      const report = runSpriteValidation(doc, ['animation']);
      const zero = report.issues.filter((i) => i.ruleId === 'animation-zero-duration');
      expect(zero.length).toBe(1);
      expect(zero[0].severity).toBe('error');
    });

    it('notes single-frame document', () => {
      const doc = makeDoc();
      const report = runSpriteValidation(doc, ['animation']);
      const single = report.issues.filter((i) => i.ruleId === 'animation-single-frame');
      expect(single.length).toBe(1);
      expect(single[0].severity).toBe('info');
    });

    it('no single-frame note for multi-frame', () => {
      const doc = makeDoc();
      doc.frames.push({
        id: 'f2', index: 1, durationMs: 100,
        layers: [{ id: 'l1', name: 'Layer 1', visible: true, index: 0 }],
      });
      const report = runSpriteValidation(doc, ['animation']);
      const single = report.issues.filter((i) => i.ruleId === 'animation-single-frame');
      expect(single.length).toBe(0);
    });
  });

  describe('export rules', () => {
    it('notes large canvas', () => {
      const doc = makeDoc({ width: 1024, height: 1024 });
      const report = runSpriteValidation(doc, ['export']);
      const large = report.issues.filter((i) => i.ruleId === 'export-large-canvas');
      expect(large.length).toBe(1);
    });

    it('errors on invalid canvas', () => {
      const doc = makeDoc({ width: 0, height: 32 });
      const report = runSpriteValidation(doc, ['export']);
      const invalid = report.issues.filter((i) => i.ruleId === 'export-invalid-canvas');
      expect(invalid.length).toBe(1);
      expect(invalid[0].severity).toBe('error');
    });

    it('passes normal canvas', () => {
      const doc = makeDoc();
      const report = runSpriteValidation(doc, ['export']);
      expect(report.summary.errorCount).toBe(0);
      expect(report.summary.warningCount).toBe(0);
    });
  });

  describe('category filtering', () => {
    it('runs all rules when no filter', () => {
      const doc = makeDoc();
      const report = runSpriteValidation(doc);
      // At minimum: single-frame info
      expect(report.issues.length).toBeGreaterThanOrEqual(1);
    });

    it('filters to single category', () => {
      const doc = makeDoc();
      const report = runSpriteValidation(doc, ['export']);
      // Export-only rules should not include animation single-frame
      const animIssues = report.issues.filter((i) => i.category === 'animation');
      expect(animIssues.length).toBe(0);
    });
  });

  describe('report shape', () => {
    it('has correct summary counts', () => {
      const doc = makeDoc();
      doc.frames[0].durationMs = 0; // error
      doc.palette.colors.push({ rgba: [0, 0, 0, 255], name: 'Dupe Black' }); // warning
      const report = runSpriteValidation(doc);
      expect(report.summary.errorCount).toBeGreaterThanOrEqual(1);
      expect(report.summary.warningCount).toBeGreaterThanOrEqual(1);
      expect(report.reportId).toMatch(/^vr_/);
      expect(report.createdAt).toBeTruthy();
      expect(report.summary.stale).toBe(false);
    });
  });
});
