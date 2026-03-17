import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { LLMShapeDef, GenerateResult, CritiqueResult } from './ollamaGenerate';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Import after mocking
const mod = await import('./ollamaGenerate');
const {
  generateShapesFromDescription,
  critiqueRenderedSprite,
  refineShapesFromCritique,
  shapesToProposalSet,
  generateWithCritiqueLoop,
  DEFAULT_GENERATE_CONFIG,
} = mod;

function ollamaResponse(content: string) {
  return {
    ok: true,
    status: 200,
    text: () => Promise.resolve(content),
    json: () => Promise.resolve({ response: content }),
  };
}

function makeBuf(w: number, h: number) {
  return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
}

beforeEach(() => {
  mockFetch.mockReset();
});

describe('generateShapesFromDescription', () => {
  it('parses valid JSON shapes from LLM response', async () => {
    const llmOutput = JSON.stringify({
      reasoning: 'Designed a simple knight',
      shapes: [
        { name: 'body', type: 'rect', x: 200, y: 150, w: 100, h: 200, fill: [60, 60, 80, 255], mustSurvive: true },
        { name: 'head', type: 'ellipse', cx: 250, cy: 120, rx: 40, ry: 35, fill: [180, 150, 120, 255] },
      ],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const result = await generateShapesFromDescription('knight', 500, 500, [16, 32]);
    expect(result.ok).toBe(true);
    expect(result.shapes).toHaveLength(2);
    expect(result.shapes[0].name).toBe('body');
    expect(result.shapes[1].name).toBe('head');
    expect(result.reasoning).toBe('Designed a simple knight');
  });

  it('handles markdown-fenced JSON', async () => {
    const llmOutput = 'Here is the design:\n```json\n{"reasoning":"test","shapes":[{"name":"box","type":"rect","x":10,"y":10,"w":100,"h":100,"fill":[255,0,0,255]}]}\n```';
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const result = await generateShapesFromDescription('red box', 500, 500, [16]);
    expect(result.ok).toBe(true);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].name).toBe('box');
  });

  it('rejects shapes that are too small', async () => {
    const llmOutput = JSON.stringify({
      reasoning: 'Tiny details',
      shapes: [
        { name: 'tiny', type: 'rect', x: 100, y: 100, w: 1, h: 1, fill: [255, 0, 0, 255] },
        { name: 'ok', type: 'rect', x: 100, y: 100, w: 50, h: 50, fill: [0, 255, 0, 255] },
      ],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const result = await generateShapesFromDescription('test', 500, 500, [16]);
    expect(result.ok).toBe(true);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].name).toBe('ok');
  });

  it('handles fetch failure', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await generateShapesFromDescription('test', 500, 500, [16]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('Connection');
  });

  it('handles invalid JSON from LLM', async () => {
    mockFetch.mockResolvedValueOnce(ollamaResponse('This is not JSON at all, just text'));

    const result = await generateShapesFromDescription('test', 500, 500, [16]);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('JSON');
  });

  it('validates polygon shapes require 3+ points', async () => {
    const llmOutput = JSON.stringify({
      reasoning: 'test',
      shapes: [
        { name: 'good-tri', type: 'polygon', points: [{ x: 100, y: 100 }, { x: 200, y: 100 }, { x: 150, y: 50 }], fill: [255, 0, 0, 255] },
        { name: 'bad-line', type: 'polygon', points: [{ x: 100, y: 100 }, { x: 200, y: 200 }], fill: [0, 255, 0, 255] },
      ],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const result = await generateShapesFromDescription('test', 500, 500, [16]);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].name).toBe('good-tri');
  });

  it('auto-generates name when LLM omits it', async () => {
    const llmOutput = JSON.stringify({
      reasoning: 'test',
      shapes: [
        { type: 'rect', x: 100, y: 100, w: 80, h: 120, fill: [40, 30, 60, 255] },
        { type: 'ellipse', cx: 250, cy: 80, rx: 40, ry: 40, fill: [200, 160, 130, 255] },
      ],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const result = await generateShapesFromDescription('test', 500, 500, [16]);
    expect(result.shapes).toHaveLength(2);
    expect(result.shapes[0].name).toBe('shape-0');
    expect(result.shapes[1].name).toBe('shape-1');
  });

  it('clamps fill values to 0-255', async () => {
    const llmOutput = JSON.stringify({
      reasoning: 'test',
      shapes: [
        { name: 'clamped', type: 'rect', x: 10, y: 10, w: 50, h: 50, fill: [300, -10, 128, 255] },
      ],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const result = await generateShapesFromDescription('test', 500, 500, [16]);
    expect(result.shapes[0].fill).toEqual([255, 0, 128, 255]);
  });
});

describe('critiqueRenderedSprite', () => {
  it('parses structured critique response', async () => {
    const visionOutput = JSON.stringify({
      critique: 'This looks like a blob',
      suggestions: ['Widen the shoulders', 'Separate arms from body'],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(visionOutput));

    const result = await critiqueRenderedSprite(makeBuf(64, 64));
    expect(result.ok).toBe(true);
    expect(result.critique).toBe('This looks like a blob');
    expect(result.suggestions).toHaveLength(2);
  });

  it('falls back to plain text when JSON parse fails', async () => {
    mockFetch.mockResolvedValueOnce(ollamaResponse('This sprite has poor contrast'));

    const result = await critiqueRenderedSprite(makeBuf(64, 64));
    expect(result.ok).toBe(true);
    expect(result.critique).toBe('This sprite has poor contrast');
    expect(result.suggestions).toHaveLength(0);
  });
});

describe('shapesToProposalSet', () => {
  it('converts shapes to proposal actions', () => {
    const shapes: LLMShapeDef[] = [
      { name: 'body', type: 'rect', x: 100, y: 100, w: 100, h: 200, fill: [60, 60, 80, 255], mustSurvive: true },
      { name: 'head', type: 'ellipse', cx: 150, cy: 80, rx: 30, ry: 25, fill: [180, 150, 120, 255] },
    ];

    const { set, proposals } = shapesToProposalSet(shapes, 'test reasoning', 'warrior');
    expect(set.kind).toBe('silhouette-variant');
    expect(proposals).toHaveLength(1);
    expect(proposals[0].actions).toHaveLength(2);
    expect(proposals[0].actions[0].type).toBe('add');
    expect(proposals[0].rationale).toBe('test reasoning');

    const addAction = proposals[0].actions[0] as { type: 'add'; shape: any };
    expect(addAction.shape.name).toBe('body');
    expect(addAction.shape.reduction.survivalHint).toBe('must-survive');
  });
});

describe('refineShapesFromCritique', () => {
  it('sends critique context and returns refined shapes', async () => {
    const llmOutput = JSON.stringify({
      reasoning: 'Widened shoulders per feedback',
      shapes: [
        { name: 'body', type: 'rect', x: 180, y: 150, w: 140, h: 200, fill: [60, 60, 80, 255] },
      ],
    });
    mockFetch.mockResolvedValueOnce(ollamaResponse(llmOutput));

    const current: LLMShapeDef[] = [
      { name: 'body', type: 'rect', x: 200, y: 150, w: 100, h: 200, fill: [60, 60, 80, 255] },
    ];

    const result = await refineShapesFromCritique(
      'warrior', 500, 500, [16, 32],
      current,
      'Too narrow',
      ['Widen the torso'],
    );
    expect(result.ok).toBe(true);
    expect(result.shapes[0].w).toBe(140);
  });
});

describe('generateWithCritiqueLoop', () => {
  it('runs generate then critique then refine', async () => {
    // Step 1: generate
    mockFetch.mockResolvedValueOnce(ollamaResponse(JSON.stringify({
      reasoning: 'Initial design',
      shapes: [{ name: 'body', type: 'rect', x: 200, y: 150, w: 100, h: 200, fill: [60, 60, 80, 255] }],
    })));

    // Step 2: vision critique
    mockFetch.mockResolvedValueOnce(ollamaResponse(JSON.stringify({
      critique: 'Body is too narrow',
      suggestions: ['Widen it'],
    })));

    // Step 3: refine
    mockFetch.mockResolvedValueOnce(ollamaResponse(JSON.stringify({
      reasoning: 'Widened',
      shapes: [{ name: 'body', type: 'rect', x: 180, y: 150, w: 140, h: 200, fill: [60, 60, 80, 255] }],
    })));

    const rasterize = () => makeBuf(64, 64);

    const result = await generateWithCritiqueLoop(
      'warrior', 500, 500, [16, 32],
      rasterize,
      DEFAULT_GENERATE_CONFIG,
      1,
    );

    expect(result.ok).toBe(true);
    expect(result.shapes).toHaveLength(1);
    expect(result.shapes[0].w).toBe(140); // Refined version
    expect(result.critiques).toHaveLength(1);
    expect(mockFetch).toHaveBeenCalledTimes(3); // generate + critique + refine
  });

  it('returns initial shapes if critique fails', async () => {
    // generate
    mockFetch.mockResolvedValueOnce(ollamaResponse(JSON.stringify({
      reasoning: 'Initial',
      shapes: [{ name: 'body', type: 'rect', x: 200, y: 150, w: 100, h: 200, fill: [60, 60, 80, 255] }],
    })));

    // critique fails
    mockFetch.mockRejectedValueOnce(new Error('timeout'));

    const rasterize = () => makeBuf(64, 64);

    const result = await generateWithCritiqueLoop(
      'warrior', 500, 500, [16, 32],
      rasterize,
      DEFAULT_GENERATE_CONFIG,
      1,
    );

    expect(result.ok).toBe(true);
    expect(result.shapes[0].w).toBe(100); // Original, not refined
  });
});
