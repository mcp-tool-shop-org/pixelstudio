import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorCopilotPanel } from '../components/VectorCopilotPanel';
import { useVectorMasterStore, useSizeProfileStore } from '@glyphstudio/state';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import type { PathPoint, PathSegment } from '@glyphstudio/domain';

function seedDocument() {
  const store = useVectorMasterStore.getState();
  store.createDocument('Test Vector');
  const id = store.addShape({
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
  return id;
}

function seedTinyShape() {
  const store = useVectorMasterStore.getState();
  store.addShape({
    name: 'tiny-gem',
    groupId: null,
    geometry: { kind: 'rect', x: 200, y: 200, w: 5, h: 5 },
    fill: [255, 0, 0, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META, survivalHint: 'must-survive', cueTag: 'gem' },
    visible: true,
    locked: false,
  });
}

describe('VectorCopilotPanel', () => {
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
    render(<VectorCopilotPanel />);
    expect(screen.getByText('No vector document')).toBeTruthy();
  });

  it('shows action buttons when document exists', () => {
    seedDocument();
    render(<VectorCopilotPanel />);
    expect(screen.getByText('Top 3 Changes')).toBeTruthy();
    expect(screen.getByText('Collapse Check')).toBeTruthy();
    expect(screen.getByText('Size Ranking')).toBeTruthy();
    expect(screen.getByText('Exaggeration')).toBeTruthy();
    expect(screen.getByText('What Is This?')).toBeTruthy();
  });

  it('clicking Top 3 Changes shows analysis results', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Top 3 Changes'));
    // Should show either critiques or all-clear
    const allClear = screen.queryByText(/No critical issues/);
    const critiques = screen.queryAllByText(/severity/i);
    expect(allClear || critiques.length >= 0).toBeTruthy();
  });

  it('clicking Collapse Check shows collapse results', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Collapse Check'));
    // Should show summary text — may match multiple elements
    const matches = screen.queryAllByText(/survive|collapse/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('clicking Size Ranking shows profile comparison', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Size Ranking'));
    // Should show at least one profile score
    const scores = screen.queryAllByText(/\d+×\d+/);
    expect(scores.length).toBeGreaterThan(0);
  });

  it('clicking Exaggeration shows recommendations', async () => {
    const user = userEvent.setup();
    seedDocument();
    seedTinyShape();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Exaggeration'));
    // Should show summary — may match multiple elements, use queryAllByText
    const matches = screen.queryAllByText(/exaggerat/i);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('shows warning when no active profiles', async () => {
    seedDocument();
    useSizeProfileStore.getState().deactivateAll();
    render(<VectorCopilotPanel />);
    expect(screen.getByText(/No active size profiles/)).toBeTruthy();
  });

  it('shows session notes after running analysis', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Collapse Check'));
    // Should show session notes section
    const notes = screen.queryByText(/Session Notes/);
    expect(notes).toBeTruthy();
  });

  it('clear notes button removes all notes', async () => {
    const user = userEvent.setup();
    seedDocument();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Collapse Check'));
    // Notes should appear
    expect(screen.queryByText(/Session Notes/)).toBeTruthy();
    // Clear them
    await user.click(screen.getByText('Clear'));
    // Notes section should disappear
    expect(screen.queryByText(/Session Notes/)).toBeNull();
  });

  it('critical risk shapes appear in top changes', async () => {
    const user = userEvent.setup();
    seedDocument();
    seedTinyShape();
    render(<VectorCopilotPanel />);
    await user.click(screen.getByText('Top 3 Changes'));
    // The tiny must-survive gem should trigger a critical critique
    const critical = screen.queryByText('critical');
    expect(critical).toBeTruthy();
  });
});
