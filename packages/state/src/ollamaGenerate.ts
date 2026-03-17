/**
 * Ollama Shape Generation — LLM-driven vector shape proposals.
 *
 * Uses a text LLM (qwen2.5:14b) to generate actual shape definitions
 * as structured JSON, then converts them into ProposalActions.
 *
 * This is the "generative AI" side — the LLM draws, not just critiques.
 */

import type {
  VectorMasterDocument,
  VectorGeometry,
  VectorTransform,
  Rgba,
  SizeProfile,
} from '@glyphstudio/domain';
import { DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';
import type {
  Proposal,
  ProposalSet,
  ProposalAction,
  ProposedShape,
} from './proposalModel';
import { createProposal, createProposalSet } from './proposalModel';
import type { OllamaVisionConfig } from './copilotVision';
import { DEFAULT_OLLAMA_CONFIG, pixelBufferToBase64Png } from './copilotVision';
import type { SpritePixelBuffer } from '@glyphstudio/domain';

// ── Types ──

export interface OllamaGenerateConfig {
  /** Ollama API base URL. */
  baseUrl: string;
  /** Text model for shape generation. */
  textModel: string;
  /** Vision model for critique. */
  visionModel: string;
  /** Request timeout in ms. */
  timeoutMs: number;
}

export const DEFAULT_GENERATE_CONFIG: OllamaGenerateConfig = {
  baseUrl: 'http://localhost:11434',
  textModel: 'qwen2.5:14b',
  visionModel: 'llava:13b',
  timeoutMs: 60000,
};

/** Raw shape definition from LLM output. */
export interface LLMShapeDef {
  name: string;
  type: 'rect' | 'ellipse' | 'polygon' | 'path';
  fill: [number, number, number, number];
  mustSurvive?: boolean;
  // rect
  x?: number; y?: number; w?: number; h?: number;
  // ellipse
  cx?: number; cy?: number; rx?: number; ry?: number;
  // polygon / path
  points?: { x: number; y: number }[];
  closed?: boolean;
  segments?: { kind: 'line' | 'quadratic'; cpX?: number; cpY?: number }[];
}

/** Result from LLM shape generation. */
export interface GenerateResult {
  ok: boolean;
  shapes: LLMShapeDef[];
  reasoning: string;
  error: string | null;
  model: string;
  responseTimeMs: number;
}

/** Result from vision critique. */
export interface CritiqueResult {
  ok: boolean;
  critique: string;
  suggestions: string[];
  error: string | null;
  model: string;
  responseTimeMs: number;
}

// ── Prompt builders ──

function buildCharacterPrompt(
  description: string,
  artboardWidth: number,
  artboardHeight: number,
  targetSizes: number[],
  existingShapes?: string,
): string {
  return `You are a 2D sprite artist designing vector shapes for a pixel art character.

TASK: Design "${description}" as vector shapes on a ${artboardWidth}x${artboardHeight} artboard.

CRITICAL DESIGN RULES:
- This will be rendered as pixel art at these tiny sizes: ${targetSizes.join(', ')} pixels
- Every shape must be BIG ENOUGH to survive reduction to ${Math.min(...targetSizes)}x${Math.min(...targetSizes)}
- Minimum dimension for any shape: ${Math.round(artboardWidth * 0.04)}px (anything smaller vanishes)
- Use HIGH CONTRAST between adjacent shapes — dark next to light, warm next to cool
- SEPARATE FORMS clearly — arms away from torso, head distinct from body
- Silhouette must read instantly — a stranger should recognize what this is from the outline alone
- Use 10-20 shapes total. More than 20 is too complex.
- Center the character in the artboard with padding on all sides

SHAPE TYPES AVAILABLE:
- rect: { type: "rect", x, y, w, h } — rectangles
- ellipse: { type: "ellipse", cx, cy, rx, ry } — ovals
- polygon: { type: "polygon", points: [{x,y}...], closed: true } — closed shapes (3+ points)
- path: { type: "path", points: [{x,y}...], closed: true/false, segments: [{kind:"line"} or {kind:"quadratic",cpX,cpY}] } — curves

FILL FORMAT: [R, G, B, A] where each is 0-255

GOOD SPRITE DESIGN:
- Wide shoulders/hips for humanoids (breaks the "rectangle" read)
- Exaggerated key features (big head, big weapon, distinctive silhouette)
- Color contrast between body parts (dark body, light face/hands, colored accessories)
- Negative space between limbs and body
- Identity cues (hood, wings, horns, weapon) must be LARGE, not tiny details

${existingShapes ? `CURRENT SHAPES (improve these, don't start from scratch):\n${existingShapes}\n` : ''}

OUTPUT FORMAT: Return ONLY valid JSON, no markdown, no explanation outside the JSON.
{
  "reasoning": "Brief explanation of design choices",
  "shapes": [
    {
      "name": "shape-name",
      "type": "rect|ellipse|polygon|path",
      "fill": [R, G, B, A],
      "mustSurvive": true/false,
      ...type-specific fields
    }
  ]
}`;
}

function buildCritiquePrompt(): string {
  return `You are a pixel art quality critic reviewing a sprite.

Look at this sprite and answer:
1. What does this look like? Can you identify it instantly?
2. Is the silhouette clear and distinct, or is it a blob?
3. Which body parts or features are readable? Which merge together?
4. What specific changes would make it read better at small size?

Be brutally honest. Focus on FORM SEPARATION and SILHOUETTE READABILITY.
Give exactly 3-5 concrete suggestions as a JSON array.

OUTPUT FORMAT: Return ONLY valid JSON.
{
  "critique": "What this reads as and overall assessment",
  "suggestions": [
    "Specific change 1",
    "Specific change 2",
    "Specific change 3"
  ]
}`;
}

function buildRefinePrompt(
  description: string,
  artboardWidth: number,
  artboardHeight: number,
  targetSizes: number[],
  currentShapesJson: string,
  critique: string,
  suggestions: string[],
): string {
  return `You are a 2D sprite artist refining vector shapes based on critique feedback.

ORIGINAL DESIGN: "${description}" on ${artboardWidth}x${artboardHeight} artboard.
TARGET SIZES: ${targetSizes.join(', ')} pixels

CURRENT SHAPES:
${currentShapesJson}

CRITIQUE: ${critique}

SPECIFIC FIXES NEEDED:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

Apply these fixes. Return the COMPLETE updated shape list (not just changes).
Keep shapes that work, fix shapes that don't, add/remove shapes as needed.
Remember: minimum dimension ${Math.round(artboardWidth * 0.04)}px for survival at ${Math.min(...targetSizes)}px.

OUTPUT FORMAT: Return ONLY valid JSON, no markdown.
{
  "reasoning": "What you changed and why",
  "shapes": [ ...complete shape list... ]
}`;
}

// ── Ollama API calls ──

async function callOllamaText(
  prompt: string,
  config: OllamaGenerateConfig,
): Promise<{ ok: boolean; response: string; error: string | null; timeMs: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    const res = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.textModel,
        prompt,
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 4096,
        },
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, response: '', error: `Ollama ${res.status}: ${text.slice(0, 200)}`, timeMs: Date.now() - start };
    }

    const json = await res.json();
    return { ok: true, response: json.response?.trim() ?? '', error: null, timeMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      response: '',
      error: msg.includes('abort') ? `Timed out after ${config.timeoutMs}ms` : `Connection failed: ${msg}`,
      timeMs: Date.now() - start,
    };
  }
}

async function callOllamaVision(
  prompt: string,
  imageBase64: string,
  config: OllamaGenerateConfig,
): Promise<{ ok: boolean; response: string; error: string | null; timeMs: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

    const res = await fetch(`${config.baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: config.visionModel,
        prompt,
        images: [imageBase64],
        stream: false,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!res.ok) {
      const text = await res.text();
      return { ok: false, response: '', error: `Ollama ${res.status}: ${text.slice(0, 200)}`, timeMs: Date.now() - start };
    }

    const json = await res.json();
    return { ok: true, response: json.response?.trim() ?? '', error: null, timeMs: Date.now() - start };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    return {
      ok: false,
      response: '',
      error: msg.includes('abort') ? `Timed out after ${config.timeoutMs}ms` : `Connection failed: ${msg}`,
      timeMs: Date.now() - start,
    };
  }
}

// ── JSON extraction ──

/** Extract JSON from LLM response (handles markdown fences, preamble, etc.) */
function extractJson(raw: string): string | null {
  // Try direct parse first
  try { JSON.parse(raw); return raw; } catch { /* continue */ }

  // Try markdown fence
  const fenceMatch = raw.match(/```(?:json)?\s*\n?([\s\S]*?)```/);
  if (fenceMatch) {
    try { JSON.parse(fenceMatch[1].trim()); return fenceMatch[1].trim(); } catch { /* continue */ }
  }

  // Try finding first { to last }
  const firstBrace = raw.indexOf('{');
  const lastBrace = raw.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    const candidate = raw.slice(firstBrace, lastBrace + 1);
    try { JSON.parse(candidate); return candidate; } catch { /* continue */ }
  }

  return null;
}

