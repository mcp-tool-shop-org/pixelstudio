import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AISettingsPanel } from './AISettingsPanel';
import { mockInvoke } from '../test/setup';

function mockOllamaOnline() {
  mockInvoke.on('ai_ollama_status', () => ({
    available: true,
    endpoint: 'http://localhost:11434',
    version: '0.6.2',
    error: null,
  }));
  mockInvoke.on('ai_ollama_models', () => ({
    models: [
      { name: 'qwen2.5:14b', size: 9_000_000_000, parameter_size: '14B', quantization: 'Q4_K_M' },
      { name: 'llava:13b', size: 8_000_000_000, parameter_size: '13B', quantization: 'Q4_0' },
    ],
    endpoint: 'http://localhost:11434',
  }));
}

function mockOllamaOffline() {
  mockInvoke.on('ai_ollama_status', () => ({
    available: false,
    endpoint: 'http://localhost:11434',
    version: null,
    error: 'Connection refused',
  }));
}

function mockComfyuiOnline() {
  mockInvoke.on('ai_comfyui_status', () => ({
    available: true,
    endpoint: 'http://localhost:8188',
    version: '0.3.10',
    error: null,
  }));
}

function mockComfyuiOffline() {
  mockInvoke.on('ai_comfyui_status', () => ({
    available: false,
    endpoint: 'http://localhost:8188',
    version: null,
    error: 'Connection refused',
  }));
}

beforeEach(() => {
  mockInvoke.reset();
});

afterEach(() => {
  cleanup();
});

describe('AISettingsPanel', () => {
  it('renders both service sections', () => {
    mockOllamaOffline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    expect(screen.getByText('Ollama')).toBeInTheDocument();
    expect(screen.getByText('ComfyUI')).toBeInTheDocument();
    expect(screen.getByText('AI Infrastructure')).toBeInTheDocument();
  });

  it('shows default endpoints', () => {
    mockOllamaOffline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    const ollamaInput = screen.getByTestId('ollama-endpoint-input') as HTMLInputElement;
    const comfyuiInput = screen.getByTestId('comfyui-endpoint-input') as HTMLInputElement;
    expect(ollamaInput.value).toBe('http://localhost:11434');
    expect(comfyuiInput.value).toBe('http://localhost:8188');
  });

  it('shows connected status when Ollama is online', async () => {
    mockOllamaOnline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Connected.*v0\.6\.2/)).toBeInTheDocument();
    });
  });

  it('shows model list when Ollama is connected', async () => {
    mockOllamaOnline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    await waitFor(() => {
      expect(screen.getByText('2 models available')).toBeInTheDocument();
    });
    expect(screen.getByTestId('ollama-text-model-select')).toBeInTheDocument();
    expect(screen.getByTestId('ollama-vision-model-select')).toBeInTheDocument();
  });

  it('shows error when Ollama is offline', async () => {
    mockOllamaOffline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    await waitFor(() => {
      const errors = screen.getAllByText('Connection refused');
      expect(errors.length).toBe(2); // both Ollama and ComfyUI offline
    });
  });

  it('shows connected status when ComfyUI is online', async () => {
    mockOllamaOffline();
    mockComfyuiOnline();
    render(<AISettingsPanel />);
    await waitFor(() => {
      expect(screen.getByText(/Connected.*v0\.3\.10/)).toBeInTheDocument();
    });
  });

  it('persists endpoint changes to localStorage', async () => {
    mockOllamaOffline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    const user = userEvent.setup();
    const ollamaInput = screen.getByTestId('ollama-endpoint-input');
    await user.clear(ollamaInput);
    await user.type(ollamaInput, 'http://myserver:11434');
    const stored = JSON.parse(localStorage.getItem('glyphstudio_ai_settings') ?? '{}');
    expect(stored.ollamaEndpoint).toBe('http://myserver:11434');
  });

  it('resets to defaults on button click', async () => {
    mockOllamaOffline();
    mockComfyuiOffline();
    render(<AISettingsPanel />);
    const user = userEvent.setup();

    // Change endpoint
    const ollamaInput = screen.getByTestId('ollama-endpoint-input') as HTMLInputElement;
    await user.clear(ollamaInput);
    await user.type(ollamaInput, 'http://custom:9999');
    expect(ollamaInput.value).toBe('http://custom:9999');

    // Reset
    await user.click(screen.getByText('Reset to Defaults'));
    expect((screen.getByTestId('ollama-endpoint-input') as HTMLInputElement).value).toBe('http://localhost:11434');
  });

  it('disables Test Connection button while checking', async () => {
    // Don't resolve the Ollama mock - leave it pending
    let resolveStatus: ((v: unknown) => void) | undefined;
    mockInvoke.on('ai_ollama_status', () => new Promise((r) => { resolveStatus = r; }));
    mockComfyuiOffline();
    render(<AISettingsPanel />);

    // Both sections auto-check on mount. ComfyUI resolves immediately (offline),
    // Ollama stays pending. Find the disabled "Checking..." button.
    await waitFor(() => {
      const checkingButtons = screen.getAllByText('Checking...');
      // At least the Ollama button should be disabled
      const disabledOnes = checkingButtons.filter((b) => (b as HTMLButtonElement).disabled);
      expect(disabledOnes.length).toBeGreaterThanOrEqual(1);
    });

    // Resolve to clean up
    resolveStatus?.({
      available: false,
      endpoint: 'http://localhost:11434',
      version: null,
      error: 'timeout',
    });
  });
});
