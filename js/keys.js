/* Lord of Sword – Tastenbelegung: frei wählbar, zwei Tasten pro Aktion (Esc und die Maus sind fest) */
const Keys = (function () {
  'use strict';
  const spell = i => ({ id: 'spell' + (i + 1), name: 'Zauber ' + (i + 1), def: ['Digit' + (i + 1), 'Numpad' + (i + 1)] });
  const ACTIONS = [
    { id: 'up', name: 'Hoch', def: ['KeyW', 'ArrowUp'] },
    { id: 'down', name: 'Runter', def: ['KeyS', 'ArrowDown'] },
    { id: 'left', name: 'Links', def: ['KeyA', 'ArrowLeft'] },
    { id: 'right', name: 'Rechts', def: ['KeyD', 'ArrowRight'] },
    { id: 'moveto', name: 'Zum Mauszeiger laufen', def: ['Mouse1', ''] },
    { id: 'attack', name: 'Schwerthieb', def: ['Mouse0', 'Space'] },
    { id: 'block', name: 'Schild', def: ['Mouse2', 'KeyQ'] },
    { id: 'sprint', name: 'Sprint', def: ['ShiftLeft', 'ShiftRight'] },
    { id: 'interact', name: 'Feuerstelle entzünden', def: ['KeyE', ''] },
    spell(0), spell(1), spell(2), spell(3), spell(4),
    { id: 'mute', name: 'Ton an/aus', def: ['KeyM', ''] },
    { id: 'fullscreen', name: 'Vollbild', def: ['F12', ''] },
  ];
  const BY_ID = {};
  ACTIONS.forEach(a => (BY_ID[a.id] = a));
  const RESERVED = ['Escape'];

  const settings = () => (typeof Save !== 'undefined' && Save.data && Save.data.settings) || null;

  /** [Taste 1, Taste 2] einer Aktion ('' = leer) */
  function slots(id) {
    const st = settings(), o = st && st.keys && st.keys[id];
    return o ? [o[0] || '', o[1] || ''] : BY_ID[id].def.slice();
  }
  /** Ist eine der Tasten der Aktion gerade gedrückt? */
  function down(id) {
    const k = Input.keys, s = slots(id);
    return !!((s[0] && k[s[0]]) || (s[1] && k[s[1]]));
  }
  /** Aktionen, die an diese Taste gebunden sind */
  function actionsFor(code) {
    const r = [];
    for (const a of ACTIONS) if (slots(a.id).includes(code)) r.push(a.id);
    return r;
  }

  function label(code) {
    if (!code) return '–';
    const named = { Space: 'Leertaste', ShiftLeft: 'Shift links', ShiftRight: 'Shift rechts', ControlLeft: 'Strg links', ControlRight: 'Strg rechts',
      AltLeft: 'Alt links', AltRight: 'Alt rechts', ArrowUp: '↑', ArrowDown: '↓', ArrowLeft: '←', ArrowRight: '→', Enter: 'Enter', Tab: 'Tab',
      Backquote: '^', Minus: 'ß', Equal: '´', Comma: ',', Period: '.', Slash: '-', Semicolon: 'Ö', Quote: 'Ä', BracketLeft: 'Ü', BracketRight: '+' };
    if (/^Mouse\d$/.test(code)) return ['Maus links', 'Maus Mitte', 'Maus rechts'][+code[5]] || 'Maus ' + code[5];
    if (named[code]) return named[code];
    let m;
    if ((m = /^Key([A-Z])$/.exec(code))) return m[1];
    if ((m = /^Digit(\d)$/.exec(code))) return m[1];
    if ((m = /^Numpad(\d)$/.exec(code))) return 'Num ' + m[1];
    return code;
  }
  /** Lesbare Tasten einer Aktion, z. B. "E" oder "Leertaste / J" */
  function labelFor(id) {
    const s = slots(id).filter(Boolean);
    return s.length ? s.map(label).join(' / ') : 'keine Taste';
  }

  /** Taste neu belegen; eine schon vergebene Taste wird der anderen Aktion weggenommen. Liefert deren Namen oder null. */
  function set(id, slot, code) {
    const st = settings(); if (!st) return null;
    st.keys = st.keys || {};
    const ensure = a => { if (!st.keys[a]) st.keys[a] = slots(a); };
    let stolen = null;
    if (code) {
      for (const a of ACTIONS) {
        const s = slots(a.id);
        for (let i = 0; i < 2; i++) {
          if (s[i] === code && !(a.id === id && i === slot)) { ensure(a.id); st.keys[a.id][i] = ''; if (a.id !== id) stolen = a.name; }
        }
      }
    }
    ensure(id);
    st.keys[id][slot] = code;
    Save.write();
    return stolen;
  }
  function reset() { const st = settings(); if (st) { delete st.keys; Save.write(); } }

  /* ---------------------------------------------------------- Taste abfragen (für das Umbelegen im Menü) */
  let listening = null;
  if (typeof window !== 'undefined') window.addEventListener('keydown', e => {
    if (!listening) return;
    e.preventDefault(); e.stopImmediatePropagation();
    if (e.repeat) return;
    const cb = listening; listening = null;
    if (e.code === 'Escape') cb(null);                          // abbrechen
    else if (e.code === 'Delete' || e.code === 'Backspace') cb(''); // leeren
    else cb(e.code);
  }, true);
  // Maustasten beim Umbelegen: Klicks auf Buttons brechen nur ab, alles andere wird zur Taste
  let menuUntil = 0;
  if (typeof window !== 'undefined') {
    window.addEventListener('mousedown', e => {
      if (!listening) return;
      if (e.target.closest && e.target.closest('button')) { listening = null; return; }
      e.preventDefault(); e.stopImmediatePropagation();
      const cb = listening; listening = null; menuUntil = Date.now() + 400;
      cb('Mouse' + e.button);
    }, true);
    window.addEventListener('contextmenu', e => { if (listening || Date.now() < menuUntil) e.preventDefault(); }, true);
  }
  const capture = cb => { listening = cb; };
  const cancelCapture = () => { listening = null; };

  /* ---------------------------------------------------------- Vollbild */
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
  }
  if (typeof document !== 'undefined') document.addEventListener('fullscreenchange', () => {
    for (const b of document.querySelectorAll('.fs-btn')) b.textContent = document.fullscreenElement ? 'Vollbild beenden' : 'Vollbild';
  });

  return { ACTIONS, RESERVED, slots, down, actionsFor, label, labelFor, set, reset, capture, cancelCapture, toggleFullscreen };
})();
