---
title: Revise Threshold Injury Triggers
type: feat
status: completed
date: 2026-05-28
origin: docs/brainstorms/2026-05-28-threshold-injury-trigger-revision-requirements.md
---

# Revise Threshold Injury Triggers

## Overview

Revise the opt-in threshold injury flow so a trusted attack-card damage application can qualify through any of three triggers: natural 20, upper-half original damage formula, or applied damage greater than half the target's maximum HP. Natural 20 critical damage becomes a first-class attack-card action that applies double damage and directly creates a threshold injury outcome when the threshold path is otherwise eligible. Non-natural-20 qualified hits still roll the injury chance die, but the base target changes from 8 to 9.

This plan targets the current source checkout and builds on the existing high-damage formula gate already present in `module/injury-thresholds.mjs`, `module/dice.js`, `module/actor/entity.js`, `module/chat.js`, and `tests/node/injury-thresholds.spec.js`.

---

## Problem Frame

The current threshold injury behavior is too single-path: a hit must pass the trusted context gates and the upper-half original damage formula gate before it can roll the injury die. The new table rule makes three events meaningful: critical attacks, strong original damage rolls, and unusually large damage relative to the target's durability. It also keeps below-zero wound handling authoritative so one damage resolution does not produce both wound and threshold injury consequences.

Planning source: `docs/brainstorms/2026-05-28-threshold-injury-trigger-revision-requirements.md`.

---

## Requirements Trace

- R1. Natural 20 attack cards must expose a dedicated critical damage action while preserving normal damage for exceptions.
- R2. The critical damage action must apply double the original attack damage amount.
- R3. Natural 20 critical damage must directly create a threshold injury outcome when eligible and not below-zero preempted.
- R4. Existing upper-half original damage formula eligibility remains a trigger.
- R5. Applied damage strictly greater than half target maximum HP becomes an additional trigger.
- R6. The half-HP trigger uses maximum HP, not current HP.
- R7. Multiple triggers during one damage application produce at most one injury chance/outcome.
- R8. Existing below-zero wound preemption skips threshold injury for that resolution.
- R9. Non-natural-20 threshold chance rolls use `9 + injuryResistance - edge`.
- R10. Existing exclusions for shock, healing, trauma, environmental/manual damage, unsupported formulas, and untrusted context remain.
- R11. GM audit output identifies the controlling trigger or preemption reason, including simultaneous trigger context.

**Origin actors:** A1 GM, A2 Player, A3 Foundry system
**Origin flows:** F1 Natural 20 critical damage and injury, F2 Multiple injury triggers on one hit, F3 Below-zero wound preemption
**Origin acceptance examples:** AE1 natural 20 critical damage and auto-injury, AE2 upper-half formula uses base 9 chance roll, AE3/AE4 half-max-HP trigger, AE5 multiple triggers one injury, AE6 below-zero wound preemption

---

## Scope Boundaries

- Do not redesign injury severity, location, persistence, or descriptive injury tables.
- Do not add called shots, weapon-type injury palettes, armor absorption, save-to-reduce, or monster body-type adapters.
- Do not change Injury Resistance assignment, armor derivation, or Critical Resistance behavior.
- Do not make shock, healing, trauma, environmental/manual damage, or context-menu damage eligible.
- Do not remove the existing upper-half damage formula trigger.
- Do not change the existing below-zero wound formula or wound card behavior; only preserve its priority over threshold injuries.

---

## Context & Research

### Relevant Code and Patterns

- `module/injury-thresholds.mjs` owns pure threshold helpers: Edge, target number, injury die evaluation, damage range/gate evaluation, idempotency key construction, and trusted action validation.
- `tests/node/injury-thresholds.spec.js` is the current deterministic helper coverage and should absorb the new trigger and target-number math.
- `module/dice.js` constructs `THRESHOLD_CONTEXT_FLAG` on trusted attack cards and currently attaches original damage-gate metadata to normal, half, double, and straight damage actions.
- `templates/chat/roll-attack.hbs` renders normal, half, double, straight, shock, healing, and trauma action buttons with `data-threshold-action-id`.
- `module/item/chat-cards.mjs` reads button dataset values and forwards `thresholdActionId`, `domAction`, source message, multiplier, and trusted context to `applyChatCardDamage`.
- `module/actor/entity.js` applies HP damage first, computes `belowZeroWoundPreempted`, then routes threshold injury after trusted action, provenance, positive-normal-damage, preemption, permission, trigger, idempotency, Edge/IR, and severity checks.
- `module/chat.js` creates GM-only threshold skipped notes and already has a compact pattern for gate audit details.
- `README.md` documents the playtest loop and threshold injury GM setup.

