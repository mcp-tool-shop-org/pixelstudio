# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/),
and this project adheres to [Semantic Versioning](https://semver.org/).

## [1.0.1] - 2026-03-25

### Fixed
- MCP sprite server no longer uses hardcoded version — reads dynamically from package.json

### Added
- `version.ts` module for MCP sprite server with dynamic version/name exports
- 3 new version tests for MCP sprite server

## [1.0.0] - 2026-03-16

### Added

- **Canvas Editor (Rust backend):** deterministic pixel canvas with layers, stroke-based drawing, undo/redo, rectangular selection, clipboard, transforms, multi-frame timeline, onion skin, playback, motion assistance, anchors, secondary motion, motion presets, clips, sprite sheet export, asset catalog, project save/load, autosave, crash recovery
- **Scene Compositor:** scene composition with asset instances, z-ordering, camera system with keyframe animation, character build system, scene undo/redo, persisted provenance, scene comparison and restore workflows
- **Sprite Editor (frontend-only):** pixel editor with pencil, eraser, fill, eyedropper tools, multi-layer editing with alpha compositing, frame management with onion skin and playback, rectangular selection with clipboard, sprite sheet import/export, palette panel, animation preview with per-frame duration editing
- **Sprite Persistence:** native .glyph file format with save/load/save-as via Tauri file dialogs (Ctrl+S/Ctrl+Shift+S/Ctrl+O)
- **Animation Export:** animated GIF export with authored timing, sprite sheet + JSON metadata export, PNG frame export
- **Desktop Shell:** Tauri v2 native window with 166 Rust commands
- **Documentation:** handbook with getting started, architecture, workspace, and API reference guides
- **Tests:** 2,658 tests across desktop app and state packages
