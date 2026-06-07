---
date: 2026-05-27
topic: combine-injury-and-crit-resistance
focus: combine injuryResistance and critResistance into one stat without losing resolution
mode: repo-grounded
---

# Ideation: Combine Injury and Crit Resistance

## Grounding Context

`injuryResistance` and `critResistance` currently answer different questions. Threshold injuries use `injuryResistance` to change injury chance with `1d10 >= 8 + injuryResistance - edge` in `module/injury-thresholds.mjs`. Below-zero wounds use `critResistance` to reduce severity with `1d12 + currentInjuries + excessDamage - critResistance` in `module/actor/types/character.mjs`.

The repo already has `injuryResistance` as a typed character/monster data-model field and documented GM-facing playtest bands: 0 unprotected/light, 1 medium/modest natural armor, 2 heavy/strong natural armor, 3 rare exceptional protection. `critResistance` is visible on sheets and exists in `template.json`, but it is not part of the newer character/monster TypeDataModel schema in the same way.

External grounding from CWN/WWN-adjacent trauma systems supports preserving separate underlying concerns even if the sheet gets simpler: protection can affect catastrophic-injury chance, post-hit severity, and hit avoidance in different ways. CWN armor in particular has distinct AC, soak, and trauma-target knobs, so a one-stat UI should avoid flattening those questions into an opaque universal defense.

## Ranked Ideas

### 1. Protection Score With Two Projections

**Description:** Replace visible `IR` and `CR` with one `Protection` stat. Threshold injuries use the existing threshold projection, `1d10 >= 8 + protection - edge`; below-zero wounds use the existing severity projection, `1d12 + currentInjuries + excessDamage - protection`.

**Warrant:** `direct:` both current formulas already consume a flat resistance integer, just from different fields.

**Rationale:** This is the simplest consolidation that does not lose resolution from the rest of the formulas. Threshold chance still varies by Edge, while wound severity still varies by excess damage and existing injuries.

**Downsides:** It assumes the same protection value should apply equally to both mechanics. Existing actors with intentionally different IR/CR values would need migration handling.

**Confidence:** 90%

**Complexity:** Low

**Status:** Unexplored

### 2. Protection Score, Capped Wound Projection

**Description:** Expose one `Protection` stat but derive below-zero wound mitigation as `Math.min(protection, 2)`, while threshold injuries use the full value. Protection 3 remains exceptional against normal-hit threshold injuries, but does not make below-zero wounds too forgiving.

**Warrant:** `reasoned:` the threshold die is only `1d10`, so Protection 3 creates a meaningful impossible no-Edge injury check; the below-zero wound roll has larger severity swing from `1d12 + injuries + excessDamage`, so the same uncapped value may over-soften severe wounds.

**Rationale:** This keeps one visible stat while admitting that the two formulas have different numeric ranges.

**Downsides:** Slightly less intuitive than direct projection. Chat output must explain the cap.

**Confidence:** 82%

**Complexity:** Low-Medium

**Status:** Unexplored

### 3. One Stored Number, Versioned Projection Helper

**Description:** Store one field such as `system.injuryProtection`, then centralize projection in a helper like `getActorInjuryProtection(actor)` returning `{ thresholdProtection, woundProtection }`.

**Warrant:** `direct:` current threshold code already benefits from pure helpers like `getActorInjuryResistance()` and `computeInjuryTargetNumber()`.

**Rationale:** This preserves future tuning flexibility. The initial projection can be one-to-one, capped, or table-based without rewriting sheet templates or every call site later.

**Downsides:** Slightly more abstraction than directly replacing CR reads with IR reads.

**Confidence:** 86%

**Complexity:** Medium

**Status:** Unexplored

### 4. One Visible Protection, Advanced Override Escape Hatch

**Description:** Normal actors get one visible `Protection` stat. Rare actors, magic armor, or playtest monsters may carry hidden advanced overrides for threshold and wound projection if they need unusual behavior.

