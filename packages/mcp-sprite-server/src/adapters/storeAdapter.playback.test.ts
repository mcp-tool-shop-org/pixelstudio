import { describe, it, expect, beforeEach } from 'vitest';
import {
  createHeadlessStore,
  storeNewDocument,
  storeAddFrame,
  storeGetPlaybackConfig,
  storeSetPlaybackConfig,
  storeGetPreviewState,
  storePreviewPlay,
  storePreviewStop,
  storePreviewSetFrame,
  storePreviewStepNext,
  storePreviewStepPrev,
  storeSetFrameDuration,
  storeSamplePixel,
  type HeadlessStore,
} from './storeAdapter.js';

describe('Playback config (authored)', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'PlaybackTest', 8, 8);
    storeAddFrame(store); // 2 frames for playback
  });

  it('gets playback config with frame durations', () => {
    const config = storeGetPlaybackConfig(store);
    expect('isLooping' in config).toBe(true);
    expect((config as any).isLooping).toBe(true);
    expect((config as any).frameDurations).toHaveLength(2);
  });

  it('sets looping config', () => {
    storeSetPlaybackConfig(store, { isLooping: false });
    const config = storeGetPlaybackConfig(store);
    expect((config as any).isLooping).toBe(false);
  });

  it('round-trips authored config', () => {
    storeSetPlaybackConfig(store, { isLooping: false });
    const config = storeGetPlaybackConfig(store);
    expect((config as any).isLooping).toBe(false);

    storeSetPlaybackConfig(store, { isLooping: true });
    const config2 = storeGetPlaybackConfig(store);
    expect((config2 as any).isLooping).toBe(true);
  });

  it('playback config set does not toggle preview play state', () => {
    storeSetPlaybackConfig(store, { isLooping: false });
    expect(store.getState().isPlaying).toBe(false);
  });

  it('returns error when no document', () => {
    const empty = createHeadlessStore();
    const result = storeGetPlaybackConfig(empty);
    expect('error' in result).toBe(true);
  });
});

describe('Preview (transient)', () => {
  let store: HeadlessStore;

  beforeEach(() => {
    store = createHeadlessStore();
    storeNewDocument(store, 'PreviewTest', 8, 8);
    storeAddFrame(store); // 2 frames
  });

  it('play starts preview', () => {
    const err = storePreviewPlay(store);
    expect(err).toBeNull();
    const preview = storeGetPreviewState(store);
    expect(preview.isPlaying).toBe(true);
  });

  it('stop ends preview', () => {
    storePreviewPlay(store);
    storePreviewStop(store);
    expect(storeGetPreviewState(store).isPlaying).toBe(false);
  });

  it('play/stop changes preview state only, not document pixels', () => {
    storePreviewPlay(store);
    expect(store.getState().dirty).toBe(true); // dirty from addFrame
    const sample = storeSamplePixel(store, 0, 0);
    expect((sample as any).rgba).toEqual([0, 0, 0, 0]);
    storePreviewStop(store);
  });

  it('play requires at least 2 frames', () => {
    const single = createHeadlessStore();
    storeNewDocument(single, 'Single', 8, 8);
    expect(storePreviewPlay(single)).toContain('2 frames');
  });

  it('set frame scrubs preview', () => {
    const err = storePreviewSetFrame(store, 0);
    expect(err).toBeNull();
    expect(store.getState().activeFrameIndex).toBe(0);
  });

  it('cannot scrub while playing', () => {
    storePreviewPlay(store);
    expect(storePreviewSetFrame(store, 0)).toContain('playing');
  });

  it('step next advances frame', () => {
    // Start at frame 1 (from addFrame). Go back to 0 first.
    storePreviewSetFrame(store, 0);
    const err = storePreviewStepNext(store);
    expect(err).toBeNull();
    expect(store.getState().activeFrameIndex).toBe(1);
  });

  it('step prev goes backward', () => {
    storePreviewSetFrame(store, 1);
    const err = storePreviewStepPrev(store);
    expect(err).toBeNull();
    expect(store.getState().activeFrameIndex).toBe(0);
  });

  it('step next at last frame returns error', () => {
    storePreviewSetFrame(store, 1);
    expect(storePreviewStepNext(store)).toContain('last frame');
  });

  it('step prev at first frame returns error', () => {
    storePreviewSetFrame(store, 0);
    expect(storePreviewStepPrev(store)).toContain('first frame');
  });

  it('cannot step while playing', () => {
    storePreviewPlay(store);
    expect(storePreviewStepNext(store)).toContain('playing');
    expect(storePreviewStepPrev(store)).toContain('playing');
  });

  it('preview tools do not mutate authored playback config', () => {
    storeSetPlaybackConfig(store, { isLooping: false });
    storePreviewPlay(store);
    storePreviewStop(store);
    const config = storeGetPlaybackConfig(store);
    expect((config as any).isLooping).toBe(false);
  });

  it('authored config and transient preview stay distinct', () => {
    storeSetPlaybackConfig(store, { isLooping: false });
    storePreviewPlay(store);
    const preview = storeGetPreviewState(store);
    expect(preview.isPlaying).toBe(true);
    expect(preview.isLooping).toBe(false); // authored config reflected
    storePreviewStop(store);
  });
});
