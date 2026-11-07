'use strict';

// Wait-mode tutor: lights up the key(s) to play next and advances only when they are played.
// Relies on globals from piano.js (keyEls, noteName, codeToMidi, keyLabel, HAND_CODES).

const SOLFEGE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const solfege = (m) => SOLFEGE_NAMES[m % 12] + (Math.floor(m / 12) - 1);

const PITCH = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const NOTE_RE = /^(do|re|mi|fa|sol|la|si|[a-g])(#|b)?(\d)?$/i;
const CUSTOM_STORAGE_KEY = 'piano.customNotes';

function parseNote(token) {
  const m = NOTE_RE.exec(token);
  if (!m) throw new Error(`Tanınmayan nota: "${token}"`);
  const accidental = m[2] === '#' ? 1 : m[2] ? -1 : 0;
  const octave = m[3] === undefined ? 4 : Number(m[3]);
  const midi = (octave + 1) * 12 + PITCH[m[1].toLowerCase()] + accidental;
  if (midi < FIRST_MIDI || midi > LAST_MIDI) throw new Error(`Piyano aralığı dışında: "${token}"`);
  return midi;
}

// Returns an array of steps; each step is an array of MIDI notes to play together.
function parseSong(text) {
  const steps = text.split(/[\s,|]+/).filter(Boolean)
    .map((token) => [...new Set(token.split('+').filter(Boolean).map(parseNote))]);
  if (steps.length === 0) throw new Error('Hiç nota yazılmadı.');
  return steps;
}

const tutor = { steps: [], index: 0, hits: new Set(), active: false, finished: false };

const songSelect = document.getElementById('songSelect');
const toggleBtn = document.getElementById('tutorToggle');
const statusEl = document.getElementById('tutorStatus');
const autoOctaveEl = document.getElementById('autoOctave');
const autoSustainEl = document.getElementById('autoSustain');
const customEl = document.getElementById('customNotes');
const customBtn = document.getElementById('customStart');
const errorEl = document.getElementById('tutorError');

const AUTO_OCTAVE_STORAGE_KEY = 'piano.autoOctave';
const FINISH_RING_MS = 2000; // let the last note ring before auto-sustain lets go

function keyFor(midi) {
  for (const code of HAND_CODES) {
    if (codeToMidi(code) === midi) return keyLabel(code);
  }
  return null;
}

// ---------- Auto octave ----------

const fits = (base, notes) => Math.min(...notes) >= base && Math.max(...notes) <= base + PLAYABLE_SPAN;

// Octave position closest to the current one where every note has a key, or null if none does.
function fittingBase(notes) {
  let best = null;
  for (let b = MIN_BASE; b <= MAX_BASE; b += 12) {
    if (fits(b, notes) && (best === null || Math.abs(b - state.leftBase) < Math.abs(best - state.leftBase))) best = b;
  }
  return best;
}

function fitCurrentStep() {
  if (!tutor.active || !autoOctaveEl.checked) return;
  const step = tutor.steps[tutor.index];
  if (fits(state.leftBase, step)) return;
  const base = fittingBase(step);
  if (base !== null) setOctaveBase(base);
}

// ---------- Lesson flow ----------

function selectedSong() {
  return SONGS[Number(songSelect.value)];
}

function start(steps) {
  Object.assign(tutor, { steps, index: 0, active: true, finished: false });
  tutor.hits.clear();
  if (autoOctaveEl.checked) {
    // Prefer one position for the whole song so the keys don't move while playing.
    const base = fittingBase(steps.flat()) ?? fittingBase(steps[0]);
    if (base !== null) setOctaveBase(base);
  }
  setAutoSustain(autoSustainEl.checked);
  render();
}

function stop() {
  tutor.active = false;
  tutor.finished = false;
  setAutoSustain(false);
  render();
}

function finish() {
  tutor.active = false;
  tutor.finished = true;
  setTimeout(() => { if (!tutor.active) setAutoSustain(false); }, FINISH_RING_MS);
}

function render() {
  for (const el of keyEls.values()) el.classList.remove('target', 'hit');
  toggleBtn.textContent = tutor.active ? 'Durdur' : 'Başlat';

  if (!tutor.active) {
    const tip = selectedSong().tip;
    statusEl.textContent = tutor.finished
      ? 'Bitti! Tekrar çalmak için Başlat\'a bas.'
      : `Başlat'a bas.${tip ? ' İpucu: ' + tip : ''}`;
    return;
  }

  const step = tutor.steps[tutor.index];
  for (const midi of step) {
    const el = keyEls.get(midi);
    el.classList.add('target');
    if (tutor.hits.has(midi)) el.classList.add('hit');
  }

  const parts = step.map((m) => {
    const key = keyFor(m);
    return `${solfege(m)} (${noteName(m)}) → ${key ? `${key} tuşu` : 'klavyede yok'}`;
  });
  const outOfRange = step.some((m) => keyFor(m) === null);
  const hint = autoOctaveEl.checked ? ' · bu adım iki ele sığmıyor' : ' · ← → ile oktav değiştir';
  statusEl.textContent = `${tutor.index + 1} / ${tutor.steps.length} · Sıradaki: ${parts.join(' + ')}`
    + (outOfRange ? hint : '');
}

function flashWrong(midi) {
  const el = keyEls.get(midi);
  el.classList.remove('wrong');
  void el.offsetWidth; // restart the flash if the same wrong key is hit again
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 250);
}

