import type { WorkspaceMode } from '@pixelstudio/domain';

interface BottomDockProps {
  activeMode: WorkspaceMode;
}

export function BottomDock({ activeMode }: BottomDockProps) {
  const showTimeline = activeMode === 'edit' || activeMode === 'animate' || activeMode === 'locomotion';

  return (
    <footer className="bottom-dock">
      {showTimeline ? (
        <div className="timeline-panel">
          <div className="timeline-controls">
            <button className="timeline-btn" title="Previous frame">⏮</button>
            <button className="timeline-btn" title="Play/Pause">▶</button>
            <button className="timeline-btn" title="Next frame">⏭</button>
            <span className="timeline-fps">12 fps</span>
            <button className="timeline-btn" title="Onion Skin">◎</button>
          </div>
          <div className="timeline-frames">
            {Array.from({ length: 8 }, (_, i) => (
              <div key={i} className={`timeline-frame ${i === 0 ? 'active' : ''}`}>
                <span className="frame-number">{i + 1}</span>
              </div>
            ))}
            <button className="timeline-add-frame" title="Add frame">+</button>
          </div>
        </div>
      ) : (
        <div className="bottom-dock-info">
          <span className="dock-mode-label">{activeMode}</span>
        </div>
      )}
    </footer>
  );
}
