import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useWorkflowStore } from '@glyphstudio/state';

// Mock the executor to prevent actual Tauri invoke calls
vi.mock('../workflows/executor', () => ({
  executeWorkflow: vi.fn(),
}));

// Mock WorkflowRunner to avoid store coupling issues in tests
vi.mock('../components/WorkflowRunner', () => ({
  WorkflowRunner: ({ onClose }: { onClose: () => void }) => <div data-testid="workflow-runner">WorkflowRunner</div>,
}));

import { ProjectHome } from '../components/ProjectHome';

describe('ProjectHome', () => {
  afterEach(cleanup);
  beforeEach(() => {
    useWorkflowStore.setState({ workflows: [], activeRun: null });
  });

  describe('rendering', () => {
    it('shows GlyphStudio title', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText('GlyphStudio')).toBeInTheDocument();
    });

    it('shows tagline', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByText(/Build sprites with deterministic tools/)).toBeInTheDocument();
    });

    it('shows create form', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('create-form')).toBeInTheDocument();
      expect(screen.getByText('New Sprite')).toBeInTheDocument();
    });

    it('shows name, width, height inputs', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('create-name')).toBeInTheDocument();
      expect(screen.getByTestId('create-width')).toBeInTheDocument();
      expect(screen.getByTestId('create-height')).toBeInTheDocument();
    });

    it('shows Open Project button', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('open-project-btn')).toBeInTheDocument();
      expect(screen.getByText('Open Project…')).toBeInTheDocument();
    });

    it('shows static/animation mode toggle', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('create-mode-toggle')).toBeInTheDocument();
      expect(screen.getByText('Static')).toBeInTheDocument();
      expect(screen.getByText('Animation')).toBeInTheDocument();
    });

    it('shows size presets row', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('size-presets')).toBeInTheDocument();
      expect(screen.getByTestId('preset-16')).toBeInTheDocument();
      expect(screen.getByTestId('preset-64')).toBeInTheDocument();
      expect(screen.getByTestId('preset-128')).toBeInTheDocument();
      expect(screen.getByTestId('preset-32×48')).toBeInTheDocument();
    });

    it('shows Workflows section with cards after registration', async () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      // Workflows register on mount via useEffect
      await act(async () => {});
      expect(screen.getByText('Workflows')).toBeInTheDocument();
      // Tool workflows: analyze, validate, export (create workflows are separate)
      expect(screen.getByTestId('wf-card-analyze-sprite')).toBeInTheDocument();
      expect(screen.getByTestId('wf-card-validate-sprite')).toBeInTheDocument();
      expect(screen.getByTestId('wf-card-export-review-pack')).toBeInTheDocument();
    });

    it('workflow cards show descriptions', async () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      await act(async () => {});
      expect(screen.getByText(/Run bounds, color, and frame analysis/)).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('animation mode shows frame count and duration inputs', async () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      // Switch to animation mode
      await act(async () => {
        await userEvent.click(screen.getByText('Animation'));
      });
      expect(screen.getByTestId('create-frames')).toBeInTheDocument();
      expect(screen.getByTestId('create-duration')).toBeInTheDocument();
    });

    it('static mode hides frame count inputs', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      // Default is static
      expect(screen.queryByTestId('create-frames')).not.toBeInTheDocument();
    });

    it('Create button is present', () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('create-run')).toBeInTheDocument();
      expect(screen.getByText('Create')).toBeInTheDocument();
    });

    it('clicking a size preset updates width and height inputs', async () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      await act(async () => {
        await userEvent.click(screen.getByTestId('preset-16'));
      });
      expect((screen.getByTestId('create-width') as HTMLInputElement).value).toBe('16');
      expect((screen.getByTestId('create-height') as HTMLInputElement).value).toBe('16');
    });

    it('active preset button has active class when dimensions match', async () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      // Default is 64×64 — preset-64 should be active
      expect(screen.getByTestId('preset-64').className).toContain('active');
      expect(screen.getByTestId('preset-32').className).not.toContain('active');
    });

    it('32×48 preset sets asymmetric dimensions', async () => {
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      await act(async () => {
        await userEvent.click(screen.getByTestId('preset-32×48'));
      });
      expect((screen.getByTestId('create-width') as HTMLInputElement).value).toBe('32');
      expect((screen.getByTestId('create-height') as HTMLInputElement).value).toBe('48');
    });

    it('shows workflow runner when a run is active', () => {
      useWorkflowStore.setState({
        workflows: [
          { id: 'test', name: 'Test', description: 'Test workflow', category: 'analyze', steps: [{ id: 's1', label: 'Step 1', description: 'Do thing' }] },
        ],
        activeRun: {
          workflowId: 'test',
          status: 'running',
          currentStepIndex: 0,
          stepResults: [],
          startedAt: new Date().toISOString(),
        },
      });
      render(<ProjectHome onEnterWorkspace={vi.fn()} />);
      expect(screen.getByTestId('workflow-runner')).toBeInTheDocument();
    });
  });
});
