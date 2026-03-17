import { describe, it, expect } from 'vitest';
import {
  BUILT_IN_SIZE_PROFILES,
  createSizeProfile,
  generateSizeProfileId,
} from './sizeProfile';
import type { SizeProfile, ReductionReport } from './sizeProfile';

describe('sizeProfile domain types', () => {
  // ── Built-in profiles ──

  describe('BUILT_IN_SIZE_PROFILES', () => {
    it('has 7 built-in profiles', () => {
      expect(BUILT_IN_SIZE_PROFILES).toHaveLength(7);
    });

    it('covers common sprite sizes', () => {
      const sizes = BUILT_IN_SIZE_PROFILES.map(p => `${p.targetWidth}x${p.targetHeight}`);
      expect(sizes).toContain('16x16');
      expect(sizes).toContain('16x32');
      expect(sizes).toContain('24x24');
      expect(sizes).toContain('32x32');
      expect(sizes).toContain('32x48');
      expect(sizes).toContain('48x48');
      expect(sizes).toContain('64x64');
    });

    it('all profiles have names and notes', () => {
      for (const p of BUILT_IN_SIZE_PROFILES) {
        expect(p.name).toBeTruthy();
        expect(p.notes).toBeTruthy();
        expect(p.id).toBeTruthy();
      }
    });

    it('all profiles have positive dimensions', () => {
      for (const p of BUILT_IN_SIZE_PROFILES) {
        expect(p.targetWidth).toBeGreaterThan(0);
        expect(p.targetHeight).toBeGreaterThan(0);
      }
    });
  });

  // ── ID generator ──

  describe('generateSizeProfileId', () => {
    it('generates unique IDs', () => {
      const a = generateSizeProfileId();
      const b = generateSizeProfileId();
      expect(a).not.toBe(b);
      expect(a).toMatch(/^sp_/);
    });
  });

  // ── Factory ──

  describe('createSizeProfile', () => {
    it('creates a custom profile', () => {
      const p = createSizeProfile('128×128 huge', 128, 128, 'For large portraits');
      expect(p.name).toBe('128×128 huge');
      expect(p.targetWidth).toBe(128);
      expect(p.targetHeight).toBe(128);
      expect(p.notes).toBe('For large portraits');
    });

    it('defaults notes to empty string', () => {
      const p = createSizeProfile('test', 32, 32);
      expect(p.notes).toBe('');
    });

    it('generates unique IDs', () => {
      const a = createSizeProfile('a', 16, 16);
      const b = createSizeProfile('b', 16, 16);
      expect(a.id).not.toBe(b.id);
    });

    it('rejects zero width', () => {
      expect(() => createSizeProfile('bad', 0, 32)).toThrow('at least 1×1');
    });

    it('rejects negative height', () => {
      expect(() => createSizeProfile('bad', 32, -1)).toThrow('at least 1×1');
    });
  });

  // ── ReductionReport type contract ──

  describe('ReductionReport type', () => {
    it('has all required fields', () => {
      const report: ReductionReport = {
        profileId: 'sp_48x48',
        targetWidth: 48,
        targetHeight: 48,
        filledPixelCount: 1200,
        totalPixels: 2304,
        fillPercent: 52.08,
        collapsedShapeIds: ['vs_buckle_1'],
        survivedShapeIds: ['vs_head', 'vs_torso', 'vs_cape'],
        silhouetteBounds: { x: 5, y: 2, w: 38, h: 44 },
      };
      expect(report.profileId).toBe('sp_48x48');
      expect(report.fillPercent).toBeCloseTo(52.08);
      expect(report.collapsedShapeIds).toHaveLength(1);
      expect(report.survivedShapeIds).toHaveLength(3);
    });
  });
});
