import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCharacterStore, createEmptyLibrary, saveBuildToLibrary, toSavedBuild } from '@glyphstudio/state';
import { CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import type { CharacterBuild, CharacterPartRef, CharacterPartPreset, CharacterBuildLibrary } from '@glyphstudio/domain';

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

// Preset fixtures
const HEAD_PRESET_A: CharacterPartPreset = {
  sourceId: 'head-knight',
  slot: 'head',
  name: 'Knight Helm',
  description: 'A sturdy metal helmet.',
  tags: ['human', 'heavy'],
};

const HEAD_PRESET_B: CharacterPartPreset = {
  sourceId: 'head-wizard',
  slot: 'head',
  name: 'Wizard Hat',
  tags: ['human', 'cloth'],
};

const TORSO_PRESET: CharacterPartPreset = {
  sourceId: 'torso-chain',
  slot: 'torso',
  name: 'Chainmail',
};

const WEAPON_PRESET: CharacterPartPreset = {
  sourceId: 'sword-steel',
  slot: 'weapon',
  name: 'Steel Sword',
  requiredSockets: ['hand'],
};

const WEAPON_PRESET_CLEAN: CharacterPartPreset = {
  sourceId: 'dagger-iron',
  slot: 'weapon',
  name: 'Iron Dagger',
};

const CATALOG: CharacterPartPreset[] = [
  HEAD_PRESET_A,
  HEAD_PRESET_B,
  TORSO_PRESET,
  WEAPON_PRESET,
  WEAPON_PRESET_CLEAN,
];

// ── Lifecycle ──

beforeEach(() => {
  useCharacterStore.getState().clearCharacterBuild();
  useCharacterStore.getState().setLibrary(createEmptyLibrary());
  useCharacterStore.getState().selectLibraryBuild(null);
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

  it('clear button requires confirmation', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    const clearBtn = screen.getByTestId('char-clear-btn');
    // First click shows confirm state
    await act(async () => {
      await userEvent.click(clearBtn);
    });
    expect(clearBtn.textContent).toBe('Confirm?');
    expect(useCharacterStore.getState().activeCharacterBuild).not.toBeNull();
    // Second click actually clears
    await act(async () => {
      await userEvent.click(clearBtn);
    });
    expect(useCharacterStore.getState().activeCharacterBuild).toBeNull();
    expect(screen.getByText(/No character build active/)).toBeInTheDocument();
  });

  it('clear confirm resets on blur', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    const clearBtn = screen.getByTestId('char-clear-btn');
    await act(async () => {
      await userEvent.click(clearBtn);
    });
    expect(clearBtn.textContent).toBe('Confirm?');
    await act(async () => {
      fireEvent.blur(clearBtn);
    });
    expect(clearBtn.textContent).not.toBe('Confirm?');
  });

  it('rename updates displayed build name', async () => {
    useCharacterStore.getState().createCharacterBuild('Old Name');
    render(<CharacterBuilderPanel />);
    const nameEl = screen.getByTestId('char-build-name');
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
    const accSlot = screen.getByTestId('char-slot-accessory');
    expect(accSlot.querySelector('.char-slot-required')).toBeNull();
  });

  it('equipped slots show part source ID', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    const headSlot = screen.getByTestId('char-slot-head');
    expect(headSlot.querySelector('.char-slot-equipped')!.textContent).toBe('head-basic');
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

// ── Slot-level validation badges ──

describe('slot-level validation badges', () => {
  it('empty required slot shows "Missing" badge', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const headSlot = screen.getByTestId('char-slot-head');
    expect(headSlot.dataset.status).toBe('missing');
    expect(screen.getByTestId('char-badge-head').textContent).toBe('Missing');
  });

  it('equipped valid slot shows "Ready" badge', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    const headSlot = screen.getByTestId('char-slot-head');
    expect(headSlot.dataset.status).toBe('ready');
    expect(screen.getByTestId('char-badge-head').textContent).toBe('Ready');
  });

  it('equipped slot with warning shows "Warning" badge', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    const weaponSlot = screen.getByTestId('char-slot-weapon');
    expect(weaponSlot.dataset.status).toBe('warning');
    expect(screen.getByTestId('char-badge-weapon').textContent).toBe('Warning');
  });

  it('optional empty slot shows no badge', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const accSlot = screen.getByTestId('char-slot-accessory');
    expect(accSlot.dataset.status).toBe('empty');
    expect(accSlot.querySelector('.char-slot-badge')).toBeNull();
  });

  it('slot status is scannable at a glance via data-status', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    const rows = screen.getByTestId('char-slot-list').querySelectorAll('.char-slot-row');
    const statuses = Array.from(rows).map((r) => (r as HTMLElement).dataset.status);
    // head=ready, face=empty, hair=empty, torso=ready, arms=ready,
    // hands=empty, legs=ready, feet=empty, accessory=empty, back=empty, weapon=warning, offhand=empty
    expect(statuses).toEqual([
      'ready', 'empty', 'empty', 'ready', 'ready',
      'empty', 'ready', 'empty', 'empty', 'empty', 'warning', 'empty',
    ]);
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

  it('empty required slot shows required guidance', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    expect(screen.getByTestId('char-required-hint')).toBeInTheDocument();
    expect(screen.getByText(/This slot is required/)).toBeInTheDocument();
  });

  it('empty optional slot shows generic empty message', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    expect(screen.queryByTestId('char-required-hint')).toBeNull();
    expect(screen.getByText(/No part equipped/)).toBeInTheDocument();
  });

  it('empty slot shows choose part button', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    expect(screen.getByTestId('char-apply-part-btn')).toBeInTheDocument();
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

  it('issues show "Slot issues" header', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    expect(screen.getByText('Slot issues')).toBeInTheDocument();
  });
});

