'use strict';

// Lessons. Notes are separated by spaces; "+" joins notes played together.
// Accepted names: C D E F G A B or Do Re Mi Fa Sol La Si, with optional # / b and octave (default 4).
// Pedal marks, as in sheet music: "Ped" presses (or changes) the sustain pedal and "*" lifts it,
// on the note that follows. A song without pedal marks never touches the pedal.
// `tip` is shown before the song starts.
// Popular intros are short right-hand transcriptions for personal practice; rhythm is not encoded.

// Repeats a phrase n times (pieces built from a looping riff).
const rep = (phrase, n) => Array(n).fill(phrase.trim()).join(' ');

const SONGS = [
  {
    group: 'Popüler intro\'lar',
    title: 'Kanye West – Runaway',
    tip: 'Tek nota ile başlar: aynı Mi\'ye 15 kez, eşit aralıklarla bas. Sonra ana kalıp 6 kez döner.',
    notes: 'Ped ' + rep('E6', 15) + ' '
      + rep('Ped E6 E6 E6 E5  Ped D#6 D#6 D#6 D#5  Ped C#6 C#6 C#6 C#5  Ped A5 A5 G#5', 6),
  },
  {
    group: 'Popüler intro\'lar',
    title: 'Dr. Dre – Still D.R.E.',
    tip: 'Akorlara kısa ve sert vur, hemen bırak. Her turda parmak tek tek kayar: 8 + 3 + 5 vuruş, 4 tur.',
    notes: rep(`${rep('C5+E5+A5', 8)} ${rep('B4+E5+A5', 3)} ${rep('B4+E5+G5', 5)}`, 4),
  },
  {
    group: 'Popüler intro\'lar',
    title: 'Linkin Park – In the End',
    tip: 'Aynı kalıp sekiz kez döner; son turda Fa\'da bitir ve çınlamaya bırak.',
    notes: rep('Ped Eb5 Bb5 Bb5 Gb5  Ped F5 F5 F5 F5 Gb5', 7) + ' Ped Eb5 Bb5 Bb5 Gb5  Ped F5',
  },
  {
    group: 'Popüler intro\'lar',
    title: 'Coldplay – Clocks',
    tip: 'Her ölçü yukarıdan aşağı üç notalık bir arpej: 3 + 3 + 2 vuruş. 4 ölçülük kalıp 4 kez döner.',
    notes: rep(`Ped Eb5 Bb4 G4 Eb5 Bb4 G4 Eb5 Bb4
                Ped Db5 Bb4 F4 Db5 Bb4 F4 Db5 Bb4
                Ped Db5 Bb4 F4 Db5 Bb4 F4 Db5 Bb4
                Ped C5 Ab4 F4 C5 Ab4 F4 C5 Ab4`, 4),
  },
  {
    group: 'Başlangıç',
    title: 'Do Re Mi (gam)',
    notes: 'Do4 Re4 Mi4 Fa4 Sol4 La4 Si4 Do5 Si4 La4 Sol4 Fa4 Mi4 Re4 Do4',
  },
  {
    group: 'Başlangıç',
    title: 'Twinkle Twinkle Little Star',
    notes: `C4 C4 G4 G4 A4 A4 G4  F4 F4 E4 E4 D4 D4 C4
            G4 G4 F4 F4 E4 E4 D4  G4 G4 F4 F4 E4 E4 D4
            C4 C4 G4 G4 A4 A4 G4  F4 F4 E4 E4 D4 D4 C4`,
  },
  {
    group: 'Başlangıç',
    title: 'Frère Jacques',
    notes: `C4 D4 E4 C4  C4 D4 E4 C4  E4 F4 G4  E4 F4 G4
            G4 A4 G4 F4 E4 C4  G4 A4 G4 F4 E4 C4  C4 G3 C4  C4 G3 C4`,
  },
  {
    group: 'Başlangıç',
    title: 'Neşeye Övgü (Beethoven)',
    notes: `E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 E4 D4 D4
            E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4
            D4 D4 E4 C4 D4 E4 F4 E4 C4 D4 E4 F4 E4 D4 C4 D4 G3
            E4 E4 F4 G4 G4 F4 E4 D4 C4 C4 D4 E4 D4 C4 C4`,
  },
  {
    group: 'Başlangıç',
    title: 'İlk akorlar (Do, Fa, Sol)',
    notes: `Ped C4+E4+G4 Ped C4+F4+A4 Ped B3+D4+G4 Ped C4+E4+G4
            Ped C3+C4+E4+G4 Ped F3+C4+F4+A4 Ped G3+B3+D4+G4 Ped C3+C4+E4+G4`,
  },
];
