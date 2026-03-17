import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorLivePreview } from '../components/VectorLivePreview';
import { useVectorMasterStore, useSizeProfileStore } from '@glyphstudio/state';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';

function seedDocument() {
  const store = useVectorMasterStore.getState();
  store.createDocument('Test Vector');
  store.addShape({
    name: 'body',
    groupId: null,
    geometry: { kind: 'rect', x: 200, y: 100, w: 100, h: 300 },
    fill: [100, 100, 100, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  });
}

describe('VectorLivePreview', () => {
  beforeEach(() => {
    useVectorMasterStore.setState({
      document: null,
      selectedShapeIds: [],
      selectedGroupId: null,
    });
    useSizeProfileStore.getState().resetToBuiltIn();
    useSizeProfileStore.getState().activateAll();
  });

  afterEach(() => {
    cleanup();
  });

  it('renders nothing when no document', () => {
    const { container } = render(<VectorLivePreview />);
    expect(container.querySelector('.vector-live-preview')).toBeNull();
  });

  it('renders nothing when no active profiles', () => {
    seedDocument();
    useSizeProfileStore.getState().deactivateAll();
    const { container } = render(<VectorLivePreview />);
    expect(container.querySelector('.vector-live-preview')).toBeNull();
  });

  it('shows preview panels with labels', () => {
    seedDocument();
    render(<VectorLivePreview />);
    // Should show up to 3 smallest profiles
    expect(screen.getByText('16x16')).toBeTruthy();
  });

  it('shows toggle button', () => {
    seedDocument();
    render(<VectorLivePreview />);
    expect(screen.getByText('Preview -')).toBeTruthy();
  });

  it('collapses when toggle clicked', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorLivePreview />);
    await user.click(screen.getByText('Preview -'));
    expect(screen.getByText('Preview +')).toBeTruthy();
    // Strip should be hidden
    expect(screen.queryByText('16x16')).toBeNull();
  });

  it('shows at most 3 preview panels', () => {
    seedDocument();
    render(<VectorLivePreview />);
    const labels = screen.queryAllByText(/\d+x\d+/);
    expect(labels.length).toBeLessThanOrEqual(3);
    expect(labels.length).toBeGreaterThan(0);
  });

  it('renders canvas elements for each preview', () => {
    seedDocument();
    const { container } = render(<VectorLivePreview />);
    const canvases = container.querySelectorAll('.live-preview-canvas');
    expect(canvases.length).toBeGreaterThan(0);
    expect(canvases.length).toBeLessThanOrEqual(3);
  });
});
