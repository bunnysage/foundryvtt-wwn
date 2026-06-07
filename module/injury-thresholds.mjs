export const THRESHOLD_CONTEXT_FLAG = "thresholdAttack";
export const THRESHOLD_CONTEXT_SCHEMA_VERSION = 1;
export const THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE = "normal-attack-damage";

export function normalizeInjuryResistance(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.floor(number);
}

export function getActorInjuryResistance(actor) {
  return normalizeInjuryResistance(actor?.system?.injuryResistance);
}

export function getTargetAac(actor) {
  const value = Number(actor?.system?.aac?.value);
  return Number.isFinite(value) ? value : null;
}

export function computeEdge({ attackTotal, targetAac, naturalD20 } = {}) {
  if (Number(naturalD20) === 20) {
    return { eligible: true, edge: 3, source: "natural20", margin: null };
  }

  const attack = Number(attackTotal);
  const aac = Number(targetAac);
  if (!Number.isFinite(attack) || !Number.isFinite(aac)) {
    return { eligible: true, edge: 0, source: "unknown", margin: null };
  }

  const margin = attack - aac;
  if (margin < 0) {
    return { eligible: false, edge: 0, source: "miss", margin, reason: "attack-margin-below-aac" };
  }
  if (margin >= 10) return { eligible: true, edge: 2, source: "margin10", margin };
  if (margin >= 5) return { eligible: true, edge: 1, source: "margin5", margin };
  return { eligible: true, edge: 0, source: "hit", margin };
}

export function computeInjuryTargetNumber({ base = 9, injuryResistance = 0, edge = 0 } = {}) {
  return Number(base || 0) + normalizeInjuryResistance(injuryResistance) - Number(edge || 0);
}

export function evaluateInjuryDie({ dieResult, targetNumber } = {}) {
  const die = Number(dieResult);
  const target = Number(targetNumber);
  if (!Number.isFinite(die) || !Number.isFinite(target)) return false;
  return target <= 10 && die >= target;
}

export function isPositiveNormalAttackDamage(context = {}) {
  return context?.actionFamily === THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE
    && context?.damageKind === "normal"
    && Number(context?.amount) > 0
    && Number(context?.multiplier) > 0;
}

export function resolveTrustedThresholdAction({ attackContext, actionId, domAction, amount, multiplier } = {}) {
  const action = attackContext?.actions?.[actionId];
  if (!action) return { action: null, reason: "unknown-threshold-action" };
  if (action.domAction && action.domAction !== domAction) {
    return { action: null, reason: "threshold-action-dom-mismatch" };
  }
  if (action.amount !== undefined && Number(action.amount) !== Number(amount)) {
    return { action: null, reason: "threshold-action-amount-mismatch" };
  }
  if (action.multiplier !== undefined && Number(action.multiplier) !== Number(multiplier)) {
    return { action: null, reason: "threshold-action-multiplier-mismatch" };
  }
  return { action, reason: null };
}

export function computeDamageRange(formula) {
  if (typeof formula !== "string" || formula.trim() === "") return null;
  const normalized = formula.replace(/\s+/g, "").toLowerCase().replace(/\+\-/g, "-").replace(/\+\+/g, "+");
  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];
  if (!terms.length || terms.join("") !== normalized) return null;

  let minDamage = 0;
  let maxDamage = 0;

  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const diceMatch = body.match(/^(\d*)d(\d+)$/);
    if (diceMatch) {
      const count = diceMatch[1] === "" ? 1 : Number(diceMatch[1]);
      const faces = Number(diceMatch[2]);
      if (!Number.isInteger(count) || !Number.isInteger(faces) || count <= 0 || faces <= 0) return null;
      minDamage += sign > 0 ? count : -count * faces;
      maxDamage += sign > 0 ? count * faces : -count;
      continue;
    }
    const number = Number(body);
    if (!Number.isFinite(number)) return null;
    minDamage += sign * number;
    maxDamage += sign * number;
  }

  if (minDamage > maxDamage) return null;
  return {
    minDamage,
    maxDamage,
    upperHalfCutoff: computeUpperHalfCutoff({ minDamage, maxDamage }),
  };
}

export function computeUpperHalfCutoff({ minDamage, maxDamage } = {}) {
  const min = Number(minDamage);
  const max = Number(maxDamage);
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null;
  return Math.ceil((min + max) / 2);
}

