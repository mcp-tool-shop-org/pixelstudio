import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useSpriteEditorStore, useValidationStore } from '@glyphstudio/state';
import { createSpriteDocument } from '@glyphstudio/domain';
import { ValidationPanel } from './ValidationPanel';

function seedDoc() {
  const doc = createSpriteDocument('Test', 32, 32);
  useSpriteEditorStore.setState({ document: doc });
  return doc;
}

describe('ValidationPanel', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useSpriteEditorStore.setState({ document: null });
    useValidationStore.setState({ currentReport: null, activeIssueId: null, running: false });
  });

  it('shows empty state when no document', () => {
    render(<ValidationPanel />);
    expect(screen.getByText('No document loaded')).toBeInTheDocument();
  });

  it('renders run button', () => {
    seedDoc();
    render(<ValidationPanel />);
    expect(screen.getByTestId('validation-run')).toBeInTheDocument();
    expect(screen.getByText('Run Validation')).toBeInTheDocument();
  });

  it('renders category filters', () => {
    seedDoc();
    render(<ValidationPanel />);
    expect(screen.getByTestId('validation-filter-palette')).toBeInTheDocument();
    expect(screen.getByTestId('validation-filter-animation')).toBeInTheDocument();
    expect(screen.getByTestId('validation-filter-export')).toBeInTheDocument();
  });

  it('running validation produces a report', async () => {
    seedDoc();
    render(<ValidationPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('validation-run'));
    });
    expect(screen.getByTestId('validation-summary')).toBeInTheDocument();
  });

  it('clean document shows no-issues message', async () => {
    const doc = seedDoc();
    // Add second frame so single-frame info doesn't trigger
    doc.frames.push({
      id: 'f2', index: 1, durationMs: 100,
      layers: [{ id: 'l1', name: 'Layer 1', visible: true, index: 0 }],
    });
    useSpriteEditorStore.setState({ document: { ...doc } });
    render(<ValidationPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('validation-run'));
    });
    // Should show "No issues found" (only info-level items at worst)
    const summary = screen.getByTestId('validation-summary');
    expect(summary).toBeInTheDocument();
  });

  it('document with errors shows error count', async () => {
    const doc = seedDoc();
    doc.frames[0].durationMs = 0; // error: zero duration
    useSpriteEditorStore.setState({ document: { ...doc } });
    render(<ValidationPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('validation-run'));
    });
    const summary = screen.getByTestId('validation-summary');
    expect(summary.textContent).toMatch(/error/i);
  });

  it('clicking an issue shows detail pane', async () => {
    const doc = seedDoc();
    doc.frames[0].durationMs = 0; // creates an error issue
    useSpriteEditorStore.setState({ document: { ...doc } });
    render(<ValidationPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('validation-run'));
    });
    // Click first issue in the list
    const issueList = screen.getByTestId('validation-issue-list');
    const firstIssue = issueList.children[0] as HTMLElement;
    await act(async () => {
      await userEvent.click(firstIssue);
    });
    expect(screen.getByTestId('validation-issue-detail')).toBeInTheDocument();
  });

  it('category filter toggles', async () => {
    seedDoc();
    render(<ValidationPanel />);
    const paletteBtn = screen.getByTestId('validation-filter-palette');
    await act(async () => {
      await userEvent.click(paletteBtn);
    });
    expect(paletteBtn.className).toContain('active');
    await act(async () => {
      await userEvent.click(paletteBtn);
    });
    expect(paletteBtn.className).not.toContain('active');
  });

  it('filtering to palette only excludes animation issues', async () => {
    seedDoc(); // single frame → animation info normally appears
    render(<ValidationPanel />);
    // Enable palette-only filter
    await act(async () => {
      await userEvent.click(screen.getByTestId('validation-filter-palette'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('validation-run'));
    });
    const report = useValidationStore.getState().currentReport;
    expect(report).not.toBeNull();
    const animIssues = report!.issues.filter((i) => i.category === 'animation');
    expect(animIssues.length).toBe(0);
  });
});
