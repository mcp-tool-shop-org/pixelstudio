# Vector Master Reduction Analysis — Ranger
Generated: 2026-03-17T07:01:00.464Z

## Design Rules Applied
- Silhouette first: peaked hood + wide cloak drape
- One shape per idea: hood, cloak, torso, head, arms, legs, boots, bow, quiver
- Exaggerated: hood peak taller, cloak wider, head oversized
- Fussy detail killed: no buckles, rivets, facial features, stitching
- Spaced apart: arms clear of torso, bow visible past shoulder
- Value chunks: dark cloak vs light skin vs medium tunic

## Reduction Results
- 16×16: 30.1% fill | 16 survived, 2 collapsed
-   Collapsed: belt, bowstring
- 16×32: 32.8% fill | 17 survived, 1 collapsed
-   Collapsed: bowstring
- 32×32: 29.8% fill | 18 survived, 0 collapsed
- 32×48: 29.4% fill | 18 survived, 0 collapsed
- 48×48: 27.8% fill | 18 survived, 0 collapsed
- 64×64: 28.0% fill | 18 survived, 0 collapsed

## Shape Survival Hints
- cloak: must-survive (cloak)
- torso: must-survive (torso)
- belt: droppable (belt)
- head: must-survive (head)
- hood: must-survive (hood)
- arm-left: prefer-survive (arm)
- arm-right: prefer-survive (arm)
- boot-left: must-survive (boot)
- boot-right: must-survive (boot)
- leg-left: prefer-survive (leg)
- leg-right: prefer-survive (leg)
- bow: must-survive (bow)
- bowstring: droppable (bowstring)
- quiver: prefer-survive (quiver)

## Observations
- Hood + cloak silhouette survives at all sizes — identity preserved
- Belt collapses early (expected droppable)
- Bowstring collapses early (expected droppable)
- At 16×16, most detail is gone but the triangular silhouette reads as "cloaked figure"
- At 48×48+, individual body parts are distinguishable

## Files
- vector-master-500x500.png
- sprite-16x16.png
- sprite-16x32.png
- sprite-32x32.png
- sprite-32x48.png
- sprite-48x48.png
- sprite-64x64.png
- comparison-strip.png