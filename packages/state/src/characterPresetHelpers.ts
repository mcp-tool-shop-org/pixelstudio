import type {
  CharacterBuild,
  CharacterPartPreset,
  CharacterSlotId,
  PresetCompatibilityTier,
  PresetSlotCompatibility,
} from '@glyphstudio/domain';
import { CHARACTER_SLOT_LABELS } from '@glyphstudio/domain';
import { collectProvidedSockets, collectProvidedAnchors } from './characterHelpers';

// ── Compatibility classification ──

/**
 * Classify a preset's compatibility with a target slot and current build.
 *
 * Rules:
 * - Slot mismatch → incompatible
 * - Slot match + missing required sockets/anchors → warning
 * - Slot match + all requirements satisfied → compatible
 */
export function classifyPresetCompatibility(
  preset: CharacterPartPreset,
  targetSlot: CharacterSlotId,
  build: CharacterBuild,
): PresetSlotCompatibility {
  const reasons: string[] = [];

  // Rule 1: slot mismatch is a hard incompatibility
  if (preset.slot !== targetSlot) {
    reasons.push(
      `Part targets "${CHARACTER_SLOT_LABELS[preset.slot]}" but slot is "${CHARACTER_SLOT_LABELS[targetSlot]}".`,
    );
    return { preset, tier: 'incompatible', reasons };
  }

  // Collect what the build (excluding the target slot) provides
  // We exclude the target slot because the preset would replace its occupant
  const buildWithoutSlot: CharacterBuild = {
    ...build,
    slots: { ...build.slots },
  };
  delete buildWithoutSlot.slots[targetSlot];

  const providedSockets = collectProvidedSockets(buildWithoutSlot);
  const providedAnchors = collectProvidedAnchors(buildWithoutSlot);

  // Also include what the preset itself provides
  if (preset.providedSockets) {
    for (const s of preset.providedSockets) providedSockets.add(s);
  }
  if (preset.providedAnchors) {
    for (const a of preset.providedAnchors) providedAnchors.add(a);
  }

  // Rule 2: check required sockets
  if (preset.requiredSockets) {
    for (const req of preset.requiredSockets) {
      if (!providedSockets.has(req)) {
        reasons.push(`Requires socket "${req}" but no other equipped part provides it.`);
      }
    }
  }

  // Rule 3: check required anchors
  if (preset.requiredAnchors) {
    for (const req of preset.requiredAnchors) {
      if (!providedAnchors.has(req)) {
        reasons.push(`Requires anchor "${req}" but no other equipped part provides it.`);
      }
    }
  }

  const tier: PresetCompatibilityTier = reasons.length > 0 ? 'warning' : 'compatible';
  return { preset, tier, reasons };
}

// ── Catalog filtering ──

/**
 * Filter and classify presets for a target slot.
 * Returns only compatible and warning-tier presets (excludes incompatible).
 * Results are sorted: compatible first, then warnings.
 */
export function getCompatiblePresetsForSlot(
  presets: CharacterPartPreset[],
  slot: CharacterSlotId,
  build: CharacterBuild,
): PresetSlotCompatibility[] {
  const results: PresetSlotCompatibility[] = [];

  for (const preset of presets) {
    const compat = classifyPresetCompatibility(preset, slot, build);
    if (compat.tier !== 'incompatible') {
      results.push(compat);
    }
  }

  // Sort: compatible first, then warnings
  results.sort((a, b) => {
    if (a.tier === b.tier) return 0;
    return a.tier === 'compatible' ? -1 : 1;
  });

  return results;
}

/**
 * Get all presets classified for a slot, including incompatible ones.
 * Useful for showing a full catalog with disabled incompatible entries.
 */
export function classifyAllPresetsForSlot(
  presets: CharacterPartPreset[],
  slot: CharacterSlotId,
  build: CharacterBuild,
): PresetSlotCompatibility[] {
  return presets.map((preset) => classifyPresetCompatibility(preset, slot, build));
}
