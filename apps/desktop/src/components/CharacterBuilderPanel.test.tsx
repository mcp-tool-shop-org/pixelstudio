import { describe, it, expect, afterEach, beforeEach } from 'vitest';
import { render, screen, cleanup, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useCharacterStore } from '@glyphstudio/state';
import { CHARACTER_SLOT_IDS } from '@glyphstudio/domain';
import type { CharacterBuild, CharacterPartRef, CharacterPartPreset } from '@glyphstudio/domain';

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