// ── Shape validation ──

function validateShapeDef(s: LLMShapeDef, artW: number, artH: number): LLMShapeDef | null {
  if (!s.name || !s.type || !s.fill || s.fill.length !== 4) return null;

  // Clamp fill values
  s.fill = s.fill.map(v => Math.max(0, Math.min(255, Math.round(v)))) as [number, number, number, number];

  switch (s.type) {
    case 'rect':
      if (s.x == null || s.y == null || s.w == null || s.h == null) return null;
      if (s.w < 2 || s.h < 2) return null; // Too small to matter
      // Clamp to artboard
      s.x = Math.max(0, Math.min(artW - s.w, s.x));
      s.y = Math.max(0, Math.min(artH - s.h, s.y));
      return s;

    case 'ellipse':
      if (s.cx == null || s.cy == null || s.rx == null || s.ry == null) return null;
      if (s.rx < 2 || s.ry < 2) return null;
      return s;

    case 'polygon':
      if (!s.points || s.points.length < 3) return null;
      s.closed = true;
      return s;

    case 'path':
      if (!s.points || s.points.length < 2) return null;
      // Default segments to lines if not provided
      if (!s.segments) {
        s.segments = s.points.slice(0, -1).map(() => ({ kind: 'line' as const }));
      }
      return s;

    default:
      return null;
  }
}

