import beginner from './data/beginner.json';
import advanced from './data/advanced.json';

const LIBRARIES = { beginner, advanced };

const CONFIG = {
  beginner: { gridSize: 7, wordCount: 7 },
  advanced: { gridSize: 12, wordCount: 8 },
};

const DIRECTIONS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

export function startNewGame(level) {
  const library = LIBRARIES[level];
  const { gridSize, wordCount } = CONFIG[level];
  const themes = Object.keys(library);
  const theme = themes[Math.floor(Math.random() * themes.length)];
  const pool = library[theme].filter((w) => w.length <= gridSize);
  const words = pickRandom(pool, wordCount);
  const { letters, placed } = generatePuzzle(words, gridSize);
  return { theme, letters, words: placed };
}

function pickRandom(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}

const DIR_GROUPS = [
  [[0, 1], [0, -1]],                                           // horizontal
  [[1, 0], [-1, 0]],                                           // vertical
  [[1, 1], [1, -1], [-1, 1], [-1, -1]],                       // diagonal
];

function generatePuzzle(words, size) {
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const placed = [];
  const sorted = [...words].sort((a, b) => b.length - a.length);
  let groupIdx = 0;
  for (const word of sorted) {
    const dirs = DIR_GROUPS[groupIdx % DIR_GROUPS.length];
    groupIdx++;
    if (tryPlace(grid, word, size, dirs)) placed.push(word);
  }
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === null) {
        grid[r][c] = String.fromCharCode(65 + Math.floor(Math.random() * 26));
      }
    }
  }
  return { letters: grid, placed };
}

function tryPlace(grid, word, size, dirs, maxAttempts = 80) {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [dr, dc] = dirs[Math.floor(Math.random() * dirs.length)];
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    const endR = r + dr * (word.length - 1);
    const endC = c + dc * (word.length - 1);
    if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

    let conflict = false;
    for (let k = 0; k < word.length; k++) {
      const cell = grid[r + dr * k][c + dc * k];
      if (cell !== null && cell !== word[k]) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    for (let k = 0; k < word.length; k++) {
      grid[r + dr * k][c + dc * k] = word[k];
    }
    return true;
  }
  // Fallback: try all 8 directions
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const [dr, dc] = DIRECTIONS[Math.floor(Math.random() * DIRECTIONS.length)];
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    const endR = r + dr * (word.length - 1);
    const endC = c + dc * (word.length - 1);
    if (endR < 0 || endR >= size || endC < 0 || endC >= size) continue;

    let conflict = false;
    for (let k = 0; k < word.length; k++) {
      const cell = grid[r + dr * k][c + dc * k];
      if (cell !== null && cell !== word[k]) {
        conflict = true;
        break;
      }
    }
    if (conflict) continue;

    for (let k = 0; k < word.length; k++) {
      grid[r + dr * k][c + dc * k] = word[k];
    }
    return true;
  }
  return false;
}
