# UI Surface Inventory

> Audited: 2026-03-17 | Surfaces: 55 components | Modes: 9 workspace modes

## 1. Top-Level Layout (AppShell.tsx)

| Zone | Component | Grid Position | Visibility |
|------|-----------|---------------|------------|
| Header | TopBar | Row 1 | Always (except project-home, recovery) |
| Transform context bar | TransformBar | Between header and body | Only when `isTransforming === true` |
| Vector source banner | VectorSourceBanner | Between header and body | Only in edit mode, after vector handoff |
| Left rail | ToolRail | Body col 1 | edit, animate, locomotion, scene modes |
| Center canvas | Canvas / SceneCanvas / VectorWorkspace | Body col 2 | Mode-dependent |
| Right dock | RightDock | Body col 3 | Always (except project-home) |
| Bottom dock | BottomDock | Row 3 | Always (except project-home) |

### Mode → Surface Matrix

| Mode | Left Rail | Center | Right Dock Tabs | Bottom Dock |
|------|-----------|--------|-----------------|-------------|
| project-home | — | ProjectHome | — | — |
| edit | ToolRail | Canvas | Layers, Reference, Snapshots, Analysis, Character, Properties, Palette, Copilot, Templates, Assets | Timeline + ClipPanel + ExportPreview |
| animate | ToolRail | Canvas | Layers, Reference, Snapshots, Analysis, Character, Properties, Palette, Locomotion | Timeline |
| palette | — (no ToolRail!) | Canvas | Palette Props, Validation | Mode label only |
| ai | — (no ToolRail!) | Canvas | Copilot, Generate, Templates, AI Settings, Layers, Provenance | Mode label only |
| locomotion | ToolRail | Canvas | Locomotion, Layers, Validation | Timeline + Motion + Anchor + Sandbox + Preset |
| validate | — (no ToolRail!) | Canvas | Validation, Properties, Provenance | Mode label only |
| export | — (no ToolRail!) | Export Settings | — | Mode label only |
| scene | ToolRail | SceneCanvas | Instances, Camera, Assets, Activity | ScenePlaybackControls + CameraTimeline |
| vector | — (VectorWorkspace owns its own rail) | VectorCanvas | Shapes, Properties, Reduction, Vec Copilot, AI Create | Info bar only |

**FINDING [S-01]**: ToolRail disappears in palette, ai, validate, export modes — user loses spatial orientation since the left column collapses. The grid snaps from 3-column to 2-column layout.

**FINDING [S-02]**: Export mode has `export: ['Export Settings']` in RightDock but AppShell still renders Canvas in center. The "export" mode appears to be a right-dock-only experience with a dead canvas behind it.

## 2. ToolRail (ToolRail.tsx)

15 primary tools + 2 sketch tools + color swatch:

| Tool | ID | Shortcut | Status |
|------|----|----------|--------|
| Pencil | pencil | B | Live |
| Eraser | eraser | E | Live |
| Fill | fill | G | Live |
| Line | line | L | Live |
| Rectangle | rectangle | U | Live |
| Ellipse | ellipse | C | Live |
| Marquee | marquee | M | Live |
| Lasso | lasso | Q | Live |
| Magic Select | magic-select | W | Live |
| By Color | color-select | Y | Live |
| Move | move | V | Live |
| Transform | transform | T | Live |
| Slice | slice | K | Live |
| Socket | socket | S | Live |
| Measure | measure | I | Live |
| — divider — | | | |
| Sketch | sketch-brush | N | Live |
| S.Erase | sketch-eraser | Shift+N | Live |
| — spacer — | | | |
| Color swatches | (swap: X) | X | Live |

**FINDING [S-03]**: All 17 tools are text-label-only (no icons). Every button shows the tool name + tiny shortcut badge. At 26px height x 72px min-width, this is extremely dense for new users — 17 identical-looking text buttons stacked vertically.

**FINDING [S-04]**: Sketch tools are visually differentiated (dashed orange border) — good affordance separation.

**FINDING [S-05]**: SketchSettings (size/opacity sliders) appear inline below sketch tools only when a sketch tool is active. Good contextual reveal.

## 3. Canvas (Canvas.tsx)

~1300 lines. Handles: pixel drawing, shape tools (line/rect/ellipse), marquee/lasso/magic/color selection, transform dragging, slice tool, measure tool, socket/anchor tool, onion skin, snapshot comparison, silhouette overlay.

**FINDING [S-06]**: Canvas.tsx is a 1300-line monolith. All 17 tool behaviors are in a single component with ~20 refs and massive switch/if chains in mouse handlers. This is a maintenance and extensibility risk.

**FINDING [S-07]**: Slice regions exist as local `useState` for rendering but are loaded from Rust on every frame change (P0-C pattern). Correctly implemented — no drift.

**FINDING [S-08]**: Hover pixel coordinates shown via `hoveredPixel` state but only consumed internally for cursor rendering — no visible coordinate readout in the UI (TransformBar only shows during transform, not during general editing).

## 4. RightDock (RightDock.tsx)

Tab-based panel container. Tab count per mode ranges from 2 (palette) to 10 (edit).

**FINDING [S-09]**: Edit mode has 10 tabs in the RightDock: Layers, Reference, Snapshots, Analysis, Character, Properties, Palette, Copilot, Templates, Assets. At typical panel widths, tab overflow is certain — no scroll, no collapse, no overflow menu.

