import type { WorkspaceMode } from '@glyphstudio/domain';
import { useProjectStore } from '@glyphstudio/state';

const MODES: { id: WorkspaceMode; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'animate', label: 'Animate' },
  { id: 'palette', label: 'Palette' },
  { id: 'ai', label: 'AI Assist' },
  { id: 'locomotion', label: 'Locomotion' },
  { id: 'validate', label: 'Validate' },
  { id: 'export', label: 'Export' },
  { id: 'scene', label: 'Scene' },
];

interface TopBarProps {
  activeMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}

export function TopBar({ activeMode, onModeChange }: TopBarProps) {
  const name = useProjectStore((s) => s.name);
  const isDirty = useProjectStore((s) => s.isDirty);
  const saveStatus = useProjectStore((s) => s.saveStatus);
  const filePath = useProjectStore((s) => s.filePath);

  const displayName = filePath
    ? filePath.split(/[\\/]/).pop()?.replace(/\.pxs$/, '') ?? name
    : name;

  return (
    <header className="topbar">
      <div className="topbar-project">
        <span className="topbar-title">GlyphStudio</span>
        <span className="topbar-separator">{'\u2014'}</span>
        <span className="topbar-filename">
          {displayName}{isDirty ? ' \u2022' : ''}
        </span>
        {saveStatus === 'saving' && <span className="topbar-badge">Saving...</span>}
        {saveStatus === 'saved' && <span className="topbar-badge badge-ok">Saved</span>}
        {saveStatus === 'error' && <span className="topbar-badge badge-error">Save Error</span>}
      </div>
      <nav className="topbar-modes">
        {MODES.map((m) => (
          <button
            key={m.id}
            className={`topbar-mode-tab ${activeMode === m.id ? 'active' : ''}`}
            onClick={() => onModeChange(m.id)}
          >
            {m.label}
          </button>
        ))}
      </nav>
      <div className="topbar-controls">
        <span className="topbar-badge">RGB</span>
        <span className="topbar-badge badge-ok">Valid</span>
      </div>
    </header>
  );
}
