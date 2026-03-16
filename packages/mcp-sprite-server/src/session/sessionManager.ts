/**
 * Session manager — tracks multiple concurrent sprite editing sessions.
 *
 * Each session owns a headless Zustand store instance.
 * Sessions are identified by a unique ID and can be listed, created, and destroyed.
 */

import { createHeadlessStore, type HeadlessStore } from '../adapters/storeAdapter.js';

export interface SessionInfo {
  id: string;
  createdAt: string;
  documentName: string | null;
  dirty: boolean;
}

export class SessionManager {
  private sessions = new Map<string, { store: HeadlessStore; createdAt: string }>();
  private nextId = 1;

  /** Create a new session with an empty store. Returns the session ID. */
  create(): string {
    const id = `session_${this.nextId++}`;
    const store = createHeadlessStore();
    this.sessions.set(id, { store, createdAt: new Date().toISOString() });
    return id;
  }

  /** Get the store for a session, or null if it doesn't exist. */
  getStore(sessionId: string): HeadlessStore | null {
    return this.sessions.get(sessionId)?.store ?? null;
  }

  /** Destroy a session and release its store. */
  destroy(sessionId: string): boolean {
    return this.sessions.delete(sessionId);
  }

  /** List all active sessions. */
  list(): SessionInfo[] {
    const result: SessionInfo[] = [];
    for (const [id, entry] of this.sessions) {
      const state = entry.store.getState();
      result.push({
        id,
        createdAt: entry.createdAt,
        documentName: state.document?.name ?? null,
        dirty: state.dirty,
      });
    }
    return result;
  }

  /** Check if a session exists. */
  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  /** Get the number of active sessions. */
  get size(): number {
    return this.sessions.size;
  }
}
