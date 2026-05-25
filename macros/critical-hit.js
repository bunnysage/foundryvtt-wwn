// Critical Hit Types
const DAMAGE_TYPES = {
  "sharp": "Sharp Hand Weapons",
  "blunt": "Blunt Hand Weapons",
  "teeth": "Teeth and Claws",
  "arrow": "Arrows and Bolts",
  "firearm": "Firearms",
  "falling": "Falling and Crushing",
  "fire": "Fire and Energy"
};

// Hit Locations (except for falling/fire which use their own tables)
const HIT_LOCATIONS = {
  "arm": "Arm",
  "head": "Head",
  "body": "Body",
  "leg": "Leg"
};

// Store all critical tables
const CRITICAL_TABLES = {
  sharp: {
    arm: [/* Array of 16 results */],
    head: [/* Array of 16 results */],
    body: [/* Array of 16 results */],
    leg: [/* Array of 16 results */]
  },
  blunt: {
    arm: [/* Array of 16 results */],
    head: [/* Array of 16 results */],
    body: [/* Array of 16 results */],
    leg: [/* Array of 16 results */]
  },
  teeth: {
    arm: [/* Array of 16 results */],
    head: [/* Array of 16 results */],
    body: [/* Array of 16 results */],
    leg: [/* Array of 16 results */]
  },
  arrow: {
    arm: [/* Array of 16 results */],
    head: [/* Array of 16 results */],
    body: [/* Array of 16 results */],
    leg: [/* Array of 16 results */]
  },
  firearm: {
    arm: [/* Array of 16 results */],
    head: [/* Array of 16 results */],
    body: [/* Array of 16 results */],
    leg: [/* Array of 16 results */]
  },
  falling: [/* Array of 16 results */],
  fire: [/* Array of 16 results */]
};

// Initialize with first table as example
CRITICAL_TABLES.sharp.arm = [
  "Your blow grazes your opponent's arm, causing them to drop anything held in that hand.",
  "Your blow skins your opponent's knuckles, painfully but not seriously. The arm may be used normally, but anything held in the hand is dropped.",
  "Your blow opens a small cut on your opponent's forearm, incapacitating the hand for the next round and causing anything being held in the hand to be dropped.",
  "Your blow strikes the back of your opponent's hand. Anything held in that hand is dropped and the hand is incapacitated for the next D4 rounds. Until medical attention is received, any actions attempted with this arm suffer a -10 penalty.",
  "Your blow gashes your opponent's forearm. Anything held in that hand is dropped and the hand is incapacitated for the next D6 rounds. Until medical attention is received, any actions attempted with this arm suffer a -20 penalty.",
  "Your blow jabs painfully into your opponent's shoulder, slipping between any pieces of armour worn there. Anything held in that hand is dropped and the hand is incapacitated for the next D6 rounds. Until medical attention is received, any actions attempted with this arm suffer a -20 penalty.",
  "Your blow opens a deep wound in your opponent's forearm. Anything held in the hand is dropped and the arm is incapacitated until medical attention is received.",
  "Your blow carves into your opponent's shoulder, laying it open to the bone. Anything held in the hand is dropped and the whole arm is incapacitated until medical attention is received.",
  "Your blow cuts deeply into your opponent's lower arm, breaking the bones there. Anything held in the hand is dropped and the arm is incapacitated until medical attention is received.",
  "Your blow cuts deeply into your opponent's upper arm, breaking the bones there. Anything held in the hand is dropped and the arm is incapacitated until medical attention is received.",
  "Your blow strikes your opponent's hand, severing D3 fingers. Anything held in the hand is dropped and the hand is incapacitated until medical attention is received. Your opponent's Dex is permanently reduced by 5 points per finger lost and any future Dex advances are +5 rather than +10.",
  "Your blow cuts off your opponent's hand at the wrist and blood gushes from the wound at a rate of D4 W per round until staunched. Anything held in the hand is dropped and your opponent falls to the ground unconscious.",
  "Your blow severs your opponent's arm at the elbow and blood gushes from the wound at the rate of D4 W per round until staunched. Your opponent falls to the ground unconscious.",
  "Your blow severs your opponent's arm at the shoulder and blood cascades from the wound at a rate of D6 W per round until staunched. Your opponent falls to the ground unconscious.",
  "Your blow severs a major artery. Death from shock and blood loss is instantaneous.",
  "Your opponent's arm drops to the ground in a welter of blood. Your opponent staggers backwards for D3 yards and falls dead."
];

