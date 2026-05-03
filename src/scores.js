const KEYS = {
  total: 'ws_totalStars',
  bestBeginner: 'ws_best_beginner',
  bestAdvanced: 'ws_best_advanced',
  played: 'ws_gamesPlayed',
  bestStreak: 'ws_bestStreak',
  currentStreak: 'ws_currentStreak',
};

export function loadStats() {
  return {
    totalStars: parseInt(localStorage.getItem(KEYS.total) || '0', 10),
    bestTime: {
      beginner: parseFloat(localStorage.getItem(KEYS.bestBeginner) || 'Infinity'),
      advanced: parseFloat(localStorage.getItem(KEYS.bestAdvanced) || 'Infinity'),
    },
    gamesPlayed: parseInt(localStorage.getItem(KEYS.played) || '0', 10),
    bestStreak: parseInt(localStorage.getItem(KEYS.bestStreak) || '0', 10),
    currentStreak: parseInt(localStorage.getItem(KEYS.currentStreak) || '0', 10),
  };
}

export function saveGameResult({ level, elapsedSeconds, score, stars }) {
  const stats = loadStats();
  stats.totalStars += score;
  stats.gamesPlayed += 1;

  const isNewBestTime = elapsedSeconds < stats.bestTime[level];
  if (isNewBestTime) stats.bestTime[level] = elapsedSeconds;

  if (stars === 3) {
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.bestStreak) stats.bestStreak = stats.currentStreak;
  } else {
    stats.currentStreak = 0;
  }

  localStorage.setItem(KEYS.total, stats.totalStars);
  localStorage.setItem(KEYS.bestBeginner, stats.bestTime.beginner);
  localStorage.setItem(KEYS.bestAdvanced, stats.bestTime.advanced);
  localStorage.setItem(KEYS.played, stats.gamesPlayed);
  localStorage.setItem(KEYS.bestStreak, stats.bestStreak);
  localStorage.setItem(KEYS.currentStreak, stats.currentStreak);

  return { ...stats, isNewBestTime };
}

export function calcWordScore(wordLength, secondsSinceLastFind) {
  const base = wordLength * 10;
  const multiplier = secondsSinceLastFind <= 10 ? 2.0 : secondsSinceLastFind <= 20 ? 1.5 : 1.0;
  return Math.round((base * multiplier) / 5) * 5;
}
