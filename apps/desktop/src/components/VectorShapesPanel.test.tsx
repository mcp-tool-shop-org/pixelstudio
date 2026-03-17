import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VectorShapesPanel } from '../components/VectorShapesPanel';
import { useVectorMasterStore, useSizeProfileStore } from '@glyphstudio/state';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';

describe('VectorShapesPanel', () => {
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

  it('shows placeholder when no document', () => {
    render(<VectorShapesPanel />);
    expect(screen.getByText('No vector document')).toBeTruthy();
  });

  it('shows shape count', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'body',
      groupId: null,
      geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 300 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    render(<VectorShapesPanel />);
    expect(screen.getByText('Shapes (1)')).toBeTruthy();
  });

  it('shows shape name in row', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'big-body',
      groupId: null,
      geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 300 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    render(<VectorShapesPanel />);
    expect(screen.getByText('big-body')).toBeTruthy();
  });

  it('shows risk badge X for collapsing shapes', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'tiny-dot',
      groupId: null,
      geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    render(<VectorShapesPanel />);
    const badges = screen.queryAllByText('X');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows risk badge OK for safe shapes', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'big-body',
      groupId: null,
      geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 300 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    render(<VectorShapesPanel />);
    const badges = screen.queryAllByText('OK');
    expect(badges.length).toBeGreaterThan(0);
  });

  it('shows collapse count in header when shapes collapse', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'tiny',
      groupId: null,
      geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    render(<VectorShapesPanel />);
    expect(screen.queryByText('1X')).toBeTruthy();
  });

  it('does not show risk badges when no profiles active', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'tiny',
      groupId: null,
      geometry: { kind: 'rect', x: 250, y: 250, w: 3, h: 3 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META },
      visible: true,
      locked: false,
    });
    useSizeProfileStore.getState().deactivateAll();
    render(<VectorShapesPanel />);
    expect(screen.queryByText('X')).toBeNull();
    expect(screen.queryByText('OK')).toBeNull();
  });

  it('shows survival hint badges', () => {
    const store = useVectorMasterStore.getState();
    store.createDocument('Test');
    store.addShape({
      name: 'critical',
      groupId: null,
      geometry: { kind: 'rect', x: 200, y: 200, w: 50, h: 50 },
      fill: [100, 100, 100, 255],
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive' },
      visible: true,
      locked: false,
    });
    render(<VectorShapesPanel />);
    expect(screen.queryByText('M')).toBeTruthy();
  });
});
