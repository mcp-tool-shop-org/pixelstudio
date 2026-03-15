use std::path::Path;
use crate::engine::scene::SceneDocument;
use crate::errors::AppError;

const SCENE_SCHEMA_VERSION: u32 = 1;

/// On-disk scene file format.
#[derive(Debug, Clone, serde::Serialize, serde::Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SceneFile {
    pub schema_version: u32,
    #[serde(flatten)]
    pub document: SceneDocument,
}

impl SceneFile {
    pub fn from_document(doc: &SceneDocument) -> Self {
        Self {
            schema_version: SCENE_SCHEMA_VERSION,
            document: doc.clone(),
        }
    }
}

/// Save a scene document to a .pscn file.
pub fn save_scene(doc: &SceneDocument, path: &str) -> Result<(), AppError> {
    let file = SceneFile::from_document(doc);
    let json = serde_json::to_string_pretty(&file)?;
    std::fs::write(path, json)?;
    Ok(())
}

/// Load a scene document from a .pscn file.
pub fn load_scene(path: &str) -> Result<SceneDocument, AppError> {
    let p = Path::new(path);
    if !p.exists() {
        return Err(AppError::ProjectNotFound(format!(
            "Scene file not found: {}",
            path
        )));
    }
    let data = std::fs::read_to_string(p)?;
    let file: SceneFile = serde_json::from_str(&data).map_err(|e| {
        AppError::InvalidProjectFormat(format!("Invalid scene file: {}", e))
    })?;
    Ok(file.document)
}

