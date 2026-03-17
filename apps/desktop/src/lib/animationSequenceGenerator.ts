/**
 * Animation Sequence Generator — creates multi-frame animation from template + preset.
 *
 * Flow:
 * 1. Resolve template regions to base pixel positions
 * 2. For each keyframe in the preset, apply region transforms (dx/dy offsets, scale)
 * 3. Create a new canvas frame and render the transformed template via render_template
 * 4. Return frame IDs for preview/undo
 *
 * The intensity parameter scales all transforms (0.5 = subtle, 2.0 = exaggerated).
 */

import { invoke } from '@tauri-apps/api/core';
import type {
  SpriteTemplate,
  AnimationPreset,
  AnimationKeyframe,
  AnimationGenerateParams,
  AnimationGenerateResult,
  RGBA,
} from '@glyphstudio/domain';
import { findTemplate } from './spriteTemplateLibrary';
import { findPreset } from './animationPresetLibrary';
import { resolveTemplate } from './spriteTemplateRenderer';

/** Apply keyframe transforms to resolved regions (pure function). */
export function applyKeyframeTransforms(
  baseRegions: Array<{
    x: number; y: number; width: number; height: number;
    shape: string; r: number; g: number; b: number; a: number; zOrder: number;
    outlineR?: number; outlineG?: number; outlineB?: number; outlineA?: number;
  }>,
  baseConnections: Array<{
    fromX: number; fromY: number; toX: number; toY: number;
    r: number; g: number; b: number; a: number;
  }>,
  template: SpriteTemplate,
  keyframe: AnimationKeyframe,
  scale: number,
  intensity: number,
): {
  regions: typeof baseRegions;
  connections: typeof baseConnections;
} {
  // Build lookup of transforms by regionId
  const transformMap = new Map(
    keyframe.transforms.map((t) => [t.regionId, t]),
  );

  // Build regionId → index mapping from template
  const regionIdToIndex = new Map(
    template.regions.map((r, i) => [r.id, i]),
  );

  const regions = baseRegions.map((region, i) => {
    const templateRegion = template.regions[i];
    if (!templateRegion) return { ...region };

    const transform = transformMap.get(templateRegion.id);
    if (!transform) return { ...region };

    const dx = Math.round(transform.dx * intensity * scale);
    const dy = Math.round(transform.dy * intensity * scale);
    const sx = transform.scaleX ?? 1.0;
    const sy = transform.scaleY ?? 1.0;

    // Apply scale around region center
    const cx = region.x + region.width / 2;
    const cy = region.y + region.height / 2;
    const newW = Math.max(1, Math.round(region.width * sx));
    const newH = Math.max(1, Math.round(region.height * sy));

    return {
      ...region,
      x: Math.round(cx - newW / 2) + dx,
      y: Math.round(cy - newH / 2) + dy,
      width: newW,
      height: newH,
    };
  });

  // Recompute connection endpoints from transformed region centers
  const connections = baseConnections.map((conn, i) => {
    const templateConn = template.connections[i];
    if (!templateConn) return { ...conn };

    const fromIdx = regionIdToIndex.get(templateConn.fromRegion);
    const toIdx = regionIdToIndex.get(templateConn.toRegion);
    if (fromIdx === undefined || toIdx === undefined) return { ...conn };

    const fromRegion = regions[fromIdx];
    const toRegion = regions[toIdx];

    return {
      ...conn,
      fromX: Math.round(fromRegion.x + fromRegion.width / 2),
      fromY: Math.round(fromRegion.y + fromRegion.height / 2),
      toX: Math.round(toRegion.x + toRegion.width / 2),
      toY: Math.round(toRegion.y + toRegion.height / 2),
    };
  });

  return { regions, connections };
}

/** Generate a full animation sequence on the canvas. */
export async function generateAnimationSequence(
  params: AnimationGenerateParams,
  onProgress?: (frameIndex: number, total: number) => void,
): Promise<AnimationGenerateResult> {
  const template = findTemplate(params.templateId);
  if (!template) {
    throw new Error(`Template not found: ${params.templateId}`);
  }

  const preset = findPreset(params.presetId);
  if (!preset) {
    throw new Error(`Animation preset not found: ${params.presetId}`);
  }

  // Check archetype compatibility
  if (!preset.compatibleArchetypes.includes(template.archetype)) {
    throw new Error(
      `Preset "${preset.name}" is not compatible with "${template.archetype}" templates. ` +
      `Compatible: ${preset.compatibleArchetypes.join(', ')}`,
    );
  }

  const scale = params.scale || 1.0;
  const intensity = params.intensity ?? 1.0;

  // Resolve base template to pixel regions
  const { regions: baseRegions, connections: baseConnections } = resolveTemplate(template, {
    templateId: params.templateId,
    colors: params.colors,
    scale,
  });

  const frameIds: string[] = [];
  let totalPixels = 0;

  for (let i = 0; i < preset.keyframes.length; i++) {
    const keyframe = preset.keyframes[i];
    onProgress?.(i, preset.frameCount);

    // Apply transforms to get this frame's regions
    const { regions, connections } = applyKeyframeTransforms(
      baseRegions,
      baseConnections,
      template,
      keyframe,
      scale,
      intensity,
    );

    // Create a new frame
    const frameName = `${preset.name} ${i + 1}/${preset.frameCount}`;
    const frameResult = await invoke<{ id: string }>('create_frame', { name: frameName });
    frameIds.push(frameResult.id);

    // Set frame duration if specified
    if (keyframe.durationMs) {
      await invoke('set_frame_duration', {
        frameId: frameResult.id,
        durationMs: keyframe.durationMs,
      });
    }

    // Select the new frame
    await invoke('select_frame', { frameId: frameResult.id });

    // Render transformed template onto this frame
    const renderResult = await invoke<{
      regionCount: number;
      connectionCount: number;
      pixelCount: number;
    }>('render_template', {
      input: {
        regions,
        connections,
        layerId: null,
      },
    });

    totalPixels += renderResult.pixelCount;
  }

  onProgress?.(preset.frameCount, preset.frameCount);

  return {
    presetId: params.presetId,
    templateId: params.templateId,
    frameCount: preset.frameCount,
    totalPixels,
    frameIds,
  };
}
