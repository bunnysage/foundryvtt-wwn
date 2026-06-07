/**
 * Character-specific actor logic (prepareData and compute methods).
 */
import * as creature from "./creature.mjs";
import { computeSeverityBand } from "../../injury-thresholds.mjs";

/**
 * Run full prepareData for character (all compute steps in order).
 * @param {import("../../entity.js").WwnActor} actor
 */
export function prepare(actor) {
  if (actor.type !== "character") return;
  creature.computeModifiers(actor);
  computeAC(actor);
  computeEncumbrance(actor);
  _calculateMovement(actor);
  computeResources(actor);
  computeTreasure(actor);
  computePersonalTreasure(actor);
  enableSpellcasting(actor);
  computeEffort(actor);
  if (actor.system.spells?.leveledSlots) computeSlots(actor);
  creature.computeSaves(actor);
  computeTotalSP(actor);
  setXP(actor);
  computePrepared(actor);
  creature.computeInit(actor);
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function setXP(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  let xpRate = [];
  const level = data.details.level - 1;
  switch (game.settings.get("wwn", "xpConfig")) {
    case "xpSlow":
      xpRate = [6, 15, 24, 36, 51, 69, 87, 105, 139];
      break;
    case "xpFast":
      xpRate = [3, 6, 12, 18, 27, 39, 54, 72, 93];
      break;
    case "xpCustom":
      xpRate = game.settings.get("wwn", "xpCustomList").split(",");
      break;
  }
  if (!game.settings.get("wwn", "xpPerChar")) {
    actor.system.details.xp.next = xpRate[level];
  }
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computePrepared(actor) {
  const spells = actor.items.filter((i) => i.type === "spell");
  if (spells.length === 0) return;
  let spellsPrepared = 0;
  spells.forEach((s) => {
    if (s.system.prepared) spellsPrepared++;
  });
  actor.system.spells.prepared.value = spellsPrepared;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeResources(actor) {
  if (actor.type !== "character") return;
  let totalOil = 0, totalTorches = 0, totalRations = 0;
  const oilArray = actor.items.filter(
    (i) => i.name.toLowerCase() === "oil, one pint" || i.name.toLowerCase() === "oil"
  );
  const torchArray = actor.items.filter((i) => i.name.toLowerCase() === "torch");
  const rationsArray = actor.items.filter((i) => i.name.toLowerCase().includes("rations"));
  oilArray.forEach((i) => (totalOil += i.system.charges.value));
  torchArray.forEach((i) => (totalTorches += i.system.charges.value));
  rationsArray.forEach((i) => (totalRations += i.system.charges.value));
  actor.system.details.resources = { oil: totalOil, torches: totalTorches, rations: totalRations };
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function enableSpellcasting(actor) {
  if (actor.type === "faction" || actor.type === "ship") return;
  const arts = actor.items.filter((i) => i.type === "art");
  const spells = actor.items.filter((i) => i.type === "spell");
  actor.system.spells.enabled = arts.length > 0 || spells.length > 0;
  actor.system.spells.artsEnabled = arts.length > 0;
  actor.system.spells.spellsEnabled = spells.length > 0;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeTotalSP(actor) {
  const data = actor.system;
  if (actor.type !== "character" && actor.type !== "ship") return;
  let newTotal = 0;
  if (game.settings.get("wwn", "useGoldStandard")) {
    newTotal =
      data.currency.cp * 0.01 + data.currency.sp * 0.1 + data.currency.gp * 1 +
      data.currency.pp * 5 + data.currency.ep * 0.5 + data.currency.bank + data.personalTreasure;
  } else {
    newTotal =
      data.currency.cp * 0.1 + data.currency.sp + data.currency.gp * 10 +
      data.currency.pp * 50 + data.currency.ep * 5 + data.currency.bank + data.personalTreasure;
  }
  actor.system.currency.total = newTotal;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeEffort(actor) {
  const arts = actor.items.filter((a) => a.type === "art");
  if (arts.length === 0) {
    actor.system.classes = {};
    return;
  }
  const data = actor.system;
  const classPools = {};
  arts.forEach((a) => {
    if (!classPools[a.system.source]) {
      classPools[a.system.source] = { value: a.system.effort, max: data.classes[a.system.source]?.max ?? 1 };
    } else {
      classPools[a.system.source].value += a.system.effort;
    }
  });
  actor.system.classes = classPools;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export async function computeSlots(actor) {
  const spells = actor.items.filter((s) => s.type === "spell");
  const slots = actor.system.spells.slots;
  Object.keys(slots).forEach((level) => (actor.system.spells.slots[level].used = 0));
  spells.forEach((spell) => {
    const spellLvl = spell.system.lvl;
    slots[spellLvl].used += spell.system.memorized;
  });
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeTreasure(actor) {
  if (actor.type !== "character" && actor.type !== "ship" && actor.type !== "vehicle") return;
  let total = 0;
  const treasures = actor.items.filter(
    (i) => i.type === "item" && i.system.treasure && !i.system.personal
  );
  treasures.forEach((item) => { total += item.system.quantity * item.system.price; });
  let cargoTotal = 0;
  if (actor.type === "ship") {
    const cargos = actor.items.filter((i) => i.type === "cargo" && i.system.treasure);
    cargos.forEach((c) => { if (c.system.treasure) cargoTotal += c.system.price * c.system.quantity; });
  }
  actor.system.treasure = total + cargoTotal;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computePersonalTreasure(actor) {
  if (actor.type !== "character") return;
  let total = 0;
  const treasures = actor.items.filter((i) => i.type === "item" && i.system.personal);
  treasures.forEach((item) => { total += item.system.quantity * item.system.price; });
  actor.system.personalTreasure = total;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function _calculateMovement(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  if (!data.config?.movementAuto) return;
  const readiedValue = data.encumbrance?.readied?.value ?? 0;
  const readiedMax = data.encumbrance?.readied?.max ?? 0;
  const stowedValue = data.encumbrance?.stowed?.value ?? 0;
  const stowedMax = data.encumbrance?.stowed?.max ?? 0;
  const bonus = data.movement?.bonus ?? 0;
  const systemBase = game.settings.get("wwn", "movementRate") === "movebx" ? [40, 30, 20] : [30, 20, 15];
  let newBase;
  if (readiedValue <= readiedMax && stowedValue <= stowedMax) newBase = systemBase[0] + bonus;
  else if (readiedValue <= readiedMax + 2 && stowedValue <= stowedMax) newBase = systemBase[1] + bonus;
  else if (readiedValue <= readiedMax && stowedValue <= stowedMax + 4) newBase = systemBase[1] + bonus;
  else if (readiedValue <= readiedMax + 2 && stowedValue <= stowedMax + 4) newBase = systemBase[2] + bonus;
  else if (readiedValue <= readiedMax + 4 && stowedValue <= stowedMax) newBase = systemBase[2] + bonus;
  else if (readiedValue <= readiedMax && stowedValue <= stowedMax + 8) newBase = systemBase[2] + bonus;
  else newBase = 0;
  actor.system.movement = { base: newBase, exploration: newBase * 3, overland: newBase / 5, bonus };
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeEncumbrance(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  let totalReadied = 0, totalStowed = 0;
  const maxReadied = Math.floor(data.scores.str.value / 2);
  const maxStowed = data.scores.str.value;
  const weapons = actor.items.filter((w) => w.type === "weapon");
  const armors = actor.items.filter((a) => a.type === "armor");
  const items = actor.items.filter((i) => i.type === "item");
  const roundWeight = game.settings.get("wwn", "roundWeight");

  weapons.forEach((w) => {
    if ((w.system.weightless === "whenReadied" && w.system.equipped) || (w.system.weightless === "whenStowed" && w.system.stowed)) return;
    const wgt = w.system.weight * w.system.quantity;
    if (w.system.equipped) totalReadied += roundWeight ? Math.ceil(wgt) : wgt;
    else if (w.system.stowed) totalStowed += roundWeight ? Math.ceil(wgt) : wgt;
  });
  armors.forEach((a) => {
    if ((a.system.weightless === "whenReadied" && a.system.equipped) || (a.system.weightless === "whenStowed" && a.system.stowed)) return;
    if (a.system.equipped) totalReadied += roundWeight ? Math.ceil(a.system.weight) : a.system.weight;
    else if (a.system.stowed) totalStowed += roundWeight ? Math.ceil(a.system.weight) : a.system.weight;
  });
  items.forEach((i) => {
    if ((i.system.weightless === "whenReadied" && i.system.equipped) || (i.system.weightless === "whenStowed" && i.system.stowed)) return;
    let itemWeight;
    if (i.system.charges?.value || i.system.charges?.max) {
      if (i.system.charges.value <= i.system.charges.max || !i.system.charges.value) itemWeight = i.system.weight;
      else if (!i.system.charges.max) itemWeight = i.system.charges.value * i.system.weight;
      else itemWeight = (i.system.charges.value / i.system.charges.max) * i.system.weight;
    } else itemWeight = i.system.weight * i.system.quantity;
    if (i.system.equipped) totalReadied += roundWeight ? Math.ceil(itemWeight) : itemWeight;
    else if (i.system.stowed) totalStowed += roundWeight ? Math.ceil(itemWeight) : itemWeight;
  });

  if (!game.settings.get("wwn", "disableCoinWeight")) {
    const c = data.currency ?? {};
    const coinWeight = game.settings.get("wwn", "currencyTypes") === "currencybx"
      ? (c.cp + c.sp + c.ep + c.gp + c.pp) / 100
      : (c.cp + c.sp + c.gp) / 100;
    totalStowed += coinWeight;
  }

  actor.system.encumbrance = {
    readied: { max: maxReadied, value: totalReadied.toFixed(2) },
    stowed: { max: maxStowed, value: totalStowed.toFixed(2) },
  };
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 */
export function computeAC(actor) {
  if (actor.type !== "character") return;
  const data = actor.system;
  let baseAac = 10, AacShieldMod = 0, AacShieldNaked = 0;
  const naked = baseAac + data.scores.dex.mod + data.aac.mod;
  let exertPenalty = 0, sneakPenalty = 0;
  let traumaTarget = 6;
  if (game.settings.get("wwn", "useTrauma")) traumaTarget += data.trauma?.bonus ?? 0;

  const armors = actor.items.filter((i) => i.type === "armor");
  armors.forEach((a) => {
    if (!a.system.equipped) return;
    if (game.settings.get("wwn", "useTrauma")) traumaTarget += a.system.traumaMod ?? 0;
    const isShield = a.system.type === "shield" || (game.settings.get("wwn", "useFlatArmorPenalty") && a.system.isShield);
    if (!isShield) {
      baseAac = Number(a.system.aac.value) + a.system.aac.mod;
      if (game.settings.get("wwn", "useFlatArmorPenalty")) {
        if (a.system.ashesHeavy) { sneakPenalty = Math.max(sneakPenalty, 1); exertPenalty = Math.max(exertPenalty, 1); }
      } else {
        if (a.system.type === "medium" && a.system.weight > sneakPenalty) sneakPenalty = a.system.weight;
        if (a.system.type === "heavy" && a.system.weight > sneakPenalty) sneakPenalty = a.system.weight;
        if (a.system.type === "heavy" && a.system.weight > exertPenalty) exertPenalty = a.system.weight;
      }
    } else {
      AacShieldMod = 1 + a.system.aac.mod;
      AacShieldNaked = Number(a.system.aac.value) + a.system.aac.mod;
    }
  });

  if (AacShieldMod > 0) {
    const shieldOnly = AacShieldNaked + data.scores.dex.mod + data.aac.mod;
    const shieldBonus = baseAac + data.scores.dex.mod + data.aac.mod + AacShieldMod;
    actor.system.aac = {
      value: shieldOnly > shieldBonus ? shieldOnly : shieldBonus,
      shield: shieldOnly > shieldBonus ? 0 : AacShieldMod,
      naked,
      mod: data.aac.mod,
    };
  } else {
    actor.system.aac = { value: baseAac + data.scores.dex.mod + data.aac.mod, naked, shield: 0, mod: data.aac.mod };
  }
  actor.system.skills.sneakPenalty = sneakPenalty;
  actor.system.skills.exertPenalty = exertPenalty;
  if (game.settings.get("wwn", "useTrauma")) actor.system.trauma.value = traumaTarget;
}

/**
 * @param {import("../../entity.js").WwnActor} actor
 * @param {number} excess
 */
export async function applyWounds(actor, excess) {
  // Mythras d20 hit location table.
  const hitLocations = [
    { range: [1, 3], result: "Right Leg", details: "Includes right hip and thigh" },
    { range: [4, 6], result: "Left Leg", details: "Includes left hip and thigh" },
    { range: [7, 9], result: "Abdomen", details: "Includes groin and lower torso" },
    { range: [10, 12], result: "Chest", details: "Includes upper torso and back" },
    { range: [13, 15], result: "Right Arm", details: "Includes right shoulder" },
    { range: [16, 18], result: "Left Arm", details: "Includes left shoulder" },
    { range: [19, 20], result: "Head", details: "Includes neck" },
  ];

  const locationRoll = await new Roll("1d20").evaluate();
  const hitLocation = hitLocations.find((loc) => locationRoll.total >= loc.range[0] && locationRoll.total <= loc.range[1]);
  const currInjuries = actor.system.hp.injuries ?? 0;
  const critResistance = actor.system.critResistance ?? 0;
  const woundRoll = await new Roll(`1d12 + (2 * ${currInjuries}) + ${excess} - ${critResistance}`).evaluate();
  const woundMessage = woundRoll.result;
  const woundResult = woundRoll.total;
  const newInjuries = currInjuries + 1;

  await actor.update({ "system.hp.injuries": newInjuries });

  const content = `
    <p><b>Location: ${hitLocation.result}.</b> ${hitLocation.details}.</p>
    <p><b>Severity: ${woundResult}</b> (${woundMessage}) [CR: ${critResistance}]</p>
    <p><b>Injuries:</b> ${currInjuries} &rarr; ${newInjuries}</p>`;

  const template = "systems/wwn/templates/chat/apply-damage.hbs";
  const templateData = { title: `${actor.name}: ${hitLocation.result} Wounded!`, body: content, image: "icons/svg/blood.svg" };
  const html = await renderTemplate(template, templateData);
  await ChatMessage.create({ user: game.user.id, content: html }, {});
}

/**
 * Create a threshold injury from the opt-in injury die workflow.
 * @param {import("../../entity.js").WwnActor} actor
 * @param {object} thresholdResult
 * @param {object} attackContext
 */
export async function applyThresholdInjury(actor, thresholdResult, attackContext = {}) {
  const locations = {
    1: ["Arm", "Bruised grip", "The limb aches and shakes off after a moment."],
    2: ["Arm", "Cut forearm", "The wound needs attention after the fight."],
    3: ["Leg", "Staggered step", "Movement is briefly awkward."],
    4: ["Leg", "Twisted knee", "Running or climbing is painful until treated."],
    5: ["Torso", "Rattled ribs", "Breathing is painful under exertion."],
    6: ["Torso", "Deep bruise", "Armor or flesh took a punishing blow."],
    7: ["Hand", "Numb fingers", "Fine manipulation is unreliable until rested."],
    8: ["Shoulder", "Wrenched shoulder", "Heavy use of the arm is painful."],
    9: ["Head", "Dazed", "Focus is difficult for a few moments."],
    10: ["Head", "Split brow", "Blood and shock make the hit hard to ignore."],
    11: ["Vitals", "Bad angle", "The injury could worsen without care."],
    12: ["Vitals", "Dangerous wound", "Treatment is strongly advised."],
  };

  const locationRoll = await new Roll("1d12").evaluate();
  const hitLocation = locations[locationRoll.total] ?? ["Body", "Threshold injury", "The hit leaves a mark."];
  const severity = computeSeverityBand(thresholdResult.severityRoll);

  const currentInjuries = actor.system.hp?.injuries ?? 0;
  if (severity.persistent) {
    await actor.update({ "system.hp.injuries": currentInjuries + 1 });
  }

  const edgeLabel = thresholdResult.edge?.source === "natural20"
    ? "Natural 20 Edge 3"
    : thresholdResult.edge?.margin !== null
      ? `Margin ${thresholdResult.edge.margin}, Edge ${thresholdResult.edge.edge}`
      : `Edge ${thresholdResult.edge?.edge ?? 0}`;
  const triggerLabels = {
    natural20: "natural 20",
    "upper-half-damage-roll": "upper-half damage roll",
    "greater-than-half-max-hp": "damage greater than half max HP",
  };
  const triggerText = Array.isArray(thresholdResult.triggers) && thresholdResult.triggers.length
    ? thresholdResult.triggers.map((trigger) => triggerLabels[trigger] ?? trigger).join(", ")
    : "threshold trigger";
  const chanceText = thresholdResult.autoInjury
    ? `<p><b>Injury chance:</b> automatic (${triggerText}) [IR ${thresholdResult.injuryResistance}; ${edgeLabel}]</p>`
    : `<p><b>Injury die:</b> ${thresholdResult.injuryRoll} vs ${thresholdResult.targetNumber}+ [IR ${thresholdResult.injuryResistance}; ${edgeLabel}]</p>`;
  const persistentText = severity.persistent ? "Persistent injury recorded." : "No persistent injury recorded.";
  const content = `
    <p><b>Source:</b> ${attackContext.sourceItemName || "Attack"}</p>
    <p><b>Trigger:</b> ${triggerText}</p>
    ${chanceText}
    <p><b>Severity:</b> ${severity.band} (${thresholdResult.severityFormula})</p>
    <p><b>Location:</b> ${hitLocation[0]}.</p>
    <p><b>${hitLocation[1]}.</b> ${hitLocation[2]}</p>
    <p>${persistentText}</p>`;

  const template = "systems/wwn/templates/chat/apply-damage.hbs";
  const templateData = {
    title: `${actor.name}: ${severity.band} Threshold Injury`,
    body: content,
    image: "icons/svg/blood.svg",
  };
  const html = await renderTemplate(template, templateData);
  const chatData = {
    user: game.user.id,
    content: html,
  };
  if (attackContext.whisper) chatData.whisper = attackContext.whisper;
  if (attackContext.blind) chatData.blind = true;
  await ChatMessage.create(chatData, {});
}
