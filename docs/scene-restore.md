# Scene Restore Semantics

Stage 25 introduced restore as an explicit authored edit. This document
defines the restore stack: what it does, what it does not do, and where
the sharp edges are.

## Action taxonomy

| Action              | Scope               | Mutates state? | Creates history entry? |
|---------------------|----------------------|----------------|------------------------|
| Drilldown           | one entry            | No             | No                     |
| Compare             | two states           | No             | No                     |
| Restore Preview     | selected scope       | No             | No                     |
| Full Restore        | all authored domains | Yes            | Yes                    |
| Selective Restore   | one authored domain  | Yes            | Yes                    |
| Undo / Redo         | history stack        | Yes            | No (navigates stack)   |

## Authored domains

These are the scene domains that persist and that users author:

- **instances** -- position, visibility, opacity, layer, clip, parallax, character source/overrides
- **camera** -- pan X, pan Y, zoom
- **keyframes** -- authored camera keyframes (tick, position, interpolation)
- **playbackConfig** -- fps, looping

Transient playback state (`isPlaying`, `currentTick`) is excluded from
preview, restore, compare, and undo semantics everywhere.

## Full restore

Full restore replaces all authored domains from the historical source
entry. When the source lacks a domain (e.g. camera is `undefined`),
the current value is preserved -- restore never destructively clears
data that was not captured in the source.

Covered domains: instances, camera, keyframes, playbackConfig.

Full restore:
- routes through `applyEdit('restore-entry', ...)` -- the lawful seam
- creates one history entry, one provenance entry, one drilldown capture
- is undoable and redoable via the normal history stack
- includes a `rollback()` function for backend sync failure recovery

## Selective restore

Selective restore replaces only the selected whole authored domain
and preserves all other domains exactly as-is.

Supported scopes: `instances`, `camera`, `keyframes`.

Each selective restore:
- routes through the same `applyEdit` lawful seam
- creates one history entry with `SceneHistoryRestoreMeta` including `scope`
- is undoable and redoable
- preserves non-selected domains without mutation

Selective restore is a scalpel, not a merge engine. It restores whole
authored domains, not arbitrary subfield soup.

### Playback-config selective restore (deferred)

Playback-config-only selective restore is **intentionally unsupported**.

Reason: authored playback config is included in full restore, but
playback-only authored changes are not yet independently visible to
`SceneHistorySnapshot`. The history engine tracks instances, camera,
and keyframes -- but not playbackConfig as a standalone field.

This means:
- Full restore includes authored playback config (via the full restore path)
- Playback-config edits create provenance/drilldown entries (via `applyEdit`)
- But playback-config-only restore cannot participate honestly in
  undo/redo because `SceneHistorySnapshot` does not carry playbackConfig

This is an intentional limitation, not an oversight. The fix requires
extending `SceneHistorySnapshot` to include `playbackConfig`, which
would affect the entire history engine. That change is deferred to a
future stage.

## Restore preview

Restore preview shows hypothetical impact only. It never mutates state.

The preview pane includes a scope selector (Full Scene, Instances,
Camera, Keyframes). The preview body filters to show only the
sections relevant to the selected scope. Playback sections appear
only in full-scope preview.

Preview-match law: restore preview must match actual restore behavior.
If preview says "no impact" for a scope, restore for that scope must
also be unavailable or a no-op.

## Unavailable reasons

| Reason                   | When                                                    |
|--------------------------|---------------------------------------------------------|
| `no-source-snapshot`     | Source entry has no instance data at all                 |
| `source-matches-current` | Restored state would be identical to current state       |
| `scope-not-supported`    | Requested scope is not a recognized `SceneRestoreScope`  |
| `missing-domain-data`    | Source entry lacks data for the requested domain scope   |

## Type reference

| Type                          | Location                          | Purpose                              |
|-------------------------------|-----------------------------------|--------------------------------------|
| `SceneRestoreScope`           | `sceneRestore.ts`                 | `'full' \| 'camera' \| 'keyframes' \| 'instances'` |
| `SceneRestoreRequest`         | `sceneRestore.ts`                 | Input to `deriveSceneRestore`        |
| `SceneRestoreSnapshot`        | `sceneRestore.ts`                 | Authored-domain-only state bag       |
| `SceneRestoreResult`          | `sceneRestore.ts`                 | Pure derivation output               |
| `SceneRestoreUnavailableReason` | `sceneRestore.ts`               | Discriminated failure reasons        |
| `FULL_RESTORE_DOMAINS`        | `sceneRestore.ts`                 | `['instances','camera','keyframes','playbackConfig']` |
| `RESTORE_SCOPE_LABELS`        | `sceneRestore.ts`                 | Operator-readable labels per scope   |
| `SELECTIVE_RESTORE_SCOPES`    | `sceneRestore.ts`                 | `['instances','camera','keyframes']` |
| `SceneRestoreActionResult`    | `sceneEditorStore.ts`             | Store action return with rollback    |
| `SceneHistoryRestoreMeta`     | `sceneHistory.ts`                 | `{ sourceSequence, scope }`          |
| `deriveSceneRestore()`        | `sceneRestore.ts`                 | Pure derivation function             |
| `describeSceneRestore()`      | `sceneRestore.ts`                 | Label helper                         |
| `restoreEntry(seq, scope?)`   | `sceneEditorStore.ts`             | Store action (default scope: `full`) |

## Pinned laws

1. **Explicit-restore law** -- Restore is an explicit authored edit,
   never implicit preview behavior.
2. **Scope-integrity law** -- Selective restore restores only the
   selected whole authored domain.
3. **Full-restore law** -- Full restore restores all authored domains,
   including authored playback config.
4. **Playback-gap honesty law** -- Playback-config-only selective
   restore is intentionally unsupported until standalone history
   visibility exists.
5. **Preview-distinction law** -- Restore preview remains read-only
   and distinct from actual restore.
6. **Playback-exclusion law** -- Transient playback state remains
   excluded from preview, restore, compare, and undo semantics.
7. **One-action-one-entry law** -- Each restore action (full or scoped)
   creates exactly one history entry, one provenance entry, and one
   drilldown capture.
8. **Domain-integrity law** -- Selected domains restore as whole
   authored domains, not partial hidden merges.

## Stage 25 closeout

Stage 25 -- Actual Restore Semantics and Selective Restore Law

- Added full restore as an explicit authored edit
- Routed restore through the lawful scene edit seam (`applyEdit`)
- Made full restore undoable/redoable and rollback-safe
- Added selective restore for safe authored domains: instances, camera, keyframes
- Kept authored playback config in full restore only
- Explicitly excluded transient playback state
- Documented scope boundaries and current limitations
- Deferred playback-config-only selective restore (history snapshot gap)
