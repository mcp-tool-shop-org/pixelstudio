import { useCallback, useState } from 'react';
import {
  useSpriteEditorStore,
  useVectorMasterStore,
  useSizeProfileStore,
  regenerateFromVector,
  extractPaletteFromBuffer,
} from '@glyphstudio/state';

/**
 * VectorSourceBanner — shows when the current sprite was created from
 * a vector master handoff. Displays provenance info and a "Regenerate"
 * button to re-rasterize from the source.
 */
export function VectorSourceBanner() {
  const sourceLink = useSpriteEditorStore((s) => s.vectorSourceLink);
  const spriteDoc = useSpriteEditorStore((s) => s.document);
  const dirty = useSpriteEditorStore((s) => s.dirty);
  const vectorDoc = useVectorMasterStore((s) => s.document);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const [confirmRegenerate, setConfirmRegenerate] = useState(false);

  const handleRegenerate = useCallback(() => {
    if (!sourceLink || !spriteDoc) return;

    // If sprite has unsaved edits, require confirmation
    if (dirty && !confirmRegenerate) {
      setConfirmRegenerate(true);
      return;
    }

    const result = regenerateFromVector(vectorDoc, sourceLink, profiles);
    if (!result.success) {
      console.warn('Regeneration failed:', result.error);
      return;
    }

    // Replace the first layer's pixel buffer with the new rasterized output
    const firstLayer = spriteDoc.frames[0]?.layers[0];
    if (!firstLayer || !result.pixelBuffer) return;

    const palette = extractPaletteFromBuffer(result.pixelBuffer);

    useSpriteEditorStore.setState({
      pixelBuffers: {
        ...useSpriteEditorStore.getState().pixelBuffers,
        [firstLayer.id]: result.pixelBuffer,
      },
      vectorSourceLink: result.updatedLink ?? sourceLink,
      document: {
        ...spriteDoc,
        palette: {
          colors: palette,
          foregroundIndex: palette.length > 1 ? 1 : 0,
          backgroundIndex: 0,
        },
        updatedAt: new Date().toISOString(),
      },
      dirty: true,
    });
    setConfirmRegenerate(false);
  }, [sourceLink, spriteDoc, dirty, confirmRegenerate, vectorDoc, profiles]);

  if (!sourceLink) return null;

  const profile = profiles.find((p) => p.id === sourceLink.profileId);
  const profileLabel = profile
    ? `${profile.targetWidth}×${profile.targetHeight}`
    : sourceLink.profileId;

  const rasterDate = new Date(sourceLink.rasterizedAt);
  const timeStr = rasterDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const canRegenerate = !!vectorDoc;

  return (
    <div className="vector-source-banner">
      <div className="source-banner-info">
        <span className="source-banner-label">Vector Source</span>
        <span className="source-banner-profile">{profileLabel}</span>
        <span className="source-banner-time">Rasterized {timeStr}</span>
      </div>
      <div className="source-banner-actions">
        {confirmRegenerate ? (
          <>
            <span className="source-banner-warn">Unsaved edits will be lost!</span>
            <button className="source-banner-btn danger" onClick={handleRegenerate}>
              Confirm
            </button>
            <button className="source-banner-btn" onClick={() => setConfirmRegenerate(false)}>
              Cancel
            </button>
          </>
        ) : (
          <button
            className="source-banner-btn"
            disabled={!canRegenerate}
            onClick={handleRegenerate}
            title={canRegenerate ? 'Re-rasterize from vector master' : 'Open vector master first'}
          >
            Regenerate
          </button>
        )}
      </div>
    </div>
  );
}
