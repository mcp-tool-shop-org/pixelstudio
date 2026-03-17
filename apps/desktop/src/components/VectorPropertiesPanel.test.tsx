import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorPropertiesPanel } from '../components/VectorPropertiesPanel';
import { useVectorMasterStore } from '@glyphstudio/state';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import type { PathPoint, PathSegment } from '@glyphstudio/domain';

function seedPathShape() {
  const store = useVectorMasterStore.getState();
  store.createDocument('Test Vector');
  const pts: PathPoint[] = [
    { x: 0, y: 0, pointType: 'corner' },
    { x: 100, y: 0, pointType: 'smooth' },
    { x: 100, y: 100, pointType: 'corner' },
  ];
  const segs: PathSegment[] = [
    { kind: 'line' },
    { kind: 'quadratic', cpX: 150, cpY: 50 },
  ];
  const id = store.addShape({
    name: 'test-path',
    groupId: null,
    geometry: { kind: 'path', points: pts, segments: segs, closed: false },
    fill: [100, 100, 100, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  });
  store.selectShape(id);
  return id;
}

describe('VectorPropertiesPanel — path controls', () => {
  beforeEach(() => {
    useVectorMasterStore.setState({
      document: null,
      selectedShapeIds: [],
      selectedGroupId: null,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('shows path info for selected path shape', () => {
    seedPathShape();
    render(<VectorPropertiesPanel />);
    expect(screen.getByText(/3 pts, 2 segs, open/)).toBeTruthy();
  });

  it('shows Open/Close path button', () => {
    seedPathShape();
    render(<VectorPropertiesPanel />);
    expect(screen.getByText('Close Path')).toBeTruthy();
  });

  it('shows point list with types', () => {
    seedPathShape();
    render(<VectorPropertiesPanel />);
    // Should show 3 point rows
    const rows = screen.getAllByText(/\d+,\d+/);
    expect(rows.length).toBe(3);
  });

  it('shows segment list with conversion buttons', () => {
    seedPathShape();
    render(<VectorPropertiesPanel />);
    expect(screen.getByText('line')).toBeTruthy();
    expect(screen.getByText('quadratic')).toBeTruthy();
  });

  it('clicking Close Path toggles path to closed', async () => {
    const user = userEvent.setup();
    const id = seedPathShape();
    render(<VectorPropertiesPanel />);
    await user.click(screen.getByText('Close Path'));
    const doc = useVectorMasterStore.getState().document;
    const shape = doc!.shapes.find((s) => s.id === id);
    expect(shape).toBeTruthy();
    if (shape?.geometry.kind === 'path') {
      expect(shape.geometry.closed).toBe(true);
    }
  });

  it('clicking segment conversion button converts line to curve', async () => {
    const user = userEvent.setup();
    const id = seedPathShape();
    render(<VectorPropertiesPanel />);
    // Click the first "→ Curve" button (converts line segment to quadratic)
    const curveBtn = screen.getAllByText(/Curve/)[0];
    await user.click(curveBtn);
    const doc = useVectorMasterStore.getState().document;
    const shape = doc!.shapes.find((s) => s.id === id);
    if (shape?.geometry.kind === 'path') {
      expect(shape.geometry.segments[0].kind).toBe('quadratic');
    }
  });

  it('shows no panel when no shape selected', () => {
    useVectorMasterStore.getState().createDocument('Empty');
    render(<VectorPropertiesPanel />);
    expect(screen.getByText('No shape selected')).toBeTruthy();
  });

  it('shows geometry type as path', () => {
    seedPathShape();
    render(<VectorPropertiesPanel />);
    expect(screen.getByText('path')).toBeTruthy();
  });

  it('can delete a point from path', async () => {
    const user = userEvent.setup();
    const id = seedPathShape();
    render(<VectorPropertiesPanel />);
    // Find delete buttons (✕) — there should be 3 (one per point, all > 2 points)
    const deleteBtns = screen.getAllByTitle('Delete point');
    expect(deleteBtns.length).toBe(3);
    await user.click(deleteBtns[1]); // Delete middle point
    const doc = useVectorMasterStore.getState().document;
    const shape = doc!.shapes.find((s) => s.id === id);
    if (shape?.geometry.kind === 'path') {
      expect(shape.geometry.points.length).toBe(2);
    }
  });
});
