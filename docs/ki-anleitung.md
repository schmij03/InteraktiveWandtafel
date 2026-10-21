# Anleitung für KI: Aus einer PowerPoint eine Lektion machen

Diese Anleitung richtet sich an KI-Assistenten (ChatGPT, Claude, Copilot, Gemini, …) und an Lehrpersonen,
die mit einer KI arbeiten. Sie beschreibt, wie aus einer PowerPoint-Präsentation eine **Unterrichtseinheit
(Lektion) für die Interaktive Wandtafel** wird: eine Datei, die man in der App mit «Importieren» öffnet.

Eine fertige Lektion als Vorlage: [`beispiel-lektion.wandtafel.json`](beispiel-lektion.wandtafel.json)
(5 Seiten: Einstieg, Input, Erarbeitung, Sicherung, Abschluss). Der Browsertest importiert sie bei jedem
Push, sie passt also immer zum aktuellen Datenformat.

## Zwei Wege

| Weg | Wann | Ergebnis |
|---|---|---|
| **A: Ohne KI** | Die Folien sollen einfach auf die Tafel | In der App «PowerPoint importieren» und die `.pptx`-Datei wählen. Jede Folie wird eine Seite mit Texten, Formen, Bildern, Tabellen, Notizen, Übergängen und Animationen. |
| **B: Mit KI** | Aus den Folien soll eine Lektion mit Phasen und interaktiven Elementen werden | Die KI liest die Folien und schreibt eine Wandtafel-Datei (`.wandtafel.json`) nach dieser Anleitung. Die Lehrperson importiert sie. |

