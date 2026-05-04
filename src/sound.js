let _ctx = null;
let _muted = false;

try {
  _muted = localStorage.getItem('ws_sound_muted') === '1';
} catch (_) { /* localStorage unavailable */ }

function getContext() {
  if (_ctx) return _ctx;
  try {
    _ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (_) {
    return null;
  }
  return _ctx;
}

let _bgmPending = false;

export function resume() {
  const ctx = getContext();
  if (ctx && ctx.state === 'suspended') ctx.resume();
  // Once AudioContext is running, start deferred BGM
  if (_bgmPending && ctx && ctx.state === 'running' && !_muted && _bgmOn) {
    _bgmPending = false;
    _startBGMNode();
  }
  // If BGM was paused (source stopped) but should be playing, restart it
  if (_bgmStarted && !_muted && _bgmOn && ctx && ctx.state === 'running' && !_bgmSource) {
    _startBGMNode();
  }
}

export function isMuted() {
  return _muted;
}

export function toggleMute() {
  _muted = !_muted;
  try { localStorage.setItem('ws_sound_muted', _muted ? '1' : '0'); } catch (_) {}
  if (_muted) {
    if (_bgmGain) _bgmGain.gain.value = 0;
  } else {
    if (_bgmGain) _bgmGain.gain.value = 0.12;
    else if (_bgmOn) startBGM();
  }
}

function playTone(freq, duration, type, volume, delay) {
  if (_muted) return;
  const ctx = getContext();
  if (!ctx || ctx.state === 'suspended') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, ctx.currentTime + delay);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(ctx.currentTime + delay);
  osc.stop(ctx.currentTime + delay + duration + 0.01);
}

function playSweep(f1, f2, duration, type, volume) {
  if (_muted) return;
  const ctx = getContext();
  if (!ctx || ctx.state === 'suspended') return;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f1, ctx.currentTime);
  osc.frequency.linearRampToValueAtTime(f2, ctx.currentTime + duration);
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration + 0.01);
}

function playNoise(duration, volume) {
  if (_muted) return;
  const ctx = getContext();
  if (!ctx || ctx.state === 'suspended') return;
  const buf = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  const gain = ctx.createGain();
  src.buffer = buf;
  gain.gain.setValueAtTime(volume, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  src.connect(gain).connect(ctx.destination);
  src.start();
}

export function playWordFound() {
  playTone(523, 0.12, 'sine', 0.10, 0);
  playTone(659, 0.12, 'sine', 0.10, 0.08);
  playTone(784, 0.18, 'sine', 0.08, 0.16);
}

export function playInvalid() {
  playTone(180, 0.08, 'sawtooth', 0.03, 0);
  playTone(150, 0.10, 'sawtooth', 0.02, 0.06);
}

export function playGameComplete() {
  playTone(523, 0.16, 'sine', 0.10, 0);
  playTone(587, 0.16, 'sine', 0.10, 0.12);
  playTone(659, 0.16, 'sine', 0.10, 0.24);
  playTone(784, 0.16, 'sine', 0.10, 0.36);
  playTone(1047, 0.30, 'sine', 0.12, 0.48);
}

export function playNewGame() {
  playSweep(300, 700, 0.20, 'sine', 0.06);
}

export function playPause() {
  playTone(659, 0.10, 'sine', 0.05, 0);
  playTone(523, 0.12, 'sine', 0.04, 0.08);
}

export function playResume() {
  playTone(523, 0.10, 'sine', 0.05, 0);
  playTone(659, 0.12, 'sine', 0.04, 0.08);
}

export function playButtonClick() {
  playNoise(0.03, 0.03);
}

// C major scale: do re mi fa so la ti  (C4 through C6)
const C_MAJOR = [
  261.63, 293.66, 329.63, 349.23, 392.00, 440.00, 493.88, // C4..B4
  523.25, 587.33, 659.25, 698.46, 783.99, 880.00, 987.77, // C5..B5
  1046.50, 1174.66, 1318.51, 1396.91, 1567.98, 1760.00, 1975.53, // C6..B6
];

// Additive piano synthesis: fundamental + 4 harmonics with natural decay envelopes
function playPianoNote(freq, volume) {
  if (_muted) return;
  const ctx = getContext();
  if (!ctx || ctx.state === 'suspended') return;

  const now = ctx.currentTime;

  // Harmonics: [multiplier, relative gain, decay duration]
  const harmonics = [
    [1.000, 1.00, 0.70],  // fundamental — loudest, longest sustain
    [2.000, 0.40, 0.45],  // 2nd harmonic
    [3.003, 0.18, 0.25],  // 3rd harmonic (slightly inharmonic ~1.7 cents sharp)
    [4.005, 0.08, 0.15],  // 4th harmonic
    [5.008, 0.04, 0.08],  // 5th harmonic
  ];

  harmonics.forEach(([mult, relGain, decay]) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq * mult;
    const v = volume * relGain;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(v, now + 0.003); // sharp hammer attack
    gain.gain.exponentialRampToValueAtTime(0.001, now + decay);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + decay + 0.01);
  });

  // Subtle hammer noise at the start
  const hammerLen = 0.008;
  const buf = ctx.createBuffer(1, ctx.sampleRate * hammerLen, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.002));
  }
  const src = ctx.createBufferSource();
  const hGain = ctx.createGain();
  src.buffer = buf;
  hGain.gain.setValueAtTime(volume * 0.15, now);
  hGain.gain.exponentialRampToValueAtTime(0.001, now + hammerLen);
  src.connect(hGain).connect(ctx.destination);
  src.start(now);
}