**Warrant:** `external:` CWN-style armor demonstrates that protection can have meaningful exceptions across AC, soak, and trauma-target behavior; one scalar can lose texture if every special case must fit it.

**Rationale:** This gives most sheets the simplicity win while preserving resolution for exceptional actors.

**Downsides:** Hidden overrides can become invisible complexity if overused. Needs disciplined UI and migration rules.

**Confidence:** 76%

**Complexity:** Medium

**Status:** Unexplored

### 5. Protection Bands With Explicit Table Contract

**Description:** Keep the current 0-3 bands but make them the single contract: 0 none/light, 1 medium, 2 heavy, 3 exceptional. Publish the threshold chance table and document the wound severity projection beside it.

**Warrant:** `direct:` the README already documents the current IR setup guidance and expected values.

**Rationale:** The stat becomes easier to assign consistently. Resolution is preserved by the table, Edge, excess damage, and existing injury pressure rather than by exposing two editable fields.

**Downsides:** Less flexible for actors that previously used different IR and CR values.

**Confidence:** 80%

**Complexity:** Low

**Status:** Unexplored

### 6. Unified Stat, Split Chat Labels

**Description:** Show one sheet stat, but label it contextually in roll output: threshold cards show `Protection X; Edge Y; target Z+`, while below-zero wound cards show `Protection X; severity -X` or the capped projection.

**Warrant:** `direct:` current threshold and wound chat output already expose IR/CR in the audit text.

**Rationale:** One visible stat does not have to mean opaque math. The player sees one defense on the sheet and still gets the full formula when it matters.

**Downsides:** It is supporting UX, not a complete consolidation by itself.

**Confidence:** 78%

**Complexity:** Low

**Status:** Unexplored

### 7. Trauma Buffer Model

**Description:** Replace direct IR/CR modifiers with a shared trauma-pressure model. Protection reduces trauma pressure first; the remaining pressure determines threshold injury chance or wound severity.

**Warrant:** `reasoned:` current threshold severity already has pressure concepts: weapon pressure, health pressure, and existing injury pressure.

**Rationale:** This is the cleanest conceptual unification: one protection stat works against one trauma system, and chance/severity become different interpretations of the same pressure.

**Downsides:** High implementation and tuning cost. It is a redesign, not a low-risk consolidation.

**Confidence:** 55%

**Complexity:** High

**Status:** Unexplored

## Rejection Summary

| # | Idea | Reason Rejected |
|---|------|-----------------|
| 1 | Trauma Guard pips / `TG 2••` | Preserves resolution but adds unfamiliar notation and parsing burden. |
| 2 | Deflect/Damp `2/1` | Mostly repackages the two-stat model under one label. |
| 3 | Tier plus cushion | Similar to Deflect/Damp; better as an override display than the main model. |
| 4 | Trauma DC / severity armor display | Useful derived output, but poor as the primary editable stat because Edge changes the actual threshold. |
| 5 | Protection die | Adds variance and implementation complexity without clear benefit over flat modifiers. |
| 6 | Protection with below-zero doubling | Likely overcorrects wound severity; needs tuning evidence first. |
| 7 | Derived CR from AAC/armor | Contradicts the current repo decision not to infer protection from armor/AAC during this pass. |
| 8 | Global hidden wound modifier | Good playtest knob, but does not really combine the two actor stats. |
| 9 | Automated per-roll profile | Better future extension; too broad for the core consolidation. |
| 10 | Wound Threshold / Injury Save framing | Nice naming, but not a concrete enough mechanical design by itself. |
| 11 | Harm Floor | Changes trigger eligibility semantics more than needed. |
| 12 | Trauma Capacity | Interesting larger redesign, but beyond the requested consolidation. |

## External Sources

- CWN SRD: https://rpg.blulaktuko.net/cwn/srd.html
- WWN SRD: https://rpg.blulaktuko.net/wwn/srd.html
- d20 SRD Vitality and Wound Points: https://www.d20srd.org/srd/variant/adventuring/vitalityAndWoundPoints.htm
