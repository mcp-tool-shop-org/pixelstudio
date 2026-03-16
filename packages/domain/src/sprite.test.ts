import { describe, it, expect } from 'vitest';
import {
  createSpriteDocument,
  createSpriteFrame,
  createBlankPixelBuffer,
  createDefaultSpriteEditorState,
  DEFAULT_SPRITE_TOOL_CONFIG,
  DEFAULT_SPRITE_ONION_SKIN,
  DEFAULT_SPRITE_PALETTE,
} from './sprite';
import type {
  SpriteDocument,
  SpriteFrame,
  SpritePixelBuffer,
  SpriteEditorState,
  SpriteToolConfig,
  SpriteOnionSkin,
  SpritePalette,
} from './sprite';

describe('sprite domain types', () => {
  describe('createSpriteDocument', () => {
    it('creates a document with correct dimensions', () => {
      const doc = createSpriteDocument('test', 32, 32);
      expect(doc.name).toBe('test');
      expect(doc.width).toBe(32);
      expect(doc.height).toBe(32);
    });

    it('creates a document with one initial frame', () => {
      const doc = createSpriteDocument('test', 16, 16);
      expect(doc.frames).toHaveLength(1);
      expect(doc.frames[0].index).toBe(0);
    });

    it('generates a unique ID', () => {
      const a = createSpriteDocument('a', 8, 8);
      const b = createSpriteDocument('b', 8, 8);
      expect(a.id).not.toBe(b.id);
    });

    it('sets timestamps', () => {
      const doc = createSpriteDocument('test', 16, 16);
      expect(doc.createdAt).toBeTruthy();
      expect(doc.updatedAt).toBeTruthy();
    });

    it('includes default palette', () => {
      const doc = createSpriteDocument('test', 16, 16);
      expect(doc.palette.colors.length).toBeGreaterThan(0);
      expect(doc.palette.foregroundIndex).toBe(1);
      expect(doc.palette.backgroundIndex).toBe(0);
    });
  });

  describe('createSpriteFrame', () => {
    it('creates a frame with correct index', () => {
      const frame = createSpriteFrame(3);
      expect(frame.index).toBe(3);
      expect(frame.durationMs).toBe(100);
    });

    it('accepts custom duration', () => {
      const frame = createSpriteFrame(0, 200);
      expect(frame.durationMs).toBe(200);
    });

    it('generates a unique ID', () => {
      const a = createSpriteFrame(0);
      const b = createSpriteFrame(0);
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('createBlankPixelBuffer', () => {
    it('creates a buffer with correct dimensions', () => {
      const buf = createBlankPixelBuffer(8, 8);
      expect(buf.width).toBe(8);
      expect(buf.height).toBe(8);
    });

    it('creates a buffer with correct data length', () => {
      const buf = createBlankPixelBuffer(16, 16);
      expect(buf.data.length).toBe(16 * 16 * 4);
    });

    it('creates a buffer filled with transparent pixels', () => {
      const buf = createBlankPixelBuffer(4, 4);
      for (let i = 0; i < buf.data.length; i++) {
        expect(buf.data[i]).toBe(0);
      }
    });

    it('uses Uint8ClampedArray', () => {
      const buf = createBlankPixelBuffer(2, 2);
      expect(buf.data).toBeInstanceOf(Uint8ClampedArray);
    });
  });

  describe('createDefaultSpriteEditorState', () => {
    it('returns default editor state', () => {
      const state = createDefaultSpriteEditorState();
      expect(state.activeFrameIndex).toBe(0);
      expect(state.zoom).toBe(8);
      expect(state.panX).toBe(0);
      expect(state.panY).toBe(0);
      expect(state.dirty).toBe(false);
    });

    it('includes default tool config', () => {
      const state = createDefaultSpriteEditorState();
      expect(state.tool.activeTool).toBe('pencil');
      expect(state.tool.brushSize).toBe(1);
      expect(state.tool.brushShape).toBe('square');
      expect(state.tool.pixelPerfect).toBe(false);
    });

    it('includes default onion skin config', () => {
      const state = createDefaultSpriteEditorState();
      expect(state.onionSkin.enabled).toBe(false);
      expect(state.onionSkin.framesBefore).toBe(1);
      expect(state.onionSkin.framesAfter).toBe(1);
      expect(state.onionSkin.opacity).toBe(0.3);
    });
  });

  describe('DEFAULT_SPRITE_PALETTE', () => {
    it('has at least 2 colors', () => {
      expect(DEFAULT_SPRITE_PALETTE.colors.length).toBeGreaterThanOrEqual(2);
    });

    it('first color is transparent', () => {
      expect(DEFAULT_SPRITE_PALETTE.colors[0].rgba[3]).toBe(0);
    });

    it('second color is opaque black', () => {
      const black = DEFAULT_SPRITE_PALETTE.colors[1];
      expect(black.rgba).toEqual([0, 0, 0, 255]);
    });
  });
});