/** Convert validated LLMShapeDef to VectorGeometry. */
function shapeDefToGeometry(s: LLMShapeDef): VectorGeometry {
  switch (s.type) {
    case 'rect':
      return { kind: 'rect', x: s.x!, y: s.y!, w: s.w!, h: s.h! };
    case 'ellipse':
      return { kind: 'ellipse', cx: s.cx!, cy: s.cy!, rx: s.rx!, ry: s.ry! };
    case 'polygon':
      return { kind: 'polygon', points: s.points! };
    case 'path': {
      const pathPoints = s.points!.map(p => ({ x: p.x, y: p.y, pointType: 'corner' as const }));
      const pathSegments = (s.segments ?? s.points!.slice(0, -1).map(() => ({ kind: 'line' as const })))
        .map(seg => {
          if (seg.kind === 'quadratic' && seg.cpX != null && seg.cpY != null) {
            return { kind: 'quadratic' as const, cpX: seg.cpX, cpY: seg.cpY };
          }
          return { kind: 'line' as const };
        });
      return {
        kind: 'path',
        points: pathPoints,
        segments: pathSegments,
        closed: s.closed ?? false,
      };
    }
  }
}

/** Convert validated LLMShapeDefs to ProposalActions (all 'add' type). */
function shapeDefsToProposalActions(shapes: LLMShapeDef[]): ProposalAction[] {
  return shapes.map((s, i) => {
    const proposed: ProposedShape = {
      tempId: `llm_${Date.now()}_${i}`,
      name: s.name,
      geometry: shapeDefToGeometry(s),
      fill: s.fill as Rgba,
      stroke: null,
      transform: { ...DEFAULT_VECTOR_TRANSFORM },
      reduction: {
        ...DEFAULT_REDUCTION_META,
        ...(s.mustSurvive ? { survivalHint: 'must-survive' as const, cueTag: s.name } : {}),
      },
    };
    return { type: 'add' as const, shape: proposed };
  });
}

