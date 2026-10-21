# Lord of Sword

Ein Hack-and-Slay-Grind im Diablo-Stil, komplett im Browser (Canvas + Web Audio, keine Bibliotheken, keine Assets).
Du spielst einen anfangs ziemlich schwachen Schwertkämpfer: **Du steuerst, das Schwert schlägt von allein zu.**
Am Anfang stirbst du schnell – das Spiel ist auf einen langen Grind ausgelegt. Du levelst langsam, verteilst Statuspunkte,
findest Runen und kommst mit jedem Versuch ein Stück tiefer ins Untergrund-Verlies, bis du schließlich dem Boss gewachsen bist.

**Spielen:** https://simon23-12.github.io/LordOfSword/ (Desktop, Maus + Tastatur; nicht für Mobilgeräte optimiert)

## Steuerung

| Eingabe | Aktion |
| --- | --- |
| `W A S D` / Pfeiltasten | bewegen |
| linke Maustaste (halten) | zum Mauszeiger laufen |
| `1`–`5` | Zauber zum Mauszeiger wirken |
| rechte Maustaste | zuletzt gewählten Zauber wirken |
| `Esc` | Pause |
| `M` | Ton an/aus |

Das Schwert greift automatisch den nächsten Gegner in Reichweite an und trifft alle Gegner im Schwungbogen.

## Spielprinzip

- **Run = ein Abstieg ins Verlies** (15 Räume in 5 Zonen, am Ende der Boss Malgorath). Stirbst du, gehst du ins Lager zurück – XP, Level und Runen bleiben dir.
- **XP → Statuspunkte:** Jede Stufe gibt 1 Punkt. Die XP pro Stufe steigen stetig, die einfachen Gegner der ersten Zonen geben aber immer gleich viel – du musst also tiefer vordringen.
- **Werte:** Angriff, Verteidigung, Leben – und **Zauber**, der erst ab **Stufe 11** existiert. Zauber werden durch investierte Zauberpunkte freigeschaltet
  (Feuerball 1, Frostnova 6, Kettenblitz 14, Meteorsturm 26, Götterzorn 42) und werden mit jedem Punkt stärker.
- **Runen ab Stufe 15:** Gegner, Champions und Bosse lassen Runen fallen (4 Seltenheitsstufen, 15 Sorten). Runenplätze: Stufe 15, 30, 45, 60, 75.
  Drei Runen einer Stufe lassen sich zu einer höheren veredeln.
- **Start in tieferen Zonen:** Hast du alle drei Räume einer Zone gesäubert, kannst du im Lager direkt dort beginnen.
- **Nach dem Boss:** Schwierigkeit *Albtraum* und *Hölle* (mehr Leben/Schaden der Gegner, deutlich mehr XP, bessere Runen).
- Der Spielstand liegt im `localStorage` des Browsers (Export/Import auf dem Titelbildschirm).

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
node tools/botsim.js levels      # wie weit kommt ein einfacher Bot auf Stufe X?
node tools/botsim.js grind       # komplette Progression bis zum ersten Boss-Sieg (Runs / Spielminuten)
node tools/balance-sim.js        # grobes analytisches Modell
```

Der Bot kämpft nur automatisch (kein Ausweichen, kein gezieltes Zaubern) – ein menschlicher Spieler ist meist deutlich besser.
Mit den aktuellen Werten braucht der Bot für den ersten Boss-Sieg etwa 130 Runs (~4 Stunden Spielzeit).

## Entwicklung

Kein Build-Schritt. Lokal starten, z. B. mit `python3 -m http.server` und `http://localhost:8000` öffnen.
Mit `?dev` an der URL erscheint im Lager eine kleine Cheat-Leiste (XP, Stufen, Runen, Freischaltungen) zum Testen.

```
index.html, css/style.css   Oberfläche
js/data.js                  Balancing, Gegner, Runen, Zauber, Formeln (auch für die Node-Tools)
js/dungeon.js               Dungeon-Generator + Wegfindung
js/game.js                  Kampf, Gegner-KI, Boss, Zauber, Drops
js/render.js                Zeichnen (Sprites, Licht, HUD, Lager-Szene)
js/audio.js                 Musik + Soundeffekte (Web Audio)
js/ui.js, js/main.js        Menüs, Eingabe, Hauptschleife
tools/                      Balancing-Werkzeuge
```
