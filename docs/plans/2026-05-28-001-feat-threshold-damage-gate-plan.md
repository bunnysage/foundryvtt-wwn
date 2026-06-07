---
title: Add High-Damage Gate for Threshold Injuries
type: feat
status: completed
date: 2026-05-28
origin: docs/plans/2026-05-26-001-feat-wwn-v161-local-mechanics-port-plan.md
---

# Add High-Damage Gate for Threshold Injuries

## Overview

Add the remaining threshold-injury damage gate as its own feature: trusted attack-card damage should only roll the `1d10` threshold injury check when the original damage roll is high enough. This plan is split out from the completed `v1.6.1` local-mechanics port because the port work is already done; this follow-up should target the current threshold-injury implementation directly, without any 1.6.1 sheet, install, or porting work.

The intended table behavior is: low damage still applies HP damage normally, but it does not create a threshold injury roll. Only damage rolls in the inclusive upper half of the original damage formula's possible range can proceed to the existing Edge/Injury Resistance check.

---

## Problem Frame

The current threshold-injury path rolls for every trusted positive normal attack-card damage application that passes provenance, ownership, below-zero preemption, and idempotency gates. That makes injury attempts depend on hit quality and Injury Resistance, but not on whether the damage roll itself was meaningfully high.

The desired mechanic adds a damage-quality gate before the injury die: the attack card must carry trusted metadata proving that the original damage roll was at least the inclusive upper-half cutoff for its formula. If that metadata is missing or unsupported, the system should fail closed for injuries while preserving HP damage.

---

## Requirements Trace

- R1. Target the current threshold-injury code path only; do not include `v1.6.1` porting, legacy sheet migration, install packaging, or Azeroth visual QA work.
- R2. Roll no threshold injury die unless the trusted attack card's original damage roll is at least the inclusive upper-half cutoff for its original damage formula.
- R3. Compute the cutoff from the full damage formula range as `ceil((minDamage + maxDamage) / 2)`, including static modifiers in both `minDamage` and `maxDamage`.
- R4. Preserve existing threshold-injury gates: the world setting, trusted attack context, positive normal attack damage only, source provenance, below-zero wound preemption, actor update permission, and current per-card/per-target idempotency.
- R5. Treat damage button multipliers such as half and double damage as application modifiers only; the gate uses the original roll total and original formula range.
- R6. Keep shock, healing, trauma, spell, environmental, and manual/context-menu damage ineligible for threshold injuries regardless of damage total.
- R7. Fail closed when trusted damage range metadata cannot be derived: HP damage applies, the injury roll is skipped, and a GM-only skipped reason explains the unsupported range.
- R8. Add deterministic helper coverage for damage range and gate math before wiring the runtime path.
- R9. Add GM-auditable skipped output for lower-half or unsupported damage rolls, including the original formula, rolled total, range, and cutoff when available.

---

## Scope Boundaries

- No `v1.6.1` baseline work, branch migration, sheet layout changes, compendium work, or Foundry install automation.
- No change to the existing Edge calculation, Injury Resistance target number, severity pressure math, or below-zero wound formula.
- No item-derived `injuryResistance`, armor rules, Player's Option critical tables, or AC probability tuning in this plan.
- No attempt to support every possible Foundry formula expression. Support additive dice and numeric modifier formulas confidently; skip threshold injuries for unsupported formulas.
- No product decision to switch from inclusive upper-half range to "half of max damage only". This plan keeps the already chosen full-range upper-half rule because it handles static modifiers and multi-die formulas consistently.

---

## Context & Research

### Current Code Patterns