// ── Validation summary ──

describe('validation summary', () => {
  it('shows error count when required slots missing', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('4 errors');
  });

  it('shows valid state with distinct element when no errors', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-valid-state')).toBeInTheDocument();
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('Valid build');
    expect(screen.getByText('All required slots filled')).toBeInTheDocument();
  });

  it('valid summary has success styling class', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').className).toContain('char-validation-valid');
  });

  it('invalid summary does not have success class', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').className).not.toContain('char-validation-valid');
  });

  it('shows warnings when socket requirements unsatisfied', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('warning');
  });

  it('errors group in issue list has count', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const errorsGroup = screen.getByTestId('char-issue-errors');
    expect(errorsGroup.textContent).toContain('Errors (4)');
  });

  it('warnings group in issue list has count', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    const warningsGroup = screen.getByTestId('char-issue-warnings');
    expect(warningsGroup.textContent).toContain('Warnings (1)');
  });

  it('issue rows show slot badges', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    const badges = screen.getByTestId('char-issue-list').querySelectorAll('.char-issue-slot-badge');
    expect(badges.length).toBeGreaterThan(0);
    // First error should be Head (missing required slot)
    expect(badges[0].textContent).toBe('Head');
  });
});

// ── Preset picker ──

describe('preset picker', () => {
  it('choose part button opens picker', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByTestId('char-preset-picker')).toBeInTheDocument();
  });

  it('replace part button opens picker', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-replace-part-btn'));
    });
    expect(screen.getByTestId('char-preset-picker')).toBeInTheDocument();
  });

  it('picker shows only compatible presets for the selected slot', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    const list = screen.getByTestId('char-picker-list');
    expect(list.querySelectorAll('.char-preset-candidate')).toHaveLength(2);
    expect(screen.getByTestId('char-candidate-head-knight')).toBeInTheDocument();
    expect(screen.getByTestId('char-candidate-head-wizard')).toBeInTheDocument();
  });

  it('picker shows empty message when no compatible presets', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-feet'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByTestId('char-picker-empty')).toBeInTheDocument();
    expect(screen.getByText(/No compatible parts/)).toBeInTheDocument();
  });

  it('picker shows catalog-empty message when catalog is empty', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={[]} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByTestId('char-picker-empty')).toBeInTheDocument();
    expect(screen.getByText('No parts in catalog.')).toBeInTheDocument();
  });

  it('clicking a candidate equips the part', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-head-knight'));
    });
    const build = useCharacterStore.getState().activeCharacterBuild!;
    expect(build.slots.head).toBeDefined();
    expect(build.slots.head!.sourceId).toBe('head-knight');
  });

  it('equipping a preset closes the picker', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-head-knight'));
    });
    expect(screen.queryByTestId('char-preset-picker')).toBeNull();
  });

  it('close button closes the picker', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByTestId('char-preset-picker')).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-picker-close-btn'));
    });
    expect(screen.queryByTestId('char-preset-picker')).toBeNull();
  });

  it('switching slots closes the picker', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByTestId('char-preset-picker')).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-torso'));
    });
    expect(screen.queryByTestId('char-preset-picker')).toBeNull();
  });

  it('replace flow equips preset into already-occupied slot', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    expect(screen.getByTestId('char-detail-part-id').textContent).toBe('head-basic');
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-replace-part-btn'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-head-knight'));
    });
    const build = useCharacterStore.getState().activeCharacterBuild!;
    expect(build.slots.head!.sourceId).toBe('head-knight');
  });

  it('warning-tier candidates show warning indicators', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    const swordCandidate = screen.getByTestId('char-candidate-sword-steel');
    expect(swordCandidate.dataset.tier).toBe('warning');
    expect(swordCandidate.querySelector('.char-candidate-warnings')).not.toBeNull();
    const daggerCandidate = screen.getByTestId('char-candidate-dagger-iron');
    expect(daggerCandidate.dataset.tier).toBe('compatible');
  });

  it('compatible candidates appear before warning candidates', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    const candidates = screen.getByTestId('char-picker-list').querySelectorAll('.char-preset-candidate');
    const tiers = Array.from(candidates).map((c) => (c as HTMLElement).dataset.tier);
    expect(tiers[0]).toBe('compatible');
  });

  it('warning-tier candidates can still be equipped', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-sword-steel'));
    });
    const build = useCharacterStore.getState().activeCharacterBuild!;
    expect(build.slots.weapon!.sourceId).toBe('sword-steel');
  });

  it('preset description is displayed when present', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByText('A sturdy metal helmet.')).toBeInTheDocument();
  });

  it('candidates show compatibility tier badges', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    expect(screen.getByTestId('char-tier-badge-dagger-iron').textContent).toBe('Compatible');
    expect(screen.getByTestId('char-tier-badge-sword-steel').textContent).toBe('Warning');
  });

  it('picker shows current occupant marker when replacing', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    // Add head-knight to catalog so it matches the sourceId
    const catalogWithCurrent = [...CATALOG, { ...HEAD, name: 'Basic Head' } as CharacterPartPreset];
    render(<CharacterBuilderPanel partCatalog={catalogWithCurrent} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-replace-part-btn'));
    });
    const currentEl = screen.getByTestId('char-picker-current');
    expect(currentEl).toBeInTheDocument();
    expect(currentEl.textContent).toContain('head-basic');
  });

  it('show incompatible toggle reveals incompatible candidates', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    // Initially only 2 head presets
    expect(screen.getByTestId('char-picker-list').querySelectorAll('.char-preset-candidate')).toHaveLength(2);
    // Toggle show incompatible
    const toggle = screen.getByTestId('char-picker-incompat-toggle').querySelector('input')!;
    await act(async () => {
      await userEvent.click(toggle);
    });
    // Now shows all presets including incompatible ones
    const allCandidates = screen.getByTestId('char-picker-list').querySelectorAll('.char-preset-candidate');
    expect(allCandidates.length).toBe(CATALOG.length);
  });

  it('incompatible candidates have disabled apply button', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    const toggle = screen.getByTestId('char-picker-incompat-toggle').querySelector('input')!;
    await act(async () => {
      await userEvent.click(toggle);
    });
    // Torso preset is incompatible for head slot
    const torsoApply = screen.getByTestId('char-apply-torso-chain');
    expect(torsoApply).toBeDisabled();
  });
});

