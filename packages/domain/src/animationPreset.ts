/**
 * Animation Preset — motion definitions that transform template regions across frames.
 *
 * An animation preset describes how a base template pose changes over a sequence
 * of frames. Each keyframe specifies per-region transforms (offsets, scale tweaks)
 * relative to the template's base position. The frame sequence generator interpolates
 * between keyframes and renders each frame via render_template.
 */

/** Per-region transform for a single keyframe. */
export interface RegionKeyframeTransform {
  /** Region ID from the template. */
  regionId: string;
  /** Pixel offset from base position (can be fractional, resolved at render). */
  dx: number;
  dy: number;
  /** Scale multiplier relative to base (1.0 = no change). */
  scaleX?: number;
  scaleY?: number;
}

/** A single keyframe in an animation sequence. */
export interface AnimationKeyframe {
  /** Frame index in the output sequence (0-based). */
  frameIndex: number;
  /** Per-frame duration override in ms (null = use default). */
  durationMs?: number;
  /** Region transforms for this keyframe. Regions not listed stay at base. */
  transforms: RegionKeyframeTransform[];
}

/** Which template archetypes this animation is compatible with. */
export type AnimationCategory =
  | 'idle'
  | 'walk'
  | 'run'
  | 'attack'
  | 'hurt'
  | 'death'
  | 'cast'
  | 'jump'
  | 'custom';

/** Full animation preset definition. */
export interface AnimationPreset {
  id: string;
  name: string;
  description: string;
  /** Motion category for filtering. */
  category: AnimationCategory;
  /** Total frame count in the output sequence. */
  frameCount: number;
  /** Whether the animation loops seamlessly (last frame → first frame). */
  looping: boolean;
  /** Default FPS for playback. */
  defaultFps: number;
  /** Compatible template archetypes. */
  compatibleArchetypes: string[];
  /** Keyframes that define the motion. Frames between keyframes are interpolated. */
  keyframes: AnimationKeyframe[];
  /** Tags for searchability. */
  tags: string[];
}

/** Parameters to generate an animation from a template + preset. */
export interface AnimationGenerateParams {
  /** Template ID to use as base pose. */
  templateId: string;
  /** Animation preset ID. */
  presetId: string;
  /** Color overrides (same as TemplateParams). */
  colors: Record<string, [number, number, number, number]>;
  /** Scale factor. */
  scale: number;
  /** Intensity multiplier for all transforms (0.5 = subtle, 1.0 = normal, 2.0 = exaggerated). */
  intensity?: number;
}

/** Result of generating an animation sequence. */
export interface AnimationGenerateResult {
  presetId: string;
  templateId: string;
  frameCount: number;
  totalPixels: number;
  /** Frame IDs created during generation (for undo/preview). */
  frameIds: string[];
}
