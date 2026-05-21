/** Mỗi cặp: server chọn ngẫu nhiên 1 trong 2 khi bắt đầu (đáp án) */
const NUMBER_PAIRS = [
  [1, 2],
  [3, 4],
  [5, 6],
  [7, 8],
  [9, 10],
  [11, 12],
];

const MAX_NUMBER = 12;
const COPIES_PER_VALUE = 2;
const DECK_SIZE = MAX_NUMBER * COPIES_PER_VALUE;
const MAX_PLAYERS = 6;
const NUMBERS_PER_PLAYER = 3;
const PAIR_COUNT = NUMBER_PAIRS.length;

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildDeck() {
  const deck = [];
  for (let value = 1; value <= MAX_NUMBER; value++) {
    deck.push(value, value);
  }
  return shuffle(deck);
}

function removeOneCard(deck, value) {
  const index = deck.indexOf(value);
  if (index === -1) return false;
  deck.splice(index, 1);
  return true;
}

function dealGame(playerIds) {
  if (playerIds.length !== MAX_PLAYERS) {
    throw new Error(`Cần đúng ${MAX_PLAYERS} người chơi`);
  }

  const deck = buildDeck();
  const answerKey = [];

  for (const pair of NUMBER_PAIRS) {
    const value = pickRandom(pair);
    answerKey.push(value);
    if (!removeOneCard(deck, value)) {
      throw new Error(`Không còn lá số ${value} trong bộ bài`);
    }
  }

  const shuffled = shuffle(deck);
  const assignments = {};

  for (let i = 0; i < MAX_PLAYERS; i++) {
    assignments[playerIds[i]] = shuffled
      .slice(i * NUMBERS_PER_PLAYER, (i + 1) * NUMBERS_PER_PLAYER)
      .sort((a, b) => a - b);
  }

  return { answerKey, assignments };
}

function validateGuesses(guesses) {
  if (!Array.isArray(guesses) || guesses.length !== PAIR_COUNT) {
    return false;
  }
  for (let i = 0; i < PAIR_COUNT; i++) {
    const [a, b] = NUMBER_PAIRS[i];
    if (guesses[i] !== a && guesses[i] !== b) return false;
  }
  return true;
}

function scoreGuesses(guesses, answerKey) {
  let correctCount = 0;
  for (let i = 0; i < PAIR_COUNT; i++) {
    if (guesses[i] === answerKey[i]) correctCount++;
  }
  return correctCount;
}

module.exports = {
  NUMBER_PAIRS,
  PAIR_COUNT,
  MAX_NUMBER,
  COPIES_PER_VALUE,
  DECK_SIZE,
  MAX_PLAYERS,
  NUMBERS_PER_PLAYER,
  dealGame,
  validateGuesses,
  scoreGuesses,
};
