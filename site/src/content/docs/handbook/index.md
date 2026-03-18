---
title: Welcome
description: GlyphStudio handbook — a craft-first desktop sprite studio
sidebar:
  order: 0
---

GlyphStudio is a desktop-native pixel sprite studio built with React, TypeScript, and Tauri v2.

It is designed around a simple thesis: **creative authority comes from deterministic editing**. AI is a subordinate assistant that operates inside bounded, reversible workflows — never the primary authoring path.

## What GlyphStudio is

- A serious desktop studio for building, editing, and animating pixel sprites
- A tool that rewards skill, muscle memory, and precise control
- A workspace where indexed palettes, timeline editing, and validation are first-class systems
- An AI-assisted environment where every generated result lands as an editable, provenance-tracked artifact

## What GlyphStudio is not

- A browser-based casual generator
- A prompt-and-pray image tool
- A tool where AI replaces manual craft

## Core product laws

1. Desktop-native studio, not a browser toy
2. Manual editing is first-class and never blocked behind AI
3. AI actions create editable outputs, not opaque final states
4. Deterministic operations expose parameters and are replayable
5. Probabilistic operations are clearly labeled and reversible
6. Animation and locomotion assistance are real features, not placeholder UI
7. Every feature increases control, quality, or repeatability

## Architecture

| Layer | Technology | Responsibility |
|-------|-----------|----------------|
| Frontend | React + TypeScript | UI, canvas, panels, state management |
| Desktop | Tauri v2 + Rust | Filesystem, transforms, AI orchestration, validation |
| AI | Ollama + ComfyUI | Structured prompting, image generation, analysis |

## Next steps

- [Getting Started](getting-started/) — set up your development environment
- [Workspace Guide](workspace/) — understand the eight workspace modes
- [Architecture](architecture/) — how the frontend and backend fit together
- [Production Workflows](production/) — variants, reusable parts, templates, packs, and bundle export
