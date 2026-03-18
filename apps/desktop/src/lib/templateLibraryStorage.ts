import type { SavedTemplate, TemplateLibrary } from '@glyphstudio/state';
import { TEMPLATE_LIBRARY_VERSION, createEmptyTemplateLibrary } from '@glyphstudio/state';

const STORAGE_KEY = 'glyphstudio_template_library';

function coerceTemplate(raw: unknown): SavedTemplate | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  if (typeof r.name !== 'string' || !r.name) return null;
  if (typeof r.canvasWidth !== 'number' || r.canvasWidth <= 0) return null;
  if (typeof r.canvasHeight !== 'number' || r.canvasHeight <= 0) return null;
  if (typeof r.interchangeJson !== 'string') return null;
  if (typeof r.createdAt !== 'string') return null;

  const tmpl: SavedTemplate = {
    id: r.id,
    name: r.name,
    canvasWidth: r.canvasWidth,
    canvasHeight: r.canvasHeight,
    interchangeJson: r.interchangeJson,
    createdAt: r.createdAt,
  };
  if (typeof r.description === 'string') tmpl.description = r.description;
  return tmpl;
}

export function loadTemplateLibrary(): TemplateLibrary {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createEmptyTemplateLibrary();
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return createEmptyTemplateLibrary();
    if (typeof parsed.schemaVersion !== 'number' || parsed.schemaVersion !== TEMPLATE_LIBRARY_VERSION) {
      return createEmptyTemplateLibrary();
    }
    if (!Array.isArray(parsed.templates)) return createEmptyTemplateLibrary();

    const templates: SavedTemplate[] = [];
    for (const entry of parsed.templates) {
      const tmpl = coerceTemplate(entry);
      if (tmpl) templates.push(tmpl);
    }
    return { schemaVersion: TEMPLATE_LIBRARY_VERSION, templates };
  } catch {
    return createEmptyTemplateLibrary();
  }
}

export function saveTemplateLibrary(library: TemplateLibrary): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(library));
  } catch {
    /* silently skip */
  }
}
