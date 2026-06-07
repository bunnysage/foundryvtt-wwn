---
date: 2026-06-07
topic: natural-20-critical-hit-note
---

# Natural 20 Critical Hit Note on Attack Cards

## Summary

When an attack roll comes up a natural 20 on the d20, display a simple "Critical Hit!" text note at the bottom of the attack chat card. The note fires on any natural 20 regardless of whether the attack hits AC, and regardless of whether a target is selected. This is a display-only change — it adds no new mechanics.

## Problem Frame

The attack chat card (`templates/chat/roll-attack.hbs`) already computes `isNatural20` and uses it to surface a "Critical Damage" button, but it never tells the player in plain text that they rolled a critical. A natural 20 is a notable, table-celebrating moment that currently has no clear visible callout on the card. Adding a short, obvious note makes the crit legible at a glance without the player needing to read the raw dice.

## Requirements

- R1. When the attack d20 shows a natural 20, the attack chat card displays a "Critical Hit!" note near the bottom of the card.
- R2. The note appears on any natural 20, independent of whether `roll.total` meets or beats the target's AC (a natural 20 always reads as a crit).
- R3. The note appears even when no target is selected (untargeted attacks).
- R4. When the d20 is not a natural 20, no note is shown.
- R5. The note text is a localized string in `lang/en.json` (e.g. `WWN.messages.CriticalHit`), consistent with the existing hit/miss messages.
- R6. The note is plain, non-interactive text — not a button — and is visually distinct (e.g. bold/highlighted) but stylistically simple.

## Acceptance Examples

- AE1. **Covers R1, R2.** A character attacks a target, rolls a natural 20, and the total beats AC: the card shows the normal hit result plus a "Critical Hit!" note.
- AE2. **Covers R2.** A heavily penalized attacker rolls a natural 20 but the total is below the target's AC: the card still shows the "Critical Hit!" note.
- AE3. **Covers R3.** An attack is rolled with no target selected and the d20 is a natural 20: the card shows the "Critical Hit!" note.
- AE4. **Covers R4.** An attack rolls a 19 (or any non-20 face): no note appears.

## Success Criteria

- A player rolling a natural 20 sees an unmistakable "Critical Hit!" callout on the attack card.
- The note relies on the already-computed `isNatural20` value, so it stays consistent with the existing Critical Damage button.
- No change to attack mechanics, damage, or injury-threshold behavior.

## Scope Boundaries

- No change to crit *mechanics* — damage doubling, injury thresholds, and the Critical Damage button are handled elsewhere and are untouched.
- No natural-1 / critical-fumble handling.
- Faction-asset attacks (`templates/chat/asset-attack.hbs`) and any separate ship/asset combat paths are out of scope unless requested later.
- No new configuration toggle; the note is always shown on a natural 20.

## Key Decisions

- Trigger on any natural 20 (not gated on hitting AC): a natural 20 is conceptually always a crit, and this keeps the note's logic identical to the existing `isNatural20` flag with no target dependency.
- Localized string rather than hard-coded text: matches the existing `AttackAscendingSuccess` / `AttackAscendingFailure` pattern and keeps translations possible.
- Template-driven placement near `result.details` / the existing `isNatural20` block: lowest-cost hook, since the value is already in the Handlebars context.