- `module/injury-thresholds.mjs`: owns threshold constants and pure helpers such as `computeEdge`, `computeInjuryTargetNumber`, `evaluateInjuryDie`, `resolveTrustedThresholdAction`, `maxWeaponDamage`, and `computeWeaponPressure`.
- `tests/node/injury-thresholds.spec.js`: current Node helper coverage for injury threshold math and trusted action validation.
- `module/dice.js`: builds the trusted attack context stored on chat messages under `THRESHOLD_CONTEXT_FLAG`; normal, half, double, straight, shock, trauma, and healing action metadata is constructed here.
- `module/actor/entity.js`: `_applyThresholdInjuryAfterDamage` validates the trusted action, applies threshold-specific gates, records idempotency, computes Edge/IR, rolls `1d10`, and applies threshold injuries.
- `module/chat.js`: formats damage application output and GM-only threshold skipped reasons.
- `docs/plans/injury-ac-comparison.mjs`: optional analysis script that can model `upper-half`, `max-half`, or `none` damage gates when comparing expected injury probabilities.

### Current Runtime State

- The high-damage gate is not implemented in runtime code.
- Attack contexts already include `baseWeaponDamageFormula`, the attack total, natural d20, source actor/item identity, and per-button action metadata.
- The actor threshold path currently validates trusted positive normal damage and source provenance, checks below-zero preemption and permissions, records a threshold attempt key, then proceeds to Edge/IR and `1d10`.
- Existing helper tests use `.spec.js` filenames, so new coverage should follow that convention instead of the older `.test.mjs` names from the completed port plan.

### External Research

No external research is needed for this plan. The behavior is a local mechanics decision and the necessary implementation patterns are repo-local.

---

## Key Technical Decisions

- Use the full formula range, not only half of the maximum value. `ceil((min + max) / 2)` is stable for dice with static modifiers and for multi-die formulas where "half max" does not match the midpoint of possible totals.
- Store trusted damage-gate metadata in the attack context generated by `module/dice.js`, not in rendered chat HTML. The injury gate should only trust data produced by the system attack roll path.
- Put pure range/gate math in `module/injury-thresholds.mjs` so it can be tested outside Foundry and reused by runtime code.
- Run the damage gate after trusted action/provenance/positive-normal-damage validation and below-zero preemption, but before recording the threshold attempt key and before rolling `1d10`. A lower-half roll is ineligible, not a consumed injury attempt.
- Preserve current idempotency for gate-passed attempts: a trusted attack card should not create repeated threshold injury rolls for the same target/action-family after an actual threshold attempt has been recorded.
- Fail closed for unsupported formulas or missing metadata. That avoids untrusted injury rolls while keeping the HP damage workflow intact.
- Keep half and double damage buttons eligible only if the original roll was eligible. Their multipliers change applied HP damage, not the original roll's injury eligibility.

---

## Open Questions

### Resolved During Planning

- Should this remain inside the completed `v1.6.1` port plan? No. The port is complete, and this is a standalone mechanics follow-up.
- Should the plan use the old v1.6.1 template and test filenames? No. It should reference current branch files such as `tests/node/injury-thresholds.spec.js`.
- Should lower-half damage consume the threshold attempt key? No. The attempt key should be recorded only once the damage gate passes and an injury die could actually be rolled.
- Should the rule use literal "half max" or inclusive upper-half formula range? Use inclusive upper-half formula range: `ceil((min + max) / 2)`.

### Deferred to Implementation

- Exact helper names and metadata field names. The plan expects clear names such as `computeDamageRange`, `computeUpperHalfCutoff`, or `evaluateDamageGate`, but the implementer should fit local style.
- Exact Foundry `Roll` term inspection shape. Prefer evaluated roll terms when reliable, with parser fallback for additive dice/static formulas.
- Whether straight/Godbound damage can carry trustworthy original range metadata in all cases. If not, skip threshold injuries for those actions with an unsupported-range GM note.

---

## High-Level Technical Design

> This is directional guidance for review, not implementation code.

```text
trusted attack-card damage click
  -> apply HP damage through existing flow
  -> threshold setting and actor type gates
  -> validate trusted action context and source provenance
  -> require positive normal attack damage
  -> below-zero wound preemption remains authoritative
  -> evaluate original damage roll gate
       -> unsupported range: skip injury, GM-only audit note
       -> rolled total below cutoff: skip injury, GM-only audit note
       -> rolled total >= cutoff: continue
  -> record threshold attempt key
  -> compute Edge and Injury Resistance target
  -> roll threshold injury 1d10
```

