#!/usr/bin/env node

import {
  computeEdge,
  computeInjuryTargetNumber,
  evaluateInjuryDie,
} from "../../module/injury-thresholds.mjs";

const defaults = {
  attackBonus: 5,
  acMin: 10,
  acMax: 25,
  irValues: [0, 1, 2, 3],
  ctSaveTarget: 13,
  natural20AutoHit: false,
  damageFormula: "1d8",
  damageGate: "upper-half",
};

const options = parseArgs(process.argv.slice(2));

function parseArgs(args) {
  const parsed = { ...defaults };

  for (const arg of args) {
    const [key, rawValue] = arg.replace(/^--/, "").split("=");
    const value = rawValue ?? "";

    switch (key) {
      case "attack-bonus":
        parsed.attackBonus = Number(value);
        break;
      case "ac-min":
        parsed.acMin = Number(value);
        break;
      case "ac-max":
        parsed.acMax = Number(value);
        break;
      case "ir":
        parsed.irValues = value.split(",").map(Number).filter(Number.isFinite);
        break;
      case "ct-save-target":
        parsed.ctSaveTarget = Number(value);
        break;
      case "damage-formula":
        parsed.damageFormula = value;
        break;
      case "damage-gate":
        parsed.damageGate = value;
        break;
      case "nat20-auto-hit":
        parsed.natural20AutoHit = true;
        break;
      case "help":
        printHelpAndExit();
        break;
      default:
        throw new Error(`Unknown option: --${key}`);
    }
  }

  for (const [key, value] of Object.entries(parsed)) {
    if (Array.isArray(value)) continue;
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error(`Invalid numeric option: ${key}`);
    }
  }

  return parsed;
}

function printHelpAndExit() {
  console.log(`Usage: node docs/plans/injury-ac-comparison.mjs [options]

Options:
  --attack-bonus=N       Attack bonus used for d20 + bonus vs ascending AC. Default: ${defaults.attackBonus}
  --ac-min=N             First AC to print. Default: ${defaults.acMin}
  --ac-max=N             Last AC to print. Default: ${defaults.acMax}
  --ir=0,1,2,3           Injury Resistance values to compare. Default: ${defaults.irValues.join(",")}
  --ct-save-target=N     C&T save vs death succeeds on d20 >= N. Default: ${defaults.ctSaveTarget}
  --damage-formula=FORM  Damage formula for WWN upper-half gate. Default: ${defaults.damageFormula}
  --damage-gate=MODE     WWN damage eligibility: upper-half, max-half, or none. Default: ${defaults.damageGate}
  --nat20-auto-hit       Count natural 20 as an automatic WWN hit for experiments.

Models:
  WWN/repo: injury check happens after eligible attack damage. Per-attack injury chance
            enumerates d20 hit outcomes. Natural 20 critical damage is automatic;
            other eligible damage applies the damage gate, computes Edge, then
            rolls 1d10 against 9 + IR - Edge.
  C&T:      critical threat requires natural 18+ and hitting AC by 5+. System II
            specific injury then requires failed save vs death.
`);
  process.exit(0);
}

function pct(value) {
  return `${(value * 100).toFixed(1)}%`;
}

function markdownRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function d10Chance(targetNumber) {
  let successes = 0;
  for (let die = 1; die <= 10; die += 1) {
    if (evaluateInjuryDie({ dieResult: die, targetNumber })) successes += 1;
  }
  return successes / 10;
}

function convolve(left, right) {
  const result = new Map();
  for (const [leftTotal, leftCount] of left.entries()) {
    for (const [rightTotal, rightCount] of right.entries()) {
      result.set(leftTotal + rightTotal, (result.get(leftTotal + rightTotal) ?? 0) + leftCount * rightCount);
    }
  }
  return result;
}

