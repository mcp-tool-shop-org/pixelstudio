# Security Policy

## Supported Versions

| Version | Supported |
|---------|-----------|
| 1.0.x   | Yes       |

## Reporting a Vulnerability

Email: **64996768+mcp-tool-shop@users.noreply.github.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Version affected
- Potential impact

### Response timeline

| Action | Target |
|--------|--------|
| Acknowledge report | 48 hours |
| Assess severity | 7 days |
| Release fix | 30 days |

## Scope

GlyphStudio is a **desktop-only** pixel art editor.

- **Data touched:** local sprite files (.glyph, .pxs, .png), project autosave/recovery files in app data directory
- **Data NOT touched:** no network requests, no cloud storage, no remote APIs, no user accounts
- **No network egress** — the app never contacts external servers
- **No secrets handling** — does not read, store, or transmit credentials or API keys
- **No telemetry** is collected or sent
- **Permissions:** filesystem access scoped to user-selected directories via native file dialogs (Tauri v2 security model)
- **Rust backend:** pixel buffers are owned by the Rust process; frontend communicates via Tauri IPC commands only
