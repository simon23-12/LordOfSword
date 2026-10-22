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
    const spr = S.sprint, nspr = nA.sprint;
    const atkEff = `Schwertschaden ${f0(S.dmg)} <em>→ ${f0(nA.dmg)}</em> · Hiebe/s ${f1(1 / S.interval)} <em>→ ${f1(1 / nA.interval)}</em><br>` + (spr
      ? `Sprint ${f1(spr.dur)} s <em>→ ${f1(nspr.dur)}</em> · Pause ${f0(spr.cd)} s <em>→ ${f0(nspr.cd)}</em>`
      : `<span style="color:#8d96ad">Sprint ab Level ${BAL.sprintUnlockLevel} (${esc(Keys.labelFor('sprint'))})</span>`);
    const blk = S.block, nblk = nD.block;
    const defEff = `Schadensreduktion ${f1(S.dr * 100)}% <em>→ ${f1(nD.dr * 100)}%</em><br>` + (blk
      ? `Schild blockt ${f0(blk.red * 100)}% <em>→ ${f0(nblk.red * 100)}%</em>`
      : `<span style="color:#8d96ad">Schild ab Level ${BAL.shieldUnlockLevel} (${esc(Keys.labelFor('block'))})</span>`);
    const stats = `
      ${mk('atk', 'Angriff', atkEff)}
      ${mk('def', 'Verteidigung', defEff)}
      ${mk('vit', 'Leben', `Max. Leben ${f0(S.maxHp)} <em>→ ${f0(nV.maxHp)}</em><br>Lauftempo ${f0(S.move)} <em>→ ${f0(nV.move)}</em>`)}
      ${magLocked ? mk('mag', 'Zauber', `Die Magie erwacht ab <b style="color:#ffe08a">Level ${BAL.magicUnlockLevel}</b>.`, `Die Magie erwacht ab <b style="color:#ffe08a">Level ${BAL.magicUnlockLevel}</b>.`)
        : `<div class="stat"><div class="nm">Zauber<b>${sv.pts.mag}</b></div><button class="btn" data-act="add" data-stat="mag" ${sv.unspent > 0 ? '' : 'disabled'} data-tip="${esc('<b>Zauber +1</b>Shift-Klick: +5 Punkte')}">+</button><div class="eff">${magEff}</div><div class="spell-chips">${chips}</div></div>`}`;
    const G = LOS.GEAR, tS = LOS.gearTier(sv.pts.atk), tD = LOS.gearTier(sv.pts.def), tB = LOS.bodyTier(sv.level);
    const nextS = LOS.gearNext(sv.pts.atk), nextD = LOS.gearNext(sv.pts.def);
    const gear = `<div class="gear">
      <div class="g"><b>Schwert</b>${G.sword[tS]}<br><small>${nextS ? `nächste Stufe bei ${nextS} Angriffspunkten` : 'voll aufgerüstet'}</small></div>
      <div class="g"><b>Schild</b>${sv.level >= BAL.shieldUnlockLevel ? G.shield[tD] : 'ab Level ' + BAL.shieldUnlockLevel}<br><small>${nextD ? `nächste Stufe bei ${nextD} Verteidigungspunkten` : 'voll aufgerüstet'}</small></div>
      <div class="g" style="grid-column:1/span 2"><b>Rüstung</b>${G.body[tB]}<small> · ${tB + 1 < G.body.length ? `neue Optik auf Level ${(tB + 1) * BAL.bodyTierEvery}` : 'höchste Stufe'}</small></div>
    </div>`;
    $('panel-hero').innerHTML = `
      <h3>Krieger</h3>
      <div class="hero-head"><div class="lvl"><small>LEVEL</small>${sv.level}</div><div class="pts">Statuspunkte<br><b>${sv.unspent}</b></div></div>
      <div class="xpbar"><i style="width:${pct}%"></i></div>
      <div class="xptext"><span>${f0(sv.xp)} / ${need ? f0(need) : '—'} XP</span><span>${need ? 'Nächster Punkt in ' + f0(Math.max(0, need - sv.xp)) + ' XP' : 'Höchststufe'}</span></div>
      ${stats}
      ${gear}
      <div class="sub-h">Kampfwerte</div>
      <div class="kv">
        <span>Schaden pro Hieb</span><b>${f0(S.dmg)}</b>
        <span>Hiebe pro Sekunde</span><b>${f1(1 / S.interval)}</b>
        <span>Schaden pro Sekunde</span><b>${f0(S.dps)}</b>
        <span>Maximale Leben</span><b>${f0(S.maxHp)}</b>
        <span>Schadensreduktion</span><b>${f1(S.dr * 100)}%</b>
        ${S.block ? `<span>Blockwert (Schild)</span><b>${f0(S.block.red * 100)}%</b>` : ''}
        ${S.sprint ? `<span>Sprint / Abklingzeit</span><b>${f1(S.sprint.dur)} s / ${f0(S.sprint.cd)} s</b>` : ''}
        ${S.maxMana ? `<span>Mana / Regeneration</span><b>${f0(S.maxMana)} / ${f1(S.manaRegen)} pro s</b>` : ''}
        <span>Erfahrungsbonus</span><b>+${f0(S.rb.xp)}%</b>
      </div>
      <div class="hero-actions"><button class="btn small" data-act="respec" ${(sv.level - 1 - sv.unspent) > 0 ? '' : 'disabled'}>${A.respecArmed ? 'Sicher? Nochmal klicken' : 'Punkte zurücksetzen'}</button></div>`;
  }

  function renderRunes() {
    const sv = Save.data, el = $('runes-box');
    if (sv.level < BAL.runeUnlockLevel) {
      el.innerHTML = `<h3>Runen</h3><div class="locked-box">Uralte Runen schlummern in den Tiefen des Verlieses.<br><br>Ab <b>Level ${BAL.runeUnlockLevel}</b> kannst du sie finden und einsetzen.<br><br><span class="note">Noch ${BAL.runeUnlockLevel - sv.level} Level.<br>Weitere Runenplätze: Level ${BAL.runeSlotLevels.slice(1).join(', ')}.</span></div>`;
      return;
    }
    const slots = LOS.runeSlots(sv.level);
    let sl = '';
    for (let i = 0; i < BAL.runeSlotLevels.length; i++) {
      if (i >= slots) sl += `<div class="rune locked" data-tip="${esc('<b>Gesperrt</b>Wird auf Level ' + BAL.runeSlotLevels[i] + ' frei.')}">Level<br>${BAL.runeSlotLevels[i]}</div>`;
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

  /** Zauberkunst: Zauber mit Essenz (Mana-XP) verbessern */
  function renderSpells() {
    const sv = Save.data, el = $('spells-box');
    if (sv.level < BAL.magicUnlockLevel) { el.innerHTML = ''; return; }
    const rows = SPELLS.map((s, i) => {
      const lv = sv.spellUp[s.id] | 0, u = s.up, cost = LOS.spellUpCost(s, lv);
      const pips = Array.from({ length: u.max }, (_, k) => `<i class="${k < lv ? 'on' : ''}"></i>`).join('');
      const can = cost !== null && sv.essence >= cost;
      const eff = cost === null ? `${u.text(lv)} <em>(Maximum)</em>` : `${u.text(lv)} <em>→ ${u.text(lv + 1)}</em>`;
      const tip = `<b style="color:${s.color}">${s.name} · ${u.label}</b>${s.desc}<br>Stufe ${lv} / ${u.max}` + (cost === null ? '' : `<br>Nächste Stufe: ${cost} Essenz`);
      const btn = cost === null ? `<button class="btn" disabled>Max</button>`
        : `<button class="btn ess" data-act="spellup" data-i="${i}" ${can ? '' : 'disabled'} data-tip="${esc(can ? '<b>Verbessern</b>Kostet ' + cost + ' Essenz' : '<b>Zu wenig Essenz</b>Du brauchst ' + cost + ' (hast ' + sv.essence + ')')}">✦ ${cost}</button>`;
      return `<div class="spup ${sv.pts.mag >= s.unlock ? '' : 'locked'}"><div class="sn" style="color:${s.color}" data-tip="${esc(tip)}">${s.name}<span class="pips">${pips}</span></div>${btn}<div class="se">${eff}</div></div>`;
    }).join('');
    el.innerHTML = `<div class="sub-h">Zauberkunst <span class="ess-total">✦ Essenz <b>${f0(sv.essence)}</b></span></div>${rows}
      <div class="note" style="margin-top:2px">Essenz (violette Kristalle) lassen Gegner ab Level ${BAL.magicUnlockLevel} fallen – Champions und Bosse mehr.</div>`;
  }

  function renderStart() {
    const sv = Save.data;
    $('seg-diff').innerHTML = LOS.DIFFS.map((d, i) => `<button data-act="diff" data-i="${i}" class="${sv.difficulty === i ? 'on' : ''}" data-tip="${esc(`<b>${d.name}</b>Gegner ×${d.hp} Leben, ×${d.dmg} Schaden<br>Erfahrung ×${d.xp}, bessere Runen, mehr Essenz`)}">${d.name}</button>`).join('');
    // Startpunkt: Eingang oder eine entzündete Feuerstelle
    const spots = [0, ...sv.fires], cur = spots.includes(sv.startRoom) ? sv.startRoom : 0, zone = ZONES[Math.floor(cur / BAL.roomsPerZone)];
    $('seg-start').innerHTML = `<button data-act="start-prev" ${spots.length < 2 ? 'disabled' : ''}>◀</button><span class="start-name" data-tip="${esc(`<b>${cur ? zone.name : 'Eingang'}</b>Raum ${cur + 1} von ${LOS.NUM_ROOMS}`)}">${cur ? zone.short : 'Eingang'} · Raum ${cur + 1}</span><button data-act="start-next" ${spots.length < 2 ? 'disabled' : ''}>▶</button>`;
    $('start-hint').textContent = cur > 0 ? `Du beginnst in: ${zone.name}` : sv.unspent > 0 ? `Du hast ${sv.unspent} unverteilte Statuspunkte!` : 'Tipp: Säubere die letzte Kammer einer Zone und entzünde die Feuerstelle – dann startest du in der nächsten Zone.';
    const st = sv.stats;
    $('camp-info').innerHTML = `Rekord: Raum ${sv.bestRoom + 1} von ${LOS.NUM_ROOMS}<br>${st.runs} Versuche · ${st.deaths} gefallen · ${st.clears} Siege · ${f0(st.kills)} Gegner besiegt`;
  }

  function renderCamp() {
    renderHero(); renderRunes(); renderSpells(); renderStart();
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
  function spellUp(i) {
    const sv = Save.data, s = SPELLS[i]; if (!s) return;
    const lv = sv.spellUp[s.id] | 0, cost = LOS.spellUpCost(s, lv);
    if (cost === null || sv.essence < cost) return;
    sv.essence -= cost; sv.spellUp[s.id] = lv + 1;
    Save.write(); Sound.sfx('unlock'); hideTip(); renderSpells();
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
    A.settingsOpen = false; $('btn-abandon').classList.remove('hidden'); $('btn-resume').textContent = 'Weiter';
    $('btn-continue').disabled = !Save.exists;
    Sound.play('camp');
  }
  function hideAll() { for (const id of ['title', 'camp', 'pause', 'keys', 'end']) show(id, false); A.keysOpen = false; Keys.cancelCapture(); hideTip(); }

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

  /** Steuerungshilfe passend zur aktuellen Tastenbelegung */
  function renderHelp() {
    const L = Keys.labelFor, k = t => `<kbd>${esc(t)}</kbd>`;
    $('help-box').innerHTML = `<b>Steuerung</b><br>
      Bewegen: ${k(L('up'))} ${k(L('left'))} ${k(L('down'))} ${k(L('right'))} (relativ zum Bildschirm) · ${k(L('moveto'))}: zum Mauszeiger laufen (halten = weiterlaufen)<br>
      <b>Schwert:</b> ${k(L('attack'))} – immer Richtung Mauszeiger (halten = weiter schlagen)<br>
      <b>Schild</b> (ab Level ${BAL.shieldUnlockLevel}): ${k(L('block'))} halten – blockt Angriffe von vorn, ein Block im allerletzten Moment pariert ganz<br>
      <b>Sprint</b> (ab Level ${BAL.sprintUnlockLevel}): ${k(L('sprint'))} halten beim Laufen – lange Abklingzeit, mit Angriffspunkten besser<br>
      <b>Zauber</b> (ab Level ${BAL.magicUnlockLevel}): ${[1, 2, 3, 4, 5].map(i => k(L('spell' + i))).join(' ')} zum Mauszeiger<br>
      <b>Feuerstelle</b> (letzter Raum jeder Zone): ${k(L('interact'))} neben ihr, sobald der Raum gesäubert ist – die nächste Zone wird dein Startpunkt<br>
      ${k('Esc')} Pause · ${k(L('mute'))} Ton an/aus · ${k(L('fullscreen'))} Vollbild<br>
      Rote Kugeln heilen, blaue geben Mana, violette Kristalle (Essenz) verbessern Zauber.`;
  }

  /* ------------------------------------------------------------ Tastenbelegung */
  function renderKeys(msg) {
    $('keys-list').innerHTML = Keys.ACTIONS.map(a => {
      const s = Keys.slots(a.id);
      const btns = [0, 1].map(i => {
        const on = A.listen && A.listen.id === a.id && A.listen.slot === i;
        return `<button class="kb ${s[i] ? '' : 'empty'} ${on ? 'listen' : ''}" data-kid="${a.id}" data-kslot="${i}">${on ? 'Taste …' : esc(Keys.label(s[i]))}</button>`;
      }).join('');
      return `<div class="keys-row"><span>${a.name}</span>${btns}</div>`;
    }).join('');
    $('keys-msg').textContent = msg || '';
  }
  function openKeys() { A.keysOpen = true; A.listen = null; show('keys', true); renderKeys(); }
  function closeKeys() { Keys.cancelCapture(); A.listen = null; A.keysOpen = false; show('keys', false); renderHelp(); }

  function openSettings() {
    renderHelp();
    $('pause-title').textContent = 'Einstellungen';
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
    const levelTxt = sum.lvEnd > sum.lvStart ? `<div class="good"><span>Levelaufstieg</span><b>${sum.lvStart} → ${sum.lvEnd}</b></div>` : `<div><span>Level</span><b>${sum.lvEnd}</b></div>`;
    const runes = sum.runes.map(r => runeHtml(r)).join('');
    let note;
    if (sum.won) note = `Malgorath, der Knochenfürst, ist gefallen! Doch die Tiefe birgt noch mehr …`;
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
        ${sum.ess ? `<div class="ess"><span>Essenz</span><b>+${f0(sum.ess)}</b></div>` : ''}
        ${levelTxt}
      </div>
      ${sum.runes.length ? `<div class="sub-h" style="text-align:center">Gefundene Runen</div><div class="sum-runes">${runes}</div>` : ''}
      ${hint}
      <div class="btn-row"><button class="btn big" id="btn-tocamp" style="min-width:260px">Zurück ins Lager</button></div>`;
    $('btn-tocamp').onclick = () => { Sound.sfx('click'); toCamp(); };
  }

  /** Spielstand als JSON-Datei herunterladen */
  function exportSave() {
    if (!Save.data) { alert('Es gibt noch keinen Spielstand zum Exportieren.'); return; }
    const blob = new Blob([Save.exportJSON()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = Save.fileName();
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
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
        case 'spellup': spellUp(+t.dataset.i); break;
        case 'equip': equipSelected(); break;
        case 'unequip': unequip(+t.dataset.i); break;
        case 'fuse': fuse(); break;
        case 'discard': discard(); break;
        case 'diff': sv.difficulty = +t.dataset.i; Save.write(); Sound.sfx('click'); renderStart(); break;
        case 'start-prev': case 'start-next': {
          const spots = [0, ...sv.fires]; let i = Math.max(0, spots.indexOf(sv.startRoom));
          i = (i + (act === 'start-next' ? 1 : -1) + spots.length) % spots.length;
          sv.startRoom = spots[i]; Save.write(); Sound.sfx('click'); renderStart(); break;
        }
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
    $('btn-settings-title').onclick = () => { Sound.init(); Sound.sfx('click'); openSettings(); };
    for (const id of ['btn-fs-title', 'btn-fs-camp', 'btn-fs-pause']) $(id).onclick = () => { Sound.init(); Keys.toggleFullscreen(); };
    $('btn-keys').onclick = () => { Sound.sfx('click'); openKeys(); };
    $('btn-keys-done').onclick = () => { Sound.sfx('click'); closeKeys(); };
    $('btn-keys-reset').onclick = () => { Keys.reset(); Keys.cancelCapture(); A.listen = null; renderKeys('Standardbelegung wiederhergestellt.'); };
    $('keys').addEventListener('click', ev => {
      const b = ev.target.closest('[data-kid]'); if (!b) return;
      const id = b.dataset.kid, slot = +b.dataset.kslot;
      A.listen = { id, slot }; renderKeys();
      Keys.capture(code => {
        A.listen = null;
        let msg = '';
        if (code !== null) {
          const stolen = Keys.set(id, slot, code);
          if (stolen) msg = `„${Keys.label(code)}“ war bei „${stolen}“ belegt und wurde dort entfernt.`;
        }
        renderKeys(msg);
      });
    });
    $('btn-resume').onclick = () => { Sound.sfx('click'); if (A.settingsOpen) closeSettings(); else setPause(false); };
    $('btn-abandon').onclick = () => { setPause(false); Game.abandon(); };
    $('vol-music').oninput = e => { Sound.setMusicVol(e.target.value / 100); Save.data.settings.music = e.target.value / 100; Save.write(); };
    $('vol-sfx').oninput = e => { Sound.setSfxVol(e.target.value / 100); Save.data.settings.sfx = e.target.value / 100; Save.write(); };
    $('btn-export').onclick = e => { e.preventDefault(); exportSave(); };
    $('btn-export2').onclick = () => { Sound.sfx('click'); exportSave(); };
    $('btn-import').onclick = e => { e.preventDefault(); $('file-import').click(); };
    $('btn-import2').onclick = () => { Sound.sfx('click'); if (A.mode === 'run') { alert('Importieren ist nur im Lager oder auf dem Titelbildschirm möglich.'); return; } $('file-import').click(); };
    $('file-import').onchange = e => {
      const f = e.target.files && e.target.files[0]; e.target.value = '';
      if (!f) return;
      const rd = new FileReader();
      rd.onload = () => {
        try {
          if (Save.exists && !confirm('Den aktuellen Spielstand durch die Datei ersetzen?')) return;
          Save.importJSON(String(rd.result));
          if (A.settingsOpen) closeSettings();
          if (A.mode === 'camp') toCamp(); else toTitle();
          alert('Spielstand geladen (Level ' + Save.data.level + ').');
        } catch (err) { alert('Die Datei ist kein gültiger Spielstand.'); }
      };
      rd.readAsText(f);
    };
    Game.onEnd = showEnd;
    if (/[?&]dev/.test(location.search)) devBox();
  }

  function devBox() {
    const b = $('devbox'); b.classList.remove('hidden');
    const add = (label, fn) => { const x = document.createElement('button'); x.className = 'btn tiny'; x.textContent = label; x.onclick = () => { if (!Save.data) Save.create(); fn(); Save.write(); if (A.mode === 'camp') renderCamp(); else if (A.mode === 'title') toCamp(); }; b.appendChild(x); };
    const xp = n => { const sv = Save.data; sv.xp += n; while (sv.level < BAL.maxLevel && sv.xp >= LOS.xpNeed(sv.level)) { sv.xp -= LOS.xpNeed(sv.level); sv.level++; sv.unspent++; } };
    add('+1k XP', () => xp(1000)); add('+20k XP', () => xp(20000)); add('+300k XP', () => xp(300000));
    add('Level 40', () => { const sv = Save.data; while (sv.level < 40) { sv.level++; sv.unspent++; } });
    add('5 Runen', () => { for (let i = 0; i < 5; i++) Save.data.runes.push({ id: LOS.RUNES[Math.floor(Math.random() * LOS.RUNES.length)].id, tier: Math.floor(Math.random() * 3) }); });
    add('+200 Essenz', () => { Save.data.essence += 200; });
    add('Alle Feuer', () => { Save.data.fires = Array.from({ length: LOS.NUM_ROOMS - 2 }, (_, i) => i + 1); });
    add('Reset', () => { Save.wipe(); Save.create(); });
  }

  Object.assign(A, { init, toTitle, toCamp, startRun, setPause, closeSettings, closeKeys, showEnd, renderCamp, hideTip });
  return A;
})();
