import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { VectorReductionPanel } from '../components/VectorReductionPanel';
import { useVectorMasterStore, useSizeProfileStore } from '@glyphstudio/state';
import { BUILT_IN_SIZE_PROFILES, DEFAULT_VECTOR_TRANSFORM, DEFAULT_REDUCTION_META } from '@glyphstudio/domain';

// Mock canvas — jsdom doesn't support getContext
HTMLCanvasElement.prototype.getContext = vi.fn().mockReturnValue(null);

function seedVector() {
  useVectorMasterStore.getState().createDocument('Test Vector');
  // Add a shape so reduction analysis has something to work with
  useVectorMasterStore.getState().addShape({
    name: 'Test Rect',
    groupId: null,
    geometry: { kind: 'rect', x: 100, y: 100, w: 200, h: 200 },
    fill: [100, 100, 100, 255],
    stroke: null,
    transform: { ...DEFAULT_VECTOR_TRANSFORM },
    reduction: { ...DEFAULT_REDUCTION_META },
    visible: true,
    locked: false,
  });
}

function seedProfiles() {
  useSizeProfileStore.setState({
    profiles: [...BUILT_IN_SIZE_PROFILES],
    activeProfileIds: [],
  });
}

describe('VectorReductionPanel', () => {
  beforeEach(() => {
    seedVector();
    seedProfiles();
  });

  afterEach(() => {
    cleanup();
    useVectorMasterStore.getState().closeDocument();
    useSizeProfileStore.getState().resetToBuiltIn();
  });

  it('renders size profiles section', () => {
    render(<VectorReductionPanel />);
    expect(screen.getByText('Size Profiles')).toBeInTheDocument();
  });

  it('shows all built-in profiles', () => {
    render(<VectorReductionPanel />);
    // All 7 built-in profiles should show
    expect(screen.getByText('16×16')).toBeInTheDocument();
    expect(screen.getByText('64×64')).toBeInTheDocument();
  });

  it('shows All and None buttons', () => {
    render(<VectorReductionPanel />);
    expect(screen.getByText('All')).toBeInTheDocument();
    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('shows + Custom button', () => {
    render(<VectorReductionPanel />);
    expect(screen.getByText('+ Custom')).toBeInTheDocument();
  });

  it('shows Preview section', () => {
    render(<VectorReductionPanel />);
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  it('clicking All activates all profiles', async () => {
    render(<VectorReductionPanel />);
    await act(async () => {
      await userEvent.click(screen.getByText('All'));
    });
    const state = useSizeProfileStore.getState();
    expect(state.activeProfileIds.length).toBe(BUILT_IN_SIZE_PROFILES.length);
  });

  it('clicking None deactivates all profiles', async () => {
    useSizeProfileStore.getState().activateAll();
    render(<VectorReductionPanel />);
    await act(async () => {
      await userEvent.click(screen.getByText('None'));
    });
    const state = useSizeProfileStore.getState();
    expect(state.activeProfileIds.length).toBe(0);
  });

  it('toggling a profile checkbox activates it', async () => {
    render(<VectorReductionPanel />);
    const checkboxes = screen.getAllByRole('checkbox');
    expect(checkboxes.length).toBe(BUILT_IN_SIZE_PROFILES.length);

    await act(async () => {
      await userEvent.click(checkboxes[0]);
    });

    const state = useSizeProfileStore.getState();
    expect(state.activeProfileIds).toContain(BUILT_IN_SIZE_PROFILES[0].id);
  });

  it('shows Reduction Analysis header when profiles are active', async () => {
    render(<VectorReductionPanel />);
    // Initially no analysis
    expect(screen.queryByText('Reduction Analysis')).toBeNull();

    // Activate all
    await act(async () => {
      await userEvent.click(screen.getByText('All'));
    });

    // Re-render triggers analysis
    expect(screen.getByText('Reduction Analysis')).toBeInTheDocument();
  });

  it('shows reduction stats for active profiles', async () => {
    useSizeProfileStore.getState().activateProfile('sp_32x32');
    render(<VectorReductionPanel />);
    // 32×32 appears in both profile list and analysis — use getAllByText
    expect(screen.getAllByText('32×32').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Reduction Analysis')).toBeInTheDocument();
    // Should show survived/collapsed stats
    expect(screen.getByText(/survived/)).toBeInTheDocument();
    expect(screen.getByText(/collapsed/)).toBeInTheDocument();
  });

  it('shows fill percentage', async () => {
    useSizeProfileStore.getState().activateProfile('sp_16x16');
    render(<VectorReductionPanel />);
    // Should show some fill percentage
    expect(screen.getByText(/% fill/)).toBeInTheDocument();
  });

  it('clicking + Custom shows add form', async () => {
    render(<VectorReductionPanel />);
    await act(async () => {
      await userEvent.click(screen.getByText('+ Custom'));
    });
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument();
    expect(screen.getByText('Add')).toBeInTheDocument();
  });

  it('adding a custom profile appears in the list', async () => {
    render(<VectorReductionPanel />);
    await act(async () => {
      await userEvent.click(screen.getByText('+ Custom'));
    });

    const nameInput = screen.getByPlaceholderText('Name');
    await act(async () => {
      await userEvent.clear(nameInput);
      await userEvent.type(nameInput, 'My Size');
    });
    await act(async () => {
      await userEvent.click(screen.getByText('Add'));
    });

    const state = useSizeProfileStore.getState();
    expect(state.profiles.length).toBe(BUILT_IN_SIZE_PROFILES.length + 1);
    expect(state.profiles[state.profiles.length - 1].name).toBe('My Size');
  });
});