// ── Store/UI integration ──

describe('store/UI integration', () => {
  it('equip parts in store → panel updates slot display', () => {
    useCharacterStore.getState().createCharacterBuild();
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-slot-head').querySelector('.char-slot-empty')).not.toBeNull();
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

  it('equip via picker → validation updates', async () => {
    useCharacterStore.getState().createCharacterBuild();
    const { rerender } = render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('4 errors');
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-head'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-head-knight'));
    });
    rerender(<CharacterBuilderPanel partCatalog={CATALOG} />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('3 errors');
  });

  it('slot badge updates when equipping fills required slot', () => {
    useCharacterStore.getState().createCharacterBuild();
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-slot-head').dataset.status).toBe('missing');
    act(() => {
      useCharacterStore.getState().equipCharacterPart(HEAD);
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-slot-head').dataset.status).toBe('ready');
  });
});

// ── Docs-linked semantics ──

describe('docs-linked semantics', () => {
  it('build valid = zero errors, warnings allowed', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().equipCharacterPart(WEAPON);
    render(<CharacterBuilderPanel />);
    // Build is valid (all required slots filled) even with warning
    expect(screen.getByTestId('char-valid-state')).toBeInTheDocument();
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('Valid build');
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('warning');
  });

  it('preset compatibility tiers appear consistently in UI', async () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel partCatalog={CATALOG} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-slot-weapon'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-apply-part-btn'));
    });
    // Compatible tier
    expect(screen.getByTestId('char-tier-badge-dagger-iron').textContent).toBe('Compatible');
    // Warning tier
    expect(screen.getByTestId('char-tier-badge-sword-steel').textContent).toBe('Warning');
  });
});

// ── Build Library: empty state ──

describe('library empty state', () => {
  it('library section renders when no build active', () => {
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-library')).toBeInTheDocument();
  });

  it('empty library shows informational message when no build active', () => {
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-library-empty')).toBeInTheDocument();
    expect(screen.getByText(/Saved builds will appear here/)).toBeInTheDocument();
  });

  it('empty library shows save CTA when build is active', () => {
    useCharacterStore.getState().createCharacterBuild('Test');
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-library-empty')).toBeInTheDocument();
    expect(screen.getByTestId('char-library-save-cta')).toBeInTheDocument();
    expect(screen.getByText('Save Current Build')).toBeInTheDocument();
  });

  it('library count shows 0 when empty', () => {
    useCharacterStore.getState().createCharacterBuild();
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-library-count').textContent).toBe('0');
  });
});