### Institutional Learnings

- No `docs/solutions/` learnings are present in this checkout.
- `docs/ideation/2026-05-28-combat-and-tactics-injury-mechanics-ideation.md` reinforces keeping trigger probability, severity, and fictional consequence as separately tunable knobs.

### External References

- None. This is a repo-local table mechanics decision and uses existing local Foundry patterns.

---

## Key Technical Decisions

- Represent trigger evaluation as structured metadata, not a single boolean: this lets runtime choose the correct branch while chat can audit all qualifying reasons.
- Keep upper-half formula eligibility based on original roll metadata, but compute the half-max-HP trigger from the applied damage amount for the current button and target.
- Treat natural 20 as a threshold auto-trigger after trusted context, positive normal damage, provenance, below-zero preemption, and permission checks. It should bypass the `1d10` injury chance roll, not bypass trust or preemption gates.
- Continue recording the threshold attempt key only when a threshold chance/outcome will actually resolve. Lower-half formula with no other trigger should not consume idempotency.
- Preserve existing `belowZeroWoundPreempted` semantics: it is true only when the existing wound setting handles excess damage. If wounds are off and HP merely clamps to 0, threshold triggers can still run.
- Add dedicated critical action metadata rather than overloading `normalDamageDouble`. This preserves the existing x2 button for non-critical table use and gives natural 20s their own auditable action.
- Change `computeInjuryTargetNumber` through an explicit base parameter or helper instead of scattering a literal 9 in actor code. Existing tests should make the default base change intentional.

---

## Open Questions

### Resolved During Planning

- Should the half-HP trigger use current HP or max HP? Use max HP, carried from the requirements doc.
- Should half max HP be inclusive? No. The trigger is strictly greater than half max HP.
- Does below-zero mean every HP clamp to zero? No. Preserve the existing `belowZeroWoundPreempted` meaning: threshold is skipped only when the existing wound path has taken responsibility for the damage resolution.
- Should natural 20 still roll `1d10`? No. Natural 20 directly creates the threshold injury outcome when otherwise eligible.

### Deferred to Implementation

- Exact helper names and final trigger metadata field names should fit the current `injury-thresholds.mjs` style.
- Exact attack-card labels and layout for critical buttons should be chosen to fit `templates/chat/roll-attack.hbs` without crowding existing normal/half/double/healing controls.
- Godbound/straight damage critical button treatment should preserve existing action semantics while matching the requirement that a natural 20 offers a dedicated critical damage action.

---

## High-Level Technical Design

> *This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.*

### Trigger Decision Matrix

| Condition | HP damage applied | Threshold chance roll | Threshold injury outcome | Attempt key consumed | GM audit |
|---|---:|---:|---:|---:|---|
| Untrusted or excluded action | yes | no | no | no | Existing invalid/excluded reason when GM-only path applies |
| Below-zero wound preempted | yes + wound path | no | no | no | Below-zero preemption |
| Natural 20 critical action | doubled | no | yes | yes | Natural 20, plus any other qualifying triggers |
| Non-natural 20 and upper-half formula qualifies | button amount x multiplier | yes, base 9 | only on `1d10` success | yes | Upper-half formula details |
| Non-natural 20 and applied damage > half max HP | button amount x multiplier | yes, base 9 | only on `1d10` success | yes | Half-max-HP details |
| Lower-half formula and <= half max HP | button amount x multiplier | no | no | no | Lower-half/no qualifying trigger |
| Unsupported formula but > half max HP | button amount x multiplier | yes, base 9 | only on `1d10` success | yes | Half-max-HP trigger plus unsupported formula detail |
| Unsupported formula and <= half max HP | button amount x multiplier | no | no | no | Unsupported formula/no qualifying trigger |

