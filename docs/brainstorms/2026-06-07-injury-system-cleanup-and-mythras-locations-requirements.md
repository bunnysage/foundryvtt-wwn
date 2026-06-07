---
date: 2026-06-07
topic: injury-system-cleanup-and-mythras-locations
---

# Injury System Cleanup: Remove Fatal Wounds, Merge IR/CR, Mythras Locations

## Summary

Three related changes to the post-zero injury system: remove the fatal-wounds concept and its counter entirely, merge Injury Resistance (IR) and Crit Resistance (CR) into a single two-input section on the character and monster sheets (mirroring the current I/W layout), and replace the `applyWounds` hit-location roll with the Mythras d20 hit-location table (including its location detail text).

## Problem Frame

The below-zero wound roll was recently reduced to a report-only severity roll, but the fatal-wounds machinery it used to drive still lingers: a `system.hp.wounds` data field on three actor types, a wounds input paired with injuries on both sheets, and a setting whose text still advertises a "Wounds tracker." With effects now decided by the GM, the fatal-wounds counter is dead weight and confuses the sheet. Separately, the sheets show Injury Resistance and Crit Resistance as two unrelated single boxes, costing vertical space and visually divorcing two closely-related resistance values. Finally, the placeholder `1d12`-to-Arm/Leg/Torso/Head location map is coarse; the Mythras d20 distribution gives finer, asymmetric (left/right) locations with descriptive detail.

## Requirements

**Remove fatal wounds**
- R1. Delete the `wounds` field from the character, monster, and ship data models (`module/data/actor/character.mjs`, `monster.mjs`, `ship.mjs`) and from `template.json`.
- R2. Remove the wounds `<input>` from both sheets and collapse the combined "I/W" counter to an injuries-only control (no `/` separator, label and tooltip reference Injuries only).
- R3. Update the "Enable Wounds System" setting's display name and hint text so they no longer reference the removed fatal-wounds counter. Keep the setting key `replaceStrainWithWounds` unchanged (no migration).

**Merge IR and CR**
- R4. On the character sheet, present IR and CR as a single section with two side-by-side inputs under one shared label, mirroring the current I/W box. IR is the left input, CR the right; shared label "IR/CR".
- R5. On the monster sheet, present the merged IR/CR control as a single Attributes-tab box alongside the I/W and SS boxes, and remove the separate IR and CR fields from the monster header.

**Mythras hit locations**
- R6. Change the location roll in `applyWounds` from `1d12` to `1d20`, mapped to the Mythras hit-location table: 1-3 Right Leg, 4-6 Left Leg, 7-9 Abdomen, 10-12 Chest, 13-15 Right Arm, 16-18 Left Arm, 19-20 Head.
- R7. Display the Mythras location detail text (e.g. "Includes right hip and thigh") alongside the location name in the chat card.
- R8. Leave the severity roll formula unchanged: `1d12 + (2 × injuries) + excess − critResistance`. Only the location roll changes.

## Acceptance Examples

- AE1. **Covers R6, R7.** Given a below-zero hit, when the location d20 shows 11, the chat card reports "Chest" with the detail "Includes upper torso and back".
- AE2. **Covers R2.** Given the Wounds system enabled, when viewing an actor sheet, the injuries control shows a single input with no wounds field beside it.
- AE3. **Covers R4.** Given the character sheet, IR and CR appear in one bordered section with two inputs under an "IR/CR" label rather than two separate boxes.

## Success Criteria

- No reference to a fatal-wounds counter remains in data models, sheets, or `template.json`; the `applyWounds` roll still functions and increments injuries.
- IR and CR read as a single paired control on both sheets, consistent with the I/W pattern.
- A below-zero hit reports a Mythras location name plus its detail text and the unchanged severity number.

## Scope Boundaries

- Wound Points (WP) and the System Strain (SS) box are not touched.
- The standalone manual macros `apply-wounds.js` and `critical-hit.js` are not changed.
- Internal identifiers (`applyWounds`, `showWoundCounters`, `belowZeroWoundPreempted`) keep their current names.
- The severity formula, injury increment behavior, and report-only nature of the roll are unchanged.

## Key Decisions

- Edits target the repo (`/Users/personal/code/wwn`) source `.hbs` templates, not the older installed build at `Data/systems/wwn` (which uses legacy `.html` templates). The live sheet reflects that change only after the system is rebuilt/redeployed.
- Monster IR/CR move into an Attributes-tab box (mirroring the repo's I/W box) rather than staying inline in the header, to match the "just like I/W" intent.
- Keep the `replaceStrainWithWounds` setting key to avoid a settings migration; only its user-facing text changes.

## Dependencies / Assumptions

- Removing a DataModel field does not require a migration script; Foundry drops the now-unknown stored `wounds` value on load with no error.
