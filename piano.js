'use strict';

// Classic script (not an ES module) so index.html also works when opened via file://.

const FIRST_MIDI = 21;  // A0
const LAST_MIDI = 108;  // C8
const MAX_VOICES = 64;
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isBlack = (m) => [1, 3, 6, 8, 10].includes(m % 12);
const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);
const noteName = (m) => NOTE_NAMES[m % 12] + (Math.floor(m / 12) - 1);
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

// Physical key (KeyboardEvent.code) -> semitone offset from the hand's base note.
// event.code is layout independent, so Turkish Q and US layouts map identically.
// The keyboard is split for two hands. Each hand has the shape of a real piano:
// white keys on a letter row, black keys on the row above, between the whites they belong to.
// Left hand (bottom-left) plays one octave; the right hand (top-right) continues directly above it.
const LEFT_HAND = {
  KeyZ: 0, KeyS: 1, KeyX: 2, KeyD: 3, KeyC: 4, KeyV: 5, KeyG: 6, KeyB: 7, KeyH: 8,
  KeyN: 9, KeyJ: 10, KeyM: 11,
};
const RIGHT_HAND = {
  KeyY: 0, Digit7: 1, KeyU: 2, Digit8: 3, KeyI: 4, KeyO: 5, Digit0: 6, KeyP: 7, Minus: 8,
  BracketLeft: 9, Equal: 10, BracketRight: 11, Backslash: 12,
};
const HAND_CODES = [...Object.keys(LEFT_HAND), ...Object.keys(RIGHT_HAND)];
const FALLBACK_LABELS = { Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\' };
const LEFT_SPAN = Math.max(...Object.values(LEFT_HAND));
const RIGHT_SPAN = Math.max(...Object.values(RIGHT_HAND));
const MIN_BASE = 24;                          // C1
const MAX_BASE = LAST_MIDI - 12 - RIGHT_SPAN; // right hand must stay within C8

const state = {
  leftBase: 48,    // C3; the right hand starts one octave higher
  velocity: 0.8,
  volume: 0.7,
  sustain: false,      // manual pedal (Space)
  autoSustain: false,  // pedal held by the tutor's auto-sustain mode
};

// ---------- Audio ----------

let ctx = null;
let master = null;
let pianoWave = null;
const voices = new Map();   // midi -> active voice (held or sustained)
const holders = new Map();  // midi -> Set of input sources currently holding the note

function ensureAudio() {
  if (!ctx) {
    ctx = new AudioContext({ latencyHint: 'interactive' });
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 8;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.25;
    master = ctx.createGain();
    master.gain.value = state.volume;
    master.connect(comp).connect(ctx.destination);
    pianoWave = buildPianoWave(ctx);
  }
  if (ctx.state === 'suspended') ctx.resume();
}

function buildPianoWave(ac) {
  // Harmonic amplitudes loosely modelled on a struck string; index 0 is DC.
  const amps = [0, 1, 0.55, 0.32, 0.22, 0.12, 0.09, 0.05, 0.04, 0.025, 0.02, 0.012, 0.01];
  return ac.createPeriodicWave(new Float32Array(amps.length), Float32Array.from(amps));
}

// Low strings ring longer than high ones.
const decayTau = (m) => clamp(4.5 - (m - FIRST_MIDI) * 0.045, 0.6, 4.5);
const loudnessComp = (m) => clamp(1 - (m - 60) * 0.004, 0.75, 1.15);

function startVoice(midi, velocity) {
  const t = ctx.currentTime;
  const f = freq(midi);

  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.Q.value = 0.5;
  filter.frequency.setValueAtTime(Math.min(18000, f * (4 + 12 * velocity)), t);
  filter.frequency.setTargetAtTime(Math.min(18000, f * 2.5), t + 0.01, 0.5);

  const out = ctx.createGain();
  const peak = 0.22 * velocity * loudnessComp(midi);
  out.gain.setValueAtTime(0, t);
  out.gain.linearRampToValueAtTime(peak, t + 0.004);
  out.gain.setTargetAtTime(peak * 0.4, t + 0.004, 0.15);
  out.gain.setTargetAtTime(0, t + 0.3, decayTau(midi));

  // Two slightly detuned oscillators imitate the unison strings of a piano note.
  const oscs = [-1.5, 1.5].map((cents) => {
    const o = ctx.createOscillator();
    o.setPeriodicWave(pianoWave);
    o.frequency.value = f;
    o.detune.value = cents;
    o.connect(filter);
    o.start(t);
    o.stop(t + 0.3 + decayTau(midi) * 7);
    return o;
  });
  filter.connect(out).connect(master);
  oscs[0].onended = () => out.disconnect();

  return { midi, out, oscs, ended: false };
}

function releaseVoice(v, tau) {
  if (v.ended) return;
  v.ended = true;
  const t = ctx.currentTime;
  const g = v.out.gain;
  if (g.cancelAndHoldAtTime) {
    g.cancelAndHoldAtTime(t);
  } else {
    const current = g.value;
    g.cancelScheduledValues(t);
    g.setValueAtTime(current, t);
  }
  g.setTargetAtTime(0, t, tau);
  for (const o of v.oscs) o.stop(t + tau * 8);
}

const DAMPER_TAU = 0.09;
const STEAL_TAU = 0.01;

function noteOn(midi, source) {
  ensureAudio();
  const old = voices.get(midi);
  if (old) releaseVoice(old, STEAL_TAU); // re-strike: cut the previous string quickly
  if (!old && voices.size >= MAX_VOICES) {
    const [oldestMidi, oldest] = voices.entries().next().value;
    releaseVoice(oldest, STEAL_TAU);
    voices.delete(oldestMidi);
  }
  voices.delete(midi); // re-insert so Map order stays oldest-first
  voices.set(midi, startVoice(midi, state.velocity));

  if (!holders.has(midi)) holders.set(midi, new Set());
  holders.get(midi).add(source);
  renderKey(midi);
  document.dispatchEvent(new CustomEvent('piano:note', { detail: midi }));
}

function noteOff(midi, source) {
  const set = holders.get(midi);
  if (!set || !set.delete(source)) return;
  if (set.size === 0) {
    holders.delete(midi);
    if (!isSustained()) dampen(midi);
  }
  renderKey(midi);
}

function dampen(midi) {
  const v = voices.get(midi);
  if (!v) return;
  releaseVoice(v, DAMPER_TAU);
  voices.delete(midi);
}

const isSustained = () => state.sustain || state.autoSustain;

// Like lifting and re-pressing the pedal: silence every ringing note whose key is not held.
function dampenUnheld() {
  for (const midi of [...voices.keys()]) {
    if (!holders.has(midi)) dampen(midi);
  }
}

function setSustain(on) {
  if (state.sustain === on) return;
  state.sustain = on;
  if (!isSustained()) dampenUnheld();
  renderStatus();
}

function setAutoSustain(on) {
  if (state.autoSustain === on) return;
  state.autoSustain = on;
  if (!isSustained()) dampenUnheld();
  renderStatus();
}

function allNotesOff() {
  keyNotes.clear();
  pointerNotes.clear();
  holders.clear();
  state.sustain = false;
  if (ctx) for (const v of voices.values()) releaseVoice(v, STEAL_TAU);
  voices.clear();
  for (const el of keyEls.values()) el.classList.remove('down');
  renderStatus();
}

// ---------- UI ----------

const keyboardEl = document.getElementById('keyboard');
const keyEls = new Map(); // midi -> element

function buildKeyboard() {
  const whiteCount = [...Array(LAST_MIDI - FIRST_MIDI + 1).keys()]
    .filter((i) => !isBlack(FIRST_MIDI + i)).length;
  const whiteW = 100 / whiteCount;
  const blackW = whiteW * 0.62;
  let whitesBefore = 0;

  for (let m = FIRST_MIDI; m <= LAST_MIDI; m++) {
    const el = document.createElement('div');
    el.className = 'key ' + (isBlack(m) ? 'black' : 'white');
    el.dataset.midi = m;
    el.title = noteName(m);
    if (isBlack(m)) {
      el.style.left = `${whitesBefore * whiteW - blackW / 2}%`;
      el.style.width = `${blackW}%`;
    } else {
      whitesBefore++;
      if (m % 12 === 0) {
        const n = document.createElement('span');
        n.className = 'note';
        n.textContent = noteName(m);
        el.append(n);
      }
    }
    const l = document.createElement('span');
    l.className = 'lbl';
    el.append(l);
    keyboardEl.append(el);
    keyEls.set(m, el);
  }
}

let layoutMap = null;

function keyLabel(code) {
  const ch = layoutMap && layoutMap.get(code);
  if (ch) return ch.toUpperCase();
  if (FALLBACK_LABELS[code]) return FALLBACK_LABELS[code];
  return code.replace(/^(Key|Digit)/, '');
}

function renderLabels() {
  for (const el of keyEls.values()) el.querySelector('.lbl').textContent = '';
  for (const code of HAND_CODES) {
    const el = keyEls.get(codeToMidi(code));
    if (el) el.querySelector('.lbl').textContent = keyLabel(code);
  }
}

function renderKey(midi) {
  const el = keyEls.get(midi);
  if (el) el.classList.toggle('down', holders.has(midi));
}

function renderStatus() {
  const lo = state.leftBase;
  document.getElementById('leftRange').textContent = `${noteName(lo)}–${noteName(lo + LEFT_SPAN)}`;
  document.getElementById('rightRange').textContent = `${noteName(lo + 12)}–${noteName(lo + 12 + RIGHT_SPAN)}`;
  document.getElementById('velocityOut').textContent = `${Math.round(state.velocity * 100)}%`;
  document.getElementById('pedalOut').textContent = state.sustain ? 'açık' : state.autoSustain ? 'oto' : 'kapalı';
  document.getElementById('pedalStat').classList.toggle('on', isSustained());
}

// ---------- Computer keyboard ----------

const keyNotes = new Map(); // event.code -> midi it started (survives octave shifts)

function codeToMidi(code) {
  if (code in LEFT_HAND) return state.leftBase + LEFT_HAND[code];
  if (code in RIGHT_HAND) return state.leftBase + 12 + RIGHT_HAND[code];
  return null;
}

// Semitones from the lowest to the highest key both hands can reach at one octave position.
const PLAYABLE_SPAN = 12 + RIGHT_SPAN;

function setOctaveBase(base) {
  const next = clamp(base, MIN_BASE, MAX_BASE);
  if (next === state.leftBase) return;
  state.leftBase = next;
  renderLabels();
  renderStatus();
  document.dispatchEvent(new CustomEvent('piano:octave'));
}

function shiftOctave(dir) {
  setOctaveBase(state.leftBase + dir * 12);
}

window.addEventListener('keydown', (e) => {
  if (e.ctrlKey || e.metaKey || e.altKey) return; // leave browser shortcuts alone
  if (e.target instanceof HTMLTextAreaElement) return; // typing notes into the tutor box
  const { code } = e;

  switch (code) {
    case 'Space':
      e.preventDefault();
      ensureAudio();
      setSustain(true);
      return;
    case 'ArrowLeft':
    case 'ArrowRight':
      e.preventDefault();
      if (!e.repeat) shiftOctave(code === 'ArrowLeft' ? -1 : 1);
      return;
    case 'ArrowUp':
    case 'ArrowDown':
      e.preventDefault();
      state.velocity = clamp(Math.round((state.velocity + (code === 'ArrowUp' ? 0.1 : -0.1)) * 10) / 10, 0.1, 1);
      renderStatus();
      return;
    case 'Escape':
      allNotesOff();
      return;
  }

  const midi = codeToMidi(code);
  if (midi === null) return;
  e.preventDefault();
  if (e.repeat || keyNotes.has(code)) return;
  keyNotes.set(code, midi);
  noteOn(midi, 'key:' + code);
}, true);

window.addEventListener('keyup', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    setSustain(false);
    return;
  }
  const midi = keyNotes.get(e.code);
  if (midi === undefined) return;
  keyNotes.delete(e.code);
  noteOff(midi, 'key:' + e.code);
}, true);

