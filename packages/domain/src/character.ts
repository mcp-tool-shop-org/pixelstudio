// ── Character Slot Vocabulary ──

/** Character slot identifiers — body regions where parts can be equipped. */
export type CharacterSlotId =
  | 'head'
  | 'face'
  | 'hair'
  | 'torso'
  | 'arms'
  | 'hands'
  | 'legs'
  | 'feet'
  | 'accessory'
  | 'back'
  | 'weapon'
  | 'offhand';

/** All slot IDs in canonical display order. */
export const CHARACTER_SLOT_IDS: readonly CharacterSlotId[] = [
  'head',
  'face',
  'hair',
  'torso',
  'arms',
  'hands',
  'legs',
  'feet',
  'accessory',
  'back',
  'weapon',
  'offhand',
] as const;

/** Human-readable labels for slots. */
export const CHARACTER_SLOT_LABELS: Record<CharacterSlotId, string> = {
  head: 'Head',
  face: 'Face',
  hair: 'Hair',
  torso: 'Torso',
  arms: 'Arms',
  hands: 'Hands',
  legs: 'Legs',
  feet: 'Feet',
  accessory: 'Accessory',
  back: 'Back',
  weapon: 'Weapon',
  offhand: 'Off-Hand',
};

/** Slots required for a valid character build. */
export const REQUIRED_SLOTS: readonly CharacterSlotId[] = [
  'head',
  'torso',
  'arms',
  'legs',
] as const;

/** Slots that are optional. */
export const OPTIONAL_SLOTS: readonly CharacterSlotId[] = CHARACTER_SLOT_IDS.filter(
  (s) => !(REQUIRED_SLOTS as readonly string[]).includes(s),
);

// ── Character Part Reference ──

/** A reference to an equipped part in a slot. */
export interface CharacterPartRef {
  /** Source preset or asset ID. */
  sourceId: string;
  /** Target slot this part occupies. */
  slot: CharacterSlotId;
  /** Optional variant within the source (e.g. color variant, expression). */
  variantId?: string;
  /** Tags for filtering/compatibility (e.g. species, style, body type). */
  tags?: string[];
  /** Socket roles this part requires from other parts. */
  requiredSockets?: string[];
  /** Socket roles this part provides to other parts. */
  providedSockets?: string[];
  /** Anchor kinds this part requires. */
  requiredAnchors?: string[];
  /** Anchor kinds this part provides. */
  providedAnchors?: string[];
}

// ── Character Build ──

/** A complete character build — slots mapped to equipped parts. */
export interface CharacterBuild {
  /** Unique build identifier. */
  id: string;
  /** Human-readable name for this build. */
  name: string;
  /** Equipped parts by slot. One part per slot, absent = empty. */
  slots: Partial<Record<CharacterSlotId, CharacterPartRef>>;
  /** Optional tags for categorization (e.g. "warrior", "NPC", "boss"). */
  tags?: string[];
  /** Optional source preset/build ID this was derived from. */
  sourcePresetId?: string;
}

// ── Validation ──

/** Kinds of character validation issues. */
export type CharacterValidationKind =
  | 'missing_required_slot'
  | 'incompatible_part'
  | 'missing_required_socket'
  | 'missing_required_anchor'
  | 'exclusive_slot_conflict'
  | 'slot_mismatch';

/** Severity levels for validation issues. */
export type CharacterValidationSeverity = 'error' | 'warning';

/** A single character validation issue. */
export interface CharacterValidationIssue {
  /** Issue kind for programmatic handling. */
  kind: CharacterValidationKind;
  /** Affected slot, if applicable. */
  slot?: CharacterSlotId;
  /** Human-readable message. */
  message: string;
  /** Related slot for cross-slot issues. */
  relatedSlot?: CharacterSlotId;
  /** Severity — errors block, warnings inform. */
  severity: CharacterValidationSeverity;
}