/** Serialize existing doc shapes to a compact string for LLM context. */
function serializeDocShapes(doc: VectorMasterDocument): string {
  return JSON.stringify(
    doc.shapes.filter(s => s.visible).map(s => ({
      name: s.name,
      type: s.geometry.kind,
      ...s.geometry,
      fill: s.fill,
      mustSurvive: s.reduction.survivalHint === 'must-survive',
    })),
    null,
    2,
  );
}

// ── Public API ──

/**
 * Generate vector shapes from a text description using Ollama.
 *
 * Sends a structured prompt to the text LLM asking it to design
 * shapes for a character/prop/creature. Returns ProposalActions.
 */
export async function generateShapesFromDescription(
  description: string,
  artboardWidth: number,
  artboardHeight: number,
  targetSizes: number[],
  existingDoc?: VectorMasterDocument,
  config: OllamaGenerateConfig = DEFAULT_GENERATE_CONFIG,
): Promise<GenerateResult> {
  const existingShapes = existingDoc ? serializeDocShapes(existingDoc) : undefined;

  const prompt = buildCharacterPrompt(
    description,
    artboardWidth,
    artboardHeight,
    targetSizes,
    existingShapes,
  );

  const result = await callOllamaText(prompt, config);
  if (!result.ok) {
    return { ok: false, shapes: [], reasoning: '', error: result.error, model: config.textModel, responseTimeMs: result.timeMs };
  }

  const jsonStr = extractJson(result.response);
  if (!jsonStr) {
    return { ok: false, shapes: [], reasoning: '', error: 'Failed to parse JSON from LLM response', model: config.textModel, responseTimeMs: result.timeMs };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const rawShapes: LLMShapeDef[] = parsed.shapes ?? [];
    const validated = rawShapes
      .map(s => validateShapeDef(s, artboardWidth, artboardHeight))
      .filter((s): s is LLMShapeDef => s !== null);

    return {
      ok: true,
      shapes: validated,
      reasoning: parsed.reasoning ?? '',
      error: null,
      model: config.textModel,
      responseTimeMs: result.timeMs,
    };
  } catch {
    return { ok: false, shapes: [], reasoning: '', error: 'JSON parse failed', model: config.textModel, responseTimeMs: result.timeMs };
  }
}

/**
 * Send a rendered sprite to the vision model for critique.
 *
 * Returns structured feedback with concrete suggestions.
 */
export async function critiqueRenderedSprite(
  pixelBuffer: SpritePixelBuffer,
  config: OllamaGenerateConfig = DEFAULT_GENERATE_CONFIG,
): Promise<CritiqueResult> {
  const base64 = pixelBufferToBase64Png(pixelBuffer);
  const prompt = buildCritiquePrompt();

  const result = await callOllamaVision(prompt, base64, config);
  if (!result.ok) {
    return { ok: false, critique: '', suggestions: [], error: result.error, model: config.visionModel, responseTimeMs: result.timeMs };
  }

  const jsonStr = extractJson(result.response);
  if (!jsonStr) {
    // Fall back to treating the whole response as plain text critique
    return {
      ok: true,
      critique: result.response,
      suggestions: [],
      error: null,
      model: config.visionModel,
      responseTimeMs: result.timeMs,
    };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    return {
      ok: true,
      critique: parsed.critique ?? result.response,
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
      error: null,
      model: config.visionModel,
      responseTimeMs: result.timeMs,
    };
  } catch {
    return { ok: true, critique: result.response, suggestions: [], error: null, model: config.visionModel, responseTimeMs: result.timeMs };
  }
}

/**
 * Refine shapes based on vision critique.
 *
 * Takes the current shapes + critique feedback and asks the text LLM
 * to produce an improved version.
 */
