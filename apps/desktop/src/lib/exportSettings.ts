import type { ManifestFormat } from '@pixelstudio/domain';

const STORAGE_KEY = 'pixelstudio_export_settings';

export interface PersistedExportSettings {
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

export function loadExportSettings(): PersistedExportSettings {
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

export function saveExportSettings(settings: Partial<PersistedExportSettings>): void {
  try {
    const current = loadExportSettings();
    const merged = { ...current, ...settings };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged));
  } catch {
    /* localStorage unavailable — silently skip */
  }
}
