// Wound Location Table
const WOUND_LOCATIONS = {
  "1-2": {
    result: "Left Arm",
    effect: "Disabled",
    description: "Your arm becomes unusable. It cannot hold things and any held item is dropped.",
    critical: "Mangled. Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."
  },
  "3-4": {
    result: "Right Arm",
    effect: "Disabled",
    description: "Your arm becomes unusable. It cannot hold things and any held item is dropped.",
    critical: "Mangled. Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."
  },
  "5-6": {
    result: "Left Leg",
    effect: "Disabled",
    description: "Your leg becomes unusable. It cannot support your weight and you fall prone. Movement cut in half.",
    critical: "Mangled. Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."
  },
  "7-8": {
    result: "Right Leg",
    effect: "Disabled",
    description: "Your leg becomes unusable. It cannot support your weight and you fall prone. Movement cut in half.",
    critical: "Mangled. Make a Physical save. On a failure, a limb is permanently disabled or hacked off. On a success, you merely lose a finger or toe."
  },
  "9-10": {
    result: "Torso",
    effect: "Blood Loss",
    description: "Your maximum HP is reduced by 1 per HD you possess.",
    critical: "Crushed. Make a Physical save. On a success, you gain a cool scar. On a failure, roll 1d6:\n1) Permanently lose 1 Strength.\n2) Permanently lose 1 Dexterity.\n3) Permanently lose 1 Constitution.\n4) Crushed throat. You cannot speak louder than a whisper.\n5) Crushed ribs. Treat Constitution as 4 when holding your breath.\n6) Your spine is broken and you are paralyzed from the neck down. You can attempt recovery twice: by making a Con Check after 1d6 days and again after 1d6 weeks. If you fail both, it is permanent."
  },
  "11-12": {
    result: "Head",
    effect: "Concussed",
    description: "Always act last in combat. Make an Int check (DC 12) when you cast a spell to avoid it fizzling.",
    critical: "Skullcracked. Make a Physical save. On a success, you gain a cool scar. On a failure, roll 1d6:\n1) Permanently lose 1 Intelligence.\n2) Permanently lose 1 Wisdom.\n3) Permanently lose 1 Charisma.\n4) Lose your left eye. -1 to Ranged Attacks.\n5) Lose your right eye. -1 to Ranged Attacks.\n6) Slip into a coma. You can attempt recovery twice: by making a Con Check after 1d6 days and again after 1d6 weeks. If you fail both, it is permanent."
  }
};

async function showWoundDialog() {
  const dialogTemplate = `
    <form>
      <div class="form-group">
        <label>Excess Damage:</label>
        <input type="number" name="excess" value="1" min="1"/>
      </div>
      <div class="form-group">
        <label>Current Injuries:</label>
        <textarea name="currentInjuries" rows="3" placeholder="List current injuries here..."></textarea>
      </div>
      <div class="form-group">
        <label>Critical Hit?</label>
        <input type="checkbox" name="isCritical"/>
      </div>
    </form>
  `;

  new Dialog({
    title: "Apply Wounds",
    content: dialogTemplate,
    buttons: {
      roll: {
        icon: '<i class="fas fa-dice-d20"></i>',
        label: "Roll Location",
        callback: (html) => {
          const excess = parseInt(html.find('[name="excess"]').val());
          const currentInjuries = html.find('[name="currentInjuries"]').val();
          const isCritical = html.find('[name="isCritical"]').prop("checked");
          rollWoundLocation(excess, currentInjuries, isCritical);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "roll"
  }).render(true);
}

async function rollWoundLocation(excess, currentInjuries, isCritical) {
  const roll = new Roll("2d6");
  await roll.evaluate({async: true});
  
  let result = null;
  for (let key in WOUND_LOCATIONS) {
    const [min, max] = key.split("-").map(n => parseInt(n));
    if (roll.total >= min && roll.total <= max) {
      result = WOUND_LOCATIONS[key];
      break;
    }
  }
  
  if (!result) return;

  const chatTemplate = `
    <section class="wwn chat-message">
      <div class="wwn chat-block">
        <div class="flexrow chat-header">
          <div class="chat-title">
            <h2>Wound Result</h2>
          </div>
        </div>
        <div class="chat-details">
          <strong>Roll: ${roll.total}</strong>
          <br/>
          <strong>Excess Damage: ${excess}</strong>
          ${currentInjuries ? `<br/><strong>Current Injuries:</strong><br/>${currentInjuries}` : ''}
        </div>
        <div class="roll-result">
          <h3>${result.result} - ${result.effect}</h3>
          <div class="wound-details">
            <p>${result.description}</p>
            ${isCritical ? `<div class="critical-wound"><h4>Critical Effect:</h4><p>${result.critical}</p></div>` : ''}
          </div>
        </div>
      </div>
    </section>
  `;
  
  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker(),
    content: chatTemplate,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flavor: `Wound Location Roll`
  });
}

// Execute the macro
showWoundDialog(); 