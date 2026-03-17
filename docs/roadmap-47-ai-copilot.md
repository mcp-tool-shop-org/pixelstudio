# Stage 47 Roadmap — Vision-Driven AI Art Copilot

## The Problem

The AI copilot has been an analyzer, not a creator. qwen2.5:14b generates
shape coordinates blind — it has never seen the canvas. The output looks
like graph paper geometry because it IS graph paper geometry.

## The Fix

**Vision-driven generate-critique-refine loop.**

The LLM generates shapes. The rasterizer renders them. The vision model
(llava:13b) looks at the result and says what's wrong. The text model
fixes what's wrong. Repeat until it's not embarrassing.

This is not a diffusion pipeline. We don't have SD/SDXL pulled. What we
have: qwen2.5:14b (text/reasoning), llava:13b (vision), moondream (fast
vision), and the existing rasterizer + proposal system. We use what we have.

## Available Models (RTX 5080, 16GB VRAM)

| Model | Size | Role |
|-------|------|------|
| qwen2.5:14b | 9GB | Shape generation, refinement, structured JSON |
| llava:13b | 8GB | Vision critique (sees rendered sprites) |
| moondream | 1.7GB | Fast vision (lightweight alternative) |
| phi4:14b | 9.1GB | Alternative reasoning model |

Note: qwen2.5:14b + moondream fit together in VRAM (10.7GB).
qwen2.5:14b + llava:13b do NOT fit simultaneously (17GB > 16GB).
So the loop must be sequential: unload one, load other. Ollama handles
this automatically but with model swap latency (~2-5s).

## Architecture

```
User types description
        │
        ▼
┌─────────────────┐
│  qwen2.5:14b    │  "Draw a hooded monk with staff"
│  Shape Generator │  → JSON shapes [{name, type, geometry, fill}]
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Rasterizer     │  vectorRasterize.ts
│  (existing)     │  → pixel buffer at 64×64
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  llava:13b      │  "What does this look like? What's broken?"
│  Vision Critique│  → "Body merges with robe, no arm separation,
└────────┬────────┘    staff barely visible, face is a blob"
         │
         ▼
┌─────────────────┐
│  qwen2.5:14b    │  "Fix these problems: [critique + suggestions]"
│  Shape Refiner  │  → Updated JSON shapes
└────────┬────────┘
         │
         ▼
    Render again → Critique again → Refine again
         │
         ▼ (after N rounds or user stops)
┌─────────────────┐
│  Proposal System│  proposalModel.ts (existing)
│  Accept/Reject  │  → Non-destructive layers
└─────────────────┘
```

## Roadmap (10 slices, commit-per-slice)

### 47A — Smarter Prompts (prompt engineering, no code changes)

The current prompt tells qwen "design shapes on a 500×500 artboard."
That's too abstract. New approach:

- **Region-based prompting**: Break character into regions (head, torso,
  arms, legs, weapon, accessory) and generate each region separately
