# Stage 43 — Vector Workflow Dogfood Audit

## Assets tested

| Asset | Type | Shapes | Best Size | All-survive threshold |
|-------|------|--------|-----------|----------------------|
| Templar Knight | Humanoid | 25 | 32×48 | 32×32 (0 collapsed) |
| Iron Lantern | Prop | 19 | 32×32 | 32×32 (0 collapsed) |
| Dire Wolf | Creature | 27 | 48×48 | 32×48 (0 collapsed) |

## Size recommendations by asset type

**Humanoid characters → 32×48**
Tall aspect ratio matches body proportions. Cross on tabard, helm shape, and weapons all read clearly. Belt and visor details drop at 24×24 but identity survives.

**Props (compact objects) → 32×32**
Square aspect ratio suits symmetric objects. Flame, glass body, metal frame all distinguishable. 16×16 works for inventory icons where only silhouette matters.

**Creatures (organic, wide) → 48×48**
Organic forms need more pixels. At 32×32, wolf legs merge with body and tail loses arc. At 48×48, snout/ear silhouette reads as canine, legs separate from torso, tail arc visible.

## Where the vector master pipeline helped most

1. **Reduction-aware design** — marking shapes as must-survive/prefer-survive/droppable before rasterization forced deliberate design choices. The belt on the knight and the chain on the lantern were correctly identified as droppable detail early.

2. **Multi-size comparison** — seeing all 7 sizes side-by-side immediately showed where identity collapsed. The wolf at 16×16 is an unreadable blob; at 48×48 it's clearly a wolf. No guessing needed.

3. **Consistent rasterization** — same vector source, different sizes. No manual redrawing at each resolution. The knight at 32×48 and 64×64 are the same design, just with different detail survival.

4. **Silhouette-first design** — the vector workspace forced thinking in shapes and masses rather than pixels. Every shape has a name and a purpose.

## Where pixel cleanup was still necessary

1. **Single-pixel artifacts** — at small sizes, polygon edges sometimes leave orphan pixels or gaps. These need manual cleanup.

2. **Color palette reduction** — the rasterizer preserves all source colors. At 16×16, a 20-color palette is wasteful. Manual palette cleanup would be needed.

3. **Silhouette refinement** — the wolf's body at 32×32 needs manual adjustment where legs meet body. The polygon rasterization is correct but the read is ambiguous.

## Regeneration assessment

The regeneration pathway (vector → sprite → edit → re-rasterize from vector) is safe:
- Source link preserved through handoff
- Confirmation dialog prevents accidental data loss
- Re-rasterization produces consistent output
- Would be most useful when iterating on vector design and re-generating sprite at same size

## Polygon-only evidence summary

### No curve friction (geometric domains)
- **Humanoid armor** — flat helm, boxy pauldrons, rectangular weapons, straight cape drape
- **Metal/glass frames** — straight edges, angular joints
- **Ears** — triangles, zero curve need
- **Paws/boots** — rectangles

### Mild friction (organic forms)
- **Lantern flame** (7 points) — teardrop shape required careful point placement. A curve would be ~3 control points.
- **Lantern glass bulge** (8 points) — rounded rectangle approximation. Works at pixel scale but took more effort.

### Real friction (organic creatures)
- **Wolf body** (10 points) — arched back + belly curve. Editing requires moving 2-3 adjacent points per adjustment.
- **Wolf tail** (8 points) — S-curve approximation. Functional but tedious.
- **Wolf haunch** (6 points) — every organic muscle bulge doubles point count vs curves.
- **Wolf head** (8 points) — wedge with rounded transitions. Manageable but clunky to edit.

### Critical finding
**Pixel output is identical regardless of polygon vs curve authoring.** At sprite resolutions (16-64px), pixel-grid quantization erases the difference between polygon facets and smooth curves. The friction is exclusively in the design-time UX:
- Polygon organic shape: ~7 points average, careful placement, hard to adjust
- Curve equivalent: ~3-4 control points, intuitive handles, easy to adjust
- Authoring time impact: ~2× more effort for organic shapes with polygons

## Curves decision

**Quadratic curves next (Stage 44).**

Evidence-based reasoning:
1. Polygon-only **works** — it produces correct pixel output at all sizes tested
2. The friction is in **authoring comfort**, not in output quality
3. Organic forms (creatures, natural props) are a significant use case
4. The point count penalty compounds: a wolf at 27 shapes with polygon-only needs ~180 total points; with curves it would be ~90
5. Quadratic curves (single control point) are sufficient — no need for cubic Béziers
6. Quadratic curves are simple to implement: one control point per segment, de Casteljau evaluation, flatten to line segments for rasterization

What NOT to build:
- No cubic Béziers (quadratic is enough for game art at these scales)
- No path operations (union, intersect, subtract — premature)
- No smooth/auto-tangent tools (manual control points only)
- No pen tool with complex multi-segment paths (keep individual shapes)

Scope for Stage 44: add `QuadCurveGeometry` type, curve drawing tool, curve-to-polygon flattening for the rasterizer. Minimal viable curves.
