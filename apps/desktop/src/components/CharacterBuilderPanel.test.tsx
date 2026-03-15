import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCharacterStore } from '@glyphstudio/state';
import { CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import type { CharacterBuild, CharacterPartRef } from '@glyphstudio/domain';

import { CharacterBuilderPanel } from '../components/CharacterBuilderPanel';

// ── Fixtures ──

const HEAD: CharacterPartRef = { sourceId: 'head-basic', slot: 'head', tags: ['human'] };
const TORSO: CharacterPartRef = { sourceId: 'torso-plate', slot: 'torso', providedSockets: ['chest_mount'] };
const ARMS: CharacterPartRef = { sourceId: 'arms-default', slot: 'arms' };
const LEGS: CharacterPartRef = { sourceId: 'legs-default', slot: 'legs' };
const WEAPON: CharacterPartRef = { sourceId: 'sword-iron', slot: 'weapon', requiredSockets: ['hand'] };

const VALID_BUILD: CharacterBuild = {
  id: 'v1',
  name: 'Warrior',
  slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS },
};

// ── Lifecycle ──

beforeEach(() => {
  useCharacterStore.getState().clearCharacterBuild();
});

afterEach(cleanup);

// ── Empty state ──

describe('empty state', () => {
  it('renders empty message when no build exists', () => {
    render(<CharacterBuilderPanel />);
    expect(screen.getByText(/No character build active/)).toBeInTheDocument();
  });

  it('shows required slots hint', () => {
    render(<CharacterBuilderPanel />);
    expect(screen.getByText(/Required slots/)).toBeInTheDocument();
  });

  it('shows create button', () => {
    render(<CharacterBuilderPanel />);
    expect(screen.getByText('Create Character Build')).toBeInTheDocument();
  });

  it('create button initializes a new build', async () => {
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByText('Create Character Build'));
    });
    expect(useCharacterStore.getState().activeCharacterBuild).not.toBeNull();
    expect(screen.getByTestId('char-build-name')).toBeInTheDocument();
  });
});

// ── Build lifecycle ──

describe('build lifecycle', () => {
  it('displays character name after create', () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-build-name').textContent).toBe('Hero');
  });

  it('new build button creates a fresh build', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-new-btn'));
    });
    const build = useCharacterStore.getState().activeCharacterBuild;
    expect(build).not.toBeNull();
    expect(build!.id).not.toBe('v1');
  });

  it('clear button returns to empty state', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-clear-btn'));
    });
    expect(useCharacterStore.getState().activeCharacterBuild).toBeNull();
    expect(screen.getByText(/No character build active/)).toBeInTheDocument();
  });

  it('rename updates displayed build name', async () => {
    useCharacterStore.getState().createCharacterBuild('Old Name');
    render(<CharacterBuilderPanel />);
    const nameEl = screen.getByTestId('char-build-name');
    // Double-click to enter rename mode
    await act(async () => {
      fireEvent.doubleClick(nameEl);
    });
    const input = screen.getByTestId('char-rename-input');
    await act(async () => {
      await userEvent.clear(input);
      await userEvent.type(input, 'New Name');
      fireEvent.blur(input);
    });
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('New Name');
  });
});

// ── Slot list ──

describe('slot list', () => {
  it('renders all 12 slots in canonical order', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const slotRows = screen.getByTestId('char-slot-list').querySelectorAll('.char-slot-row');
    expect(slotRows).toHaveLength(12);
    const slotIds = Array.from(slotRows).map((r) => (r as HTMLElement).dataset.slot);
    expect(slotIds).toEqual([...CHARACTER_SLOT_IDS]);
  });

  it('required slots are marked with asterisk', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const headSlot = screen.getByTestId('char-slot-head');
    expect(headSlot.querySelector('.char-slot-required')).not.toBeNull();
    // accessory is optional — no asterisk
    const accSlot = screen.getByTestId('char-slot-accessory');
    expect(accSlot.querySelector('.char-slot-required')).toBeNull();
  });

  it('equipped slots show part source ID', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    const headSlot = screen.getByTestId('char-slot-head');
    expect(headSlot.querySelector('.char-slot-equipped')!.textContent).toBe('head-basic');
  });

  it('empty required slots show missing badge', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const headSlot = screen.getByTestId('char-slot-head');
    expect(headSlot.querySelector('.missing-badge')).not.toBeNull();
  });

  it('clicking a slot updates selected state', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-torso'));
    });
    expect(useCharacterStore.getState().selectedSlot).toBe('torso');
    expect(screen.getByTestId('char-slot-torso').className).toContain('selected');
  });
});

// ── Selected slot detail ──

describe('selected slot detail', () => {
  it('selecting a slot shows detail pane', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    expect(screen.getByTestId('char-slot-detail')).toBeInTheDocument();
  });

  it('equipped slot shows part details', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    expect(screen.getByTestId('char-detail-part-id').textContent).toBe('head-basic');
  });

  it('equipped slot shows remove button', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    expect(screen.getByTestId('char-remove-part-btn')).toBeInTheDocument();
  });

  it('remove action unequips slot', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-remove-part-btn'));
    });
    expect(useCharacterStore.getState().activeCharacterBuild!.slots.head).toBeUndefined();
  });

  it('empty slot shows choose part placeholder', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    expect(screen.getByTestId('char-apply-part-btn')).toBeInTheDocument();
    expect(screen.getByText(/No part equipped/)).toBeInTheDocument();
  });

  it('detail pane shows required/optional tag', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    expect(screen.getByText('Required')).toBeInTheDocument();

    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    expect(screen.getByText('Optional')).toBeInTheDocument();
  });

  it('slot-specific issues render in detail pane', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    expect(screen.getByTestId('char-slot-issues')).toBeInTheDocument();
  });
});

// ── Validation summary ──

describe('validation summary', () => {
  it('shows error count when required slots missing', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('4 errors');
  });

  it('shows valid state when all required slots filled', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('Valid build');
  });

  it('shows warnings when socket requirements unsatisfied', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('warning');
  });
});

// ── Store/UI integration ──

describe('store/UI integration', () => {
  it('equip parts in store → panel updates slot display', () => {
    useCharacterStore.getState().createCharacterBuild();
    const { rerender } = render(<CharacterBuilderPanel />);
    // Initially head is empty
    expect(screen.getByTestId('char-slot-head').querySelector('.char-slot-empty')).not.toBeNull();
    // Equip head
    act(() => {
      useCharacterStore.getState().equipCharacterPart(HEAD);
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-slot-head').querySelector('.char-slot-equipped')!.textContent).toBe('head-basic');
  });

  it('clear build → panel resets to empty', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-build-name')).toBeInTheDocument();
    act(() => {
      useCharacterStore.getState().clearCharacterBuild();
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByText(/No character build active/)).toBeInTheDocument();
  });

  it('validation updates after unequip → UI reflects change', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('Valid build');
    act(() => {
      useCharacterStore.getState().unequipCharacterSlot('head');
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('1 error');
  });
});