---

## Implementation Units

- U1. **Add Damage Range and Gate Helpers**

**Goal:** Provide deterministic, runtime-independent helpers for formula range and eligibility math.

**Requirements:** R2, R3, R7, R8

**Files:**
- Modify: `module/injury-thresholds.mjs`
- Modify: `tests/node/injury-thresholds.spec.js` or add `tests/node/injury-damage-gate.spec.js`

**Approach:**
- Add helpers that compute `minDamage`, `maxDamage`, and `upperHalfCutoff` for additive formulas made from dice terms and static numeric modifiers.
- Handle omitted die counts such as `d6` as `1d6`.
- Include negative static modifiers in both range ends.
- Return a structured unsupported result instead of guessing when a formula includes unsupported terms.
- Keep `maxWeaponDamage` and `computeWeaponPressure` behavior stable, either by leaving them alone or by carefully layering them on top of the new range helper without changing current pressure test results.

**Test scenarios:**
- `1d8 + 1` returns range `2..9` and cutoff `6`.
- `2d6` returns range `2..12` and cutoff `7`.
- `2d4 - 1` returns range `1..7` and cutoff `4`.
- `1d6 + 2 + 1` returns range `4..9` and cutoff `7`.
- `d6 + 1` is treated as `1d6 + 1`.
- A rolled total equal to cutoff qualifies.
- A rolled total one below cutoff does not qualify.
- Unsupported formulas return an unsupported gate result and never qualify by default.
- Existing `maxWeaponDamage` and `computeWeaponPressure` tests keep passing.

**Verification:** Helper tests prove the math before any Foundry runtime wiring is changed.

- U2. **Attach Trusted Damage Gate Metadata to Attack Contexts**

**Goal:** Ensure every trusted positive normal damage action carries enough metadata to audit and evaluate the damage gate.

**Requirements:** R2, R3, R5, R6, R7, R9

**Files:**
- Modify: `module/dice.js`
- Modify: `module/injury-thresholds.mjs`
- Test: `tests/node/injury-thresholds.spec.js` or `tests/node/injury-damage-gate.spec.js` for any extracted metadata builder

**Approach:**
- Build original damage metadata when the attack damage roll is evaluated: formula, rolled total, min, max, cutoff, pass/fail, and unsupported reason when applicable.
- Attach that metadata to normal positive damage actions: `normalDamage`, `normalDamageHalf`, `normalDamageDouble`, and `straightDamage` only when straight damage can be backed by trustworthy original roll data.
- Keep shock, trauma, and healing marked ineligible.
- Do not derive trust from button labels, rendered HTML, or client-provided raw amount alone.
- Keep multipliers separate from original roll eligibility so half and double buttons share the same gate result as the original damage roll.

**Test scenarios:**
- Normal, half, and double damage actions all point to the same original gate metadata.
- Half and double buttons do not recalculate the cutoff from the multiplied amount.
- Ineligible actions have no qualifying gate metadata and remain excluded.
- Unsupported formulas preserve enough reason data for a GM-only skipped note.

**Verification:** Attack-card context contains auditable damage-gate metadata without changing damage button amounts or existing chat-card behavior.

- U3. **Apply the Gate Before Threshold Injury Rolls**

**Goal:** Prevent `1d10` threshold injury rolls unless the trusted damage gate passes.

**Requirements:** R1, R2, R4, R5, R6, R7, R9

**Files:**
- Modify: `module/actor/entity.js`
- Modify: `module/chat.js`
- Test: `tests/node/injury-thresholds.spec.js` if routing can be covered through extracted helpers, or add a focused Node test for the gate evaluation helper

