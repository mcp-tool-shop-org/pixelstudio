import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { LibraryPanel } from './LibraryPanel';
import { savePartLibrary } from '../lib/partLibraryStorage';
import type { Part } from '@glyphstudio/domain';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
  localStorage.removeItem('glyphstudio_part_library');
}

function openTestDoc() {
  useSpriteEditorStore.getState().newDocument('test', 16, 16);
}

function makePart(overrides: Partial<Part> = {}): Part {
  return {
    id: `part_${Math.random().toString(36).slice(2, 6)}`,
    name: 'Test Part',
    width: 4,
    height: 4,
    pixelData: new Array(64).fill(0),
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

describe('LibraryPanel', () => {
  beforeEach(() => resetStore());

  it('shows empty state when no document', () => {
    render(<LibraryPanel />);
    expect(screen.getByText('No document open')).toBeTruthy();
  });

  it('shows empty state when no authored assets', () => {
    openTestDoc();
    render(<LibraryPanel />);
    expect(screen.getByText('No authored assets yet.')).toBeTruthy();
  });

  it('shows parts section when parts exist', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'p1', name: 'Helmet' })] });
    render(<LibraryPanel />);
    expect(screen.getByTestId('lib-section-parts')).toBeTruthy();
    expect(screen.getByTestId('lib-item-p1')).toBeTruthy();
  });

  it('shows palette sets section', () => {
    openTestDoc();
    useSpriteEditorStore.getState().createPaletteSet('Warm');
    render(<LibraryPanel />);
    expect(screen.getByTestId('lib-section-palette-sets')).toBeTruthy();
  });

  it('shows variants section', () => {
    openTestDoc();
    useSpriteEditorStore.getState().createVariant('Walk Left');
    render(<LibraryPanel />);
    expect(screen.getByTestId('lib-section-variants')).toBeTruthy();
  });

  it('clicking a part activates stamp mode', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'stamp-p', name: 'Stamp' })] });
    render(<LibraryPanel />);
    fireEvent.click(screen.getByTestId('lib-item-stamp-p'));
    expect(useSpriteEditorStore.getState().activeStampPartId).toBe('stamp-p');
  });

  it('clicking a variant switches to it', () => {
    openTestDoc();
    const id = useSpriteEditorStore.getState().createVariant('Left')!;
    render(<LibraryPanel />);
    fireEvent.click(screen.getByTestId(`lib-item-${id}`));
    expect(useSpriteEditorStore.getState().document!.activeVariantId).toBe(id);
  });

  it('search filters items by name', () => {
    openTestDoc();
    savePartLibrary({
      schemaVersion: 1,
      parts: [
        makePart({ id: 'p-helm', name: 'Helmet' }),
        makePart({ id: 'p-sword', name: 'Sword' }),
      ],
    });
    render(<LibraryPanel />);

    const searchInput = screen.getByTestId('lib-search');
    fireEvent.change(searchInput, { target: { value: 'helm' } });

    expect(screen.getByTestId('lib-item-p-helm')).toBeTruthy();
    expect(screen.queryByTestId('lib-item-p-sword')).toBeNull();
  });

  it('type filter toggles work', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'p1', name: 'Head' })] });
    useSpriteEditorStore.getState().createPaletteSet('Warm');
    render(<LibraryPanel />);

    // Both sections visible initially
    expect(screen.getByTestId('lib-section-parts')).toBeTruthy();
    expect(screen.getByTestId('lib-section-palette-sets')).toBeTruthy();

    // Toggle off parts
    fireEvent.click(screen.getByTestId('lib-filter-part'));
    expect(screen.queryByTestId('lib-section-parts')).toBeNull();
    expect(screen.getByTestId('lib-section-palette-sets')).toBeTruthy();
  });

  it('shows search input', () => {
    openTestDoc();
    render(<LibraryPanel />);
    expect(screen.getByTestId('lib-search')).toBeTruthy();
  });
});
