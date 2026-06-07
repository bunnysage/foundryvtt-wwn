---
date: 2026-05-28
topic: threshold-injury-trigger-revision
---

# Threshold Injury Trigger Revision

## Problem Frame

The current threshold-injury playtest model makes ordinary high damage and attack quality matter, but it still leaves several table-intuitive events underexpressed: a natural 20 should feel exceptional, a single massive hit should threaten injury even if it did not merely land in the upper half of its weapon formula, and below-zero wound handling should remain the authoritative harsher path when it applies.

This revision keeps the existing threshold-injury system as an opt-in table mechanic, but changes the trigger model from one damage-quality gate to multiple qualifying triggers. A damage resolution can qualify through a natural 20, an upper-half damage roll, or damage greater than half the target's maximum HP. Multiple qualifying triggers should be auditable but must still produce at most one threshold injury outcome for that damage resolution.

---

## Actors

- A1. GM: Enables and audits injury rules, applies attack-card damage, and adjudicates exceptions.
- A2. Player: Rolls attacks and applies attack-card damage when permitted by table workflow.
- A3. Foundry system: Preserves trusted attack context, applies HP damage, chooses the applicable injury path, and reports skip/trigger reasons.

---

## Key Flows

- F1. Natural 20 critical damage and injury
  - **Trigger:** A trusted attack card comes from an attack roll with natural d20 result 20.
  - **Actors:** A1, A2, A3
  - **Steps:** The card preserves normal damage for exceptions and exposes a dedicated critical damage action. When critical damage is applied, HP damage is doubled. If below-zero wound handling does not preempt the resolution, the natural 20 directly creates a threshold injury outcome without rolling the threshold `1d10` chance die.
  - **Outcome:** Natural 20s are visibly exceptional: double damage is available as a first-class action and the injury is guaranteed when the threshold path is eligible.
  - **Covered by:** R1, R2, R3, R8

- F2. Multiple injury triggers on one hit
  - **Trigger:** A trusted positive normal attack-card damage application qualifies through one or more triggers.
  - **Actors:** A1, A3
  - **Steps:** The system evaluates natural 20, upper-half damage formula, and greater-than-half-max-HP triggers. It records which triggers qualified for GM audit. If at least one non-natural-20 trigger qualifies, it rolls the normal threshold injury chance die. If several triggers qualify, it still resolves only one threshold injury chance/outcome for that damage application.
  - **Outcome:** Trigger stacking increases audit clarity, not injury roll count.
  - **Covered by:** R4, R5, R6, R7

- F3. Below-zero wound preemption
  - **Trigger:** The same damage application would reduce the target below zero and the existing below-zero wound path applies.
  - **Actors:** A1, A3
  - **Steps:** HP damage and below-zero wound handling run through the existing wound system. Threshold injury evaluation is skipped for that damage resolution, even if natural 20 or high-damage triggers are present.
  - **Outcome:** Below-zero wounds remain the harsher authoritative path and do not double-stack with threshold injuries.
  - **Covered by:** R8

---

## Requirements

**Natural 20 criticals**
- R1. A natural 20 on the attack roll must make a dedicated critical damage action available on the attack card while preserving the normal damage action for exceptions.
- R2. The dedicated critical damage action must apply double the original attack damage amount for HP damage purposes.
- R3. A natural 20 must directly create a threshold injury outcome when threshold injuries are otherwise eligible and below-zero wound handling does not preempt the resolution; it does not roll the threshold `1d10` chance die.

**Damage-based triggers**
- R4. The existing upper-half original damage formula trigger remains a qualifying threshold injury trigger.
- R5. A trusted attack-card damage application must also qualify for threshold injury if the applied damage is strictly greater than half the target's maximum HP.
- R6. The half-max-HP trigger uses target maximum HP, not current HP, so wounded targets do not become easier to injure merely because they are already hurt.
- R7. If multiple triggers qualify during one damage application, the system must resolve at most one threshold injury chance/outcome for that damage application.