// ── Build Library: save flow ──

describe('library save flow', () => {
  it('save button creates library entry', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds).toHaveLength(1);
    expect(lib.builds[0].name).toBe('Warrior');
  });

  it('saved entry appears in the library list', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-library-list')).toBeInTheDocument();
    expect(screen.getByTestId('char-library-count').textContent).toBe('1');
  });

  it('save preserves active build content', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds[0].slots.head?.sourceId).toBe('head-basic');
    expect(lib.builds[0].slots.torso?.sourceId).toBe('torso-plate');
  });

  it('overwrite updates existing entry on re-save', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    // First save
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    // Modify name
    act(() => {
      useCharacterStore.getState().setCharacterName('Warrior V2');
    });
    // Second save
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds).toHaveLength(1);
    expect(lib.builds[0].name).toBe('Warrior V2');
  });

  it('save CTA in empty library creates entry', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-library-save-cta'));
    });
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(1);
  });

  it('onLibraryChange callback fires on save', async () => {
    const onChange = vi.fn();
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel onLibraryChange={onChange} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange.mock.calls[0][0].builds).toHaveLength(1);
  });
});

// ── Build Library: load flow ──

describe('library load flow', () => {
  function seedLibrary(): string {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    useCharacterStore.getState().clearCharacterBuild();
    return id;
  }

  it('clicking load populates active build', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    const build = useCharacterStore.getState().activeCharacterBuild;
    expect(build).not.toBeNull();
    expect(build!.name).toBe('Warrior');
  });

  it('validation updates after load', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('Valid build');
  });

  it('slot list reflects loaded build', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-slot-head').dataset.status).toBe('ready');
  });

  it('slot selection clears on load', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    useCharacterStore.getState().selectSlot('head');
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    expect(useCharacterStore.getState().selectedSlot).toBeNull();
  });
});

// ── Build Library: duplicate flow ──

