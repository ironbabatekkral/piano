'use strict';

// Key binding editor: click a note, then press the key that should play it.
// Bindings are saved by setKeymap() in piano.js to this browser's localStorage only.
// Relies on globals from piano.js (keymap, setKeymap, keyLabel, RESERVED_CODES, ...) and tutor.js (SOLFEGE_NAMES).

const keymapDialog = document.getElementById('keymapDialog');
const keymapBoard = document.getElementById('keymapBoard');
const keymapStatus = document.getElementById('keymapStatus');
const slotEls = new Map(); // offset -> button
let captureOffset = null;

const IDLE_HINT = 'Bir notaya tıkla, sonra o nota için kullanmak istediğin tuşa bas.';

const slotName = (o) => `${o < 12 ? 'Sol el' : 'Sağ el'} ${SOLFEGE_NAMES[o % 12]}${o === PLAYABLE_SPAN ? ' (üst)' : ''}`;

function buildBoard() {
  const offsets = [...Array(PLAYABLE_SPAN + 1).keys()];
  const whiteW = 100 / offsets.filter((o) => !isBlack(o)).length;
  const blackW = whiteW * 0.62;
  let whitesBefore = 0;
  for (const o of offsets) {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'slot ' + (isBlack(o) ? 'black' : 'white') + (o >= 12 ? ' right' : '');
    el.title = slotName(o);
    if (isBlack(o)) {
      el.style.left = `${whitesBefore * whiteW - blackW / 2}%`;
      el.style.width = `${blackW}%`;
    } else {
      whitesBefore++;
    }
    const key = document.createElement('span');
    key.className = 'slot-key';
    const note = document.createElement('span');
    note.className = 'slot-note';
    note.textContent = SOLFEGE_NAMES[o % 12];
    el.append(key, note);
    el.addEventListener('click', () => {
      if (captureOffset === o) endCapture(IDLE_HINT);
      else beginCapture(o);
    });
    keymapBoard.append(el);
    slotEls.set(o, el);
  }
}

function renderBoard() {
  for (const [o, el] of slotEls) {
    const codes = Object.keys(keymap).filter((code) => keymap[code] === o);
    el.querySelector('.slot-key').textContent = codes.map(keyLabel).join(' ') || '–';
    el.classList.toggle('selected', o === captureOffset);
    el.classList.toggle('empty', codes.length === 0);
  }
}

function beginCapture(offset, message) {
  captureOffset = offset;
  keyCaptureHandler = onCaptureKey;
  keymapStatus.textContent = message || `${slotName(offset)} için bir tuşa bas. Esc: bitir.`;
  renderBoard();
}

function endCapture(message) {
  captureOffset = null;
  keyCaptureHandler = null;
  keymapStatus.textContent = message;
  renderBoard();
}

function onCaptureKey(e) {
  e.preventDefault(); // also keeps Esc from closing the dialog mid-assignment
  if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || !e.code) return;
  if (e.code === 'Escape') {
    endCapture(IDLE_HINT);
    return;
  }
  if (RESERVED_CODES.has(e.code)) {
    keymapStatus.textContent = `${keyLabel(e.code)} kontrol tuşu, notaya atanamaz. Başka bir tuşa bas.`;
    return;
  }
  // One key per note: drop the note's old key and move the pressed key away from any other note.
  const assigned = captureOffset;
  const next = {};
  for (const [code, o] of Object.entries(keymap)) {
    if (o !== assigned && code !== e.code) next[code] = o;
  }
  next[e.code] = assigned;
  setKeymap(next);

  const done = `${keyLabel(e.code)} → ${slotName(assigned)} atandı.`;
  if (assigned < PLAYABLE_SPAN) {
    beginCapture(assigned + 1, `${done} Şimdi ${slotName(assigned + 1)} için bir tuşa bas (Esc: bitir).`);
  } else {
    endCapture(done);
  }
}

keymapDialog.addEventListener('cancel', (e) => {
  if (captureOffset !== null) e.preventDefault();
});
keymapDialog.addEventListener('close', () => endCapture(IDLE_HINT));

document.getElementById('keymapOpen').addEventListener('click', (e) => {
  e.currentTarget.blur();
  keymapDialog.showModal();
  endCapture(IDLE_HINT);
});

document.getElementById('keymapClear').addEventListener('click', () => {
  if (captureOffset === null) {
    keymapStatus.textContent = 'Önce tuşunu kaldırmak istediğin notaya tıkla.';
    return;
  }
  const offset = captureOffset;
  setKeymap(Object.fromEntries(Object.entries(keymap).filter(([, o]) => o !== offset)));
  beginCapture(offset, `${slotName(offset)} artık hiçbir tuşa bağlı değil. Yeni tuşa basabilir ya da Esc ile bitirebilirsin.`);
});

document.getElementById('keymapReset').addEventListener('click', () => {
  if (!confirm('Tüm tuş atamaları varsayılana dönsün mü?')) return;
  setKeymap({ ...DEFAULT_KEYMAP });
  endCapture('Varsayılan tuşlar geri yüklendi.');
});

document.getElementById('keymapClose').addEventListener('click', () => keymapDialog.close());

document.addEventListener('piano:keymap', renderBoard);

buildBoard();
renderBoard();
