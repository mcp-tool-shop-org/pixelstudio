import { describe, it, expect, beforeEach } from 'vitest';
import { createGlyphStudioServer } from './server.js';
import { SessionManager } from './session/sessionManager.js';
import {
  storeNewDocument,
  storeGetDocumentSummary,
  storeSaveDocument,
  storeCloseDocument,
  storeAddFrame,
} from './adapters/storeAdapter.js';

describe('createGlyphStudioServer', () => {
  it('creates a server with session manager', () => {
    const { server, sessions } = createGlyphStudioServer();
    expect(server).toBeDefined();
    expect(sessions).toBeInstanceOf(SessionManager);
  });

  it('accepts a custom session manager', () => {
    const custom = new SessionManager();
    const { sessions } = createGlyphStudioServer({ sessions: custom });
    expect(sessions).toBe(custom);
  });
});

describe('MCP server integration (via session manager)', () => {
  let sessions: SessionManager;

  beforeEach(() => {
    const result = createGlyphStudioServer();
    sessions = result.sessions;
  });

  it('full session lifecycle: create → new doc → summary → save → close → destroy', () => {
    // Create session
    const sessionId = sessions.create();
    const store = sessions.getStore(sessionId)!;

    // Create document
    storeNewDocument(store, 'IntegrationTest', 32, 32);
    expect(store.getState().document).not.toBeNull();

    // Get summary
    const summary = storeGetDocumentSummary(store)!;
    expect(summary.name).toBe('IntegrationTest');
    expect(summary.width).toBe(32);
    expect(summary.frameCount).toBe(1);

    // Save
    const saveResult = storeSaveDocument(store);
    expect('json' in saveResult).toBe(true);

    // Close document
    storeCloseDocument(store);
    expect(store.getState().document).toBeNull();

    // Destroy session
    sessions.destroy(sessionId);
    expect(sessions.has(sessionId)).toBe(false);
  });

  it('multi-session isolation', () => {
    const id1 = sessions.create();
    const id2 = sessions.create();

    const store1 = sessions.getStore(id1)!;
    const store2 = sessions.getStore(id2)!;

    storeNewDocument(store1, 'Sprite A', 16, 16);
    storeNewDocument(store2, 'Sprite B', 64, 64);

    expect(store1.getState().document!.name).toBe('Sprite A');
    expect(store2.getState().document!.name).toBe('Sprite B');

    // Modifying one doesn't affect the other
    storeAddFrame(store1);
    expect(store1.getState().document!.frames).toHaveLength(2);
    expect(store2.getState().document!.frames).toHaveLength(1);
  });

  it('lists sessions with document info', () => {
    const id1 = sessions.create();
    const id2 = sessions.create();

    storeNewDocument(sessions.getStore(id1)!, 'DocA', 8, 8);

    const list = sessions.list();
    expect(list).toHaveLength(2);

    const withDoc = list.find((s) => s.id === id1)!;
    const empty = list.find((s) => s.id === id2)!;

    expect(withDoc.documentName).toBe('DocA');
    expect(empty.documentName).toBeNull();
  });
});
