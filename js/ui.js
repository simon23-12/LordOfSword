/* Lord of Sword – Menüs: Titel, Lager (Werte, Runen, Start), Pause, Run-Ende */
const App = (function () {
  'use strict';
  const BAL = LOS.BAL, SPELLS = LOS.SPELLS, ZONES = LOS.ZONES;
  const $ = id => document.getElementById(id);
  const A = { mode: 'title', paused: false, scale: 1, selRune: null, respecArmed: false };

  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const f0 = n => Math.round(n).toLocaleString('de-DE');
  const f1 = n => n.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

  const equippedList = () => Save.data.equipped.slice(0, LOS.runeSlots(Save.data.level)).filter(Boolean);
  const derived = (pts) => LOS.derive(Save.data.level, pts || Save.data.pts, equippedList());

  /* ------------------------------------------------------------ Runen-HTML */
  function runeHtml(r, extra) {
    const d = LOS.RUNE_BY_ID[r.id], t = LOS.TIERS[r.tier];
    const tip = `<b style="color:${t.color}">${d.glyph} ${d.name}</b><span style="color:${t.color}">${t.name}</span><br>${LOS.runeText(r)}`;
    return `<div class="rune t${r.tier} ${extra || ''}" data-tip="${esc(tip)}">${d.glyph}</div>`;
  }

  /* ------------------------------------------------------------ Lager rendern */
  function renderHero() {
    const sv = Save.data, S = derived();
    const need = sv.level >= BAL.maxLevel ? 0 : LOS.xpNeed(sv.level);
    const pct = need ? Math.min(100, sv.xp / need * 100) : 100;
    const mk = (stat, name, eff, locked) => {
      if (locked) return `<div class="stat locked"><div class="nm">${name}</div><div class="eff" style="grid-column:1/span 2">${locked}</div></div>`;
      return `<div class="stat"><div class="nm">${name}<b>${sv.pts[stat]}</b></div>
        <button class="btn" data-act="add" data-stat="${stat}" ${sv.unspent > 0 ? '' : 'disabled'} data-tip="${esc('<b>' + name + ' +1</b>Shift-Klick: +5 Punkte')}">+</button>
        <div class="eff">${eff}</div></div>`;
    };
    const pn = k => derived({ ...sv.pts, [k]: sv.pts[k] + 1 });
    const nA = pn('atk'), nD = pn('def'), nV = pn('vit'), nM = pn('mag');
    const magLocked = sv.level < BAL.magicUnlockLevel;
    const magEff = S.maxMana
      ? `Mana ${f0(S.maxMana)} <em>→ ${f0(nM.maxMana)}</em> · Zauberstärke ×${f1(LOS.spellPower(1, S.mag, 0))} <em>→ ×${f1(LOS.spellPower(1, nM.mag, 0))}</em>`
      : `Erster Punkt öffnet das Mana <em>→ ${f0(nM.maxMana)}</em>`;
    const chips = SPELLS.map(s => `<span class="chip ${sv.pts.mag >= s.unlock ? 'on' : ''}" data-tip="${esc(`<b style="color:${s.color}">${s.name}</b>${s.desc}<br>Kosten ${s.cost} Mana · Taste ${s.key}`)}">${s.name} · ${s.unlock}</span>`).join('');
    const stats = `
      ${mk('atk', 'Angriff', `Schwertschaden ${f0(S.dmg)} <em>→ ${f0(nA.dmg)}</em>`)}
      ${mk('def', 'Verteidigung', `Schadensreduktion ${f1(S.dr * 100)}% <em>→ ${f1(nD.dr * 100)}%</em>`)}
      ${mk('vit', 'Leben', `Max. Leben ${f0(S.maxHp)} <em>→ ${f0(nV.maxHp)}</em>`)}
      ${magLocked ? mk('mag', 'Zauber', `Die Magie erwacht ab <b style="color:#ffe08a">Stufe ${BAL.magicUnlockLevel}</b>.`, `Die Magie erwacht ab <b style="color:#ffe08a">Stufe ${BAL.magicUnlockLevel}</b>.`)
        : `<div class="stat"><div class="nm">Zauber<b>${sv.pts.mag}</b></div><button class="btn" data-act="add" data-stat="mag" ${sv.unspent > 0 ? '' : 'disabled'} data-tip="${esc('<b>Zauber +1</b>Shift-Klick: +5 Punkte')}">+</button><div class="eff">${magEff}</div><div class="spell-chips">${chips}</div></div>`}`;
    $('panel-hero').innerHTML = `
      <h3>Krieger</h3>
      <div class="hero-head"><div class="lvl"><small>STUFE</small>${sv.level}</div><div class="pts">Statuspunkte<br><b>${sv.unspent}</b></div></div>
      <div class="xpbar"><i style="width:${pct}%"></i></div>
      <div class="xptext"><span>${f0(sv.xp)} / ${need ? f0(need) : '—'} XP</span><span>${need ? 'Nächster Punkt in ' + f0(Math.max(0, need - sv.xp)) + ' XP' : 'Höchststufe'}</span></div>
      ${stats}
      <div class="sub-h">Kampfwerte</div>
      <div class="kv">
        <span>Schaden pro Hieb</span><b>${f0(S.dmg)}</b>
        <span>Hiebe pro Sekunde</span><b>${f1(1 / S.interval)}</b>
        <span>Schaden pro Sekunde</span><b>${f0(S.dps)}</b>
        <span>Maximale Leben</span><b>${f0(S.maxHp)}</b>
        <span>Schadensreduktion</span><b>${f1(S.dr * 100)}%</b>
        ${S.maxMana ? `<span>Mana / Regeneration</span><b>${f0(S.maxMana)} / ${f1(S.manaRegen)} pro s</b>` : ''}
        <span>Erfahrungsbonus</span><b>+${f0(S.rb.xp)}%</b>
      </div>
      <div class="hero-actions"><button class="btn small" data-act="respec" ${(sv.level - 1 - sv.unspent) > 0 ? '' : 'disabled'}>${A.respecArmed ? 'Sicher? Nochmal klicken' : 'Punkte zurücksetzen'}</button></div>`;
  }

  function renderRunes() {
    const sv = Save.data, el = $('panel-runes');
    if (sv.level < BAL.runeUnlockLevel) {
      el.innerHTML = `<h3>Runen</h3><div class="locked-box">Uralte Runen schlummern in den Tiefen des Verlieses.<br><br>Ab <b>Stufe ${BAL.runeUnlockLevel}</b> kannst du sie finden und einsetzen.<br><br><span class="note">Noch ${BAL.runeUnlockLevel - sv.level} Stufe${BAL.runeUnlockLevel - sv.level > 1 ? 'n' : ''}.<br>Weitere Runenplätze: Stufe ${BAL.runeSlotLevels.slice(1).join(', ')}.</span></div>`;
      return;
    }
    const slots = LOS.runeSlots(sv.level);
    let sl = '';
    for (let i = 0; i < BAL.runeSlotLevels.length; i++) {
      if (i >= slots) sl += `<div class="rune locked" data-tip="${esc('<b>Gesperrt</b>Wird auf Stufe ' + BAL.runeSlotLevels[i] + ' frei.')}">Stufe<br>${BAL.runeSlotLevels[i]}</div>`;
      else if (sv.equipped[i]) sl += `<div data-act="unequip" data-i="${i}">${runeHtml(sv.equipped[i])}</div>`;
      else sl += `<div class="rune empty">leer</div>`;
    }
    sv.runes.sort((a, b) => b.tier - a.tier || a.id.localeCompare(b.id));
    const inv = sv.runes.map((r, i) => `<div data-act="sel" data-i="${i}">${runeHtml(r, r === A.selRune ? 'sel' : '')}</div>`).join('');
    let detail = `<div class="note">Klicke eine Rune im Beutel, um sie auszurüsten oder zu veredeln. Ausgerüstete Runen legst du mit einem Klick wieder ab.<br><br><b style="color:var(--gold)">Veredeln:</b> Zwei weitere Runen der gleichen Stufe werden geopfert, die gewählte steigt eine Stufe auf.</div>`;
    const r = A.selRune && sv.runes.includes(A.selRune) ? A.selRune : null;
    if (r) {
      const d = LOS.RUNE_BY_ID[r.id], t = LOS.TIERS[r.tier];
      const others = sv.runes.filter(x => x !== r && x.tier === r.tier).length;
      const can = r.tier < 3 && others >= 2;
      detail = `<div class="rn" style="color:${t.color}">${d.glyph} Rune der ${d.name}</div><div style="color:${t.color}">${t.name}</div><div>${LOS.runeText(r)}</div>
        ${r.tier < 3 ? `<div class="note" style="margin-top:4px">Nächste Stufe (${LOS.TIERS[r.tier + 1].name}): ${d.fmt(d.vals[r.tier + 1])}</div>` : ''}
        <div class="btns"><button class="btn small" data-act="equip">Ausrüsten</button>
        ${r.tier < 3 ? `<button class="btn small" data-act="fuse" ${can ? '' : 'disabled'} data-tip="${esc(can ? '<b>Veredeln</b>Opfert 2 weitere Runen der Stufe ' + t.name : '<b>Veredeln</b>Du brauchst 2 weitere Runen der Stufe ' + t.name + ' (hast ' + others + ')')}">Veredeln</button>` : ''}
        <button class="btn small danger" data-act="discard">Verwerfen</button></div>`;
    }
    el.innerHTML = `<h3>Runen</h3><div class="slots">${sl}</div>
      <div class="sub-h">Beutel <span style="float:right;color:var(--ink-dim)">${sv.runes.length} / 60</span></div>
      <div class="inv">${inv || '<div class="note" style="grid-column:1/-1;text-align:center;padding:14px 0">Noch keine Runen gefunden.<br>Gegner, Champions und Bosse lassen sie fallen.</div>'}</div>
      <div class="detail">${detail}</div>`;
  }

  function renderStart() {
    const sv = Save.data;
    $('seg-diff').innerHTML = LOS.DIFFS.map((d, i) => `<button data-act="diff" data-i="${i}" class="${sv.difficulty === i ? 'on' : ''}" ${i > sv.diffUnlocked ? 'disabled' : ''} data-tip="${esc(i > sv.diffUnlocked ? '<b>Gesperrt</b>Besiege Malgorath auf ' + LOS.DIFFS[i - 1].name + '.' : `<b>${d.name}</b>Gegner ×${d.hp} Leben, ×${d.dmg} Schaden<br>Erfahrung ×${d.xp}, bessere Runen`)}">${d.name}</button>`).join('');
    if (sv.startZone > sv.zoneUnlock) sv.startZone = sv.zoneUnlock;
    $('seg-zone').innerHTML = ZONES.map((z, i) => `<button data-act="zone" data-i="${i}" class="${sv.startZone === i ? 'on' : ''}" ${i > sv.zoneUnlock ? 'disabled' : ''} data-tip="${esc(i > sv.zoneUnlock ? '<b>Gesperrt</b>Säubere zuerst alle drei Räume von ' + ZONES[i - 1].name + '.' : `<b>${z.name}</b>Raum ${i * BAL.roomsPerZone + 1} von ${LOS.NUM_ROOMS}`)}">${['I', 'II', 'III', 'IV', 'V'][i]}</button>`).join('');
    $('start-hint').textContent = sv.startZone > 0 ? `Du beginnst in: ${ZONES[sv.startZone].name}` : sv.unspent > 0 ? `Du hast ${sv.unspent} unverteilte Statuspunkte!` : 'Tipp: Je tiefer du kommst, desto mehr XP bringen die Gegner.';
    const st = sv.stats;
    $('camp-info').innerHTML = `Rekord: Raum ${sv.bestRoom + 1} von ${LOS.NUM_ROOMS}<br>${st.runs} Versuche · ${st.deaths} gefallen · ${st.clears} Siege · ${f0(st.kills)} Gegner besiegt`;
  }

  function renderCamp() {
    renderHero(); renderRunes(); renderStart();
  }

  /* ------------------------------------------------------------ Aktionen */
  function addPoints(stat, n) {
    const sv = Save.data;
    if (stat === 'mag' && sv.level < BAL.magicUnlockLevel) return;
    n = Math.min(n, sv.unspent);
    if (n <= 0) return;
    sv.pts[stat] += n; sv.unspent -= n;
    Save.write(); Sound.sfx('click'); renderHero(); renderStart();
  }
  function respec() {
    const sv = Save.data;
    if (!A.respecArmed) { A.respecArmed = true; renderHero(); setTimeout(() => { A.respecArmed = false; if (A.mode === 'camp') renderHero(); }, 3000); return; }
    A.respecArmed = false;
    sv.pts = { atk: 0, def: 0, vit: 0, mag: 0 }; sv.unspent = sv.level - 1;
    Save.write(); Sound.sfx('click'); renderCamp();
  }
  function equipSelected() {
    const sv = Save.data, r = A.selRune; if (!r) return;
    const slots = LOS.runeSlots(sv.level);
    let idx = -1;
    for (let i = 0; i < slots; i++) if (!sv.equipped[i]) { idx = i; break; }
    if (idx < 0) { A.msg = 'Alle Runenplätze belegt – lege zuerst eine Rune ab.'; tipMsg('Alle Runenplätze belegt – lege zuerst eine Rune ab.'); return; }
    sv.runes.splice(sv.runes.indexOf(r), 1);
    sv.equipped[idx] = r; A.selRune = null;
    Save.write(); Sound.sfx('rune'); renderCamp();
  }
  function unequip(i) {
    const sv = Save.data, r = sv.equipped[i]; if (!r) return;
    if (sv.runes.length >= 60) { tipMsg('Der Runenbeutel ist voll.'); return; }
    sv.equipped[i] = null; sv.runes.push(r);
    Save.write(); Sound.sfx('click'); hideTip(); renderCamp();
  }
  function fuse() {
    const sv = Save.data, r = A.selRune; if (!r || r.tier >= 3) return;
    const others = sv.runes.filter(x => x !== r && x.tier === r.tier);
    if (others.length < 2) return;
    // Doppelte der gleichen Rune zuerst opfern, dann Rest
    others.sort((a, b) => (b.id === r.id) - (a.id === r.id));
    const kill = others.slice(0, 2);
    sv.runes = sv.runes.filter(x => !kill.includes(x));
    r.tier++;
    Save.write(); Sound.sfx('unlock'); renderCamp();
  }
  function discard() {
    const sv = Save.data, r = A.selRune; if (!r) return;
    sv.runes.splice(sv.runes.indexOf(r), 1); A.selRune = null;
    Save.write(); Sound.sfx('click'); hideTip(); renderCamp();
  }

  /* ------------------------------------------------------------ Tooltip */
  let tipTimer = null;
  function showTip(html, x, y) {
    const t = $('tip'); t.innerHTML = html; t.classList.remove('hidden');
    const w = t.offsetWidth, h = t.offsetHeight;
    t.style.left = Math.max(4, Math.min(1280 - w - 4, x + 14)) + 'px';
    t.style.top = Math.max(4, Math.min(720 - h - 4, y + 16)) + 'px';
  }
  function hideTip() { $('tip').classList.add('hidden'); }
  function tipMsg(m) { showTip(esc(m), 640, 360); clearTimeout(tipTimer); tipTimer = setTimeout(hideTip, 1800); }

  /* ------------------------------------------------------------ Screens */
  function show(id, on) { $(id).classList.toggle('hidden', !on); }

  function toTitle() {
    A.mode = 'title'; Game.clear(); hideAll(); show('title', true);
    $('btn-continue').disabled = !Save.exists;
    Sound.play('camp');
  }
  function hideAll() { for (const id of ['title', 'camp', 'pause', 'end']) show(id, false); hideTip(); }

  function toCamp() {
    A.mode = 'camp'; A.paused = false; Game.clear(); hideAll(); show('camp', true);
    A.selRune = null; A.respecArmed = false;
    Sound.setIntensity(0); Sound.play('camp');
    renderCamp();
    Save.write();
  }

  function startRun() {
    const sv = Save.data;
    Sound.init();
    hideAll(); A.mode = 'run'; A.paused = false;
    Game.startRun();
  }

  function setPause(on) {
    if (A.mode !== 'run' || (Game.R && Game.R.over)) return;
    A.paused = on; show('pause', on);
    $('pause-title').textContent = 'Pause';
    if (on) { $('vol-music').value = Sound.vol.music * 100; $('vol-sfx').value = Sound.vol.sfx * 100; }
  }

  function openSettings() {
    $('pause-title').textContent = 'Ton & Hilfe';
    $('btn-abandon').classList.add('hidden');
    $('btn-resume').textContent = 'Schließen';
    $('vol-music').value = Sound.vol.music * 100; $('vol-sfx').value = Sound.vol.sfx * 100;
    show('pause', true); A.settingsOpen = true;
  }
  function closeSettings() {
    show('pause', false); A.settingsOpen = false;
    $('btn-abandon').classList.remove('hidden');
    $('btn-resume').textContent = 'Weiter';
  }

  function fmtTime(s) { const m = Math.floor(s / 60), sec = Math.floor(s % 60); return `${m}:${String(sec).padStart(2, '0')}`; }

  function showEnd(sum) {
    A.mode = 'end'; show('end', true); show('pause', false);
    const sv = Save.data;
    const levelTxt = sum.lvEnd > sum.lvStart ? `<div class="good"><span>Stufenaufstieg</span><b>${sum.lvStart} → ${sum.lvEnd}</b></div>` : `<div><span>Stufe</span><b>${sum.lvEnd}</b></div>`;
    const runes = sum.runes.map(r => runeHtml(r)).join('');
    let note;
    if (sum.won) note = `Malgorath, der Knochenfürst, ist gefallen! Doch die Tiefe birgt noch mehr …${sum.unlockedDiff ? `<br><b style="color:#ffe08a">Neue Schwierigkeit freigeschaltet: ${LOS.DIFFS[sum.unlockedDiff].name}</b>` : ''}`;
    else if (sum.quit) note = 'Du hast dich zurückgezogen.';
    else if (sum.newBest) note = `Neuer Rekord – du bist bis Raum ${sum.room} vorgedrungen!`;
    else note = sum.room <= 2 ? 'Das Verlies ist gnadenlos. Aber jeder Tod macht dich stärker.' : 'Die Tiefe fordert ihren Tribut. Verteile deine Punkte und versuche es erneut.';
    const hint = sv.unspent > 0 ? `<div class="sum-note" style="color:#ffe08a">Du hast ${sv.unspent} unverteilte Statuspunkt${sv.unspent > 1 ? 'e' : ''}!</div>` : '';
    $('end-box').innerHTML = `
      <h2 class="${sum.won ? 'win' : 'dead'}">${sum.won ? 'Sieg!' : sum.quit ? 'Rückzug' : 'Gefallen'}</h2>
      <div class="sum-note">${note}</div>
      <div class="sum">
        <div><span>Tiefste Stelle</span><b>Raum ${sum.room} / ${LOS.NUM_ROOMS}</b></div>
        <div><span>Rekord</span><b>Raum ${sum.bestRoom}</b></div>
        <div><span>Gegner besiegt</span><b>${sum.kills}</b></div>
        <div><span>Spielzeit</span><b>${fmtTime(sum.time)}</b></div>
        <div class="good"><span>Erfahrung</span><b>+${f0(sum.xp)} XP</b></div>
        ${levelTxt}
      </div>
      ${sum.runes.length ? `<div class="sub-h" style="text-align:center">Gefundene Runen</div><div class="sum-runes">${runes}</div>` : ''}
      ${hint}
      <div class="btn-row"><button class="btn big" id="btn-tocamp" style="min-width:260px">Zurück ins Lager</button></div>`;
    $('btn-tocamp').onclick = () => { Sound.sfx('click'); toCamp(); };
  }

  /* ------------------------------------------------------------ Init */
  function init() {
    // Klicks im Lager (Delegation)
    $('camp').addEventListener('click', ev => {
      const t = ev.target.closest('[data-act]'); if (!t) return;
      const act = t.dataset.act, sv = Save.data;
      switch (act) {
        case 'add': addPoints(t.dataset.stat, ev.shiftKey ? 5 : 1); break;
        case 'respec': respec(); break;
        case 'sel': A.selRune = sv.runes[+t.dataset.i]; Sound.sfx('click'); renderRunes(); break;
        case 'equip': equipSelected(); break;
        case 'unequip': unequip(+t.dataset.i); break;
        case 'fuse': fuse(); break;
        case 'discard': discard(); break;
        case 'diff': sv.difficulty = +t.dataset.i; Save.write(); Sound.sfx('click'); renderStart(); break;
        case 'zone': sv.startZone = +t.dataset.i; Save.write(); Sound.sfx('click'); renderStart(); break;
      }
    });
    // Tooltips
    $('stage').addEventListener('mousemove', ev => {
      const t = ev.target.closest && ev.target.closest('[data-tip]');
      if (!t) { if (!tipTimer) hideTip(); return; }
      const r = $('stage').getBoundingClientRect();
      showTip(t.dataset.tip, (ev.clientX - r.left) / A.scale, (ev.clientY - r.top) / A.scale);
    });
    $('btn-start').onclick = () => { Sound.sfx('click'); startRun(); };
    $('btn-continue').onclick = () => { Sound.init(); Sound.sfx('click'); toCamp(); };
    $('btn-new').onclick = () => {
      Sound.init();
      if (Save.exists && !confirm('Bestehenden Spielstand löschen und neu beginnen?')) return;
      Save.wipe(); Save.create(); toCamp();
    };
    $('btn-settings').onclick = () => { Sound.sfx('click'); openSettings(); };
    $('btn-resume').onclick = () => { Sound.sfx('click'); if (A.settingsOpen) closeSettings(); else setPause(false); };
    $('btn-abandon').onclick = () => { setPause(false); Game.abandon(); };
    $('vol-music').oninput = e => { Sound.setMusicVol(e.target.value / 100); Save.data.settings.music = e.target.value / 100; Save.write(); };
    $('vol-sfx').oninput = e => { Sound.setSfxVol(e.target.value / 100); Save.data.settings.sfx = e.target.value / 100; Save.write(); };
    $('btn-export').onclick = e => {
      e.preventDefault(); if (!Save.exists) return;
      const code = Save.exportCode();
      if (navigator.clipboard) navigator.clipboard.writeText(code).then(() => alert('Spielstand-Code in die Zwischenablage kopiert.')).catch(() => prompt('Spielstand-Code:', code));
      else prompt('Spielstand-Code:', code);
    };
    $('btn-import').onclick = e => {
      e.preventDefault();
      const code = prompt('Spielstand-Code einfügen:'); if (!code) return;
      try { Save.importCode(code); toTitle(); alert('Spielstand geladen.'); } catch (err) { alert('Der Code ist ungültig.'); }
    };
    Game.onEnd = showEnd;
    if (/[?&]dev/.test(location.search)) devBox();
  }

  function devBox() {
    const b = $('devbox'); b.classList.remove('hidden');
    const add = (label, fn) => { const x = document.createElement('button'); x.className = 'btn tiny'; x.textContent = label; x.onclick = () => { if (!Save.data) Save.create(); fn(); Save.write(); if (A.mode === 'camp') renderCamp(); else if (A.mode === 'title') toCamp(); }; b.appendChild(x); };
    const xp = n => { const sv = Save.data; sv.xp += n; while (sv.level < BAL.maxLevel && sv.xp >= LOS.xpNeed(sv.level)) { sv.xp -= LOS.xpNeed(sv.level); sv.level++; sv.unspent++; } };
    add('+1k XP', () => xp(1000)); add('+20k XP', () => xp(20000)); add('+300k XP', () => xp(300000));
    add('Stufe 40', () => { const sv = Save.data; while (sv.level < 40) { sv.level++; sv.unspent++; } });
    add('5 Runen', () => { for (let i = 0; i < 5; i++) Save.data.runes.push({ id: LOS.RUNES[Math.floor(Math.random() * LOS.RUNES.length)].id, tier: Math.floor(Math.random() * 3) }); });
    add('Alles frei', () => { Save.data.zoneUnlock = 4; Save.data.diffUnlocked = 2; });
    add('Reset', () => { Save.wipe(); Save.create(); });
  }

  Object.assign(A, { init, toTitle, toCamp, startRun, setPause, closeSettings, showEnd, renderCamp, hideTip });
  return A;
})();