**FINDING [S-10]**: RightDock uses numeric index for active tab state, reset to 0 on mode change. No persistence of tab selection across mode switches.

**FINDING [S-11]**: PanelContent uses a long if-chain to map tab names → components. Tab names are strings ("Properties" appears in multiple modes) but maps to VectorPropertiesPanel in vector mode vs PalettePropsPanel in palette mode via completely different tab arrays. The "Properties" tab name is overloaded.

## 5. BottomDock (BottomDock.tsx)

~460 lines. Timeline panel with: transport controls (prev/play/next/loop), frame strip, frame management (add/dup/delete/reorder/insert), export shortcuts (Seq/Strip), onion skin toggles, silhouette toggle, frame count.

**FINDING [S-12]**: BottomDock conditionally shows ClipPanel and ExportPreviewPanel only when `frames.length > 1`. Single-frame projects get no export UI in the bottom dock. ExportPreviewPanel is a massive ~960-line component embedded in BottomDock.

**FINDING [S-13]**: Frame management buttons use Unicode symbols (+, ⎘, ✕) with no labels — pure symbol buttons. Discoverability depends entirely on hover titles.

**FINDING [S-14]**: Export buttons in timeline actions bar are abbreviated "Seq" and "Strip" — unclear without tooltip.

## 6. ProjectHome (ProjectHome.tsx)

Create form + workflow cards. Static/Animation mode toggle.

**FINDING [S-15]**: No "Open existing project" button visible in ProjectHome. File open is only via Ctrl+O from SpriteEditor (which is the wrong workspace — ProjectHome has no file open affordance).

**FINDING [S-16]**: Canvas size defaults to 64x64 with max 1024. No presets (32x32, 64x64, 128x128, 256x256). User must manually type common sizes.

## 7. TopBar (TopBar.tsx)

Mode tabs + project name + save status + hardcoded badges.

**FINDING [S-17]**: TopBar shows hardcoded `<span className="topbar-badge">RGB</span>` and `<span className="topbar-badge badge-ok">Valid</span>` — these are static text, not derived from actual state. They claim the document is "Valid" and in "RGB" mode regardless of actual state.

**FINDING [S-18]**: 9 mode tabs in the topbar (Edit, Animate, Palette, AI Assist, Locomotion, Validate, Export, Scene, Vector). This is a lot of modes — tab bar likely wraps or overflows on narrower windows.

## 8. TransformBar (TransformBar.tsx)

Context-sensitive toolbar. Only appears when `isTransforming === true`.

**FINDING [S-19]**: Clean implementation. Shows Flip H, Flip V, Rot CW, Rot CCW + Commit/Cancel. Correct conditional render pattern.

## 9. SpriteEditor (SpriteEditor.tsx)

Alternative layout shell for the sprite editing subsystem. Has its own tool rail, palette, layers, frame strip, import/export bar, and shortcut system.

**FINDING [S-20]**: SpriteEditor defines its own TOOL_SHORTCUTS map (m/b/e/g/i) that conflicts with the main SHORTCUT_MANIFEST (which uses B/E/G/L/U/C/M/Q/W/Y/V/T/K/S/I/N). SpriteEditor uses 'm' for select, 'i' for eyedropper — but the main manifest uses M for marquee, I for measure. **This is a dual-shortcut-system problem.** SpriteEditor is a parallel universe with incompatible bindings.

**FINDING [S-21]**: SpriteEditor is never rendered from AppShell. It exists as a standalone component but is not wired into the workspace mode system. Dead code or a parallel editing path that was superseded.

## Component Count by Category

| Category | Count | Components |
|----------|-------|------------|
| Core layout | 6 | AppShell, TopBar, ToolRail, TransformBar, RightDock, BottomDock |
| Canvas/editing | 3 | Canvas, SpriteCanvasArea, SpriteEditor (dead?) |
| Right dock panels | 22 | LayerPanel, PalettePropsPanel, AnchorPanel, ReferencePanel, AnalysisPanel, ValidationPanel, ClipPanel, CameraKeyframePanel, MotionPanel, PresetPanel, SceneInstancesPanel, SceneProvenancePanel, SnapshotPanel, ExportPreviewPanel, VectorShapesPanel, VectorPropertiesPanel, VectorReductionPanel, VectorCopilotPanel, VectorAICreationPanel, CopilotPanel, AISettingsPanel, ComfyUIGeneratePanel |
| Bottom dock panels | 4 | MotionPanel, AnchorPanel, SandboxPanel, PresetPanel |
| Scene-specific | 5 | SceneCanvas, ScenePlaybackControls, SceneProvenanceDrilldownPane, SceneComparisonPane, SceneRestorePreviewPane |
| Vector-specific | 5 | VectorWorkspace, VectorCanvas, VectorToolRail, VectorLivePreview, VectorSourceBanner |
| Home/onboarding | 3 | ProjectHome, RecoveryPrompt, WorkflowRunner |
| AI/copilot | 3 | CopilotPanel, AISettingsPanel, ComfyUIGeneratePanel |
| Templates/assets | 3 | TemplateBrowserPanel, AssetBrowserPanel, CharacterBuilderPanel |
| Sprite subsystem (dead?) | 5 | SpriteEditor, SpriteToolRail, SpriteCanvasArea, SpriteFrameStrip, SpriteImportExportBar, SpritePreviewBar, SpritePalettePanel, SpriteLayerPanel |
