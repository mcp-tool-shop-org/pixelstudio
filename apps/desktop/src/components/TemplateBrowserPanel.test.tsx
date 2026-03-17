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
    // Detail panel appears with color slots
    expect(screen.getByText('Color Slots')).toBeInTheDocument();
    expect(screen.getByText('Instantiate on Canvas')).toBeInTheDocument();
  });

  it('shows color slot inputs for selected template', () => {
    render(<TemplateBrowserPanel />);
    fireEvent.click(screen.getByText('Humanoid Warrior'));
    // Warrior has 6 color slots: skin, hair, armor, pants, boots, outline
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
});
