import { describe, it, expect } from 'vitest';
import {
  buildTxt2ImgWorkflow,
  WORKFLOW_TEMPLATES,
  DEFAULT_CHECKPOINT,
} from './comfyuiWorkflows';

describe('WORKFLOW_TEMPLATES', () => {
  it('has 3 templates', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(3);
  });

  it('each template has required fields', () => {
    for (const t of WORKFLOW_TEMPLATES) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.defaultPrompt).toBeTruthy();
      expect(t.negativePrompt).toBeTruthy();
    }
  });

  it('template IDs are unique', () => {
    const ids = WORKFLOW_TEMPLATES.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildTxt2ImgWorkflow', () => {
  it('returns a valid node graph', () => {
    const workflow = buildTxt2ImgWorkflow('pixel art knight', 'blurry', DEFAULT_CHECKPOINT);
    // Should have 7 nodes
    expect(Object.keys(workflow)).toHaveLength(7);
    // Checkpoint loader
    expect((workflow['1'] as Record<string, unknown>).class_type).toBe('CheckpointLoaderSimple');
    // KSampler
    expect((workflow['5'] as Record<string, unknown>).class_type).toBe('KSampler');
    // SaveImage
    expect((workflow['7'] as Record<string, unknown>).class_type).toBe('SaveImage');
  });

  it('injects prompt text into CLIP nodes', () => {
    const workflow = buildTxt2ImgWorkflow('my prompt', 'my negative', DEFAULT_CHECKPOINT);
    const positive = workflow['2'] as { inputs: { text: string } };
    const negative = workflow['3'] as { inputs: { text: string } };
    expect(positive.inputs.text).toBe('my prompt');
    expect(negative.inputs.text).toBe('my negative');
  });

  it('uses provided checkpoint', () => {
    const workflow = buildTxt2ImgWorkflow('test', 'neg', 'custom_model.safetensors');
    const loader = workflow['1'] as { inputs: { ckpt_name: string } };
    expect(loader.inputs.ckpt_name).toBe('custom_model.safetensors');
  });

  it('uses provided steps and cfg', () => {
    const workflow = buildTxt2ImgWorkflow('test', 'neg', DEFAULT_CHECKPOINT, 42, 30, 12);
    const sampler = workflow['5'] as { inputs: { seed: number; steps: number; cfg: number } };
    expect(sampler.inputs.seed).toBe(42);
    expect(sampler.inputs.steps).toBe(30);
    expect(sampler.inputs.cfg).toBe(12);
  });

  it('generates random seed when -1', () => {
    const w1 = buildTxt2ImgWorkflow('test', 'neg', DEFAULT_CHECKPOINT, -1);
    const w2 = buildTxt2ImgWorkflow('test', 'neg', DEFAULT_CHECKPOINT, -1);
    const s1 = (w1['5'] as { inputs: { seed: number } }).inputs.seed;
    const s2 = (w2['5'] as { inputs: { seed: number } }).inputs.seed;
    // Seeds should be numeric and likely different (not guaranteed but extremely likely)
    expect(typeof s1).toBe('number');
    expect(typeof s2).toBe('number');
    expect(s1).toBeGreaterThanOrEqual(0);
  });

  it('generates at 512x512', () => {
    const workflow = buildTxt2ImgWorkflow('test', 'neg', DEFAULT_CHECKPOINT);
    const latent = workflow['4'] as { inputs: { width: number; height: number } };
    expect(latent.inputs.width).toBe(512);
    expect(latent.inputs.height).toBe(512);
  });
});
