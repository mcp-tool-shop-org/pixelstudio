import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CopilotPanel } from './CopilotPanel';
import { mockInvoke } from '../test/setup';

function mockOllamaOnline() {
  mockInvoke.on('ai_ollama_status', () => ({
    available: true,
    endpoint: 'http://localhost:11434',
    version: '0.6.2',
    error: null,
  }));
}

function mockCanvasContext() {
  mockInvoke.on('ai_get_canvas_context', () => ({
    document: { width: 32, height: 32, activeFrameName: 'Frame 1', activeLayerName: 'Layer 1', packageName: 'test' },
    layers: [
      { name: 'Layer 1', visible: true, locked: false, opacity: 1.0, zIndex: 0 },
    ],
    selection: null,
    animation: { frameCount: 1, activeFrameIndex: 0, frames: [{ name: 'Frame 1', durationMs: null }] },
    history: { canUndo: true, canRedo: false, undoDepth: 3, redoDepth: 0, recentTools: ['brush'] },
    snapshotBase64: null,
  }));
}

beforeEach(() => {
  mockInvoke.reset();
  mockOllamaOnline();
  mockCanvasContext();
});

afterEach(() => {
  cleanup();
});

describe('CopilotPanel', () => {
  it('renders panel with input and send button', async () => {
    render(<CopilotPanel />);
    expect(screen.getByTestId('copilot-panel')).toBeInTheDocument();
    expect(screen.getByTestId('copilot-input')).toBeInTheDocument();
    expect(screen.getByTestId('send-btn')).toBeInTheDocument();
  });

  it('shows context summary', async () => {
    render(<CopilotPanel />);
    await waitFor(() => {
      expect(screen.getByTestId('context-summary')).toHaveTextContent('32x32');
      expect(screen.getByTestId('context-summary')).toHaveTextContent('Frame 1');
    });
  });

  it('shows empty state message', () => {
    render(<CopilotPanel />);
    expect(screen.getByText(/Ask the copilot/)).toBeInTheDocument();
  });

  it('disables send button when input is empty', () => {
    render(<CopilotPanel />);
    expect(screen.getByTestId('send-btn')).toBeDisabled();
  });

  it('enables send button when input has text', async () => {
    render(<CopilotPanel />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('copilot-input'), 'Hello');
    expect(screen.getByTestId('send-btn')).not.toBeDisabled();
  });

  it('shows user message after sending', async () => {
    // Mock the chat to return a simple text response
    mockInvoke.on('ai_ollama_chat', () => ({
      content: 'I can help with that!',
      toolCalls: [],
      done: true,
      totalDurationNs: 1000000000,
    }));

    render(<CopilotPanel />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('copilot-input'), 'Draw a red pixel');
    await user.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      expect(screen.getByText('Draw a red pixel')).toBeInTheDocument();
      expect(screen.getByText('I can help with that!')).toBeInTheDocument();
    });
  });

  it('shows approval bar when tool calls are returned', async () => {
    mockInvoke.on('ai_ollama_chat', () => ({
      content: 'I will draw a red pixel at (5, 5).',
      toolCalls: [
        { function: { name: 'draw_pixel', arguments: { x: 5, y: 5, r: 255, g: 0, b: 0, a: 255 } } },
      ],
      done: true,
      totalDurationNs: 1000000000,
    }));

    render(<CopilotPanel />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('copilot-input'), 'Draw a red pixel');
    await user.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('approval-bar')).toBeInTheDocument();
      expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });
  });

  it('executes tool calls on approve', async () => {
    mockInvoke.on('ai_ollama_chat', () => ({
      content: 'Drawing red pixel.',
      toolCalls: [
        { function: { name: 'draw_pixel', arguments: { x: 5, y: 5, r: 255, g: 0, b: 0, a: 255 } } },
      ],
      done: true,
      totalDurationNs: null,
    }));
    mockInvoke.on('write_pixel', () => ({ r: 255, g: 0, b: 0, a: 255 }));

    render(<CopilotPanel />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('copilot-input'), 'Draw a red pixel');
    await user.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('approve-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('approve-btn'));

    await waitFor(() => {
      expect(screen.getByText(/draw_pixel: OK/)).toBeInTheDocument();
    });
  });

  it('cancels tool calls on reject', async () => {
    mockInvoke.on('ai_ollama_chat', () => ({
      content: 'Drawing red pixel.',
      toolCalls: [
        { function: { name: 'draw_pixel', arguments: { x: 5, y: 5, r: 255, g: 0, b: 0, a: 255 } } },
      ],
      done: true,
      totalDurationNs: null,
    }));

    render(<CopilotPanel />);
    const user = userEvent.setup();
    await user.type(screen.getByTestId('copilot-input'), 'Draw a red pixel');
    await user.click(screen.getByTestId('send-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('reject-btn')).toBeInTheDocument();
    });

    await user.click(screen.getByTestId('reject-btn'));

    await waitFor(() => {
      expect(screen.getByText('Operations cancelled by user.')).toBeInTheDocument();
    });
  });

  it('shows offline warning when Ollama is down', async () => {
    mockInvoke.reset();
    mockCanvasContext();
    mockInvoke.on('ai_ollama_status', () => ({
      available: false,
      endpoint: 'http://localhost:11434',
      version: null,
      error: 'Connection refused',
    }));

    render(<CopilotPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Ollama is offline/)).toBeInTheDocument();
    });
  });
});
