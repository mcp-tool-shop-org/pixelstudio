/**
 * Seed sample content on first launch.
 *
 * Adds canonical templates and packs to their respective libraries
 * if they haven't been added before. Idempotent — safe to call
 * on every app start.
 */

import {
  SAMPLE_TEMPLATES,
  SAMPLE_PACKS,
  addTemplateToLibrary,
  addPackToLibrary,
} from '@glyphstudio/state';
import { loadTemplateLibrary, saveTemplateLibrary } from './templateLibraryStorage';
import { loadPackLibrary, savePackLibrary } from './packLibraryStorage';

const SEED_KEY = 'glyphstudio_samples_seeded';

/** Seed sample templates and packs if not already seeded. */
export function seedSampleContentIfNeeded(): void {
  try {
    if (typeof localStorage === 'undefined') return;
    if (localStorage.getItem(SEED_KEY)) return;

    // Seed templates
    let tmplLib = loadTemplateLibrary();
    const existingTmplIds = new Set(tmplLib.templates.map((t) => t.id));
    for (const tmpl of SAMPLE_TEMPLATES) {
      if (!existingTmplIds.has(tmpl.id)) {
        tmplLib = addTemplateToLibrary(tmplLib, tmpl);
      }
    }
    saveTemplateLibrary(tmplLib);

    // Seed packs
    let packLib = loadPackLibrary();
    const existingPackIds = new Set(packLib.packs.map((p) => p.id));
    for (const pack of SAMPLE_PACKS) {
      if (!existingPackIds.has(pack.id)) {
        packLib = addPackToLibrary(packLib, pack);
      }
    }
    savePackLibrary(packLib);

    localStorage.setItem(SEED_KEY, '1');
  } catch {
    // Silently skip if localStorage unavailable
  }
}
