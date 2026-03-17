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

/** Palette presets for consistent color schemes. */
export interface ColorPalette {
  name: string;
  primary: [number, number, number, number];
  secondary: [number, number, number, number];
  accent: [number, number, number, number];
  skin: [number, number, number, number];
  shadow: [number, number, number, number];
  highlight: [number, number, number, number];
}

export const PALETTES: Record<string, ColorPalette> = {
  'fantasy-dark': {
    name: 'Fantasy Dark',
    primary: [40, 30, 60, 255],
    secondary: [70, 50, 90, 255],
    accent: [220, 180, 50, 255],
    skin: [200, 160, 130, 255],
    shadow: [20, 15, 30, 255],
    highlight: [100, 200, 220, 255],
  },
  'bright-adventure': {
    name: 'Bright Adventure',
    primary: [50, 80, 160, 255],
    secondary: [180, 60, 50, 255],
    accent: [240, 200, 40, 255],
    skin: [220, 180, 150, 255],
    shadow: [30, 40, 60, 255],
    highlight: [255, 255, 240, 255],
  },
  'earth-tones': {
    name: 'Earth Tones',
    primary: [90, 65, 45, 255],
    secondary: [60, 90, 50, 255],
    accent: [180, 140, 60, 255],
    skin: [210, 175, 140, 255],
    shadow: [40, 30, 25, 255],
    highlight: [240, 225, 200, 255],
  },
  'fire-creature': {
    name: 'Fire Creature',
    primary: [120, 30, 20, 255],
    secondary: [180, 60, 20, 255],
    accent: [255, 180, 30, 255],
    skin: [200, 100, 50, 255],
    shadow: [50, 15, 10, 255],
    highlight: [255, 220, 100, 255],
  },
};

function paletteToPrompt(palette: ColorPalette): string {
  const fmt = (c: number[]) => `[${c.join(',')}]`;
  return `COLOR PALETTE (use these colors, do NOT invent random colors):
- Primary (body/main mass): ${fmt(palette.primary)}
- Secondary (clothing/armor/scales): ${fmt(palette.secondary)}
- Accent (weapon/magic/eyes/important details): ${fmt(palette.accent)}
- Skin/Light areas (face/hands/belly): ${fmt(palette.skin)}
- Shadow (dark sides/under areas): ${fmt(palette.shadow)}
- Highlight (glow/rim light/tips): ${fmt(palette.highlight)}`;
}

/** Few-shot example of a good sprite (knight with sword). */
const FEW_SHOT_EXAMPLE = `EXAMPLE of a GOOD sprite (knight with sword, 12 shapes):
{"shapes":[
  {"name":"body","type":"rect","x":190,"y":180,"w":120,"h":180,"fill":[50,80,160,255],"mustSurvive":true},
  {"name":"head","type":"ellipse","cx":250,"cy":150,"rx":50,"ry":45,"fill":[220,180,150,255],"mustSurvive":true},
  {"name":"helmet","type":"polygon","points":[{"x":200,"y":130},{"x":250,"y":80},{"x":300,"y":130}],"fill":[160,160,170,255],"mustSurvive":true},
  {"name":"left-shoulder","type":"ellipse","cx":175,"cy":200,"rx":35,"ry":25,"fill":[60,90,170,255]},
  {"name":"right-shoulder","type":"ellipse","cx":325,"cy":200,"rx":35,"ry":25,"fill":[60,90,170,255]},
  {"name":"left-arm","type":"rect","x":150,"y":220,"w":30,"h":100,"fill":[50,70,150,255]},
  {"name":"right-arm","type":"rect","x":320,"y":220,"w":30,"h":100,"fill":[50,70,150,255]},
  {"name":"sword","type":"rect","x":355,"y":120,"w":16,"h":200,"fill":[200,200,210,255],"mustSurvive":true},
  {"name":"sword-hilt","type":"rect","x":340,"y":300,"w":46,"h":20,"fill":[180,140,60,255]},
  {"name":"belt","type":"rect","x":190,"y":280,"w":120,"h":20,"fill":[180,140,60,255]},
  {"name":"left-leg","type":"rect","x":195,"y":360,"w":45,"h":100,"fill":[40,60,130,255]},
  {"name":"right-leg","type":"rect","x":260,"y":360,"w":45,"h":100,"fill":[40,60,130,255]}
]}
Notice: head is ABOVE body, shoulders WIDER than body, arms SEPARATED from torso with gaps, legs SEPARATED from each other, sword is to the RIGHT side away from body, colors have HIGH CONTRAST (light head vs dark body, gold belt vs blue armor).`;

