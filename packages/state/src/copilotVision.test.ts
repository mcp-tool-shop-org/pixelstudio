import { describe, it, expect, vi, afterEach } from 'vitest';
import { createBlankPixelBuffer } from '@glyphstudio/domain';
import {
  pixelBufferToBase64Png,
  askVisionWhatDoesThisReadAs,
  checkOllamaAvailability,
  DEFAULT_OLLAMA_CONFIG,
} from './copilotVision';
import type { OllamaVisionConfig } from './copilotVision';

// ── PNG encoding tests ──

describe('pixelBufferToBase64Png', () => {
  it('produces a valid base64 string', () => {
    const buf = createBlankPixelBuffer(4, 4);
    const b64 = pixelBufferToBase64Png(buf);
    expect(typeof b64).toBe('string');
    expect(b64.length).toBeGreaterThan(0);
    // Verify it decodes without error
    const decoded = Buffer.from(b64, 'base64');
    expect(decoded.length).toBeGreaterThan(0);
  });

  it('starts with PNG signature when decoded', () => {
    const buf = createBlankPixelBuffer(2, 2);
    const b64 = pixelBufferToBase64Png(buf);
    const decoded = Buffer.from(b64, 'base64');
    // PNG signature: 137 80 78 71 13 10 26 10
    expect(decoded[0]).toBe(137);
    expect(decoded[1]).toBe(80);
    expect(decoded[2]).toBe(78);
    expect(decoded[3]).toBe(71);
  });

  it('handles a 1x1 buffer', () => {
    const buf = createBlankPixelBuffer(1, 1);
    buf.data[0] = 255;
    buf.data[1] = 0;
    buf.data[2] = 0;
    buf.data[3] = 255;
    const b64 = pixelBufferToBase64Png(buf);
    expect(b64.length).toBeGreaterThan(0);
  });

  it('handles a buffer with actual pixel data', () => {
    const buf = createBlankPixelBuffer(8, 8);
    // Fill with red
    for (let i = 0; i < buf.data.length; i += 4) {
      buf.data[i] = 255;
      buf.data[i + 1] = 0;
      buf.data[i + 2] = 0;
      buf.data[i + 3] = 255;
    }
    const b64 = pixelBufferToBase64Png(buf);
    const decoded = Buffer.from(b64, 'base64');
    // Should contain IHDR and IDAT chunks
    const str = decoded.toString('latin1');
    expect(str).toContain('IHDR');
    expect(str).toContain('IDAT');
    expect(str).toContain('IEND');
  });

  it('produces different output for different images', () => {
    const buf1 = createBlankPixelBuffer(4, 4);
    const buf2 = createBlankPixelBuffer(4, 4);
    buf2.data[0] = 255; // Make one pixel red
    buf2.data[3] = 255;
    const b64_1 = pixelBufferToBase64Png(buf1);
    const b64_2 = pixelBufferToBase64Png(buf2);
    expect(b64_1).not.toBe(b64_2);
  });
});

// ── Ollama API tests (mocked fetch) ──

describe('askVisionWhatDoesThisReadAs', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns a description on success', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'A small knight character with a red hood.' }),
    });

    const buf = createBlankPixelBuffer(16, 16);
    const result = await askVisionWhatDoesThisReadAs(buf);

    expect(result.ok).toBe(true);
    expect(result.description).toBe('A small knight character with a red hood.');
    expect(result.error).toBeNull();
    expect(result.responseTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('returns error on HTTP failure', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 404,
      text: () => Promise.resolve('model not found'),
    });

    const buf = createBlankPixelBuffer(16, 16);
    const result = await askVisionWhatDoesThisReadAs(buf);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('404');
  });

  it('returns error on network failure', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('Connection refused'));

    const buf = createBlankPixelBuffer(16, 16);
    const result = await askVisionWhatDoesThisReadAs(buf);

    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection refused');
  });

  it('sends correct request format', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'test' }),
    });
    globalThis.fetch = mockFetch;

    const buf = createBlankPixelBuffer(8, 8);
    await askVisionWhatDoesThisReadAs(buf);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:11434/api/generate');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('llava');
    expect(body.images).toHaveLength(1);
    expect(body.stream).toBe(false);
  });

  it('uses custom config', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ response: 'test' }),
    });
    globalThis.fetch = mockFetch;

    const config: OllamaVisionConfig = {
      baseUrl: 'http://localhost:9999',
      model: 'llava:13b',
      timeoutMs: 60000,
    };

    const buf = createBlankPixelBuffer(8, 8);
    await askVisionWhatDoesThisReadAs(buf, config);

    const [url, opts] = mockFetch.mock.calls[0];
    expect(url).toBe('http://localhost:9999/api/generate');
    const body = JSON.parse(opts.body);
    expect(body.model).toBe('llava:13b');
  });
});

describe('checkOllamaAvailability', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('returns available when model is present', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        models: [{ name: 'llava:latest' }, { name: 'codellama:7b' }],
      }),
    });

    const result = await checkOllamaAvailability();
    expect(result.available).toBe(true);
    expect(result.models).toContain('llava:latest');
  });

  it('returns unavailable when model is missing', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({
        models: [{ name: 'codellama:7b' }],
      }),
    });

    const result = await checkOllamaAvailability();
    expect(result.available).toBe(false);
  });

  it('returns error when Ollama is not running', async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'));

    const result = await checkOllamaAvailability();
    expect(result.available).toBe(false);
    expect(result.error).toContain('ECONNREFUSED');
  });
});
