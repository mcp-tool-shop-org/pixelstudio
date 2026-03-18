import { describe, it, expect } from 'vitest';
import type { SavedTemplate } from './templateLibrary';
import {
  TEMPLATE_LIBRARY_VERSION,
  createEmptyTemplateLibrary,
  addTemplateToLibrary,
  deleteTemplateFromLibrary,
  renameTemplateInLibrary,
  findTemplateById,
  getTemplateCount,
  generateTemplateId,
} from './templateLibrary';

function makeTemplate(overrides: Partial<SavedTemplate> = {}): SavedTemplate {
  return {
    id: generateTemplateId(),
    name: 'Test Template',
    canvasWidth: 32,
    canvasHeight: 32,
    interchangeJson: '{}',
    createdAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('templateLibrary', () => {
  it('createEmptyTemplateLibrary returns correct structure', () => {
    const lib = createEmptyTemplateLibrary();
    expect(lib.schemaVersion).toBe(TEMPLATE_LIBRARY_VERSION);
    expect(lib.templates).toEqual([]);
  });

  it('addTemplateToLibrary prepends', () => {
    let lib = createEmptyTemplateLibrary();
    lib = addTemplateToLibrary(lib, makeTemplate({ name: 'Old' }));
    lib = addTemplateToLibrary(lib, makeTemplate({ name: 'New' }));
    expect(lib.templates[0].name).toBe('New');
    expect(lib.templates[1].name).toBe('Old');
  });

  it('deleteTemplateFromLibrary removes by ID', () => {
    let lib = addTemplateToLibrary(createEmptyTemplateLibrary(), makeTemplate({ id: 'del' }));
    lib = deleteTemplateFromLibrary(lib, 'del');
    expect(lib.templates).toHaveLength(0);
  });

  it('deleteTemplateFromLibrary no-ops on unknown ID', () => {
    const lib = addTemplateToLibrary(createEmptyTemplateLibrary(), makeTemplate());
    expect(deleteTemplateFromLibrary(lib, 'bogus')).toBe(lib);
  });

  it('renameTemplateInLibrary updates name', () => {
    let lib = addTemplateToLibrary(createEmptyTemplateLibrary(), makeTemplate({ id: 'r1', name: 'Old' }));
    lib = renameTemplateInLibrary(lib, 'r1', 'New');
    expect(lib.templates[0].name).toBe('New');
  });

  it('findTemplateById returns template', () => {
    const lib = addTemplateToLibrary(createEmptyTemplateLibrary(), makeTemplate({ id: 'f1', name: 'Found' }));
    expect(findTemplateById(lib, 'f1')?.name).toBe('Found');
  });

  it('findTemplateById returns undefined for missing', () => {
    expect(findTemplateById(createEmptyTemplateLibrary(), 'nope')).toBeUndefined();
  });

  it('getTemplateCount returns length', () => {
    let lib = createEmptyTemplateLibrary();
    expect(getTemplateCount(lib)).toBe(0);
    lib = addTemplateToLibrary(lib, makeTemplate());
    expect(getTemplateCount(lib)).toBe(1);
  });
});