describe('library duplicate flow', () => {
  function seedLibrary(): string {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    return useCharacterStore.getState().buildLibrary.builds[0].id;
  }

  it('duplicate creates new entry', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-dup-${id}`));
    });
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(2);
  });

  it('duplicate uses "Name Copy" naming', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-dup-${id}`));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds[0].name).toBe('Warrior Copy');
  });

  it('duplicate does not mutate source entry', async () => {
    const id = seedLibrary();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-dup-${id}`));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    const source = lib.builds.find((b) => b.id === id)!;
    expect(source.name).toBe('Warrior');
  });

  it('duplicate appears first in list (newest-first)', async () => {
    const id = seedLibrary();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-dup-${id}`));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds[0].name).toBe('Warrior Copy');
    expect(lib.builds[1].name).toBe('Warrior');
  });

  it('onLibraryChange fires on duplicate', async () => {
    const id = seedLibrary();
    const onChange = vi.fn();
    render(<CharacterBuilderPanel onLibraryChange={onChange} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-dup-${id}`));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ── Build Library: delete flow ──

describe('library delete flow', () => {
  function seedLibrary(): string {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    return useCharacterStore.getState().buildLibrary.builds[0].id;
  }

  it('delete requires confirmation click', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => {
      await userEvent.click(delBtn);
    });
    // First click shows confirm
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(1);
    expect(delBtn.textContent).toBe('Confirm?');
  });

  it('second click deletes the entry', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => {
      await userEvent.click(delBtn);
    });
    await act(async () => {
      await userEvent.click(delBtn);
    });
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(0);
  });

  it('deleting one row leaves others intact', async () => {
    const id = seedLibrary();
    // Add a second build
    useCharacterStore.getState().createCharacterBuild('Second Build');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(2);

    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    // Confirm delete
    await act(async () => {
      await userEvent.click(delBtn);
    });
    await act(async () => {
      await userEvent.click(delBtn);
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds).toHaveLength(1);
    expect(lib.builds[0].name).toBe('Second Build');
  });

  it('active editor build remains stable after library delete', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => {
      await userEvent.click(delBtn);
    });
    await act(async () => {
      await userEvent.click(delBtn);
    });
    // Active build should still be loaded
    expect(useCharacterStore.getState().activeCharacterBuild).not.toBeNull();
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Warrior');
  });

  it('onLibraryChange fires on delete', async () => {
    const id = seedLibrary();
    const onChange = vi.fn();
    const { rerender } = render(<CharacterBuilderPanel onLibraryChange={onChange} />);
    rerender(<CharacterBuilderPanel onLibraryChange={onChange} />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => {
      await userEvent.click(delBtn);
    });
    await act(async () => {
      await userEvent.click(delBtn);
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ── Build Library: selection state ──

describe('library selection', () => {
  function seedLibrary(): string {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    return useCharacterStore.getState().buildLibrary.builds[0].id;
  }

  it('clicking library row updates selected row state', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-row-${id}`));
    });
    expect(useCharacterStore.getState().selectedLibraryBuildId).toBe(id);
  });

  it('library selection is independent from selected slot', async () => {
    const id = seedLibrary();
    useCharacterStore.getState().selectSlot('head');
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-row-${id}`));
    });
    expect(useCharacterStore.getState().selectedLibraryBuildId).toBe(id);
    expect(useCharacterStore.getState().selectedSlot).toBe('head');
  });

  it('selected library row has selected class', async () => {
    const id = seedLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-row-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId(`char-library-row-${id}`).dataset.selected).toBe('true');
  });

  it('deleting selected build clears library selection', async () => {
    const id = seedLibrary();
    useCharacterStore.getState().selectLibraryBuild(id);
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => {
      await userEvent.click(delBtn);
    });
    await act(async () => {
      await userEvent.click(delBtn);
    });
    expect(useCharacterStore.getState().selectedLibraryBuildId).toBeNull();
  });
});

// ── Build Library: metadata display ──

describe('library metadata', () => {
  it('shows build name in library row', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId(`char-library-name-${id}`).textContent).toBe('Warrior');
  });

  it('shows equipped slot count', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId(`char-library-meta-${id}`).textContent).toContain('4/12 slots');
  });

  it('empty build shows 0/12 slots', async () => {
    useCharacterStore.getState().createCharacterBuild('Empty');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId(`char-library-meta-${id}`).textContent).toContain('0/12 slots');
  });
});

// ── Build Library: store integration ──

describe('library store integration', () => {
  it('save writes through and reflects in UI', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-library-empty')).toBeNull();
    expect(screen.getByTestId('char-library-list')).toBeInTheDocument();
  });

  it('delete persists removal in store', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => {
      await userEvent.click(delBtn);
    });
    await act(async () => {
      await userEvent.click(delBtn);
    });
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(0);
  });

  it('duplicate persists new entry in store', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-dup-${id}`));
    });
    expect(useCharacterStore.getState().buildLibrary.builds).toHaveLength(2);
  });

  it('setLibrary preloads builds into the panel', () => {
    // Simulate loading from storage
    let lib = createEmptyLibrary();
    lib = saveBuildToLibrary(lib, VALID_BUILD);
    useCharacterStore.getState().setLibrary(lib);
    useCharacterStore.getState().createCharacterBuild();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-library-list')).toBeInTheDocument();
    expect(screen.getByTestId('char-library-count').textContent).toBe('1');
  });
});

// ── Dirty state visibility ──

describe('dirty state visibility', () => {
  it('new build shows no dirty indicator', () => {
    useCharacterStore.getState().createCharacterBuild('Fresh');
    render(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-dirty-indicator')).toBeNull();
  });

  it('editing active build shows unsaved indicator', () => {
    useCharacterStore.getState().createCharacterBuild('Fresh');
    const { rerender } = render(<CharacterBuilderPanel />);
    act(() => {
      useCharacterStore.getState().equipCharacterPart(HEAD);
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-dirty-indicator')).toBeInTheDocument();
    expect(screen.getByTestId('char-dirty-indicator').textContent).toBe('Unsaved changes');
  });

  it('save clears unsaved indicator', async () => {
    useCharacterStore.getState().createCharacterBuild('Fresh');
    const { rerender } = render(<CharacterBuilderPanel />);
    act(() => {
      useCharacterStore.getState().equipCharacterPart(HEAD);
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-dirty-indicator')).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-dirty-indicator')).toBeNull();
  });

  it('loading saved build clears dirty state', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    // Now modify the build to make dirty
    act(() => {
      useCharacterStore.getState().setCharacterName('Modified');
    });
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-dirty-indicator')).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    // Need confirm since dirty
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-confirm-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-dirty-indicator')).toBeNull();
  });

  it('save button disabled when clean and already saved', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-save-btn')).toBeDisabled();
  });

  it('save button enabled when dirty', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Modified');
    });
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-save-btn')).not.toBeDisabled();
  });

  it('save button enabled for never-saved build', () => {
    useCharacterStore.getState().createCharacterBuild('Brand New');
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-save-btn')).not.toBeDisabled();
  });
});

// ── Build status label ──

