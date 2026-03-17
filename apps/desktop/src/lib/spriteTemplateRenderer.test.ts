import { describe, it, expect } from 'vitest';
import { resolveTemplate } from './spriteTemplateRenderer';
import { findTemplate } from './spriteTemplateLibrary';
import type { SpriteTemplate, TemplateParams } from '@glyphstudio/domain';

describe('resolveTemplate', () => {
  it('resolves humanoid-warrior at scale 1', () => {
    const template = findTemplate('humanoid-warrior')!;
    const params: TemplateParams = {
      templateId: 'humanoid-warrior',
      colors: {},
      scale: 1.0,
    };

    const { regions, connections } = resolveTemplate(template, params);

    expect(regions).toHaveLength(template.regions.length);
    expect(connections).toHaveLength(template.connections.length);
  });

  it('produces integer pixel coordinates', () => {
    const template = findTemplate('humanoid-warrior')!;
    const params: TemplateParams = {
      templateId: 'humanoid-warrior',
      colors: {},
      scale: 1.0,
    };

    const { regions, connections } = resolveTemplate(template, params);

    for (const r of regions) {
      expect(Number.isInteger(r.x)).toBe(true);
      expect(Number.isInteger(r.y)).toBe(true);
      expect(Number.isInteger(r.width)).toBe(true);
      expect(Number.isInteger(r.height)).toBe(true);
      expect(r.width).toBeGreaterThanOrEqual(1);
      expect(r.height).toBeGreaterThanOrEqual(1);
    }

    for (const c of connections) {
      expect(Number.isInteger(c.fromX)).toBe(true);
      expect(Number.isInteger(c.fromY)).toBe(true);
      expect(Number.isInteger(c.toX)).toBe(true);
      expect(Number.isInteger(c.toY)).toBe(true);
    }
  });

  it('applies color overrides', () => {
    const template = findTemplate('humanoid-warrior')!;
    const params: TemplateParams = {
      templateId: 'humanoid-warrior',
      colors: { skin: [255, 0, 0, 255] },
      scale: 1.0,
    };

    const { regions } = resolveTemplate(template, params);

    // Head region uses 'skin' slot
    const head = regions.find((r) => r.shape === 'ellipse' && r.zOrder === 4);
    expect(head).toBeDefined();
    expect(head!.r).toBe(255);
    expect(head!.g).toBe(0);
    expect(head!.b).toBe(0);
  });

  it('uses default colors when no override', () => {
    const template = findTemplate('humanoid-warrior')!;
    const params: TemplateParams = {
      templateId: 'humanoid-warrior',
      colors: {},
      scale: 1.0,
    };

    const { regions } = resolveTemplate(template, params);

    // Hair region uses 'hair' slot, default is [80, 50, 30, 255]
    const hair = regions.find((r) => r.zOrder === 5);
    expect(hair).toBeDefined();
    expect(hair!.r).toBe(80);
    expect(hair!.g).toBe(50);
    expect(hair!.b).toBe(30);
  });

  it('scales regions correctly at 2x', () => {
    const template = findTemplate('item-sword')!;
    const params: TemplateParams = {
      templateId: 'item-sword',
      colors: {},
      scale: 2.0,
    };

    const { regions } = resolveTemplate(template, params);

    // At 2x, sword is 16x48 canvas
    // All regions should fit within scaled bounds
    for (const r of regions) {
      expect(r.x + r.width).toBeLessThanOrEqual(17); // small rounding tolerance
      expect(r.y + r.height).toBeLessThanOrEqual(49);
    }
  });

  it('includes outline colors when specified', () => {
    const template = findTemplate('humanoid-warrior')!;
    const params: TemplateParams = {
      templateId: 'humanoid-warrior',
      colors: {},
      scale: 1.0,
    };

    const { regions } = resolveTemplate(template, params);

    // Head has outlineColorSlot='outline'
    const head = regions.find((r) => r.zOrder === 4 && r.shape === 'ellipse');
    expect(head).toBeDefined();
    expect(head!.outlineR).toBeDefined();
    expect(head!.outlineA).toBe(255);
  });

  it('omits outline for regions without outlineColorSlot', () => {
    const template = findTemplate('humanoid-mage')!;
    const params: TemplateParams = {
      templateId: 'humanoid-mage',
      colors: {},
      scale: 1.0,
    };

    const { regions } = resolveTemplate(template, params);

    // sleeve_l has no outlineColorSlot
    const sleeve = regions.find((r) => r.zOrder === 2);
    expect(sleeve).toBeDefined();
    expect(sleeve!.outlineR).toBeUndefined();
  });

  it('connection centers are within canvas bounds', () => {
    const template = findTemplate('quadruped-creature')!;
    const params: TemplateParams = {
      templateId: 'quadruped-creature',
      colors: {},
      scale: 1.0,
    };

    const { connections } = resolveTemplate(template, params);
    const w = template.suggestedWidth;
    const h = template.suggestedHeight;

    for (const c of connections) {
      expect(c.fromX).toBeGreaterThanOrEqual(0);
      expect(c.fromX).toBeLessThanOrEqual(w);
      expect(c.fromY).toBeGreaterThanOrEqual(0);
      expect(c.fromY).toBeLessThanOrEqual(h);
      expect(c.toX).toBeGreaterThanOrEqual(0);
      expect(c.toX).toBeLessThanOrEqual(w);
      expect(c.toY).toBeGreaterThanOrEqual(0);
      expect(c.toY).toBeLessThanOrEqual(h);
    }
  });

  it('works for all templates', () => {
    const templateIds = ['humanoid-warrior', 'humanoid-mage', 'quadruped-creature', 'item-sword'];

    for (const id of templateIds) {
      const template = findTemplate(id)!;
      const params: TemplateParams = {
        templateId: id,
        colors: {},
        scale: 1.0,
      };

      const { regions, connections } = resolveTemplate(template, params);
      expect(regions.length).toBeGreaterThan(0);
      // All templates have connections
      expect(connections.length).toBeGreaterThan(0);
    }
  });
});
