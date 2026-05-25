import { WwnDice } from "../dice.js";
import { WwnItem } from "../item/entity.js";
import BaseDocumentMixin from "../documents/base-document-mixin.mjs";
import * as character from "./types/character.mjs";
import * as creature from "./types/creature.mjs";
import * as faction from "./types/faction.mjs";
import * as monster from "./types/monster.mjs";
import * as ship from "./types/ship.mjs";
import * as vehicle from "./types/vehicle.mjs";
import {
  THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
  buildThresholdAttemptKey,
  computeEdge,
  computeExistingInjuryPressure,
  computeHealthPressure,
  computeInjuryTargetNumber,
  computeTotalPressure,
  computeWeaponPressure,
  evaluateInjuryDie,
  getActorInjuryResistance,
  getTargetAac,
  isPositiveNormalAttackDamage,
  isValidAttackContext,
  resolveTrustedThresholdAction,
} from "../injury-thresholds.mjs";

export class WwnActor extends BaseDocumentMixin(Actor) {
  /**
   * Extends data from base Actor class. Dispatches to type-specific prepare modules.
   */
  prepareData() {
    super.prepareData();
    if (this.type === "faction") faction.prepare(this);
    else if (this.type === "vehicle") vehicle.prepare(this);
    else if (this.type === "ship") ship.prepare(this);
    else if (this.type === "monster") monster.prepare(this);
    else if (this.type === "character") character.prepare(this);
  }

  /** @inheritdoc */
  async createEmbeddedDocuments(embeddedName, data = [], context = {}) {
    if (!game.user.isGM && !this.isOwner) return;
    return super.createEmbeddedDocuments(embeddedName, data, context);
  }

  /** @inheritdoc */
  async _preCreate(data, options, user) {
    const allowed = await super._preCreate(data, options, user);
    if (allowed === false) return false;

    const updates = {};
    // Token defaults for all actor types: name on hover for everyone, bar1 = HP on hover for owner
    const dm = CONST.TOKEN_DISPLAY_MODES;
    updates["prototypeToken.displayName"] = dm.HOVER ?? 3;
    updates["prototypeToken.displayBars"] = dm.OWNER_HOVER ?? 2;
    updates["prototypeToken.bar1"] = { attribute: "hp" };
    if (this.type === "faction") {
      updates["prototypeToken.actorLink"] = true;
      updates.img = "systems/wwn/assets/default/faction.png";
    }
    if (this.type === "character") {
      updates["prototypeToken.actorLink"] = true;
      updates["prototypeToken.sight.enabled"] = true;
    }
    if (this.type === "ship") {
      updates["prototypeToken.actorLink"] = true;
      updates.img = "icons/skills/trades/profession-sailing-ship.webp";
    }
    if (this.type === "vehicle") {
      updates["prototypeToken.actorLink"] = true;
      updates.img = "icons/environment/creatures/horse-tan.webp";
    }

    this.updateSource(updates);
  }

  /* -------------------------------------------- */
  /*  Socket Listeners and Handlers
    /* -------------------------------------------- */
  getExperience(value, options = {}) {
    if (this.type != "character") {
      return;
    }
    let modified = Math.floor(
      value + (this.system.details.xp.bonus * value) / 100
    );
    return this.update({
      "system.details.xp.value": modified + this.system.details.xp.value,
    }).then(() => {
      const speaker = ChatMessage.getSpeaker({ actor: this });
      ChatMessage.create({
        content: game.i18n.format("WWN.messages.GetExperience", {
          name: this.name,
          value: modified,
        }),
        speaker,
      });
    });
  }

  isNew() {
    const data = this.system;
    if (this.type == "character") {
      let ct = 0;
      Object.values(data.scores).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    } else if (this.type == "monster") {
      let ct = 0;
      Object.values(data.saves).forEach((el) => {
        ct += el.value;
      });
      return ct == 0 ? true : false;
    }
  }

