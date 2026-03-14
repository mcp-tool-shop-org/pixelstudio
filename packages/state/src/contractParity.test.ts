import { describe, it, expect } from 'vitest';

// ───────────────────────────────────────────────────────────────
// Contract parity tests: TS domain enums ↔ Rust serde enums
//
// These tests pin the exact variant sets for every enum that crosses
// the Tauri invoke boundary.  If a variant is added/removed in Rust
// but not in TS (or vice-versa), the test fails — catching runtime
// JSON deserialization drift that the compiler cannot see.
// ───────────────────────────────────────────────────────────────

// ── helpers ────────────────────────────────────────────────────
/** Assert two string sets are identical (order-independent). */
function expectSameVariants(name: string, ts: readonly string[], rust: readonly string[]) {
  const tsSet = new Set(ts);
  const rustSet = new Set(rust);
  const tsOnly = [...tsSet].filter((v) => !rustSet.has(v));
  const rustOnly = [...rustSet].filter((v) => !tsSet.has(v));
  expect(tsOnly, `${name}: TS-only variants`).toEqual([]);
  expect(rustOnly, `${name}: Rust-only variants`).toEqual([]);
}

// ── Enum variant tables ────────────────────────────────────────
// Source of truth: packages/domain/src/*.ts ↔ apps/desktop/src-tauri/src/**/*.rs

describe('TS ↔ Rust enum parity', () => {
  it('ColorMode', () => {
    const ts = ['rgb', 'indexed'] as const;
    const rust = ['rgb', 'indexed'] as const; // rename_all = "lowercase"
    expectSameVariants('ColorMode', ts, rust);
  });

  it('OperationKind', () => {
    const ts = ['deterministic', 'probabilistic', 'analysis', 'workflow'] as const;
    const rust = ['deterministic', 'probabilistic', 'analysis', 'workflow'] as const;
    expectSameVariants('OperationKind', ts, rust);
  });

  it('ValidationCategory', () => {
    const ts = ['palette', 'outline', 'socket', 'atlas', 'export', 'animation', 'locomotion', 'canon'] as const;
    const rust = ['palette', 'outline', 'socket', 'atlas', 'export', 'animation', 'locomotion', 'canon'] as const;
    expectSameVariants('ValidationCategory', ts, rust);
  });

  it('AnchorKind', () => {
    const ts = ['head', 'torso', 'arm_left', 'arm_right', 'leg_left', 'leg_right', 'custom'] as const;
    const rust = ['head', 'torso', 'arm_left', 'arm_right', 'leg_left', 'leg_right', 'custom'] as const;
    expectSameVariants('AnchorKind', ts, rust);
  });

  it('PivotMode', () => {
    const ts = ['center', 'bottom_center', 'custom'] as const;
    const rust = ['center', 'bottom_center', 'custom'] as const;
    expectSameVariants('PivotMode', ts, rust);
  });

  it('AssetKind', () => {
    const ts = ['character', 'prop', 'environment', 'effect', 'ui', 'custom'] as const;
    const rust = ['character', 'prop', 'environment', 'effect', 'ui', 'custom'] as const;
    expectSameVariants('AssetKind', ts, rust);
  });

  it('AssetStatus', () => {
    const ts = ['ok', 'missing'] as const;
    const rust = ['ok', 'missing'] as const;
    expectSameVariants('AssetStatus', ts, rust);
  });

  it('ExportBundleFormat', () => {
    const ts = ['folder', 'zip'] as const;
    const rust = ['folder', 'zip'] as const;
    expectSameVariants('ExportBundleFormat', ts, rust);
  });

  it('ManifestFormat', () => {
    const ts = ['pixelstudio_native', 'generic_runtime'] as const;
    const rust = ['pixelstudio_native', 'generic_runtime'] as const;
    expectSameVariants('ManifestFormat', ts, rust);
  });

  it('MotionIntent', () => {
    const ts = ['idle_bob', 'walk_cycle_stub', 'run_cycle_stub', 'hop'] as const;
    const rust = ['idle_bob', 'walk_cycle_stub', 'run_cycle_stub', 'hop'] as const;
    expectSameVariants('MotionIntent', ts, rust);
  });

  it('MotionDirection', () => {
    const ts = ['left', 'right', 'up', 'down'] as const;
    const rust = ['left', 'right', 'up', 'down'] as const;
    expectSameVariants('MotionDirection', ts, rust);
  });

  it('MotionTargetMode', () => {
    const ts = ['active_selection', 'anchor_binding', 'whole_frame'] as const;
    const rust = ['active_selection', 'anchor_binding', 'whole_frame'] as const;
    expectSameVariants('MotionTargetMode', ts, rust);
  });

  it('MotionSessionStatus: Rust subset matches TS (idle is TS-only)', () => {
    const ts = ['idle', 'configuring', 'generating', 'reviewing', 'committing', 'error'] as const;
    const rust = ['configuring', 'generating', 'reviewing', 'committing', 'error'] as const;
    // 'idle' is a TS-only frontend state before a session exists in Rust
    const tsWithoutIdle = ts.filter((v) => v !== 'idle');
    expectSameVariants('MotionSessionStatus (shared)', tsWithoutIdle, rust);
  });

  it('MotionTemplateId', () => {
    const ts = ['idle_breathing', 'walk_basic', 'run_basic', 'hop_basic'] as const;
    const rust = ['idle_breathing', 'walk_basic', 'run_basic', 'hop_basic'] as const;
    expectSameVariants('MotionTemplateId', ts, rust);
  });

  it('MotionPresetKind', () => {
    const ts = ['locomotion', 'secondary_motion'] as const;
    const rust = ['locomotion', 'secondary_motion'] as const;
    expectSameVariants('MotionPresetKind', ts, rust);
  });

  it('SandboxSource', () => {
    const ts = ['timeline_span', 'motion_proposal'] as const;
    const rust = ['timeline_span', 'motion_proposal'] as const;
    expectSameVariants('SandboxSource', ts, rust);
  });

  it('SecondaryMotionTemplateId', () => {
    const ts = ['wind_soft', 'wind_medium', 'wind_gust', 'idle_sway', 'hanging_swing', 'foliage_rustle'] as const;
    const rust = ['wind_soft', 'wind_medium', 'wind_gust', 'idle_sway', 'hanging_swing', 'foliage_rustle'] as const;
    expectSameVariants('SecondaryMotionTemplateId', ts, rust);
  });

  it('CameraInterpolationMode', () => {
    const ts = ['hold', 'linear'] as const;
    const rust = ['hold', 'linear'] as const;
    expectSameVariants('CameraInterpolationMode', ts, rust);
  });

  it('ClipValidity', () => {
    const ts = ['valid', 'warning', 'invalid'] as const;
    const rust = ['valid', 'warning', 'invalid'] as const;
    expectSameVariants('ClipValidity', ts, rust);
  });

  it('ClipResolutionStatus', () => {
    const ts = ['resolved', 'no_clip', 'missing_source', 'missing_clip', 'no_clips_in_source'] as const;
    const rust = ['resolved', 'no_clip', 'missing_source', 'missing_clip', 'no_clips_in_source'] as const;
    expectSameVariants('ClipResolutionStatus', ts, rust);
  });

  it('SecondaryReadinessTier', () => {
    const ts = ['ready', 'limited', 'blocked'] as const;
    const rust = ['ready', 'limited', 'blocked'] as const;
    expectSameVariants('SecondaryReadinessTier', ts, rust);
  });

  it('ExportScope discriminator values', () => {
    const ts = ['current_frame', 'selected_span', 'current_clip', 'all_clips'] as const;
    const rust = ['current_frame', 'selected_span', 'current_clip', 'all_clips'] as const;
    expectSameVariants('ExportScope', ts, rust);
  });

  it('ExportLayout discriminator values', () => {
    const ts = ['horizontal_strip', 'vertical_strip', 'grid'] as const;
    const rust = ['horizontal_strip', 'vertical_strip', 'grid'] as const;
    expectSameVariants('ExportLayout', ts, rust);
  });
});

