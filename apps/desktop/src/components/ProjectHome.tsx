interface ProjectHomeProps {
  onEnterWorkspace: () => void;
}

const TEMPLATES = [
  { name: 'Blank Sprite', desc: '64×64, RGB' },
  { name: 'Character Animation', desc: '64×64, 8 frames' },
  { name: 'Modular Character Kit', desc: '32×32 parts, sockets' },
  { name: 'Faction Palette Study', desc: 'Indexed, contract mode' },
];

export function ProjectHome({ onEnterWorkspace }: ProjectHomeProps) {
  return (
    <div className="project-home">
      <div className="project-home-left">
        <h1 className="project-home-title">GlyphStudio</h1>
        <p className="project-home-tagline">
          Build sprites with deterministic tools first. AI stays in the passenger seat.
        </p>
        <div className="project-home-actions">
          <button className="btn-primary" onClick={onEnterWorkspace}>
            New Project
          </button>
          <button className="btn-secondary" onClick={onEnterWorkspace}>
            Open Project
          </button>
        </div>
        <div className="project-home-recent">
          <h3>Recent Projects</h3>
          <p className="text-muted">No recent projects</p>
        </div>
      </div>
      <div className="project-home-right">
        <h3>Templates</h3>
        <div className="template-list">
          {TEMPLATES.map((t) => (
            <button key={t.name} className="template-card" onClick={onEnterWorkspace}>
              <span className="template-name">{t.name}</span>
              <span className="template-desc">{t.desc}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