describe('build status label', () => {
  it('new build shows "New build" status', () => {
    useCharacterStore.getState().createCharacterBuild('Fresh');
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-build-status').textContent).toBe('New build');
  });

  it('saved build shows "Saved" status', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-build-status').textContent).toBe('Saved');
  });

  it('modified saved build shows "Modified" status', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Changed');
    });
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-build-status').textContent).toBe('Modified');
  });
});

// ── Save vs Save As New ──

describe('save vs save as new', () => {
  it('save overwrites current saved build', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    act(() => {
      useCharacterStore.getState().setCharacterName('Updated Warrior');
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds).toHaveLength(1);
    expect(lib.builds[0].name).toBe('Updated Warrior');
  });

  it('save as new creates new entry with new ID', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const originalId = useCharacterStore.getState().activeSavedBuildId;
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-as-btn'));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    expect(lib.builds).toHaveLength(2);
    expect(useCharacterStore.getState().activeSavedBuildId).not.toBe(originalId);
  });

  it('original saved build remains unchanged after save as new', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const originalId = useCharacterStore.getState().activeSavedBuildId!;
    act(() => {
      useCharacterStore.getState().setCharacterName('Branched');
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-as-btn'));
    });
    const lib = useCharacterStore.getState().buildLibrary;
    const original = lib.builds.find((b) => b.id === originalId)!;
    expect(original.name).toBe('Warrior');
  });

  it('active build identity updates after save as new', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    const beforeId = useCharacterStore.getState().activeCharacterBuild!.id;
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-as-btn'));
    });
    const afterId = useCharacterStore.getState().activeCharacterBuild!.id;
    expect(afterId).not.toBe(beforeId);
    expect(useCharacterStore.getState().activeSavedBuildId).toBe(afterId);
  });

  it('save as new clears dirty', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Changed');
    });
    expect(useCharacterStore.getState().isDirty).toBe(true);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-as-btn'));
    });
    expect(useCharacterStore.getState().isDirty).toBe(false);
  });

  it('onLibraryChange fires on save as new', async () => {
    const onChange = vi.fn();
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    render(<CharacterBuilderPanel onLibraryChange={onChange} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-as-btn'));
    });
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});

// ── Load protection when dirty ──

describe('load protection when dirty', () => {
  function seedAndDirty(): string {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    // Create second build and save
    useCharacterStore.getState().createCharacterBuild('Other');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    // Make dirty
    act(() => {
      useCharacterStore.getState().setCharacterName('Dirty Other');
    });
    return id;
  }

  it('load while dirty shows confirmation', async () => {
    const id = seedAndDirty();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId(`char-library-load-warn-${id}`)).toBeInTheDocument();
    expect(screen.getByText('Discard changes?')).toBeInTheDocument();
  });

  it('cancel leaves active build unchanged', async () => {
    const id = seedAndDirty();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-cancel-${id}`));
    });
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Dirty Other');
    expect(useCharacterStore.getState().isDirty).toBe(true);
  });

  it('confirm loads selected build and clears dirty', async () => {
    const id = seedAndDirty();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-confirm-${id}`));
    });
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Warrior');
    expect(useCharacterStore.getState().isDirty).toBe(false);
  });

  it('load without dirty skips confirmation', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    // Not dirty
    expect(useCharacterStore.getState().isDirty).toBe(false);
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    // Should load directly, no confirm step
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Warrior');
    expect(screen.queryByText('Discard changes?')).toBeNull();
  });
});

// ── Delete safety ──

describe('delete safety with active identity', () => {
  it('deleting non-active saved build leaves active build untouched', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const activeId = useCharacterStore.getState().activeSavedBuildId;
    // Create and save a second build
    useCharacterStore.getState().createCharacterBuild('Other');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const otherId = useCharacterStore.getState().buildLibrary.builds.find(
      (b) => b.id !== useCharacterStore.getState().activeSavedBuildId
    )!.id;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    // Delete the non-active build
    const delBtn = screen.getByTestId(`char-library-del-${otherId}`);
    await act(async () => { await userEvent.click(delBtn); });
    await act(async () => { await userEvent.click(delBtn); });
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Other');
    expect(useCharacterStore.getState().activeSavedBuildId).not.toBeNull();
  });

  it('deleting currently loaded saved build marks active as unsaved', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().activeSavedBuildId!;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const delBtn = screen.getByTestId(`char-library-del-${id}`);
    await act(async () => { await userEvent.click(delBtn); });
    await act(async () => { await userEvent.click(delBtn); });
    // Active build still present
    expect(useCharacterStore.getState().activeCharacterBuild).not.toBeNull();
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Warrior');
    // But no longer linked to saved identity
    expect(useCharacterStore.getState().activeSavedBuildId).toBeNull();
    // Marked dirty since orphaned
    expect(useCharacterStore.getState().isDirty).toBe(true);
  });
});

