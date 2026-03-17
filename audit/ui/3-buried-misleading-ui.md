# Buried Feature Report & Misleading UI

> Things that lie, things that hide, things that confuse.

## Lying UI

### LIE-01: Hardcoded "Valid" badge (P0)
**Location**: TopBar.tsx:56
**What it says**: `<span className="topbar-badge badge-ok">Valid</span>`
**What it means**: Nothing. This is a hardcoded string, not derived from validation state.
**Impact**: User trusts a green badge that claims their document is valid regardless of actual validation status.

### LIE-02: Hardcoded "RGB" badge (P1)
**Location**: TopBar.tsx:55
**What it says**: `<span className="topbar-badge">RGB</span>`
**What it means**: Nothing. This is a static label, not derived from the document's actual color mode.
**Impact**: Low — currently all sprites are RGB. But if indexed/grayscale modes are added, this lies.

### LIE-03: "Save As" silently fails (P1)
**Location**: AppShell.tsx:51
**What it does**: `console.log('Save As not yet wired — no file path set')`
**What user sees**: Nothing. Ctrl+S on a new document with no file path logs to console and does nothing.
**Impact**: User thinks save worked (no error shown) but nothing was saved.

## Buried Features

### BURIED-01: Layer rename (P1)
**Location**: LayerPanel.tsx:231
**How to access**: Double-click the layer name text
**Discoverability**: Zero visual affordance. No edit icon, no cursor change hint, no tooltip.
**Impact**: Users won't know they can rename layers.

### BURIED-02: Color picker (P0)
**Location**: Only accessible via RightDock → Palette tab (one of 10 tabs in edit mode)
**How to access**: Click 8th tab in RightDock, then interact with palette
**Discoverability**: The ToolRail color swatches only swap FG/BG — there's no click-to-pick.
**Impact**: Core drawing workflow requires navigating to a buried tab to change colors.

### BURIED-03: Single-frame export (P1)
**Location**: ExportPreviewPanel only renders when `frames.length > 1`
**How to access**: Must add a second frame, then export appears, then you can export current frame only
**Workaround**: Use "Export" mode tab → but Export mode only shows "Export Settings" in RightDock
**Impact**: Static sprites (the most common first-time use case) have no obvious export path.

### BURIED-04: Onion skin controls (P2)
**Location**: BottomDock timeline panel → "OS" button → expands prev/next checkboxes
**How to access**: Click the tiny "OS" text button in the timeline
**Discoverability**: "OS" is not a recognized abbreviation for most users.
**Impact**: Useful animation feature hidden behind obscure abbreviation.

### BURIED-05: Keyboard shortcut discovery (P2)
**Location**: ToolRail shortcut badges + tooltip titles
**How to access**: Hover each tool to see shortcut, or read the tiny badge text
**Discoverability**: No shortcut cheat sheet, no help panel, no "?" button.
**Impact**: 37 keyboard shortcuts with no way to discover them except hovering.

### BURIED-06: Snapshot comparison (P2)
**Location**: RightDock → Snapshots tab → compare button → Canvas overlays snapshot data
**How to access**: Navigate to Snapshots tab, create a snapshot, then use compare
**Discoverability**: Multi-step process buried in a tab.

## Dead / Disconnected UI

### DEAD-01: SpriteEditor subsystem (P1 — investigate)
**Location**: SpriteEditor.tsx + SpriteToolRail.tsx + SpriteCanvasArea.tsx + SpriteFrameStrip.tsx + SpriteImportExportBar.tsx + SpritePreviewBar.tsx + SpritePalettePanel.tsx + SpriteLayerPanel.tsx
**Status**: Never rendered from AppShell. Has its own incompatible shortcut map.
**Impact**: ~8 components (hundreds of lines) that appear to be dead code from a previous architecture. Conflicting shortcut definitions could cause bugs if accidentally imported.

### DEAD-02: Export mode workspace (P2)
**Location**: TopBar shows "Export" as a mode tab, but it renders the Canvas with only "Export Settings" in the RightDock
**Status**: ExportPreviewPanel lives in BottomDock (edit/animate modes), not in the Export mode.
**Impact**: Export mode is misleading — the real export UI is in BottomDock.

### DEAD-03: Locomotion placeholder panels (P2)
**Location**: RightDock → Locomotion tab in animate/locomotion modes
**Status**: Falls through PanelContent if-chain to the placeholder `<span className="placeholder-label">{tabName}</span>`
**Impact**: "Locomotion" tab renders an empty gray placeholder.

## Confusing Patterns

### CONFUSE-01: Two paths to Copilot (P2)
Edit mode → RightDock → Copilot tab gives the same CopilotPanel as AI mode → RightDock → Copilot tab.
User doesn't know which mode to be in to use AI.

### CONFUSE-02: "Properties" tab means different things (P2)
In edit mode, "Properties" tab is in the RightDock tab list but renders VectorPropertiesPanel (from the PanelContent if-chain mapping "Properties" → VectorPropertiesPanel). In palette mode, "Palette Props" renders PalettePropsPanel. The semantic overload is confusing.

### CONFUSE-03: Frame management scattered across surfaces (P2)
- Add frame: BottomDock + button, or N key (SpriteEditor only, not AppShell)
- Duplicate: BottomDock ⎘ button, or Shift+D (SpriteEditor only)
- Navigate: BottomDock arrows + ,/. keys + frame strip click
- Reorder: BottomDock ←/→ buttons
- No single "frame manager" view.
