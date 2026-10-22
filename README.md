# Lord of Sword

Ein isometrisches 3D-Hack-and-Slay-Grind im Diablo-Stil, komplett im Browser ([three.js](https://threejs.org) + Web Audio, keine Assets – alle Modelle, Texturen und Töne entstehen zur Laufzeit).
Du spielst einen anfangs ziemlich schwachen Schwertkämpfer: **Du schlägst per Klick (oder Taste) selbst zu, blockst mit dem Schild, sprintest und zauberst.**
Am Anfang stirbst du schnell – das Spiel ist auf einen langen Grind ausgelegt. Du levelst langsam, verteilst Statuspunkte,
findest Runen und kommst mit jedem Versuch ein Stück tiefer ins Untergrund-Verlies, bis du schließlich dem Boss gewachsen bist.

**Spielen:** https://simon23-12.github.io/LordOfSword/ (Desktop, Maus + Tastatur; nicht für Mobilgeräte optimiert)

## Steuerung

| Eingabe | Aktion |
| --- | --- |
| `W A S D` / Pfeiltasten | bewegen (relativ zum Bildschirm, isometrisch) |
| mittlere Maustaste | zum Mauszeiger laufen (halten = weiterlaufen) |
| linke Maustaste oder `Leertaste` | Schwerthieb Richtung Mauszeiger (halten = weiter schlagen, rastet auf Gegner in Reichweite ein) |
| rechte Maustaste oder `Q` halten | Schild (ab Level 5): blockt Angriffe aus Blickrichtung, ein Block im letzten Moment pariert ganz |
| `Shift` halten beim Laufen | Sprint (ab Level 10) – am Anfang kurz und mit sehr langer Abklingzeit |
| `1`–`5` | Zauber zum Mauszeiger wirken (der Feuerball ist zielsuchend) |
| `Esc` | Pause (dort auch Spielstand-Export/-Import) |
| `M` | Ton an/aus |
| `E` | Feuerstelle entzünden |
| `F12` | Vollbild an/aus (auch per Button im Hauptmenü) |

Alle Tasten lassen sich unter **Einstellungen → Tastenbelegung** ändern (zwei Tasten pro Aktion, auch Maustasten). Nur `Esc` ist fest.

Das Schwert trifft alle Gegner im Schwungbogen; Hiebe wechseln die Seite, haben Anlauf, Nachschwung, Schlagspur und Treffer-Stopp.

## Spielprinzip

- **Run = ein Abstieg ins Verlies** (15 Räume in 5 Zonen, am Ende der Boss Malgorath). Das Verlies ist **immer dasselbe** (gleiche Räume, gleiche Gegner und Champions) – `BAL.dungeonSeed` in `js/data.js`, `0` = zufällig. Stirbst du, gehst du ins Lager zurück – XP, Level und Runen bleiben dir.
- **XP → Statuspunkte:** Jedes Level gibt 1 Punkt. Die XP pro Level steigen stetig, die einfachen Gegner der ersten Zonen geben aber immer gleich viel – du musst also tiefer vordringen.
- **Werte:** Angriff, Verteidigung, Leben – und **Zauber**, der erst ab **Level 10** existiert. Zauber werden durch investierte Zauberpunkte freigeschaltet
  (Feuerball 1, Frostnova 6, Kettenblitz 14, Meteorsturm 26, Götterzorn 42) und werden mit jedem Punkt stärker. Der **Feuerball** sucht sich selbst ein Ziel.
- **Sprint (ab Level 10)** gehört zum **Angriffs**-Wert: Jeder Angriffspunkt verlängert den Sprint, macht ihn schneller und verkürzt die (anfangs sehr lange) Abklingzeit.
- **Schild (ab Level 5)** gehört zum **Verteidigungs**-Wert: Jeder Verteidigungspunkt erhöht den Blockwert (50 % bis fast 90 %). Der **Blockwinkel** (gilt auch für Parade und Reflexion) startet bei 180° in Blickrichtung und wächst mit dem Level bis zum Rundumblock (360°) auf Level 60. Dazu kommt **Reflexion**: Beim Blocken und Parieren besteht eine Chance (3 % je Verteidigungspunkt, max. 50 %), dass der Nahkämpfer den Schaden selbst erleidet bzw. Pfeile und andere Geschosse auf den Schützen zurückfliegen.
- **Ausrüstung ist nicht tauschbar, nur aufrüstbar:** Schwert (nach Angriffspunkten) und Schild (nach Verteidigungspunkten) bekommen in sechs Stufen ein neues Aussehen,
  und der Kämpfer selbst trägt **alle 10 Level eine neue Rüstung** (Rekrut → Soldat → … → Held der Tiefe). Im Lager siehst du den Fortschritt.
- **Runen ab Level 15:** Gegner, Champions und Bosse lassen Runen fallen (4 Seltenheitsstufen, 15 Sorten). Runenplätze: Level 15, 30, 45, 60, 75.
  Drei Runen einer Stufe lassen sich zu einer höheren veredeln.
- **Essenz (Mana-XP) ab Level 10:** Gegner lassen violette Kristalle fallen (Champions und Boss mehr, tiefere Zonen und höhere Schwierigkeit mehr wert). Im Lager unter den Runen („Zauberkunst“) werden damit Zauber verbessert: mehr Feuerbälle, längere Frostnova-Verlangsamung, mehr Kettenblitz-Sprünge, mehr Meteore und Lichtwellen.
- **Gegner skalieren nicht mit dem Helden:** Ihre Stärke hängt nur von Zone und Schwierigkeit ab – wer stark genug ist, marschiert durch die ersten Räume.
- **Start in tieferen Zonen:** Hast du alle drei Räume einer Zone gesäubert, kannst du im Lager direkt dort beginnen.
- **Schwierigkeit:** *Normal*, *Albtraum* und *Hölle* sind von Anfang an wählbar (mehr Leben/Schaden der Gegner, deutlich mehr XP und Essenz, bessere Runen).
- **Feuerstellen:** Im letzten Raum jeder Zone (außer der letzten) steht eine Feuerstelle. Ist der Raum gesäubert, kannst du sie entzünden (`E`) – dann ist der Beginn der nächsten Zone (z. B. die Katakomben) im Lager unter „Startpunkt“ (◀ ▶) wählbar.
- **Rückstoß:** Treffer schieben Gegner nur wenig zurück; der Rückstoß wächst langsam mit den Angriffspunkten.
- Der Spielstand liegt im `localStorage` des Browsers. **Export als JSON-Datei** (und Import) gibt es auf dem Titelbildschirm und im Menü *Ton & Hilfe*.

## Musik & Ton

Alles wird zur Laufzeit synthetisiert (siehe `js/audio.js`): wehmütige Gitarre in a-Moll im Lager, dunkle Drones, Glocken und Herzschlag im Dungeon
(wird bei Kämpfen dichter, pro Zone andere Tonart), Kriegstrommeln, Blechstöße und Chor im Bosskampf. Dazu synthetische Soundeffekte.

## Balancing / Grind einstellen

Alle Stellschrauben stehen in [`js/data.js`](js/data.js):

- `BAL.xpRate` – globaler XP-Faktor (kleiner = längerer Grind)
- `BAL.xpBase / xpPow / xpExp` – Kosten pro Statuspunkt
- `ZONES[i].hpM / dmgM / xpM` – Gegnerstärke und XP je Zone, `BOSS`, `DIFFS`
- `dmgGrow / hpGrow / armorGrow / spellGrow` – wie stark ein Statuspunkt wirkt

Zwei Werkzeuge helfen beim Nachjustieren (Node.js nötig):

```bash
node tools/botsim.js levels      # wie weit kommt ein einfacher Bot auf Level X?
node tools/botsim.js grind       # komplette Progression bis zum ersten Boss-Sieg (Runs / Spielminuten)
node tools/balance-sim.js        # grobes analytisches Modell
```

Der Bot kämpft nur automatisch (kein Ausweichen, kein gezieltes Zaubern) – ein menschlicher Spieler ist meist deutlich besser.
Mit den aktuellen Werten braucht der Bot für den ersten Boss-Sieg etwa 130 Runs (~4 Stunden Spielzeit).

## Entwicklung

Kein Build-Schritt für das Spiel selbst. Lokal starten, z. B. mit `python3 -m http.server` und `http://localhost:8000` öffnen (WebGL nötig).
Mit `?dev` an der URL erscheint im Lager eine kleine Cheat-Leiste (XP, Level, Runen, Freischaltungen) zum Testen.
`tools/gallery.html` zeigt alle Gegner- und Kämpfer-Modelle nebeneinander (`?set=enemies|players|poses|gear`).

three.js liegt als fertiges Bundle in `vendor/three.bundle.js` (three r171 + Bloom-Postprocessing als globales `THREE`).
Neu bauen: `cd tools/build-vendor && npm install && npm run build`.

```
index.html, css/style.css   Oberfläche
vendor/three.bundle.js      three.js (gebaut aus tools/build-vendor)
js/data.js                  Balancing, Gegner, Runen, Zauber, Ausrüstung, Formeln (auch für die Node-Tools)
js/dungeon.js               Dungeon-Generator + Wegfindung
js/game.js                  Kampf (Schwert, Schild, Sprint), Gegner-KI, Boss, Zauber, Drops – reine 2D-Logik
js/models.js                3D-Modelle aus Grundkörpern: Gegner, Kämpfer (Rüstungs-/Schwert-/Schildstufen), Requisiten
js/fx.js                    Partikel, Zaubereffekte, Projektile, Telegraphen, Pickups
js/render.js                isometrische Szene: Karte, Licht/Schatten, Bloom, Schwung-Spur, Zeigerziel
js/hud.js                   HUD-Overlay (Orbs, Leisten, Minikarte, Zahlen)
js/campscene.js             3D-Szene für Titel und Lager
js/audio.js                 Musik + Soundeffekte (Web Audio)
js/ui.js, js/main.js        Menüs, Eingabe, Hauptschleife
tools/                      Balancing-Werkzeuge, Modell-Galerie, Bundle-Build
```
