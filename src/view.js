import { FOUND_COLORS, CONFETTI_COLORS, STATS_CARD_BGS } from './constants.js';
import * as sound from './sound.js';

let selecting = false;
let firstCell = null;
let lineCells = [];
let foundColorIdx = 0;
let activeGrid = null;
let _noteIndex = 0;       // position in C-major scale, persists across brief lifts
let _prevLen = 0;         // previous lineCells.length, resets each onStart
let _soundResetTimer = null;

function getCellEls(grid) {
  return Array.from(grid.querySelectorAll('.cell'));
}

export function renderGrid(container, letters) {
  selecting = false;
  firstCell = null;
  activeGrid = container;
  _noteIndex = 0;
  _prevLen = 0;
  if (_soundResetTimer) { clearTimeout(_soundResetTimer); _soundResetTimer = null; }
  clearLine();
  const cols = letters[0].length;
  container.style.setProperty('--cols', cols);
  container.replaceChildren(
    ...letters.flat().map((ch, i) => {
      const cell = document.createElement('div');
      cell.className = 'cell';
      cell.textContent = ch;
      cell.dataset.row = Math.floor(i / cols);
      cell.dataset.col = i % cols;
      return cell;
    }),
  );
  foundColorIdx = 0;
  bindEvents(container);
}

export function renderWordList(container, words) {
  const items = words.map((word) => {
    const li = document.createElement('li');
    li.className = 'word';
    li.textContent = word;
    li.dataset.word = word;
    return li;
  });
  container.replaceChildren(...items);
}

const KID_EMOJIS = ['⭐', '🌟', '✨', '🎉'];

function showWordFoundFx(el, level) {
  const fx = document.createElement('span');
  fx.className = 'word-found-fx';
  fx.textContent = level === 'beginner'
    ? KID_EMOJIS[Math.floor(Math.random() * KID_EMOJIS.length)]
    : '✓';
  fx.style.fontSize = level === 'beginner' ? '28px' : '18px';
  el.style.position = 'relative';
  el.appendChild(fx);
  fx.addEventListener('animationend', () => fx.remove(), { once: true });
}

export function setFound(container, word, color, level) {
  const el = container.querySelector(`[data-word="${word}"]`);
  if (el) {
    el.classList.add('found');
    el.style.background = color.cell;
    el.style.color = color.text;
    showWordFoundFx(el, level);
  }
}

export function markFoundCells(cells) {
  const color = FOUND_COLORS[foundColorIdx % FOUND_COLORS.length];
  foundColorIdx++;
  cells.forEach((c) => {
    c.classList.remove('selected');
    c.classList.add('found-word');
    c.style.background = color.cell;
    c.style.color = color.text;
  });
  return color;
}

function clearLine() {
  const targets = activeGrid
    ? activeGrid.querySelectorAll('.cell.selected')
    : lineCells;
  targets.forEach((c) => c.classList.remove('selected'));
  lineCells = [];
}

const DIRS = [
  [0, 1],
  [1, 0],
  [1, 1],
  [1, -1],
  [0, -1],
  [-1, 0],
  [-1, -1],
  [-1, 1],
];

function snapDir(dr, dc) {
  const mag = Math.sqrt(dr * dr + dc * dc);
  if (mag === 0) return DIRS[0];
  const ndr = dr / mag;
  const ndc = dc / mag;
  let best = DIRS[0];
  let bestDot = -Infinity;
  for (const [r, c] of DIRS) {
    const dmag = Math.sqrt(r * r + c * c);
    const dot = (ndr * r + ndc * c) / dmag;
    if (dot > bestDot) {
      bestDot = dot;
      best = [r, c];
    }
  }
  return best;
}

function traceLine(grid, start, dir) {
  const cells = [];
  const allCells = getCellEls(grid);
  const cols = parseInt(grid.style.getPropertyValue('--cols'), 10);
  const rows = Math.ceil(allCells.length / cols);
  let r = parseInt(start.dataset.row, 10);
  let c = parseInt(start.dataset.col, 10);
  while (r >= 0 && r < rows && c >= 0 && c < cols) {
    const cell = allCells[r * cols + c];
    if (!cell) break;
    cells.push(cell);
    r += dir[0];
    c += dir[1];
  }
  return cells;
}

let eventsBound = false;