### Runtime Shape

```text
trusted attack-card damage click
  -> apply HP damage through existing flow
  -> threshold setting and actor type gates
  -> validate trusted action context and source provenance
  -> require positive normal attack damage
  -> below-zero wound preemption remains authoritative
  -> require actor update permission
  -> evaluate trigger summary:
       natural20 action/context?
       upper-half formula gate?
       applied damage > half target max HP?
       unsupported formula detail?
  -> no triggers: GM-only skip, no attempt key
  -> trigger present: record attempt key
  -> natural20 auto-trigger: skip 1d10 chance, roll severity and create injury
  -> other triggers: compute Edge/IR target with base 9, roll 1d10, then existing severity path on success
```

---

## Implementation Units

- U1. **Model Threshold Trigger Evaluation**

**Goal:** Replace the single damage-gate result with deterministic trigger-summary helpers that support upper-half formula, natural 20, and half-max-HP triggers without requiring Foundry runtime objects.

**Requirements:** R3, R4, R5, R6, R7, R9, R10, R11; F2; AE2, AE3, AE4, AE5

**Dependencies:** None

**Files:**
- Modify: `module/injury-thresholds.mjs`
- Test: `tests/node/injury-thresholds.spec.js`

**Approach:**
- Keep existing `computeDamageRange`, `evaluateThresholdDamageGate`, and trusted metadata validation behavior for formula-based eligibility.
- Add or adapt a pure helper that evaluates all threshold triggers from trusted action metadata, natural d20, raw applied amount, multiplier, target max HP, and formula gate metadata.
- Return a structured result that can distinguish:
  - `qualifies` for any threshold chance/outcome.
  - `autoInjury` for natural 20.
  - trigger IDs such as `natural20`, `upper-half-damage-roll`, and `greater-than-half-max-hp`.
  - skip/audit details for unsupported formula and no qualifying trigger.
  - half-HP details: applied damage, target max HP, and cutoff.
- Change target-number math to support base 9 for ordinary threshold chance rolls. Prefer a helper shape that makes the base explicit while keeping call sites simple.
- Preserve existing helper behavior for unsupported formulas: unsupported formula alone does not qualify, but it should not block the half-max-HP trigger.

**Execution note:** Implement new domain behavior test-first at the helper layer before changing actor routing.

**Patterns to follow:**
- Existing pure helpers in `module/injury-thresholds.mjs`.
- Existing deterministic assertions in `tests/node/injury-thresholds.spec.js`.

**Test scenarios:**
- Happy path: upper-half formula trigger qualifies and returns trigger metadata with existing formula range/cutoff details.
- Happy path: applied damage 11 against target max HP 20 qualifies through greater-than-half-max-HP.
- Edge case: applied damage exactly 10 against target max HP 20 does not qualify through half-max-HP.
- Edge case: applied damage 10.5 against target max HP 20 qualifies if runtime can produce a fractional applied amount; if runtime floors before threshold evaluation, document and test that chosen behavior.
- Happy path: unsupported formula plus applied damage greater than half max HP qualifies through half-max-HP while preserving unsupported formula audit detail.
- Error path: unsupported formula and applied damage not greater than half max HP returns no qualifying trigger.
- Happy path: natural d20 20 marks the result as `autoInjury`.
- Edge case: natural d20 20 plus half-max-HP and upper-half formula produces one qualifying summary with multiple trigger IDs, not multiple outcomes.
- Happy path: non-natural-20 target number uses base 9 with injury resistance and Edge.
- Regression: existing `maxWeaponDamage`, `computeWeaponPressure`, upper-half formula, and positive normal damage tests still pass.

**Verification:**
- Helper tests prove all trigger combinations and base-9 math without Foundry globals.

---

- U2. **Add Dedicated Critical Damage Action Metadata and Buttons**

**Goal:** Make natural 20 critical damage a first-class trusted attack-card action while preserving normal damage for exceptions and existing x2 behavior.

**Requirements:** R1, R2, R3, R7, R10, R11; F1; AE1, AE5

**Dependencies:** U1