// A key released while the window is unfocused never sends keyup; drop everything instead.
window.addEventListener('blur', allNotesOff);
document.addEventListener('visibilitychange', () => { if (document.hidden) allNotesOff(); });

// ---------- Mouse ----------

const pointerNotes = new Map(); // pointerId -> midi

function midiAt(x, y) {
  const el = document.elementFromPoint(x, y);
  const key = el && el.closest('[data-midi]');
  return key ? Number(key.dataset.midi) : null;
}

keyboardEl.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const midi = midiAt(e.clientX, e.clientY);
  if (midi === null) return;
  e.preventDefault();
  pointerNotes.set(e.pointerId, midi);
  noteOn(midi, 'ptr:' + e.pointerId);
});

window.addEventListener('pointermove', (e) => {
  const current = pointerNotes.get(e.pointerId);
  if (current === undefined) return;
  const midi = midiAt(e.clientX, e.clientY);
  if (midi === current) return;
  noteOff(current, 'ptr:' + e.pointerId);
  if (midi === null) {
    pointerNotes.delete(e.pointerId);
    return;
  }
  pointerNotes.set(e.pointerId, midi); // glissando
  noteOn(midi, 'ptr:' + e.pointerId);
});

function endPointer(e) {
  const midi = pointerNotes.get(e.pointerId);
  if (midi === undefined) return;
  pointerNotes.delete(e.pointerId);
  noteOff(midi, 'ptr:' + e.pointerId);
}
window.addEventListener('pointerup', endPointer);
window.addEventListener('pointercancel', endPointer);

// ---------- Controls ----------

const volumeEl = document.getElementById('volume');
volumeEl.addEventListener('input', () => {
  state.volume = Number(volumeEl.value);
  if (master) master.gain.setTargetAtTime(state.volume, ctx.currentTime, 0.02);
});
// Return focus to the page so Space/arrows keep driving the piano, not the slider.
volumeEl.addEventListener('change', () => volumeEl.blur());

// ---------- Init ----------

buildKeyboard();
renderLabels();
renderStatus();

if (navigator.keyboard && navigator.keyboard.getLayoutMap) {
  navigator.keyboard.getLayoutMap()
    .then((map) => { layoutMap = map; renderLabels(); })
    .catch(() => {});
}