function buildCharacterPrompt(
  description: string,
  artboardWidth: number,
  artboardHeight: number,
  targetSizes: number[],
  existingShapes?: string,
  palette?: ColorPalette,
): string {
  const w = artboardWidth;
  const h = artboardHeight;
  const minTarget = Math.min(...targetSizes);
  const minDim = Math.round(w * 0.06); // 6% = survives at 16px (gives ~1-2px)

  // Spatial grid regions
  const grid = `SPATIAL LAYOUT GRID (${w}x${h} artboard):
- Top zone (head/hat): y = ${Math.round(h*0.05)} to ${Math.round(h*0.30)}
- Upper zone (shoulders/chest): y = ${Math.round(h*0.25)} to ${Math.round(h*0.45)}
- Middle zone (torso/arms): y = ${Math.round(h*0.40)} to ${Math.round(h*0.65)}
- Lower zone (waist/hips): y = ${Math.round(h*0.60)} to ${Math.round(h*0.75)}
- Bottom zone (legs/feet): y = ${Math.round(h*0.70)} to ${Math.round(h*0.95)}
- Center x = ${Math.round(w*0.5)}, character should span x = ${Math.round(w*0.25)} to ${Math.round(w*0.75)}
- Weapon/accessory: offset to LEFT or RIGHT side (x < ${Math.round(w*0.25)} or x > ${Math.round(w*0.75)})`;

  const proportions = `PROPORTION RULES:
- Head: ${Math.round(h*0.15)}-${Math.round(h*0.20)}px tall (15-20% of height) — LARGE head reads well small
- Shoulders: ${Math.round(w*0.25)}-${Math.round(w*0.35)}px wide (wider than head!)
- Body width: ${Math.round(w*0.20)}-${Math.round(w*0.28)}px
- Arms: MUST have ${Math.round(w*0.03)}-${Math.round(w*0.06)}px GAP between arm and body
- Legs: MUST have ${Math.round(w*0.02)}-${Math.round(w*0.04)}px GAP between legs
- Total height: ${Math.round(h*0.60)}-${Math.round(h*0.85)}px (leave padding top and bottom)`;

  const overlap = `OVERLAP RULES (CRITICAL):
- Shapes that represent different body parts must NOT overlap
- Arms must be NEXT TO the body, not ON TOP of it
- Head sits ABOVE the body, not inside it
- If two shapes share the same area, they will merge visually — this is BAD
- Weapon/staff should be BESIDE the character, not behind it
- EXCEPTION: shadow/highlight shapes CAN overlap their parent (for shading)`;

  const paletteSection = palette
    ? paletteToPrompt(palette)
    : `COLOR RULES:
- Adjacent shapes must have contrast > 80 in at least one RGB channel
- Body parts: use dark values (30-80)
- Skin/face: use light values (150-220)
- Accessories: use saturated accent colors (one channel > 180)
- Do NOT make everything the same color — this creates a blob`;

  return `You are a 2D pixel art sprite designer. You output vector shapes as JSON.

TASK: Design "${description}" on a ${w}x${h} artboard.
Target render sizes: ${targetSizes.join('x, ')}x pixels. Must read clearly at ${minTarget}x${minTarget}.

${grid}

${proportions}

${overlap}

${paletteSection}

SHAPE TYPES (use rect and ellipse primarily, polygon for pointed shapes):
- rect: {"type":"rect","x":N,"y":N,"w":N,"h":N} — body, limbs, weapons
- ellipse: {"type":"ellipse","cx":N,"cy":N,"rx":N,"ry":N} — heads, shoulders, shields
- polygon: {"type":"polygon","points":[{"x":N,"y":N}...],"closed":true} — hats, wings, tails (3-6 points)

FILL: [R,G,B,255] — always full opacity

SIZE RULES:
- Minimum width or height for ANY shape: ${minDim}px
- Shapes smaller than ${minDim}px will vanish at ${minTarget}x${minTarget} — do not create them

${FEW_SHOT_EXAMPLE}

${existingShapes ? `CURRENT SHAPES TO IMPROVE (keep what works, fix what doesn't):\n${existingShapes}\n` : ''}
RETURN ONLY valid JSON. No markdown fences. No explanation outside the JSON object.
{"reasoning":"...","shapes":[...]}`;
}

function buildCritiquePrompt(): string {
  return `You are a pixel art critic. This is a small sprite upscaled for visibility.

Answer these questions:
1. IDENTITY: What does this look like? If you saw this at 32x32 pixels, what would you guess it is?
2. SILHOUETTE: Is the outline distinctive, or could it be anything? What makes it recognizable (or not)?
3. FORM SEPARATION: Which body parts are clearly distinct? Which merge into a blob?
4. COLOR: Is there enough contrast between adjacent areas? Can you distinguish the parts?
5. FIXES: What 3-5 specific changes would most improve readability?

Be specific: say "widen the gap between arms and torso" not "improve separation."
Say "the head is too small relative to body" not "proportions need work."

RETURN ONLY valid JSON. No markdown.
{"critique":"One sentence: what this reads as","silhouette":"good/weak/blob","formSeparation":"which parts merge","suggestions":["Fix 1","Fix 2","Fix 3"]}`;
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
  const w = artboardWidth;
  const h = artboardHeight;
  const minDim = Math.round(w * 0.06);

  return `You are refining a sprite based on visual critique.

DESIGN: "${description}" on ${w}x${h} artboard. Renders at ${targetSizes.join(', ')}px.

CURRENT SHAPES:
${currentShapesJson}

WHAT THE VISION MODEL SAW WRONG:
${critique}

SPECIFIC FIXES TO APPLY:
${suggestions.map((s, i) => `${i + 1}. ${s}`).join('\n')}

HOW TO FIX:
- If shapes "merge" or "blob together": MOVE them apart (increase gap by ${Math.round(w * 0.04)}px+)
- If something is "too small": increase its w/h by 50% minimum
- If "no contrast": change one shape's fill — make dark shapes lighter or vice versa
- If "can't identify": make the key identity feature (weapon/wings/hood) BIGGER and more offset
- Do NOT shrink anything. Only enlarge, move apart, or recolor.
- Minimum shape dimension: ${minDim}px

Return the COMPLETE updated shape list. Every shape, even unchanged ones.
RETURN ONLY valid JSON. No markdown.
{"reasoning":"What changed","shapes":[...all shapes...]}`;
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
  palette?: ColorPalette,
): Promise<GenerateResult> {
  const existingShapes = existingDoc ? serializeDocShapes(existingDoc) : undefined;

  const prompt = buildCharacterPrompt(
    description,
    artboardWidth,
    artboardHeight,
    targetSizes,
    existingShapes,
    palette,
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
  maxRefinements: number = 2,
  palette?: ColorPalette,
  onProgress?: (step: string) => void,
): Promise<{
  ok: boolean;
  shapes: LLMShapeDef[];
  reasoning: string;
  critiques: CritiqueResult[];
  error: string | null;
}> {
  // Step 1: Generate
  onProgress?.('Generating initial shapes...');
  const initial = await generateShapesFromDescription(
    description,
    artboardWidth,
    artboardHeight,
    targetSizes,
    undefined,
    config,
    palette,
  );

  if (!initial.ok || initial.shapes.length === 0) {
    return { ok: false, shapes: [], reasoning: '', critiques: [], error: initial.error ?? 'No shapes generated' };
  }

  let currentShapes = initial.shapes;
  let currentReasoning = initial.reasoning;
  const critiques: CritiqueResult[] = [];

  for (let i = 0; i < maxRefinements; i++) {
    // Step 2: Rasterize and critique
    onProgress?.(`Round ${i + 1}: sending to vision model for critique...`);
    const critiqueSize = Math.max(64, ...targetSizes);
    const buf = rasterizeFn(currentShapes, critiqueSize, critiqueSize);
    const critique = await critiqueRenderedSprite(buf, config);
    critiques.push(critique);

    if (!critique.ok || critique.suggestions.length === 0) {
      onProgress?.(`Round ${i + 1}: critique returned no suggestions, stopping`);
      break;
    }

    onProgress?.(`Round ${i + 1}: critique says "${critique.critique?.slice(0, 80)}..."`);
    onProgress?.(`Round ${i + 1}: refining shapes based on ${critique.suggestions.length} suggestions...`);

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
