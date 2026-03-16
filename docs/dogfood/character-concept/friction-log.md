# Stage 39.5.1 — Character Concept Dogfood
## Target: Front-facing ranger/scout, 500×500
## Target read: "Alert scout, ready to move"

### What worked
- Silhouette variations (A/B/C) were genuinely useful — B was clearly best
  because the asymmetry and visible gear gave the strongest read
- Sketch layer opacity (~60%) makes rough marks feel disposable
- Working at 500×500 gives room to think about proportions
- Snapshot before refinement provides a safety net
- Outline pass on the normal layer adds crispness the sketch lacks

### What fought back
- FRICTION: No way to import actual reference images programmatically
  (the Reference Panel is GUI-only — no MCP/API equivalent)
- FRICTION: Sketch brush scatter is a frontend-only concept; programmatic
  scripts have to reimplement the dab expansion manually
- FRICTION: Silhouette mode is a canvas overlay toggle, not a compositing
  function available to scripts (had to reimplement silhouetteBuffer)
- FRICTION: Snapshot store is Zustand — can't be used outside React context
  in a script; had to simulate with buffer cloning
- OBSERVATION: The rough → refined transition worked because we could see
  the sketch under the normal layer. That composite view is important.
- OBSERVATION: 3 silhouette variations is the right number. Two isn't enough
  to see what's working. Four starts burning time.

### Decisions for next stage
- The pre-production tools work for design exploration
- Need programmatic access to reference, silhouette, snapshot for MCP/scripts
- The sketch → normal layer handoff is the most important UX moment
