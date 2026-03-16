# Stage 39.5.3 — Friction Audit

## Summary
Two design studies at 500×500: ranger/scout character + treasure chest prop.
Both used the full pre-production workflow from Stage 39.

## What the workflow got right

### 3-silhouette comparison works
- Generating 3 variations then picking the strongest is the right number
- Silhouette B won both times because it had the most distinct read
- Character: asymmetry + visible gear beat symmetric stance and action pose
- Prop: open lid + glow beat closed box and angled view
- **Verdict: keep this as a workflow recommendation**

### Sketch layers make rough work disposable
- Amber-tinted sketch marks at 60% opacity feel clearly temporary
- The type-level exclusion from export compositing is correct
- Sketch layer → normal layer transition is the key creative moment
- **Verdict: solid as built**

### 500×500 is the right design resolution
- Room to think about proportions, material, detail
- The ranger has visible face features, belt buckle, quiver arrows
- The chest has rivets, gem setting, wood grain, red lining
- None of this would survive at 48×48 — that's a different problem for later
- **Verdict: enforce 500×500 minimum for design phase**

### Snapshots provide safety
- Snapshot before refinement = free to experiment on normal layer
- The diff stats (added/removed/refined) quantify how much changed
- **Verdict: working as designed**

## What fought back

### REPEATED: No programmatic reference image support
- Reference Panel is GUI-only (file picker + convertFileSrc)
- Scripts and MCP server can't load reference images
- For programmatic dogfood, had to skip this step entirely
- **Impact: medium — blocks automated workflow testing**
- **Fix: add MCP tool for reference import (stretch goal)**

### REPEATED: Silhouette is a canvas overlay, not a compositing API
- silhouetteBuffer() exists in spriteRaster.ts but the canvas toggle
  is a render-time overlay, not accessible to scripts
- Had to reimplement silhouette generation in each dogfood script
- **Impact: low — the function exists, just not exposed conveniently**
- **Fix: already exported from state package, scripts can import it**

### REPEATED: Snapshot store is Zustand (React-only context)
- Can't use useSnapshotStore outside a React component
- Had to simulate snapshots with manual buffer cloning
- **Impact: low for real app usage, medium for scripted testing**
- **Fix: none needed — real users use the GUI**

### NEW: No gradient/radial fill primitive
- Treasure chest glow required layered concentric ellipses
- Character had no lighting pass because there's no gradient tool
- **Impact: medium — glow/lighting is a common design need**
- **Fix: future stage, not urgent**

### NEW: Alpha blending requires explicit composite
- Simple px() overwrite can't layer translucent glow naturally
- Had to add inline alpha blending for the prop script
- **Impact: low — the app's canvas renderer handles this via Rust**
- **Fix: none needed — this is a script limitation, not an app limitation**

## Workflow verdict

The pre-production loop works:
```
reference → sketch layer → rough block-in → silhouette check →
snapshot → compare → refine on normal layer → export
```

The tools are real. The silhouette step actually changes decisions.
The sketch → normal handoff is the moment where quality appears.

## What the next phase needs

The correct next step is **design-to-sprite translation**:
- Take a strong 500×500 concept and reduce it to game resolution (32×32, 48×48, 64×64)
- This is reinterpretation, not downscaling — the small sprite should
  capture the READ of the design, not be a blurry thumbnail
- Key question: can the silhouette survive at tiny resolution?
- Key question: which details translate and which must be dropped?

### Not needed yet
- Advanced brush settings (texture, smoothing, pressure curves)
- Gradient fill tool (nice to have, not blocking)
- MCP reference import (real users use the GUI)
- Brush preset system (one good rough brush is enough)
