import { describe, it, expect } from 'vitest';
import {
  SHORTCUT_MANIFEST,
  TOOL_KEY_MAP,
  TOOL_SHIFT_KEY_MAP,
  LIVE_DISPLAYED_SHORTCUTS,
  TOOL_SHORTCUT_LABEL,
} from './shortcutManifest';

describe('ShortcutManifest', () => {
  it('every entry has a unique id', () => {
    const ids = SHORTCUT_MANIFEST.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('every entry has a non-empty code', () => {
    for (const b of SHORTCUT_MANIFEST) {
      expect(b.code.length, `Entry ${b.id} has empty code`).toBeGreaterThan(0);
    }
  });

  it('every entry has a non-empty label', () => {
    for (const b of SHORTCUT_MANIFEST) {
      expect(b.label.length, `Entry ${b.id} has empty label`).toBeGreaterThan(0);
    }
  });

  it('every entry has a valid status', () => {
    const validStatuses = ['live', 'reserved', 'hidden', 'disabled'];
    for (const b of SHORTCUT_MANIFEST) {
      expect(validStatuses, `Entry ${b.id} has invalid status "${b.status}"`).toContain(b.status);
    }
  });

  it('every entry has a valid scope', () => {
    const validScopes = ['canvas', 'global', 'panel', 'timeline'];
    for (const b of SHORTCUT_MANIFEST) {
      expect(validScopes, `Entry ${b.id} has invalid scope "${b.scope}"`).toContain(b.scope);
    }
  });

  it('every entry has a valid focusPolicy', () => {
    const valid = ['block-in-text', 'allow-in-text', 'ctrl-only'];
    for (const b of SHORTCUT_MANIFEST) {
      expect(valid, `Entry ${b.id} has invalid focusPolicy "${b.focusPolicy}"`).toContain(b.focusPolicy);
    }
  });

  it('only live entries may be displayed', () => {
    for (const b of SHORTCUT_MANIFEST) {
      if (b.displayed) {
        expect(b.status, `Entry ${b.id} is displayed but status is "${b.status}"`).toBe('live');
      }
    }
  });

  it('no two unmodified tool shortcuts share the same code', () => {
    const toolKeys = SHORTCUT_MANIFEST
      .filter((b) => b.toolId && b.status === 'live' && !b.modifiers.ctrl && !b.modifiers.shift && !b.modifiers.alt);
    const codes = toolKeys.map((b) => b.code);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it('TOOL_KEY_MAP contains all unmodified live tool shortcuts', () => {
    const expected = SHORTCUT_MANIFEST
      .filter((b) => b.toolId && b.status === 'live' && !b.modifiers.ctrl && !b.modifiers.shift && !b.modifiers.alt);
    expect(TOOL_KEY_MAP.size).toBe(expected.length);
    for (const b of expected) {
      expect(TOOL_KEY_MAP.get(b.code), `Missing TOOL_KEY_MAP entry for ${b.code}`).toBe(b.toolId);
    }
  });

  it('TOOL_SHIFT_KEY_MAP contains all shift tool shortcuts', () => {
    const expected = SHORTCUT_MANIFEST
      .filter((b) => b.toolId && b.status === 'live' && b.modifiers.shift && !b.modifiers.ctrl && !b.modifiers.alt);
    expect(TOOL_SHIFT_KEY_MAP.size).toBe(expected.length);
  });

  it('LIVE_DISPLAYED_SHORTCUTS matches manifest', () => {
    const expected = SHORTCUT_MANIFEST.filter((b) => b.status === 'live' && b.displayed);
    expect(LIVE_DISPLAYED_SHORTCUTS.size).toBe(expected.length);
  });

  it('TOOL_SHORTCUT_LABEL covers all live+displayed tool entries', () => {
    const expected = SHORTCUT_MANIFEST.filter((b) => b.status === 'live' && b.displayed && b.toolId);
    expect(TOOL_SHORTCUT_LABEL.size).toBe(expected.length);
  });

  it('O is onion skin, not ellipse', () => {
    const oEntries = SHORTCUT_MANIFEST.filter((b) => b.code === 'KeyO' && !b.modifiers.ctrl);
    expect(oEntries.length).toBe(1);
    expect(oEntries[0].id).toBe('onion-skin');
    expect(oEntries[0].toolId).toBeUndefined();
  });

  it('ellipse uses KeyC', () => {
    const ellipse = SHORTCUT_MANIFEST.find((b) => b.id === 'tool-ellipse');
    expect(ellipse).toBeDefined();
    expect(ellipse!.code).toBe('KeyC');
    expect(ellipse!.label).toBe('C');
  });
});