async function showCriticalDialog() {
  const dialogTemplate = `
    <form>
      <div class="form-group">
        <label>Damage Type:</label>
        <select name="damageType">
          ${Object.entries(DAMAGE_TYPES).map(([key, label]) => 
            `<option value="${key}">${label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Hit Location:</label>
        <select name="hitLocation">
          ${Object.entries(HIT_LOCATIONS).map(([key, label]) => 
            `<option value="${key}">${label}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Roll Result (1-16):</label>
        <input type="number" name="roll" value="1" min="1" max="16"/>
      </div>
    </form>
  `;

  new Dialog({
    title: "Critical Hit Result",
    content: dialogTemplate,
    buttons: {
      lookup: {
        icon: '<i class="fas fa-search"></i>',
        label: "Look Up Result",
        callback: (html) => {
          const damageType = html.find('[name="damageType"]').val();
          const hitLocation = html.find('[name="hitLocation"]').val();
          const roll = parseInt(html.find('[name="roll"]').val());
          displayCriticalResult(damageType, hitLocation, roll);
        }
      },
      cancel: {
        icon: '<i class="fas fa-times"></i>',
        label: "Cancel"
      }
    },
    default: "lookup"
  }).render(true);
}

function getCriticalResult(damageType, hitLocation, roll) {
  const index = Math.max(0, Math.min(roll - 1, 15)); // Convert 1-16 to 0-15 array index
  
  if (damageType === "falling" || damageType === "fire") {
    return CRITICAL_TABLES[damageType][index];
  }
  
  return CRITICAL_TABLES[damageType][hitLocation][index];
}

async function displayCriticalResult(damageType, hitLocation, roll) {
  const result = getCriticalResult(damageType, hitLocation, roll);
  
  const chatTemplate = `
    <section class="wwn chat-message">
      <div class="wwn chat-block">
        <div class="flexrow chat-header">
          <div class="chat-title">
            <h2>Critical Hit Result</h2>
          </div>
        </div>
        <div class="chat-details">
          <strong>Type: ${DAMAGE_TYPES[damageType]}</strong>
          ${damageType !== "falling" && damageType !== "fire" ? `<br/><strong>Location: ${HIT_LOCATIONS[hitLocation]}</strong>` : ''}
          <br/>
          <strong>Roll: ${roll}</strong>
        </div>
        <div class="roll-result">
          <div class="critical-details" id="critical-text-${roll}">${result}</div>
          <button class="copy-button" onclick="navigator.clipboard.writeText(\`${result}\`).then(() => ui.notifications.info('Critical result copied to clipboard!'));">
            <i class="fas fa-copy"></i> Copy Result
          </button>
        </div>
      </div>
    </section>
  `;
  
  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker(),
    content: chatTemplate,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flavor: `Critical Hit`
  });
}

// Add some CSS to style the copy button
const style = document.createElement('style');
style.textContent = `
  .copy-button {
    margin-top: 8px;
    padding: 4px 8px;
    background: #4a4a4a;
    color: white;
    border: 1px solid #666;
    border-radius: 3px;
    cursor: pointer;
    font-size: 12px;
  }
  .copy-button:hover {
    background: #666;
  }
  .copy-button i {
    margin-right: 4px;
  }
`;
document.head.appendChild(style);

// Execute the macro
showCriticalDialog(); 