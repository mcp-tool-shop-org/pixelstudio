import { describe, it, expect, beforeEach } from 'vitest';

// ── Inline replica of packagingSettings load/save ──────────────
// Production code lives in apps/desktop/src/lib/packagingSettings.ts.
// Inlined here so persistence logic is testable from the state package.

type ExportBundleFormat = 'folder' | 'zip';

interface PersistedPackagingSettings {
  bundleFormat: ExportBundleFormat;
  bundleIncludePreview: boolean;
  catalogBundleFormat: ExportBundleFormat;
  catalogIncludeManifest: boolean;
  catalogIncludePreview: boolean;
  lastPackageOutputDir: string | null;
  lastPackagingMode: 'single' | 'catalog' | null;
}

const STORAGE_KEY = 'glyphstudio_packaging_settings';

const DEFAULTS: PersistedPackagingSettings = {
  bundleFormat: 'folder',
  bundleIncludePreview: false,
  catalogBundleFormat: 'folder',
  catalogIncludeManifest: true,
  catalogIncludePreview: false,
  lastPackageOutputDir: null,
  lastPackagingMode: null,
};

function loadPackagingSettings(): PersistedPackagingSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw);
    return {
      bundleFormat: parsed.bundleFormat === 'zip' ? 'zip' : 'folder',
      bundleIncludePreview: typeof parsed.bundleIncludePreview === 'boolean' ? parsed.bundleIncludePreview : DEFAULTS.bundleIncludePreview,
      catalogBundleFormat: parsed.catalogBundleFormat === 'zip' ? 'zip' : 'folder',
      catalogIncludeManifest: typeof parsed.catalogIncludeManifest === 'boolean' ? parsed.catalogIncludeManifest : DEFAULTS.catalogIncludeManifest,
      catalogIncludePreview: typeof parsed.catalogIncludePreview === 'boolean' ? parsed.catalogIncludePreview : DEFAULTS.catalogIncludePreview,
      lastPackageOutputDir: typeof parsed.lastPackageOutputDir === 'string' ? parsed.lastPackageOutputDir : DEFAULTS.lastPackageOutputDir,
      lastPackagingMode: parsed.lastPackagingMode === 'single' || parsed.lastPackagingMode === 'catalog' ? parsed.lastPackagingMode : DEFAULTS.lastPackagingMode,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

function savePackagingSettings(settings: Partial<PersistedPackagingSettings>): void {
  try {
    const current = loadPackagingSettings();
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
describe('packagingSettings persistence', () => {
  beforeEach(() => store.clear());

  // ── defaults ────────────────────────────────────────────────
  it('returns defaults when localStorage is empty', () => {
    expect(loadPackagingSettings()).toEqual(DEFAULTS);
  });

  it('returns defaults when stored JSON is corrupt', () => {
    store.set(STORAGE_KEY, '<<<garbage>>>');
    expect(loadPackagingSettings()).toEqual(DEFAULTS);
  });

  it('returns all defaults when stored object is empty', () => {
    store.set(STORAGE_KEY, '{}');
    expect(loadPackagingSettings()).toEqual(DEFAULTS);
  });

  // ── bundleFormat strict coercion ───────────────────────────
  it('accepts zip for bundleFormat', () => {
    store.set(STORAGE_KEY, JSON.stringify({ bundleFormat: 'zip' }));
    expect(loadPackagingSettings().bundleFormat).toBe('zip');
  });

  it('falls back to folder for unknown bundleFormat', () => {
    store.set(STORAGE_KEY, JSON.stringify({ bundleFormat: 'tar.gz' }));
    expect(loadPackagingSettings().bundleFormat).toBe('folder');
  });

  it('falls back to folder when bundleFormat is a number', () => {
    store.set(STORAGE_KEY, JSON.stringify({ bundleFormat: 42 }));
    expect(loadPackagingSettings().bundleFormat).toBe('folder');
  });

  // ── catalogBundleFormat strict coercion ────────────────────
  it('accepts zip for catalogBundleFormat', () => {
    store.set(STORAGE_KEY, JSON.stringify({ catalogBundleFormat: 'zip' }));
    expect(loadPackagingSettings().catalogBundleFormat).toBe('zip');
  });

  it('falls back to folder for unknown catalogBundleFormat', () => {
    store.set(STORAGE_KEY, JSON.stringify({ catalogBundleFormat: 'rar' }));
    expect(loadPackagingSettings().catalogBundleFormat).toBe('folder');
  });

  // ── boolean coercion ──────────────────────────────────────
  it('falls back to default when bundleIncludePreview is not boolean', () => {
    store.set(STORAGE_KEY, JSON.stringify({ bundleIncludePreview: 'yes' }));
    expect(loadPackagingSettings().bundleIncludePreview).toBe(false);
  });

  it('falls back to default when catalogIncludeManifest is not boolean', () => {
    store.set(STORAGE_KEY, JSON.stringify({ catalogIncludeManifest: 1 }));
    expect(loadPackagingSettings().catalogIncludeManifest).toBe(true);
  });

  it('accepts false for catalogIncludeManifest', () => {
    store.set(STORAGE_KEY, JSON.stringify({ catalogIncludeManifest: false }));
    expect(loadPackagingSettings().catalogIncludeManifest).toBe(false);
  });

  // ── lastPackagingMode strict enum ─────────────────────────
  it('accepts single for lastPackagingMode', () => {
    store.set(STORAGE_KEY, JSON.stringify({ lastPackagingMode: 'single' }));
    expect(loadPackagingSettings().lastPackagingMode).toBe('single');
  });

  it('accepts catalog for lastPackagingMode', () => {
    store.set(STORAGE_KEY, JSON.stringify({ lastPackagingMode: 'catalog' }));
    expect(loadPackagingSettings().lastPackagingMode).toBe('catalog');
  });

  it('falls back to null for unknown lastPackagingMode', () => {
    store.set(STORAGE_KEY, JSON.stringify({ lastPackagingMode: 'batch' }));
    expect(loadPackagingSettings().lastPackagingMode).toBeNull();
  });

  // ── lastPackageOutputDir string check ─────────────────────
  it('falls back to null when lastPackageOutputDir is a number', () => {
    store.set(STORAGE_KEY, JSON.stringify({ lastPackageOutputDir: 123 }));
    expect(loadPackagingSettings().lastPackageOutputDir).toBeNull();
  });

  it('accepts string for lastPackageOutputDir', () => {
    store.set(STORAGE_KEY, JSON.stringify({ lastPackageOutputDir: '/tmp/pkg' }));
    expect(loadPackagingSettings().lastPackageOutputDir).toBe('/tmp/pkg');
  });

  // ── round-trip ─────────────────────────────────────────────
  it('save then load round-trips full settings', () => {
    const custom: PersistedPackagingSettings = {
      bundleFormat: 'zip',
      bundleIncludePreview: true,
      catalogBundleFormat: 'zip',
      catalogIncludeManifest: false,
      catalogIncludePreview: true,
      lastPackageOutputDir: '/out/bundles',
      lastPackagingMode: 'catalog',
    };
    savePackagingSettings(custom);
    expect(loadPackagingSettings()).toEqual(custom);
  });

  it('partial save merges with existing values', () => {
    savePackagingSettings({ bundleFormat: 'zip', lastPackagingMode: 'single' });
    savePackagingSettings({ catalogBundleFormat: 'zip' });
    const result = loadPackagingSettings();
    expect(result.bundleFormat).toBe('zip');
    expect(result.lastPackagingMode).toBe('single');
    expect(result.catalogBundleFormat).toBe('zip');
    // untouched fields stay at defaults
    expect(result.bundleIncludePreview).toBe(false);
  });

  it('partial save does not lose existing non-default values', () => {
    savePackagingSettings({ lastPackageOutputDir: '/home/pkg', bundleIncludePreview: true });
    savePackagingSettings({ catalogIncludePreview: true });
    const result = loadPackagingSettings();
    expect(result.lastPackageOutputDir).toBe('/home/pkg');
    expect(result.bundleIncludePreview).toBe(true);
    expect(result.catalogIncludePreview).toBe(true);
  });

  // ── extra keys ─────────────────────────────────────────────
  it('ignores unknown keys in stored JSON', () => {
    store.set(STORAGE_KEY, JSON.stringify({ bundleFormat: 'zip', mystery: 'value' }));
    const result = loadPackagingSettings();
    expect(result.bundleFormat).toBe('zip');
    expect((result as Record<string, unknown>)['mystery']).toBeUndefined();
  });
});
