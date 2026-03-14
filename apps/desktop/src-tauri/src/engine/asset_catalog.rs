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
