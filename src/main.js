import { startNewGame } from './logic.js';
import { renderGrid, renderWordList, setFound, markFoundCells, showCongrats, showStats } from './view.js';
import { loadStats, saveGameResult, calcWordScore } from './scores.js';
import { LEVELS } from './config.js';
import * as sound from './sound.js';

let currentLevel = 'beginner';
let paused = false;

const state = {
  letters: [], words: [], found: [], theme: '',
  startTime: 0, timerInterval: null,
  currentScore: 0, lastFindTime: 0,
  elapsedAtPause: 0,
};

const gridEl        = document.getElementById('grid');
const wordListEl    = document.getElementById('words');
const themeDisplayEl = document.getElementById('themeDisplay');
const timerEl       = document.getElementById('timerDisplay');
const scoreEl       = document.getElementById('scoreDisplay');
const newGameBtn    = document.getElementById('newGame');
const statsBtnEl    = document.getElementById('statsBtn');
const pauseBtnEl    = document.getElementById('pauseBtn');
const muteBtnEl     = document.getElementById('muteBtn');
const bgmBtnEl      = document.getElementById('bgmBtn');
const levelBtns     = document.querySelectorAll('.level-btn');

function formatTime(secs) {
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

function startTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.startTime = Date.now();
  state.lastFindTime = Date.now();
  state.elapsedAtPause = 0;
  paused = false;
  pauseBtnEl.classList.remove('is-paused');
  gridEl.classList.remove('paused');
  timerEl.textContent = '0:00';
  state.timerInterval = setInterval(() => {
    const elapsed = (Date.now() - state.startTime) / 1000;
    timerEl.textContent = formatTime(elapsed);
    const remaining = (LEVELS[currentLevel]?.gold ?? Infinity) - elapsed;
    if (remaining > 0 && remaining <= 10) sound.playTimerTick();
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) clearInterval(state.timerInterval);
  state.timerInterval = null;
  return state.elapsedAtPause + (Date.now() - state.startTime) / 1000;
}

function togglePause() {
  if (state.words.length === 0) return;
  sound.resume();
  paused = !paused;
  pauseBtnEl.classList.toggle('is-paused', paused);
  gridEl.classList.toggle('paused', paused);
  if (paused) {
    sound.playPause();
    sound.pauseBGM();
    state.elapsedAtPause += (Date.now() - state.startTime) / 1000;
    state.pauseStart = Date.now();
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  } else {
    sound.playResume();
    sound.resumeBGM();
    const pauseMs = Date.now() - state.pauseStart;
    state.lastFindTime += pauseMs;
    state.startTime = Date.now();
    state.timerInterval = setInterval(() => {
      const elapsed = state.elapsedAtPause + (Date.now() - state.startTime) / 1000;
      timerEl.textContent = formatTime(elapsed);
      const remaining = (LEVELS[currentLevel]?.gold ?? Infinity) - elapsed;
      if (remaining > 0 && remaining <= 10) sound.playTimerTick();
    }, 1000);
  }
}

function computeStars(level, secs) {
  const { gold, silver } = LEVELS[level] ?? LEVELS.advanced;
  return secs <= gold ? 3 : secs <= silver ? 2 : 1;
}

function newGame(level) {
  if (paused) togglePause();
  const { theme, letters, words } = startNewGame(level);
  state.letters = letters;
  state.words = words;
  state.found = [];
  state.theme = theme;
  state.currentScore = 0;
  gridEl.className = 'grid ' + level;
  themeDisplayEl.textContent = theme;
  scoreEl.textContent = '⭐ 0';
  renderGrid(gridEl, letters);
  renderWordList(wordListEl, words);
  startTimer();
  sound.resume();
  sound.playNewGame();
  sound.startBGM();
}

function onWordFound(word, color) {
  sound.resume();
  sound.playWordFound();
  state.found.push(word);

  const secondsSinceLast = (Date.now() - state.lastFindTime) / 1000;
  state.lastFindTime = Date.now();
  const pts = calcWordScore(word.length, secondsSinceLast);
  state.currentScore += pts;
  scoreEl.textContent = `⭐ ${state.currentScore}`;

  setFound(wordListEl, word, color, currentLevel);

  if (state.found.length === state.words.length) {
    sound.stopBGM();
    const elapsedSeconds = stopTimer();
    timerEl.textContent = formatTime(elapsedSeconds);
    const stars = computeStars(currentLevel, elapsedSeconds);
    const savedStats = saveGameResult({ level: currentLevel, elapsedSeconds, score: state.currentScore, stars });
    setTimeout(() => sound.playGameComplete(), 400);
    setTimeout(() => showCongrats(
      () => newGame(currentLevel),
      { level: currentLevel, elapsedSeconds, score: state.currentScore, stars, savedStats }
    ), 350);
  }
}

gridEl.addEventListener('cellselect', (e) => {
  const { word, cells } = e.detail;
  const rev = word.split('').reverse().join('');
  if (!word) return;
  const match = state.words.includes(word) ? word : state.words.includes(rev) ? rev : null;
  if (!match || state.found.includes(match)) {
    sound.resume();
    sound.playInvalid();
    return;
  }
  const color = markFoundCells(cells);
  onWordFound(match, color);
});

levelBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const level = btn.dataset.level;
    if (level === currentLevel) return;
    currentLevel = level;
    levelBtns.forEach((b) => b.classList.toggle('active', b.dataset.level === level));
    newGame(level);
  });
});

newGameBtn.addEventListener('click', () => newGame(currentLevel));
statsBtnEl.addEventListener('click', () => {
  sound.resume();
  sound.playButtonClick();
  showStats(loadStats());
});
pauseBtnEl.addEventListener('click', togglePause);
muteBtnEl.addEventListener('click', () => {
  sound.toggleMute();
  muteBtnEl.classList.toggle('is-muted', sound.isMuted());
});
bgmBtnEl.addEventListener('click', () => {
  sound.resume();
  sound.toggleBGM();
  bgmBtnEl.classList.toggle('is-off', !sound.isBGMOn());
});

muteBtnEl.classList.toggle('is-muted', sound.isMuted());
bgmBtnEl.classList.toggle('is-off', !sound.isBGMOn());
newGame(currentLevel);
