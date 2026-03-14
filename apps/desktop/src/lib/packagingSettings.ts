import type { ExportBundleFormat } from '@pixelstudio/domain';

const STORAGE_KEY = 'pixelstudio_packaging_settings';

export interface PersistedPackagingSettings {
  /** Single-asset bundle format */
  bundleFormat: ExportBundleFormat;
  /** Include preview thumbnail in single-asset bundles */
  bundleIncludePreview: boolean;
  /** Catalog bundle format */
  catalogBundleFormat: ExportBundleFormat;
  /** Include manifest in catalog bundles */
  catalogIncludeManifest: boolean;
  /** Include preview in catalog bundles */
  catalogIncludePreview: boolean;
  /** Last output directory used for any packaging operation */
  lastPackageOutputDir: string | null;
  /** Last packaging mode used */
  lastPackagingMode: 'single' | 'catalog' | null;
}

const DEFAULTS: PersistedPackagingSettings = {
  bundleFormat: 'folder',
  bundleIncludePreview: false,
  catalogBundleFormat: 'folder',
  catalogIncludeManifest: true,
  catalogIncludePreview: false,
  lastPackageOutputDir: null,
  lastPackagingMode: null,
};

export function loadPackagingSettings(): PersistedPackagingSettings {
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

export function savePackagingSettings(settings: Partial<PersistedPackagingSettings>): void {
  try {
    const current = loadPackagingSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}
