'use strict';

// Lessons. Notes are separated by spaces; "+" joins notes played together.
// Accepted names: C D E F G A B or Do Re Mi Fa Sol La Si, with optional # / b and octave (default 4).
// `sustain` is the default for the "Oto sustain" checkbox when the song is selected.
// `tip` is shown before the song starts.
// Popular intros are short right-hand transcriptions for personal practice; rhythm is not encoded.
const SONGS = [
  {
    group: 'Popüler intro\'lar',
    title: 'Kanye West – Runaway',
    sustain: true,
    tip: 'Tek nota ile başlar: aynı Mi\'ye 15 kez, eşit aralıklarla bas.',
    notes: `E6 E6 E6 E6 E6 E6 E6 E6 E6 E6 E6 E6 E6 E6 E6
            E6 E6 E6 E5  D#6 D#6 D#6 D#5  C#6 C#6 C#6 C#5  A5 A5 G#5
            E6 E6 E6 E5  D#6 D#6 D#6 D#5  C#6 C#6 C#6 C#5  A5 A5 G#5`,
  },
  {
    group: 'Popüler intro\'lar',
    title: 'Dr. Dre – Still D.R.E.',
    sustain: false,
    tip: 'Akorlara kısa ve sert vur, hemen bırak. Her turda parmak tek tek kayar: 8 + 3 + 5 vuruş.',
    notes: `C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5
            B4+E5+A5 B4+E5+A5 B4+E5+A5  B4+E5+G5 B4+E5+G5 B4+E5+G5 B4+E5+G5 B4+E5+G5
            C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5 C5+E5+A5
            B4+E5+A5 B4+E5+A5 B4+E5+A5  B4+E5+G5 B4+E5+G5 B4+E5+G5 B4+E5+G5 B4+E5+G5`,
  },
  {
    group: 'Popüler intro\'lar',
    title: 'Linkin Park – In the End',
    sustain: true,
    tip: 'Aynı kalıp dört kez döner; son turda Fa\'da bitir ve çınlamaya bırak.',
    notes: `Eb5 Bb5 Bb5 Gb5 F5 F5 F5 F5 Gb5
            Eb5 Bb5 Bb5 Gb5 F5 F5 F5 F5 Gb5
            Eb5 Bb5 Bb5 Gb5 F5 F5 F5 F5 Gb5
            Eb5 Bb5 Bb5 Gb5 F5`,
  },
  {
    group: 'Popüler intro\'lar',
    title: 'Coldplay – Clocks',
    sustain: true,
    tip: 'Her ölçü yukarıdan aşağı üç notalık bir arpej: 3 + 3 + 2 vuruş.',
    notes: `Eb5 Bb4 G4 Eb5 Bb4 G4 Eb5 Bb4
            Db5 Bb4 F4 Db5 Bb4 F4 Db5 Bb4
            Db5 Bb4 F4 Db5 Bb4 F4 Db5 Bb4
            C5 Ab4 F4 C5 Ab4 F4 C5 Ab4
            Eb5 Bb4 G4 Eb5 Bb4 G4 Eb5 Bb4
            Db5 Bb4 F4 Db5 Bb4 F4 Db5 Bb4
            Db5 Bb4 F4 Db5 Bb4 F4 Db5 Bb4
            C5 Ab4 F4 C5 Ab4 F4 C5 Ab4`,
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
    sustain: true,
    notes: 'C4+E4+G4 C4+F4+A4 B3+D4+G4 C4+E4+G4  C3+C4+E4+G4 F3+C4+F4+A4 G3+B3+D4+G4 C3+C4+E4+G4',
  },
];
