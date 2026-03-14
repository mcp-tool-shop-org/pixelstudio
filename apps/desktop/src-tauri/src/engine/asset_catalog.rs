use serde::{Deserialize, Serialize};

/// Asset kind — classification for browsing and filtering.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AssetKind {
    Character,
    Prop,
    Environment,
    Effect,
    Ui,
    Custom,
}

/// Asset status — whether the backing file is reachable.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum AssetStatus {
    Ok,
    Missing,
}

/// A single entry in the asset catalog.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetCatalogEntry {
    /// Unique identifier for this catalog entry.
    pub id: String,
    /// Display name.
    pub name: String,
    /// Path to the .pxs project file.
    pub file_path: String,
    /// Classification for filtering.
    pub kind: AssetKind,
    /// User-defined tags for organization.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub tags: Vec<String>,
    /// ISO 8601 timestamp when this entry was first cataloged.
    pub created_at: String,
    /// ISO 8601 timestamp when this entry was last updated.
    pub updated_at: String,
    /// Canvas width in pixels (snapshot at catalog time).
    #[serde(default)]
    pub canvas_width: u32,
    /// Canvas height in pixels (snapshot at catalog time).
    #[serde(default)]
    pub canvas_height: u32,
    /// Number of frames (snapshot at catalog time).
    #[serde(default)]
    pub frame_count: usize,
    /// Number of clips (snapshot at catalog time).
    #[serde(default)]
    pub clip_count: usize,
    /// Optional thumbnail path (relative or absolute).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub thumbnail_path: Option<String>,
}

/// Summary info returned to the frontend for browsing.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AssetSummary {
    pub id: String,
    pub name: String,
    pub file_path: String,
    pub kind: AssetKind,
    pub tags: Vec<String>,
    pub created_at: String,
    pub updated_at: String,
    pub canvas_width: u32,
    pub canvas_height: u32,
    pub frame_count: usize,
    pub clip_count: usize,
    pub thumbnail_path: Option<String>,
    pub status: AssetStatus,
}

impl AssetCatalogEntry {
    /// Convert to a summary, checking file existence.
    pub fn to_summary(&self) -> AssetSummary {
        let status = if std::path::Path::new(&self.file_path).exists() {
            AssetStatus::Ok
        } else {
            AssetStatus::Missing
        };
        AssetSummary {
            id: self.id.clone(),
            name: self.name.clone(),
            file_path: self.file_path.clone(),
            kind: self.kind.clone(),
            tags: self.tags.clone(),
            created_at: self.created_at.clone(),
            updated_at: self.updated_at.clone(),
            canvas_width: self.canvas_width,
            canvas_height: self.canvas_height,
            frame_count: self.frame_count,
            clip_count: self.clip_count,
            thumbnail_path: self.thumbnail_path.clone(),
            status,
        }
    }
}

/// The full catalog — a list of entries persisted as JSON.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct AssetCatalog {
    pub entries: Vec<AssetCatalogEntry>,
}

impl AssetCatalog {
    /// Get the catalog file path (next to recent-projects.json).
    pub fn catalog_path() -> std::path::PathBuf {
        let base = dirs::data_local_dir()
            .unwrap_or_else(|| std::path::PathBuf::from("."));
        base.join("PixelStudio").join("asset-catalog.json")
    }

    /// Load catalog from disk. Returns empty catalog if file doesn't exist.
    pub fn load() -> Self {
        let path = Self::catalog_path();
        if !path.exists() {
            return Self::default();
        }
        std::fs::read_to_string(&path)
            .ok()
            .and_then(|json| serde_json::from_str(&json).ok())
            .unwrap_or_default()
    }

    /// Save catalog to disk.
    pub fn save(&self) -> Result<(), String> {
        let path = Self::catalog_path();
        if let Some(parent) = path.parent() {
            std::fs::create_dir_all(parent)
                .map_err(|e| format!("Failed to create catalog directory: {}", e))?;
        }
        let json = serde_json::to_string_pretty(self)
            .map_err(|e| format!("Failed to serialize catalog: {}", e))?;
        std::fs::write(&path, &json)
            .map_err(|e| format!("Failed to write catalog: {}", e))?;
        Ok(())
    }

    /// Find an entry by ID.
    pub fn find_by_id(&self, id: &str) -> Option<&AssetCatalogEntry> {
        self.entries.iter().find(|e| e.id == id)
    }

    /// Find an entry by file path.
    pub fn find_by_path(&self, path: &str) -> Option<&AssetCatalogEntry> {
        self.entries.iter().find(|e| e.file_path == path)
    }

