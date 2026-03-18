import { describe, it, expect } from 'vitest';
import { STARTER_RECIPES, findRecipe } from './starterRecipes';
import type { StarterRecipe } from './starterRecipes';

describe('starterRecipes', () => {
  it('has 4 built-in recipes', () => {
    expect(STARTER_RECIPES).toHaveLength(4);
  });

  it('each recipe has required fields', () => {
    for (const recipe of STARTER_RECIPES) {
      expect(recipe.id).toBeTruthy();
      expect(recipe.title).toBeTruthy();
      expect(recipe.intent).toBeTruthy();
      expect(recipe.startKind).toBeTruthy();
      expect(Array.isArray(recipe.hints)).toBe(true);
    }
  });

  it('static-sprite recipe is blank start with 32x32', () => {
    const r = findRecipe('static-sprite')!;
    expect(r.startKind).toBe('blank');
    expect(r.canvasWidth).toBe(32);
    expect(r.canvasHeight).toBe(32);
    expect(r.frameCount).toBeUndefined();
  });

  it('animated-loop recipe has frame count', () => {
    const r = findRecipe('animated-loop')!;
    expect(r.frameCount).toBe(4);
    expect(r.frameDurationMs).toBe(100);
  });

  it('variant-family recipe has taller canvas', () => {
    const r = findRecipe('variant-family')!;
    expect(r.canvasWidth).toBe(32);
    expect(r.canvasHeight).toBe(48);
  });

  it('pack-project recipe has larger canvas', () => {
    const r = findRecipe('pack-project')!;
    expect(r.canvasWidth).toBe(64);
    expect(r.canvasHeight).toBe(64);
  });

  it('findRecipe returns undefined for unknown id', () => {
    expect(findRecipe('nonexistent')).toBeUndefined();
  });

  it('each recipe has at least one hint', () => {
    for (const recipe of STARTER_RECIPES) {
      expect(recipe.hints.length).toBeGreaterThan(0);
    }
  });
});
