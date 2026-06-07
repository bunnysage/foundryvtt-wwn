---
date: 2026-06-07
topic: below-zero-wound-roll-report-only
---

# Below-Zero Wound Roll: Report-Only Severity

## Summary

Reduce the below-zero wound roll (`applyWounds`) to a report-only severity roll: it rolls hit location and a severity number, posts the location name and the number to chat, and increments the actor's Injuries count by one. It no longer narrates or applies any injury effect. The severity formula doubles the injuries term.

## Problem Frame

When the Wounds system is enabled and damage drops a character/monster below 0 HP, the system currently rolls a severity value and then auto-applies a full Goblin Punch "Death & Dismemberment" outcome: hit-location condition text, Mangled/Skullcracked/Crushed save prose, an "unconscious" flag at severity ≥ 11, and fatal-wound accrual at ≥ 16. Those baked-in effects are too prescriptive — they commit the table to one specific injury ruleset and apply mechanical consequences automatically, leaving the GM no room to decide outcomes. The effect ruleset is being redesigned separately, so the roll needs to stop dictating effects and instead surface the raw inputs the GM needs to adjudicate.

## Requirements

- R1. The severity roll formula is `1d12 + (2 × injuries) + excess − critResistance`, where `injuries` is the actor's Injuries count *before* this roll's increment, `excess` is the damage beyond current HP, and `critResistance` is the actor's crit resistance.
- R2. A `1d12` hit-location roll still occurs, and only the location *name* (e.g. "Head", "Left Arm") is shown — no condition, duration, or effect description.
- R3. The roll reports the severity total to chat, along with the dice breakdown and the crit-resistance value used.
- R4. The roll increments the actor's `Injuries` count by exactly 1, every time, regardless of the severity total.
- R5. The roll makes no change to the actor's `Wounds` count and performs no fatal-wound logic.
- R6. All narrative effect output is removed: location condition text, Mangled/Skullcracked/Crushed prose, the "unconscious" line, and the "Fire/Acid/Lightning/Arcane" footnote.
- R7. The chat card shows a minimal Injuries before→after indication so the GM can see the count moved.

## Acceptance Examples

- AE1. **Covers R1, R3, R4.** Given an actor with Injuries = 2, critResistance = 1, taking damage with excess = 3, when the wound roll fires and the d12 shows 7, the reported severity is `7 + (2×2) + 3 − 1 = 13`, and the actor's Injuries becomes 3.
- AE2. **Covers R2, R6.** Given any below-zero hit, when the location d12 shows a Head result, the chat card shows "Head" as the location with no condition or effect text.
- AE3. **Covers R5.** Given an actor with Wounds = 1, when a wound roll fires with a high severity total, the actor's Wounds count remains 1.

## Success Criteria

- A GM can read the chat card and obtain exactly two things: the hit location name and the severity number (with its math), then adjudicate effects themselves using the separate ruleset.
- The Injuries counter rises by 1 per below-zero hit, so `2 × injuries` escalates across a fight without manual editing.
- No automatic effect, status, or Wounds change is applied by this roll.

## Scope Boundaries

- The separate Threshold Injuries and Wound Points systems are not touched.
- The new effect / severity-band ruleset (what a given number *means*) is decided separately and is not part of this change.
- The `Wounds` input remains on the sheet for manual GM use; only the auto-write from this roll is removed.
- No source-attribution comment is added for the old Goblin Punch table (its prose is being removed).

## Key Decisions

- Auto-increment Injuries by 1 (rather than report-only with manual editing): keeps the `2 × injuries` escalation automatic so the formula stays meaningful over successive hits.
- Keep the location roll but show name only: location is cheap narrative color the GM may want, while the mechanical effect is deferred to the GM.
- Always +1 injury, with no extra increment at higher severities: the old extra increment was tied to the now-removed effect branches.