**Files:**
- Modify: `module/dice.js`
- Modify: `templates/chat/roll-attack.hbs`
- Modify: `module/item/chat-cards.mjs` only if action parsing needs a small adjustment
- Test: `tests/node/injury-thresholds.spec.js` for any extracted metadata builder, if one is added

**Approach:**
- In trusted attack context, add a dedicated critical action for natural 20 attack cards only. The action should use the original damage amount and multiplier `2`, with normal threshold action family and normal damage kind.
- Preserve `normalDamage`, `normalDamageHalf`, `normalDamageDouble`, and straight/Godbound actions so existing table workflows continue to work.
- Render a dedicated critical damage button only when the trusted attack context indicates natural d20 20. Keep the normal Apply Damage button visible for exceptions.
- Ensure the critical button has its own `data-threshold-action-id` so actor routing can audit "critical because natural 20" separately from generic x2 damage.
- Keep rendered HTML as a routing hint only. The trusted message flag remains authoritative.
- For Godbound/straight damage mode, preserve the existing distinction between normal and straight damage actions; add the minimum critical action(s) needed so natural 20 can be applied as a dedicated critical path without changing non-critical Godbound buttons.

**Patterns to follow:**
- Existing attack context `actions` shape in `module/dice.js`.
- Existing `data-threshold-action-id` buttons in `templates/chat/roll-attack.hbs`.
- Existing dataset extraction in `module/item/chat-cards.mjs`.

**Test scenarios:**
- Happy path: a natural 20 attack context includes a dedicated critical normal damage action with multiplier 2 and normal action family.
- Happy path: non-natural-20 attack contexts do not advertise a natural-20 critical action.
- Integration: clicking the critical button can be validated by `resolveTrustedThresholdAction` using action ID, DOM action, raw amount, and multiplier 2.
- Regression: generic x2 button metadata remains available and distinct from the natural-20 critical action.
- Regression: shock, trauma, and healing actions remain threshold-ineligible.

**Verification:**
- Natural 20 cards have a visible dedicated critical damage action and normal damage remains available.
- Trusted metadata, not the button label, controls critical eligibility.

---

- U3. **Route Runtime Threshold Resolution Through Trigger Summary**

**Goal:** Apply the multi-trigger model in `_applyThresholdInjuryAfterDamage`, including natural 20 auto-injury, half-max-HP eligibility, base-9 chance rolls, and one attempt per resolution.

**Requirements:** R3, R4, R5, R6, R7, R8, R9, R10, R11; F1, F2, F3; AE1, AE2, AE3, AE4, AE5, AE6

**Dependencies:** U1, U2

**Files:**
- Modify: `module/actor/entity.js`
- Modify: `module/injury-thresholds.mjs` if a small runtime adapter helper is needed
- Test: `tests/node/injury-thresholds.spec.js` for extracted route/decision helpers

**Approach:**
- Keep the existing gate order through trusted context, trusted action, positive normal damage, provenance, below-zero preemption, and actor update permission.
- Evaluate trigger summary after below-zero preemption and permission, before attempt-key construction.
- Pass target max HP from `preDamageHp.max`, applied damage from the same rounded/floored amount semantics used for HP application, and natural d20/action metadata from the trusted attack context/action.
- If no trigger qualifies, return a GM-only skipped result with structured trigger audit data and do not record the attempt key.
- If any trigger qualifies, build and check the existing attempt key once.
- If the trigger summary is `autoInjury`, skip the `1d10` chance roll and continue into the existing severity creation path. The result should indicate the injury chance was auto-triggered rather than rolled.
- If not auto-injury, compute Edge and Injury Resistance as today, but use the base-9 target number.
- Keep the existing severity pressure calculation and persistent injury creation unchanged.
- Preserve below-zero preemption as currently implemented: `belowZeroWoundPreempted` is the skip authority, not every HP clamp to zero.

**Patterns to follow:**
- Current `_applyThresholdInjuryAfterDamage` order in `module/actor/entity.js`.
- Existing `buildThresholdAttemptKey`, Edge/IR, severity pressure, and `character.applyThresholdInjury` flow.

