import { useEffect } from 'react';

interface ShortcutHelpOverlayProps {
  isOpen: boolean;
  onClose: () => void;
}

const SHORTCUT_SECTIONS: Array<{ heading: string; rows: Array<[string, string]> }> = [
  {
    heading: 'Tools',
    rows: [
      ['B', 'Pencil'],
      ['E', 'Eraser'],
      ['F', 'Fill bucket'],
      ['I', 'Eyedropper'],
      ['R', 'Rectangle'],
      ['L', 'Line'],
      ['M', 'Move'],
      ['V', 'Select'],
      ['[', 'Decrease brush size'],
      [']', 'Increase brush size'],
    ],
  },
  {
    heading: 'History',
    rows: [
      ['Ctrl+Z', 'Undo'],
      ['Ctrl+Y / Ctrl+Shift+Z', 'Redo'],
    ],
  },
  {
    heading: 'File',
    rows: [
      ['Ctrl+S', 'Save'],
      ['Ctrl+Shift+S', 'Save As'],
    ],
  },
  {
    heading: 'Canvas',
    rows: [
      ['Scroll', 'Zoom in / out'],
      ['Space + drag', 'Pan'],
      ['Ctrl+0', 'Fit to window'],
    ],
  },
  {
    heading: 'UI',
    rows: [
      ['?', 'Show this help'],
      ['Escape', 'Close overlay / cancel'],
    ],
  },
];

export function ShortcutHelpOverlay({ isOpen, onClose }: ShortcutHelpOverlayProps) {
  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="shortcut-overlay-backdrop"
      onClick={onClose}
      data-testid="shortcut-overlay-backdrop"
    >
      <div
        className="shortcut-overlay"
        onClick={(e) => e.stopPropagation()}
        data-testid="shortcut-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="Keyboard shortcuts"
      >
        <div className="shortcut-overlay-header">
          <h2>Keyboard Shortcuts</h2>
          <button
            className="shortcut-overlay-close"
            onClick={onClose}
            data-testid="shortcut-overlay-close"
            aria-label="Close shortcuts"
          >
            ✕
          </button>
        </div>
        <div className="shortcut-overlay-body">
          {SHORTCUT_SECTIONS.map((section) => (
            <section key={section.heading} className="shortcut-section">
              <h3 className="shortcut-section-heading">{section.heading}</h3>
              <table className="shortcut-table">
                <tbody>
                  {section.rows.map(([key, desc]) => (
                    <tr key={key}>
                      <td className="shortcut-key"><kbd>{key}</kbd></td>
                      <td className="shortcut-desc">{desc}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
