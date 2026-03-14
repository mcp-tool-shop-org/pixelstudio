---
title: Getting Started
description: Set up PixelStudio for development
sidebar:
  order: 1
---

PixelStudio is a monorepo using pnpm workspaces with a Tauri v2 desktop app at its center.

## Prerequisites

- **Node.js** 20+
- **pnpm** 9+
- **Rust** 1.75+ (via [rustup](https://rustup.rs/))
- **Tauri v2 prerequisites** — see the [Tauri docs](https://v2.tauri.app/start/prerequisites/)

## Clone and install

```bash
git clone https://github.com/mcp-tool-shop-org/pixelstudio.git
cd pixelstudio
pnpm install
```

## Project structure

```
pixelstudio/
  apps/desktop/           # Tauri v2 + React app
    src/                  # React components and styles
    src-tauri/            # Rust backend
  packages/
    domain/               # Pure TypeScript types
    api-contract/         # Tauri command/event payloads
    state/                # Zustand store slices
```

## Typecheck

```bash
pnpm typecheck
```

This runs `tsc --noEmit` across all four packages — domain, api-contract, state, and the desktop app.

## Run the desktop app

```bash
pnpm dev
```

This starts the Vite dev server and launches the Tauri window with hot module replacement.

## Rust backend

The Rust backend lives in `apps/desktop/src-tauri/` and compiles automatically when you run `pnpm dev`. To check the Rust code independently:

```bash
cd apps/desktop/src-tauri
cargo check
```
