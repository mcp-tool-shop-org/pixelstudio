import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSpriteEditorStore } from '@glyphstudio/state';
import { createSpriteDocument } from '@glyphstudio/domain';
import { PalettePropsPanel } from './PalettePropsPanel';

function seedDoc() {
  const doc = createSpriteDocument('Test', 32, 32);
  useSpriteEditorStore.setState({ document: doc });
  return doc;
}

describe('PalettePropsPanel', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useSpriteEditorStore.setState({ document: null });
  });

  it('shows empty state when no document', () => {
    render(<PalettePropsPanel />);
    expect(screen.getByText('No document loaded')).toBeInTheDocument();
  });

  it('renders palette summary', () => {
    seedDoc();
    render(<PalettePropsPanel />);
    expect(screen.getByTestId('palette-summary')).toBeInTheDocument();
    expect(screen.getByText('10 colors')).toBeInTheDocument();
  });

  it('renders all slot rows', () => {
    seedDoc();
    render(<PalettePropsPanel />);
    const list = screen.getByTestId('palette-slot-list');
    expect(list.children.length).toBe(10);
  });

  it('shows slot detail when slot is clicked', async () => {
    seedDoc();
    render(<PalettePropsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-slot-1'));
    });
    expect(screen.getByTestId('palette-slot-detail')).toBeInTheDocument();
    // "Black" appears in both slot row and detail pane
    expect(screen.getAllByText('Black').length).toBeGreaterThanOrEqual(2);
  });

  it('lock button toggles lock state', async () => {
    seedDoc();
    render(<PalettePropsPanel />);
    const lockBtn = screen.getByTestId('palette-slot-lock-1');
    await act(async () => {
      await userEvent.click(lockBtn);
    });
    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.palette.colors[1].locked).toBe(true);
  });

  it('add color button adds a color', async () => {
    seedDoc();
    render(<PalettePropsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-add-color'));
    });
    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.palette.colors.length).toBe(11);
    expect(doc.palette.colors[10].name).toBe('New Color');
  });

  it('add group button creates a group', async () => {
    seedDoc();
    render(<PalettePropsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-add-group'));
    });
    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.palette.groups?.length).toBe(1);
    expect(doc.palette.groups![0].name).toBe('New Group');
  });

  it('semantic role input updates color role', async () => {
    seedDoc();
    render(<PalettePropsPanel />);
    // Select slot 1
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-slot-1'));
    });
    const roleInput = screen.getByTestId('palette-detail-role-input');
    await act(async () => {
      await userEvent.clear(roleInput);
      await userEvent.type(roleInput, 'outline');
    });
    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.palette.colors[1].semanticRole).toBe('outline');
  });

  it('remove button removes unlocked color', async () => {
    seedDoc();
    render(<PalettePropsPanel />);
    // Select slot 1 (Black, unlocked)
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-slot-1'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-detail-remove'));
    });
    const doc = useSpriteEditorStore.getState().document!;
    expect(doc.palette.colors.length).toBe(9);
  });

  it('locked color cannot be removed', async () => {
    const doc = seedDoc();
    // Lock color 1
    doc.palette.colors[1].locked = true;
    useSpriteEditorStore.setState({ document: { ...doc } });
    render(<PalettePropsPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('palette-slot-1'));
    });
    // Remove button should not be present for locked colors
    expect(screen.queryByTestId('palette-detail-remove')).not.toBeInTheDocument();
    expect(screen.getByText('This color is locked')).toBeInTheDocument();
  });
});