- **Spatial anchoring**: Give the model a grid ("head should be in the
  top 20% of artboard, centered") instead of raw coordinates
- **Reference proportions**: Include body proportion ratios in the prompt
  (head = 15-20% of total height, shoulders = 40-60% of torso width)
- **Color palette**: Provide a palette in the prompt (primary, secondary,
  accent, skin, shadow) instead of letting LLM pick random RGB values
- **Few-shot examples**: Include 2-3 working shape definitions in the
  prompt so the model sees what good output looks like

Deliverable: Updated `buildCharacterPrompt()` with region anchoring,
proportion rules, palette guidance, and few-shot examples.

### 47B — Vision Critique Integration (wire llava into the loop)

The `critiqueRenderedSprite()` function exists but is NOT called from the
UI. The generate-critique-refine loop exists in `generateWithCritiqueLoop()`
but needs a proper rasterizer bridge.

- Wire `rasterizeVectorMaster()` as the rasterize function for the loop
- Build a temporary VectorMasterDocument from LLMShapeDefs for rasterization
- Call the critique loop from VectorAICreationPanel with progress logging
- Show critique feedback in the UI (what llava saw, what it said)
- Show before/after for each refinement round
- Default: 2 refinement rounds (generate → critique → refine → critique → refine)

Deliverable: AI Generate button runs the full loop. UI shows each step.

### 47C — Region-Based Generation (divide and conquer)

Instead of generating all shapes in one shot, break into passes:

1. **Silhouette pass**: Generate the overall outline (3-5 shapes for body mass)
2. **Detail pass**: Add identity cues (weapon, hood, wings) onto the silhouette
3. **Color pass**: Assign colors with contrast rules (light vs dark, warm vs cool)

Each pass sends the previous shapes as context. The LLM sees what exists
and adds to it, rather than inventing everything from nothing.

Deliverable: `generateShapesMultiPass()` function with 3-pass pipeline.

### 47D — Targeted Vision Critique (region-specific feedback)

Current critique is "what does this look like?" — too vague. New prompts:

- "Is the head distinct from the body? Can you see where one ends and
  the other begins?"
- "Are the arms visible and separated from the torso?"
- "Does the weapon/accessory read as a separate object?"
- "What is the strongest silhouette feature? What is the weakest?"
- "At this size, what would you guess this character is?"

Each critique targets a specific quality dimension. The refiner gets
actionable feedback, not just "it's a blob."

Deliverable: `critiqueByRegion()` with 4-5 targeted vision prompts.

### 47E — Collapse-Aware Refinement

After the vision loop, run the existing collapse overlay analysis on the
generated shapes. For any shape that would collapse at 16×16:

- Tell the text model which shapes collapse and at what sizes
- Ask it to thicken, merge, or simplify those specific shapes
- Re-rasterize and verify the fix

This connects the existing collapse system (which works well) to the
generation pipeline (which needs it).

Deliverable: Post-generation collapse analysis + auto-fix pass.

### 47F — Comparison View (before/after/multi-size)

When a generation completes, show:

- Side-by-side: AI-generated vs empty canvas (or vs previous version)
- Multi-size strip: 16×16, 32×32, 64×64 renders of the proposal
- Collapse overlay on the proposal (which shapes die at which sizes)

This uses the existing VectorLivePreview and collapse overlay, applied
to the proposal before it's accepted.

Deliverable: Proposal preview with multi-size rendering in the UI.

### 47G — Dogfood Round 1 (Shadow Monk redux)

Regenerate the Shadow Monk using the improved pipeline. Compare to:
- The hand-coded Stage 46 version (graph paper geometry)
- The blind qwen version (current bad output)

Success criteria: a stranger can look at the 32×32 render and say
"that's a robed figure with a staff" without being told.

Deliverable: Shadow Monk generated, rendered, compared, committed only
if it passes the quality gate.

### 47H — Dogfood Round 2 (all 3 assets)

Generate Magic Scroll and Flame Drake with the improved pipeline.
Log friction: where the loop fails, where it wastes time, where the
output is still bad.

Deliverable: 3 assets, honest quality assessment, friction log.

### 47I — Style Presets and Palette System

Add preset palettes and style guides to the prompt system:

- **Fantasy dark**: deep purples, blacks, gold accents, cyan highlights
- **Bright adventure**: saturated primaries, white highlights, dark outlines
- **Earth tones**: browns, greens, warm shadows, cream highlights

Also add character archetype templates:
- Humanoid (proportions, stance, limb separation rules)
- Creature (body mass, appendage rules, silhouette width)
- Prop/Item (aspect ratio, key feature emphasis, detail budget)

Deliverable: Preset system in the UI, 3+ palettes, 3 archetype templates.

### 47J — Quality Gate + Ship Assessment

Run final quality audit:
- Are the sprites visibly better than the hand-coded versions?
- Does the AI loop actually improve output vs single-shot generation?
- Is the workflow fast enough to be usable (< 60s per asset)?
- What still sucks?

Deliverable: Honest assessment. Only update the product README if the
output is genuinely good enough to show.

## Hard Rules

1. No new features unless an asset hits a blocker
2. Every slice gets its own commit + push
3. Tests ship with code
4. Only push output that isn't embarrassing
5. The AI must make the image better, not just talk about it

## Success Metric

A stranger looks at a 32×32 sprite and correctly identifies what it is
without being told. That's the bar. Everything else is implementation detail.
