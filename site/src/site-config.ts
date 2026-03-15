import type { SiteConfig } from '@mcptoolshop/site-theme';

export const config: SiteConfig = {
  title: 'GlyphStudio',
  description: 'Desktop-native pixel sprite studio with deterministic craft tools and subordinate AI assistance.',
  logoBadge: 'Gs',
  brandName: 'GlyphStudio',
  repoUrl: 'https://github.com/mcp-tool-shop-org/glyphstudio',
  footerText: 'MIT Licensed — built by <a href="https://github.com/mcp-tool-shop-org" style="color:var(--color-muted);text-decoration:underline">mcp-tool-shop-org</a>',

  hero: {
    badge: 'Desktop Studio',
    headline: 'GlyphStudio',
    headlineAccent: 'craft-first sprite studio.',
    description: 'A desktop-native pixel art studio where deterministic editing is the foundation and AI stays in the passenger seat. Build sprites, animate walk cycles, and validate assets — all with tools that reward skill, not luck.',
    primaryCta: { href: '#features', label: 'Explore Features' },
    secondaryCta: { href: 'handbook/', label: 'Read the Handbook' },
    previews: [
      { label: 'Stack', code: 'React + TypeScript + Tauri v2 + Rust' },
      { label: 'Editor', code: 'Layers · Indexed Palettes · Selections · Timeline' },
      { label: 'AI Assist', code: 'Region Draft · Cleanup · Locomotion Analysis' },
    ],
  },

  sections: [
    {
      kind: 'features',
      id: 'features',
      title: 'Craft-First Design',
      subtitle: 'Every feature increases control, quality, or repeatability. No dead buttons.',
      features: [
        {
          title: 'Deterministic Editor Core',
          desc: 'Pixel-perfect canvas with layers, masks, selections, indexed palettes, and timeline with onion skinning. Tools you can build muscle memory with.',
        },
        {
          title: 'Subordinate AI Assist',
          desc: 'Region drafts, cleanup, requantization, and silhouette repair — always on separate layers, always editable, always provenance-tracked.',
        },
        {
          title: 'Real Locomotion System',
          desc: 'Analyze stride rhythm, contact timing, and center of mass. Plan walk cycles by feel. Generate constrained draft frames. Not a dead button — a real subsystem.',
        },
      ],
    },
    {
      kind: 'features',
      id: 'workspace',
      title: 'Professional Workspace',
      subtitle: 'Eight workspace modes inside a single desktop shell.',
      features: [
        {
          title: 'Dark Pro UI',
          desc: 'Deep charcoal workspace with crisp panels, restrained chrome, and palette colors that pop. Dense but learnable, shortcut-friendly.',
        },
        {
          title: 'Indexed Palette System',
          desc: 'First-class palette contracts with semantic roles, ramp grouping, and double-right-click contextual popup at cursor. Palette is a domain system, not a color picker.',
        },
        {
          title: 'Validation & Export',
          desc: 'Palette contract checks, socket alignment, atlas sizing, locomotion profile validation. Jump-to-fix repairs. Sprite sheet, PNG sequence, and atlas export.',
        },
      ],
    },
    {
      kind: 'code-cards',
      id: 'architecture',
      title: 'Architecture',
      cards: [
        {
          title: 'Frontend (React + TypeScript)',
          code: '// 14 Zustand stores, dockable panels, Canvas/WebGL\n// Workspace modes: Edit, Animate, Palette,\n//   AI Assist, Locomotion, Validate, Export',
        },
        {
          title: 'Backend (Tauri v2 + Rust)',
          code: '// 34 typed commands, event-driven job system\n// Engine: pixel buffers, quantize, transforms\n// AI orchestration: Ollama + ComfyUI bridges',
        },
      ],
    },
  ],
};
