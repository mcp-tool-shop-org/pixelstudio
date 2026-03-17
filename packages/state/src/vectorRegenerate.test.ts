import { describe, it, expect } from 'vitest';
import {
  createVectorMasterDocument,
  createRectShape,
  BUILT_IN_SIZE_PROFILES,
} from '@glyphstudio/domain';
import type { VectorMasterDocument, VectorSourceLink } from '@glyphstudio/domain';
import { regenerateFromVector, checkRegenerationStatus } from './vectorRegenerate';

function makeDoc(): VectorMasterDocument {
  const doc = createVectorMasterDocument('Regen Test');
  const rect = createRectShape('body', 100, 100, 200, 200, [255, 0, 0, 255]);
  rect.zOrder = 0;
  doc.shapes.push(rect);
  return doc;
}

const LINK: VectorSourceLink = {
  sourceFile: 'test.glyphvec',
  sourceArtboardWidth: 500,
  sourceArtboardHeight: 500,
  profileId: 'sp_32x32',
  rasterizedAt: new Date().toISOString(),
};

describe('regenerateFromVector', () => {
  it('succeeds with valid inputs', () => {
    const doc = makeDoc();
    const result = regenerateFromVector(doc, LINK, BUILT_IN_SIZE_PROFILES);
    expect(result.success).toBe(true);
    expect(result.pixelBuffer).toBeDefined();
    expect(result.pixelBuffer!.width).toBe(32);
    expect(result.pixelBuffer!.height).toBe(32);
  });

  it('updates rasterizedAt timestamp', () => {
    const doc = makeDoc();
    const result = regenerateFromVector(doc, LINK, BUILT_IN_SIZE_PROFILES);
    expect(result.updatedLink).toBeDefined();
    expect(result.updatedLink!.rasterizedAt).not.toBe(LINK.rasterizedAt);
  });

  it('fails when source link is null', () => {
    const doc = makeDoc();
    const result = regenerateFromVector(doc, null, BUILT_IN_SIZE_PROFILES);
    expect(result.success).toBe(false);
    expect(result.error).toContain('No vector source link');
  });

  it('fails when vector doc is null', () => {
    const result = regenerateFromVector(null, LINK, BUILT_IN_SIZE_PROFILES);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not open');
  });

  it('fails when profile not found', () => {
    const doc = makeDoc();
    const badLink = { ...LINK, profileId: 'sp_nonexistent' };
    const result = regenerateFromVector(doc, badLink, BUILT_IN_SIZE_PROFILES);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not found');
  });

  it('rasterized output contains filled pixels', () => {
    const doc = makeDoc();
    const result = regenerateFromVector(doc, LINK, BUILT_IN_SIZE_PROFILES);
    const buf = result.pixelBuffer!;
    let hasColor = false;
    for (let i = 0; i < buf.data.length; i += 4) {
      if (buf.data[i + 3] > 0) { hasColor = true; break; }
    }
    expect(hasColor).toBe(true);
  });

  it('preserves source link fields except timestamp', () => {
    const doc = makeDoc();
    const result = regenerateFromVector(doc, LINK, BUILT_IN_SIZE_PROFILES);
    expect(result.updatedLink!.sourceFile).toBe(LINK.sourceFile);
    expect(result.updatedLink!.profileId).toBe(LINK.profileId);
    expect(result.updatedLink!.sourceArtboardWidth).toBe(500);
  });
});

describe('checkRegenerationStatus', () => {
  it('returns canRegenerate true when both doc and link exist', () => {
    const doc = makeDoc();
    const status = checkRegenerationStatus(doc, LINK);
    expect(status.canRegenerate).toBe(true);
  });

  it('returns false when no source link', () => {
    const doc = makeDoc();
    const status = checkRegenerationStatus(doc, null);
    expect(status.canRegenerate).toBe(false);
  });

  it('returns false when no vector doc', () => {
    const status = checkRegenerationStatus(null, LINK);
    expect(status.canRegenerate).toBe(false);
  });
});
