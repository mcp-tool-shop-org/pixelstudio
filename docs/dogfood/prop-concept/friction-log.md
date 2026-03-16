# Stage 39.5.2 — Prop Concept Dogfood
## Target: Ornate treasure chest (open, glowing), 500×500
## Target read: "Valuable, ancient, slightly dangerous"

### What worked
- Silhouette B (open + glow) was immediately strongest — the open lid
  breaks the boxy shape and the glow gives purpose
- Sketch → refined transition was smoother for props than characters
  because props have more geometric structure
- The metal bands, rivets, and gem give material variety at 500×500
- Glow effect with layered alpha reads well even in silhouette

### What fought back
- FRICTION: Alpha blending in the glow requires per-pixel composite;
  the simple px() overwrite doesn't layer glow naturally. Had to
  add inline alpha blending to px() for this script.
- FRICTION: No radial gradient primitive — had to fake glow with
  concentric ellipses at different opacities
- OBSERVATION: Props are easier than characters because they have
  clear geometric structure. The silhouette step still helps
  enormously for choosing between closed vs open vs angled.
- OBSERVATION: The "interior visible" detail (red lining) adds
  a lot of read. Without it the chest is just a box with a lid.

### Decisions
- Pre-production tools work well for props
- Gradient/glow helpers would speed up lighting exploration
- The 3-silhouette → pick → refine workflow is solid for both
  characters and props
