import { describe, it, expect, vi, beforeEach } from 'vitest';
import { applyKeyframeTransforms, generateAnimationSequence } from './animationSequenceGenerator';
import { findTemplate } from './spriteTemplateLibrary';
import { resolveTemplate } from './spriteTemplateRenderer';
import type { AnimationKeyframe } from '@glyphstudio/domain';

// --- Mock Tauri ---
const mockInvoke = vi.fn();
vi.mock('@tauri-apps/api/core', () => ({
  invoke: (...args: unknown[]) => mockInvoke(...args),
}));

describe('applyKeyframeTransforms', () => {
  const template = findTemplate('humanoid-warrior')!;
  const { regions: baseRegions, connections: baseConnections } = resolveTemplate(template, {
    templateId: 'humanoid-warrior',
    colors: {},
    scale: 1.0,
  });

  it('returns unchanged regions for empty transforms', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 0,
      transforms: [],
    };

    const { regions } = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 1.0,
    );

    // Regions should be identical to base
    for (let i = 0; i < regions.length; i++) {
      expect(regions[i].x).toBe(baseRegions[i].x);
      expect(regions[i].y).toBe(baseRegions[i].y);
      expect(regions[i].width).toBe(baseRegions[i].width);
      expect(regions[i].height).toBe(baseRegions[i].height);
    }
  });

  it('applies dy offset to head region', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 1,
      transforms: [
        { regionId: 'head', dx: 0, dy: -2 },
      ],
    };

    const { regions } = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 1.0,
    );

    // Find head in template to get its index
    const headIdx = template.regions.findIndex((r) => r.id === 'head');
    expect(regions[headIdx].y).toBe(baseRegions[headIdx].y - 2);
    expect(regions[headIdx].x).toBe(baseRegions[headIdx].x);
  });

  it('scales transforms by intensity', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 1,
      transforms: [
        { regionId: 'head', dx: 0, dy: -2 },
      ],
    };

    const halfIntensity = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 0.5,
    );
    const doubleIntensity = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 2.0,
    );

    const headIdx = template.regions.findIndex((r) => r.id === 'head');
    // At 0.5 intensity, dy = round(-2 * 0.5) = -1
    expect(halfIntensity.regions[headIdx].y).toBe(baseRegions[headIdx].y - 1);
    // At 2.0 intensity, dy = round(-2 * 2.0) = -4
    expect(doubleIntensity.regions[headIdx].y).toBe(baseRegions[headIdx].y - 4);
  });

  it('scales transforms by canvas scale', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 1,
      transforms: [
        { regionId: 'head', dx: 0, dy: -1 },
      ],
    };

    const scale2x = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 2.0, 1.0,
    );

    const headIdx = template.regions.findIndex((r) => r.id === 'head');
    // At 2x scale, dy = round(-1 * 1.0 * 2.0) = -2
    expect(scale2x.regions[headIdx].y).toBe(baseRegions[headIdx].y - 2);
  });

  it('skips unknown region IDs', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 1,
      transforms: [
        { regionId: 'nonexistent_region', dx: 10, dy: 10 },
      ],
    };

    const { regions } = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 1.0,
    );

    // All regions unchanged
    for (let i = 0; i < regions.length; i++) {
      expect(regions[i].x).toBe(baseRegions[i].x);
      expect(regions[i].y).toBe(baseRegions[i].y);
    }
  });

  it('updates connection endpoints when regions move', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 1,
      transforms: [
        { regionId: 'head', dx: 0, dy: -3 },
      ],
    };

    const { connections } = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 1.0,
    );

    // Connections that involve 'head' should have updated endpoints
    const headConnIdx = template.connections.findIndex(
      (c) => c.fromRegion === 'head' || c.toRegion === 'head',
    );
    if (headConnIdx >= 0) {
      const baseConn = baseConnections[headConnIdx];
      const newConn = connections[headConnIdx];
      // At least one endpoint should differ from base
      const changed =
        newConn.fromX !== baseConn.fromX || newConn.fromY !== baseConn.fromY ||
        newConn.toX !== baseConn.toX || newConn.toY !== baseConn.toY;
      expect(changed).toBe(true);
    }
  });

  it('allows negative positions (Rust clips out-of-bounds pixels)', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 0,
      transforms: [
        { regionId: 'head', dx: -100, dy: -100 },
      ],
    };

    const { regions } = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 1.0,
    );

    const headIdx = template.regions.findIndex((r) => r.id === 'head');
    expect(regions[headIdx].x).toBeLessThan(0);
    expect(regions[headIdx].y).toBeLessThan(0);
  });

  it('preserves colors through transforms', () => {
    const keyframe: AnimationKeyframe = {
      frameIndex: 1,
      transforms: [
        { regionId: 'head', dx: 2, dy: -1 },
      ],
    };

    const { regions } = applyKeyframeTransforms(
      baseRegions, baseConnections, template, keyframe, 1.0, 1.0,
    );

    const headIdx = template.regions.findIndex((r) => r.id === 'head');
    expect(regions[headIdx].r).toBe(baseRegions[headIdx].r);
    expect(regions[headIdx].g).toBe(baseRegions[headIdx].g);
    expect(regions[headIdx].b).toBe(baseRegions[headIdx].b);
    expect(regions[headIdx].a).toBe(baseRegions[headIdx].a);
  });
});

