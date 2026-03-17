/**
 * Sprite Template Library — built-in starter templates.
 *
 * Each template defines a body topology with regions, connections,
 * and color slots. The LLM or user parameterizes these to generate
 * pixel art sprites procedurally.
 */

import type { SpriteTemplate } from '@glyphstudio/domain';

// ── Humanoid Warrior ──

const HUMANOID_WARRIOR: SpriteTemplate = {
  id: 'humanoid-warrior',
  name: 'Humanoid Warrior',
  description: 'Standard humanoid body with head, torso, arms, and legs. Suitable for RPG characters, NPCs, and player sprites.',
  archetype: 'humanoid',
  suggestedWidth: 16,
  suggestedHeight: 24,
  colorSlots: [
    { name: 'skin', description: 'Skin/face color', defaultColor: [224, 172, 120, 255] },
    { name: 'hair', description: 'Hair color', defaultColor: [80, 50, 30, 255] },
    { name: 'armor', description: 'Torso armor/clothing', defaultColor: [100, 100, 120, 255] },
    { name: 'pants', description: 'Leg armor/pants', defaultColor: [70, 70, 90, 255] },
    { name: 'boots', description: 'Feet/boots', defaultColor: [60, 40, 30, 255] },
    { name: 'outline', description: 'Dark outline', defaultColor: [30, 20, 15, 255] },
  ],
  regions: [
    { id: 'hair', name: 'Hair', x: 0.25, y: 0.0, width: 0.5, height: 0.15, shape: 'ellipse', colorSlot: 'hair', zOrder: 5, outlineColorSlot: 'outline' },
    { id: 'head', name: 'Head', x: 0.28, y: 0.04, width: 0.44, height: 0.2, shape: 'ellipse', colorSlot: 'skin', zOrder: 4, outlineColorSlot: 'outline' },
    { id: 'torso', name: 'Torso', x: 0.22, y: 0.24, width: 0.56, height: 0.3, shape: 'rect', colorSlot: 'armor', zOrder: 3, outlineColorSlot: 'outline' },
    { id: 'arm_l', name: 'Left Arm', x: 0.06, y: 0.26, width: 0.18, height: 0.28, shape: 'rect', colorSlot: 'skin', zOrder: 2, outlineColorSlot: 'outline' },
    { id: 'arm_r', name: 'Right Arm', x: 0.76, y: 0.26, width: 0.18, height: 0.28, shape: 'rect', colorSlot: 'skin', zOrder: 2, outlineColorSlot: 'outline' },
    { id: 'leg_l', name: 'Left Leg', x: 0.22, y: 0.54, width: 0.26, height: 0.3, shape: 'rect', colorSlot: 'pants', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'leg_r', name: 'Right Leg', x: 0.52, y: 0.54, width: 0.26, height: 0.3, shape: 'rect', colorSlot: 'pants', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'boot_l', name: 'Left Boot', x: 0.20, y: 0.84, width: 0.28, height: 0.16, shape: 'rect', colorSlot: 'boots', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'boot_r', name: 'Right Boot', x: 0.52, y: 0.84, width: 0.28, height: 0.16, shape: 'rect', colorSlot: 'boots', zOrder: 1, outlineColorSlot: 'outline' },
  ],
  connections: [
    { fromRegion: 'head', toRegion: 'torso', colorSlot: 'skin' },
    { fromRegion: 'torso', toRegion: 'arm_l', colorSlot: 'armor' },
    { fromRegion: 'torso', toRegion: 'arm_r', colorSlot: 'armor' },
    { fromRegion: 'torso', toRegion: 'leg_l', colorSlot: 'pants' },
    { fromRegion: 'torso', toRegion: 'leg_r', colorSlot: 'pants' },
    { fromRegion: 'leg_l', toRegion: 'boot_l', colorSlot: 'pants' },
    { fromRegion: 'leg_r', toRegion: 'boot_r', colorSlot: 'pants' },
  ],
  tags: ['humanoid', 'warrior', 'rpg', 'character'],
};

// ── Humanoid Mage ──

