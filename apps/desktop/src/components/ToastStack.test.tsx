import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, act, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastStack } from './ToastStack';
import { toast, dismiss, subscribe } from '../lib/toast';

function clearAllToasts() {
  const ids: string[] = [];
  const unsub = subscribe((msgs) => msgs.forEach((m) => ids.push(m.id)));
  unsub();
  ids.forEach((id) => dismiss(id));
}

afterEach(() => {
  cleanup();
  clearAllToasts();
});

describe('ToastStack', () => {
  it('renders nothing when no toasts', () => {
    clearAllToasts();
    render(<ToastStack />);
    expect(screen.queryByTestId('toast-stack')).toBeNull();
  });

  it('shows an error toast', async () => {
    clearAllToasts();
    render(<ToastStack />);
    act(() => { toast.error('Something went wrong'); });
    await waitFor(() => {
      expect(screen.getByTestId('toast-stack')).toBeInTheDocument();
      expect(screen.getByTestId('toast-error')).toBeInTheDocument();
      expect(screen.getByText('Something went wrong')).toBeInTheDocument();
    });
  });

  it('shows a success toast', async () => {
    clearAllToasts();
    render(<ToastStack />);
    act(() => { toast.success('Done!'); });
    await waitFor(() => {
      expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    });
  });

  it('shows an info toast', async () => {
    clearAllToasts();
    render(<ToastStack />);
    act(() => { toast.info('FYI'); });
    await waitFor(() => {
      expect(screen.getByTestId('toast-info')).toBeInTheDocument();
    });
  });

  it('dismiss button removes the toast', async () => {
    clearAllToasts();
    render(<ToastStack />);
    act(() => { toast.error('Click to remove'); });
    await waitFor(() => {
      expect(screen.getByText('Click to remove')).toBeInTheDocument();
    });
    const btn = screen.getByTestId('toast-dismiss');
    await act(async () => { await userEvent.click(btn); });
    expect(screen.queryByText('Click to remove')).toBeNull();
  });

  it('auto-dismisses after 4 seconds', () => {
    clearAllToasts();
    vi.useFakeTimers();
    try {
      render(<ToastStack />);
      // Add toast while fake timers are active so the auto-dismiss timer is captured
      act(() => { toast.error('Auto gone'); });
      expect(screen.getByText('Auto gone')).toBeInTheDocument();
      // Advance past 4s dismiss threshold and flush React state
      act(() => { vi.advanceTimersByTime(4001); });
      expect(screen.queryByText('Auto gone')).toBeNull();
    } finally {
      vi.useRealTimers();
      clearAllToasts();
    }
  });
});
