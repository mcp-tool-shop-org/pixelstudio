/**
 * Starter recipes — curated start paths for common workflows.
 *
 * Recipes are thin orchestration over existing template/pack/blank
 * start flows. They do not create separate systems — they route
 * into the ones that already exist.
 */

/** How the recipe starts a project. */
export type RecipeStartKind = 'blank' | 'template' | 'pack';

/** A contextual hint shown after recipe launch. */
export interface RecipeHint {
  id: string;
  /** Short, actionable text. */
  text: string;
}

/** A starter recipe definition. */
export interface StarterRecipe {
  id: string;
  title: string;
  /** One-line intent — what this recipe is for. */
  intent: string;
  /** How the project starts. */
  startKind: RecipeStartKind;
  /** Canvas dimensions for blank starts. */
  canvasWidth?: number;
  canvasHeight?: number;
  /** Frame count for animation recipes. */
  frameCount?: number;
  /** Frame duration for animation recipes. */
  frameDurationMs?: number;
  /** Template ID to use (if startKind is 'template'). */
  templateId?: string;
  /** Pack ID to use (if startKind is 'pack'). */
  packId?: string;
  /** Hints to show after launch (dismissible, non-repeating). */
  hints: RecipeHint[];
}

// ── Built-in recipes ──

export const STARTER_RECIPES: StarterRecipe[] = [
  {
    id: 'static-sprite',
    title: 'Static Sprite',
    intent: 'Draw one clean asset fast',
    startKind: 'blank',
    canvasWidth: 32,
    canvasHeight: 32,
    hints: [
      { id: 'static-library', text: 'Open Library to access saved palettes and parts' },
    ],
  },
  {
    id: 'animated-loop',
    title: 'Animated Loop',
    intent: 'Create a motion cycle with timing control',
    startKind: 'blank',
    canvasWidth: 32,
    canvasHeight: 32,
    frameCount: 4,
    frameDurationMs: 100,
    hints: [
      { id: 'anim-duplicate', text: 'Ctrl+D duplicates the current frame for the next pose' },
      { id: 'anim-onion', text: 'Enable onion skin to see adjacent frames while drawing' },
    ],
  },
  {
    id: 'variant-family',
    title: 'Variant Family',
    intent: 'Build a base asset with directional or palette variants',
    startKind: 'blank',
    canvasWidth: 32,
    canvasHeight: 48,
    hints: [
      { id: 'variant-bar', text: 'Use the Variant Bar to fork from Base into named variants' },
      { id: 'variant-palette', text: 'Create palette sets in the Palette Sets panel for color variants' },
    ],
  },
  {
    id: 'pack-project',
    title: 'Asset Pack Project',
    intent: 'Start with reusable parts and palettes already loaded',
    startKind: 'blank',
    canvasWidth: 64,
    canvasHeight: 64,
    hints: [
      { id: 'pack-stamp', text: 'Click a part in Library to enter stamp mode' },
      { id: 'pack-library', text: 'Use Ctrl+F in Library for fast asset search' },
    ],
  },
];

/** Find a recipe by ID. */
export function findRecipe(id: string): StarterRecipe | undefined {
  return STARTER_RECIPES.find((r) => r.id === id);
}
