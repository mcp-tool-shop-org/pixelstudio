import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { VariantBar } from './VariantBar';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
}

function openTestDoc() {
  useSpriteEditorStore.getState().newDocument('test', 16, 16);
}

describe('VariantBar', () => {
  beforeEach(() => resetStore());

  it('renders nothing when no document', () => {
    const { container } = render(<VariantBar />);
    expect(container.innerHTML).toBe('');
  });

  it('shows create button when no variants exist', () => {
    openTestDoc();
    render(<VariantBar />);
    expect(screen.getByTestId('variant-create')).toBeTruthy();
  });

  it('creates a variant and switches to it', () => {
    openTestDoc();
    render(<VariantBar />);
    fireEvent.click(screen.getByTestId('variant-create'));

    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.variants).toHaveLength(1);
    expect(doc.activeVariantId).toBe(doc.variants![0].id);
  });

  it('shows Base tab + variant tabs when variants exist', () => {
    openTestDoc();
    useSpriteEditorStore.getState().createVariant('Walk Left');
    render(<VariantBar />);

    expect(screen.getByTestId('variant-tab-base')).toBeTruthy();
    const doc = useSpriteEditorStore.getState().document!;
    expect(screen.getByTestId(`variant-tab-${doc.variants![0].id}`)).toBeTruthy();
  });

  it('clicking Base tab switches to base', () => {
    openTestDoc();
    const id = useSpriteEditorStore.getState().createVariant('Left')!;
    useSpriteEditorStore.getState().switchToVariant(id);
    render(<VariantBar />);

    fireEvent.click(screen.getByTestId('variant-tab-base'));
    expect(useSpriteEditorStore.getState().document!.activeVariantId).toBeNull();
  });

  it('clicking a variant tab switches to it', () => {
    openTestDoc();
    const id = useSpriteEditorStore.getState().createVariant('Right')!;
    render(<VariantBar />);

    fireEvent.click(screen.getByTestId(`variant-tab-${id}`));
    expect(useSpriteEditorStore.getState().document!.activeVariantId).toBe(id);
  });

  it('deletes a variant via tab button', () => {
    openTestDoc();
    const id = useSpriteEditorStore.getState().createVariant('Delete')!;
    render(<VariantBar />);

    fireEvent.click(screen.getByTestId(`variant-tab-${id}-del`));
    expect(useSpriteEditorStore.getState().document!.variants).toHaveLength(0);
  });

  it('duplicates a variant via tab button', () => {
    openTestDoc();
    const id = useSpriteEditorStore.getState().createVariant('Original')!;
    render(<VariantBar />);

    fireEvent.click(screen.getByTestId(`variant-tab-${id}-dup`));
    expect(useSpriteEditorStore.getState().document!.variants).toHaveLength(2);
  });

  it('shows + add button when variants exist', () => {
    openTestDoc();
    useSpriteEditorStore.getState().createVariant('First');
    render(<VariantBar />);
    expect(screen.getByTestId('variant-add')).toBeTruthy();
  });
});
