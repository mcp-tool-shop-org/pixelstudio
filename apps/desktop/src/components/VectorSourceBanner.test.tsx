import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorSourceBanner } from '../components/VectorSourceBanner';
import { useSpriteEditorStore, useVectorMasterStore, useSizeProfileStore } from '@glyphstudio/state';
import type { VectorSourceLink } from '@glyphstudio/domain';
import { BUILT_IN_SIZE_PROFILES, createSpriteDocument } from '@glyphstudio/domain';

const MOCK_SPRITE_DOC = createSpriteDocument('Test Sprite', 32, 32);

const LINK: VectorSourceLink = {
  sourceFile: 'test.glyphvec',
  sourceArtboardWidth: 500,
  sourceArtboardHeight: 500,
  profileId: 'sp_32x32',
  rasterizedAt: '2026-03-17T12:00:00.000Z',
};

describe('VectorSourceBanner', () => {
  beforeEach(() => {
    useSizeProfileStore.setState({
      profiles: [...BUILT_IN_SIZE_PROFILES],
      activeProfileIds: [],
    });
  });

  afterEach(() => {
    cleanup();
    useSpriteEditorStore.setState({ vectorSourceLink: null });
    useVectorMasterStore.getState().closeDocument();
  });

  it('renders nothing when no source link', () => {
    useSpriteEditorStore.setState({ vectorSourceLink: null });
    const { container } = render(<VectorSourceBanner />);
    expect(container.innerHTML).toBe('');
  });

  it('renders banner when source link exists', () => {
    useSpriteEditorStore.setState({ vectorSourceLink: LINK });
    render(<VectorSourceBanner />);
    expect(screen.getByText('Vector Source')).toBeInTheDocument();
    expect(screen.getByText('32×32')).toBeInTheDocument();
  });

  it('shows Regenerate button', () => {
    useSpriteEditorStore.setState({ vectorSourceLink: LINK });
    render(<VectorSourceBanner />);
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });

  it('Regenerate button is disabled when no vector doc open', () => {
    useSpriteEditorStore.setState({ vectorSourceLink: LINK });
    render(<VectorSourceBanner />);
    const btn = screen.getByText('Regenerate');
    expect(btn).toBeDisabled();
  });

  it('shows confirmation when sprite is dirty', async () => {
    useSpriteEditorStore.setState({ vectorSourceLink: LINK, dirty: true, document: MOCK_SPRITE_DOC });
    useVectorMasterStore.getState().createDocument('Test');
    render(<VectorSourceBanner />);
    await act(async () => {
      await userEvent.click(screen.getByText('Regenerate'));
    });
    expect(screen.getByText('Unsaved edits will be lost!')).toBeInTheDocument();
    expect(screen.getByText('Confirm')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('cancel hides confirmation', async () => {
    useSpriteEditorStore.setState({ vectorSourceLink: LINK, dirty: true, document: MOCK_SPRITE_DOC });
    useVectorMasterStore.getState().createDocument('Test');
    render(<VectorSourceBanner />);
    await act(async () => {
      await userEvent.click(screen.getByText('Regenerate'));
    });
    await act(async () => {
      await userEvent.click(screen.getByText('Cancel'));
    });
    expect(screen.queryByText('Unsaved edits will be lost!')).toBeNull();
    expect(screen.getByText('Regenerate')).toBeInTheDocument();
  });
});
