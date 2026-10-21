# Interaktive Wandtafel

WebApp zum Anlegen von interaktiven Präsentationen («Tafeln») für den Unterricht, nach dem Vorbild der
interaktiven Wandtafel von fobizz und aufgebaut wie die Tafel in
[MI_Connected3](https://github.com/schmij03/MI_Connected3).

- **Fächer** anlegen, darin **Kapitel oder Themen**, darin **Tafeln**
- Eine Tafel hat mehrere **Seiten** wie eine Präsentation
- Auf jeder Seite: Text, Notiz, **Bild** (auch bemalen), **Video** (YouTube, Vimeo, Videodatei), **Webseite**
  (Adresse oder iFrame-Snippet), Link mit **QR-Code**, **Datei**; Module Timer, Stoppuhr, **Uhr**, **Ampel**,
  **Sozialform**, **Lostopf**, Gruppen, Würfel; darüber **zeichnen** mit Stift, Marker und Radierer
- **Spotlight**: eine Karte gross über der Seite zeigen, auch beim Präsentieren
- **Design** pro Seite: Vorlagen oder eigene Farbe, Muster und Hintergrundbild
- **Präsentieren** im Vollbild mit Pfeiltasten, auch während der Präsentation zeichnen
- **Wie in PowerPoint:** Formen, Tabellen, Textformat (Schriftart, kursiv, unterstrichen, Aufzählungen),
  Folienlayouts, **Animationen**, **Folienübergänge**, ausgeblendete Seiten, **Notizen** mit
  **Referentenansicht**, Hilfslinien, Laserpointer, schwarzer/weisser Bildschirm
- **Export** als HTML-Datei (offline präsentieren), PDF, **PowerPoint (.pptx)** und Wandtafel-Datei;
  **Import** auf jedem Gerät

Wie die fobizz-Tafel untersucht und nachgebaut wurde (REA-Vorgehen mit Quellen, Abgleich und Grenzen):
[docs/rea-analyse.md](docs/rea-analyse.md).

## So funktioniert es

```
Dieses Repository                                GitHub Pages
site/      Website (HTML, CSS, JavaScript)  ──►  index.html   Übersicht: Fächer, Kapitel, Tafeln
tools/     Vorschau-Server, Browsertest          tafel.html   Tafel bearbeiten und präsentieren
docs/      REA-Analyse
```

Bei jedem Push prüft `.github/workflows/website.yml` die App im Browser. Auf dem Hauptbranch wird `site/`
danach mit GitHub Pages veröffentlicht. Es gibt keinen Server und kein Konto: Alle Fächer, Tafeln, Bilder und
Videos werden **im Browser** gespeichert (IndexedDB), nur auf diesem Gerät.

## Einrichtung (einmalig)

Settings → Pages → Build and deployment → Source: «GitHub Actions».

Danach einen Commit auf den Hauptbranch pushen oder unter *Actions > Website pruefen und veroeffentlichen >
Run workflow* starten. Die Seite ist dann unter `https://schmij03.github.io/InteraktiveWandtafel/` erreichbar.

## Bedienung

### Übersicht

| Was | Wie |
|---|---|
| Fach anlegen | «+ Fach» links; Name und Farbe wählen |
| Kapitel oder Thema anlegen | im Fach «+ Kapitel / Thema» |
| Tafel anlegen | im Kapitel «+ Tafel» |
| Umbenennen, sortieren, duplizieren, verschieben, löschen | Menü «…» bei Fach, Kapitel oder Tafel |
| Suchen | Suchfeld oben, sucht in Titeln, Texten und Adressen aller Tafeln |
| Beispiel | bei leerer Sammlung «Beispiel laden» |

### Tafel

| Bereich | Funktion |
|---|---|
| Bearbeiten | Text, Notiz, Bild, Video, Webseite, Link, Datei, Module (Timer, Stoppuhr, Uhr, Ampel, Sozialform, Lostopf, Gruppen, Würfel); Elemente an der Kopfleiste verschieben, am orangen Punkt vergrössern (Bilder und Videos behalten das Seitenverhältnis, mit Shift frei), löschen (Entf); im Menü «…»: Spotlight, Bild bemalen, duplizieren, auf andere Seite verschieben, nach hinten legen; Doppelklick auf den Namen gibt dem Element einen eigenen Titel |
| Module | Timer mit 5, 10, 15 Minuten oder eigener Zeit und Signalton; Uhr (analog und digital); Ampel (rot, gelb, grün); Sozialform (Einzel-, Partner-, Gruppenarbeit, Plenum); Lostopf (Lose ziehen ohne Zurücklegen, «Alle zurück in den Topf»); Gruppen nach Gruppengrösse oder Anzahl Gruppen; 1 bis 6 Würfel |
| Link und Datei | Link als Karte, auf Wunsch mit QR-Code zum Scannen; Datei hochladen (PDF, Arbeitsblatt, Audio, …) mit Vorschau, «Öffnen» und «Herunterladen» |
| Spotlight | Menü «…» > «Im Spotlight zeigen» oder beim Präsentieren das Symbol oben rechts an der Karte; Esc oder Klick daneben schliesst |
| Einfügen | Bilder auch mit Ctrl+V oder Hineinziehen; Adressen und iFrame-Snippets mit Ctrl+V werden zu Webseite oder Video; Bild- und Videodateien hineinziehen, andere Dateien werden zur Datei-Karte |
| Zeichnen (Z) | Stift, Textmarker, Radierer, neun Farben, drei Dicken, über die ganze Seite; «Zeichnung» löscht alle Zeichnungen der Seite |
| Seiten | Seitenliste links: «+ Seite», Menü «…» zum Benennen, Duplizieren, Verschieben, Löschen; Bild auf/ab wechselt die Seite |
| Hintergrund | pro Seite: Weiss, kariert, liniert, Punkte, Wandtafel grün, Dunkelblau, Kork, oder «Eigenes Design» (Palette-Knopf): Farbe, Muster, Hintergrundbild, für eine oder alle Seiten |
| Rückgängig | Ctrl+Z, wiederholen mit Ctrl+Y |
| Präsentieren (P) | Vollbild ohne Werkzeuge, Pfeiltasten oder Leertaste blättern, Z zeichnen, Esc beendet |

### Wie in PowerPoint

| Funktion | Wie |
|---|---|
| Formen | «Form»: Rechteck, abgerundetes Rechteck, Ellipse, Dreieck, Raute, Sechseck, Pfeil, Stern, Sprechblase; Doppelklick schreibt Text in die Form |
| Tabelle | «Tabelle»: Spalten und Zeilen wählen, Zellen direkt beschreiben (Tab springt weiter); Knöpfe in der Kopfleiste fügen Zeilen und Spalten hinzu oder entfernen sie; Kopfzeile im Menü «…» |
| Format | Knopf «A» in der Kopfleiste von Text, Notiz, Form und Tabelle: Schriftart, Grösse, Farbe, fett, kursiv, unterstrichen, Ausrichtung (auch Blocksatz), Aufzählungszeichen oder Nummerierung; bei Formen Füllung, Rand und Lage des Texts |
| Folienlayouts | Knopf neben «+ Seite»: Titelfolie, Titel und Inhalt, Zwei Inhalte, Vergleich, Nur Titel, Abschnittsüberschrift; leere Platzhalter sind beim Präsentieren unsichtbar |
| Animationen | Menü «…» > «Animation hinzufügen»: Verblassen, Hineinfliegen, Zoomen, Wischen mit Reihenfolge (gleiche Zahl erscheint zusammen); beim Präsentieren erscheinen die Elemente mit jedem «Weiter», die violette Zahl zeigt die Reihenfolge |
| Übergänge | Menü «…» einer Seite > «Übergang»: Verblassen, Schieben, Wischen, Kreis, für eine oder alle Seiten |
| Seiten ordnen und ausblenden | Seiten in der Liste mit der Maus verschieben; Menü «…» > «Beim Präsentieren ausblenden» |
| Notizen | «Notizen» oben öffnet den Notizbereich unter der Seite |
| Referentenansicht | beim Präsentieren Knopf mit Bildschirm oder Taste R: eigenes Fenster mit aktueller und nächster Seite, Notizen, Animationsstand, Zeit und Uhr (für den zweiten Bildschirm) |
| Beim Präsentieren | L Laserpointer, B schwarzer und W weisser Bildschirm (jede Taste zurück), Seitennummer tippen und Enter springt dorthin, Pos1 und Ende |
| Anordnen | Hilfslinien beim Verschieben (Seitenrand, Seitenmitte, Kanten anderer Elemente; mit Alt frei), Pfeiltasten verschieben (Shift: grosse Schritte), Menü «…» > «Auf der Seite ausrichten», «In den Vordergrund» |
| Kopieren | Ctrl+C, Ctrl+X, Ctrl+V für Elemente, auch auf andere Seiten und Tafeln; Ctrl+D dupliziert |

Webseiten: Manche Seiten verbieten das Einbetten (zum Beispiel viele Login-Seiten). Dann bleibt die Fläche leer;
«Neuer Tab» in der Leiste unten öffnet die Seite trotzdem, oder man fügt sie als Link ein.
Google Docs, Slides und Sheets werden automatisch in der Vorschau-Ansicht eingebettet.

Videos: YouTube läuft über `youtube-nocookie.com`, eine Startzeit in der Adresse (`&t=90`) wird übernommen.
Hochgeladene Videodateien bleiben im Browser; sehr grosse Videos füllen den Speicher und machen Exporte gross.

### Export und Import

| Format | Wo | Zweck |
|---|---|---|
| HTML-Datei (offline) | Tafel > Exportieren, oder Menü «…» der Tafel | eine Datei mit allem (Schrift, Bilder, Videos); per Doppelklick präsentieren, ohne Internet und ohne diese Website (Webseiten und YouTube brauchen Internet) |
| PDF | Tafel > Exportieren > PDF | öffnet den Druckdialog, dort «Als PDF speichern»; eine PDF-Seite pro Tafelseite, Webseiten und Videos als Platzhalter mit Adresse |
| PowerPoint (`.pptx`) | Tafel > Exportieren > PowerPoint | eine Folie pro Seite (16:9) mit bearbeitbaren Texten, Formen und Tabellen, Bildern, Zeichnungen, Hintergrund, Notizen, Übergängen und ausgeblendeten Folien; Videos, Webseiten, Links und Dateien als Karte mit anklickbarer Adresse. Animationen und Module (Timer, Lostopf, …) sind nicht enthalten |
| Wandtafel-Datei (`.wandtafel.json`) | Tafel, Kapitel oder Fach | zum Weitergeben an Kolleginnen und Kollegen oder auf ein anderes Gerät |
| Sicherung | «Alles sichern» oben | alle Fächer, Kapitel, Tafeln und Medien in einer Datei |
| Import | «Importieren» oben, Menü «…» eines Kapitels, oder Datei auf die Seite ziehen | Wandtafel-Dateien und exportierte HTML-Dateien; Fächer und Kapitel mit gleichem Namen werden ergänzt |
| Seiten hinzufügen | Tafel > Exportieren > «Seiten aus Datei hinzufügen» | hängt die Seiten einer anderen Tafel an |

**Wichtig:** Die Daten liegen nur in diesem Browser auf diesem Gerät. Browserdaten löschen löscht auch die Tafeln.
Regelmässig «Alles sichern» verwenden.

## Lokal arbeiten

```
npm ci                                  # einmalig (Node.js 20 oder neuer)
npx playwright install chromium         # einmalig
npm run vorschau                        # http://localhost:8080
node tools/pruefen.mjs                  # Browsertest, --bilder ordner speichert Bildschirmfotos
```

`site/` lässt sich auch mit jedem anderen Webserver ausliefern. Direkt per Doppelklick (`file://`) funktioniert
die App nicht zuverlässig, weil Browser dort den Speicher einschränken; exportierte HTML-Dateien dagegen schon.

## Technik

| Teil | Datei |
|---|---|
| Übersicht: Fächer, Kapitel, Tafelkarten mit Vorschau | `site/index.html`, `site/js/start.js`, `site/css/start.css` |
| Tafel: Bearbeiten, Seiten, Zeichnen, Präsentieren | `site/tafel.html`, `site/js/tafel.js`, `site/css/tafel.css` |
| Elemente und Zeichnungen (Tafel, Vorschau, Export) | `site/js/elemente.js` |
| QR-Codes (qrcode-generator von Kazuhiko Arase, MIT-Lizenz) | `site/js/qrcode.js` |
| Speicher im Browser (IndexedDB) | `site/js/speicher.js` |
| Export und Import | `site/js/export.js`, Offline-Ansicht `site/js/ansicht.js` |
| PowerPoint-Export (eigenes ZIP und Office Open XML, ohne Bibliothek) | `site/js/pptx.js` |
| Dialoge, Menüs, Icons | `site/js/gemeinsam.js`, `site/css/basis.css` |
| Vorschau-Server, Browsertest | `tools/vorschau.mjs`, `tools/pruefen.mjs`, `tools/server.mjs` |

Schrift: Calibri, sonst die metrisch gleiche Carlito (lokal in `site/fonts/`, SIL Open Font License).
Farben wie in MI_Connected3 als Variablen oben in `site/css/basis.css`.

### Datenformat

```json
{
  "format": "interaktive-wandtafel", "version": 1, "art": "tafel",
  "tafel": {
    "id": "t…", "titel": "Brüche einführen",
    "seiten": [
      { "id": "s…", "titel": "", "hintergrund": "weiss",
        "elemente": [ { "id": "e…", "typ": "video", "x": 40, "y": 40, "b": 720, "h": 449, "z": 1,
                        "daten": { "art": "youtube", "id": "…", "start": 90 } } ],
        "striche": [ { "werkzeug": "stift", "farbe": "#1f2933", "dicke": 6, "punkte": [10, 20, 30, 40] } ] }
    ]
  },
  "medien": { "m…": { "daten": "data:image/png;base64,…", "name": "bild.png" } }
}
```

Eine Sicherung (`"art": "sammlung"`) enthält statt `tafel` die Listen `faecher` (mit `kapitel` und deren
Tafel-IDs) und `tafeln`. Elementtypen: `text`, `notiz`, `bild`, `video`, `webseite`, `link`, `datei`, `timer`,
`stoppuhr`, `uhr`, `ampel`, `sozialform`, `zufall` (Lostopf), `gruppen`, `wuerfel`, `form`, `tabelle`. Eine Seite mit eigenem Design hat
`"hintergrund": "eigen"` und dazu `hgFarbe`, `hgMuster` (`kariert`, `liniert`, `punkte`) und `hgBild` (Medium-ID).

Dazu kommen aus den PowerPoint-Funktionen: an der Seite `notizen`, `uebergang` (`blenden`, `schieben`, `wischen`,
`kreis`) und `ausgeblendet`; an einem Element `anim` (`{ "effekt": "zoomen", "nr": 1 }`); in den Daten von Text,
Notiz und Form `schrift`, `kursiv`, `unterstrichen`, `liste` (`punkte`, `nummern`) und `platzhalter`; eine Form hat
`form`, `fuellung` (Farbe oder `keine`), `rand`, `randDicke` und `vertikal`; eine Tabelle `zellen` (Zeilen mit Texten)
und `kopf`. Ältere Tafeln ohne diese Angaben funktionieren unverändert.
