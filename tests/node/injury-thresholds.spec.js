import { describe, it } from "mocha";
import { expect } from "chai";
import {
  THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
  THRESHOLD_CONTEXT_SCHEMA_VERSION,
  buildThresholdAttackActions,
  buildThresholdAttemptKey,
  computeEdge,
  computeExistingInjuryPressure,
  computeDamageRange,
  computeHealthPressure,
  computeInjuryTargetNumber,
  computeSeverityBand,
  computeTotalPressure,
  computeUpperHalfCutoff,
  computeWeaponPressure,
  evaluateInjuryDie,
  evaluateThresholdDamageGate,
  evaluateThresholdTriggerSummary,
  evaluateTrustedThresholdDamageGate,
  isPositiveNormalAttackDamage,
  isValidAttackContext,
  maxWeaponDamage,
  normalizeInjuryResistance,
  resolveTrustedThresholdAction,
} from "../../module/injury-thresholds.mjs";

describe("module/injury-thresholds.mjs", () => {
  it("normalizes missing, invalid, decimal, and negative injury resistance", () => {
    expect(normalizeInjuryResistance(undefined)).to.equal(0);
    expect(normalizeInjuryResistance("not-a-number")).to.equal(0);
    expect(normalizeInjuryResistance(-1)).to.equal(0);
    expect(normalizeInjuryResistance(2.8)).to.equal(2);
  });

  it("computes injury targets from resistance and edge", () => {
    expect(computeInjuryTargetNumber({ injuryResistance: 0, edge: 0 })).to.equal(9);
    expect(computeInjuryTargetNumber({ injuryResistance: 1, edge: 1 })).to.equal(9);
    expect(computeInjuryTargetNumber({ injuryResistance: 2, edge: 2 })).to.equal(9);
    expect(computeInjuryTargetNumber({ injuryResistance: 3, edge: 0 })).to.equal(12);
    expect(computeInjuryTargetNumber({ base: 8, injuryResistance: 3, edge: 0 })).to.equal(11);
  });

  it("allows target numbers above 10 to be impossible on a d10", () => {
    expect(evaluateInjuryDie({ dieResult: 10, targetNumber: 11 })).to.equal(false);
    expect(evaluateInjuryDie({ dieResult: 10, targetNumber: 10 })).to.equal(true);
    expect(evaluateInjuryDie({ dieResult: 7, targetNumber: 8 })).to.equal(false);
  });

  it("computes edge from attack margin and natural 20s", () => {
    expect(computeEdge({ attackTotal: 20, targetAac: 16, naturalD20: 12 })).to.include({ eligible: true, edge: 0, source: "hit", margin: 4 });
    expect(computeEdge({ attackTotal: 21, targetAac: 16, naturalD20: 12 })).to.include({ eligible: true, edge: 1, source: "margin5", margin: 5 });
    expect(computeEdge({ attackTotal: 26, targetAac: 16, naturalD20: 12 })).to.include({ eligible: true, edge: 2, source: "margin10", margin: 10 });
    expect(computeEdge({ attackTotal: 15, targetAac: 16, naturalD20: 12 })).to.include({ eligible: false, edge: 0, reason: "attack-margin-below-aac", margin: -1 });
    expect(computeEdge({ attackTotal: 15, targetAac: 16, naturalD20: 20 })).to.include({ eligible: true, edge: 3, source: "natural20" });
  });

  it("keeps natural 20 edge math available for severity context", () => {
    const edge = computeEdge({ attackTotal: 15, targetAac: 16, naturalD20: 20 });
    const targetNumber = computeInjuryTargetNumber({ injuryResistance: 3, edge: edge.edge });
    expect(targetNumber).to.equal(9);
    expect(evaluateInjuryDie({ dieResult: 8, targetNumber })).to.equal(false);
    expect(evaluateInjuryDie({ dieResult: 9, targetNumber })).to.equal(true);
  });

  it("computes weapon pressure from base weapon maximums", () => {
    expect(maxWeaponDamage("1d4")).to.equal(4);
    expect(maxWeaponDamage("1d8 + 1")).to.equal(9);
    expect(maxWeaponDamage("2d6")).to.equal(12);
    expect(computeWeaponPressure("1d4")).to.equal(-1);
    expect(computeWeaponPressure("1d6")).to.equal(-1);
    expect(computeWeaponPressure("1d8")).to.equal(0);
    expect(computeWeaponPressure("1d10")).to.equal(1);
    expect(computeWeaponPressure("1d12")).to.equal(1);
    expect(computeWeaponPressure("2d6")).to.equal(1);
    expect(computeWeaponPressure("not a formula")).to.equal(0);
  });

  it("computes additive damage ranges and upper-half cutoffs", () => {
    expect(computeDamageRange("1d8 + 1")).to.deep.equal({
      minDamage: 2,
      maxDamage: 9,
      upperHalfCutoff: 6,
    });
    expect(computeDamageRange("2d6")).to.deep.equal({
      minDamage: 2,
      maxDamage: 12,
      upperHalfCutoff: 7,
    });
    expect(computeDamageRange("2d4 - 1")).to.deep.equal({
      minDamage: 1,
      maxDamage: 7,
      upperHalfCutoff: 4,
    });
    expect(computeDamageRange("1d6 + 2 + 1")).to.deep.equal({
      minDamage: 4,
      maxDamage: 9,
      upperHalfCutoff: 7,
    });
    expect(computeDamageRange("d6 + 1")).to.deep.equal({
      minDamage: 2,
      maxDamage: 7,
      upperHalfCutoff: 5,
    });
    expect(computeDamageRange("1d8+-1")).to.deep.equal({
      minDamage: 0,
      maxDamage: 7,
      upperHalfCutoff: 4,
    });
    expect(computeDamageRange("1d8--1")).to.equal(null);
    expect(computeUpperHalfCutoff({ minDamage: 2, maxDamage: 9 })).to.equal(6);
  });

  it("evaluates threshold damage gates from original roll totals", () => {
    expect(evaluateThresholdDamageGate({ formula: "1d8 + 1", rolledTotal: 6 })).to.include({
      qualifies: true,
      supported: true,
      reason: null,
      rolledTotal: 6,
      minDamage: 2,
      maxDamage: 9,
      upperHalfCutoff: 6,
    });
    expect(evaluateThresholdDamageGate({ formula: "1d8 + 1", rolledTotal: 5 })).to.include({
      qualifies: false,
      supported: true,
      reason: "lower-half-threshold-damage-roll",
      rolledTotal: 5,
      minDamage: 2,
      maxDamage: 9,
      upperHalfCutoff: 6,
    });
    expect(evaluateThresholdDamageGate({ formula: "1d6 * 2", rolledTotal: 8 })).to.include({
      qualifies: false,
      supported: false,
      reason: "unsupported-threshold-damage-range",
      formula: "1d6 * 2",
      rolledTotal: 8,
    });
  });

  it("requires trusted threshold damage gate metadata at runtime", () => {
    const trusted = evaluateTrustedThresholdDamageGate({
      qualifies: true,
      supported: true,
      formula: "2d6",
      rolledTotal: 7,
      minDamage: 2,
      maxDamage: 12,
      upperHalfCutoff: 7,
    });
    expect(trusted).to.include({
      qualifies: true,
      supported: true,
      formula: "2d6",
      rolledTotal: 7,
      minDamage: 2,
      maxDamage: 12,
      upperHalfCutoff: 7,
    });

    const missing = evaluateTrustedThresholdDamageGate();
    expect(missing).to.include({
      qualifies: false,
      supported: false,
      reason: "unsupported-threshold-damage-range",
      formula: "",
      rolledTotal: null,
    });
  });

  it("summarizes upper-half formula threshold triggers", () => {
    const summary = evaluateThresholdTriggerSummary({
      naturalD20: 14,
      action: { damageGate: evaluateThresholdDamageGate({ formula: "1d8 + 1", rolledTotal: 6 }) },
      appliedDamage: 6,
      targetMaxHp: 20,
    });

    expect(summary).to.include({
      qualifies: true,
      autoInjury: false,
      reason: null,
    });
    expect(summary.triggers).to.deep.equal(["upper-half-damage-roll"]);
    expect(summary.damageGate).to.include({ supported: true, qualifies: true, upperHalfCutoff: 6 });
    expect(summary.halfMaxHp).to.include({ qualifies: false, appliedDamage: 6, targetMaxHp: 20, cutoff: 10 });
  });

  it("summarizes greater-than-half-max-HP threshold triggers with strict boundary", () => {
    expect(evaluateThresholdTriggerSummary({
      action: { damageGate: evaluateThresholdDamageGate({ formula: "1d8 + 1", rolledTotal: 4 }) },
      appliedDamage: 11,
      targetMaxHp: 20,
    }).triggers).to.deep.equal(["greater-than-half-max-hp"]);

    const boundary = evaluateThresholdTriggerSummary({
      action: { damageGate: evaluateThresholdDamageGate({ formula: "1d8 + 1", rolledTotal: 4 }) },
      appliedDamage: 10,
      targetMaxHp: 20,
    });
    expect(boundary).to.include({ qualifies: false, autoInjury: false, reason: "no-threshold-trigger" });
    expect(boundary.halfMaxHp).to.include({ qualifies: false, appliedDamage: 10, targetMaxHp: 20, cutoff: 10 });

    expect(evaluateThresholdTriggerSummary({
      appliedDamage: 10.5,
      targetMaxHp: 20,
    }).triggers).to.deep.equal(["greater-than-half-max-hp"]);
  });

  it("allows unsupported formula metadata to qualify through half max HP", () => {
    const summary = evaluateThresholdTriggerSummary({
      action: { damageGate: evaluateThresholdDamageGate({ formula: "1d6 * 2", rolledTotal: 12 }) },
      appliedDamage: 12,
      targetMaxHp: 20,
    });

    expect(summary).to.include({ qualifies: true, autoInjury: false, reason: null });
    expect(summary.triggers).to.deep.equal(["greater-than-half-max-hp"]);
    expect(summary.damageGate).to.include({
      supported: false,
      qualifies: false,
      reason: "unsupported-threshold-damage-range",
    });
  });

  it("reports unsupported formula and no half max HP trigger as no trigger", () => {
    const summary = evaluateThresholdTriggerSummary({
      action: { damageGate: evaluateThresholdDamageGate({ formula: "1d6 * 2", rolledTotal: 6 }) },
      appliedDamage: 6,
      targetMaxHp: 20,
    });

    expect(summary).to.include({ qualifies: false, autoInjury: false, reason: "no-threshold-trigger" });
    expect(summary.triggers).to.deep.equal([]);
    expect(summary.damageGate).to.include({ supported: false, reason: "unsupported-threshold-damage-range" });
  });

  it("marks natural 20 trigger summaries as automatic threshold injuries", () => {
    const summary = evaluateThresholdTriggerSummary({
      naturalD20: 20,
      action: { natural20Critical: true, damageGate: evaluateThresholdDamageGate({ formula: "2d6", rolledTotal: 10 }) },
      appliedDamage: 20,
      targetMaxHp: 20,
    });

    expect(summary).to.include({ qualifies: true, autoInjury: true, reason: null });
    expect(summary.triggers).to.deep.equal([
      "natural20",
      "upper-half-damage-roll",
      "greater-than-half-max-hp",
    ]);
  });

  it("builds distinct trusted action metadata for natural 20 critical damage", () => {
    const damageGate = evaluateThresholdDamageGate({ formula: "1d8", rolledTotal: 8 });
    const actions = buildThresholdAttackActions({
      normalDamage: 8,
      straightDamage: 3,
      damageGate,
      naturalD20: 20,
    });

    expect(actions.natural20CriticalDamage).to.include({
      domAction: "apply-damage",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: 8,
      multiplier: 2,
      natural20Critical: true,
    });
    expect(actions.normalDamageDouble).to.include({ amount: 8, multiplier: 2 });
    expect(actions.normalDamageDouble.natural20Critical).to.equal(undefined);
    expect(actions.straightNatural20CriticalDamage).to.include({
      amount: 3,
      multiplier: 2,
      natural20Critical: true,
    });
  });

  it("omits natural 20 critical action metadata for non-critical attacks", () => {
    const actions = buildThresholdAttackActions({
      normalDamage: 8,
      damageGate: evaluateThresholdDamageGate({ formula: "1d8", rolledTotal: 8 }),
      naturalD20: 19,
    });

    expect(actions.natural20CriticalDamage).to.equal(undefined);
  });

  it("computes health, injury, and capped total pressure", () => {
    expect(computeHealthPressure({ hpValue: 6, hpMax: 10 })).to.equal(0);
    expect(computeHealthPressure({ hpValue: 5, hpMax: 10 })).to.equal(1);
    expect(computeHealthPressure({ hpValue: 0, hpMax: 10 })).to.equal(0);
    expect(computeExistingInjuryPressure(3)).to.equal(2);
    expect(computeTotalPressure({ weaponPressure: 1, healthPressure: 1, injuryPressure: 2 })).to.equal(4);
    expect(computeTotalPressure({ weaponPressure: 1, healthPressure: 1, injuryPressure: 5 })).to.equal(4);
  });

  it("maps severity scores to persistent bands", () => {
    expect(computeSeverityBand(2)).to.deep.equal({ band: "Minor", persistent: false });
    expect(computeSeverityBand(4)).to.deep.equal({ band: "Moderate", persistent: true });
    expect(computeSeverityBand(6)).to.deep.equal({ band: "Serious", persistent: true });
    expect(computeSeverityBand(8)).to.deep.equal({ band: "Severe", persistent: true });
  });

  it("treats only positive normal attack damage as threshold eligible", () => {
    expect(isPositiveNormalAttackDamage({
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: 6,
      multiplier: 0.5,
    })).to.equal(true);
    expect(isPositiveNormalAttackDamage({
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: 6,
      multiplier: -1,
    })).to.equal(false);
    expect(isPositiveNormalAttackDamage({
      actionFamily: "shock",
      damageKind: "shock",
      amount: 6,
      multiplier: 1,
    })).to.equal(false);
  });

  it("builds stable idempotency keys", () => {
    expect(buildThresholdAttemptKey({
      messageUuid: "ChatMessage.abc",
      targetUuid: "Actor.def",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
    })).to.equal("ChatMessage.abc|Actor.def|normal-attack-damage");
  });

  it("validates trusted attack contexts", () => {
    const context = {
      schemaVersion: THRESHOLD_CONTEXT_SCHEMA_VERSION,
      createdBy: "wwn.sendAttackRoll",
      attackTotal: 17,
      naturalD20: 14,
      sourceActorId: "actor-1",
      sourceItemId: "item-1",
      sourceItemSnapshot: { id: "item-1", name: "Sword", type: "weapon" },
      baseWeaponDamageFormula: "1d8",
      actions: {
        normalDamage: { actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE },
      },
    };
    expect(isValidAttackContext(context)).to.equal(true);
    expect(isValidAttackContext({ ...context, createdBy: "user" })).to.equal(false);
    expect(isValidAttackContext({ ...context, actions: {} })).to.equal(false);
  });

  it("validates trusted button action metadata against clicked action, amount, and multiplier", () => {
    const attackContext = {
      actions: {
        normalDamage: {
          domAction: "apply-damage",
          actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
          damageKind: "normal",
          amount: 8,
          multiplier: 1,
        },
      },
    };

    expect(resolveTrustedThresholdAction({
      attackContext,
      actionId: "normalDamage",
      domAction: "apply-damage",
      amount: 8,
      multiplier: 1,
    }).action).to.equal(attackContext.actions.normalDamage);
    expect(resolveTrustedThresholdAction({
      attackContext,
      actionId: "normalDamage",
      domAction: "apply-shock",
      amount: 8,
      multiplier: 1,
    }).reason).to.equal("threshold-action-dom-mismatch");
    expect(resolveTrustedThresholdAction({
      attackContext,
      actionId: "normalDamage",
      domAction: "apply-damage",
      amount: 4,
      multiplier: 1,
    }).reason).to.equal("threshold-action-amount-mismatch");
  });

  it("validates dedicated natural 20 critical action metadata", () => {
    const attackContext = {
      actions: buildThresholdAttackActions({
        normalDamage: 8,
        damageGate: evaluateThresholdDamageGate({ formula: "1d8", rolledTotal: 8 }),
        naturalD20: 20,
      }),
    };

    const trusted = resolveTrustedThresholdAction({
      attackContext,
      actionId: "natural20CriticalDamage",
      domAction: "apply-damage",
      amount: 8,
      multiplier: 2,
    });

    expect(trusted.action).to.include({
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      natural20Critical: true,
      multiplier: 2,
    });
    expect(resolveTrustedThresholdAction({
      attackContext,
      actionId: "natural20CriticalDamage",
      domAction: "apply-damage",
      amount: 8,
      multiplier: 1,
    }).reason).to.equal("threshold-action-multiplier-mismatch");
  });
});