**Approach:**
- In `_applyThresholdInjuryAfterDamage`, evaluate the trusted action's damage gate after existing action/provenance/positive-normal/below-zero checks and before threshold attempt key recording.
- If the gate is unsupported, return a GM-only skipped result with reason such as `unsupported-threshold-damage-range`.
- If the roll is below cutoff, return a GM-only skipped result with reason such as `lower-half-threshold-damage-roll`.
- Include formula, rolled total, min, max, and cutoff in the returned skip payload when available.
- Only record the existing threshold attempt flag when the damage gate passes and the code is about to proceed to Edge/IR and `1d10`.
- Keep all existing non-threshold damage applications applying HP damage normally.

**Test scenarios:**
- Lower-half trusted normal damage applies HP damage, does not roll `1d10`, and returns a lower-half skipped reason.
- Cutoff-equal trusted normal damage proceeds to Edge/IR and can roll `1d10`.
- Unsupported range metadata applies HP damage, does not roll `1d10`, and returns an unsupported-range skipped reason.
- Lower-half skipped damage does not record a duplicate threshold attempt.
- Gate-passed damage preserves current duplicate-attempt behavior for repeated clicks from the same attack card and target.
- Shock, healing, trauma, manual context-menu damage, and below-zero wound preemption remain unchanged.

**Verification:** Runtime threshold routing is now damage-gated without changing base damage application.

- U4. **Update Audit Output and Probability Notes**

**Goal:** Make the new gate visible enough for table use and keep local analysis tools aligned.

**Requirements:** R7, R9

**Files:**
- Modify: `module/chat.js`
- Modify: `docs/plans/injury-ac-comparison.mjs` only if implementation names or semantics differ from the current script assumptions
- Modify: `README.md` or a focused docs note only if the repo already documents threshold-injury table rules

**Approach:**
- Add clear GM-only skipped labels for lower-half and unsupported damage gates.
- Include compact audit details in skipped output: formula, rolled total, range, and cutoff.
- Keep player-facing chat uncluttered; the extra explanation is for the GM audit trail.
- Confirm the probability script still matches the chosen `upper-half` semantics, especially the `ceil((min + max) / 2)` cutoff.

**Test scenarios:**
- Lower-half skip output names the damage roll and cutoff.
- Unsupported range skip output explains that the formula could not be evaluated safely.
- Public/player-visible output does not gain unnecessary mechanics noise.
- The probability script still models the same upper-half rule used by runtime code.

**Verification:** GMs can tell why a threshold injury did or did not roll, and probability comparisons remain mechanically aligned.

---

## Sequencing

1. Implement and test pure range/gate helpers first.
2. Add trusted attack-context metadata in `module/dice.js`.
3. Wire `_applyThresholdInjuryAfterDamage` to skip before attempt recording when the gate fails.
4. Add chat skip labels and audit details.
5. Run helper tests, then manually verify in Foundry from a real attack card if a browser/Foundry harness is available.

---

## Risk Analysis & Mitigation

- Risk: formula parsing silently qualifies unsupported damage.
  - Mitigation: unsupported results must fail closed and be visible to the GM.
- Risk: half/double buttons use multiplied damage and skew eligibility.
  - Mitigation: store original roll metadata once and reference it from all normal damage application actions.
- Risk: lower-half clicks record duplicate attempts and hide later audit output.
  - Mitigation: place the damage gate before threshold attempt flag writes.
- Risk: refactoring `maxWeaponDamage` changes severity pressure.
  - Mitigation: preserve existing pressure tests and avoid changing `computeWeaponPressure` semantics unless covered by tests.
- Risk: Foundry `Roll` term shapes differ from Node helper assumptions.
  - Mitigation: keep formula parser fallback deterministic, and skip threshold injuries when runtime term inspection cannot produce trusted metadata.

---

## Success Criteria

- Trusted positive normal attack damage below the inclusive upper-half cutoff applies HP damage and does not roll threshold injury.
- Trusted positive normal attack damage at or above the cutoff proceeds to the existing Edge/Injury Resistance `1d10` gate.
- Unsupported formulas skip threshold injury fail-closed with a GM-only explanation.
- Half and double damage buttons use the original damage roll's eligibility.
- Existing exclusions and below-zero wound preemption still behave as they do now.
- Node helper tests cover the damage range and cutoff math.
