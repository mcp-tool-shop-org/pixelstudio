import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ComfyUIGeneratePanel } from './ComfyUIGeneratePanel';
import { mockInvoke } from '../test/setup';

beforeEach(() => {
  mockInvoke.reset();
});

afterEach(() => {
  cleanup();
});

describe('ComfyUIGeneratePanel', () => {
  it('renders panel with template selector and prompt input', () => {
    render(<ComfyUIGeneratePanel />);
    expect(screen.getByTestId('comfyui-generate-panel')).toBeInTheDocument();
    expect(screen.getByTestId('template-select')).toBeInTheDocument();
    expect(screen.getByTestId('prompt-input')).toBeInTheDocument();
    expect(screen.getByTestId('generate-btn')).toBeInTheDocument();
  });

  it('has 3 template options', () => {
    render(<ComfyUIGeneratePanel />);
    const select = screen.getByTestId('template-select') as HTMLSelectElement;
    expect(select.options).toHaveLength(3);
  });

  it('shows default prompt for character template', () => {
    render(<ComfyUIGeneratePanel />);
    const textarea = screen.getByTestId('prompt-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('pixel art character sprite');
  });

  it('updates prompt when template changes', async () => {
    render(<ComfyUIGeneratePanel />);
    const user = userEvent.setup();
    const select = screen.getByTestId('template-select');
    await user.selectOptions(select, 'pixel-prop');

    const textarea = screen.getByTestId('prompt-input') as HTMLTextAreaElement;
    expect(textarea.value).toContain('pixel art item sprite');
  });

  it('disables generate button when prompt is empty', async () => {
    render(<ComfyUIGeneratePanel />);
    const user = userEvent.setup();
    const textarea = screen.getByTestId('prompt-input');
    await user.clear(textarea);

    expect(screen.getByTestId('generate-btn')).toBeDisabled();
  });

  it('shows generating state when button is clicked', async () => {
    // Mock the generate command to hang (never resolve)
    let resolveGenerate: ((v: unknown) => void) | undefined;
    mockInvoke.on('ai_comfyui_generate', () => new Promise((r) => { resolveGenerate = r; }));

    render(<ComfyUIGeneratePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('generate-btn'));

    await waitFor(() => {
      expect(screen.getByTestId('generate-btn')).toBeDisabled();
      expect(screen.getByText('Generating...')).toBeInTheDocument();
    });

    // Clean up
    resolveGenerate?.({ prompt_id: 'test-123' });
  });

  it('shows error when generation fails', async () => {
    mockInvoke.on('ai_comfyui_generate', () => {
      throw new Error('ComfyUI not running');
    });

    render(<ComfyUIGeneratePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('generate-btn'));

    await waitFor(() => {
      expect(screen.getByText('ComfyUI not running')).toBeInTheDocument();
    });
  });

  it('shows result preview after successful generation', async () => {
    mockInvoke.on('ai_comfyui_generate', () => ({ prompt_id: 'test-abc' }));
    mockInvoke.on('ai_comfyui_poll', () => ({
      prompt_id: 'test-abc',
      done: true,
      images: [{ filename: 'glyphstudio_00001_.png', subfolder: '', image_type: 'output' }],
      error: null,
    }));
    // Minimal 1x1 white PNG in base64
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';
    mockInvoke.on('ai_comfyui_fetch_image', () => ({
      base64_png: tinyPng,
      width: 512,
      height: 512,
    }));

    render(<ComfyUIGeneratePanel />);
    const user = userEvent.setup();
    await user.click(screen.getByTestId('generate-btn'));

    await waitFor(() => {
      expect(screen.getByAltText('Generated sprite')).toBeInTheDocument();
      expect(screen.getByTestId('import-btn')).toBeInTheDocument();
    });
  });

  it('has checkpoint input with default value', () => {
    render(<ComfyUIGeneratePanel />);
    const input = screen.getByTestId('checkpoint-input') as HTMLInputElement;
    expect(input.value).toBe('pixelArtDiffusion14_v14.safetensors');
  });
});
