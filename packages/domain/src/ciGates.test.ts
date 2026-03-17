/**
 * CI Gate Tests — P2: Enforce audit findings as product law.
 *
 * Gates 1-3 are enforced by shortcutManifest.test.ts, ToolRail.test.tsx,
 * and Canvas.test.tsx. This file covers Gates 4-6.
 */
import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const MANIFEST_PATH = path.resolve(
  __dirname,
  '../../../audit/event-handlers/command-capability-manifest.json',
);
const CANVAS_PATH = path.resolve(
  __dirname,
  '../../../apps/desktop/src/components/Canvas.tsx',
);
const POINTER_HANDLERS_PATH = path.resolve(
  __dirname,
  '../../../apps/desktop/src/lib/useCanvasPointerHandlers.ts',
);

describe('CI Gates — Audit Enforcement', () => {
  // ── Gate 4: No ephemeral authored state ──────────────────────
  describe('Gate 4: No ephemeral authored state in Canvas', () => {
    // After P3-C5, slice logic lives in useCanvasPointerHandlers.ts (not Canvas.tsx).
    // The gate still enforces: Rust is the source of truth for slice regions.
    it('slice regions are loaded from Rust (list_slice_regions)', () => {
      const source = fs.readFileSync(POINTER_HANDLERS_PATH, 'utf-8');
      expect(source).toContain('list_slice_regions');
    });

    it('slice regions are created via Rust (create_slice_region)', () => {
      const source = fs.readFileSync(POINTER_HANDLERS_PATH, 'utf-8');
      expect(source).toContain('create_slice_region');
    });

    it('no client-side slice region creation pattern', () => {
      const canvasSource = fs.readFileSync(CANVAS_PATH, 'utf-8');
      const hookSource = fs.readFileSync(POINTER_HANDLERS_PATH, 'utf-8');
      // Reject: setSliceRegions((prev) => [...prev, { x:... }])
      const clientSideCreate = /setSliceRegions\(\s*\(prev\)\s*=>/;
      expect(canvasSource).not.toMatch(clientSideCreate);
      expect(hookSource).not.toMatch(clientSideCreate);
    });
  });

  // ── Gate 5: Command manifest consistency ─────────────────────
  describe('Gate 5: Command capability manifest is consistent', () => {
    let manifest: {
      meta: {
        registeredCommands: number;
        summary: { live: number; reserved: number; internal: number; dead: number };
      };
      commands: { command: string; module: string; status: string; callers: string[] }[];
    };

    function loadManifest() {
      return JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
    }

    it('manifest file exists', () => {
      expect(fs.existsSync(MANIFEST_PATH)).toBe(true);
    });

    it('summary counts match actual command list', () => {
      manifest = loadManifest();
      const commands = manifest.commands;
      const counts = {
        live: commands.filter((c) => c.status === 'live').length,
        reserved: commands.filter((c) => c.status === 'reserved').length,
        internal: commands.filter((c) => c.status === 'internal').length,
        dead: commands.filter((c) => c.status === 'dead').length,
      };
      expect(counts.live).toBe(manifest.meta.summary.live);
      expect(counts.reserved).toBe(manifest.meta.summary.reserved);
      expect(counts.internal).toBe(manifest.meta.summary.internal);
      expect(counts.dead).toBe(manifest.meta.summary.dead);
      expect(commands.length).toBe(manifest.meta.registeredCommands);
    });

    it('every live command has at least one frontend caller', () => {
      manifest = loadManifest();
      const violations = manifest.commands.filter(
        (c) => c.status === 'live' && (!c.callers || c.callers.length === 0),
      );
      expect(
        violations.length,
        `Live commands with no callers: ${violations.map((c) => c.command).join(', ')}`,
      ).toBe(0);
    });

    it('no duplicate command names', () => {
      manifest = loadManifest();
      const names = manifest.commands.map((c) => c.command);
      const dupes = names.filter((n, i) => names.indexOf(n) !== i);
      expect(dupes.length, `Duplicates: ${dupes.join(', ')}`).toBe(0);
    });

    it('every command has a valid status', () => {
      manifest = loadManifest();
      const valid = ['live', 'reserved', 'internal', 'dead'];
      for (const cmd of manifest.commands) {
        expect(valid, `"${cmd.command}" has status "${cmd.status}"`).toContain(cmd.status);
      }
    });
  });

  // ── Gate 6: New commands require classification ──────────────
  describe('Gate 6: New commands are classified', () => {
    it('slice commands (P0-C) are present in manifest', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      const sliceCommands = manifest.commands.filter(
        (c: { module: string }) => c.module === 'slice',
      );
      expect(sliceCommands.length).toBe(4);
      const names = sliceCommands.map((c: { command: string }) => c.command).sort();
      expect(names).toEqual([
        'clear_slice_regions',
        'create_slice_region',
        'delete_slice_region',
        'list_slice_regions',
      ]);
    });

    it('total registered count is at least 186', () => {
      const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf-8'));
      expect(manifest.meta.registeredCommands).toBeGreaterThanOrEqual(186);
    });
  });
});
