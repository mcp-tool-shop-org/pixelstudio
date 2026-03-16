import { describe, it, expect, beforeEach } from 'vitest';
import { SessionManager } from './sessionManager.js';
import { storeNewDocument } from '../adapters/storeAdapter.js';

describe('SessionManager', () => {
  let mgr: SessionManager;

  beforeEach(() => {
    mgr = new SessionManager();
  });

  it('creates a session and returns an ID', () => {
    const id = mgr.create();
    expect(id).toMatch(/^session_/);
    expect(mgr.has(id)).toBe(true);
    expect(mgr.size).toBe(1);
  });

  it('creates unique session IDs', () => {
    const a = mgr.create();
    const b = mgr.create();
    expect(a).not.toBe(b);
    expect(mgr.size).toBe(2);
  });

  it('returns a store for a valid session', () => {
    const id = mgr.create();
    const store = mgr.getStore(id);
    expect(store).not.toBeNull();
    expect(store!.getState().document).toBeNull();
  });

  it('returns null for an unknown session', () => {
    expect(mgr.getStore('bogus')).toBeNull();
  });

  it('destroys a session', () => {
    const id = mgr.create();
    expect(mgr.destroy(id)).toBe(true);
    expect(mgr.has(id)).toBe(false);
    expect(mgr.size).toBe(0);
  });

  it('lists sessions with metadata', () => {
    const id = mgr.create();
    const list = mgr.list();
    expect(list).toHaveLength(1);
    expect(list[0].id).toBe(id);
    expect(list[0].documentName).toBeNull();
    expect(list[0].dirty).toBe(false);
  });

  it('reflects document name after creation', () => {
    const id = mgr.create();
    const store = mgr.getStore(id)!;
    storeNewDocument(store, 'TestSprite', 32, 32);

    const list = mgr.list();
    expect(list[0].documentName).toBe('TestSprite');
  });
});
