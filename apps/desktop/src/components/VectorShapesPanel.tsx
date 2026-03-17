import { useMemo } from 'react';
import { useVectorMasterStore, useSizeProfileStore, computeCollapseOverlay } from '@glyphstudio/state';
import type { ShapeRiskLevel, CollapseOverlayData } from '@glyphstudio/state';
import type { VectorShape, VectorGroup } from '@glyphstudio/domain';

const RISK_LABELS: Record<ShapeRiskLevel, string> = {
  safe: 'OK',
  'at-risk': '!',
  collapses: 'X',
};

const RISK_TITLES: Record<ShapeRiskLevel, string> = {
  safe: 'Survives at all active sizes',
  'at-risk': 'Collapses at some sizes',
  collapses: 'Collapses at smallest active size',
};

function ShapeRow({ shape, isSelected, riskLevel }: { shape: VectorShape; isSelected: boolean; riskLevel?: ShapeRiskLevel }) {
  const selectShape = useVectorMasterStore((s) => s.selectShape);
  const deselectAllShapes = useVectorMasterStore((s) => s.deselectAllShapes);
  const setShapeVisible = useVectorMasterStore((s) => s.setShapeVisible);
  const setShapeLocked = useVectorMasterStore((s) => s.setShapeLocked);
  const removeShape = useVectorMasterStore((s) => s.removeShape);
  const moveShapeUp = useVectorMasterStore((s) => s.moveShapeUp);
  const moveShapeDown = useVectorMasterStore((s) => s.moveShapeDown);

  return (
    <div
      className={`vector-shape-row ${isSelected ? 'selected' : ''} ${!shape.visible ? 'hidden-shape' : ''}`}
      onClick={(e) => {
        if (!e.shiftKey) deselectAllShapes();
        selectShape(shape.id);
      }}
    >
      <span className="shape-kind-badge">{shape.geometry.kind === 'path' ? 'Q' : shape.geometry.kind[0].toUpperCase()}</span>
      <span className="shape-name">{shape.name}</span>
      {riskLevel && (
        <span
          className={`shape-risk-badge risk-${riskLevel}`}
          title={RISK_TITLES[riskLevel]}
        >
          {RISK_LABELS[riskLevel]}
        </span>
      )}
      {shape.reduction.survivalHint && (
        <span className={`shape-survival-badge ${shape.reduction.survivalHint}`}>
          {shape.reduction.survivalHint === 'must-survive' ? 'M' :
           shape.reduction.survivalHint === 'prefer-survive' ? 'P' : 'D'}
        </span>
      )}
      <span className="shape-actions">
        <button
          className="shape-action-btn"
          title={shape.visible ? 'Hide' : 'Show'}
          onClick={(e) => { e.stopPropagation(); setShapeVisible(shape.id, !shape.visible); }}
        >
          {'\u25C9'}
        </button>
        <button
          className="shape-action-btn"
          title={shape.locked ? 'Unlock' : 'Lock'}
          onClick={(e) => { e.stopPropagation(); setShapeLocked(shape.id, !shape.locked); }}
        >
          {shape.locked ? '\u{1F512}' : '\u{1F513}'}
        </button>
        <button
          className="shape-action-btn"
          title="Move up"
          onClick={(e) => { e.stopPropagation(); moveShapeUp(shape.id); }}
        >
          {'\u2191'}
        </button>
        <button
          className="shape-action-btn"
          title="Move down"
          onClick={(e) => { e.stopPropagation(); moveShapeDown(shape.id); }}
        >
          {'\u2193'}
        </button>
        <button
          className="shape-action-btn danger"
          title="Delete"
          onClick={(e) => { e.stopPropagation(); removeShape(shape.id); }}
        >
          {'\u2715'}
        </button>
      </span>
    </div>
  );
}

