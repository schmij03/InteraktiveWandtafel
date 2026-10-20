# Interaktive Wandtafel

WebApp zum Anlegen von interaktiven Präsentationen («Tafeln») für den Unterricht, nach dem Vorbild der
interaktiven Wandtafel von fobizz und aufgebaut wie die Tafel in
[MI_Connected3](https://github.com/schmij03/MI_Connected3).

- **Fächer** anlegen, darin **Kapitel oder Themen**, darin **Tafeln**
- Eine Tafel hat mehrere **Seiten** wie eine Präsentation
- Auf jeder Seite: Text, Notiz, **Bild**, **Video** (YouTube, Vimeo, Videodatei), **Webseite**, Link,
  Timer, Stoppuhr, Zufallsgenerator, Gruppen, Würfel; darüber **zeichnen** mit Stift, Marker und Radierer
- **Präsentieren** im Vollbild mit Pfeiltasten, auch während der Präsentation zeichnen
- **Export** als HTML-Datei (offline präsentieren), PDF und Wandtafel-Datei; **Import** auf jedem Gerät

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
| Bearbeiten | Text, Notiz, Bild, Video, Webseite, Link, Module (Timer, Stoppuhr, Zufall, Gruppen, Würfel); Elemente an der Kopfleiste verschieben, am orangen Punkt vergrössern (Bilder und Videos behalten das Seitenverhältnis, mit Shift frei), duplizieren, nach hinten legen, löschen (Entf); Doppelklick auf den Namen gibt dem Element einen eigenen Titel |
| Einfügen | Bilder auch mit Ctrl+V oder Hineinziehen; Adressen mit Ctrl+V werden zu Webseite oder Video; Bild- und Videodateien hineinziehen |
| Zeichnen (Z) | Stift, Textmarker, Radierer, sechs Farben, drei Dicken, über die ganze Seite |
| Seiten | Seitenliste links: «+ Seite», Menü «…» zum Benennen, Duplizieren, Verschieben, Löschen; Bild auf/ab wechselt die Seite |
| Hintergrund | pro Seite: Weiss, kariert, liniert, Punkte, Wandtafel grün, Dunkelblau, Kork |
| Rückgängig | Ctrl+Z, wiederholen mit Ctrl+Y |
| Präsentieren (P) | Vollbild ohne Werkzeuge, Pfeiltasten oder Leertaste blättern, Z zeichnen, Esc beendet |

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
| Speicher im Browser (IndexedDB) | `site/js/speicher.js` |
| Export und Import | `site/js/export.js`, Offline-Ansicht `site/js/ansicht.js` |
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
Tafel-IDs) und `tafeln`. Elementtypen: `text`, `notiz`, `bild`, `video`, `webseite`, `link`, `timer`,
`stoppuhr`, `zufall`, `gruppen`, `wuerfel`.