function parseDamageFormula(formula) {
  if (typeof formula !== "string" || formula.trim() === "") {
    throw new Error("Damage formula must be a non-empty additive formula, e.g. 1d8 or 1d8+2");
  }

  const normalized = formula.replace(/\s+/g, "").toLowerCase();
  const terms = normalized.match(/[+-]?[^+-]+/g) ?? [];
  let distribution = new Map([[0, 1]]);

  for (const term of terms) {
    const sign = term.startsWith("-") ? -1 : 1;
    const body = term.replace(/^[+-]/, "");
    const dice = body.match(/^(\d*)d(\d+)$/);

    if (dice) {
      const count = dice[1] === "" ? 1 : Number(dice[1]);
      const sides = Number(dice[2]);
      if (!Number.isInteger(count) || count < 0 || !Number.isInteger(sides) || sides < 1) {
        throw new Error(`Unsupported dice term: ${term}`);
      }
      for (let i = 0; i < count; i += 1) {
        const die = new Map();
        for (let face = 1; face <= sides; face += 1) die.set(sign * face, 1);
        distribution = convolve(distribution, die);
      }
      continue;
    }

    const number = Number(body);
    if (Number.isFinite(number)) {
      distribution = convolve(distribution, new Map([[sign * number, 1]]));
      continue;
    }

    throw new Error(`Unsupported damage formula term: ${term}`);
  }

  const totals = [...distribution.keys()];
  const min = Math.min(...totals);
  const max = Math.max(...totals);
  const outcomeCount = [...distribution.values()].reduce((sum, count) => sum + count, 0);
  const upperHalfCutoff = Math.ceil((min + max) / 2);
  const upperHalfCount = [...distribution.entries()]
    .filter(([total]) => total >= upperHalfCutoff)
    .reduce((sum, [, count]) => sum + count, 0);

  return {
    distribution,
    min,
    max,
  outcomeCount,
  upperHalfCutoff,
  upperHalfChance: upperHalfCount / outcomeCount,
  maxHalfCutoff: Math.ceil(max / 2),
  maxHalfChance: [...distribution.entries()]
    .filter(([total]) => total >= Math.ceil(max / 2))
    .reduce((sum, [, count]) => sum + count, 0) / outcomeCount,
  };
}

const damage = parseDamageFormula(options.damageFormula);

function damageGateChance() {
  switch (options.damageGate) {
    case "none":
      return 1;
    case "upper-half":
      return damage.upperHalfChance;
    case "max-half":
      return damage.maxHalfChance;
    default:
      throw new Error(`Unsupported --damage-gate=${options.damageGate}. Use upper-half, max-half, or none.`);
  }
}

function isHit({ naturalD20, attackTotal, ac }) {
  if (options.natural20AutoHit && naturalD20 === 20) return true;
  return attackTotal >= ac;
}

function wwnStatsForAc(ac, injuryResistance) {
  let hit = 0;
  let injuryAfterHitAndDamage = 0;
  const edgeCounts = { 0: 0, 1: 0, 2: 0, 3: 0 };
  const gateChance = damageGateChance();

  for (let naturalD20 = 1; naturalD20 <= 20; naturalD20 += 1) {
    const attackTotal = naturalD20 + options.attackBonus;
    if (!isHit({ naturalD20, attackTotal, ac })) continue;

    hit += 1;
    const edge = computeEdge({ attackTotal, targetAac: ac, naturalD20 });
    const edgeValue = edge.eligible ? edge.edge : 0;
    edgeCounts[edgeValue] += 1;

    if (naturalD20 === 20) {
      injuryAfterHitAndDamage += 1;
      continue;
    }

    const targetNumber = computeInjuryTargetNumber({ injuryResistance, edge: edgeValue });
    injuryAfterHitAndDamage += gateChance * d10Chance(targetNumber);
  }

  return {
    hitChance: hit / 20,
    damageGateChance: gateChance,
    injuryChance: injuryAfterHitAndDamage / 20,
    injuryPerHit: hit > 0 ? injuryAfterHitAndDamage / hit : 0,
    injuryPerEligibleDamage: hit > 0 && gateChance > 0 ? injuryAfterHitAndDamage / (hit * gateChance) : 0,
    edgeDistribution: Object.fromEntries(
      Object.entries(edgeCounts).map(([edge, count]) => [edge, count / 20])
    ),
  };
}