  getBank(value, options = {}) {
    if (this.type != "character") {
      return;
    }
    return this.update({
      "system.currency.bank": value + this.system.currency.bank,
    }).then(() => {
      const speaker = ChatMessage.getSpeaker({ actor: this });
      const currency = game.settings.get("wwn", "useGoldStandard")
        ? game.i18n.localize("WWN.currency.gold")
        : game.i18n.localize("WWN.currency.silver");
      ChatMessage.create({
        content: game.i18n.format("WWN.messages.GetCurrency", {
          name: this.name,
          value,
          currency,
        }),
        speaker,
      });
    });
  }

  /* -------------------------------------------- */
  /*  Rolls                                       */
  /* -------------------------------------------- */

  async rollHP(options = {}) {
    const roll = await new Roll(this.system.hp.hd).roll();
    return this.update({
      system: {
        hp: {
          max: roll.total,
          value: roll.total,
        },
      },
    });
  }

  rollSave(save, options = {}) {
    const label = game.i18n.localize(`WWN.saves.${save}`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "above",
        target: this.system.saves[save].value,
        magic: this.type === "character" ? this.system.scores.wis.mod : 0,
      },
      details: game.i18n.format("WWN.roll.details.save", { save: label }),
    };

    let skip = options.event && options.event.ctrlKey;

    const rollMethod =
      this.type == "character" ? WwnDice.RollSave : WwnDice.Roll;

