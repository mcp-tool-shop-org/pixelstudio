import type { WorkspaceMode } from '@pixelstudio/domain';

const MODES: { id: WorkspaceMode; label: string }[] = [
  { id: 'edit', label: 'Edit' },
  { id: 'animate', label: 'Animate' },
  { id: 'palette', label: 'Palette' },
  { id: 'ai', label: 'AI Assist' },
  { id: 'locomotion', label: 'Locomotion' },
  { id: 'validate', label: 'Validate' },
  { id: 'export', label: 'Export' },
];

interface TopBarProps {
  activeMode: WorkspaceMode;
  onModeChange: (mode: WorkspaceMode) => void;
}

export function TopBar({ activeMode, onModeChange }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar-project">
        <span className="topbar-title">PixelStudio</span>
        <span className="topbar-separator">—</span>
        <span className="topbar-filename">Untitled</span>
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