**Test scenarios:**
- Covers AE1. Natural 20 critical damage applies double HP damage through the critical action and creates a threshold injury outcome without rolling `1d10` when not below-zero preempted.
- Covers AE2. Non-natural-20 upper-half formula damage records one attempt and rolls `1d10` against base-9 target math.
- Covers AE3. Non-natural-20 damage greater than half max HP qualifies even when formula metadata is lower-half or unsupported.
- Covers AE4. Damage exactly equal to half max HP does not qualify through the half-HP trigger.
- Covers AE5. Natural 20 plus half-max-HP plus upper-half formula records one attempt and creates one threshold injury outcome.
- Covers AE6. Below-zero wound preemption returns the existing skip reason before trigger summary and does not create threshold injury, even for natural 20.
- Regression: duplicate attempt behavior still skips repeat application after a trigger-qualified attempt has been recorded.
- Regression: lower-half formula damage below or equal half max HP does not record an attempt key.
- Regression: shock, healing, trauma, and context-menu/manual damage still do not route into threshold injuries.
- Error path: actor update permission denial still prevents threshold mutation after HP application and before trigger resolution.

**Verification:**
- Runtime routing matches the trigger decision matrix while preserving HP damage and existing wound preemption behavior.

---

- U4. **Update GM Audit and Injury Output**

**Goal:** Make trigger and skip reasons clear enough for table use, including natural 20 auto-injury and multiple simultaneous triggers.

**Requirements:** R3, R7, R8, R11; F1, F2, F3; AE1, AE5, AE6

**Dependencies:** U1, U3

**Files:**
- Modify: `module/chat.js`
- Modify: `module/actor/types/character.mjs`
- Test: `tests/node/injury-thresholds.spec.js` if formatting support is extracted; otherwise rely on helper output tests and Foundry QA notes

**Approach:**
- Extend GM-only skipped output to include no-trigger details, half-max-HP detail, unsupported formula detail, and below-zero preemption.
- Include multiple trigger IDs in successful threshold result payloads so injury chat can explain natural 20, formula gate, and/or half-max-HP qualification.
- For natural 20 auto-injury, avoid displaying misleading `1d10 vs target` language. The injury card should show that the chance step was automatic due to natural 20, then keep existing severity/location output.
- For non-natural-20 triggered results, keep the injury die display but update target number text to base 9.
- Keep player-facing output compact; detailed skip/trigger audit can remain GM-facing where appropriate.

**Patterns to follow:**
- Current `renderThresholdSkippedNote` and `formatDamageGateAuditDetail` in `module/chat.js`.
- Existing threshold injury card content in `module/actor/types/character.mjs`.

**Test scenarios:**
- Happy path: skipped output for lower-half/no-trigger includes formula and half-HP context when available.
- Happy path: skipped output for unsupported formula plus no half-HP trigger explains fail-closed formula handling.
- Happy path: successful natural 20 threshold card does not claim a `1d10` was rolled.
- Happy path: successful multi-trigger result can show all qualifying trigger labels without creating multiple injury cards.
- Regression: below-zero preemption skip label remains clear.
- Regression: regular non-natural-20 injury output still shows injury die, target number, IR, and Edge.

**Verification:**
- A GM can tell why threshold injury did or did not resolve without inspecting console state.

---

- U5. **Refresh Documentation and Probability Notes**

**Goal:** Keep hand-maintained docs and local analysis scripts aligned with the revised rule.

**Requirements:** R1, R2, R3, R4, R5, R6, R8, R9, R11

**Dependencies:** U1, U3, U4

**Files:**
- Modify: `README.md`
- Modify: `docs/plans/injury-ac-comparison.mjs`
- Modify: `docs/plans/injury-threshold-probabilities.mjs` if it models the old base target or trigger assumptions

**Approach:**
- Update README threshold-injury setup text to describe natural 20 critical action, auto-injury, additive triggers, half-max-HP threshold, below-zero preemption, and base-9 ordinary chance roll.
- Review probability scripts for assumptions about `upper-half`, `max-half`, base target 8, natural 20 Edge-only behavior, or single-trigger damage gate. Update names/output so local comparisons do not silently model stale mechanics.
- Do not turn README into a full rules chapter; keep it as a GM setup and playtest note.

**Patterns to follow:**
- Existing concise threshold injury README bullets.
- Existing option/output style in `docs/plans/injury-ac-comparison.mjs`.