export function playCellSelect(index) {
  const freq = C_MAJOR[index % C_MAJOR.length];
  const octave = Math.floor(index / C_MAJOR.length);
  playPianoNote(freq * Math.pow(2, octave), 0.35);
}

export function playTimerTick() {
  playTone(1000, 0.02, 'triangle', 0.02, 0);
}

// ── Background Music (Web Audio API) ──────────────────────────────

let _bgmOn = true;
let _bgmStarted = false;
let _bgmBuffer = null;
let _bgmSource = null;
let _bgmGain = null;
let _bgmLoading = false;

try {
  _bgmOn = localStorage.getItem('ws_bgm_on') !== '0';
} catch (_) {}

async function _loadBGMBuffer() {
  if (_bgmBuffer) return _bgmBuffer;
  if (_bgmLoading) return null;
  _bgmLoading = true;
  try {
    const ctx = getContext();
    if (!ctx) return null;
    const resp = await fetch(import.meta.env.BASE_URL + 'clavier-music-passacaglia-204294.mp3');
    if (!resp.ok) throw new Error('BGM fetch failed');
    const arrayBuf = await resp.arrayBuffer();
    _bgmBuffer = await ctx.decodeAudioData(arrayBuf);
    return _bgmBuffer;
  } catch (_) {
    return null;
  } finally {
    _bgmLoading = false;
  }
}

function _startBGMNode() {
  const ctx = getContext();
  if (!ctx || !_bgmBuffer || ctx.state !== 'running') return;

  // Stop any existing source
  if (_bgmSource) {
    try { _bgmSource.stop(); } catch (_) {}
    _bgmSource.disconnect();
    _bgmSource = null;
  }
  if (_bgmGain) {
    _bgmGain.disconnect();
    _bgmGain = null;
  }

  _bgmSource = ctx.createBufferSource();
  _bgmSource.buffer = _bgmBuffer;
  _bgmSource.loop = true;

  _bgmGain = ctx.createGain();
  _bgmGain.gain.value = _muted ? 0 : 0.12;

  _bgmSource.connect(_bgmGain).connect(ctx.destination);
  _bgmSource.start();
}

export function isBGMOn() { return _bgmOn; }

export function toggleBGM() {
  _bgmOn = !_bgmOn;
  try { localStorage.setItem('ws_bgm_on', _bgmOn ? '1' : '0'); } catch (_) {}
  if (_bgmOn) startBGM(); else stopBGM();
}

export function startBGM() {
  if (_muted || !_bgmOn) return;
  if (_bgmStarted && _bgmSource) return; // already playing

  _bgmStarted = true;
  _bgmPending = false;

  const ctx = getContext();
  if (!ctx) return;

  // If AudioContext isn't running yet, defer until resume()
  if (ctx.state !== 'running') {
    _bgmPending = true;
    _loadBGMBuffer(); // preload the buffer while waiting
    return;
  }

  // Load buffer and start
  _loadBGMBuffer().then(buf => {
    if (buf && _bgmStarted && !_muted && _bgmOn) {
      _startBGMNode();
    }
  }).catch(() => {
    _bgmPending = true;
  });
}

export function stopBGM() {
  _bgmStarted = false;
  _bgmPending = false;
  if (_bgmSource) {
    try { _bgmSource.stop(); } catch (_) {}
    _bgmSource.disconnect();
    _bgmSource = null;
  }
  if (_bgmGain) {
    _bgmGain.disconnect();
    _bgmGain = null;
  }
}

export function pauseBGM() {
  // Disconnect gain to silence without destroying the source
  if (_bgmGain) {
    _bgmGain.disconnect();
    _bgmGain = null;
  }
  if (_bgmSource) {
    try { _bgmSource.stop(); } catch (_) {}
    _bgmSource.disconnect();
    _bgmSource = null;
  }
}

export function resumeBGM() {
  if (_muted || !_bgmOn || !_bgmStarted) return;
  _bgmPending = false;
  const ctx = getContext();
  if (ctx && ctx.state === 'running' && _bgmBuffer) {
    _startBGMNode();
  }
}
