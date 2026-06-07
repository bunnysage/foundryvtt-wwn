---
title: Combat & Tactics Injury Mechanics Ideas
topic: combat-and-tactics-injury-mechanics
date: 2026-05-28
status: active
---

# Combat & Tactics Injury Mechanics Ideas

## Grounding

Player's Option: Combat & Tactics separates critical-hit handling into several layers: an exceptional attack trigger, optional save/resistance, hit location, weapon/attack type, target body type, severity, and concrete consequences such as bleeding, stun, movement loss, attack penalties, limb impairment, armor damage, or death. It also includes called shots and knockdowns as adjacent tactical systems rather than making every special combat outcome a critical hit.

The current repo mechanics are intentionally lighter. Threshold injuries use trusted positive attack damage, the upper-half damage gate, Edge from attack quality, Injury Resistance, and a `1d10` check. If triggered, severity is derived from weapon pressure, target health pressure, and existing injuries. Below-zero wounds remain a separate, harsher CR/excess-damage path.

The strongest lesson is not "import the C&T tables"; it is "keep each injury knob separate enough that we can tune probability, severity, and fictional consequence independently."

## Best Ideas

### 1. Add a Save-to-Reduce Step, Not a Save-to-Cancel Step

After the threshold `1d10` succeeds, let a defender save reduce the outcome one severity band. Minor outcomes can become "no persistent injury" while Moderate/Serious/Severe become less punishing.

This borrows C&T's resistance layer without making the initial injury trigger feel wasted. It gives characters one more survivability expression and gives tough monsters a clean way to resist maiming without raising AC or Injury Resistance.

Why it is strong: it tunes harshness without changing trigger probability, so probability work stays understandable.

### 2. Use Called Shots to Choose Location Only If an Injury Triggers

Add an optional attack-card/context flag for called shots. The attacker takes the normal attack penalty or action cost, but if a threshold injury triggers, the called location replaces the random location.

This borrows C&T's called-shot/location interaction while avoiding a separate "called shot always cripples" subsystem.

Why it is strong: it creates tactical intent without increasing injury frequency.

### 3. Add Weapon-Type Flavor Palettes Without Separate Huge Tables

Tag attacks as bludgeoning, piercing, slashing, or natural. Use that tag to choose injury text and light mechanical riders inside the existing severity bands.

Example shape: bludgeoning favors stun/knockdown, piercing favors bleeding/impalement, slashing favors bleeding/limb cuts, natural attacks use creature-specific language.

Why it is strong: it captures the main feel of C&T tables with far less lookup burden.

### 4. Make Armor Sometimes Absorb the Injury

On a successful threshold injury, let armor/protection convert some outcomes into armor damage, shield damage, or "armor saved you" notes. This can be a severity-reduction variant or a rare result in protected locations.

Why it is strong: C&T makes armor and body location matter after the hit. This gives armor a table-visible role beyond AC/IR without deriving everything from AC.

### 5. Split Knockdown From Injury

Use knockdown as its own lightweight hit consequence, probably keyed from heavy weapons, charge, size advantage, or bludgeoning attacks. It should not require a persistent injury.

Why it is strong: C&T treats knockdown as a common tactical effect and injuries as more serious. Keeping them separate avoids bloating the injury system with every combat condition.

### 6. Add Monster Body-Type Adapters

Keep one core injury engine, but let monster body type adapt locations and immunities: humanoid, quadruped, flyer, serpent, amorphous, undead, construct.

Why it is strong: it borrows C&T's "body type matters" idea while staying practical for Foundry automation.

### 7. Let Exceptional Attack Quality Raise Severity, Not Only Chance

The current Edge lowers the `1d10` target. A future tuning option could also let Edge add to severity pressure after the injury triggers, capped tightly.

Why it is strong: a hit by 10+ feels different from barely landing a qualifying injury. Risk: it may double-count attack quality if not capped.

## Ideas Rejected or Deferred

### Full C&T Critical Tables

Too heavy for this system. The table detail is flavorful, but it would slow play and create a large data/content project.

### C&T Trigger Exactly: Natural 18+ and Hit by 5+

This is clear, but it makes injury probability highly AC-dependent in exactly the way we flagged. Our current model already uses hit chance and Edge while preserving a separate damage-quality gate.

### Location-Specific Armor AC

Interesting, but too much item administration for the current Foundry implementation. Armor absorbing/reducing injuries is a better near-term way to make protection matter.

### Permanent Limb Destruction as Common Output

Keep severe effects rare. Threshold injuries should usually produce table friction and story texture, not campaign-ending mutilation from ordinary hits.

## Recommended Discussion Order

1. Decide whether threshold injuries need a save-to-reduce layer.
2. Decide whether called shots should control injury location.
3. Decide whether weapon tags should influence injury descriptions/effects.
4. Decide whether armor should ever absorb/reduce injuries directly.
5. Treat knockdown as a separate future tactical module.