**Test scenarios:**
- Test expectation: none for README prose.
- Happy path: probability script output, if updated, names base-9 ordinary injury chance and distinguishes natural 20 auto-injury from damage-gated ordinary hits.
- Regression: probability script still runs under Node for the documented default arguments, if touched.

**Verification:**
- README and local probability notes no longer contradict runtime mechanics.

---

## System-Wide Impact

- **Interaction graph:** `module/dice.js` trusted attack context -> `templates/chat/roll-attack.hbs` button metadata -> `module/item/chat-cards.mjs` click extraction -> `module/chat.js` damage application -> `module/actor/entity.js` threshold routing -> `module/actor/types/character.mjs` injury card and actor mutation.
- **Error propagation:** Unsupported or untrusted metadata must fail closed for threshold injuries while preserving HP damage. Below-zero wound preemption remains a skip reason, not an error.
- **State lifecycle risks:** Attempt keys should only be recorded after at least one trigger qualifies. Natural 20 auto-injury still consumes one attempt key. No-trigger skips must not prevent a later valid trigger-qualified click from the same card and target.
- **API surface parity:** Manual/context-menu damage remains outside threshold eligibility because it lacks trusted attack context. Attack-card normal, half, double, straight, critical, shock, trauma, and healing actions must keep coherent trust metadata.
- **Integration coverage:** Helper tests can prove trigger math, but at least one Foundry QA pass should exercise actual attack-card clicks for normal, x2, critical, below-zero preemption, and selected-token multi-target behavior.
- **Unchanged invariants:** HP damage applies before threshold injury handling; threshold injuries remain opt-in; wound severity, threshold severity pressure, Injury Resistance fields, Critical Resistance fields, and existing non-attack damage exclusions remain unchanged.

---

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Natural 20 auto-injury accidentally bypasses trust or below-zero preemption gates | Keep natural 20 evaluation after trusted action/provenance/positive-normal/preemption/permission gates; cover this ordering in plan tests and QA. |
| Critical damage button is confused with existing x2 button | Use a distinct action ID and label, preserving generic x2 for table exceptions. |
| Half-max-HP trigger uses a different rounded damage value than HP application | Use the same applied damage semantics as `applyDamage` and document/test the boundary. |
| Unsupported formula fail-closed blocks legitimate massive hits | Let unsupported formula fail only the formula trigger; half-max-HP can still qualify from trusted applied damage. |
| Attempt idempotency hides lower-half/no-trigger audit or consumes future valid clicks | Keep attempt recording after trigger qualification, matching the existing high-damage gate decision. |
| Injury output misleads GMs by showing a skipped `1d10` for natural 20 | Add explicit auto-injury result metadata and adjust threshold injury card language. |
| Existing Node test command may fail under Node 25 | Continue using the project test command where possible; if local Node 25 breaks Mocha, verify with a supported temporary Node runtime as in prior validation and report the environment issue. |

---

## Documentation / Operational Notes

- Update `README.md` because it currently describes the old single high-damage gate and base-8 chance roll.
- No migration or data backfill is expected; this changes runtime mechanics and trusted chat-card metadata only.
- Manual Foundry QA should include selected tokens with different max HP values so the half-max-HP trigger is evaluated per target.

---

## Sources & References

- **Origin document:** [docs/brainstorms/2026-05-28-threshold-injury-trigger-revision-requirements.md](../brainstorms/2026-05-28-threshold-injury-trigger-revision-requirements.md)
- Related plan: [docs/plans/2026-05-28-001-feat-threshold-damage-gate-plan.md](2026-05-28-001-feat-threshold-damage-gate-plan.md)
- Related ideation: [docs/ideation/2026-05-28-combat-and-tactics-injury-mechanics-ideation.md](../ideation/2026-05-28-combat-and-tactics-injury-mechanics-ideation.md)
- Related code: `module/injury-thresholds.mjs`
- Related code: `module/dice.js`
- Related code: `templates/chat/roll-attack.hbs`
- Related code: `module/item/chat-cards.mjs`
- Related code: `module/actor/entity.js`
- Related code: `module/chat.js`
- Related code: `module/actor/types/character.mjs`
- Related tests: `tests/node/injury-thresholds.spec.js`