    /// Insert or update an entry. If an entry with the same ID exists, replace it.
    /// If an entry with the same file_path exists but different ID, update the existing one.
    pub fn upsert(&mut self, entry: AssetCatalogEntry) {
        // Check by ID first
        if let Some(pos) = self.entries.iter().position(|e| e.id == entry.id) {
            self.entries[pos] = entry;
            return;
        }
        // Check by file path
        if let Some(pos) = self.entries.iter().position(|e| e.file_path == entry.file_path) {
            self.entries[pos] = entry;
            return;
        }
        self.entries.push(entry);
    }

    /// Remove an entry by ID. Returns true if found and removed.
    pub fn remove(&mut self, id: &str) -> bool {
        let len_before = self.entries.len();
        self.entries.retain(|e| e.id != id);
        self.entries.len() < len_before
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_entry(id: &str, name: &str, path: &str) -> AssetCatalogEntry {
        AssetCatalogEntry {
            id: id.into(),
            name: name.into(),
            file_path: path.into(),
            kind: AssetKind::Character,
            tags: Vec::new(),
            created_at: "2026-01-01T00:00:00Z".into(),
            updated_at: "2026-01-01T00:00:00Z".into(),
            canvas_width: 32,
            canvas_height: 32,
            frame_count: 1,
            clip_count: 0,
            thumbnail_path: None,
        }
    }

    // ── AssetCatalog — CRUD operations ────────────────────────

    #[test]
    fn empty_catalog() {
        let cat = AssetCatalog::default();
        assert!(cat.entries.is_empty());
    }

    #[test]
    fn upsert_inserts_new_entry() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "Char A", "/a.pxs"));
        assert_eq!(cat.entries.len(), 1);
        assert_eq!(cat.entries[0].name, "Char A");
    }

    #[test]
    fn upsert_replaces_by_id() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "Original", "/a.pxs"));
        cat.upsert(make_entry("a", "Updated", "/a.pxs"));
        assert_eq!(cat.entries.len(), 1);
        assert_eq!(cat.entries[0].name, "Updated");
    }

    #[test]
    fn upsert_replaces_by_file_path() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "First", "/shared.pxs"));
        // Different ID, same path → should replace
        cat.upsert(make_entry("b", "Second", "/shared.pxs"));
        assert_eq!(cat.entries.len(), 1);
        assert_eq!(cat.entries[0].name, "Second");
        assert_eq!(cat.entries[0].id, "b");
    }

    #[test]
    fn upsert_id_match_takes_priority_over_path_match() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "Entry A", "/a.pxs"));
        cat.upsert(make_entry("b", "Entry B", "/b.pxs"));
        // Update by ID "a", change path to /b.pxs:
        // ID match on "a" should win — replaces entry "a" at its position
        cat.upsert(make_entry("a", "A moved", "/b.pxs"));
        // Entry "a" replaced, entry "b" untouched
        assert_eq!(cat.entries.len(), 2);
        let a = cat.find_by_id("a").unwrap();
        assert_eq!(a.name, "A moved");
        assert_eq!(a.file_path, "/b.pxs");
    }

    #[test]
    fn find_by_id_returns_match() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("x", "Character X", "/x.pxs"));
        cat.upsert(make_entry("y", "Character Y", "/y.pxs"));
        let found = cat.find_by_id("y").unwrap();
        assert_eq!(found.name, "Character Y");
    }

    #[test]
    fn find_by_id_returns_none_for_missing() {
        let cat = AssetCatalog::default();
        assert!(cat.find_by_id("nope").is_none());
    }

    #[test]
    fn find_by_path_returns_match() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "Char A", "/sprites/a.pxs"));
        let found = cat.find_by_path("/sprites/a.pxs").unwrap();
        assert_eq!(found.id, "a");
    }

    #[test]
    fn find_by_path_returns_none_for_missing() {
        let cat = AssetCatalog::default();
        assert!(cat.find_by_path("/no/such/file.pxs").is_none());
    }

    #[test]
    fn remove_existing_entry() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "A", "/a.pxs"));
        cat.upsert(make_entry("b", "B", "/b.pxs"));
        assert!(cat.remove("a"));
        assert_eq!(cat.entries.len(), 1);
        assert!(cat.find_by_id("a").is_none());
        assert!(cat.find_by_id("b").is_some());
    }

    #[test]
    fn remove_nonexistent_returns_false() {
        let mut cat = AssetCatalog::default();
        assert!(!cat.remove("nope"));
    }

    #[test]
    fn remove_all_entries() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("a", "A", "/a.pxs"));
        cat.upsert(make_entry("b", "B", "/b.pxs"));
        cat.remove("a");
        cat.remove("b");
        assert!(cat.entries.is_empty());
    }

    // ── Serialization round-trip ──────────────────────────────

    #[test]
    fn json_roundtrip() {
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("rt-1", "Roundtrip", "/rt.pxs"));
        cat.entries[0].tags = vec!["hero".into(), "npc".into()];
        cat.entries[0].kind = AssetKind::Prop;
        cat.entries[0].thumbnail_path = Some("/thumbs/rt.png".into());

        let json = serde_json::to_string(&cat).unwrap();
        let restored: AssetCatalog = serde_json::from_str(&json).unwrap();

        assert_eq!(restored.entries.len(), 1);
        let e = &restored.entries[0];
        assert_eq!(e.id, "rt-1");
        assert_eq!(e.name, "Roundtrip");
        assert_eq!(e.kind, AssetKind::Prop);
        assert_eq!(e.tags, vec!["hero", "npc"]);
        assert_eq!(e.thumbnail_path, Some("/thumbs/rt.png".into()));
    }

    #[test]
    fn json_empty_tags_omitted() {
        let cat_json = serde_json::to_string(&make_entry("a", "A", "/a.pxs")).unwrap();
        // skip_serializing_if = "Vec::is_empty" should omit tags
        assert!(!cat_json.contains("\"tags\""));
    }

    #[test]
    fn json_empty_thumbnail_omitted() {
        let cat_json = serde_json::to_string(&make_entry("a", "A", "/a.pxs")).unwrap();
        assert!(!cat_json.contains("\"thumbnailPath\""));
    }

    // ── to_summary ────────────────────────────────────────────

    #[test]
    fn to_summary_missing_file_reports_missing_status() {
        let entry = make_entry("m", "Missing", "/surely/nonexistent/file.pxs");
        let summary = entry.to_summary();
        assert_eq!(summary.status, AssetStatus::Missing);
        assert_eq!(summary.id, "m");
        assert_eq!(summary.name, "Missing");
    }

    #[test]
    fn to_summary_preserves_all_fields() {
        let mut entry = make_entry("s", "Summary", "/s.pxs");
        entry.canvas_width = 64;
        entry.canvas_height = 128;
        entry.frame_count = 8;
        entry.clip_count = 3;
        entry.tags = vec!["boss".into()];
        let summary = entry.to_summary();
        assert_eq!(summary.canvas_width, 64);
        assert_eq!(summary.canvas_height, 128);
        assert_eq!(summary.frame_count, 8);
        assert_eq!(summary.clip_count, 3);
        assert_eq!(summary.tags, vec!["boss"]);
    }

    // ── Disk I/O round-trip ───────────────────────────────────

    #[test]
    fn save_and_load_roundtrip() {
        // Use the real catalog path but with a unique test entry we can clean up
        let mut cat = AssetCatalog::default();
        cat.upsert(make_entry("disk-rt-1", "DiskTest", "/disk-test.pxs"));
        cat.upsert(make_entry("disk-rt-2", "DiskTest2", "/disk-test2.pxs"));

        // Save to a temp file to avoid corrupting real catalog
        let tmp = std::env::temp_dir().join("pixelstudio-test-catalog.json");
        let json = serde_json::to_string_pretty(&cat).unwrap();
        std::fs::write(&tmp, &json).unwrap();

        let loaded_json = std::fs::read_to_string(&tmp).unwrap();
        let loaded: AssetCatalog = serde_json::from_str(&loaded_json).unwrap();
        assert_eq!(loaded.entries.len(), 2);
        assert_eq!(loaded.find_by_id("disk-rt-1").unwrap().name, "DiskTest");
        assert_eq!(loaded.find_by_id("disk-rt-2").unwrap().name, "DiskTest2");

        let _ = std::fs::remove_file(tmp);
    }

    // ── AssetKind coverage ────────────────────────────────────

    #[test]
    fn all_asset_kinds_serialize_roundtrip() {
        let kinds = [
            AssetKind::Character,
            AssetKind::Prop,
            AssetKind::Environment,
            AssetKind::Effect,
            AssetKind::Ui,
            AssetKind::Custom,
        ];
        for kind in kinds {
            let json = serde_json::to_string(&kind).unwrap();
            let restored: AssetKind = serde_json::from_str(&json).unwrap();
            assert_eq!(restored, kind);
        }
    }

    // ── catalog_path ──────────────────────────────────────────

    #[test]
    fn catalog_path_ends_with_expected_filename() {
        let path = AssetCatalog::catalog_path();
        assert_eq!(path.file_name().unwrap().to_str().unwrap(), "asset-catalog.json");
    }
}
