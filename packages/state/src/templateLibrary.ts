/**
 * Template library — pure CRUD for saved project templates.
 *
 * Follows the characterBuildLibrary/partLibrary pattern.
 * Templates store their interchange JSON as a string blob.
 */

/** Schema version for template library persistence. */
export const TEMPLATE_LIBRARY_VERSION = 1;

/** A saved project template. */
export interface SavedTemplate {
  id: string;
  name: string;
  description?: string;
  canvasWidth: number;
  canvasHeight: number;
  /** The full interchange JSON string. */
  interchangeJson: string;
  createdAt: string;
}

/** The persisted template library. */
export interface TemplateLibrary {
  schemaVersion: number;
  templates: SavedTemplate[];
}

/** Generate a unique template ID. */
export function generateTemplateId(): string {
  return `tmpl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Create an empty template library. */
export function createEmptyTemplateLibrary(): TemplateLibrary {
  return { schemaVersion: TEMPLATE_LIBRARY_VERSION, templates: [] };
}

/** Add a template (prepend — most recent first). */
export function addTemplateToLibrary(library: TemplateLibrary, template: SavedTemplate): TemplateLibrary {
  return { ...library, templates: [template, ...library.templates] };
}

/** Delete a template by ID. */
export function deleteTemplateFromLibrary(library: TemplateLibrary, templateId: string): TemplateLibrary {
  const templates = library.templates.filter((t) => t.id !== templateId);
  if (templates.length === library.templates.length) return library;
  return { ...library, templates };
}

/** Rename a template. */
export function renameTemplateInLibrary(library: TemplateLibrary, templateId: string, newName: string): TemplateLibrary {
  const index = library.templates.findIndex((t) => t.id === templateId);
  if (index < 0) return library;
  const templates = [...library.templates];
  templates[index] = { ...templates[index], name: newName };
  return { ...library, templates };
}

/** Find a template by ID. */
export function findTemplateById(library: TemplateLibrary, templateId: string): SavedTemplate | undefined {
  return library.templates.find((t) => t.id === templateId);
}

/** Get template count. */
export function getTemplateCount(library: TemplateLibrary): number {
  return library.templates.length;
}
