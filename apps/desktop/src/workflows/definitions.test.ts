import { describe, it, expect } from 'vitest';
import { ALL_WORKFLOWS, WORKFLOW_NEW_STATIC, WORKFLOW_NEW_ANIMATION, WORKFLOW_ANALYZE, WORKFLOW_VALIDATE, WORKFLOW_EXPORT_REVIEW } from './definitions';

describe('workflow definitions', () => {
  it('exports 5 workflows', () => {
    expect(ALL_WORKFLOWS).toHaveLength(5);
  });

  it('all workflows have unique ids', () => {
    const ids = ALL_WORKFLOWS.map((w) => w.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all workflows have at least one step', () => {
    for (const wf of ALL_WORKFLOWS) {
      expect(wf.steps.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('all steps have unique ids within their workflow', () => {
    for (const wf of ALL_WORKFLOWS) {
      const ids = wf.steps.map((s) => s.id);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('new-static-sprite is a create workflow', () => {
    expect(WORKFLOW_NEW_STATIC.category).toBe('create');
    expect(WORKFLOW_NEW_STATIC.steps.some((s) => s.id === 'create-project')).toBe(true);
    expect(WORKFLOW_NEW_STATIC.steps.some((s) => s.id === 'enter-editor')).toBe(true);
  });

  it('new-animation-sprite has create-frames step', () => {
    expect(WORKFLOW_NEW_ANIMATION.category).toBe('create');
    expect(WORKFLOW_NEW_ANIMATION.steps.some((s) => s.id === 'create-frames')).toBe(true);
  });

  it('analyze-sprite is an analyze workflow', () => {
    expect(WORKFLOW_ANALYZE.category).toBe('analyze');
    expect(WORKFLOW_ANALYZE.steps.some((s) => s.id === 'analyze-bounds')).toBe(true);
    expect(WORKFLOW_ANALYZE.steps.some((s) => s.id === 'analyze-colors')).toBe(true);
  });

  it('compare-frames step is skippable', () => {
    const step = WORKFLOW_ANALYZE.steps.find((s) => s.id === 'compare-frames');
    expect(step?.skippable).toBe(true);
  });

  it('validate-sprite is an analyze workflow', () => {
    expect(WORKFLOW_VALIDATE.category).toBe('analyze');
    expect(WORKFLOW_VALIDATE.steps.some((s) => s.id === 'run-validation')).toBe(true);
  });

  it('export-review-pack is an export workflow', () => {
    expect(WORKFLOW_EXPORT_REVIEW.category).toBe('export');
    expect(WORKFLOW_EXPORT_REVIEW.steps.some((s) => s.id === 'export-png')).toBe(true);
    expect(WORKFLOW_EXPORT_REVIEW.steps.some((s) => s.id === 'export-gif')).toBe(true);
  });

  it('export-gif step is skippable', () => {
    const step = WORKFLOW_EXPORT_REVIEW.steps.find((s) => s.id === 'export-gif');
    expect(step?.skippable).toBe(true);
  });

  it('all workflows have names and descriptions', () => {
    for (const wf of ALL_WORKFLOWS) {
      expect(wf.name.length).toBeGreaterThan(0);
      expect(wf.description.length).toBeGreaterThan(0);
    }
  });

  it('all steps have labels and descriptions', () => {
    for (const wf of ALL_WORKFLOWS) {
      for (const step of wf.steps) {
        expect(step.label.length).toBeGreaterThan(0);
        expect(step.description.length).toBeGreaterThan(0);
      }
    }
  });
});