// ── Revert to saved ──

describe('revert to saved', () => {
  it('revert button appears when dirty and has saved identity', () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Changed');
    });
    render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-revert-btn')).toBeInTheDocument();
  });

  it('revert button does not appear for new unsaved build', () => {
    useCharacterStore.getState().createCharacterBuild('New');
    act(() => {
      useCharacterStore.getState().equipCharacterPart(HEAD);
    });
    render(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-revert-btn')).toBeNull();
  });

  it('revert restores saved version', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Modified');
    });
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Modified');
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-revert-btn'));
    });
    expect(useCharacterStore.getState().activeCharacterBuild!.name).toBe('Warrior');
  });

  it('revert clears dirty', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Modified');
    });
    expect(useCharacterStore.getState().isDirty).toBe(true);
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-revert-btn'));
    });
    expect(useCharacterStore.getState().isDirty).toBe(false);
  });

  it('revert updates validation/UI', async () => {
    // Start with valid, save, then remove a required slot to make invalid+dirty
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().unequipCharacterSlot('head');
    });
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('error');
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-revert-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-validation-summary').textContent).toContain('Valid build');
  });

  it('revert button disappears after revert', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    act(() => {
      useCharacterStore.getState().setCharacterName('Modified');
    });
    const { rerender } = render(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-revert-btn')).toBeInTheDocument();
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-revert-btn'));
    });
    rerender(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-revert-btn')).toBeNull();
  });
});

// ── Identity separation ──