**Preemption and target number**
- R8. If the damage application is handled by the existing below-zero wound path, threshold injury handling must be skipped for that same resolution.
- R9. For non-natural-20 threshold injury chance rolls, the base target changes from `8 + injuryResistance - edge` to `9 + injuryResistance - edge`.
- R10. Existing exclusions remain in force: shock, healing, trauma, environmental damage, manual/context-menu damage, and unsupported or untrusted attack context do not create threshold injuries.

**Auditability**
- R11. GM-facing skipped or triggered output should identify which threshold trigger or preemption reason controlled the result: natural 20, upper-half formula damage, greater-than-half-max-HP damage, lower-half damage, unsupported formula, duplicate resolution, or below-zero wound preemption.

---

## Acceptance Examples

- AE1. **Covers R1, R2, R3.** Given a trusted attack card from a natural 20 with 7 original damage, when the critical damage action is applied to an eligible target and below-zero wounds do not preempt, the target takes 14 HP damage and receives a threshold injury outcome without rolling the threshold `1d10` chance die.
- AE2. **Covers R4, R7, R9.** Given a non-natural-20 trusted attack whose original damage roll is in the upper half of its formula range, when damage is applied to an eligible target, the system rolls one threshold injury chance die against `9 + injuryResistance - edge`.
- AE3. **Covers R5, R6, R7.** Given a target with max HP 20, when a trusted attack applies 11 damage without reducing the target below zero, the damage qualifies through the half-max-HP trigger even if the damage formula gate would not qualify.
- AE4. **Covers R5, R6.** Given a target with max HP 20, when a trusted attack applies exactly 10 damage, the half-max-HP trigger does not qualify because the rule is strictly greater than half max HP.
- AE5. **Covers R7, R11.** Given a trusted attack that is both a natural 20 and deals more than half max HP damage, when damage is applied, only one threshold injury outcome is created and the GM audit output can show both triggers.
- AE6. **Covers R8.** Given any trusted attack, including a natural 20, when the same damage resolution is handled by below-zero wound preemption, no threshold injury is created for that resolution.

---

## Success Criteria

- Natural 20s feel table-visible and decisive without requiring the GM to remember a hidden rule.
- Massive single hits can threaten injury even when the weapon-formula upper-half trigger alone would not explain the danger.
- Below-zero wound handling stays authoritative and avoids double punishment from simultaneous wound and threshold injury systems.
- Downstream planning can implement the rule without inventing trigger precedence, target numbers, or audit expectations.

---

## Scope Boundaries

- Do not redesign injury severity, location, persistence, or descriptive injury tables.
- Do not add called shots, weapon-type injury palettes, armor absorption, save-to-reduce, or monster body-type adapters in this change.
- Do not change Injury Resistance assignment, armor derivation, or Critical Resistance behavior.
- Do not make manual/context-menu damage eligible for threshold injuries.
- Do not remove the existing upper-half damage formula trigger; it remains additive with the new triggers.

---

## Key Decisions

- Natural 20s auto-create threshold injuries instead of merely forcing an injury chance roll: this makes critical hits genuinely exceptional and matches the selected rule direction.
- Critical damage should be a dedicated attack-card action: this keeps normal damage available for table exceptions while making the default critical workflow explicit.
- Greater-than-half-HP uses max HP and a strict `>` comparison: this keeps the trigger stable, auditable, and less swingy than using current HP.
- Multiple triggers do not multiply injury rolls: they explain why the resolution is eligible, but the system still produces one injury outcome at most.
- Non-natural-20 threshold chance rolls use base 9 instead of base 8: this lowers ordinary injury frequency while preserving strong-hit and high-damage pathways.

---

## Dependencies / Assumptions

- The existing opt-in threshold injury setting remains the feature gate for this system.
- "Below-zero wound path applies" means the existing wound system has taken responsibility for the damage resolution; threshold injury handling should not also run.
- The current trusted attack-card context remains the authority for attack roll natural die, original damage, and eligible damage actions.

---

## Outstanding Questions

### Deferred to Planning

- [Affects R8][Technical] Confirm the exact code-level condition for "below-zero wound path applies" so the behavior matches the existing wound settings and does not silently disable all threshold injuries when wound rules are off.
- [Affects R11][Technical] Decide the compact GM audit wording and data shape for multiple simultaneous triggers.

---

## Next Steps

-> /ce-plan for structured implementation planning
