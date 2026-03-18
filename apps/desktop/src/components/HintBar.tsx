import { useHintStore } from '@glyphstudio/state';

/**
 * HintBar — shows contextual hints from starter recipes.
 *
 * Hints are dismissible and non-repeating (tracked in useHintStore).
 * Renders nothing when no active hints.
 */
export function HintBar() {
  const activeHints = useHintStore((s) => s.activeHints);
  const dismissHint = useHintStore((s) => s.dismissHint);

  if (activeHints.length === 0) return null;

  return (
    <div className="hint-bar" data-testid="hint-bar">
      {activeHints.map((hint) => (
        <div key={hint.id} className="hint-item" data-testid={`hint-${hint.id}`}>
          <span className="hint-text">{hint.text}</span>
          <button
            className="hint-dismiss"
            onClick={() => dismissHint(hint.id)}
            title="Dismiss"
            data-testid={`hint-dismiss-${hint.id}`}
          >
            &#x2715;
          </button>
        </div>
      ))}
    </div>
  );
}
