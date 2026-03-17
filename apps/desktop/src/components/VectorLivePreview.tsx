import { useRef, useEffect, useMemo, useCallback, useState } from 'react';
import { useVectorMasterStore, useSizeProfileStore, rasterizeVectorMaster } from '@glyphstudio/state';
import type { SizeProfile, SpritePixelBuffer } from '@glyphstudio/domain';

/**
 * VectorLivePreview — compact always-visible reduction preview strip.
 *
 * Renders 1-3 target sizes beside/below the canvas, refreshing live
 * as shapes move. Makes it impossible to forget what small sizes look like.
 */

const MAX_PREVIEWS = 3;
const DISPLAY_HEIGHT = 64;

function renderPreviewPanel(
  canvas: HTMLCanvasElement,
  buf: SpritePixelBuffer,
  profile: SizeProfile,
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const scale = Math.max(1, Math.floor(DISPLAY_HEIGHT / profile.targetHeight));
  const panelW = buf.width * scale;
  const panelH = buf.height * scale;

  canvas.width = panelW;
  canvas.height = panelH;

  // Checkerboard background
  const checkSize = Math.max(2, scale);
  for (let cy = 0; cy < panelH; cy += checkSize) {
    for (let cx = 0; cx < panelW; cx += checkSize) {
      const isLight = ((Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2) === 0;
      ctx.fillStyle = isLight ? '#2a2a2a' : '#222';
      ctx.fillRect(cx, cy, checkSize, checkSize);
    }
  }

  // Pixel-perfect upscale
  const imageData = ctx.createImageData(panelW, panelH);
  for (let py = 0; py < buf.height; py++) {
    for (let px = 0; px < buf.width; px++) {
      const si = (py * buf.width + px) * 4;
      const r = buf.data[si], g = buf.data[si + 1], b = buf.data[si + 2], a = buf.data[si + 3];
      if (a === 0) continue;
      for (let sy = 0; sy < scale; sy++) {
        for (let sx = 0; sx < scale; sx++) {
          const di = ((py * scale + sy) * panelW + (px * scale + sx)) * 4;
          imageData.data[di] = r;
          imageData.data[di + 1] = g;
          imageData.data[di + 2] = b;
          imageData.data[di + 3] = a;
        }
      }
    }
  }
  ctx.putImageData(imageData, 0, 0);

  // Border
  ctx.strokeStyle = '#444';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, panelW - 1, panelH - 1);
}

interface PreviewItem {
  profile: SizeProfile;
  buf: SpritePixelBuffer;
}

export function VectorLivePreview() {
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const doc = useVectorMasterStore((s) => s.document);
  const docUpdatedAt = useVectorMasterStore((s) => s.document?.updatedAt);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);
  const [collapsed, setCollapsed] = useState(false);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  // Pick up to MAX_PREVIEWS profiles, prioritizing smallest first
  const previewProfiles = useMemo(() => {
    if (activeProfiles.length === 0) return [];
    return [...activeProfiles]
      .sort((a, b) => (a.targetWidth * a.targetHeight) - (b.targetWidth * b.targetHeight))
      .slice(0, MAX_PREVIEWS);
  }, [activeProfiles]);

  // Rasterize all preview profiles
  const previews = useMemo((): PreviewItem[] => {
    if (!doc || previewProfiles.length === 0) return [];
    return previewProfiles.map((profile) => ({
      profile,
      buf: rasterizeVectorMaster(doc, profile.targetWidth, profile.targetHeight),
    }));
  }, [doc, previewProfiles, docUpdatedAt]);

  // Render to canvases
  useEffect(() => {
    for (let i = 0; i < previews.length; i++) {
      const canvas = canvasRefs.current[i];
      if (canvas) {
        renderPreviewPanel(canvas, previews[i].buf, previews[i].profile);
      }
    }
  }, [previews]);

  if (!doc || previewProfiles.length === 0) return null;

  return (
    <div className={`vector-live-preview ${collapsed ? 'collapsed' : ''}`}>
      <button
        className="live-preview-toggle"
        onClick={() => setCollapsed(!collapsed)}
        title={collapsed ? 'Show preview' : 'Hide preview'}
      >
        {collapsed ? 'Preview +' : 'Preview -'}
      </button>
      {!collapsed && (
        <div className="live-preview-strip">
          {previews.map((item, i) => (
            <div key={item.profile.id} className="live-preview-panel">
              <canvas
                ref={(el) => { canvasRefs.current[i] = el; }}
                className="live-preview-canvas"
              />
              <span className="live-preview-label">
                {item.profile.targetWidth}x{item.profile.targetHeight}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
