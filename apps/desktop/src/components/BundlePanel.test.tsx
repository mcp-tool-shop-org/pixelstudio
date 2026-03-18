import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { BundlePanel } from './BundlePanel';

function resetStore() {
  useSpriteEditorStore.getState().closeDocument();
}

function openTestDoc() {
  useSpriteEditorStore.getState().newDocument('hero', 16, 16);
}

describe('BundlePanel', () => {
  beforeEach(() => resetStore());

  it('shows empty state when no document', () => {
    render(<BundlePanel />);
    expect(screen.getByText('No document open')).toBeTruthy();
  });

  it('shows base checkbox when document is open', () => {
    openTestDoc();
    render(<BundlePanel />);
    expect(screen.getByTestId('bundle-doc-base')).toBeTruthy();
  });

  it('shows variant checkboxes when variants exist', () => {
    openTestDoc();
    const id = useSpriteEditorStore.getState().createVariant('Walk Left')!;
    render(<BundlePanel />);
    expect(screen.getByTestId(`bundle-doc-${id}`)).toBeTruthy();
  });

  it('shows palette checkboxes when palette sets exist', () => {
    openTestDoc();
    const psId = useSpriteEditorStore.getState().createPaletteSet('Warm')!;
    render(<BundlePanel />);
    expect(screen.getByTestId(`bundle-pal-${psId}`)).toBeTruthy();
  });

  it('shows plan with file count when base is selected', () => {
    openTestDoc();
    render(<BundlePanel />);
    // Base is selected by default
    expect(screen.getByTestId('bundle-plan-count')).toBeTruthy();
    expect(screen.getByTestId('bundle-plan-count').textContent).toContain('1 file');
  });

  it('plan updates when selecting additional variants', () => {
    openTestDoc();
    useSpriteEditorStore.getState().createVariant('Left');
    const { rerender } = render(<BundlePanel />);

    const doc = useSpriteEditorStore.getState().document!;
    const varCheckbox = screen.getByTestId(`bundle-doc-${doc.variants![0].id}`);
    fireEvent.click(varCheckbox.querySelector('input')!);

    // Re-render to pick up state change
    rerender(<BundlePanel />);
    expect(screen.getByTestId('bundle-plan-count').textContent).toContain('2 file');
  });

  it('export button shows file count', () => {
    openTestDoc();
    render(<BundlePanel />);
    expect(screen.getByTestId('bundle-export').textContent).toContain('Export 1 File');
  });

  it('export button disabled when no variants selected', () => {
    openTestDoc();
    render(<BundlePanel />);

    // Uncheck base
    const baseCheckbox = screen.getByTestId('bundle-doc-base');
    fireEvent.click(baseCheckbox.querySelector('input')!);

    const btn = screen.getByTestId('bundle-export') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
  });

  it('shows format radio buttons', () => {
    openTestDoc();
    render(<BundlePanel />);
    expect(screen.getByText('Sheet')).toBeTruthy();
    expect(screen.getByText('GIF')).toBeTruthy();
  });
});
