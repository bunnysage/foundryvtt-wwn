import { describe, it } from "mocha";
import { expect } from "chai";
import {
  THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
  THRESHOLD_CONTEXT_SCHEMA_VERSION,
  buildThresholdAttemptKey,
  computeEdge,
  computeExistingInjuryPressure,
  computeHealthPressure,
  computeInjuryTargetNumber,
  computeSeverityBand,
  computeTotalPressure,
  computeWeaponPressure,
  evaluateInjuryDie,
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
    expect(computeInjuryTargetNumber({ injuryResistance: 0, edge: 0 })).to.equal(8);
    expect(computeInjuryTargetNumber({ injuryResistance: 1, edge: 1 })).to.equal(8);
    expect(computeInjuryTargetNumber({ injuryResistance: 2, edge: 2 })).to.equal(8);
    expect(computeInjuryTargetNumber({ injuryResistance: 3, edge: 0 })).to.equal(11);
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

  it("uses natural 20 edge 3 without automatic injury", () => {
    const edge = computeEdge({ attackTotal: 15, targetAac: 16, naturalD20: 20 });
    const targetNumber = computeInjuryTargetNumber({ injuryResistance: 3, edge: edge.edge });
    expect(targetNumber).to.equal(8);
    expect(evaluateInjuryDie({ dieResult: 7, targetNumber })).to.equal(false);
    expect(evaluateInjuryDie({ dieResult: 8, targetNumber })).to.equal(true);
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
});