const HUMANOID_MAGE: SpriteTemplate = {
  id: 'humanoid-mage',
  name: 'Humanoid Mage',
  description: 'Robed humanoid with a pointed hat. Good for wizards, clerics, and magic users.',
  archetype: 'humanoid',
  suggestedWidth: 16,
  suggestedHeight: 24,
  colorSlots: [
    { name: 'skin', description: 'Skin/face color', defaultColor: [224, 182, 140, 255] },
    { name: 'robe', description: 'Robe/main garment', defaultColor: [60, 40, 120, 255] },
    { name: 'hat', description: 'Hat/hood', defaultColor: [50, 30, 100, 255] },
    { name: 'trim', description: 'Robe trim/accent', defaultColor: [200, 170, 50, 255] },
    { name: 'outline', description: 'Dark outline', defaultColor: [20, 15, 35, 255] },
  ],
  regions: [
    { id: 'hat', name: 'Hat', x: 0.2, y: 0.0, width: 0.6, height: 0.22, shape: 'triangle-up', colorSlot: 'hat', zOrder: 6, outlineColorSlot: 'outline' },
    { id: 'head', name: 'Head', x: 0.28, y: 0.12, width: 0.44, height: 0.18, shape: 'ellipse', colorSlot: 'skin', zOrder: 5, outlineColorSlot: 'outline' },
    { id: 'torso', name: 'Torso', x: 0.18, y: 0.30, width: 0.64, height: 0.3, shape: 'rect', colorSlot: 'robe', zOrder: 3, outlineColorSlot: 'outline' },
    { id: 'sleeve_l', name: 'Left Sleeve', x: 0.02, y: 0.32, width: 0.18, height: 0.24, shape: 'rect', colorSlot: 'robe', zOrder: 2 },
    { id: 'sleeve_r', name: 'Right Sleeve', x: 0.80, y: 0.32, width: 0.18, height: 0.24, shape: 'rect', colorSlot: 'robe', zOrder: 2 },
    { id: 'skirt', name: 'Robe Skirt', x: 0.12, y: 0.60, width: 0.76, height: 0.35, shape: 'triangle-down', colorSlot: 'robe', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'trim_band', name: 'Trim Band', x: 0.18, y: 0.58, width: 0.64, height: 0.06, shape: 'rect', colorSlot: 'trim', zOrder: 4 },
  ],
  connections: [
    { fromRegion: 'head', toRegion: 'torso', colorSlot: 'skin' },
    { fromRegion: 'torso', toRegion: 'sleeve_l', colorSlot: 'robe' },
    { fromRegion: 'torso', toRegion: 'sleeve_r', colorSlot: 'robe' },
    { fromRegion: 'torso', toRegion: 'skirt', colorSlot: 'robe' },
  ],
  tags: ['humanoid', 'mage', 'wizard', 'rpg', 'character'],
};

// ── Quadruped Creature ──

const QUADRUPED_CREATURE: SpriteTemplate = {
  id: 'quadruped-creature',
  name: 'Quadruped Creature',
  description: 'Four-legged creature body. Works for wolves, horses, dragons, or fantasy beasts.',
  archetype: 'quadruped',
  suggestedWidth: 24,
  suggestedHeight: 16,
  colorSlots: [
    { name: 'body', description: 'Main body color', defaultColor: [140, 100, 70, 255] },
    { name: 'belly', description: 'Underbelly/lighter area', defaultColor: [180, 150, 110, 255] },
    { name: 'accent', description: 'Mane/markings', defaultColor: [100, 70, 40, 255] },
    { name: 'eye', description: 'Eye color', defaultColor: [220, 200, 40, 255] },
    { name: 'outline', description: 'Dark outline', defaultColor: [30, 20, 15, 255] },
  ],
  regions: [
    { id: 'head', name: 'Head', x: 0.0, y: 0.1, width: 0.3, height: 0.4, shape: 'ellipse', colorSlot: 'body', zOrder: 5, outlineColorSlot: 'outline' },
    { id: 'eye', name: 'Eye', x: 0.08, y: 0.18, width: 0.08, height: 0.1, shape: 'ellipse', colorSlot: 'eye', zOrder: 6 },
    { id: 'body_main', name: 'Body', x: 0.22, y: 0.1, width: 0.55, height: 0.5, shape: 'ellipse', colorSlot: 'body', zOrder: 3, outlineColorSlot: 'outline' },
    { id: 'belly_area', name: 'Belly', x: 0.28, y: 0.35, width: 0.42, height: 0.2, shape: 'ellipse', colorSlot: 'belly', zOrder: 4 },
    { id: 'mane', name: 'Mane', x: 0.18, y: 0.02, width: 0.2, height: 0.3, shape: 'ellipse', colorSlot: 'accent', zOrder: 4 },
    { id: 'tail', name: 'Tail', x: 0.75, y: 0.05, width: 0.25, height: 0.25, shape: 'ellipse', colorSlot: 'accent', zOrder: 2 },
    { id: 'leg_fl', name: 'Front Left Leg', x: 0.2, y: 0.55, width: 0.14, height: 0.42, shape: 'rect', colorSlot: 'body', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'leg_fr', name: 'Front Right Leg', x: 0.34, y: 0.55, width: 0.14, height: 0.42, shape: 'rect', colorSlot: 'body', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'leg_bl', name: 'Back Left Leg', x: 0.56, y: 0.55, width: 0.14, height: 0.42, shape: 'rect', colorSlot: 'body', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'leg_br', name: 'Back Right Leg', x: 0.70, y: 0.55, width: 0.14, height: 0.42, shape: 'rect', colorSlot: 'body', zOrder: 1, outlineColorSlot: 'outline' },
  ],
  connections: [
    { fromRegion: 'head', toRegion: 'body_main', colorSlot: 'body' },
    { fromRegion: 'body_main', toRegion: 'tail', colorSlot: 'body' },
    { fromRegion: 'body_main', toRegion: 'leg_fl', colorSlot: 'body' },
    { fromRegion: 'body_main', toRegion: 'leg_fr', colorSlot: 'body' },
    { fromRegion: 'body_main', toRegion: 'leg_bl', colorSlot: 'body' },
    { fromRegion: 'body_main', toRegion: 'leg_br', colorSlot: 'body' },
  ],
  tags: ['quadruped', 'creature', 'animal', 'beast', 'monster'],
};

