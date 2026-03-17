import { useEffect, useState } from 'react';
import { subscribe, dismiss, type ToastMessage } from '../lib/toast';

export function ToastStack() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => subscribe(setMessages), []);

  if (messages.length === 0) return null;

  return (
    <div className="toast-stack" data-testid="toast-stack">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={`toast toast-${msg.level}`}
          data-testid={`toast-${msg.level}`}
          role="alert"
        >
          <span className="toast-message">{msg.message}</span>
          <button
            className="toast-dismiss"
            onClick={() => dismiss(msg.id)}
            aria-label="Dismiss"
            data-testid="toast-dismiss"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
