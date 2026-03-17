import { describe, it, expect } from 'vitest';
import {
  SPRITE_TEMPLATE_LIBRARY,
  findTemplate,
  listTemplatesByArchetype,
  searchTemplates,
} from './spriteTemplateLibrary';

describe('SPRITE_TEMPLATE_LIBRARY', () => {
  it('contains 4 starter templates', () => {
    expect(SPRITE_TEMPLATE_LIBRARY).toHaveLength(4);
  });

  it('all templates have unique IDs', () => {
    const ids = SPRITE_TEMPLATE_LIBRARY.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all templates have required fields', () => {
    for (const t of SPRITE_TEMPLATE_LIBRARY) {
      expect(t.id).toBeTruthy();
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.archetype).toBeTruthy();
      expect(t.suggestedWidth).toBeGreaterThan(0);
      expect(t.suggestedHeight).toBeGreaterThan(0);
      expect(t.colorSlots.length).toBeGreaterThan(0);
      expect(t.regions.length).toBeGreaterThan(0);
      expect(t.tags.length).toBeGreaterThan(0);
    }
  });

  it('all region colorSlot references exist in colorSlots', () => {
    for (const t of SPRITE_TEMPLATE_LIBRARY) {
      const slotNames = new Set(t.colorSlots.map((s) => s.name));
      for (const r of t.regions) {
        expect(slotNames.has(r.colorSlot)).toBe(true);
        if (r.outlineColorSlot) {
          expect(slotNames.has(r.outlineColorSlot)).toBe(true);
        }
      }
    }
  });

  it('all connection references exist in regions', () => {
    for (const t of SPRITE_TEMPLATE_LIBRARY) {
      const regionIds = new Set(t.regions.map((r) => r.id));
      for (const c of t.connections) {
        expect(regionIds.has(c.fromRegion)).toBe(true);
        expect(regionIds.has(c.toRegion)).toBe(true);
      }
    }
  });

  it('all connection colorSlot references exist in colorSlots', () => {
    for (const t of SPRITE_TEMPLATE_LIBRARY) {
      const slotNames = new Set(t.colorSlots.map((s) => s.name));
      for (const c of t.connections) {
        expect(slotNames.has(c.colorSlot)).toBe(true);
      }
    }
  });

  it('region positions are within 0-1 range', () => {
    for (const t of SPRITE_TEMPLATE_LIBRARY) {
      for (const r of t.regions) {
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.width).toBeGreaterThan(0);
        expect(r.height).toBeGreaterThan(0);
        expect(r.x + r.width).toBeLessThanOrEqual(1.01); // small float tolerance
        expect(r.y + r.height).toBeLessThanOrEqual(1.01);
      }
    }
  });

  it('color slots have valid RGBA defaults', () => {
    for (const t of SPRITE_TEMPLATE_LIBRARY) {
      for (const s of t.colorSlots) {
        expect(s.defaultColor).toHaveLength(4);
        for (const c of s.defaultColor) {
          expect(c).toBeGreaterThanOrEqual(0);
          expect(c).toBeLessThanOrEqual(255);
        }
      }
    }
  });
});

describe('findTemplate', () => {
  it('finds existing template by ID', () => {
    const t = findTemplate('humanoid-warrior');
    expect(t).toBeDefined();
    expect(t!.name).toBe('Humanoid Warrior');
  });

  it('returns undefined for unknown ID', () => {
    expect(findTemplate('nonexistent')).toBeUndefined();
  });
});

describe('listTemplatesByArchetype', () => {
  it('returns humanoid templates', () => {
    const results = listTemplatesByArchetype('humanoid');
    expect(results).toHaveLength(2);
    expect(results.map((t) => t.id)).toContain('humanoid-warrior');
    expect(results.map((t) => t.id)).toContain('humanoid-mage');
  });

  it('returns item templates', () => {
    const results = listTemplatesByArchetype('item');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('item-sword');
  });

  it('returns empty for unknown archetype', () => {
    expect(listTemplatesByArchetype('flying')).toHaveLength(0);
  });
});

describe('searchTemplates', () => {
  it('searches by name', () => {
    const results = searchTemplates('warrior');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('humanoid-warrior');
  });

  it('searches by tag', () => {
    const results = searchTemplates('rpg');
    expect(results).toHaveLength(2);
  });

  it('searches by description keyword', () => {
    const results = searchTemplates('sword');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.map((t) => t.id)).toContain('item-sword');
  });

  it('is case-insensitive', () => {
    const results = searchTemplates('MAGE');
    expect(results).toHaveLength(1);
    expect(results[0].id).toBe('humanoid-mage');
  });

  it('returns empty for no match', () => {
    expect(searchTemplates('spaceship')).toHaveLength(0);
  });
});
