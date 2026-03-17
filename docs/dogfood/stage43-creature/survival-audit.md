# Stage 43.3 — Dire Wolf: Survival Audit

Asset: Dire Wolf (creature / organic form)
Shapes: 27
Artboard: 500×500

## Reduction per profile

### 16×16
- Fill: 29.7%
- Survived: 20 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, chest-ruff, neck, head, head-hi, snout, nose, eye-white, ear-left, ear-left-inner, ear-right
- Collapsed: 7 — paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, mouth, eye-pupil, ear-right-inner

### 16×32
- Fill: 29.9%
- Survived: 24 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, chest-ruff, neck, head, head-hi, snout, nose, eye-white, ear-left, ear-left-inner, ear-right
- Collapsed: 3 — mouth, eye-pupil, ear-right-inner

### 24×24
- Fill: 26.2%
- Survived: 26 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, chest-ruff, neck, head, head-hi, snout, nose, eye-white, eye-pupil, ear-left, ear-left-inner, ear-right, ear-right-inner
- Collapsed: 1 — mouth

### 32×32
- Fill: 26.1%
- Survived: 26 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, chest-ruff, neck, head, head-hi, snout, nose, eye-white, eye-pupil, ear-left, ear-left-inner, ear-right, ear-right-inner
- Collapsed: 1 — mouth

### 32×48
- Fill: 25.1%
- Survived: 27 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, chest-ruff, neck, head, head-hi, snout, nose, mouth, eye-white, eye-pupil, ear-left, ear-left-inner, ear-right, ear-right-inner
- Collapsed: 0

### 48×48
- Fill: 22.7%
- Survived: 27 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, chest-ruff, neck, head, head-hi, snout, nose, mouth, eye-white, eye-pupil, ear-left, ear-left-inner, ear-right, ear-right-inner
- Collapsed: 0

### 64×64
- Fill: 23.2%
- Survived: 27 — tail, tail-hi, body, body-highlight, belly, hind-leg-back, hind-leg-front, haunch, front-leg-back, front-leg-front, paw-hind-back, paw-hind-front, paw-front-back, paw-front-front, chest-ruff, neck, head, head-hi, snout, nose, mouth, eye-white, eye-pupil, ear-left, ear-left-inner, ear-right, ear-right-inner
- Collapsed: 0

## Polygon complexity stats

- Total polygon shapes: 20
- Total polygon points across all shapes: 121
- Max points in a single polygon: 10
- Average points per polygon: 6.0

## Best size recommendation

**48×48** — organic form needs more pixels than geometric designs.
- Snout + ear silhouette reads clearly as canine
- Tail arc visible and distinct from body
- Four legs distinguishable
- 32×32 is usable but legs start merging with body
- 32×48 could work for a taller composition (standing wolf)

## Friction notes — POLYGON-ONLY STRESS TEST

### Where polygon-only worked fine:
1. **Ears** — triangles are natural polygons. Zero friction.
2. **Snout** — wedge shape is polygon-friendly. 6 points, easy to place.
3. **Legs** — rectangular-ish forms with slight taper. 7 points each, no issues.
4. **Paws** — rects. Trivial.
5. **Chest ruff** — angular fluffy shape works as polygon. Reads as fur at pixel scale.

### Where polygon-only showed friction:
1. **TAIL (8 points)** — The S-curve of a wolf tail required 8 polygon points to approximate. Each point needed careful placement to get the arc right. A quadratic curve would have needed 3-4 control points instead. The result at pixel scale is fine, but the authoring experience was noticeably harder.
2. **BODY SILHOUETTE (10 points)** — The arched back + belly curve needed 10 points to avoid visible faceting at artboard scale. At pixel scale (48×48), the faceting disappears. But editing 10 points to get a natural spine curve is tedious — a curve would be 4-5 control points.
3. **HAUNCH (6 points)** — The rounded muscle bulge needed 6 points. A curve would be 3 control points. Not terrible, but every organic bulge doubles the point count vs curves.
4. **HEAD (8 points)** — Wolf head is a complex wedge with rounded transitions. 8 points is manageable but every adjustment requires moving 2-3 adjacent points to maintain the curve feel.

### Key observation:
**The pixel output is identical.** At sprite scale (32-64px), there is no visible difference between a polygon approximation and what a curve would produce. The pain is entirely in the authoring/editing experience:
- Polygon: ~7 points average per organic shape, careful placement required
- Curve would be: ~3-4 control points, more intuitive to adjust
- Time impact: roughly 2× more effort to place polygon points for organic curves
- Edit impact: adjusting a polygon curve means moving multiple points; adjusting a curve control point is a single drag

## Polygon-only assessment

**Polygon-only is SUFFICIENT but not COMFORTABLE for organic forms.**

The output quality is identical — pixel-grid quantization erases the difference between polygon facets and smooth curves at any sprite resolution. The friction is purely in the design tool UX:
- Tail, body, haunch, and head each needed 2-3× more points than curves would require
- Editing organic forms means moving clusters of points rather than dragging smooth handles
- For a user designing many organic creatures, this friction compounds

**Verdict: Quadratic curves would improve the authoring experience for organic forms but are NOT required for output quality.** This is a comfort/speed issue, not a capability issue.