export async function refineShapesFromCritique(
  description: string,
  artboardWidth: number,
  artboardHeight: number,
  targetSizes: number[],
  currentShapes: LLMShapeDef[],
  critique: string,
  suggestions: string[],
  config: OllamaGenerateConfig = DEFAULT_GENERATE_CONFIG,
): Promise<GenerateResult> {
  const prompt = buildRefinePrompt(
    description,
    artboardWidth,
    artboardHeight,
    targetSizes,
    JSON.stringify(currentShapes, null, 2),
    critique,
    suggestions,
  );

  const result = await callOllamaText(prompt, config);
  if (!result.ok) {
    return { ok: false, shapes: [], reasoning: '', error: result.error, model: config.textModel, responseTimeMs: result.timeMs };
  }

  const jsonStr = extractJson(result.response);
  if (!jsonStr) {
    return { ok: false, shapes: [], reasoning: '', error: 'Failed to parse JSON from LLM refinement response', model: config.textModel, responseTimeMs: result.timeMs };
  }

  try {
    const parsed = JSON.parse(jsonStr);
    const rawShapes: LLMShapeDef[] = parsed.shapes ?? [];
    const validated = rawShapes
      .map(s => validateShapeDef(s, artboardWidth, artboardHeight))
      .filter((s): s is LLMShapeDef => s !== null);

    return {
      ok: true,
      shapes: validated,
      reasoning: parsed.reasoning ?? '',
      error: null,
      model: config.textModel,
      responseTimeMs: result.timeMs,
    };
  } catch {
    return { ok: false, shapes: [], reasoning: '', error: 'JSON parse failed', model: config.textModel, responseTimeMs: result.timeMs };
  }
}

/**
 * Convert LLM-generated shapes into a Proposal + ProposalSet
 * ready for the accept/reject/duplicate workflow.
 */
export function shapesToProposalSet(
  shapes: LLMShapeDef[],
  reasoning: string,
  description: string,
): { set: ProposalSet; proposals: Proposal[] } {
  const set = createProposalSet('silhouette-variant', `AI: ${description}`, description);
  const actions = shapeDefsToProposalActions(shapes);

  const proposal = createProposal(
    set.id,
    'silhouette-variant',
    `AI-generated: ${description}`,
    reasoning || 'Generated by Ollama text model from description.',
    actions,
    { priority: 0 },
  );

  return { set, proposals: [proposal] };
}

/**
 * Full generate-critique-refine loop.
 *
 * 1. Generate shapes from description
 * 2. Rasterize and send to vision model for critique
 * 3. Refine based on critique
 * 4. Return final shapes as proposals
 *
 * The rasterizeFn is injected to avoid circular dependency with vectorRasterize.
 */
export async function generateWithCritiqueLoop(
  description: string,
  artboardWidth: number,
  artboardHeight: number,
  targetSizes: number[],
  rasterizeFn: (shapes: LLMShapeDef[], w: number, h: number) => SpritePixelBuffer,
  config: OllamaGenerateConfig = DEFAULT_GENERATE_CONFIG,
  maxRefinements: number = 1,
): Promise<{
  ok: boolean;
  shapes: LLMShapeDef[];
  reasoning: string;
  critiques: CritiqueResult[];
  error: string | null;
}> {
  // Step 1: Generate
  const initial = await generateShapesFromDescription(
    description,
    artboardWidth,
    artboardHeight,
    targetSizes,
    undefined,
    config,
  );

  if (!initial.ok || initial.shapes.length === 0) {
    return { ok: false, shapes: [], reasoning: '', critiques: [], error: initial.error ?? 'No shapes generated' };
  }

  let currentShapes = initial.shapes;
  let currentReasoning = initial.reasoning;
  const critiques: CritiqueResult[] = [];

  for (let i = 0; i < maxRefinements; i++) {
    // Step 2: Rasterize and critique
    const critiqueSize = Math.max(64, ...targetSizes);
    const buf = rasterizeFn(currentShapes, critiqueSize, critiqueSize);
    const critique = await critiqueRenderedSprite(buf, config);
    critiques.push(critique);

    if (!critique.ok || critique.suggestions.length === 0) break;

    // Step 3: Refine
    const refined = await refineShapesFromCritique(
      description,
      artboardWidth,
      artboardHeight,
      targetSizes,
      currentShapes,
      critique.critique,
      critique.suggestions,
      config,
    );

    if (refined.ok && refined.shapes.length > 0) {
      currentShapes = refined.shapes;
      currentReasoning = refined.reasoning;
    } else {
      break; // Refinement failed, keep current shapes
    }
  }

  return {
    ok: true,
    shapes: currentShapes,
    reasoning: currentReasoning,
    critiques,
    error: null,
  };
}
