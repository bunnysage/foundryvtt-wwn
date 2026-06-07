#!/usr/bin/env node

const dice = [4, 6, 8, 10, 12];
const injuryResistances = [0, 1, 2, 3];
const edgeStates = [
  { label: "No Edge", edge: 0 },
  { label: "Hit by 5 Edge", edge: 1 },
  { label: "Hit by 10 Edge", edge: 2 },
  { label: "Natural 20 Edge", edge: 3, autoInjury: true },
];

const severityBands = [
  { label: "Minor", min: -Infinity, max: 3 },
  { label: "Moderate", min: 4, max: 5 },
  { label: "Serious", min: 6, max: 7 },
  { label: "Severe", min: 8, max: Infinity },
];

const healthPressures = [
  { label: "Above half HP", pressure: 0 },
  { label: "Half HP or below", pressure: 1 },
  { label: "At/below 0 HP", pressure: 2 },
];

const existingInjuryPressures = [0, 1, 2];

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pct(value) {
  return `${Math.round(value * 100)}%`;
}

function injuryNumber(injuryResistance, edge) {
  return 9 + injuryResistance - edge;
}

function injuryDieChance(threshold) {
  return clamp(10 - threshold + 1, 0, 10) / 10;
}

function weaponPressure(sides) {
  if (sides <= 6) return -1;
  if (sides === 8) return 0;
  return 1;
}

function totalPressure(sides, healthPressure = 0, existingInjuries = 0) {
  return clamp(weaponPressure(sides) + healthPressure + Math.min(existingInjuries, 2), -1, 4);
}

function severityDistribution(pressure) {
  const counts = Object.fromEntries(severityBands.map((band) => [band.label, 0]));

  for (let roll = 1; roll <= 6; roll += 1) {
    const score = roll + pressure;
    const band = severityBands.find(({ min, max }) => score >= min && score <= max);
    counts[band.label] += 1;
  }

  return Object.fromEntries(Object.entries(counts).map(([label, count]) => [label, count / 6]));
}

function markdownRow(cells) {
  return `| ${cells.join(" | ")} |`;
}

function printTriggerTables() {
  console.log("## Trigger Probability by Injury Resistance");
  console.log();
  console.log("Ordinary threshold chance is `1d10 >= 9 + injuryResistance - Edge` after a non-natural-20 trigger qualifies. Natural 20 critical damage is automatic.");
  console.log();

  for (const ir of injuryResistances) {
    console.log(`### injuryResistance ${ir}`);
    console.log();
    console.log(markdownRow(["Chance Step", ...edgeStates.map(({ label, edge, autoInjury }) => autoInjury ? label : `${label} (${injuryNumber(ir, edge)}+)`)]));
    console.log(markdownRow(["---", "---:", "---:", "---:", "---:"]));

    const row = ["1d10"];
    for (const { edge, autoInjury } of edgeStates) {
      if (autoInjury) {
        row.push("100%");
      } else {
        row.push(pct(injuryDieChance(injuryNumber(ir, edge))));
      }
    }
    console.log(markdownRow(row));
    console.log();
  }
}

function printSeverityPressureTables() {
  console.log("## Conditional Severity Distribution");
  console.log();
  console.log("Severity is rolled only after a threshold trigger: `1d6 + totalPressure`.");
  console.log();
  console.log("Pressure factors:");
  console.log();
  console.log(markdownRow(["Factor", "Pressure"]));
  console.log(markdownRow(["---", "---:"]));
  console.log(markdownRow(["d4/d6 weapon die", "-1"]));
  console.log(markdownRow(["d8 weapon die", "+0"]));
  console.log(markdownRow(["d10/d12 weapon die", "+1"]));
  console.log(markdownRow(["Above half HP", "+0"]));
  console.log(markdownRow(["Half HP or below", "+1"]));
  console.log(markdownRow(["At/below 0 HP", "+2"]));
  console.log(markdownRow(["Existing injuries", "+1 each, capped at +2"]));
  console.log();
  console.log(markdownRow(["Total pressure", "Minor", "Moderate", "Serious", "Severe"]));
  console.log(markdownRow(["---:", "---:", "---:", "---:", "---:"]));

  for (const pressure of [-1, 0, 1, 2, 3, 4]) {
    const dist = severityDistribution(pressure);
    console.log(markdownRow([formatSigned(pressure), pct(dist.Minor), pct(dist.Moderate), pct(dist.Serious), pct(dist.Severe)]));
  }
  console.log();
}

function printCombinedTables() {
  console.log("## Combined Per-Eligible-Damage Odds");
  console.log();
  console.log("These tables multiply trigger chance by conditional severity distribution. They assume `injuryResistance 0`, no existing injuries, and vary Edge plus health pressure.");
  console.log();

  for (const health of healthPressures.slice(0, 2)) {
    for (const edgeState of edgeStates) {
      console.log(`### ${health.label}, ${edgeState.label}`);
      console.log();
      console.log(markdownRow(["Die", "Trigger", "Minor", "Moderate", "Serious", "Severe"]));
      console.log(markdownRow(["---", "---:", "---:", "---:", "---:", "---:"]));

      for (const sides of dice) {
        const trigger = edgeState.autoInjury ? 1 : injuryDieChance(injuryNumber(0, edgeState.edge));
        const pressure = totalPressure(sides, health.pressure, 0);
        const dist = severityDistribution(pressure);
        console.log(markdownRow([
          formatDie(sides),
          pct(trigger),
          pct(trigger * dist.Minor),
          pct(trigger * dist.Moderate),
          pct(trigger * dist.Serious),
          pct(trigger * dist.Severe),
        ]));
      }
      console.log();
    }
  }
}

function printPressureGrid() {
  console.log("## Total Pressure by Weapon, Health, and Existing Injuries");
  console.log();

  for (const health of healthPressures.slice(0, 2)) {
    console.log(`### ${health.label}`);
    console.log();
    console.log(markdownRow(["Die", "0 injuries", "1 injury", "2+ injuries"]));
    console.log(markdownRow(["---", "---:", "---:", "---:"]));

    for (const sides of dice) {
      console.log(markdownRow([
        formatDie(sides),
        formatSigned(totalPressure(sides, health.pressure, 0)),
        formatSigned(totalPressure(sides, health.pressure, 1)),
        formatSigned(totalPressure(sides, health.pressure, 2)),
      ]));
    }
    console.log();
  }
}

function formatDie(sides) {
  return `d${sides}`;
}

function formatSigned(value) {
  return value > 0 ? `+${value}` : String(value);
}

printTriggerTables();
printSeverityPressureTables();
printPressureGrid();
printCombinedTables();
