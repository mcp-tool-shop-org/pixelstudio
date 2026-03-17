import { useVectorMasterStore } from '@glyphstudio/state';
import type { SurvivalHint, PathGeometry } from '@glyphstudio/domain';
import { pathToggleClosed, pathConvertSegment, pathSetPointType, pathDeletePoint } from '@glyphstudio/domain';

function rgbaToHex(c: [number, number, number, number]): string {
  return '#' + [c[0], c[1], c[2]].map((v) => v.toString(16).padStart(2, '0')).join('');
}

export function VectorPropertiesPanel() {
  const doc = useVectorMasterStore((s) => s.document);
  const selectedIds = useVectorMasterStore((s) => s.selectedShapeIds);
  const setShapeName = useVectorMasterStore((s) => s.setShapeName);
  const setShapeTransform = useVectorMasterStore((s) => s.setShapeTransform);
  const setShapeReduction = useVectorMasterStore((s) => s.setShapeReduction);
  const setShapeGroup = useVectorMasterStore((s) => s.setShapeGroup);
  const duplicateShape = useVectorMasterStore((s) => s.duplicateShape);
  const setShapeGeometry = useVectorMasterStore((s) => s.setShapeGeometry);

  if (!doc || selectedIds.length === 0) {
    return (
      <div className="dock-panel-placeholder">
        <span className="placeholder-label">
          {doc ? 'No shape selected' : 'No vector document'}
        </span>
      </div>
    );
  }

  if (selectedIds.length > 1) {
    return (
      <div className="dock-panel-placeholder">
        <span className="placeholder-label">{selectedIds.length} shapes selected</span>
      </div>
    );
  }

  const shape = doc.shapes.find((s) => s.id === selectedIds[0]);
  if (!shape) return null;

  const t = shape.transform;
  const r = shape.reduction;

  return (
    <div className="vector-properties-panel">
      {/* Name */}
      <div className="prop-group">
        <label className="prop-label">Name</label>
        <input
          className="prop-input"
          value={shape.name}
          onChange={(e) => setShapeName(shape.id, e.target.value)}
        />
      </div>

      {/* Geometry info */}
      <div className="prop-group">
        <label className="prop-label">Type</label>
        <span className="prop-value">{shape.geometry.kind}</span>
      </div>

      {/* Path controls */}
      {shape.geometry.kind === 'path' && (() => {
        const geo = shape.geometry as PathGeometry;
        const segCount = geo.closed ? geo.points.length : geo.points.length - 1;
        return (
          <>
            <div className="prop-group">
              <label className="prop-label">Path</label>
              <span className="prop-value">
                {geo.points.length} pts, {segCount} segs, {geo.closed ? 'closed' : 'open'}
              </span>
            </div>
            <div className="prop-group">
              <button
                className="prop-action-btn"
                onClick={() => setShapeGeometry(shape.id, pathToggleClosed(geo))}
              >
                {geo.closed ? 'Open Path' : 'Close Path'}
              </button>
            </div>
            <div className="prop-group">
              <label className="prop-label">Points</label>
              <div className="path-point-list">
                {geo.points.map((pt, i) => (
                  <div key={i} className="path-point-row">
                    <span className="path-point-idx">{i}</span>
                    <span className="path-point-coords">
                      {Math.round(pt.x)},{Math.round(pt.y)}
                    </span>
                    <button
                      className={`path-point-type-btn ${pt.pointType === 'smooth' ? 'smooth' : 'corner'}`}
                      title={pt.pointType === 'smooth' ? 'Smooth (click for corner)' : 'Corner (click for smooth)'}
                      onClick={() => setShapeGeometry(shape.id, pathSetPointType(geo, i, pt.pointType === 'smooth' ? 'corner' : 'smooth'))}
                    >
                      {pt.pointType === 'smooth' ? '\u25CF' : '\u25A0'}
                    </button>
                    {geo.points.length > 2 && (
                      <button
                        className="shape-action-btn danger"
                        title="Delete point"
                        onClick={() => setShapeGeometry(shape.id, pathDeletePoint(geo, i))}
                      >
                        {'\u2715'}
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="prop-group">
              <label className="prop-label">Segments</label>
              <div className="path-point-list">
                {geo.segments.map((seg, i) => (
                  <div key={i} className="path-point-row">
                    <span className="path-point-idx">{i}</span>
                    <span className="path-point-coords">{seg.kind}</span>
                    <button
                      className="prop-action-btn-sm"
                      onClick={() => setShapeGeometry(shape.id, pathConvertSegment(geo, i, seg.kind === 'line' ? 'quadratic' : 'line'))}
                    >
                      {seg.kind === 'line' ? '\u2192 Curve' : '\u2192 Line'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        );
      })()}

      {/* Transform */}
      <div className="prop-group">
        <label className="prop-label">Position</label>
        <div className="prop-row">
          <label className="prop-mini-label">X</label>
          <input
            type="number"
            className="prop-input-num"
            value={Math.round(t.x)}
            onChange={(e) => setShapeTransform(shape.id, { x: parseFloat(e.target.value) || 0 })}
          />
          <label className="prop-mini-label">Y</label>
          <input
            type="number"
            className="prop-input-num"
            value={Math.round(t.y)}
            onChange={(e) => setShapeTransform(shape.id, { y: parseFloat(e.target.value) || 0 })}
          />
        </div>
      </div>

      <div className="prop-group">
        <label className="prop-label">Scale</label>
        <div className="prop-row">
          <label className="prop-mini-label">X</label>
          <input
            type="number"
            className="prop-input-num"
            value={t.scaleX}
            step={0.1}
            onChange={(e) => setShapeTransform(shape.id, { scaleX: parseFloat(e.target.value) || 1 })}
          />
          <label className="prop-mini-label">Y</label>
          <input
            type="number"
            className="prop-input-num"
            value={t.scaleY}
            step={0.1}
            onChange={(e) => setShapeTransform(shape.id, { scaleY: parseFloat(e.target.value) || 1 })}
          />
        </div>
      </div>

      <div className="prop-group">
        <label className="prop-label">Rotation</label>
        <input
          type="number"
          className="prop-input-num"
          value={t.rotation}
          onChange={(e) => setShapeTransform(shape.id, { rotation: parseFloat(e.target.value) || 0 })}
        />
        <span className="prop-unit">deg</span>
      </div>

      <div className="prop-group">
        <label className="prop-label">Flip</label>
        <div className="prop-row">
          <label className="prop-check">
            <input
              type="checkbox"
              checked={t.flipX}
              onChange={(e) => setShapeTransform(shape.id, { flipX: e.target.checked })}
            /> X
          </label>
          <label className="prop-check">
            <input
              type="checkbox"
              checked={t.flipY}
              onChange={(e) => setShapeTransform(shape.id, { flipY: e.target.checked })}
            /> Y
          </label>
        </div>
      </div>

      {/* Reduction metadata */}
      <div className="prop-section-header">Reduction</div>

      <div className="prop-group">
        <label className="prop-label">Cue Tag</label>
        <input
          className="prop-input"
          value={r.cueTag ?? ''}
          placeholder="e.g. hood, bow, cape"
          onChange={(e) => setShapeReduction(shape.id, { cueTag: e.target.value || undefined })}
        />
      </div>

      <div className="prop-group">
        <label className="prop-label">Survival</label>
        <select
          className="prop-select"
          value={r.survivalHint ?? ''}
          onChange={(e) => setShapeReduction(shape.id, {
            survivalHint: (e.target.value || undefined) as SurvivalHint | undefined,
          })}
        >
          <option value="">—</option>
          <option value="must-survive">Must Survive</option>
          <option value="prefer-survive">Prefer Survive</option>
          <option value="droppable">Droppable</option>
        </select>
      </div>

      <div className="prop-group">
        <label className="prop-label">Drop Priority</label>
        <input
          type="number"
          className="prop-input-num"
          value={r.dropPriority ?? 0}
          min={0}
          onChange={(e) => setShapeReduction(shape.id, { dropPriority: parseInt(e.target.value, 10) || 0 })}
        />
      </div>

      <div className="prop-group">
        <label className="prop-label">Notes</label>
        <textarea
          className="prop-textarea"
          value={r.notes ?? ''}
          rows={2}
          onChange={(e) => setShapeReduction(shape.id, { notes: e.target.value || undefined })}
        />
      </div>

      {/* Group assignment */}
      {doc.groups.length > 0 && (
        <div className="prop-group">
          <label className="prop-label">Group</label>
          <select
            className="prop-select"
            value={shape.groupId ?? ''}
            onChange={(e) => setShapeGroup(shape.id, e.target.value || null)}
          >
            <option value="">None</option>
            {doc.groups.map((g) => (
              <option key={g.id} value={g.id}>{g.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Actions */}
      <div className="prop-group">
        <button
          className="prop-action-btn"
          onClick={() => duplicateShape(shape.id)}
        >
          Duplicate
        </button>
      </div>
    </div>
  );
}
