// Pay the Price Oracle Table
const PAY_THE_PRICE_TABLE = {
  "1-2": {
    result: "Roll again and apply that result but make it worse. If you roll this result yet again, think of something dreadful that changes the course of your quest and make it happen.",
    range: [1, 2]
  },
  "3-5": {
    result: "A person or community you trusted loses faith in you, or acts against you.",
    range: [3, 5]
  },
  "6-9": {
    result: "A person or community you care about is exposed to danger.",
    range: [6, 9]
  },
  "10-16": {
    result: "You are separated from something or someone.",
    range: [10, 16]
  },
  "17-23": {
    result: "Your action has an unintended effect.",
    range: [17, 23]
  },
  "24-32": {
    result: "Something of value is lost or destroyed.",
    range: [24, 32]
  },
  "33-41": {
    result: "The current situation worsens.",
    range: [33, 41]
  },
  "42-50": {
    result: "A new danger or foe is revealed.",
    range: [42, 50]
  },
  "51-59": {
    result: "It causes a delay or puts you at a disadvantage.",
    range: [51, 59]
  },
  "60-68": {
    result: "It is harmful.",
    range: [60, 68]
  },
  "69-77": {
    result: "It is stressful.",
    range: [69, 77]
  },
  "78-85": {
    result: "A surprising development complicates your quest.",
    range: [78, 85]
  },
  "86-90": {
    result: "It wastes resources.",
    range: [86, 90]
  },
  "91-94": {
    result: "It forces you to act against your best intentions.",
    range: [91, 94]
  },
  "95-98": {
    result: "A friend, companion, or ally is put in harm's way (or you are, if alone).",
    range: [95, 98]
  },
  "99-100": {
    result: "Roll twice more on this table. Both results occur. If they are the same result, make it worse.",
    range: [99, 100]
  }
};

function getResult(roll) {
  for (let key in PAY_THE_PRICE_TABLE) {
    const range = PAY_THE_PRICE_TABLE[key].range;
    if (roll >= range[0] && roll <= range[1]) {
      return {
        text: PAY_THE_PRICE_TABLE[key].result,
        range: key
      };
    }
  }
  return null;
}

async function rollOnTable(rerollCount = 0) {
  const roll = new Roll("1d100");
  await roll.evaluate({async: true});
  
  const initialResult = getResult(roll.total);
  
  // Handle the special cases
  if (roll.total <= 2) {
    // If we've already rerolled twice, return something dreadful
    if (rerollCount >= 2) {
      return {
        roll: roll.total,
        range: "1-2",
        text: "Something dreadful changes the course of your quest...",
        details: "You've rolled 1-2 multiple times. Something truly dreadful happens that changes the course of your quest."
      };
    }
    // Otherwise, roll again and make it worse
    const worseResult = await rollOnTable(rerollCount + 1);
    return {
      roll: roll.total,
      range: "1-2",
      text: worseResult.text,
      details: `Original roll (${roll.total}): Make it worse.\nNew roll (${worseResult.roll}): ${worseResult.text}\nThis result should be interpreted as a worse version of the above.`
    };
  }
  
  // Handle double roll case (99-100)
  if (roll.total >= 99) {
    const result1 = await rollOnTable(rerollCount);
    const result2 = await rollOnTable(rerollCount);
    const areSame = result1.text === result2.text;
    
    return {
      roll: roll.total,
      range: "99-100",
      text: areSame ? result1.text : `${result1.text}\nAND\n${result2.text}`,
      details: areSame ? 
        `Rolled the same result twice: ${result1.text}\nThis result should be interpreted as a worse version of the above.` :
        `First Roll: ${result1.text}\nSecond Roll: ${result2.text}`
    };
  }
  
  // Normal case
  return {
    roll: roll.total,
    range: initialResult.range,
    text: initialResult.text
  };
}

async function payThePrice() {
  const result = await rollOnTable();
  
  const chatTemplate = `
    <section class="wwn chat-message">
      <div class="wwn chat-block">
        <div class="flexrow chat-header">
          <div class="chat-title">
            <h2>Pay the Price</h2>
          </div>
        </div>
        <div class="chat-details">
          <strong>Roll: ${result.roll} (${result.range})</strong>
        </div>
        <div class="roll-result">
          ${result.text}
        </div>
        ${result.details ? `<div class="chat-details">${result.details}</div>` : ''}
      </div>
    </section>
  `;
  
  ChatMessage.create({
    user: game.user.id,
    speaker: ChatMessage.getSpeaker(),
    content: chatTemplate,
    type: CONST.CHAT_MESSAGE_TYPES.OTHER
  });
}

// Execute the macro
payThePrice(); 