function bindEvents(grid) {
  if (eventsBound) return;
  eventsBound = true;
  grid.addEventListener('mousedown', onStart);
  grid.addEventListener('touchstart', onStart, { passive: false });
  document.addEventListener('mousemove', onMove);
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('mouseup', onEnd);
  document.addEventListener('touchend', onEnd);
}

function onStart(e) {
  e.preventDefault();
  sound.resume();
  if (_soundResetTimer) {
    // Brief lift — maintain continuity, don't reset note sequence
    clearTimeout(_soundResetTimer);
    _soundResetTimer = null;
  } else {
    _noteIndex = 0; // New drag, start from do
  }
  selecting = true;
  _prevLen = 0;
  clearLine();
  const cell = e.target.closest('.cell');
  if (!cell) {
    _noteIndex = 0;
    return;
  }
  firstCell = cell;
  // Play do immediately on first touch of a new drag
  if (_noteIndex === 0) {
    sound.playCellSelect(0);
    _noteIndex = 1;
    _prevLen = 1; // prevent onMove from re-playing the first cell
  }
}

function cellFromPoint(x, y) {
  const els = document.elementsFromPoint(x, y);
  return els.find((e) => e.classList.contains('cell')) || null;
}

function highlightSelection(cells) {
  cells.forEach((c) => c.classList.add('selected'));
}

function onMove(e) {
  if (!selecting) return;
  e.preventDefault();
  const touch = e.touches ? e.touches[0] : e;
  const el = cellFromPoint(touch.clientX, touch.clientY);
  if (!el || el.parentElement !== firstCell.parentElement) return;

  const dr = parseInt(el.dataset.row, 10) - parseInt(firstCell.dataset.row, 10);
  const dc = parseInt(el.dataset.col, 10) - parseInt(firstCell.dataset.col, 10);

  if (dr === 0 && dc === 0) {
    clearLine();
    lineCells = [firstCell];
    highlightSelection(lineCells);
    while (_prevLen < lineCells.length) {
      sound.playCellSelect(_noteIndex);
      _noteIndex++;
      _prevLen++;
    }
    return;
  }

  const dir = snapDir(dr, dc);
  const fullLine = traceLine(firstCell.parentElement, firstCell, dir);
  const idx = fullLine.findIndex(
    (c) => c.dataset.row === el.dataset.row && c.dataset.col === el.dataset.col,
  );
  // Current cell must lie on the snapped line — otherwise skip
  if (idx < 0) return;

  clearLine();
  lineCells = fullLine.slice(0, idx + 1);
  highlightSelection(lineCells);
  while (_prevLen < lineCells.length) {
    sound.playCellSelect(_noteIndex);
    _noteIndex++;
    _prevLen++;
  }
}

function fmtTime(secs) {
  if (!isFinite(secs)) return '—';
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function showStats(stats) {
  const existing = document.querySelector('.stats-overlay');
  if (existing) { existing.remove(); return; }

  const { totalStars, gamesPlayed, bestTime, bestStreak, currentStreak } = stats;

  const cards = [
    { icon: '🎮', label: 'Games Played',   value: gamesPlayed,                              color: STATS_CARD_BGS[0] },
    { icon: '⭐', label: 'Total Stars',    value: totalStars,                               color: STATS_CARD_BGS[1] },
    { icon: '🏆', label: 'Best · Beginner', value: fmtTime(bestTime.beginner),             color: STATS_CARD_BGS[2] },
    { icon: '🏆', label: 'Best · Advanced', value: fmtTime(bestTime.advanced),             color: STATS_CARD_BGS[3] },
    { icon: '🔥', label: 'Best Streak',    value: bestStreak ? `${bestStreak}×` : '—',     color: STATS_CARD_BGS[4] },
    { icon: '⚡', label: 'Current Streak', value: currentStreak ? `${currentStreak}×` : '—', color: STATS_CARD_BGS[5] },
  ];

  const overlay = document.createElement('div');
  overlay.className = 'stats-overlay';
  overlay.innerHTML = `
    <div class="stats-panel">
      <div class="stats-banner">
        <span class="stats-banner-icon">📊</span>
        <h2 class="stats-title">Your Stats</h2>
        <button class="stats-close" aria-label="Close">✕</button>
      </div>
      <div class="stats-grid">
        ${cards.map(c => `
          <div class="stat-card" style="background:${c.color}">
            <span class="stat-card-icon">${c.icon}</span>
            <span class="stat-card-value">${c.value}</span>
            <span class="stat-card-label">${c.label}</span>
          </div>`).join('')}
      </div>
    </div>
  `;

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.classList.add('leaving');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
  };
  overlay.querySelector('.stats-close').addEventListener('click', close);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', onKey);
  document.body.appendChild(overlay);
  overlay.querySelector('.stats-close').focus();
}