    // Roll and return
    return rollMethod({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.save", { save: label }),
      title: game.i18n.format("WWN.roll.save", {
        save: this.name + " - " + label,
      }),
    });
  }

  async rollMorale(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: this.system.details.morale,
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: false,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("WWN.roll.morale"),
      title: game.i18n.localize("WWN.roll.morale"),
    });
  }

  async rollInstinct(options = {}) {
    const rollParts = ["1d10"];

    const data = {
      actor: this,
      roll: {
        type: "instinct",
        target: this.system.details.instinct,
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: false,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("WWN.roll.instinct"),
      title: game.i18n.localize("WWN.roll.instinct"),
    });
  }

  async rollLoyalty(options = {}) {
    const label = game.i18n.localize(`WWN.roll.loyalty`);
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "below",
        target: this.system.retainer.loyalty,
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  async rollReaction(options = {}) {
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "table",
        table: {
          2: game.i18n.format("WWN.reaction.Hostile", {
            name: this.name,
          }),
          3: game.i18n.format("WWN.reaction.Unfriendly", {
            name: this.name,
          }),
          6: game.i18n.format("WWN.reaction.Neutral", {
            name: this.name,
          }),
          9: game.i18n.format("WWN.reaction.Indifferent", {
            name: this.name,
          }),
          12: game.i18n.format("WWN.reaction.Friendly", {
            name: this.name,
          }),
        },
      },
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.localize("WWN.reaction.check"),
      title: game.i18n.localize("WWN.reaction.check"),
    });
  }

  async rollCheck(score, options = {}) {
    const label = game.i18n.localize(`WWN.scores.${score}.long`);
    const rollParts = ["1d20"];

    const data = {
      actor: this,
      roll: {
        type: "check",
        target: this.system.scores[score].value,
      },

      details: game.i18n.format("WWN.roll.details.attribute", {
        score: label,
      }),
    };

    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.attribute", { attribute: label }),
      title: game.i18n.format("WWN.roll.attribute", { attribute: label }),
    });
  }

  async rollHitDice(options = {}) {
    const label = game.i18n.localize(`WWN.roll.hd`);
    const rollParts = new Array(this.system.details.level || 1).fill(
      this.system.hp.hd
    );
    if (this.type == "character") {
      rollParts.push(
        `${this.system.scores.con.mod * this.system.details.level}[CON]`
      );
    }

    const data = {
      actor: this,
      roll: {
        type: "hitdice",
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
    });
  }

  async rollAppearing(options = {}) {
    const rollParts = [];
    let label = "";
    if (options.check == "wilderness") {
      rollParts.push(this.system.details.appearing.w);
      label = "(wilderness)";
    } else {
      rollParts.push(this.system.details.appearing.d);
      label = "(dungeon)";
    }
    const data = {
      actor: this,
      roll: {
        type: {
          type: "appearing",
        },
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.appearing", { type: label }),
      title: game.i18n.format("WWN.roll.appearing", { type: label }),
    });
  }

  async rollMonsterSkill(options = {}) {
    const label = game.i18n.localize(`WWN.skill`);
    const rollParts = ["2d6"];

    const data = {
      actor: this,
      roll: {
        type: "skill",
        target: this.system.details.skill,
      },

      details: game.i18n.format("WWN.roll.details.attribute", {
        score: label,
      }),
    };

    rollParts.push(this.system.details.skill);
    let skip = options.event && options.event.ctrlKey;

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: data,
      skipDialog: skip,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: game.i18n.format("WWN.roll.attribute", { attribute: label }),
      title: game.i18n.format("WWN.roll.attribute", { attribute: label }),
    });
  }

  async rollDamage(attData, options = {}) {
    const data = this.system;

    const rollData = {
      actor: this,
      item: attData.item,
      roll: {
        type: "damage",
        dmg: [],
      },
    };

    let dmgParts = [];
    if (!attData.roll.dmg) {
      dmgParts.push("1d6");
      rollData.roll.dmg = ["1d6"];
    } else {
      dmgParts.push(attData.roll.dmg);
      rollData.roll.dmg = [attData.roll.dmg];
    }

    // Damage roll
    await WwnDice.Roll({
      event: options.event,
      parts: dmgParts,
      data: rollData,
      skipDialog: true,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: `${attData.label} - ${game.i18n.localize("WWN.Damage")}`,
      title: `${attData.label} - ${game.i18n.localize("WWN.Damage")}`,
    });
  }

  async targetAttack(data, type, options) {
    if (game.user.targets.size > 0) {
      for (let t of game.user.targets.values()) {
        data.roll.target = t;
        if (this.type !== "ship") {
          await this.rollAttack(data, {
            type: type,
            skipDialog: options.skipDialog,
          });
        } else {
          this.rollShipAttack(data, { type: type, skipDialog: options.skipDialog });
        }
      }
    } else {
      if (this.type !== "ship") {
        this.rollAttack(data, { type: type, skipDialog: options.skipDialog });
      } else {
        this.rollShipAttack(data, { type: type, skipDialog: options.skipDialog });
      }
    }
  }

  async rollAttack(attData, options = {}) {
    const data = this.system;
    const rollParts = ["1d20"];
    const dmgParts = [];
    const rollLabels = [];
    const dmgLabels = [];
    const weaponShock = attData.item.system.shock.damage;
    let statAttack, skillAttack, statValue, skillValue;
    if (data.character) {
      statAttack = attData.item.system.score;
      skillAttack = attData.item.system.skill;
      if (!skillAttack) {
        return ui.notifications.error("No skill set for this weapon. Please edit weapon and enter a skill.");
      }
      skillValue = this.items.find(
        (item) => item.type === "skill" && item.name.toLowerCase() === skillAttack.toLowerCase()
      )?.system?.ownedLevel || 0;
      statValue = this.system.scores[statAttack].mod;
    }

    const isNPC = attData.actor.type !== "character";

    let readyState = "";
    let label = game.i18n.format("WWN.roll.attacks", {
      name: this.name,
    });
    if (!attData.item) {
      dmgParts.push("1d6");
    } else {
      if (data.character) {
        if (attData.item.system.equipped) {
          readyState = game.i18n.format("WWN.roll.readied");
        } else if (attData.item.system.stowed) {
          readyState = game.i18n.format("WWN.roll.stowed");
        } else {
          readyState = game.i18n.format("WWN.roll.notCarried");
        }
      }
      label = game.i18n.format("WWN.roll.attacksWith", {
        name: attData.item.name,
        readyState: readyState,
      });
      dmgParts.push(attData.item.system.damage);
    }

    if (data.character) {
      if (data.warrior) {
        const levelRoundedUp = Math.ceil(this.system.details.level / 2);
        attData.item.system.shockTotal =
          statValue + weaponShock + levelRoundedUp + Number(this.system.damageBonus);
      } else {
        attData.item.system.shockTotal = statValue + weaponShock + Number(this.system.damageBonus);
      }
      if (attData.item.system.skillDamage) {
        attData.item.system.shockTotal =
          attData.item.system.shockTotal + skillValue + Number(this.system.damageBonus);
      }
    } else {
      attData.item.system.shockTotal =
        Number(this.system.damageBonus) +
        Number(attData.item.system.shock.damage);
    }
    rollParts.push(data.thac0.bba.toString());
    rollLabels.push(`+${data.thac0.bba} (attack bonus)`);

    // TODO: Add range selector in dialogue if missile attack.
    /* if (options.type == "missile") {
      rollParts.push(
        
      );
    } */
    if (data.character) {
      const unskilledAttack = attData.item.system.tags.find(
        (weapon) => weapon.title === "CB"
      )
        ? 0
        : -2;
      rollParts.push(statValue);
      rollLabels.push(`+${statValue} (${statAttack})`);
      if (skillValue == -1) {
        rollParts.push(unskilledAttack);
        rollLabels.push(`${unskilledAttack} (unskilled penalty)`);
      } else {
        rollParts.push(skillValue);
        rollLabels.push(`+${skillValue} (${skillAttack})`);
      }
    }

    if (attData.item && attData.item.system.bonus) {
      rollParts.push(attData.item.system.bonus);
      rollLabels.push(`+${attData.item.system.bonus} (weapon bonus)`);
    }
    let thac0 = data.thac0.value;

    if (data.character) {
      dmgParts.push(statValue);
      dmgLabels.push(`+${statValue} (${statAttack})`);
      if (data.warrior) {
        const levelRoundedUp = Math.ceil(data.details.level / 2);
        dmgParts.push(levelRoundedUp);
        dmgLabels.push(`+${levelRoundedUp} (warrior bonus)`);
      }
      if (attData.item.system.skillDamage) {
        dmgParts.push(skillValue);
        dmgLabels.push(`+${skillValue} (${skillAttack})`);
      }
    }

    dmgParts.push(this.system.damageBonus);
    dmgLabels.push(`+${this.system.damageBonus.toString()} (damage bonus)`);

    const rollTitle = `1d20 ${rollLabels.join(" ")}`;
    const dmgTitle = `${dmgParts[0]} ${dmgLabels.join(" ")}`;

    const rollData = {
      ...(this._getRollData() || {}),
      actor: this,
      item: attData.item,
      roll: {
        type: options.type,
        thac0: thac0,
        dmg: dmgParts,
        baseWeaponDamageFormula: dmgParts[0],
        save: attData.roll.save,
        target: attData.roll.target,
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
      rollTitle: rollTitle,
      dmgTitle: dmgTitle,
    });
  }

  async rollShipAttack(attData, options = {}) {
    const data = this.system;
    const rollParts = ["1d20"];
    const dmgParts = [];
    const rollLabels = [];
    const dmgLabels = [];

    let label = game.i18n.format("WWN.roll.attacks", {
      name: this.name,
    });
    if (!attData.item) {
      dmgParts.push("1d6");
    } else {
      dmgParts.push(attData.item.system.damage);
    }

    rollParts.push(data.thac0.bba.toString());
    rollLabels.push(`+${data.thac0.bba} (attack bonus)`);

    if (attData.item && attData.item.system.bonus) {
      rollParts.push(attData.item.system.bonus);
      rollLabels.push(`+${attData.item.system.bonus} (weapon bonus)`);
    }
    let thac0 = data.thac0.value;

    const rollTitle = `1d20 ${rollLabels.join(" ")}`;
    const dmgTitle = `${dmgParts[0]} ${dmgLabels.join(" ")}`;

    const rollData = {
      ...(this._getRollData() || {}),
      actor: this,
      item: attData.item,
      roll: {
        type: options.type,
        thac0: thac0,
        dmg: dmgParts,
        baseWeaponDamageFormula: dmgParts[0],
        save: attData.roll.save,
        target: attData.roll.target,
      },
    };

    // Roll and return
    return await WwnDice.Roll({
      event: options.event,
      parts: rollParts,
      data: rollData,
      skipDialog: options.skipDialog,
      speaker: ChatMessage.getSpeaker({ actor: this }),
      flavor: label,
      title: label,
      rollTitle: rollTitle,
      dmgTitle: dmgTitle,
    });
  }

  async applyDamage(amount = 0, multiplier = 1, options = {}) {
    const rawAmount = parseInt(amount);
    amount = Math.floor(rawAmount * multiplier);
    const hp = this.system.hp;
    const wp = this.system.wp;
    const preDamageHp = { value: Number(hp.value ?? 0), max: Number(hp.max ?? 0) };
    const excessDamage =
      hp.value - amount < 0 ? Math.abs(hp.value - amount) : 0;
    const belowZeroWoundPreempted = game.settings.get("wwn", "replaceStrainWithWounds") && (this.type === "character" || this.type === "monster") && excessDamage > 0;

    // Remaining goes to health
    const dh = Math.clamp(hp.value - amount, 0, hp.max);
    const updateData = {
      "system.hp.value": dh,
    };

    if (belowZeroWoundPreempted) {
      await character.applyWounds(this, excessDamage);
    } else if (game.settings.get("wwn", "enableWoundPoints") && (this.type === "character" || this.type === "monster") && excessDamage > 0 && wp) {
      updateData["system.wp.value"] = Math.clamp((wp.value ?? 0) - excessDamage, 0, wp.max ?? 0);
    }

    // Update the Actor
    const hpUpdate = await this.update(updateData);
    const threshold = await this._applyThresholdInjuryAfterDamage({
      rawAmount,
      multiplier,
      preDamageHp,
      belowZeroWoundPreempted,
      threshold: options.threshold,
      targetToken: options.targetToken,
    });
    return options.threshold ? { hpUpdate, threshold } : hpUpdate;
  }

  async _applyThresholdInjuryAfterDamage({
    rawAmount,
    multiplier,
    preDamageHp,
    belowZeroWoundPreempted,
    threshold,
    targetToken,
  } = {}) {
    if (!threshold) return null;
    if (!game.settings.get("wwn", "thresholdInjuries")) return null;
    if (!(this.type === "character" || this.type === "monster")) {
      return { skipped: true, reason: "unsupported-actor-type" };
    }

    const lookedEligible = threshold.thresholdActionId?.startsWith("normalDamage") || threshold.thresholdActionId === "straightDamage";
    if (!lookedEligible) return null;

    const attackContext = threshold.attackContext;
    const trustedAction = resolveTrustedThresholdAction({
      attackContext,
      actionId: threshold.thresholdActionId,
      domAction: threshold.domAction,
      amount: rawAmount,
      multiplier,
    });
    const action = trustedAction.action;
    const damageContext = {
      actionFamily: action?.actionFamily,
      damageKind: action?.damageKind,
      amount: rawAmount,
      multiplier,
    };

    if (!isValidAttackContext(attackContext)) {
      return { skipped: true, gmOnly: true, reason: "invalid-attack-context" };
    }
    if (!action) {
      return { skipped: true, gmOnly: true, reason: trustedAction.reason };
    }
    if (!isPositiveNormalAttackDamage(damageContext)) return null;
    const sourceActor = game.actors.get(attackContext.sourceActorId);
    if (!sourceActor?.items?.get?.(attackContext.sourceItemId) && !attackContext.sourceItemSnapshot) {
      return { skipped: true, gmOnly: true, reason: "invalid-attack-provenance" };
    }
    if (belowZeroWoundPreempted) {
      return { skipped: true, gmOnly: true, reason: "below-zero-wound-preempted" };
    }

    const canUpdate = this.canUserModify?.(game.user, "update") ?? this.isOwner;
    if (!canUpdate) {
      return { skipped: true, gmOnly: true, reason: "actor-update-permission-denied" };
    }

    const targetUuid = targetToken?.document?.uuid ?? targetToken?.actor?.uuid ?? this.uuid;
    const attemptKey = buildThresholdAttemptKey({
      messageUuid: threshold.messageUuid,
      targetUuid,
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
    });
    if (!attemptKey) return { skipped: true, gmOnly: true, reason: "missing-attempt-key" };

    const attempts = foundry.utils.deepClone(this.getFlag("wwn", "thresholdInjuryAttempts") ?? {});
    if (attempts[attemptKey]) {
      return { skipped: true, gmOnly: true, reason: "duplicate-threshold-attempt" };
    }
    attempts[attemptKey] = {
      messageUuid: threshold.messageUuid,
      targetUuid,
      actionFamily: THRESHOLD_ACTION_FAMILY_NORMAL_DAMAGE,
      attemptedAt: new Date().toISOString(),
    };
    await this.setFlag("wwn", "thresholdInjuryAttempts", attempts);

    const edge = computeEdge({
      attackTotal: attackContext.attackTotal,
      targetAac: getTargetAac(this),
      naturalD20: attackContext.naturalD20,
    });
    if (!edge.eligible) {
      return { skipped: true, gmOnly: true, reason: edge.reason, edge };
    }

    const injuryResistance = getActorInjuryResistance(this);
    const targetNumber = computeInjuryTargetNumber({ injuryResistance, edge: edge.edge });
    const injuryRoll = await new Roll("1d10").evaluate();
    const triggered = evaluateInjuryDie({ dieResult: injuryRoll.total, targetNumber });

    const baseResult = {
      skipped: false,
      triggered,
      targetName: this.name,
      injuryRoll: injuryRoll.total,
      targetNumber,
      edge,
      injuryResistance,
      sourceItemName: attackContext.sourceItemName,
    };

    if (!triggered) return baseResult;

    const weaponPressure = computeWeaponPressure(attackContext.baseWeaponDamageFormula);
    const healthPressure = computeHealthPressure({ hpValue: preDamageHp.value, hpMax: preDamageHp.max });
    const injuryPressure = computeExistingInjuryPressure(this.system.hp?.injuries ?? 0);
    const totalPressure = computeTotalPressure({ weaponPressure, healthPressure, injuryPressure });
    const severityRoll = await new Roll(`1d6 + ${totalPressure}`).evaluate();
    const result = {
      ...baseResult,
      weaponPressure,
      healthPressure,
      injuryPressure,
      totalPressure,
      severityRoll: severityRoll.total,
      severityFormula: severityRoll.result,
    };
    await character.applyThresholdInjury(this, result, attackContext);
    return result;
  }

  async applyWounds(excess) {
    if (this.type === "character" || this.type === "monster") await character.applyWounds(this, excess);
  }

  static _valueFromTable(table, val) {
    let output;
    for (let i = 0; i <= val; i++) {
      if (table[i] != undefined) {
        output = table[i];
      }
    }
    return output;
  }

  computeInit() {
    creature.computeInit(this);
  }

  setXP() {
    character.setXP(this);
  }

  computePrepared() {
    character.computePrepared(this);
  }

  computeEncumbrance() {
    character.computeEncumbrance(this);
  }

  computeEncumbranceVehicle() {
    vehicle.computeEncumbranceVehicle(this);
  }

  computeEncumbranceShip() {
    ship.computeEncumbranceShip(this);
  }

  computeCrewStrength() {
    ship.computeCrewStrength(this);
  }

  computeCrewCost() {
    ship.computeCrewCost(this);
  }

  _calculateMovement() {
    character._calculateMovement(this);
  }

  computeResources() {
    character.computeResources(this);
  }

  enableSpellcasting() {
    character.enableSpellcasting(this);
  }

  computeTotalSP() {
    character.computeTotalSP(this);
  }

  computeTotalCargoValue() {
    ship.computeTotalCargoValue(this);
  }

  computeEffort() {
    character.computeEffort(this);
  }

  async computeSlots() {
    await character.computeSlots(this);
  }

  computeTreasure() {
    character.computeTreasure(this);
  }

  computePersonalTreasure() {
    character.computePersonalTreasure(this);
  }

  computeAC() {
    character.computeAC(this);
  }

  computeModifiers() {
    creature.computeModifiers(this);
  }

  computeSaves() {
    creature.computeSaves(this);
  }

  _getRollData() {
    if (this.type === "faction" || this.type === "ship") {
      // for now, no roll data for factions or ships
      // but something to look at in the future maybe?
      return {};
    }

    const data = {};
    data.atk = this.system.thac0?.bba;

    if (this.type === "monster") {
      // no skills to use, but let's set @level to be = hd total.
      // just in case the hit dice field is wonky, default to 1
      data.level = 1;

      // parse out the first digit via a regex. might be hacky.
      const diceRegex = this.system.hp.hd.match(/([0-9]+)d[0-9]+/);
      if (!!diceRegex) {
        data.level = parseInt(diceRegex[1]);
      }
    } else {
      const skillMods = this.items
        .filter((i) => i.type === "skill")
        .map((s) => ({ name: toCamelCase(s.name), mod: s.system.ownedLevel }));

      skillMods.forEach((sm) => (data[sm.name] = sm.mod));

      data.level = this.system.details.level;
      data.str = this.system.scores.str.mod;
      data.dex = this.system.scores.dex.mod;
      data.con = this.system.scores.con.mod;
      data.wis = this.system.scores.wis.mod;
      data.int = this.system.scores.int.mod;
      data.cha = this.system.scores.cha.mod;
      data.init = this.system.initiative.value;
      data.initiativeRoll = this.system.initiative.roll;
    }
    return data;
  }

  // Creates a list of skills based on the following list. Was used to generate
  // the initial skills list to populate a compendium
  async createSkillsManually(data, options, user) {
    const skillList = [
      "administer",
      "connect",
      "convince",
      "craft",
      "exert",
      "heal",
      "know",
      "lead",
      "magic",
      "notice",
      "perform",
      "pray",
      "punch",
      "ride",
      "sail",
      "shoot",
      "sneak",
      "stab",
      "survive",
      "trade",
      "work",
      "biopsionics",
      "metapsionics",
      "precognition",
      "telekinesis",
      "telepathy",
      "teleportation",
    ];
    const skills = skillList.map((el) => {
      const skillKey = `WWN.skills.${el}`;
      const skillDesc = `WWN.skills.desc.${el}`;
      const imagePath = `/systems/wwn/assets/skills/${el}.png`;
      return {
        type: "skill",
        name: game.i18n.localize(skillKey),
        system: {
          ownedLevel: -1,
          score: "int",
          description: game.i18n.localize(skillDesc),
          skillDice: "2d6",
          secondary: false,
        },
        img: imagePath,
      };
    });

    if (this.type === "character") {
      await this.createEmbeddedDocuments("Item", skills);
    }
  }

  // ----------------------------
  // FACTION METHODS
  // ----------------------------
  getHealth(level) {
    if (level in HEALTH__XP_TABLE) {
      return HEALTH__XP_TABLE[level];
    } else {
      return 0;
    }
  }

}

export const HEALTH__XP_TABLE = {
  1: 1,
  2: 2,
  3: 4,
  4: 6,
  5: 9,
  6: 12,
  7: 16,
  8: 20,
};


function toCamelCase(text) {
  const split = text.split(" ").map((t) => t.titleCase());
  split[0] = split[0].toLowerCase();
  return split.join();
}
