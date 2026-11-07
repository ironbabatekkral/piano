'use strict';

// Tutor: lights up the key(s) to play next.
// Wait mode: the key stays lit until it is played.
// Rhythm mode: notes fall toward the keyboard (highway.js); a key glows amber as its time approaches
// and turns green when it is time to press it. A note that isn't played in time makes the song
// clock wait for it, so nothing is ever skipped.
// Relies on globals from piano.js (keyEls, noteName, codesFor, keyLabel, state, setOctaveBase, ...).

const SOLFEGE_NAMES = ['Do', 'Do#', 'Re', 'Re#', 'Mi', 'Fa', 'Fa#', 'Sol', 'Sol#', 'La', 'La#', 'Si'];
const solfege = (m) => SOLFEGE_NAMES[m % 12] + (Math.floor(m / 12) - 1);

const PITCH = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11, do: 0, re: 2, mi: 4, fa: 5, sol: 7, la: 9, si: 11 };
const NOTE_RE = /^(do|re|mi|fa|sol|la|si|[a-g])(#|b)?(\d)?$/i;
const PEDAL_DOWN_RE = /^ped\.?$/i;
const SETTING_RE = /^(bpm|len)=(\d+(?:\.\d+)?)$/i;

// Everything below is kept in this browser's localStorage only; nothing is uploaded anywhere.
const DRAFT_STORAGE_KEY = 'piano.customNotes';
const LIBRARY_STORAGE_KEY = 'piano.customSongs';
const AUTO_OCTAVE_STORAGE_KEY = 'piano.autoOctave';
const AUTO_PEDAL_STORAGE_KEY = 'piano.autoPedal';
const LOOP_STORAGE_KEY = 'piano.loop';
const RHYTHM_STORAGE_KEY = 'piano.rhythm';
const SPEED_STORAGE_KEY = 'piano.speed';

const DEFAULT_BPM = 90;
const FINISH_RING_MS = 2000;   // let the last note ring before the auto pedal lets go
const LEAD_IN_SECONDS = 2.5;   // time before the first note reaches the keyboard
const APPROACH_SECONDS = 1.5;  // a key starts glowing amber this long before its time
const EARLY_TOLERANCE_S = 0.15; // the key turns green (and presses count) this long before its time
const ON_TIME_S = 0.15;        // finishing a step within this after its time counts as on time

function parseNote(token) {
  const m = NOTE_RE.exec(token);
  if (!m) throw new Error(`Tanınmayan nota: "${token}"`);
  const accidental = m[2] === '#' ? 1 : m[2] ? -1 : 0;
  const octave = m[3] === undefined ? 4 : Number(m[3]);
  const midi = (octave + 1) * 12 + PITCH[m[1].toLowerCase()] + accidental;
  if (midi < FIRST_MIDI || midi > LAST_MIDI) throw new Error(`Piyano aralığı dışında: "${token}"`);
  return midi;
}

// Song text -> { steps, bpm }. Tokens:
//   C4  Do4+Mi4+Sol4   a note or chord; ":2" after it sets its length in beats (C4:2, Eb5:0.5)
//   bpm=85             tempo (default 90)
//   len=0.5            default length for the notes that follow (default 1 beat)
//   r:2                a rest of 2 beats (r alone = the current len)
//   Ped / *            press (or change) / lift the sustain pedal on the next note
// Each step: { notes, beats, pedal: 'down' | 'up' | null, time: start in beats }.
function parseSong(text) {
  const steps = [];
  let pedal = null;
  let bpm = DEFAULT_BPM;
  let len = 1;
  let time = 0;
  for (const token of text.split(/[\s,|]+/).filter(Boolean)) {
    const setting = SETTING_RE.exec(token);
    if (setting) {
      const value = Number(setting[2]);
      if (setting[1].toLowerCase() === 'bpm') {
        if (value < 20 || value > 300) throw new Error(`Tempo 20 ile 300 arasında olmalı: "${token}"`);
        bpm = value;
      } else {
        if (!(value > 0)) throw new Error(`Süre sıfırdan büyük olmalı: "${token}"`);
        len = value;
      }
      continue;
    }
    if (PEDAL_DOWN_RE.test(token)) {
      pedal = 'down';
      continue;
    }
    if (token === '*') {
      pedal = 'up';
      continue;
    }
    const [chord, length, extra] = token.split(':');
    const beats = length === undefined ? len : Number(length);
    if (extra !== undefined || !(beats > 0) || !Number.isFinite(beats)) throw new Error(`Tanınmayan süre: "${token}"`);
    if (/^r(est)?$/i.test(chord)) {
      time += beats; // a rest only moves the clock
      continue;
    }
    const notes = [...new Set(chord.split('+').filter(Boolean).map(parseNote))];
    if (notes.length === 0) throw new Error(`Tanınmayan nota: "${token}"`);
    steps.push({ notes, beats, pedal, time });
    time += beats;
    pedal = null;
  }
  if (steps.length === 0) throw new Error('Hiç nota yazılmadı.');
  return { steps, bpm };
}

const tutor = {
  steps: [],
  bpm: DEFAULT_BPM,
  index: 0,
  round: 1,
  hits: new Set(),
  active: false,
  finished: false,
  t: 0,               // song clock in beats
  waitingSince: null, // performance.now() when the clock stopped to wait for the current step
  lastFrame: 0,
  frame: null,
  onTime: 0,
  feedback: '',
  result: '',
};

const songSelect = document.getElementById('songSelect');
const toggleBtn = document.getElementById('tutorToggle');
const statusEl = document.getElementById('tutorStatus');
const autoOctaveEl = document.getElementById('autoOctave');
const autoPedalEl = document.getElementById('autoPedal');
const loopEl = document.getElementById('loopSong');
const rhythmEl = document.getElementById('rhythmMode');
const speedEl = document.getElementById('speed');
const speedOut = document.getElementById('speedOut');
const titleEl = document.getElementById('customTitle');
const customEl = document.getElementById('customNotes');
const tryBtn = document.getElementById('customStart');
const saveBtn = document.getElementById('customSave');
const editBtn = document.getElementById('customEdit');
const deleteBtn = document.getElementById('customDelete');
const errorEl = document.getElementById('tutorError');

const keyFor = (midi) => {
  const codes = codesFor(midi);
  return codes.length ? codes.map(keyLabel).join(' / ') : null;
};

const inRhythm = () => rhythmEl.checked;
const beatsPerSecond = () => (tutor.bpm / 60) * (Number(speedEl.value) / 100);
const currentStep = () => tutor.steps[tutor.index];
const secondsUntilDue = () => (currentStep().time - tutor.t) / beatsPerSecond();
const isDue = () => secondsUntilDue() <= EARLY_TOLERANCE_S;

// ---------- Local song library ----------

function loadLibrary() {
  try {
    const saved = JSON.parse(localStorage.getItem(LIBRARY_STORAGE_KEY));
    if (Array.isArray(saved)) {
      return saved.filter((s) => s && typeof s.title === 'string' && typeof s.notes === 'string');
    }
  } catch { /* corrupt entry: start with an empty library */ }
  return [];
}

let library = loadLibrary();

const saveLibrary = () => localStorage.setItem(LIBRARY_STORAGE_KEY, JSON.stringify(library));

// Option values: "b:<index>" for built-in songs, "c:<index>" for the user's own songs.
function selectedSong() {
  const [kind, i] = songSelect.value.split(':');
  return (kind === 'c' ? library : SONGS)[Number(i)];
}

const isCustomSelected = () => songSelect.value.startsWith('c:');

function renderSongList(selectValue) {
  const previous = selectValue ?? songSelect.value;
  songSelect.textContent = '';
  const groups = new Map();
  const addOption = (group, title, value) => {
    if (!groups.has(group)) {
      const og = document.createElement('optgroup');
      og.label = group;
      songSelect.append(og);
      groups.set(group, og);
    }
    groups.get(group).append(new Option(title, value));
  };
  library.forEach((song, i) => addOption('Benim parçalarım', song.title, `c:${i}`));
  SONGS.forEach((song, i) => addOption(song.group, song.title, `b:${i}`));
  const values = [...songSelect.options].map((o) => o.value);
  songSelect.value = values.includes(previous) ? previous : `b:0`;
  editBtn.disabled = deleteBtn.disabled = !isCustomSelected();
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
  const { notes } = currentStep();
  if (fits(state.leftBase, notes)) return;
  const base = fittingBase(notes);
  if (base !== null) setOctaveBase(base);
}

// ---------- Rhythm clock ----------

function rewindToLeadIn() {
  tutor.t = currentStep().time - LEAD_IN_SECONDS * beatsPerSecond();
  tutor.waitingSince = null;
}

function startClock() {
  cancelAnimationFrame(tutor.frame);
  tutor.frame = null;
  highwayEl.hidden = !inRhythm();
  if (!tutor.active || !inRhythm()) {
    clearHighway();
    return;
  }
  tutor.lastFrame = performance.now();
  tutor.frame = requestAnimationFrame(tick);
}

function tick(now) {
  if (!tutor.active || !inRhythm()) {
    tutor.frame = null;
    return;
  }
  // Cap the step so a backgrounded tab doesn't jump the clock forward.
  const dt = Math.min(0.1, (now - tutor.lastFrame) / 1000);
  tutor.lastFrame = now;
  if (tutor.waitingSince === null) {
    tutor.t += dt * beatsPerSecond();
    if (tutor.t >= currentStep().time) {
      tutor.t = currentStep().time; // hold here until the step is played
      tutor.waitingSince = now;
    }
  }
  renderTiming();
  drawHighway({
    steps: tutor.steps, index: tutor.index, t: tutor.t, bps: beatsPerSecond(), go: isDue(), hits: tutor.hits,
  });
  tutor.frame = requestAnimationFrame(tick);
}

// Amber while the current step approaches, green once it is time to press it.
function renderTiming() {
  const seconds = secondsUntilDue();
  const go = seconds <= EARLY_TOLERANCE_S;
  const approaching = seconds <= APPROACH_SECONDS;
  for (const midi of currentStep().notes) {
    const el = keyEls.get(midi);
    const hit = tutor.hits.has(midi);
    el.classList.toggle('hit', hit);
    el.classList.toggle('go', go && !hit);
    el.classList.toggle('target', approaching && !go && !hit);
  }
}

// ---------- Lesson flow ----------

function start(song) {
  Object.assign(tutor, {
    steps: song.steps, bpm: song.bpm, index: 0, round: 1, active: true, finished: false,
    onTime: 0, feedback: '', result: '',
  });
  tutor.hits.clear();
  if (autoOctaveEl.checked) {
    // Prefer one position for the whole song so the keys don't move while playing.
    const base = fittingBase(song.steps.flatMap((s) => s.notes)) ?? fittingBase(song.steps[0].notes);
    if (base !== null) setOctaveBase(base);
  }
  setAutoSustain(false); // the pedal starts up; only the song's pedal marks press it
  rewindToLeadIn();
  render();
  startClock();
}

function stop() {
  tutor.active = false;
  tutor.finished = false;
  setAutoSustain(false);
  render();
  startClock();
}

const roundResult = () => (inRhythm() ? ` Zamanında: ${tutor.onTime} / ${tutor.steps.length}.` : '');

function finish() {
  const result = roundResult();
  if (loopEl.checked) {
    tutor.feedback = `Tur ${tutor.round} bitti.${result}`;
    tutor.index = 0;
    tutor.round++;
    tutor.onTime = 0;
    rewindToLeadIn();
    fitCurrentStep();
    return;
  }
  tutor.active = false;
  tutor.finished = true;
  tutor.result = result;
  setTimeout(() => { if (!tutor.active) setAutoSustain(false); }, FINISH_RING_MS);
  startClock();
}

function render() {
  for (const el of keyEls.values()) el.classList.remove('target', 'hit', 'go');
  toggleBtn.textContent = tutor.active ? 'Durdur' : 'Başlat';

  if (!tutor.active) {
    const song = selectedSong();
    const pedalNote = parseSong(song.notes).steps.some((s) => s.pedal) ? '' : ' Bu parçada pedal işareti yok, pedala basılmaz.';
    statusEl.textContent = tutor.finished
      ? `Bitti!${tutor.result} Tekrar çalmak için Başlat'a bas.`
      : `Başlat'a bas.${song.tip ? ' İpucu: ' + song.tip : ''}${pedalNote}`;
    return;
  }

  const step = currentStep();
  if (inRhythm()) {
    renderTiming();
  } else {
    for (const midi of step.notes) {
      const el = keyEls.get(midi);
      el.classList.add('target');
      if (tutor.hits.has(midi)) el.classList.add('hit');
    }
  }

  const parts = step.notes.map((m) => {
    const key = keyFor(m);
    return `${solfege(m)} (${noteName(m)}) → ${key ? `${key} tuşu` : 'klavyede yok'}`;
  });
  const outOfRange = step.notes.some((m) => keyFor(m) === null);
  const hint = autoOctaveEl.checked ? ' · bu notaya tuş atanmamış ya da iki ele sığmıyor' : ' · ← → ile oktav değiştir';
  const round = loopEl.checked ? `Tur ${tutor.round} · ` : '';
  const pedal = autoPedalEl.checked && step.pedal ? ` · pedal ${step.pedal === 'down' ? 'basılır' : 'kalkar'}` : '';
  const feedback = inRhythm() && tutor.feedback ? ` · ${tutor.feedback}` : '';
  statusEl.textContent = `${round}${tutor.index + 1} / ${tutor.steps.length} · Sıradaki: ${parts.join(' + ')}`
    + pedal + (outOfRange ? hint : '') + feedback;
}

function flashWrong(midi) {
  const el = keyEls.get(midi);
  el.classList.remove('wrong');
  void el.offsetWidth; // restart the flash if the same wrong key is hit again
  el.classList.add('wrong');
  setTimeout(() => el.classList.remove('wrong'), 250);
}

// How late the finished step was: the time the clock spent waiting for it.
function judgeStep() {
  const late = tutor.waitingSince === null ? 0 : (performance.now() - tutor.waitingSince) / 1000;
  if (late <= ON_TIME_S) {
    tutor.onTime++;
    tutor.feedback = 'Tam zamanında';
  } else {
    tutor.feedback = `Geç: ${late.toFixed(1)} sn`;
  }
  tutor.waitingSince = null;
}

function onNote(midi) {
  if (!tutor.active) return;
  const step = currentStep();
  if (!step.notes.includes(midi)) {
    flashWrong(midi);
    return;
  }
  if (inRhythm() && !isDue() && !tutor.hits.has(midi)) {
    flashWrong(midi);
    tutor.feedback = 'Erken! Yeşil yanınca bas.';
    render();
    return;
  }
  if (autoPedalEl.checked && tutor.hits.size === 0) applyPedal(step.pedal);
  tutor.hits.add(midi);
  if (step.notes.every((m) => tutor.hits.has(m))) {
    if (inRhythm()) judgeStep();
    tutor.index++;
    tutor.hits.clear();
    if (tutor.index >= tutor.steps.length) finish();
    else fitCurrentStep();
  }
  render();
}

document.addEventListener('piano:note', (e) => onNote(e.detail));
document.addEventListener('piano:octave', render);
document.addEventListener('piano:keymap', render);

// ---------- Controls ----------

// Pressing the pedal while it is already down is a pedal change: notes no longer held stop ringing.
function applyPedal(action) {
  if (action === 'down') {
    if (state.autoSustain) dampenUnheld();
    else setAutoSustain(true);
  } else if (action === 'up') {
    setAutoSustain(false);
  }
}

songSelect.addEventListener('change', () => {
  songSelect.blur();
  editBtn.disabled = deleteBtn.disabled = !isCustomSelected();
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

autoPedalEl.checked = localStorage.getItem(AUTO_PEDAL_STORAGE_KEY) !== 'false';
autoPedalEl.addEventListener('change', () => {
  autoPedalEl.blur();
  localStorage.setItem(AUTO_PEDAL_STORAGE_KEY, String(autoPedalEl.checked));
  if (!autoPedalEl.checked) setAutoSustain(false);
  render();
});

loopEl.checked = localStorage.getItem(LOOP_STORAGE_KEY) === 'true';
loopEl.addEventListener('change', () => {
  loopEl.blur();
  localStorage.setItem(LOOP_STORAGE_KEY, String(loopEl.checked));
  render();
});

rhythmEl.checked = localStorage.getItem(RHYTHM_STORAGE_KEY) !== 'false';
rhythmEl.addEventListener('change', () => {
  rhythmEl.blur();
  localStorage.setItem(RHYTHM_STORAGE_KEY, String(rhythmEl.checked));
  tutor.feedback = '';
  if (tutor.active && inRhythm()) rewindToLeadIn();
  render();
  startClock();
});

const renderSpeed = () => { speedOut.textContent = `${speedEl.value}%`; };
speedEl.value = localStorage.getItem(SPEED_STORAGE_KEY) || '100';
speedEl.addEventListener('input', () => {
  localStorage.setItem(SPEED_STORAGE_KEY, speedEl.value);
  renderSpeed();
});
// Return focus to the page so Space/arrows keep driving the piano, not the slider.
speedEl.addEventListener('change', () => speedEl.blur());

customEl.value = localStorage.getItem(DRAFT_STORAGE_KEY) || '';
customEl.addEventListener('input', () => {
  localStorage.setItem(DRAFT_STORAGE_KEY, customEl.value);
  errorEl.textContent = '';
});
titleEl.addEventListener('input', () => { errorEl.textContent = ''; });

// Runs fn and shows its error message instead of throwing.
function report(fn) {
  try {
    fn();
    errorEl.textContent = '';
  } catch (err) {
    errorEl.textContent = err.message;
  }
}

tryBtn.addEventListener('click', () => {
  tryBtn.blur();
  report(() => start(parseSong(customEl.value)));
});

saveBtn.addEventListener('click', () => {
  saveBtn.blur();
  report(() => {
    const title = titleEl.value.trim();
    if (!title) throw new Error('Parçaya bir ad ver.');
    parseSong(customEl.value); // validate before saving
    const song = { title, notes: customEl.value.trim() };
    const existing = library.findIndex((s) => s.title === title);
    if (existing >= 0) library[existing] = song;
    else library.push(song);
    saveLibrary();
    renderSongList(`c:${existing >= 0 ? existing : library.length - 1}`);
    render();
  });
});

editBtn.addEventListener('click', () => {
  editBtn.blur();
  const song = selectedSong();
  titleEl.value = song.title;
  customEl.value = song.notes;
  localStorage.setItem(DRAFT_STORAGE_KEY, customEl.value);
});

deleteBtn.addEventListener('click', () => {
  deleteBtn.blur();
  const song = selectedSong();
  if (!confirm(`"${song.title}" silinsin mi?`)) return;
  if (tutor.active) stop();
  library.splice(Number(songSelect.value.split(':')[1]), 1);
  saveLibrary();
  renderSongList('b:0');
  render();
});

renderSongList('b:0');
renderSpeed();
render();
startClock();