export function showCongrats(onClose, { level = 'beginner', elapsedSeconds = 0, score = 0, stars = 1, savedStats = {} } = {}) {
  const existing = document.querySelector('.celebrate-overlay');
  if (existing) existing.remove();

  const isKid = level === 'beginner';
  const { totalStars = 0, gamesPlayed = 0, currentStreak = 0, isNewBestTime = false } = savedStats;

  const overlay = document.createElement('div');
  overlay.className = 'celebrate-overlay';

  const confettiCount = isKid ? 100 : 40;
  for (let i = 0; i < confettiCount; i++) {
    const piece = document.createElement('div');
    piece.className = 'confetti';
    piece.style.left = Math.random() * 100 + 'vw';
    piece.style.background = CONFETTI_COLORS[i % CONFETTI_COLORS.length];
    piece.style.width = 6 + Math.random() * 8 + 'px';
    piece.style.height = 10 + Math.random() * 8 + 'px';
    piece.style.animationDuration = (isKid ? 2 : 3) + Math.random() * 2 + 's';
    piece.style.animationDelay = Math.random() * 0.6 + 's';
    if (Math.random() < 0.3) piece.style.borderRadius = '50%';
    overlay.appendChild(piece);
  }

  const starsHtml = [1, 2, 3].map(n =>
    `<span class="star ${n <= stars ? 'filled' : 'empty'}">★</span>`
  ).join('');

  const badgesHtml = [
    isNewBestTime ? `<span class="reward-badge">🏆 New best time!</span>` : '',
    currentStreak >= 2 ? `<span class="reward-badge">🔥 ${currentStreak}-game streak!</span>` : '',
  ].filter(Boolean).join('');

  const card = document.createElement('div');
  card.className = `celebrate-card${isKid ? ' kids' : ''}`;
  card.innerHTML = `
    <div class="celebrate-thumb" aria-hidden="true">${isKid ? '🎉' : '👏'}</div>
    <h2 class="celebrate-title">${isKid ? 'Amazing!' : 'Well done.'}</h2>
    <div class="celebrate-stars">${starsHtml}</div>
    <p class="celebrate-sub">${isKid ? 'You found all the words!' : `Completed in ${fmtTime(elapsedSeconds)}`}</p>
    <div class="reward-score">
      <span class="reward-score-game">⭐ ${score}</span>
      <span class="reward-score-total">Total ⭐ ${totalStars} · ${gamesPlayed} games</span>
    </div>
    ${badgesHtml}
    <button class="celebrate-btn" type="button">Play Again</button>
  `;
  overlay.appendChild(card);

  const onKey = (e) => { if (e.key === 'Escape') close(); };
  const close = () => {
    document.removeEventListener('keydown', onKey);
    overlay.classList.add('leaving');
    overlay.addEventListener('animationend', () => overlay.remove(), { once: true });
    if (onClose) onClose();
  };
  card.querySelector('.celebrate-btn').addEventListener('click', close);
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener('keydown', onKey);

  document.body.appendChild(overlay);
  card.querySelector('.celebrate-btn').focus();
}

function onEnd() {
  if (!selecting) return;
  selecting = false;
  if (lineCells.length < 2) {
    clearLine();
    firstCell = null;
    // Brief lift with no selection — wait 300ms before resetting sound
    if (_soundResetTimer) clearTimeout(_soundResetTimer);
    _soundResetTimer = setTimeout(() => { _noteIndex = 0; }, 300);
    return;
  }
  const word = lineCells.map((c) => c.textContent).join('');
  const cells = [...lineCells];
  const grid = firstCell.parentElement;
  clearLine();
  firstCell = null;
  // Delay submission 300ms — if user touches down again, cancel and continue
  if (_soundResetTimer) clearTimeout(_soundResetTimer);
  _soundResetTimer = setTimeout(() => {
    grid.dispatchEvent(
      new CustomEvent('cellselect', { detail: { word, cells } }),
    );
    _noteIndex = 0;
    _soundResetTimer = null;
  }, 300);
}
