# Ship Gate

> No repo is "done" until every applicable line is checked.

**Detected tags:** `[all]` `[desktop]`

---

## A. Security Baseline

- [x] `[all]` SECURITY.md exists (report email, supported versions, response timeline) (2026-03-16)
- [x] `[all]` README includes threat model paragraph (data touched, data NOT touched, permissions required) (2026-03-16)
- [x] `[all]` No secrets, tokens, or credentials in source or diagnostics output (2026-03-16)
- [x] `[all]` No telemetry by default — state it explicitly even if obvious (2026-03-16)

### Default safety posture

- [x] `[desktop]` Dangerous actions (delete frame/layer) require explicit user action — no silent destructive operations (2026-03-16)
- [x] `[desktop]` File operations constrained to user-selected directories via Tauri v2 native file dialogs (2026-03-16)
- [ ] `[mcp]` SKIP: not an MCP server
- [ ] `[mcp]` SKIP: not an MCP server

## B. Error Handling

- [ ] `[all]` SKIP: desktop app uses UI-level error display (error spans in components), not structured error shapes
- [ ] `[cli]` SKIP: not a CLI tool
- [ ] `[cli]` SKIP: not a CLI tool
- [ ] `[mcp]` SKIP: not an MCP server
- [ ] `[mcp]` SKIP: not an MCP server
- [x] `[desktop]` Errors shown as user-friendly messages — no raw exceptions in UI (2026-03-16)
- [ ] `[vscode]` SKIP: not a VS Code extension

## C. Operator Docs

- [x] `[all]` README is current: what it does, install, usage, supported platforms + runtime versions (2026-03-16)
- [x] `[all]` CHANGELOG.md (Keep a Changelog format) (2026-03-16)
- [x] `[all]` LICENSE file present and repo states support status (2026-03-16)
- [ ] `[cli]` SKIP: not a CLI tool
- [ ] `[cli|mcp|desktop]` SKIP: desktop app uses Tauri logging — no user-configurable log levels in v1
- [ ] `[mcp]` SKIP: not an MCP server
- [x] `[complex]` Handbook exists with getting started, architecture, workspace, and API reference (2026-03-16)

## D. Shipping Hygiene

- [x] `[all]` `verify` script exists — `pnpm verify` runs test + typecheck (2026-03-16)
- [x] `[all]` Version in manifest: 1.0.0 across package.json, desktop/package.json, Cargo.toml (2026-03-16)
- [ ] `[all]` SKIP: private monorepo, not published — no CI dependency scanning configured
- [ ] `[all]` SKIP: private monorepo — dependabot not configured
- [ ] `[npm]` SKIP: private, not published to npm
- [ ] `[npm]` SKIP: private, not published to npm
- [ ] `[npm]` SKIP: pnpm-lock.yaml committed, but npm-specific checks N/A
- [ ] `[vsix]` SKIP: not a VS Code extension
- [x] `[desktop]` App builds and runs via `pnpm dev` on Windows (Tauri v2) (2026-03-16)

## E. Identity (soft gate — does not block ship)

- [ ] `[all]` Logo in README header
- [ ] `[all]` Translations (polyglot-mcp, 8 languages)
- [x] `[org]` Landing page — Starlight handbook site deployed via GitHub Pages (2026-03-16)
- [x] `[all]` GitHub repo metadata: description, homepage, topics (2026-03-16)

---

## Gate Rules

**Hard gate (A–D):** Must pass before any version is tagged or published.
If a section doesn't apply, mark `SKIP:` with justification — don't leave it unchecked.

**Soft gate (E):** Should be done. Product ships without it, but isn't "whole."
