export type ToastLevel = 'info' | 'success' | 'error';

export interface ToastMessage {
  id: string;
  level: ToastLevel;
  message: string;
}

type Listener = (messages: ToastMessage[]) => void;

let messages: ToastMessage[] = [];
const listeners = new Set<Listener>();
const timers = new Map<string, ReturnType<typeof setTimeout>>();

const AUTO_DISMISS_MS = 4000;
const MAX_TOASTS = 4;

function notify() {
  listeners.forEach((l) => l([...messages]));
}

function add(level: ToastLevel, message: string) {
  const id = `toast-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const entry: ToastMessage = { id, level, message };
  messages = [...messages.slice(-(MAX_TOASTS - 1)), entry];
  notify();

  const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  timers.set(id, timer);
}

export function dismiss(id: string) {
  const timer = timers.get(id);
  if (timer !== undefined) { clearTimeout(timer); timers.delete(id); }
  messages = messages.filter((m) => m.id !== id);
  notify();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  listener([...messages]);
  return () => listeners.delete(listener);
}

/** Imperative toast API — use from anywhere (no React context required). */
export const toast = {
  info: (message: string) => add('info', message),
  success: (message: string) => add('success', message),
  error: (message: string) => add('error', message),
};