function ctStatsForAc(ac) {
  let threat = 0;

  for (let naturalD20 = 1; naturalD20 <= 20; naturalD20 += 1) {
    const attackTotal = naturalD20 + options.attackBonus;
    if (naturalD20 >= 18 && attackTotal >= ac + 5) threat += 1;
  }

  const threatChance = threat / 20;
  const saveFailChance = Math.max(0, Math.min(1, (options.ctSaveTarget - 1) / 20));

  return {
    threatChance,
    injuryChance: threatChance * saveFailChance,
    saveFailChance,
  };
}

function printSummary() {
  console.log("# Injury Probability by AC");
  console.log();
  console.log(`Attack model: d20 + ${options.attackBonus} vs ascending AC ${options.acMin}-${options.acMax}.`);
  console.log(`WWN natural 20 auto-hit: ${options.natural20AutoHit ? "yes" : "no"}.`);
  const damageGateText = options.damageGate === "none"
    ? "none"
    : options.damageGate === "max-half"
      ? `${options.damageFormula} >= ${damage.maxHalfCutoff} (ceil(max/2), range ${damage.min}-${damage.max}, ${pct(damageGateChance())})`
      : `${options.damageFormula} >= ${damage.upperHalfCutoff} (ceil((min+max)/2), range ${damage.min}-${damage.max}, ${pct(damageGateChance())})`;
  console.log(`WWN damage gate: ${damageGateText}.`);
  console.log(`C&T save vs death target: ${options.ctSaveTarget}+ (${pct(ctStatsForAc(options.acMin).saveFailChance)} fail chance).`);
  console.log();
  console.log("C&T threat means natural 18+ and hit by 5+. C&T injury means threat plus failed save vs death.");
  console.log();
}

function printMainTable() {
  const headers = [
    "AC",
    "Hit",
    "Edge 0",
    "Edge 1",
    "Edge 2",
    "Edge 3",
    "Dmg gate",
    ...options.irValues.map((ir) => `WWN IR ${ir}`),
    "C&T threat",
    "C&T injury",
  ];

  console.log(markdownRow(headers));
  console.log(markdownRow(headers.map((header, index) => index === 0 ? "---:" : "---:")));

  for (let ac = options.acMin; ac <= options.acMax; ac += 1) {
    const base = wwnStatsForAc(ac, options.irValues[0] ?? 0);
    const ct = ctStatsForAc(ac);
    const row = [
      ac,
      pct(base.hitChance),
      pct(base.edgeDistribution[0]),
      pct(base.edgeDistribution[1]),
      pct(base.edgeDistribution[2]),
      pct(base.edgeDistribution[3]),
      pct(base.damageGateChance),
      ...options.irValues.map((ir) => pct(wwnStatsForAc(ac, ir).injuryChance)),
      pct(ct.threatChance),
      pct(ct.injuryChance),
    ];
    console.log(markdownRow(row));
  }
  console.log();
}

function printConditionalTable() {
  const headers = [
    "AC",
    ...options.irValues.map((ir) => `WWN IR ${ir} / hit`),
  ];

  console.log("## Conditional WWN Injury Chance Per Hit");
  console.log();
  console.log("This answers: once a hit has already happened, how often does the damage gate plus threshold injury check trigger?");
  console.log();
  console.log(markdownRow(headers));
  console.log(markdownRow(headers.map((header, index) => index === 0 ? "---:" : "---:")));

  for (let ac = options.acMin; ac <= options.acMax; ac += 1) {
    console.log(markdownRow([
      ac,
      ...options.irValues.map((ir) => pct(wwnStatsForAc(ac, ir).injuryPerHit)),
    ]));
  }
}

printSummary();
printMainTable();
printConditionalTable();
