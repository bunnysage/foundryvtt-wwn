// Mythras Hit Location Table
const HIT_LOCATION_TABLE = {
  "1-3": {
    result: "Right Leg",
    range: [1, 3],
    details: "Includes right hip and thigh"
  },
  "4-6": {
    result: "Left Leg",
    range: [4, 6],
    details: "Includes left hip and thigh"
  },
  "7-9": {
    result: "Abdomen",
    range: [7, 9],
    details: "Includes groin and lower torso"
  },
  "10-12": {
    result: "Chest",
    range: [10, 12],
    details: "Includes upper torso and back"
  },
  "13-15": {
    result: "Right Arm",
    range: [13, 15],
    details: "Includes right shoulder"
  },
  "16-18": {
    result: "Left Arm",
    range: [16, 18],
    details: "Includes left shoulder"
  },
  "19-20": {
    result: "Head",
    range: [19, 20],
    details: "Includes neck"
  }
};

function getLocation(roll) {
  for (let key in HIT_LOCATION_TABLE) {
    const range = HIT_LOCATION_TABLE[key].range;
    if (roll >= range[0] && roll <= range[1]) {
      return {
        location: HIT_LOCATION_TABLE[key].result,
        range: key,
        details: HIT_LOCATION_TABLE[key].details
      };
    }
  }
  return null;
}

async function rollHitLocation() {
  const roll = new Roll("1d20");
  await roll.evaluate({async: true});
  
  const result = getLocation(roll.total);
  
  const chatTemplate = `
    <section class="wwn chat-message">
      <div class="wwn chat-block">
        <div class="flexrow chat-header">
          <div class="chat-title">
            <h2>Hit Location</h2>
          </div>
        </div>
        <div class="chat-details">
          <strong>Roll: ${roll.total} (${result.range})</strong>
        </div>
        <div class="roll-result">
          <h3>${result.location}</h3>
          <div class="hit-details">${result.details}</div>
        </div>
      </div>
    </section>
  `;
  
  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker(),
    content: chatTemplate,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER,
    flavor: `Hit Location Roll`
  });
}

// Execute the macro
rollHitLocation(); 