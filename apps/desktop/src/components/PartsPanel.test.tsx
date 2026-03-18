import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpriteEditorStore, createEmptyPartLibrary } from '@glyphstudio/state';
import { PartsPanel } from './PartsPanel';
import { savePartLibrary } from '../lib/partLibraryStorage';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
  // Clear part library from localStorage
  localStorage.removeItem('glyphstudio_part_library');
}

function openTestDoc() {
  useSpriteEditorStore.getState().newDocument('test', 16, 16);
}

describe('PartsPanel', () => {
  beforeEach(() => resetStore());

  it('shows empty state when no document', () => {
    render(<PartsPanel />);
    expect(screen.getByText('No document open')).toBeTruthy();
  });

  it('shows empty state when no parts exist', () => {
    openTestDoc();
    render(<PartsPanel />);
    expect(screen.getByText(/No parts yet/)).toBeTruthy();
  });

  it('shows save button', () => {
    openTestDoc();
    render(<PartsPanel />);
    expect(screen.getByTestId('parts-save-selection')).toBeTruthy();
  });

  it('save button is disabled when no selection', () => {
    openTestDoc();
    render(<PartsPanel />);
    const btn = screen.getByTestId('parts-save-selection') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('renders parts from library', () => {
    openTestDoc();
    // Pre-populate library
    const lib = createEmptyPartLibrary();
    const part = {
      id: 'test-part',
      name: 'Helmet',
      width: 4,
      height: 4,
      pixelData: new Array(64).fill(0),
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    savePartLibrary({ ...lib, parts: [part] });

    render(<PartsPanel />);
    expect(screen.getByTestId('parts-item-test-part')).toBeTruthy();
    expect(screen.getByTestId('parts-name-test-part')).toBeTruthy();
  });

  it('clicking a part activates stamp mode', () => {
    openTestDoc();
    const part = {
      id: 'stamp-part',
      name: 'Stamp Me',
      width: 2,
      height: 2,
      pixelData: [255, 0, 0, 255, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    savePartLibrary({ schemaVersion: 1, parts: [part] });

    render(<PartsPanel />);
    fireEvent.click(screen.getByTestId('parts-item-stamp-part'));
    expect(useSpriteEditorStore.getState().activeStampPartId).toBe('stamp-part');
  });

  it('deletes a part', () => {
    openTestDoc();
    const part = {
      id: 'del-part',
      name: 'Delete Me',
      width: 1,
      height: 1,
      pixelData: [0, 0, 0, 0],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    savePartLibrary({ schemaVersion: 1, parts: [part] });

    render(<PartsPanel />);
    fireEvent.click(screen.getByTestId('parts-del-del-part'));
    // Part should be removed from DOM
    expect(screen.queryByTestId('parts-item-del-part')).toBeNull();
  });

  it('duplicates a part', () => {
    openTestDoc();
    const part = {
      id: 'dup-part',
      name: 'Original',
      width: 1,
      height: 1,
      pixelData: [255, 0, 0, 255],
      createdAt: '2026-01-01T00:00:00Z',
      updatedAt: '2026-01-01T00:00:00Z',
    };
    savePartLibrary({ schemaVersion: 1, parts: [part] });

    render(<PartsPanel />);
    fireEvent.click(screen.getByTestId('parts-dup-dup-part'));
    // Should now have two parts
    expect(screen.getByText('Original')).toBeTruthy();
    expect(screen.getByText('Original Copy')).toBeTruthy();
  });
});
