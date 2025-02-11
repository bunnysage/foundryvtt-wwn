const dialogContent = `
  <div style="padding: 10px;">
    <label for="addValue" style="display: block; margin-bottom: 5px;">Enter Add value for d6:</label>
    <input type="number" id="addValue" name="addValue" value="0" 
           style="width: 100%; margin-bottom: 10px; padding: 5px;"
           min="0" max="10" step="1">
  </div>
`;

new Dialog({
  title: "Ironsworn Action Roll",
  content: dialogContent,
  buttons: {
    roll: {
      label: "Roll!",
      callback: async (html) => {
        const addValue = parseInt(html.find('#addValue').val());
        
        // Create all dice rolls
        const actionRoll = new Roll(`1d6 + ${addValue}`);
        const challengeDie1 = new Roll("1d10");
        const challengeDie2 = new Roll("1d10");

        // Evaluate all rolls
        await Promise.all([
          actionRoll.evaluate({async: true}),
          challengeDie1.evaluate({async: true}),
          challengeDie2.evaluate({async: true})
        ]);

        // Build result message
        const messageContent = `
          <h2>IronSworn Action Roll</h2>
          <p><strong>Action Die (d6 + ${addValue}):</strong> 
             ${actionRoll.result} = ${actionRoll.total}</p>
          <p><strong>Challenge Dice:</strong> 
             ${challengeDie1.total} and ${challengeDie2.total}</p>
          <hr>
          <p>${getOutcomeText(actionRoll.total, challengeDie1.total, challengeDie2.total)}</p>
        `;

        // Send to chat
        ChatMessage.create({
          content: messageContent,
          speaker: ChatMessage.getSpeaker(),
          rolls: [actionRoll, challengeDie1, challengeDie2]
        });
      }
    }
  }
}).render(true);

function getOutcomeText(actionTotal, challenge1, challenge2) {
  const matches = actionTotal === challenge1 || actionTotal === challenge2;
  const success = actionTotal > challenge1 && actionTotal > challenge2;
  const partial = actionTotal > Math.min(challenge1, challenge2);
  
  if (matches) return "<strong>Critical!</strong> Exceptional success";
  if (success) return "<strong>Strong Hit:</strong> Full success";
  if (partial) return "<strong>Weak Hit:</strong> Complication or cost";
  return "<strong>Miss:</strong> Face danger";
} 