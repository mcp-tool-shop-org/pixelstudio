/**
 * Animation Preset Library — starter motion presets for template-based animation.
 *
 * Each preset defines keyframes with per-region transforms. The frame sequence
 * generator interpolates between keyframes and renders each frame.
 *
 * Region IDs reference the template's regions (e.g. 'head', 'torso', 'arm_l').
 * If a region ID doesn't exist in the target template, that transform is skipped.
 */

import type { AnimationPreset, AnimationCategory } from '@glyphstudio/domain';

export const ANIMATION_PRESET_LIBRARY: AnimationPreset[] = [
  // ── Idle Bob ──────────────────────────────────────────────────
  {
    id: 'idle-bob',
    name: 'Idle Bob',
    description: 'Gentle up-down breathing motion. 4 frames, loops seamlessly.',
    category: 'idle',
    frameCount: 4,
    looping: true,
    defaultFps: 4,
    compatibleArchetypes: ['humanoid', 'quadruped'],
    keyframes: [
      {
        frameIndex: 0,
        transforms: [
          // Base pose — no transform
        ],
      },
      {
        frameIndex: 1,
        transforms: [
          { regionId: 'head', dx: 0, dy: -1 },
          { regionId: 'hair', dx: 0, dy: -1 },
          { regionId: 'torso', dx: 0, dy: 0 },
          { regionId: 'arm_l', dx: 0, dy: -0.5 },
          { regionId: 'arm_r', dx: 0, dy: -0.5 },
        ],
      },
      {
        frameIndex: 2,
        transforms: [
          { regionId: 'head', dx: 0, dy: -1 },
          { regionId: 'hair', dx: 0, dy: -2 },
          { regionId: 'torso', dx: 0, dy: -1 },
          { regionId: 'arm_l', dx: 0, dy: -1 },
          { regionId: 'arm_r', dx: 0, dy: -1 },
        ],
      },
      {
        frameIndex: 3,
        transforms: [
          { regionId: 'head', dx: 0, dy: -0.5 },
          { regionId: 'hair', dx: 0, dy: -1 },
          { regionId: 'torso', dx: 0, dy: 0 },
          { regionId: 'arm_l', dx: 0, dy: -0.5 },
          { regionId: 'arm_r', dx: 0, dy: -0.5 },
        ],
      },
    ],
    tags: ['idle', 'breathing', 'loop', 'simple'],
  },

  // ── Walk Cycle ────────────────────────────────────────────────
  {
    id: 'walk-cycle',
    name: 'Walk Cycle',
    description: 'Side-view 6-frame walk cycle with alternating leg/arm swing.',
    category: 'walk',
    frameCount: 6,
    looping: true,
    defaultFps: 8,
    compatibleArchetypes: ['humanoid'],
    keyframes: [
      {
        // Frame 0: Contact — right foot forward
        frameIndex: 0,
        transforms: [
          { regionId: 'leg_r', dx: 1, dy: 0 },
          { regionId: 'leg_l', dx: -1, dy: 0 },
          { regionId: 'arm_l', dx: 1, dy: 0 },
          { regionId: 'arm_r', dx: -1, dy: 0 },
          { regionId: 'foot_r', dx: 2, dy: 0 },
          { regionId: 'foot_l', dx: -2, dy: 0 },
        ],
      },
      {
        // Frame 1: Down — body drops
        frameIndex: 1,
        transforms: [
          { regionId: 'head', dx: 0, dy: 1 },
          { regionId: 'hair', dx: 0, dy: 1 },
          { regionId: 'torso', dx: 0, dy: 1 },
          { regionId: 'leg_r', dx: 0.5, dy: 1 },
          { regionId: 'leg_l', dx: -0.5, dy: 1 },
          { regionId: 'arm_l', dx: 0.5, dy: 1 },
          { regionId: 'arm_r', dx: -0.5, dy: 1 },
          { regionId: 'foot_r', dx: 1, dy: 1 },
          { regionId: 'foot_l', dx: -1, dy: 1 },
        ],
      },
      {
        // Frame 2: Passing — legs aligned
        frameIndex: 2,
        transforms: [
          { regionId: 'head', dx: 0, dy: 0 },
          { regionId: 'torso', dx: 0, dy: 0 },
          { regionId: 'leg_r', dx: 0, dy: 0 },
          { regionId: 'leg_l', dx: 0, dy: -1 },
          { regionId: 'arm_l', dx: 0, dy: 0 },
          { regionId: 'arm_r', dx: 0, dy: 0 },
        ],
      },
      {
        // Frame 3: Contact — left foot forward (mirror of 0)
        frameIndex: 3,
        transforms: [
          { regionId: 'leg_r', dx: -1, dy: 0 },
          { regionId: 'leg_l', dx: 1, dy: 0 },
          { regionId: 'arm_l', dx: -1, dy: 0 },
          { regionId: 'arm_r', dx: 1, dy: 0 },
          { regionId: 'foot_r', dx: -2, dy: 0 },
          { regionId: 'foot_l', dx: 2, dy: 0 },
        ],
      },
      {
        // Frame 4: Down — body drops (mirror side)
        frameIndex: 4,
        transforms: [
          { regionId: 'head', dx: 0, dy: 1 },
          { regionId: 'hair', dx: 0, dy: 1 },
          { regionId: 'torso', dx: 0, dy: 1 },
          { regionId: 'leg_r', dx: -0.5, dy: 1 },
          { regionId: 'leg_l', dx: 0.5, dy: 1 },
          { regionId: 'arm_l', dx: -0.5, dy: 1 },
          { regionId: 'arm_r', dx: 0.5, dy: 1 },
          { regionId: 'foot_r', dx: -1, dy: 1 },
          { regionId: 'foot_l', dx: 1, dy: 1 },
        ],
      },
      {
        // Frame 5: Passing — legs aligned (return to base)
        frameIndex: 5,
        transforms: [
          { regionId: 'head', dx: 0, dy: 0 },
          { regionId: 'torso', dx: 0, dy: 0 },
          { regionId: 'leg_r', dx: 0, dy: -1 },
          { regionId: 'leg_l', dx: 0, dy: 0 },
          { regionId: 'arm_l', dx: 0, dy: 0 },
          { regionId: 'arm_r', dx: 0, dy: 0 },
        ],
      },
    ],
    tags: ['walk', 'locomotion', 'loop', 'side-view'],
  },

  // ── Attack Swing ──────────────────────────────────────────────
  {
    id: 'attack-swing',
    name: 'Attack Swing',
    description: '4-frame melee attack: wind-up, strike, follow-through, recover. Non-looping.',
    category: 'attack',
    frameCount: 4,
    looping: false,
    defaultFps: 10,
    compatibleArchetypes: ['humanoid'],
    keyframes: [
      {
        // Frame 0: Wind-up — arm back, body leans back
        frameIndex: 0,
        transforms: [
          { regionId: 'arm_r', dx: -2, dy: -1 },
          { regionId: 'torso', dx: -0.5, dy: 0 },
          { regionId: 'head', dx: -0.5, dy: 0 },
          { regionId: 'hair', dx: -0.5, dy: 0 },
        ],
      },
      {
        // Frame 1: Strike — arm swings forward fast
        frameIndex: 1,
        durationMs: 80,
        transforms: [
          { regionId: 'arm_r', dx: 3, dy: 0 },
          { regionId: 'torso', dx: 1, dy: 0 },
          { regionId: 'head', dx: 1, dy: 0 },
          { regionId: 'hair', dx: 1, dy: -1 },
          { regionId: 'leg_r', dx: 0.5, dy: 0 },
        ],
      },
      {
        // Frame 2: Follow-through — overextended
        frameIndex: 2,
        durationMs: 100,
        transforms: [
          { regionId: 'arm_r', dx: 4, dy: 1 },
          { regionId: 'torso', dx: 1.5, dy: 0.5 },
          { regionId: 'head', dx: 1, dy: 0.5 },
          { regionId: 'hair', dx: 1.5, dy: 0 },
          { regionId: 'leg_r', dx: 1, dy: 0 },
          { regionId: 'leg_l', dx: -0.5, dy: 0 },
        ],
      },
      {
        // Frame 3: Recover — return toward base
        frameIndex: 3,
        transforms: [
          { regionId: 'arm_r', dx: 1, dy: 0 },
          { regionId: 'torso', dx: 0.5, dy: 0 },
          { regionId: 'head', dx: 0.5, dy: 0 },
          { regionId: 'hair', dx: 0.5, dy: -0.5 },
        ],
      },
    ],
    tags: ['attack', 'melee', 'swing', 'combat'],
  },
];

/** Find a preset by ID. */
export function findPreset(id: string): AnimationPreset | undefined {
  return ANIMATION_PRESET_LIBRARY.find((p) => p.id === id);
}

/** List presets by category. */
export function listPresetsByCategory(category: AnimationCategory): AnimationPreset[] {
  return ANIMATION_PRESET_LIBRARY.filter((p) => p.category === category);
}

/** List presets compatible with a template archetype. */
export function listCompatiblePresets(archetype: string): AnimationPreset[] {
  return ANIMATION_PRESET_LIBRARY.filter((p) =>
    p.compatibleArchetypes.includes(archetype),
  );
}

/** Search presets by keyword (name, description, tags). */
export function searchPresets(query: string): AnimationPreset[] {
  const q = query.toLowerCase();
  return ANIMATION_PRESET_LIBRARY.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q)),
  );
}
