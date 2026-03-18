import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { PaletteSetsPanel } from './PaletteSetsPanel';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
}

function openTestDoc() {
  useSpriteEditorStore.getState().newDocument('test', 16, 16);
}

describe('PaletteSetsPanel', () => {
  beforeEach(() => resetStore());

  it('shows empty state when no document', () => {
    render(<PaletteSetsPanel />);
    expect(screen.getByText('No document open')).toBeTruthy();
  });

  it('shows empty state when no palette sets exist', () => {
    openTestDoc();
    render(<PaletteSetsPanel />);
    expect(screen.getByText(/No palette sets yet/)).toBeTruthy();
  });

  it('shows save button', () => {
    openTestDoc();
    render(<PaletteSetsPanel />);
    expect(screen.getByTestId('palette-sets-save')).toBeTruthy();
  });

  it('creates a palette set when save is clicked', () => {
    openTestDoc();
    render(<PaletteSetsPanel />);
    fireEvent.click(screen.getByTestId('palette-sets-save'));
    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.paletteSets).toHaveLength(1);
    expect(doc.paletteSets![0].name).toBe('Variant 1');
  });

  it('renders palette set rows', () => {
    openTestDoc();
    useSpriteEditorStore.getState().createPaletteSet('Warm');
    useSpriteEditorStore.getState().createPaletteSet('Cool');
    render(<PaletteSetsPanel />);

    const doc = useSpriteEditorStore.getState().document!;
    expect(screen.getByTestId(`palette-set-${doc.paletteSets![0].id}`)).toBeTruthy();
    expect(screen.getByTestId(`palette-set-${doc.paletteSets![1].id}`)).toBeTruthy();
  });

  it('shows commit bar when a palette set is clicked for preview', () => {
    openTestDoc();
    const psId = useSpriteEditorStore.getState().createPaletteSet('Preview')!;
    render(<PaletteSetsPanel />);

    fireEvent.click(screen.getByTestId(`palette-set-${psId}`));
    expect(useSpriteEditorStore.getState().previewPaletteSetId).toBe(psId);
  });

  it('deletes a palette set', () => {
    openTestDoc();
    const psId = useSpriteEditorStore.getState().createPaletteSet('ToDelete')!;
    render(<PaletteSetsPanel />);

    fireEvent.click(screen.getByTestId(`palette-set-del-${psId}`));
    expect(useSpriteEditorStore.getState().document!.paletteSets).toHaveLength(0);
  });

  it('duplicates a palette set', () => {
    openTestDoc();
    const psId = useSpriteEditorStore.getState().createPaletteSet('Original')!;
    render(<PaletteSetsPanel />);

    fireEvent.click(screen.getByTestId(`palette-set-dup-${psId}`));
    expect(useSpriteEditorStore.getState().document!.paletteSets).toHaveLength(2);
    expect(useSpriteEditorStore.getState().document!.paletteSets![1].name).toBe('Original (Copy)');
  });
});
