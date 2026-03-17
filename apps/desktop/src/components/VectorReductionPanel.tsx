import { useEffect, useRef, useMemo, useCallback, useState } from 'react';
import { useVectorMasterStore, useSizeProfileStore, useSpriteEditorStore, rasterizeVectorMaster, analyzeReduction, vectorToSpriteHandoff } from '@glyphstudio/state';
import type { SizeProfile, ReductionReport, SpritePixelBuffer } from '@glyphstudio/domain';

/**
 * VectorReductionPanel — size profile selector + multi-size preview + reduction analysis.
 *
 * Shows all size profiles with toggle checkboxes, renders a live upscaled
 * preview strip for active profiles, and displays reduction analysis
 * (collapsed/survived shapes, fill %, silhouette bounds) per profile.
 */

// ── Preview rendering ──

function renderPreviewStrip(
  canvasEl: HTMLCanvasElement,
  doc: ReturnType<typeof useVectorMasterStore.getState>['document'],
  activeProfiles: SizeProfile[],
): void {
  const ctx = canvasEl.getContext('2d');
  if (!ctx || !doc || activeProfiles.length === 0) {
    if (ctx) {
      canvasEl.width = 200;
      canvasEl.height = 60;
      ctx.fillStyle = '#1a1a1a';
      ctx.fillRect(0, 0, 200, 60);
      ctx.fillStyle = '#666';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('Select profiles to preview', 100, 34);
    }
    return;
  }

  const GAP = 6;
  const DISPLAY_HEIGHT = 128;
  const LABEL_HEIGHT = 18;

  // Rasterize each active profile
  const panels: { buf: SpritePixelBuffer; profile: SizeProfile; scale: number }[] = [];
  for (const profile of activeProfiles) {
    const buf = rasterizeVectorMaster(doc, profile.targetWidth, profile.targetHeight);
    const scale = Math.max(1, Math.floor(DISPLAY_HEIGHT / profile.targetHeight));
    panels.push({ buf, profile, scale });
  }

  // Calculate canvas dimensions
  const totalWidth = panels.reduce(
    (sum, p) => sum + p.buf.width * p.scale,
    0,
  ) + GAP * (panels.length - 1);
  const totalHeight = DISPLAY_HEIGHT + LABEL_HEIGHT;

  canvasEl.width = Math.max(totalWidth, 200);
  canvasEl.height = totalHeight;

  // Fill background
  ctx.fillStyle = '#1a1a1a';
  ctx.fillRect(0, 0, canvasEl.width, canvasEl.height);

  // Draw each panel
  let xOffset = 0;
  for (const { buf, profile, scale } of panels) {
    const panelW = buf.width * scale;
    const panelH = buf.height * scale;
    const yOffset = Math.floor((DISPLAY_HEIGHT - panelH) / 2);

    // Draw checkerboard background for transparency
    const checkSize = Math.max(2, scale);
    for (let cy = 0; cy < panelH; cy += checkSize) {
      for (let cx = 0; cx < panelW; cx += checkSize) {
        const isLight = ((Math.floor(cx / checkSize) + Math.floor(cy / checkSize)) % 2) === 0;
        ctx.fillStyle = isLight ? '#2a2a2a' : '#222';
        ctx.fillRect(xOffset + cx, yOffset + cy, checkSize, checkSize);
      }
    }

    // Draw pixel-perfect upscaled pixels
    const imageData = ctx.createImageData(panelW, panelH);
    for (let py = 0; py < buf.height; py++) {
      for (let px = 0; px < buf.width; px++) {
        const si = (py * buf.width + px) * 4;
        const r = buf.data[si];
        const g = buf.data[si + 1];
        const b = buf.data[si + 2];
        const a = buf.data[si + 3];
        if (a === 0) continue;
        // Fill scaled block
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
    ctx.putImageData(imageData, xOffset, yOffset);

    // Draw border
    ctx.strokeStyle = '#444';
    ctx.lineWidth = 1;
    ctx.strokeRect(xOffset - 0.5, yOffset - 0.5, panelW + 1, panelH + 1);

    // Draw label
    ctx.fillStyle = '#aaa';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(
      `${profile.targetWidth}×${profile.targetHeight}`,
      xOffset + panelW / 2,
      DISPLAY_HEIGHT + LABEL_HEIGHT - 4,
    );

    xOffset += panelW + GAP;
  }
}

// ── Reduction report row ──

function ReductionRow({ report, profiles, shapes }: {
  report: ReductionReport;
  profiles: SizeProfile[];
  shapes: { id: string; name: string }[];
}) {
  const profile = profiles.find((p) => p.id === report.profileId);
  const label = profile ? `${profile.targetWidth}×${profile.targetHeight}` : report.profileId;
  const collapsedNames = report.collapsedShapeIds.map((id) => {
    const s = shapes.find((sh) => sh.id === id);
    return s ? s.name : id.slice(0, 8);
  });

  const hasCollapsed = report.collapsedShapeIds.length > 0;

  return (
    <div className={`reduction-row ${hasCollapsed ? 'has-collapsed' : ''}`}>
      <div className="reduction-row-header">
        <span className="reduction-size-label">{label}</span>
        <span className="reduction-fill-badge">{report.fillPercent.toFixed(1)}% fill</span>
      </div>
      <div className="reduction-row-stats">
        <span className="reduction-stat survived">{report.survivedShapeIds.length} survived</span>
        <span className="reduction-stat collapsed">{report.collapsedShapeIds.length} collapsed</span>
      </div>
      {report.silhouetteBounds.w > 0 && (
        <div className="reduction-silhouette">
          Silhouette: {report.silhouetteBounds.w}×{report.silhouetteBounds.h}px
          @ ({report.silhouetteBounds.x}, {report.silhouetteBounds.y})
        </div>
      )}
      {hasCollapsed && (
        <div className="reduction-collapsed-list">
          Collapsed: {collapsedNames.join(', ')}
        </div>
      )}
    </div>
  );
}

// ── Main panel ──

export function VectorReductionPanel() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doc = useVectorMasterStore((s) => s.document);
  const shapes = useVectorMasterStore((s) => s.document?.shapes ?? []);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);
  const toggleProfile = useSizeProfileStore((s) => s.toggleProfile);
  const activateAll = useSizeProfileStore((s) => s.activateAll);
  const deactivateAll = useSizeProfileStore((s) => s.deactivateAll);
  const addProfile = useSizeProfileStore((s) => s.addProfile);
  const removeProfile = useSizeProfileStore((s) => s.removeProfile);

  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newWidth, setNewWidth] = useState('32');
  const [newHeight, setNewHeight] = useState('32');
  const [handoffProfileId, setHandoffProfileId] = useState<string>('');

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  // Compute reduction reports
  const reports = useMemo(() => {
    if (!doc || activeProfiles.length === 0) return [];
    return analyzeReduction(doc, activeProfiles);
  }, [doc, activeProfiles]);

  // Render preview strip
  const renderPreview = useCallback(() => {
    if (canvasRef.current) {
      renderPreviewStrip(canvasRef.current, doc, activeProfiles);
    }
  }, [doc, activeProfiles]);

  useEffect(() => {
    renderPreview();
  }, [renderPreview]);

  const handleAddProfile = () => {
    const w = parseInt(newWidth, 10);
    const h = parseInt(newHeight, 10);
    if (!newName.trim() || isNaN(w) || isNaN(h) || w < 1 || h < 1) return;
    addProfile(newName.trim(), w, h);
    setNewName('');
    setNewWidth('32');
    setNewHeight('32');
    setShowAddForm(false);
  };

  const shapeInfo = useMemo(
    () => shapes.map((s) => ({ id: s.id, name: s.name })),
    [shapes],
  );

  const handleHandoff = useCallback(() => {
    if (!doc || !handoffProfileId) return;
    const profile = profiles.find((p) => p.id === handoffProfileId);
    if (!profile) return;
    const result = vectorToSpriteHandoff(doc, profile);
    // Load the rasterized sprite into the sprite editor
    const spriteStore = useSpriteEditorStore.getState();
    const firstLayer = result.document.frames[0].layers[0];
    useSpriteEditorStore.setState({
      document: result.document,
      pixelBuffers: result.pixelBuffers,
      activeLayerId: firstLayer.id,
      filePath: null,
      activeFrameIndex: 0,
      selectionRect: null,
      selectionBuffer: null,
      clipboardBuffer: null,
      vectorSourceLink: result.sourceLink,
      isPlaying: false,
      zoom: Math.max(4, Math.floor(256 / profile.targetWidth)),
      panX: 0,
      panY: 0,
      dirty: true,
    });
    // Signal mode switch to edit
    window.dispatchEvent(new CustomEvent('glyphstudio:handoff-to-edit'));
  }, [doc, handoffProfileId, profiles]);

  return (
    <div className="vector-reduction-panel">
      {/* Size Profile Selector */}
      <div className="prop-section-header">Size Profiles</div>
      <div className="reduction-profile-actions">
        <button className="reduction-action-btn" onClick={activateAll}>All</button>
        <button className="reduction-action-btn" onClick={deactivateAll}>None</button>
        <button className="reduction-action-btn" onClick={() => setShowAddForm(!showAddForm)}>
          {showAddForm ? 'Cancel' : '+ Custom'}
        </button>
      </div>

      {showAddForm && (
        <div className="reduction-add-form">
          <input
            className="prop-input"
            placeholder="Name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
          />
          <div className="reduction-add-dims">
            <input
              className="prop-input-num"
              type="number"
              min={1}
              max={512}
              value={newWidth}
              onChange={(e) => setNewWidth(e.target.value)}
            />
            <span className="reduction-dim-x">×</span>
            <input
              className="prop-input-num"
              type="number"
              min={1}
              max={512}
              value={newHeight}
              onChange={(e) => setNewHeight(e.target.value)}
            />
          </div>
          <button className="reduction-action-btn" onClick={handleAddProfile}>Add</button>
        </div>
      )}

      <div className="reduction-profile-list">
        {profiles.map((profile) => {
          const isActive = activeProfileIds.includes(profile.id);
          const isBuiltIn = profile.id.startsWith('sp_') && !profile.id.includes('_1');
          return (
            <div key={profile.id} className={`reduction-profile-row ${isActive ? 'active' : ''}`}>
              <label className="reduction-profile-label">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => toggleProfile(profile.id)}
                />
                <span className="reduction-profile-size">
                  {profile.targetWidth}×{profile.targetHeight}
                </span>
                <span className="reduction-profile-name">{profile.name}</span>
              </label>
              {!isBuiltIn && (
                <button
                  className="reduction-remove-btn"
                  onClick={() => removeProfile(profile.id)}
                  title="Remove custom profile"
                >×</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Multi-size Preview */}
      <div className="prop-section-header">Preview</div>
      <div className="reduction-preview-container">
        <canvas ref={canvasRef} className="reduction-preview-canvas" />
      </div>

      {/* Reduction Analysis */}
      {reports.length > 0 && (
        <>
          <div className="prop-section-header">Reduction Analysis</div>
          <div className="reduction-analysis-list">
            {reports.map((report) => (
              <ReductionRow
                key={report.profileId}
                report={report}
                profiles={profiles}
                shapes={shapeInfo}
              />
            ))}
          </div>
        </>
      )}

      {/* Handoff to Sprite Editor */}
      {doc && activeProfiles.length > 0 && (
        <>
          <div className="prop-section-header">Hand Off</div>
          <div className="reduction-handoff-section">
            <select
              className="prop-input"
              value={handoffProfileId}
              onChange={(e) => setHandoffProfileId(e.target.value)}
            >
              <option value="">Choose size...</option>
              {activeProfiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.targetWidth}×{p.targetHeight} — {p.name}
                </option>
              ))}
            </select>
            <button
              className="reduction-handoff-btn"
              disabled={!handoffProfileId}
              onClick={handleHandoff}
            >
              Rasterize & Edit as Sprite
            </button>
            <span className="reduction-handoff-hint">
              Creates a new sprite at the chosen size for pixel cleanup.
            </span>
          </div>
        </>
      )}
    </div>
  );
}