function onNote(midi) {
  if (!tutor.active) return;
  const step = tutor.steps[tutor.index];
  if (!step.includes(midi)) {
    flashWrong(midi);
    return;
  }
  // Auto-sustain changes the pedal on the first correct note of each step:
  // the previous step rings until the new one begins, so lines stay smooth but never blur.
  if (state.autoSustain && tutor.hits.size === 0) dampenUnheld();
  tutor.hits.add(midi);
  if (step.every((m) => tutor.hits.has(m))) {
    tutor.index++;
    tutor.hits.clear();
    if (tutor.index >= tutor.steps.length) finish();
    else fitCurrentStep();
  }
  render();
}

document.addEventListener('piano:note', (e) => onNote(e.detail));
document.addEventListener('piano:octave', render);

// ---------- Controls ----------

const groups = new Map();
SONGS.forEach((song, i) => {
  if (!groups.has(song.group)) {
    const og = document.createElement('optgroup');
    og.label = song.group;
    songSelect.append(og);
    groups.set(song.group, og);
  }
  groups.get(song.group).append(new Option(song.title, String(i)));
});

function applySongDefaults() {
  autoSustainEl.checked = Boolean(selectedSong().sustain);
}

songSelect.addEventListener('change', () => {
  songSelect.blur();
  applySongDefaults();
  if (tutor.active) start(parseSong(selectedSong().notes));
  else render();
});

toggleBtn.addEventListener('click', () => {
  toggleBtn.blur();
  if (tutor.active) stop();
  else start(parseSong(selectedSong().notes));
});

autoOctaveEl.checked = localStorage.getItem(AUTO_OCTAVE_STORAGE_KEY) !== 'false';
autoOctaveEl.addEventListener('change', () => {
  autoOctaveEl.blur();
  localStorage.setItem(AUTO_OCTAVE_STORAGE_KEY, String(autoOctaveEl.checked));
  fitCurrentStep();
  render();
});

autoSustainEl.addEventListener('change', () => {
  autoSustainEl.blur();
  if (tutor.active) setAutoSustain(autoSustainEl.checked);
});

customEl.value = localStorage.getItem(CUSTOM_STORAGE_KEY) || '';
customEl.addEventListener('input', () => {
  localStorage.setItem(CUSTOM_STORAGE_KEY, customEl.value);
  errorEl.textContent = '';
});

customBtn.addEventListener('click', () => {
  customBtn.blur();
  try {
    start(parseSong(customEl.value));
    errorEl.textContent = '';
  } catch (err) {
    errorEl.textContent = err.message;
  }
});

applySongDefaults();
render();