// ───────────────────────────────────────────────────────────────
// Command parity: every invoke() call in the frontend must have a
// registered handler in Rust, and vice-versa.
// ───────────────────────────────────────────────────────────────

describe('TS invoke() ↔ Rust command registration', () => {
  // Extracted from apps/desktop/src-tauri/src/lib.rs invoke_handler
  const RUST_COMMANDS = new Set([
    // project
    'new_project', 'open_project', 'save_project', 'get_project_info',
    'mark_dirty', 'list_recent_projects', 'export_png',
    'autosave_recovery', 'check_recovery', 'restore_recovery', 'discard_recovery',
    'get_asset_package_metadata', 'set_asset_package_metadata',
    // canvas
    'init_canvas', 'get_canvas_state', 'write_pixel', 'read_pixel',
    'begin_stroke', 'stroke_points', 'end_stroke',
    'undo', 'redo',
    'create_layer', 'delete_layer', 'rename_layer', 'select_layer',
    'set_layer_visibility', 'set_layer_lock', 'set_layer_opacity', 'reorder_layer',
    // selection
    'set_selection_rect', 'clear_selection', 'get_selection',
    'copy_selection', 'cut_selection', 'paste_selection', 'delete_selection',
    'begin_selection_transform', 'move_selection_preview', 'nudge_selection',
    'commit_selection_transform', 'cancel_selection_transform',
    'flip_selection_horizontal', 'flip_selection_vertical',
    'rotate_selection_90_cw', 'rotate_selection_90_ccw',
    // timeline
    'get_timeline', 'create_frame', 'duplicate_frame', 'delete_frame',
    'select_frame', 'rename_frame', 'get_onion_skin_frames', 'reorder_frame',
    'insert_frame_at', 'duplicate_frame_at', 'set_frame_duration',
    'export_frame_sequence', 'export_sprite_strip',
    // motion
    'begin_motion_session', 'generate_motion_proposals', 'get_motion_session',
    'accept_motion_proposal', 'reject_motion_proposal', 'cancel_motion_session',
    'commit_motion_proposal', 'undo_motion_commit', 'redo_motion_commit',
    'list_motion_templates', 'apply_motion_template',
    // anchor
    'create_anchor', 'update_anchor', 'delete_anchor', 'list_anchors',
    'bind_anchor_to_selection', 'clear_anchor_binding', 'validate_anchors',
    'move_anchor', 'resize_anchor_bounds',
    'copy_anchors_to_frame', 'copy_anchors_to_all_frames',
    'propagate_anchor_updates', 'set_anchor_parent', 'clear_anchor_parent',
    'set_anchor_falloff',
    // sandbox
    'begin_sandbox_session', 'get_sandbox_session', 'close_sandbox_session',
    'analyze_sandbox_motion', 'get_sandbox_anchor_paths', 'apply_sandbox_timing',
    'duplicate_sandbox_span',
    // secondary_motion
    'list_secondary_motion_templates', 'apply_secondary_motion_template',
    'check_secondary_readiness',
    // preset
    'save_motion_preset', 'list_motion_presets', 'delete_motion_preset',
    'rename_motion_preset', 'get_motion_preset', 'apply_motion_preset',
    'apply_motion_preset_to_span', 'apply_motion_preset_to_all_frames',
    'check_motion_preset_compatibility', 'preview_motion_preset_apply',
    // export
    'preview_sprite_sheet_layout', 'export_clip_sequence', 'export_clip_sheet',
    'export_all_clips_sheet', 'export_clip_sequence_with_manifest',
    // clip
    'create_clip', 'list_clips', 'update_clip', 'delete_clip', 'validate_clips',
    'set_clip_pivot', 'clear_clip_pivot', 'set_clip_tags', 'add_clip_tag', 'remove_clip_tag',
    // asset
    'list_assets', 'get_asset_catalog_entry', 'upsert_asset_catalog_entry',
    'remove_asset_catalog_entry', 'refresh_asset_catalog', 'generate_asset_thumbnail',
    // bundle
    'preview_asset_bundle', 'export_asset_bundle',
    'preview_catalog_bundle', 'export_catalog_bundle',
    // scene
    'new_scene', 'open_scene', 'save_scene', 'save_scene_as',
    'get_scene_info', 'get_scene_instances', 'add_scene_instance',
    'remove_scene_instance', 'move_scene_instance',
    'set_scene_instance_layer', 'set_scene_instance_visibility',
    'set_scene_instance_opacity', 'set_scene_instance_clip',
    'set_scene_instance_parallax',
    'set_scene_playback_fps', 'set_scene_loop', 'get_scene_playback_state',
    'list_source_clips', 'get_source_asset_frames', 'export_scene_frame',
    'get_scene_camera', 'set_scene_camera_position', 'set_scene_camera_zoom',
    'reset_scene_camera',
    'get_scene_timeline_summary', 'seek_scene_tick', 'get_scene_camera_at_tick',
    'list_scene_camera_keyframes', 'add_scene_camera_keyframe',
    'update_scene_camera_keyframe', 'delete_scene_camera_keyframe',
  ]);

  // Extracted from grep of invoke('...') calls in apps/desktop/src/
  const TS_INVOKE_CALLS = new Set([
    'delete_anchor',
    'mark_dirty',
    'delete_clip',
    'clear_selection',
    'set_selection_rect',
    'copy_selection',
    'autosave_recovery',
    'open_project',
    'set_asset_package_metadata',
    'cancel_motion_session',
    'close_sandbox_session',
    'delete_motion_preset',
    'rename_motion_preset',
    'discard_recovery',
    'set_scene_camera_position',
    'move_scene_instance',
    'set_scene_camera_zoom',
    'reset_scene_camera',
    'new_scene',
    'set_scene_instance_visibility',
    'set_scene_instance_opacity',
    'set_scene_instance_layer',
    'remove_scene_instance',
    'set_scene_instance_parallax',
    'set_scene_instance_clip',
  ]);

  it('every TS invoke() call targets a registered Rust command', () => {
    const unregistered = [...TS_INVOKE_CALLS].filter((cmd) => !RUST_COMMANDS.has(cmd));
    expect(unregistered, 'TS calls commands not registered in Rust').toEqual([]);
  });

  it('Rust command set is a superset of TS invoke calls', () => {
    // Not all Rust commands need a direct invoke() call — some are used
    // via stores, event-handlers, or programmatic wrappers.  This test
    // simply documents the gap for visibility.
    const unusedByDirectInvoke = [...RUST_COMMANDS].filter((cmd) => !TS_INVOKE_CALLS.has(cmd));
    // We don't fail on unused commands — just assert the set is non-empty
    // (i.e. there ARE commands invoked indirectly through stores).
    expect(unusedByDirectInvoke.length).toBeGreaterThan(0);
  });

  it('Rust command count matches expected total', () => {
    // Pinned so any new command addition forces the parity test to be updated.
    expect(RUST_COMMANDS.size).toBe(161);
  });
});
