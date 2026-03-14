import { describe, it, expect, beforeEach } from 'vitest';

// ── Inline replica of exportSettings load/save ─────────────────
// Production code lives in apps/desktop/src/lib/exportSettings.ts.
// Inlined here so persistence logic is testable from the state package.

type ManifestFormat = 'pixelstudio_native' | 'generic_runtime';

interface PersistedExportSettings {
  scopeChoice: string;
  layoutChoice: string;
  selectedClipId: string | null;
  spanStart: number;
  spanEnd: number;
  emitManifest: boolean;
  manifestFormat: ManifestFormat;
  lastOutputDir: string | null;
  lastOutputFile: string | null;
}

const STORAGE_KEY = 'pixelstudio_export_settings';

const DEFAULTS: PersistedExportSettings = {
  scopeChoice: 'current_frame',
  layoutChoice: 'horizontal_strip',
  selectedClipId: null,
  spanStart: 1,
  spanEnd: 1,
  emitManifest: false,
  manifestFormat: 'pixelstudio_native',
  lastOutputDir: null,
  lastOutputFile: null,
};

function loadExportSettings(): PersistedExportSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      scopeChoice: parsed.scopeChoice ?? DEFAULTS.scopeChoice,
      layoutChoice: parsed.layoutChoice ?? DEFAULTS.layoutChoice,
      selectedClipId: parsed.selectedClipId ?? DEFAULTS.selectedClipId,
      spanStart: typeof parsed.spanStart === 'number' ? parsed.spanStart : DEFAULTS.spanStart,
      spanEnd: typeof parsed.spanEnd === 'number' ? parsed.spanEnd : DEFAULTS.spanEnd,
      emitManifest: typeof parsed.emitManifest === 'boolean' ? parsed.emitManifest : DEFAULTS.emitManifest,
      manifestFormat: parsed.manifestFormat ?? DEFAULTS.manifestFormat,
      lastOutputDir: parsed.lastOutputDir ?? DEFAULTS.lastOutputDir,
      lastOutputFile: parsed.lastOutputFile ?? DEFAULTS.lastOutputFile,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function saveExportSettings(settings: Partial<PersistedExportSettings>): void {
  try {
    const current = loadExportSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}

// ── Fake localStorage ──────────────────────────────────────────
const store = new Map<string, string>();
const fakeLocalStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (_i: number) => null as string | null,
};

Object.defineProperty(globalThis, 'localStorage', {
  value: fakeLocalStorage,
  writable: true,
});

// ── Tests ──────────────────────────────────────────────────────
describe('exportSettings persistence', () => {
  beforeEach(() => store.clear());

  // ── defaults ────────────────────────────────────────────────
  it('returns defaults when localStorage is empty', () => {
    expect(loadExportSettings()).toEqual(DEFAULTS);
  });

  it('returns defaults when stored JSON is corrupt', () => {
    store.set(STORAGE_KEY, '{{{bad json');
    expect(loadExportSettings()).toEqual(DEFAULTS);
  });

  it('returns defaults when stored value is non-object', () => {
    store.set(STORAGE_KEY, '"just a string"');
    // parsed.scopeChoice -> undefined -> falls back to default via ??
    const result = loadExportSettings();
    expect(result.scopeChoice).toBe(DEFAULTS.scopeChoice);
    expect(result.spanStart).toBe(DEFAULTS.spanStart);
  });

  // ── type coercion ──────────────────────────────────────────
  it('falls back to default if spanStart is not a number', () => {
    store.set(STORAGE_KEY, JSON.stringify({ spanStart: 'not-a-number' }));
    expect(loadExportSettings().spanStart).toBe(1);
  });

  it('falls back to default if spanEnd is not a number', () => {
    store.set(STORAGE_KEY, JSON.stringify({ spanEnd: true }));
    expect(loadExportSettings().spanEnd).toBe(1);
  });

  it('falls back to default if emitManifest is not a boolean', () => {
    store.set(STORAGE_KEY, JSON.stringify({ emitManifest: 'yes' }));
    expect(loadExportSettings().emitManifest).toBe(false);
  });

  it('accepts zero for numeric fields', () => {
    store.set(STORAGE_KEY, JSON.stringify({ spanStart: 0, spanEnd: 0 }));
    const result = loadExportSettings();
    expect(result.spanStart).toBe(0);
    expect(result.spanEnd).toBe(0);
  });

  // ── round-trip ─────────────────────────────────────────────
  it('save then load round-trips full settings', () => {
    const custom: PersistedExportSettings = {
      scopeChoice: 'all_clips',
      layoutChoice: 'grid',
      selectedClipId: 'clip-42',
      spanStart: 3,
      spanEnd: 10,
      emitManifest: true,
      manifestFormat: 'generic_runtime',
      lastOutputDir: '/tmp/out',
      lastOutputFile: 'sprites.png',
    };
    saveExportSettings(custom);
    expect(loadExportSettings()).toEqual(custom);
  });

  it('partial save merges with existing', () => {
    saveExportSettings({ scopeChoice: 'selected_span', spanStart: 5, spanEnd: 8 });
    saveExportSettings({ emitManifest: true });
    const result = loadExportSettings();
    expect(result.scopeChoice).toBe('selected_span');
    expect(result.spanStart).toBe(5);
    expect(result.emitManifest).toBe(true);
    // untouched fields stay at defaults
    expect(result.layoutChoice).toBe('horizontal_strip');
  });

  it('partial save does not lose existing non-default values', () => {
    saveExportSettings({ lastOutputDir: '/home/export', lastOutputFile: 'sheet.png' });
    saveExportSettings({ spanStart: 2 });
    const result = loadExportSettings();
    expect(result.lastOutputDir).toBe('/home/export');
    expect(result.lastOutputFile).toBe('sheet.png');
    expect(result.spanStart).toBe(2);
  });

  // ── null handling ──────────────────────────────────────────
  it('preserves null for selectedClipId', () => {
    saveExportSettings({ selectedClipId: 'clip-1' });
    expect(loadExportSettings().selectedClipId).toBe('clip-1');
    // Note: setting null via ??: null ?? default → default
    // This matches prod behavior: null is treated as "reset"
    saveExportSettings({ selectedClipId: null });
    expect(loadExportSettings().selectedClipId).toBe(null);
  });

  // ── manifestFormat ─────────────────────────────────────────
  it('stores and retrieves manifestFormat', () => {
    saveExportSettings({ manifestFormat: 'generic_runtime' });
    expect(loadExportSettings().manifestFormat).toBe('generic_runtime');
  });

  // ── extra/unknown keys ─────────────────────────────────────
  it('ignores unknown keys in stored JSON', () => {
    store.set(STORAGE_KEY, JSON.stringify({ scopeChoice: 'all_clips', unknownField: 999 }));
    const result = loadExportSettings();
    expect(result.scopeChoice).toBe('all_clips');
    expect((result as Record<string, unknown>)['unknownField']).toBeUndefined();
  });

  // ── empty object ───────────────────────────────────────────
  it('returns all defaults when stored object is empty', () => {
    store.set(STORAGE_KEY, '{}');
    expect(loadExportSettings()).toEqual(DEFAULTS);
  });
});