// ==========================================================================
// Tests
// ==========================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use crate::engine::scene::{
        CharacterSlotOverride, CharacterSlotOverrideMode, CharacterSlotSnapshot,
        CharacterSourceLinkMode, SceneAssetInstance, SceneInstanceKind,
    };
    use crate::engine::scene::{
        PersistedSceneProvenanceEntry, PersistedSceneProvenanceMetadata,
        PersistedSceneProvenanceDrilldownSource, SceneCamera,
    };
    use std::collections::HashMap;

    /// Helper: create a minimal scene document.
    fn make_doc() -> SceneDocument {
        SceneDocument::new("Test Scene".into(), 320, 240)
    }

    /// Helper: create a character instance with full metadata.
    fn make_character_instance(
        id: &str,
        link_mode: Option<CharacterSourceLinkMode>,
    ) -> SceneAssetInstance {
        let mut slots = HashMap::new();
        slots.insert("head".into(), "helm-iron".into());
        slots.insert("torso".into(), "plate-steel".into());
        let mut inst = SceneAssetInstance::new("".into(), "Knight".into(), 0);
        inst.instance_id = id.into();
        inst.instance_kind = Some(SceneInstanceKind::Character);
        inst.source_character_build_id = Some("build-1".into());
        inst.source_character_build_name = Some("Knight Build".into());
        inst.character_slot_snapshot = Some(CharacterSlotSnapshot {
            slots,
            equipped_count: 2,
            total_slots: 12,
        });
        inst.character_link_mode = link_mode;
        inst
    }

    /// Save + load round-trip helper.
    fn round_trip(doc: &SceneDocument) -> SceneDocument {
        let dir = std::env::temp_dir().join(format!("gs_test_{}", uuid::Uuid::new_v4()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("test.pscn");
        let path_str = path.to_str().unwrap();
        save_scene(doc, path_str).unwrap();
        let loaded = load_scene(path_str).unwrap();
        std::fs::remove_dir_all(&dir).ok();
        loaded
    }

    // ── Backward compatibility ──

    #[test]
    fn absent_link_mode_loads_as_none() {
        let mut doc = make_doc();
        let inst = make_character_instance("i1", None);
        doc.instances.push(inst);
        let loaded = round_trip(&doc);
        assert!(loaded.instances[0].character_link_mode.is_none());
    }

    #[test]
    fn absent_instance_kind_loads_as_none() {
        let mut doc = make_doc();
        let mut inst = SceneAssetInstance::new("asset.pxs".into(), "Tree".into(), 0);
        inst.instance_id = "i1".into();
        doc.instances.push(inst);
        let loaded = round_trip(&doc);
        assert!(loaded.instances[0].instance_kind.is_none());
        assert!(loaded.instances[0].character_link_mode.is_none());
    }

    // ── Unlinked persistence ──

    #[test]
    fn unlinked_survives_save_load() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Unlinked),
        ));
        let loaded = round_trip(&doc);
        assert_eq!(
            loaded.instances[0].character_link_mode,
            Some(CharacterSourceLinkMode::Unlinked)
        );
    }

    #[test]
    fn snapshot_preserved_through_unlinked_save_load() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Unlinked),
        ));
        let loaded = round_trip(&doc);
        let snap = loaded.instances[0].character_slot_snapshot.as_ref().unwrap();
        assert_eq!(snap.equipped_count, 2);
        assert_eq!(snap.total_slots, 12);
        assert_eq!(snap.slots.get("head").unwrap(), "helm-iron");
        assert_eq!(snap.slots.get("torso").unwrap(), "plate-steel");
    }

    #[test]
    fn overrides_preserved_through_unlinked_save_load() {
        let mut doc = make_doc();
        let mut inst = make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Unlinked),
        );
        let mut overrides = HashMap::new();
        overrides.insert(
            "head".into(),
            CharacterSlotOverride {
                slot: "head".into(),
                mode: CharacterSlotOverrideMode::Replace,
                replacement_part_id: Some("helm-gold".into()),
            },
        );
        inst.character_overrides = Some(overrides);
        doc.instances.push(inst);
        let loaded = round_trip(&doc);
        let ovr = loaded.instances[0].character_overrides.as_ref().unwrap();
        let head_ovr = ovr.get("head").unwrap();
        assert_eq!(head_ovr.mode, CharacterSlotOverrideMode::Replace);
        assert_eq!(head_ovr.replacement_part_id.as_deref(), Some("helm-gold"));
    }

    #[test]
    fn source_build_id_preserved_through_unlinked_save_load() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Unlinked),
        ));
        let loaded = round_trip(&doc);
        assert_eq!(
            loaded.instances[0].source_character_build_id.as_deref(),
            Some("build-1")
        );
        assert_eq!(
            loaded.instances[0].source_character_build_name.as_deref(),
            Some("Knight Build")
        );
    }

    // ── Explicit linked persistence ──

    #[test]
    fn explicit_linked_survives_save_load() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Linked),
        ));
        let loaded = round_trip(&doc);
        assert_eq!(
            loaded.instances[0].character_link_mode,
            Some(CharacterSourceLinkMode::Linked)
        );
    }

    // ── Legacy JSON without character fields ──

    #[test]
    fn legacy_scene_without_character_fields_loads() {
        let json = r#"{
            "schemaVersion": 1,
            "sceneId": "s1",
            "name": "Legacy",
            "canvasWidth": 64,
            "canvasHeight": 64,
            "instances": [{
                "instanceId": "i1",
                "sourcePath": "/old/sprite.pxs",
                "name": "OldSprite",
                "x": 10, "y": 20,
                "zOrder": 0,
                "visible": true,
                "opacity": 1.0,
                "parallax": 1.0
            }],
            "playback": { "fps": 12, "looping": true },
            "camera": { "x": 0.0, "y": 0.0, "zoom": 1.0 },
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-01-01T00:00:00Z"
        }"#;
        let file: SceneFile = serde_json::from_str(json).unwrap();
        let inst = &file.document.instances[0];
        assert!(inst.instance_kind.is_none());
        assert!(inst.character_link_mode.is_none());
        assert!(inst.source_character_build_id.is_none());
        assert!(inst.character_slot_snapshot.is_none());
        assert!(inst.character_overrides.is_none());
    }

    // ── Mixed instances ──

    #[test]
    fn mixed_linked_and_unlinked_instances_survive() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance("i1", None)); // linked by default
        doc.instances.push(make_character_instance(
            "i2",
            Some(CharacterSourceLinkMode::Unlinked),
        ));
        let mut asset = SceneAssetInstance::new("tree.pxs".into(), "Tree".into(), 2);
        asset.instance_id = "i3".into();
        doc.instances.push(asset);
        let loaded = round_trip(&doc);
        assert_eq!(loaded.instances.len(), 3);
        // i1: linked (None)
        assert!(loaded.instances[0].character_link_mode.is_none());
        assert_eq!(
            loaded.instances[0].instance_kind,
            Some(SceneInstanceKind::Character)
        );
        // i2: unlinked
        assert_eq!(
            loaded.instances[1].character_link_mode,
            Some(CharacterSourceLinkMode::Unlinked)
        );
        // i3: plain asset
        assert!(loaded.instances[2].instance_kind.is_none());
        assert!(loaded.instances[2].character_link_mode.is_none());
    }

    // ── Serialization format ──

    #[test]
    fn unlinked_instance_serializes_link_mode_field() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Unlinked),
        ));
        let file = SceneFile::from_document(&doc);
        let json = serde_json::to_string(&file).unwrap();
        assert!(json.contains("\"characterLinkMode\":\"unlinked\""));
    }

    #[test]
    fn linked_default_omits_link_mode_field() {
        let mut doc = make_doc();
        doc.instances.push(make_character_instance("i1", None));
        let file = SceneFile::from_document(&doc);
        let json = serde_json::to_string(&file).unwrap();
        assert!(!json.contains("characterLinkMode"));
    }

    // ── Remove override mode ──

    #[test]
    fn remove_override_survives_round_trip() {
        let mut doc = make_doc();
        let mut inst = make_character_instance(
            "i1",
            Some(CharacterSourceLinkMode::Unlinked),
        );
        let mut overrides = HashMap::new();
        overrides.insert(
            "torso".into(),
            CharacterSlotOverride {
                slot: "torso".into(),
                mode: CharacterSlotOverrideMode::Remove,
                replacement_part_id: None,
            },
        );
        inst.character_overrides = Some(overrides);
        doc.instances.push(inst);
        let loaded = round_trip(&doc);
        let ovr = loaded.instances[0].character_overrides.as_ref().unwrap();
        let torso_ovr = ovr.get("torso").unwrap();
        assert_eq!(torso_ovr.mode, CharacterSlotOverrideMode::Remove);
        assert!(torso_ovr.replacement_part_id.is_none());
    }

    // ── Provenance persistence ──

    fn make_provenance_entry(seq: u32, kind: &str, label: &str) -> PersistedSceneProvenanceEntry {
        PersistedSceneProvenanceEntry {
            sequence: seq,
            kind: kind.into(),
            label: label.into(),
            timestamp: "2026-03-15T12:00:00Z".into(),
            metadata: None,
        }
    }

    #[test]
    fn absent_provenance_loads_as_empty() {
        let doc = make_doc();
        let loaded = round_trip(&doc);
        assert!(loaded.provenance.is_empty());
        assert!(loaded.provenance_drilldown.is_empty());
    }

    #[test]
    fn provenance_entries_survive_round_trip() {
        let mut doc = make_doc();
        doc.provenance.push(make_provenance_entry(1, "add-instance", "Added Tree"));
        doc.provenance.push(make_provenance_entry(2, "move-instance", "Moved Tree"));
        let loaded = round_trip(&doc);
        assert_eq!(loaded.provenance.len(), 2);
        assert_eq!(loaded.provenance[0].sequence, 1);
        assert_eq!(loaded.provenance[0].kind, "add-instance");
        assert_eq!(loaded.provenance[0].label, "Added Tree");
        assert_eq!(loaded.provenance[1].sequence, 2);
    }

    #[test]
    fn provenance_sequence_and_timestamp_survive_exactly() {
        let mut doc = make_doc();
        let mut entry = make_provenance_entry(42, "set-scene-camera", "Camera pan");
        entry.timestamp = "2026-03-15T08:30:45.123Z".into();
        doc.provenance.push(entry);
        let loaded = round_trip(&doc);
        assert_eq!(loaded.provenance[0].sequence, 42);
        assert_eq!(loaded.provenance[0].timestamp, "2026-03-15T08:30:45.123Z");
    }

    #[test]
    fn provenance_metadata_with_instance_id_survives() {
        let mut doc = make_doc();
        let mut entry = make_provenance_entry(1, "move-instance", "Moved Tree");
        entry.metadata = Some(PersistedSceneProvenanceMetadata {
            instance_id: Some("i1".into()),
            slot_id: None,
            changed_fields: None,
            before_camera: None,
            after_camera: None,
        });
        doc.provenance.push(entry);
        let loaded = round_trip(&doc);
        let meta = loaded.provenance[0].metadata.as_ref().unwrap();
        assert_eq!(meta.instance_id.as_deref(), Some("i1"));
    }

    #[test]
    fn provenance_metadata_with_camera_survives() {
        let mut doc = make_doc();
        let mut entry = make_provenance_entry(1, "set-scene-camera", "Camera zoom");
        entry.metadata = Some(PersistedSceneProvenanceMetadata {
            instance_id: None,
            slot_id: None,
            changed_fields: Some(vec!["zoom".into()]),
            before_camera: Some(SceneCamera { x: 0.0, y: 0.0, zoom: 1.0, name: None }),
            after_camera: Some(SceneCamera { x: 0.0, y: 0.0, zoom: 2.5, name: None }),
        });
        doc.provenance.push(entry);
        let loaded = round_trip(&doc);
        let meta = loaded.provenance[0].metadata.as_ref().unwrap();
        assert_eq!(meta.changed_fields.as_ref().unwrap(), &vec!["zoom".to_string()]);
        assert_eq!(meta.before_camera.as_ref().unwrap().zoom, 1.0);
        assert_eq!(meta.after_camera.as_ref().unwrap().zoom, 2.5);
    }

    #[test]
    fn drilldown_source_survives_round_trip() {
        let mut doc = make_doc();
        doc.provenance.push(make_provenance_entry(1, "move-instance", "Moved Tree"));
        let inst = SceneAssetInstance::new("tree.pxs".into(), "Tree".into(), 0);
        let mut after_inst = inst.clone();
        after_inst.x = 200;
        after_inst.y = 300;
        doc.provenance_drilldown.insert("1".into(), PersistedSceneProvenanceDrilldownSource {
            kind: "move-instance".into(),
            metadata: Some(PersistedSceneProvenanceMetadata {
                instance_id: Some(inst.instance_id.clone()),
                slot_id: None,
                changed_fields: None,
                before_camera: None,
                after_camera: None,
            }),
            before_instance: Some(inst),
            after_instance: Some(after_inst),
            before_camera: None,
            after_camera: None,
        });
        let loaded = round_trip(&doc);
        assert_eq!(loaded.provenance_drilldown.len(), 1);
        let source = loaded.provenance_drilldown.get("1").unwrap();
        assert_eq!(source.kind, "move-instance");
        assert_eq!(source.before_instance.as_ref().unwrap().x, 0);
        assert_eq!(source.after_instance.as_ref().unwrap().x, 200);
    }

    #[test]
    fn camera_drilldown_source_survives_round_trip() {
        let mut doc = make_doc();
        doc.provenance.push(make_provenance_entry(1, "set-scene-camera", "Camera pan"));
        doc.provenance_drilldown.insert("1".into(), PersistedSceneProvenanceDrilldownSource {
            kind: "set-scene-camera".into(),
            metadata: Some(PersistedSceneProvenanceMetadata {
                instance_id: None,
                slot_id: None,
                changed_fields: Some(vec!["x".into(), "y".into()]),
                before_camera: None,
                after_camera: None,
            }),
            before_instance: None,
            after_instance: None,
            before_camera: Some(SceneCamera { x: 0.0, y: 0.0, zoom: 1.0, name: None }),
            after_camera: Some(SceneCamera { x: 120.0, y: 80.0, zoom: 1.0, name: None }),
        });
        let loaded = round_trip(&doc);
        let source = loaded.provenance_drilldown.get("1").unwrap();
        assert_eq!(source.before_camera.as_ref().unwrap().x, 0.0);
        assert_eq!(source.after_camera.as_ref().unwrap().x, 120.0);
        assert_eq!(source.after_camera.as_ref().unwrap().y, 80.0);
    }

    #[test]
    fn legacy_json_without_provenance_loads_cleanly() {
        let json = r#"{
            "schemaVersion": 1,
            "sceneId": "s1",
            "name": "Legacy",
            "canvasWidth": 64,
            "canvasHeight": 64,
            "instances": [],
            "playback": { "fps": 12, "looping": true },
            "camera": { "x": 0.0, "y": 0.0, "zoom": 1.0 },
            "createdAt": "2025-01-01T00:00:00Z",
            "updatedAt": "2025-01-01T00:00:00Z"
        }"#;
        let file: SceneFile = serde_json::from_str(json).unwrap();
        assert!(file.document.provenance.is_empty());
        assert!(file.document.provenance_drilldown.is_empty());
    }
}
