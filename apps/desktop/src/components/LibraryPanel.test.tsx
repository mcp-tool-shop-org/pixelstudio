import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpriteEditorStore, useLibraryStore } from '@glyphstudio/state';
import { LibraryPanel } from './LibraryPanel';
import { savePartLibrary } from '../lib/partLibraryStorage';
import type { Part } from '@glyphstudio/domain';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
  useLibraryStore.setState({ recentIds: [], pinnedIds: [], viewMode: 'all' });
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

  it('clicking a part activates stamp mode and tracks recent', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'stamp-p', name: 'Stamp' })] });
    render(<LibraryPanel />);
    fireEvent.click(screen.getByTestId('lib-item-stamp-p'));
    expect(useSpriteEditorStore.getState().activeStampPartId).toBe('stamp-p');
    expect(useLibraryStore.getState().recentIds).toContain('stamp-p');
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
    fireEvent.change(screen.getByTestId('lib-search'), { target: { value: 'helm' } });
    expect(screen.getByTestId('lib-item-p-helm')).toBeTruthy();
    expect(screen.queryByTestId('lib-item-p-sword')).toBeNull();
  });

  it('type filter toggles work', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'p1', name: 'Head' })] });
    useSpriteEditorStore.getState().createPaletteSet('Warm');
    render(<LibraryPanel />);

    fireEvent.click(screen.getByTestId('lib-filter-part'));
    expect(screen.queryByTestId('lib-section-parts')).toBeNull();
    expect(screen.getByTestId('lib-section-palette-sets')).toBeTruthy();
  });

  it('pin button toggles pin state', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'pin-me', name: 'Pin' })] });
    render(<LibraryPanel />);
    fireEvent.click(screen.getByTestId('lib-pin-pin-me'));
    expect(useLibraryStore.getState().pinnedIds).toContain('pin-me');
  });

  it('view mode tabs switch between All/Recent/Pinned', () => {
    openTestDoc();
    render(<LibraryPanel />);
    expect(screen.getByTestId('lib-view-all')).toBeTruthy();
    expect(screen.getByTestId('lib-view-recent')).toBeTruthy();
    expect(screen.getByTestId('lib-view-pinned')).toBeTruthy();
  });

  it('Recent view shows recently accessed items', () => {
    openTestDoc();
    savePartLibrary({ schemaVersion: 1, parts: [makePart({ id: 'r1', name: 'Recent' })] });
    useLibraryStore.getState().pushRecent('r1');
    render(<LibraryPanel />);

    fireEvent.click(screen.getByTestId('lib-view-recent'));
    expect(screen.getByTestId('lib-item-r1')).toBeTruthy();
  });

  it('Pinned view shows only pinned items', () => {
    openTestDoc();
    savePartLibrary({
      schemaVersion: 1,
      parts: [
        makePart({ id: 'pinned-1', name: 'Pinned' }),
        makePart({ id: 'not-pinned', name: 'NotPinned' }),
      ],
    });
    useLibraryStore.getState().togglePin('pinned-1');
    render(<LibraryPanel />);

    fireEvent.click(screen.getByTestId('lib-view-pinned'));
    expect(screen.getByTestId('lib-item-pinned-1')).toBeTruthy();
    expect(screen.queryByTestId('lib-item-not-pinned')).toBeNull();
  });

  it('shows search input', () => {
    openTestDoc();
    render(<LibraryPanel />);
    expect(screen.getByTestId('lib-search')).toBeTruthy();
  });
});