describe('identity separation', () => {
  it('activeSavedBuildId set on save', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    expect(useCharacterStore.getState().activeSavedBuildId).toBeNull();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-save-btn'));
    });
    expect(useCharacterStore.getState().activeSavedBuildId).not.toBeNull();
  });

  it('activeSavedBuildId set on load from library', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    useCharacterStore.getState().clearCharacterBuild();
    expect(useCharacterStore.getState().activeSavedBuildId).toBeNull();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-load-${id}`));
    });
    expect(useCharacterStore.getState().activeSavedBuildId).toBe(id);
  });

  it('creating new build clears activeSavedBuildId', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    expect(useCharacterStore.getState().activeSavedBuildId).not.toBeNull();
    render(<CharacterBuilderPanel />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-new-btn'));
    });
    expect(useCharacterStore.getState().activeSavedBuildId).toBeNull();
  });

  it('selectedLibraryBuildId independent from activeSavedBuildId', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const id = useCharacterStore.getState().buildLibrary.builds[0].id;
    // Create and save a second build
    useCharacterStore.getState().createCharacterBuild('Other');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const otherId = useCharacterStore.getState().activeSavedBuildId!;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    // Select the first build in library
    await act(async () => {
      await userEvent.click(screen.getByTestId(`char-library-row-${id}`));
    });
    expect(useCharacterStore.getState().selectedLibraryBuildId).toBe(id);
    expect(useCharacterStore.getState().activeSavedBuildId).toBe(otherId);
  });
});

// ── Active build marker ──

describe('active build marker', () => {
  it('marks the library row matching activeSavedBuildId with data-active', async () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const savedId = useCharacterStore.getState().activeSavedBuildId!;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const row = screen.getByTestId(`char-library-row-${savedId}`);
    expect(row.dataset.active).toBe('true');
  });

  it('does not mark non-active rows with data-active', async () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const activeId = useCharacterStore.getState().activeSavedBuildId!;
    // Save a second build
    useCharacterStore.getState().createCharacterBuild('Other');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    // The first build should not be active
    const row = screen.getByTestId(`char-library-row-${activeId}`);
    expect(row.dataset.active).toBe('false');
  });

  it('shows "Active" text in metadata for the active library row', async () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const savedId = useCharacterStore.getState().activeSavedBuildId!;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const meta = screen.getByTestId(`char-library-meta-${savedId}`);
    expect(meta.textContent).toContain('Active');
  });

  it('does not show "Active" in metadata for non-active rows', async () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const firstId = useCharacterStore.getState().activeSavedBuildId!;
    useCharacterStore.getState().createCharacterBuild('Other');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const meta = screen.getByTestId(`char-library-meta-${firstId}`);
    expect(meta.textContent).not.toContain('Active');
  });
});

// ── Library row timestamps ──

describe('library row timestamps', () => {
  it('renders the updatedAt date for each library row', async () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const savedId = useCharacterStore.getState().activeSavedBuildId!;
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const dateEl = screen.getByTestId(`char-library-date-${savedId}`);
    expect(dateEl.textContent).toBeTruthy();
    // Should be a valid date string
    expect(dateEl.textContent!.length).toBeGreaterThan(0);
  });
});

// ── Smart duplicate naming in UI ──

describe('smart duplicate naming', () => {
  it('duplicate produces "Name Copy", second duplicate produces "Name Copy 2"', async () => {
    useCharacterStore.getState().createCharacterBuild('Hero');
    useCharacterStore.getState().saveActiveBuildToLibrary();
    const savedId = useCharacterStore.getState().activeSavedBuildId!;
    // First duplicate
    useCharacterStore.getState().duplicateLibraryBuild(savedId);
    let builds = useCharacterStore.getState().buildLibrary.builds;
    expect(builds[0].name).toBe('Hero Copy');
    // Second duplicate of original
    useCharacterStore.getState().duplicateLibraryBuild(savedId);
    builds = useCharacterStore.getState().buildLibrary.builds;
    expect(builds[0].name).toBe('Hero Copy 2');
  });
});

// ── Place in Scene ──

describe('place in scene', () => {
  it('shows Place in Scene button when build is active', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    expect(screen.getByTestId('char-place-btn')).toBeInTheDocument();
  });

  it('Place in Scene button is enabled for valid build', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const btn = screen.getByTestId('char-place-btn');
    expect(btn).not.toBeDisabled();
  });

  it('Place in Scene button is disabled for invalid build (missing required slots)', async () => {
    // Build with only head — missing torso, arms, legs
    const incompleteBuild: CharacterBuild = {
      id: 'inc-1',
      name: 'Incomplete',
      slots: { head: HEAD },
    };
    useCharacterStore.getState().loadCharacterBuild(incompleteBuild);
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const btn = screen.getByTestId('char-place-btn');
    expect(btn).toBeDisabled();
  });

  it('shows placement blocked reason for invalid build', async () => {
    const incompleteBuild: CharacterBuild = {
      id: 'inc-2',
      name: 'Incomplete',
      slots: { head: HEAD },
    };
    useCharacterStore.getState().loadCharacterBuild(incompleteBuild);
    const { rerender } = render(<CharacterBuilderPanel />);
    rerender(<CharacterBuilderPanel />);
    const reason = screen.getByTestId('char-place-reason');
    expect(reason.textContent).toContain('error');
  });

  it('calls onPlaceInScene with character instance when clicked', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const onPlace = vi.fn();
    const { rerender } = render(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    rerender(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-place-btn'));
    });
    expect(onPlace).toHaveBeenCalledTimes(1);
    const instance = onPlace.mock.calls[0][0];
    expect(instance.instanceKind).toBe('character');
    expect(instance.sourceCharacterBuildId).toBe('v1');
    expect(instance.name).toBe('Warrior');
    expect(instance.characterSlotSnapshot.equippedCount).toBe(4);
  });

  it('repeated placement creates distinct instance IDs', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const onPlace = vi.fn();
    const { rerender } = render(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    rerender(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-place-btn'));
    });
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-place-btn'));
    });
    expect(onPlace).toHaveBeenCalledTimes(2);
    const id1 = onPlace.mock.calls[0][0].instanceId;
    const id2 = onPlace.mock.calls[1][0].instanceId;
    expect(id1).not.toBe(id2);
    // Same source build
    expect(onPlace.mock.calls[0][0].sourceCharacterBuildId).toBe(onPlace.mock.calls[1][0].sourceCharacterBuildId);
  });

  it('does not mutate active build after placement', async () => {
    useCharacterStore.getState().loadCharacterBuild(VALID_BUILD);
    const buildBefore = useCharacterStore.getState().activeCharacterBuild;
    const onPlace = vi.fn();
    const { rerender } = render(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    rerender(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    await act(async () => {
      await userEvent.click(screen.getByTestId('char-place-btn'));
    });
    const buildAfter = useCharacterStore.getState().activeCharacterBuild;
    expect(buildAfter).toEqual(buildBefore);
  });

  it('allows placement with warnings (only errors block)', async () => {
    // Valid build + weapon with unmet socket requirement = warning but no error
    const buildWithWarning: CharacterBuild = {
      id: 'w1',
      name: 'With Warning',
      slots: { head: HEAD, torso: TORSO, arms: ARMS, legs: LEGS, weapon: WEAPON },
    };
    useCharacterStore.getState().loadCharacterBuild(buildWithWarning);
    const onPlace = vi.fn();
    const { rerender } = render(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    rerender(<CharacterBuilderPanel onPlaceInScene={onPlace} />);
    const btn = screen.getByTestId('char-place-btn');
    expect(btn).not.toBeDisabled();
    await act(async () => {
      await userEvent.click(btn);
    });
    expect(onPlace).toHaveBeenCalledTimes(1);
  });

  it('does not show Place in Scene button when no build is active', async () => {
    render(<CharacterBuilderPanel />);
    expect(screen.queryByTestId('char-place-btn')).not.toBeInTheDocument();
  });
});