Beide Wege lassen sich verbinden: zuerst Weg A (Bilder und Layout bleiben erhalten), dann in der Tafel
*Exportieren > Wandtafel-Datei* und diese Datei der KI zum Überarbeiten geben (siehe [Weg C](#weg-c-importierte-powerpoint-überarbeiten)).

## Weg B Schritt für Schritt

1. **Folien an die KI geben:** die `.pptx`-Datei hochladen, oder in PowerPoint *Datei > Exportieren >
   Gliederung/Text* bzw. den Text der Folien und Notizen kopieren.
2. **Prompt** unten einfügen und Stufe, Fach und Dauer ergänzen.
3. Die KI antwortet mit **einer JSON-Datei**. Als `lektion.wandtafel.json` speichern (Endung `.json`).
4. In der App auf der Übersicht **Importieren** wählen und die Datei öffnen, Kapitel wählen.
5. Tafel öffnen, prüfen, anpassen, präsentieren.

### Prompt zum Kopieren

```text
Du bist eine erfahrene Lehrperson und gestaltest Unterricht für die «Interaktive Wandtafel»
(https://github.com/schmij03/InteraktiveWandtafel). Halte dich genau an die Anleitung docs/ki-anleitung.md
in diesem Repository (Datenformat, Regeln, Checkliste).

Aufgabe: Mach aus der angehängten PowerPoint eine Lektion für die Wandtafel.
- Stufe/Klasse: [z. B. 5. Klasse Primarschule]
- Fach und Thema: [z. B. NMG, Wasserkreislauf]
- Dauer: [z. B. 45 Minuten]
- Sprache: Deutsch (Schweiz, «ss» statt «ß»)

Vorgehen:
1. Lies alle Folien und Notizen. Bestimme Lernziel und Kernaussagen.
2. Plane Phasen: Einstieg, Input, Erarbeitung, Sicherung, Abschluss (je 1 Seite, bei Bedarf mehr).
3. Übernimm Inhalte der Folien knapp, nicht Wort für Wort. Höchstens 6 Elemente pro Seite.
4. Ergänze passende Module: Timer für Arbeitsphasen, Sozialform, Gruppen oder Lostopf, Ampel, Tabelle
   zum gemeinsamen Ausfüllen, Links mit QR-Code.
5. Schreibe in «notizen» jeder Seite Phase, Dauer, Ziel und Hinweise für die Lehrperson.
6. Gib als Antwort NUR die JSON-Datei aus (keinen weiteren Text), gültig nach JSON-Standard.
```

## Weg C: Importierte PowerPoint überarbeiten

1. In der App «PowerPoint importieren» (Weg A).
2. Tafel öffnen, *Exportieren > Wandtafel-Datei*.
3. Der KI die Datei geben mit dem Auftrag: «Überarbeite diese Wandtafel-Datei zu einer Lektion nach
   docs/ki-anleitung.md. Behalte `medien` und alle Elemente mit `"medium"` unverändert.»
4. Die Antwort wieder importieren. Es entsteht eine neue Tafel; die alte bleibt erhalten.

## Datenformat

### Datei

```json
{
  "format": "interaktive-wandtafel",
  "version": 1,
  "art": "tafel",
  "tafel": {
    "id": "t-thema",
    "titel": "Titel der Lektion",
    "seiten": [ /* Seiten, siehe unten */ ]
  },
  "medien": {}
}
```

- `format`, `version` und `art` genau so übernehmen.
- `tafel.id`: beliebige Zeichenkette (die App vergibt beim Import eine neue).
- `medien`: hochgeladene Bilder, Videos und Dateien als Data-URL. Eine KI lässt das Objekt **leer** (`{}`)
  oder übernimmt es unverändert aus einer exportierten Datei.

### Seite

```json
{
  "id": "s1",
  "titel": "Einstieg",
  "hintergrund": "gruen",
  "notizen": "Phase: Einstieg (5 Min.)\nZiel: …",
  "uebergang": "blenden",
  "elemente": [ /* Elemente */ ],
  "striche": []
}
```

| Feld | Pflicht | Werte |
|---|---|---|
| `id` | ja | eindeutig innerhalb der Tafel, z. B. `s1`, `s2` |
| `titel` | nein | Name in der Seitenliste |
| `hintergrund` | ja | `weiss`, `kariert`, `liniert`, `punkte`, `gruen` (Wandtafel), `dunkel` (Dunkelblau), `kork`, `eigen` |
| `hgFarbe`, `hgMuster` | bei `eigen` | Farbe `#rrggbb`; Muster `kariert`, `liniert`, `punkte` oder weglassen |
| `notizen` | nein | Text für die Lehrperson, sichtbar in der Referentenansicht; Zeilen mit `\n` |
| `uebergang` | nein | `blenden`, `schieben`, `wischen`, `kreis` |
| `ausgeblendet` | nein | `true`: Seite wird beim Präsentieren übersprungen (z. B. Zusatzaufgaben) |
| `elemente` | ja | Liste der Elemente |
| `striche` | ja | Zeichnungen; für die KI immer `[]` |

### Element

```json
{ "id": "e1", "typ": "text", "x": 80, "y": 60, "b": 1440, "h": 140, "z": 1,
  "daten": { "text": "Woher kommt das Wasser?", "groesse": 64, "fett": true },
  "anim": { "effekt": "einblenden", "nr": 1 } }
```

- **Fläche:** jede Seite ist **1600 × 900** Punkte (16:9). `x`, `y` = obere linke Ecke, `b` = Breite,
  `h` = Höhe. Alles muss innerhalb der Fläche liegen: `x + b ≤ 1600`, `y + h ≤ 900`.
- `z`: Reihenfolge der Ebenen (grössere Zahl liegt oben), innerhalb der Seite fortlaufend.
- `id`: eindeutig innerhalb der Seite.
- `anim` (freiwillig): Element erscheint beim Präsentieren erst mit «Weiter». `effekt`: `einblenden`,
  `fliegen`, `zoomen`, `wischen`; `nr`: Reihenfolge ab 1 (gleiche Nummer erscheint gleichzeitig).
- Elemente ausser Text und Form haben oben eine **Kopfleiste von 44 Punkten**; die Höhe darum etwas
  grösser wählen.

### Elementtypen

| `typ` | Zweck | `daten` | Gute Grösse (b × h) |
|---|---|---|---|
| `text` | Titel, Fliesstext, Aufzählung | `text`, `groesse` (Punkte, 24–80), `fett`, `kursiv`, `unterstrichen`, `farbe`, `schrift` (`serif`, `schreib`, `mono` oder weglassen), `ausrichtung` (`center`, `right`, `justify`), `liste` (`punkte`, `nummern`: jede Zeile ein Punkt) | Titel 1440 × 110, Text 700 × 300 |
| `notiz` | Haftnotiz, Impuls, Merksatz | `text`, `groesse`, `farbe`: `#fff3a8` gelb, `#ffd6e0` rosa, `#d4f1d6` grün, `#d6ecfb` blau, `#ffe1c2` orange | 560 × 300 |
| `form` | Form mit Text (Begriffe, Ablauf, Hervorhebung) | `form`: `rechteck`, `abgerundet`, `ellipse`, `dreieck`, `raute`, `sechseck`, `pfeil`, `stern`, `sprechblase`; `text`, `groesse`, `fett`, `farbe`, `fuellung` (Farbe oder `keine`), `rand`, `randDicke` (0–12), `vertikal` (`oben`, `mitte`, `unten`) | 330 × 240 |
| `tabelle` | Tabelle zum Ausfüllen im Plenum | `zellen` (Liste von Zeilen, jede eine Liste von Texten, alle gleich lang), `kopf` (`true`: erste Zeile hervorgehoben), `groesse` | 1440 × (60 + 56 pro Zeile) |
| `bild` | Bild aus dem Internet | `src` (Adresse eines Bildes mit freier Lizenz), `name` | 480 × 380 |
| `video` | YouTube- oder Vimeo-Video | `art` (`youtube`, `vimeo`), `id` (Video-ID), `url`, `start` (Sekunden, freiwillig), `titel` | 720 × 449 |
| `webseite` | eingebettete Seite (LearningApps, H5P, …) | `url`, `titel` | 900 × 600 |
| `link` | Link-Karte | `url`, `titel`, `qr` (`true`: mit QR-Code zum Scannen) | 560 × 200, mit QR 560 × 340 |
| `timer` | Countdown für Arbeitsphasen | `sekunden` | 320 × 300 |
| `stoppuhr` | Stoppuhr | `{}` | 400 × 260 |
| `uhr` | analoge und digitale Uhr | `{}` | 360 × 420 |
| `ampel` | Lautstärke, Selbsteinschätzung | `licht`: `rot`, `gelb`, `gruen` oder `""` | 220 × 500 |
| `sozialform` | Sozialform anzeigen | `form`: `einzel`, `partner`, `gruppe`, `plenum` | 400 × 330 |
| `zufall` | Lostopf (wer ist dran?) | `namen` (Zeilen mit `\n`), `ohne` (`true`: ohne Zurücklegen) | 560 × 420 |
| `gruppen` | Gruppen bilden | `namen`, `nach` (`groesse` oder `anzahl`), `groesse` (Personen pro Gruppe) oder `gruppenzahl` | 640 × 440 |
| `wuerfel` | Würfel | `anzahl` (1–6) | 360 × 280 |

Farben immer als `#rrggbb`. Gut lesbar: `#21295c` (Dunkelblau), `#065a82` (Petrol), `#e4572e` (Orange),
`#2e7d32` (Grün), `#1f2933` (fast Schwarz), auf dunklem Hintergrund `#ffffff`.

## Von der Folie zur Lektion

| In der PowerPoint | Auf der Wandtafel |
|---|---|
| Titelfolie | Seite «Einstieg» mit Leitfrage (`text`), Impuls (`notiz`), `sozialform` und kurzem `timer` |
| Aufzählungsfolie | `text` mit `liste`, Punkte mit `anim` nacheinander einblenden; oder 3–4 `form`-Elemente nebeneinander |
| Folie mit Definition oder Merksatz | `notiz` (grün) oder `form` `abgerundet` auf der Seite «Sicherung» |
| Folie mit Arbeitsauftrag | `text` mit `liste: "nummern"`, dazu `sozialform`, `timer` und `gruppen` |
| Folie mit Tabelle | `tabelle`; Spalten mit Lösungen leer lassen, die Klasse füllt sie aus |
| Folie mit Video oder Link | `video` (YouTube/Vimeo) oder `link` mit `qr: true` |
| Folie mit Bild | `bild` mit `src`, nur bei frei nutzbaren Bildern; sonst Weg C oder Bild später in der App einfügen |
| Sprechernotizen | `notizen` der Seite |
| Zusatzfolien / Vertiefung | Seite mit `"ausgeblendet": true` |
| Schlussfolie | Seite «Abschluss»: Frage, `zufall` (wer erklärt?), `ampel` zur Selbsteinschätzung |

Didaktische Hinweise für die KI:

- **Eine Kernaussage pro Seite.** Lange Folientexte kürzen; Details gehören in `notizen`.
- **Aktivieren statt vorlesen:** jede Seite hat einen Auftrag oder eine Frage an die Klasse.
- **Lesbar auf Distanz:** Schrift mindestens 28, Titel 48–64; nicht mehr als 6 Zeilen Text.
- **Platz lassen:** Elemente nicht überlappen, 40 Punkte Abstand zum Rand und zueinander.
- **Zeiten realistisch:** Summe der Timer und Phasen passt zur Dauer der Lektion.

## Checkliste vor der Ausgabe

- [ ] Gültiges JSON (keine Kommentare, keine Kommas am Ende, Text mit `\n` statt Zeilenumbruch)
- [ ] `format`, `version`, `art` wie oben; `medien` vorhanden
- [ ] jede Seite hat `id`, `hintergrund`, `elemente` und `striche: []`
- [ ] jedes Element hat `id`, `typ`, `x`, `y`, `b`, `h`, `z`, `daten`; alles innerhalb 1600 × 900
- [ ] nur die Typen und Werte aus den Tabellen oben
- [ ] Tabellenzeilen alle gleich lang
- [ ] Adressen vollständig mit `https://`

## Wenn der Import nicht klappt

| Meldung | Ursache |
|---|---|
| «Die Datei lässt sich nicht lesen.» | kein gültiges JSON: Antwort der KI nur ab `{` bis `}` speichern, Kommas prüfen |
| «Das ist keine Datei der Interaktiven Wandtafel.» | `format` fehlt oder ist falsch geschrieben |
| «Die Tafel in der Datei ist beschädigt.» | Seite ohne `elemente` oder `striche`, oder `tafel.id` fehlt |
| «Unbekanntes Element» auf der Seite | `typ` falsch geschrieben (nur die Typen aus der Tabelle) |
| Element ist leer oder zeigt Standardwerte | falsche Feldnamen in `daten` |
