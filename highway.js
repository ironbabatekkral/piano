'use strict';

// Falling-notes lane above the keyboard for rhythm mode. Each bar falls toward its key;
// the bar's bottom edge reaches the keyboard exactly when the note should be played,
// and its height is the note's length. Relies on keyEls (piano.js) and keyFor (tutor.js).

const highwayEl = document.getElementById('highway');
const highwayCtx = highwayEl.getContext('2d');
const HIGHWAY_VIEW_SECONDS = 3; // how far ahead the lane shows
const HIGHWAY_COLORS = {
  upcoming: 'rgba(224, 145, 63, 0.4)',
  current: '#e0913f',
  go: '#5cc46a',
  hit: '#2f7a3d',
  label: '#1a1a1a',
  line: '#5cc46a',
};

// Match the canvas buffer to its CSS size so bars stay crisp on high-DPI screens.
function sizeHighway() {
  const dpr = window.devicePixelRatio || 1;
  const w = Math.round(highwayEl.clientWidth * dpr);
  const h = Math.round(highwayEl.clientHeight * dpr);
  if (highwayEl.width !== w || highwayEl.height !== h) {
    highwayEl.width = w;
    highwayEl.height = h;
  }
  return dpr;
}

function clearHighway() {
  sizeHighway();
  highwayCtx.clearRect(0, 0, highwayEl.width, highwayEl.height);
}

// view: { steps, index, t (song time in beats), bps (beats per second), go, hits }
function drawHighway({ steps, index, t, bps, go, hits }) {
  const dpr = sizeHighway();
  const W = highwayEl.width;
  const H = highwayEl.height;
  const c = highwayCtx;
  c.clearRect(0, 0, W, H);

  const origin = highwayEl.getBoundingClientRect().left;
  const pxPerBeat = H / (HIGHWAY_VIEW_SECONDS * bps);

  const visible = [];
  for (let i = index; i < steps.length; i++) {
    const bottom = H - (steps[i].time - t) * pxPerBeat;
    if (bottom < 0) break;
    visible.push([i, bottom]);
  }

  c.font = `600 ${11 * dpr}px system-ui, "Segoe UI", sans-serif`;
  c.textAlign = 'center';
  // Draw later notes first so the current step is painted on top.
  for (const [i, bottom] of visible.reverse()) {
    const step = steps[i];
    const height = Math.max(4 * dpr, step.beats * pxPerBeat - 3 * dpr);
    for (const midi of step.notes) {
      const r = keyEls.get(midi).getBoundingClientRect();
      const x = (r.left - origin) * dpr + dpr;
      const w = r.width * dpr - 2 * dpr;
      if (i !== index) c.fillStyle = HIGHWAY_COLORS.upcoming;
      else if (hits.has(midi)) c.fillStyle = HIGHWAY_COLORS.hit;
      else c.fillStyle = go ? HIGHWAY_COLORS.go : HIGHWAY_COLORS.current;
      c.beginPath();
      c.roundRect(x, bottom - height, w, height, 3 * dpr);
      c.fill();

      const label = keyFor(midi);
      if (label && height > 16 * dpr) {
        c.fillStyle = HIGHWAY_COLORS.label;
        c.fillText(label, x + w / 2, bottom - 5 * dpr, w);
      }
    }
  }

  // The keyboard edge: a bar touching this line is due now.
  c.fillStyle = HIGHWAY_COLORS.line;
  c.fillRect(0, H - 2 * dpr, W, 2 * dpr);
}