describe('generateAnimationSequence', () => {
  let frameCounter: number;

  beforeEach(() => {
    frameCounter = 0;
    mockInvoke.mockReset();
    mockInvoke.mockImplementation((cmd: string) => {
      if (cmd === 'create_frame') {
        return { id: `frame-${frameCounter++}` };
      }
      if (cmd === 'select_frame') return {};
      if (cmd === 'set_frame_duration') return {};
      if (cmd === 'render_template') {
        return { regionCount: 9, connectionCount: 7, pixelCount: 200 };
      }
      return {};
    });
  });

  it('generates correct number of frames for idle-bob', async () => {
    const result = await generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'idle-bob',
      colors: {},
      scale: 1.0,
    });

    expect(result.frameCount).toBe(4);
    expect(result.frameIds).toHaveLength(4);
    expect(result.templateId).toBe('humanoid-warrior');
    expect(result.presetId).toBe('idle-bob');
  });

  it('generates correct number of frames for walk-cycle', async () => {
    const result = await generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'walk-cycle',
      colors: {},
      scale: 1.0,
    });

    expect(result.frameCount).toBe(6);
    expect(result.frameIds).toHaveLength(6);
  });

  it('calls create_frame and render_template for each frame', async () => {
    await generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'idle-bob',
      colors: {},
      scale: 1.0,
    });

    const createFrameCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'create_frame');
    const renderCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'render_template');
    expect(createFrameCalls).toHaveLength(4);
    expect(renderCalls).toHaveLength(4);
  });

  it('sets frame duration when keyframe has durationMs', async () => {
    await generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'attack-swing',
      colors: {},
      scale: 1.0,
    });

    const durationCalls = mockInvoke.mock.calls.filter((c) => c[0] === 'set_frame_duration');
    expect(durationCalls.length).toBeGreaterThan(0);
  });

  it('reports totalPixels', async () => {
    const result = await generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'idle-bob',
      colors: {},
      scale: 1.0,
    });

    expect(result.totalPixels).toBe(200 * 4); // 200 per frame × 4 frames
  });

  it('calls onProgress callback', async () => {
    const progress: [number, number][] = [];
    await generateAnimationSequence(
      {
        templateId: 'humanoid-warrior',
        presetId: 'idle-bob',
        colors: {},
        scale: 1.0,
      },
      (frame, total) => progress.push([frame, total]),
    );

    // 4 frames + final completion callback
    expect(progress).toHaveLength(5);
    expect(progress[0]).toEqual([0, 4]);
    expect(progress[4]).toEqual([4, 4]);
  });

  it('throws for unknown template', async () => {
    await expect(generateAnimationSequence({
      templateId: 'nonexistent',
      presetId: 'idle-bob',
      colors: {},
      scale: 1.0,
    })).rejects.toThrow('Template not found');
  });

  it('throws for unknown preset', async () => {
    await expect(generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'nonexistent',
      colors: {},
      scale: 1.0,
    })).rejects.toThrow('Animation preset not found');
  });

  it('throws for incompatible archetype', async () => {
    await expect(generateAnimationSequence({
      templateId: 'item-sword',
      presetId: 'walk-cycle',
      colors: {},
      scale: 1.0,
    })).rejects.toThrow('not compatible');
  });

  it('passes intensity to transform application', async () => {
    // With intensity 0, all regions should be at base positions
    await generateAnimationSequence({
      templateId: 'humanoid-warrior',
      presetId: 'idle-bob',
      colors: {},
      scale: 1.0,
      intensity: 2.0,
    });

    // Just verify it doesn't throw — the actual transform is tested in applyKeyframeTransforms
    expect(mockInvoke).toHaveBeenCalled();
  });
});
