const assert = require("assert");
const {
  dealGame,
  validateGuesses,
  scoreGuesses,
  NUMBER_PAIRS,
} = require("./game");

const ids = ["a", "b", "c", "d", "e", "f"];
const { answerKey, assignments } = dealGame(ids);

assert.strictEqual(answerKey.length, 6);
for (let i = 0; i < NUMBER_PAIRS.length; i++) {
  const [a, b] = NUMBER_PAIRS[i];
  assert.ok(answerKey[i] === a || answerKey[i] === b);
}

assert.ok(validateGuesses([1, 3, 5, 7, 9, 11]));
assert.strictEqual(scoreGuesses(answerKey, answerKey), 6);

const wrong = answerKey.map((v, i) =>
  v === NUMBER_PAIRS[i][0] ? NUMBER_PAIRS[i][1] : NUMBER_PAIRS[i][0],
);
assert.strictEqual(scoreGuesses(wrong, answerKey), 0);

for (const id of ids) {
  assert.strictEqual(assignments[id].length, 3);
}

console.log("game.test.js OK");
