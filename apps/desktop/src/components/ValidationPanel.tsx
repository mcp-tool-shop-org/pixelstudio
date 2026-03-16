import { useCallback, useState } from 'react';
import { useSpriteEditorStore, useValidationStore, runSpriteValidation } from '@glyphstudio/state';
import type { ValidationIssue, ValidationReport } from '@glyphstudio/api-contract';
import type { ValidationCategory } from '@glyphstudio/domain';

const ALL_CATEGORIES: ValidationCategory[] = [
  'palette', 'outline', 'socket', 'atlas', 'export', 'animation', 'locomotion', 'canon',
];

const SEVERITY_LABELS: Record<string, string> = {
  error: 'Error',
  warning: 'Warning',
  info: 'Info',
};

const SEVERITY_ORDER: Record<string, number> = { error: 0, warning: 1, info: 2 };

function SeverityBadge({ severity }: { severity: string }) {
  return (
    <span className={`validation-severity validation-severity-${severity}`}>
      {SEVERITY_LABELS[severity] ?? severity}
    </span>
  );
}

function IssueRow({
  issue,
  isActive,
  onSelect,
}: {
  issue: ValidationIssue;
  isActive: boolean;
  onSelect: () => void;
}) {
  return (
    <div
      className={`validation-issue-row${isActive ? ' active' : ''}`}
      onClick={onSelect}
      data-testid={`validation-issue-${issue.id}`}
    >
      <SeverityBadge severity={issue.severity} />
      <span className="validation-issue-category">{issue.category}</span>
      <span className="validation-issue-message">{issue.message}</span>
    </div>
  );
}

function IssueDetail({ issue }: { issue: ValidationIssue }) {
  const doc = useSpriteEditorStore((s) => s.document);

  return (
    <div className="validation-issue-detail" data-testid="validation-issue-detail">
      <div className="validation-detail-header">
        <SeverityBadge severity={issue.severity} />
        <span className="validation-detail-rule">{issue.ruleId}</span>
      </div>
      <p className="validation-detail-message">{issue.message}</p>

      {issue.affectedFrameIds.length > 0 && doc && (
        <div className="validation-detail-targets">
          <span className="validation-detail-label">Frames:</span>
          {issue.affectedFrameIds.map((fid) => {
            const frame = doc.frames.find((f) => f.id === fid);
            return (
              <span key={fid} className="validation-target-badge" data-testid={`jump-frame-${fid}`}>
                Frame {frame?.index ?? '?'}
              </span>
            );
          })}
        </div>
      )}

      {issue.affectedLayerIds.length > 0 && (
        <div className="validation-detail-targets">
          <span className="validation-detail-label">Layers:</span>
          {issue.affectedLayerIds.map((lid) => (
            <span key={lid} className="validation-target-badge" data-testid={`jump-layer-${lid}`}>
              {lid}
            </span>
          ))}
        </div>
      )}

      {issue.suggestedRepairIds.length === 0 && (
        <span className="validation-no-repair">No automatic repair available</span>
      )}
    </div>
  );
}

export function ValidationPanel() {
  const doc = useSpriteEditorStore((s) => s.document);
  const report = useValidationStore((s) => s.currentReport);
  const activeIssueId = useValidationStore((s) => s.activeIssueId);
  const running = useValidationStore((s) => s.running);
  const setReport = useValidationStore((s) => s.setReport);
  const setActiveIssue = useValidationStore((s) => s.setActiveIssue);
  const setRunning = useValidationStore((s) => s.setRunning);

  const [categoryFilter, setCategoryFilter] = useState<Set<ValidationCategory>>(new Set());

  const handleRun = useCallback(() => {
    if (!doc) return;
    setRunning(true);
    const cats = categoryFilter.size > 0 ? [...categoryFilter] : undefined;
    const result = runSpriteValidation(doc, cats);
    setReport(result);
  }, [doc, categoryFilter, setReport, setRunning]);

  const toggleCategory = (cat: ValidationCategory) => {
    setCategoryFilter((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  if (!doc) {
    return (
      <div className="validation-panel" data-testid="validation-panel">
        <span className="validation-empty">No document loaded</span>
      </div>
    );
  }

  // Sort: errors first, then warnings, then info
  const sortedIssues = report
    ? [...report.issues].sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9))
    : [];

  const activeIssue = sortedIssues.find((i) => i.id === activeIssueId);

  // Categories that actually have rules (for filter display)
  const activeCategories: ValidationCategory[] = ['palette', 'animation', 'export'];

  return (
    <div className="validation-panel" data-testid="validation-panel">
      {/* Category filters */}
      <div className="validation-filters" data-testid="validation-filters">
        {activeCategories.map((cat) => (
          <button
            key={cat}
            className={`validation-filter-btn${categoryFilter.has(cat) ? ' active' : ''}`}
            onClick={() => toggleCategory(cat)}
            data-testid={`validation-filter-${cat}`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Run button */}
      <button
        className="validation-run-btn"
        onClick={handleRun}
        disabled={running}
        data-testid="validation-run"
      >
        {running ? 'Validating…' : 'Run Validation'}
      </button>

      {/* Summary */}
      {report && (
        <div className="validation-summary" data-testid="validation-summary">
          {report.summary.errorCount > 0 && (
            <span className="validation-summary-errors">
              {report.summary.errorCount} error{report.summary.errorCount !== 1 ? 's' : ''}
            </span>
          )}
          {report.summary.warningCount > 0 && (
            <span className="validation-summary-warnings">
              {report.summary.warningCount} warning{report.summary.warningCount !== 1 ? 's' : ''}
            </span>
          )}
          {report.summary.infoCount > 0 && (
            <span className="validation-summary-info">
              {report.summary.infoCount} info
            </span>
          )}
          {report.issues.length === 0 && (
            <span className="validation-all-clear" data-testid="validation-all-clear">
              No issues found
            </span>
          )}
        </div>
      )}

      {/* Issue list */}
      {sortedIssues.length > 0 && (
        <div className="validation-issue-list" data-testid="validation-issue-list">
          {sortedIssues.map((issue) => (
            <IssueRow
              key={issue.id}
              issue={issue}
              isActive={activeIssueId === issue.id}
              onSelect={() => setActiveIssue(issue.id)}
            />
          ))}
        </div>
      )}

      {/* Detail pane */}
      {activeIssue && <IssueDetail issue={activeIssue} />}
    </div>
  );
}