export function evaluateThresholdDamageGate({ formula, rolledTotal, range } = {}) {
  const damageRange = range ?? computeDamageRange(formula);
  if (!damageRange) {
    return {
      qualifies: false,
      supported: false,
      reason: "unsupported-threshold-damage-range",
      formula: typeof formula === "string" ? formula : "",
      rolledTotal: Number.isFinite(Number(rolledTotal)) ? Number(rolledTotal) : null,
    };
  }

  const total = Number(rolledTotal);
  if (!Number.isFinite(total)) {
    return {
      qualifies: false,
      supported: false,
      reason: "unsupported-threshold-damage-range",
      formula: typeof formula === "string" ? formula : "",
      rolledTotal: null,
      ...damageRange,
    };
  }

  const qualifies = total >= damageRange.upperHalfCutoff;
  return {
    qualifies,
    supported: true,
    reason: qualifies ? null : "lower-half-threshold-damage-roll",
    formula: typeof formula === "string" ? formula : "",
    rolledTotal: total,
    ...damageRange,
  };
}

export function evaluateTrustedThresholdDamageGate(metadata = {}) {
  if (!metadata || metadata.supported !== true) {
    return {
      qualifies: false,
      supported: false,
      reason: "unsupported-threshold-damage-range",
      formula: typeof metadata?.formula === "string" ? metadata.formula : "",
      rolledTotal: Number.isFinite(Number(metadata?.rolledTotal)) ? Number(metadata.rolledTotal) : null,
      minDamage: Number.isFinite(Number(metadata?.minDamage)) ? Number(metadata.minDamage) : null,
      maxDamage: Number.isFinite(Number(metadata?.maxDamage)) ? Number(metadata.maxDamage) : null,
      upperHalfCutoff: Number.isFinite(Number(metadata?.upperHalfCutoff)) ? Number(metadata.upperHalfCutoff) : null,
    };
  }

  const minDamage = Number(metadata.minDamage);
  const maxDamage = Number(metadata.maxDamage);
  const upperHalfCutoff = Number(metadata.upperHalfCutoff);
  if (!Number.isFinite(minDamage) || !Number.isFinite(maxDamage) || !Number.isFinite(upperHalfCutoff)) {
    return {
      qualifies: false,
      supported: false,
      reason: "unsupported-threshold-damage-range",
      formula: typeof metadata.formula === "string" ? metadata.formula : "",
      rolledTotal: Number.isFinite(Number(metadata.rolledTotal)) ? Number(metadata.rolledTotal) : null,
      minDamage: Number.isFinite(minDamage) ? minDamage : null,
      maxDamage: Number.isFinite(maxDamage) ? maxDamage : null,
      upperHalfCutoff: Number.isFinite(upperHalfCutoff) ? upperHalfCutoff : null,
    };
  }

  return evaluateThresholdDamageGate({
    formula: metadata.formula,
    rolledTotal: metadata.rolledTotal,
    range: { minDamage, maxDamage, upperHalfCutoff },
  });
}

export function evaluateHalfMaxHpTrigger({ appliedDamage, targetMaxHp } = {}) {
  const damage = Number(appliedDamage);
  const maxHp = Number(targetMaxHp);
  if (!Number.isFinite(damage) || !Number.isFinite(maxHp) || maxHp <= 0) {
    return {
      qualifies: false,
      appliedDamage: Number.isFinite(damage) ? damage : null,
      targetMaxHp: Number.isFinite(maxHp) ? maxHp : null,
      cutoff: Number.isFinite(maxHp) && maxHp > 0 ? maxHp / 2 : null,
    };
  }
  const cutoff = maxHp / 2;
  return {
    qualifies: damage > cutoff,
    appliedDamage: damage,
    targetMaxHp: maxHp,
    cutoff,
  };
}

export function evaluateThresholdTriggerSummary({
  naturalD20,
  action,
  appliedDamage,
  targetMaxHp,
} = {}) {
  const damageGate = evaluateTrustedThresholdDamageGate(action?.damageGate);
  const halfMaxHp = evaluateHalfMaxHpTrigger({ appliedDamage, targetMaxHp });
  const triggers = [];

  const isNatural20Critical = Number(naturalD20) === 20 && action?.natural20Critical === true;
  if (isNatural20Critical) triggers.push("natural20");
  if (damageGate.qualifies) triggers.push("upper-half-damage-roll");
  if (halfMaxHp.qualifies) triggers.push("greater-than-half-max-hp");

  return {
    qualifies: triggers.length > 0,
    autoInjury: isNatural20Critical,
    reason: triggers.length ? null : "no-threshold-trigger",
    triggers,
    damageGate,
    halfMaxHp,
  };
}