// ── Item / Weapon ──

const ITEM_SWORD: SpriteTemplate = {
  id: 'item-sword',
  name: 'Sword',
  description: 'Simple one-handed sword. Customizable blade, guard, and grip colors.',
  archetype: 'item',
  suggestedWidth: 8,
  suggestedHeight: 24,
  colorSlots: [
    { name: 'blade', description: 'Blade metal color', defaultColor: [200, 210, 220, 255] },
    { name: 'edge', description: 'Blade edge highlight', defaultColor: [240, 245, 255, 255] },
    { name: 'guard', description: 'Cross-guard color', defaultColor: [160, 130, 50, 255] },
    { name: 'grip', description: 'Handle/grip', defaultColor: [80, 50, 30, 255] },
    { name: 'pommel', description: 'Pommel gem/cap', defaultColor: [180, 40, 40, 255] },
    { name: 'outline', description: 'Dark outline', defaultColor: [25, 25, 30, 255] },
  ],
  regions: [
    { id: 'blade_tip', name: 'Blade Tip', x: 0.25, y: 0.0, width: 0.5, height: 0.08, shape: 'triangle-up', colorSlot: 'blade', zOrder: 3, outlineColorSlot: 'outline' },
    { id: 'blade', name: 'Blade', x: 0.25, y: 0.06, width: 0.5, height: 0.52, shape: 'rect', colorSlot: 'blade', zOrder: 2, outlineColorSlot: 'outline' },
    { id: 'edge', name: 'Edge Highlight', x: 0.55, y: 0.04, width: 0.12, height: 0.54, shape: 'rect', colorSlot: 'edge', zOrder: 4 },
    { id: 'guard', name: 'Cross Guard', x: 0.06, y: 0.58, width: 0.88, height: 0.08, shape: 'rect', colorSlot: 'guard', zOrder: 5, outlineColorSlot: 'outline' },
    { id: 'grip', name: 'Grip', x: 0.3, y: 0.66, width: 0.4, height: 0.22, shape: 'rect', colorSlot: 'grip', zOrder: 1, outlineColorSlot: 'outline' },
    { id: 'pommel', name: 'Pommel', x: 0.25, y: 0.88, width: 0.5, height: 0.12, shape: 'ellipse', colorSlot: 'pommel', zOrder: 3, outlineColorSlot: 'outline' },
  ],
  connections: [
    { fromRegion: 'blade_tip', toRegion: 'blade', colorSlot: 'blade' },
    { fromRegion: 'blade', toRegion: 'guard', colorSlot: 'blade' },
    { fromRegion: 'guard', toRegion: 'grip', colorSlot: 'guard' },
    { fromRegion: 'grip', toRegion: 'pommel', colorSlot: 'grip' },
  ],
  tags: ['item', 'weapon', 'sword', 'melee'],
};

// ── Library ──

/** All built-in sprite templates. */
export const SPRITE_TEMPLATE_LIBRARY: readonly SpriteTemplate[] = [
  HUMANOID_WARRIOR,
  HUMANOID_MAGE,
  QUADRUPED_CREATURE,
  ITEM_SWORD,
];

/** Find a template by ID. */
export function findTemplate(id: string): SpriteTemplate | undefined {
  return SPRITE_TEMPLATE_LIBRARY.find((t) => t.id === id);
}

/** List templates filtered by archetype. */
export function listTemplatesByArchetype(archetype: string): SpriteTemplate[] {
  return SPRITE_TEMPLATE_LIBRARY.filter((t) => t.archetype === archetype);
}

/** Search templates by tag. */
export function searchTemplates(query: string): SpriteTemplate[] {
  const q = query.toLowerCase();
  return SPRITE_TEMPLATE_LIBRARY.filter((t) =>
    t.name.toLowerCase().includes(q) ||
    t.description.toLowerCase().includes(q) ||
    t.tags.some((tag) => tag.includes(q))
  );
}