function GroupRow({ group }: { group: VectorGroup }) {
  const setGroupVisible = useVectorMasterStore((s) => s.setGroupVisible);
  const setGroupLocked = useVectorMasterStore((s) => s.setGroupLocked);
  const removeGroup = useVectorMasterStore((s) => s.removeGroup);

  return (
    <div className="vector-group-row">
      <span className="group-name">{group.name}</span>
      <span className="shape-actions">
        <button
          className="shape-action-btn"
          title={group.visible ? 'Hide group' : 'Show group'}
          onClick={() => setGroupVisible(group.id, !group.visible)}
        >
          {group.visible ? '\u25C9' : '\u25CB'}
        </button>
        <button
          className="shape-action-btn"
          title={group.locked ? 'Unlock group' : 'Lock group'}
          onClick={() => setGroupLocked(group.id, !group.locked)}
        >
          {group.locked ? '\u{1F512}' : '\u{1F513}'}
        </button>
        <button
          className="shape-action-btn danger"
          title="Delete group (shapes become ungrouped)"
          onClick={() => removeGroup(group.id)}
        >
          {'\u2715'}
        </button>
      </span>
    </div>
  );
}

export function VectorShapesPanel() {
  const doc = useVectorMasterStore((s) => s.document);
  const selectedIds = useVectorMasterStore((s) => s.selectedShapeIds);
  const addGroup = useVectorMasterStore((s) => s.addGroup);
  const profiles = useSizeProfileStore((s) => s.profiles);
  const activeProfileIds = useSizeProfileStore((s) => s.activeProfileIds);

  const activeProfiles = useMemo(
    () => profiles.filter((p) => activeProfileIds.includes(p.id)),
    [profiles, activeProfileIds],
  );

  // Compute risk overlay using smallest active profile as target
  const riskOverlay = useMemo((): CollapseOverlayData | null => {
    if (!doc || activeProfiles.length === 0) return null;
    const smallest = [...activeProfiles].sort((a, b) =>
      (a.targetWidth * a.targetHeight) - (b.targetWidth * b.targetHeight)
    )[0];
    return computeCollapseOverlay(doc, activeProfiles, smallest);
  }, [doc, activeProfiles]);

  if (!doc) {
    return <div className="dock-panel-placeholder"><span className="placeholder-label">No vector document</span></div>;
  }

  const sorted = [...doc.shapes].sort((a, b) => b.zOrder - a.zOrder); // top first
  const ungrouped = sorted.filter((s) => !s.groupId);
  const groups = [...doc.groups].sort((a, b) => b.zOrder - a.zOrder);

  const getRisk = (shapeId: string): ShapeRiskLevel | undefined => {
    if (!riskOverlay) return undefined;
    return riskOverlay.shapes.get(shapeId)?.level;
  };

  return (
    <div className="vector-shapes-panel">
      <div className="panel-header">
        <span>Shapes ({doc.shapes.length})</span>
        {riskOverlay && (riskOverlay.collapsesCount > 0 || riskOverlay.atRiskCount > 0) && (
          <span className="panel-risk-summary">
            {riskOverlay.collapsesCount > 0 && (
              <span className="risk-count collapses">{riskOverlay.collapsesCount}X</span>
            )}
            {riskOverlay.atRiskCount > 0 && (
              <span className="risk-count at-risk">{riskOverlay.atRiskCount}!</span>
            )}
          </span>
        )}
        <button
          className="panel-action-btn"
          title="New group"
          onClick={() => addGroup(`group ${doc.groups.length + 1}`)}
        >
          +G
        </button>
      </div>

      {groups.map((g) => {
        const groupShapes = sorted.filter((s) => s.groupId === g.id);
        return (
          <div key={g.id} className="vector-group-block">
            <GroupRow group={g} />
            {groupShapes.map((s) => (
              <ShapeRow key={s.id} shape={s} isSelected={selectedIds.includes(s.id)} riskLevel={getRisk(s.id)} />
            ))}
          </div>
        );
      })}

      {ungrouped.length > 0 && groups.length > 0 && (
        <div className="vector-group-separator">Ungrouped</div>
      )}

      {ungrouped.map((s) => (
        <ShapeRow key={s.id} shape={s} isSelected={selectedIds.includes(s.id)} riskLevel={getRisk(s.id)} />
      ))}
    </div>
  );
}
