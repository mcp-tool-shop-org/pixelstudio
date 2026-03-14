import { describe, it, expect, beforeEach } from 'vitest';
import { useWorkspaceStore } from './workspaceStore';

beforeEach(() => {
  useWorkspaceStore.setState({
    activeMode: 'project-home',
    previousMode: null,
    bottomDockOpen: true,
    leftRailCollapsed: false,
  });
});

describe('setMode', () => {
  it('sets active mode and remembers previous', () => {
    useWorkspaceStore.getState().setMode('edit');
    expect(useWorkspaceStore.getState().activeMode).toBe('edit');
    expect(useWorkspaceStore.getState().previousMode).toBe('project-home');
  });

  it('chains mode changes', () => {
    useWorkspaceStore.getState().setMode('edit');
    useWorkspaceStore.getState().setMode('animate');
    expect(useWorkspaceStore.getState().activeMode).toBe('animate');
    expect(useWorkspaceStore.getState().previousMode).toBe('edit');
  });
});

describe('toggleBottomDock', () => {
  it('toggles open/closed', () => {
    expect(useWorkspaceStore.getState().bottomDockOpen).toBe(true);
    useWorkspaceStore.getState().toggleBottomDock();
    expect(useWorkspaceStore.getState().bottomDockOpen).toBe(false);
    useWorkspaceStore.getState().toggleBottomDock();
    expect(useWorkspaceStore.getState().bottomDockOpen).toBe(true);
  });
});

describe('toggleLeftRail', () => {
  it('toggles collapsed/expanded', () => {
    expect(useWorkspaceStore.getState().leftRailCollapsed).toBe(false);
    useWorkspaceStore.getState().toggleLeftRail();
    expect(useWorkspaceStore.getState().leftRailCollapsed).toBe(true);
  });
});
