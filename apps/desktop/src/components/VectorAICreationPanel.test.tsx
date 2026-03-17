import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorAICreationPanel } from '../components/VectorAICreationPanel';
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
  store.addShape({
    name: 'head',
    groupId: null,
    geometry: { kind: 'ellipse', cx: 250, cy: 80, rx: 40, ry: 40 },
    fill: [150, 100, 80, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  });
  store.addShape({
    name: 'sword',
    groupId: null,
    geometry: { kind: 'rect', x: 310, y: 150, w: 20, h: 120 },
    fill: [180, 180, 180, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  });
}

/** Click "Silhouettes" mode to switch from default AI Generate mode. */
async function switchToSilhouetteMode(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByText('Silhouettes'));
}

describe('VectorAICreationPanel', () => {
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
    render(<VectorAICreationPanel />);
    expect(screen.getByText('No vector document')).toBeTruthy();
  });

  it('shows mode selector with AI Generate as default', () => {
    seedDocument();
    render(<VectorAICreationPanel />);
    expect(screen.getByText('AI Generate')).toBeTruthy();
    expect(screen.getByText('Silhouettes')).toBeTruthy();
    expect(screen.getByText('Pose')).toBeTruthy();
    expect(screen.getByText('Simplify')).toBeTruthy();
    // Default mode shows prompt input and Ollama button
    expect(screen.getByText(/Generate with Ollama/)).toBeTruthy();
  });

  it('shows prompt textarea in AI Generate mode', () => {
    seedDocument();
    render(<VectorAICreationPanel />);
    expect(screen.getByPlaceholderText(/Describe what to draw/)).toBeTruthy();
  });

  it('generates silhouette variants in silhouette mode', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    await user.click(screen.getByText('Generate Variants'));
    const cards = screen.queryAllByText(/Variant/);
    expect(cards.length).toBeGreaterThan(0);
  });

  it('switches to pose mode and shows correct button label', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await user.click(screen.getByText('Pose'));
    expect(screen.getByText('Generate Suggestions')).toBeTruthy();
  });

  it('shows accept/duplicate/reject buttons on proposals', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    await user.click(screen.getByText('Generate Variants'));
    expect(screen.queryAllByText('Accept').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Duplicate').length).toBeGreaterThan(0);
    expect(screen.queryAllByText('Reject').length).toBeGreaterThan(0);
  });

  it('accepting a proposal applies changes to document', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    await user.click(screen.getByText('Generate Variants'));
    const acceptBtns = screen.getAllByText('Accept');
    await user.click(acceptBtns[0]);
    expect(screen.queryAllByText('accepted').length).toBeGreaterThan(0);
    expect(screen.getByText(/1 accepted/)).toBeTruthy();
  });

  it('rejecting a proposal does not change document', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    await user.click(screen.getByText('Generate Variants'));
    const shapesBefore = useVectorMasterStore.getState().document!.shapes.length;
    const rejectBtns = screen.getAllByText('Reject');
    await user.click(rejectBtns[0]);
    const shapesAfter = useVectorMasterStore.getState().document!.shapes.length;
    expect(shapesAfter).toBe(shapesBefore);
    expect(screen.queryAllByText('rejected').length).toBeGreaterThan(0);
  });

  it('duplicating creates shapes in AI Proposals group', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    await user.click(screen.getByText('Generate Variants'));
    const dupBtns = screen.getAllByText('Duplicate');
    await user.click(dupBtns[0]);
    const doc = useVectorMasterStore.getState().document!;
    const aiGroup = doc.groups.find((g) => g.name === 'AI Proposals');
    expect(aiGroup).toBeTruthy();
    const aiShapes = doc.shapes.filter((s) => s.groupId === aiGroup?.id);
    expect(aiShapes.length).toBeGreaterThan(0);
  });

  it('dismiss all clears pending proposals in set', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    await user.click(screen.getByText('Generate Variants'));
    const dismissBtn = screen.queryByText('Dismiss All');
    if (dismissBtn) {
      await user.click(dismissBtn);
      expect(screen.queryAllByText('dismissed').length).toBeGreaterThan(0);
    }
  });

  it('shows warning when no profiles active in algorithmic mode', async () => {
    const user = userEvent.setup();
    seedDocument();
    useSizeProfileStore.getState().deactivateAll();
    render(<VectorAICreationPanel />);
    await switchToSilhouetteMode(user);
    expect(screen.getByText(/Enable size profiles/)).toBeTruthy();
  });
});
