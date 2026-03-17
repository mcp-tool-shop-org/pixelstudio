import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TemplateBrowserPanel } from './TemplateBrowserPanel';

vi.mock('@tauri-apps/api/core', () => ({
  invoke: vi.fn(),
}));

describe('TemplateBrowserPanel', () => {
  it('renders search input and archetype filter', () => {
    render(<TemplateBrowserPanel />);
    expect(screen.getByPlaceholderText('Search templates...')).toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('shows mode toggle buttons', () => {
    render(<TemplateBrowserPanel />);
    expect(screen.getByText('Static')).toBeInTheDocument();
    expect(screen.getByText('Animate')).toBeInTheDocument();
  });

  it('shows all 4 templates by default', () => {
    render(<TemplateBrowserPanel />);
    expect(screen.getByText('Humanoid Warrior')).toBeInTheDocument();
    expect(screen.getByText('Humanoid Mage')).toBeInTheDocument();
    expect(screen.getByText('Quadruped Creature')).toBeInTheDocument();
    expect(screen.getByText('Sword')).toBeInTheDocument();
  });

  it('filters by archetype', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'item' } });
    expect(screen.getByText('Sword')).toBeInTheDocument();
    expect(screen.queryByText('Humanoid Warrior')).not.toBeInTheDocument();
  });

  it('searches by keyword', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
      target: { value: 'mage' },
    });
    expect(screen.getByText('Humanoid Mage')).toBeInTheDocument();
    expect(screen.queryByText('Humanoid Warrior')).not.toBeInTheDocument();
  });

  it('shows empty state for no results', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.change(screen.getByPlaceholderText('Search templates...'), {
      target: { value: 'spaceship' },
    });
    expect(screen.getByText('No templates match your search.')).toBeInTheDocument();
  });

  it('shows detail panel when template selected', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    expect(screen.getByText('Color Slots')).toBeInTheDocument();
    expect(screen.getByText('Instantiate on Canvas')).toBeInTheDocument();
  });

  it('shows color slot inputs for selected template', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    expect(screen.getByText('skin')).toBeInTheDocument();
    expect(screen.getByText('hair')).toBeInTheDocument();
    expect(screen.getByText('armor')).toBeInTheDocument();
  });

  it('shows scale slider', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Sword'));
    expect(screen.getByText('Scale:')).toBeInTheDocument();
    expect(screen.getByText('1x')).toBeInTheDocument();
  });

  it('shows template dimensions on cards', () => {
    render(<TemplateBrowserPanel />);
    // warrior + mage both 16x24
    expect(screen.getAllByText('16x24')).toHaveLength(2);
    expect(screen.getByText('24x16')).toBeInTheDocument(); // quadruped
    expect(screen.getByText('8x24')).toBeInTheDocument(); // sword
  });

  it('switches to animate mode and shows preset selector', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    fireEvent.click(screen.getByText('Animate'));
    // Should show animation presets compatible with humanoid
    expect(screen.getByText('Idle Bob')).toBeInTheDocument();
    expect(screen.getByText('Walk Cycle')).toBeInTheDocument();
    expect(screen.getByText('Attack Swing')).toBeInTheDocument();
  });

  it('shows preset details when selected in animate mode', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    fireEvent.click(screen.getByText('Animate'));
    fireEvent.click(screen.getByText('Idle Bob'));
    expect(screen.getByText('Intensity:')).toBeInTheDocument();
    expect(screen.getByText('Generate 4-Frame Animation')).toBeInTheDocument();
  });

  it('shows no animations for item templates', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Sword'));
    fireEvent.click(screen.getByText('Animate'));
    expect(screen.getByText(/No animations for item templates/)).toBeInTheDocument();
  });

  it('hides instantiate button in animate mode', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    // Static mode shows instantiate
    expect(screen.getByText('Instantiate on Canvas')).toBeInTheDocument();
    // Switch to animate
    fireEvent.click(screen.getByText('Animate'));
    expect(screen.queryByText('Instantiate on Canvas')).not.toBeInTheDocument();
  });

  it('shows walk cycle frame count', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    fireEvent.click(screen.getByText('Animate'));
    fireEvent.click(screen.getByText('Walk Cycle'));
    expect(screen.getByText('Generate 6-Frame Animation')).toBeInTheDocument();
  });
});