export function buildThresholdAttackActions({
  normalDamage,
  straightDamage,
  damageGate,
  naturalD20,
} = {}) {
  const actions = {
    normalDamage: {
      domAction: "apply-damage",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: normalDamage,
      multiplier: 1,
      damageGate,
    },
    normalDamageHalf: {
      domAction: "apply-damage",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: normalDamage,
      multiplier: 0.5,
      damageGate,
    },
    normalDamageDouble: {
      domAction: "apply-damage",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: normalDamage,
      multiplier: 2,
      damageGate,
    },
    straightDamage: {
      domAction: "apply-damage",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: straightDamage,
      multiplier: 1,
      damageGate,
    },
    shock: {
      domAction: "apply-shock",
      actionFamily: "shock",
      damageKind: "shock",
      amount: null,
      multiplier: 1,
      thresholdEligible: false,
    },
    trauma: {
      domAction: "apply-damage",
      actionFamily: "trauma",
      damageKind: "trauma",
      amount: null,
      multiplier: 1,
      thresholdEligible: false,
    },
    traumaHalf: {
      domAction: "apply-damage",
      actionFamily: "trauma",
      damageKind: "trauma",
      amount: null,
      multiplier: 0.5,
      thresholdEligible: false,
    },
    traumaDouble: {
      domAction: "apply-damage",
      actionFamily: "trauma",
      damageKind: "trauma",
      amount: null,
      multiplier: 2,
      thresholdEligible: false,
    },
    healing: {
      domAction: "apply-damage",
      actionFamily: "healing",
      damageKind: "healing",
      amount: normalDamage,
      multiplier: -1,
      thresholdEligible: false,
    },
    healingHalf: {
      domAction: "apply-damage",
      actionFamily: "healing",
      damageKind: "healing",
      amount: normalDamage,
      multiplier: -0.5,
      thresholdEligible: false,
    },
    healingDouble: {
      domAction: "apply-damage",
      actionFamily: "healing",
      damageKind: "healing",
      amount: normalDamage,
      multiplier: -2,
      thresholdEligible: false,
    },
  };

  if (Number(naturalD20) === 20) {
    actions.natural20CriticalDamage = {
      domAction: "apply-damage",
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      damageKind: "normal",
      amount: normalDamage,
      multiplier: 2,
      damageGate,
      natural20Critical: true,
    };
    if (straightDamage !== undefined && straightDamage !== null) {
      actions.straightNatural20CriticalDamage = {
        domAction: "apply-damage",
        actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
        damageKind: "normal",
        amount: straightDamage,
        multiplier: 2,
        damageGate,
        natural20Critical: true,
      };
    }
  }

  return actions;
}

export function maxWeaponDamage(formula) {
  return computeDamageRange(formula)?.maxDamage ?? null;
}

export function computeWeaponPressure(formula) {
  const maximum = maxWeaponDamage(formula);
  if (maximum === null) return 0;
  if (maximum <= 6) return -1;
  if (maximum >= 10) return 1;
  return 0;
}

export function computeHealthPressure({ hpValue, hpMax } = {}) {
  const value = Number(hpValue);
  const max = Number(hpMax);
  if (!Number.isFinite(value) || !Number.isFinite(max) || max <= 0) return 0;
  return value > 0 && value <= max / 2 ? 1 : 0;
}

export function computeExistingInjuryPressure(injuries) {
  const count = Math.max(0, Math.floor(Number(injuries) || 0));
  return Math.min(2, count);
}

export function computeTotalPressure({ weaponPressure = 0, healthPressure = 0, injuryPressure = 0 } = {}) {
  return Math.min(4, Number(weaponPressure || 0) + Number(healthPressure || 0) + Number(injuryPressure || 0));
}

export function computeSeverityBand(score) {
  const value = Number(score);
  if (value <= 3) return { band: "Minor", persistent: false };
  if (value <= 5) return { band: "Moderate", persistent: true };
  if (value <= 7) return { band: "Serious", persistent: true };
  return { band: "Severe", persistent: true };
}

export function buildThresholdAttemptKey({ messageUuid, targetUuid, actionFamily } = {}) {
  return [messageUuid, targetUuid, actionFamily].filter(Boolean).join("|");
}

export function isValidAttackContext(context = {}) {
  return context?.schemaVersion === THRESHOLD_CONTEXT_SCHEMA_VERSION
    && context?.createdBy === "wwn.sendAttackRoll"
    && Number.isFinite(Number(context?.attackTotal))
    && Number.isFinite(Number(context?.naturalD20))
    && !!context?.sourceActorId
    && !!context?.sourceItemId
    && (!!context?.sourceItemSnapshot || typeof context?.sourceItemName === "string")
    && typeof context?.baseWeaponDamageFormula === "string"
    && context?.actions?.normalDamage?.actionFamily === THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE;
}
