# REA-Analyse: Vorbild fobizz-Tafel

Diese App wurde nach dem Vorgehen von [REA (Reverse Engineer Anything)](https://github.com/morluto/rea) entwickelt:
Ein bestehendes Produkt von aussen untersuchen, ohne seinen Quellcode zu kennen, jede Aussage mit einer Quelle
(Evidenz) belegen, Lücken offen benennen und erst dann eine eigene Version bauen und automatisch prüfen.

| Schritt | Inhalt | Ergebnis |
|---|---|---|
| 1. Ziel festlegen | Welche Funktionen der fobizz-Tafel sollen nachgebaut werden? | Abschnitt «Ziel» |
| 2. Evidenz sammeln | fobizz-Seiten, Fortbildungsbeschreibungen, Erfahrungsberichte, die bestehende Tafel in MI_Connected3 | Abschnitt «Evidenz» |
| 3. Abgleichen | Funktion für Funktion: belegt, abgeleitet oder unbekannt | Abschnitt «Funktionsabgleich» |
| 4. Nachbauen | eigene Umsetzung, Abweichungen begründen | Abschnitt «Entscheidungen» |
| 5. Prüfen | Browsertest gegen die Anforderungen | Abschnitt «Verifikation» |

## Ziel

Eine WebApp, mit der Lehrpersonen interaktive Präsentationen («Tafeln») anlegen, wie es im Repository
MI_Connected3 der Fall ist, nach dem Vorbild der interaktiven Wandtafel von fobizz. Vorgaben:

1. Fächer anlegen
2. Kapitel oder Themen in den Fächern
3. Tafeln exportieren
4. Webseiten, Videos und Bilder einbinden

## Evidenz

| Nr. | Quelle | Was sie belegt |
|---|---|---|
| E1 | Direkter Abruf von fobizz.com aus der Arbeitsumgebung (erste Runde) | **Nicht möglich**: Der Netzwerk-Proxy der damaligen Arbeitsumgebung sperrte fobizz.com (HTTP 403). In der zweiten Runde war fobizz erreichbar, siehe [Zweite Runde](#zweite-runde-untersuchung-mit-den-rea-tools). |
| E2 | [Die digitale Tafel der fobizz Tools](https://app.fobizz.com/fortbildungen/1318-die-digitale-tafel-der-fobizz-tools) (Fortbildung) | Zeichenmodus: eine Leinwand liegt über der Tafel, Zeichnungen bleiben gespeichert und sind auch in der Vorschau für andere sichtbar. Inhalte «Speichern, Exportieren und Bearbeiten». |
| E3 | [Interaktive Tafeln im Unterricht](https://plattform.fobizz.com/fortbildungen/214-interaktive-tafeln-im-unterricht-mit-beispielen-fuer-smart-boards), [Interaktive Tafel im Unterricht](https://fobizz.com/de/interaktive-tafel-im-unterricht/) | Module für das Classroom Management: Stoppuhren, Gruppen- und Zufallsgeneratoren, Timer. |
| E4 | [Digitale Tafel von Fobizz Tools (KMS-Bildung)](https://www.kms-bildung.de/2024/08/19/digitale-tafel-von-fobizz-tools-bombardierung-wuerzburgs-und-erinnerungskultur/), [Fobizz-Tools (Medienfundgrube)](https://www.medienfundgrube.at/?p=6426) | Einsatz im Unterricht mit Timer zur zeitlichen Orientierung; Zufallsgenerator zum Aufrufen einzelner Schülerinnen und Schüler. Für Lehrpersonen ist ein Konto nötig, Schülerinnen und Schüler brauchen keines. |
| E5 | [Die kollaborative Pinnwand der fobizz Tools](https://app.fobizz.com/fortbildungen/704-die-kollaborative-pinnwand-der-fobizz-tools/lessons/8532) | Ordnung der fobizz-Tools in Ordnern, Duplizieren, als Vorlage speichern. (Belegt für die Pinnwand, für die Tafel abgeleitet.) |
| E6 | Quellcode `site/js/tafel.js` in MI_Connected3 | Bereits nach dem Vorbild der fobizz-Tafel gebaut: feste Tafelfläche 1600 × 900, Elemente (Text, Notiz, Bild, Link/YouTube, Timer, Stoppuhr, Zufall, Gruppen, Würfel), Zeichenebene mit Stift, Marker, Radierer, sechs Hintergründe, Rückgängig, Speicherung im Browser, Datei speichern und öffnen. |

## Funktionsabgleich

Legende: **belegt** (Quelle oben), **abgeleitet** (aus MI_Connected3 oder üblicher Bedienung), **neu** (Vorgabe dieses Auftrags).

| Funktion | fobizz | MI_Connected3 | Interaktive Wandtafel |
|---|---|---|---|
| Zeichnen über der ganzen Tafel, bleibt gespeichert | belegt (E2) | vorhanden | Stift, Marker, Radierer, 6 Farben, 3 Dicken, pro Seite gespeichert, auch beim Präsentieren |
| Timer, Stoppuhr | belegt (E3, E4) | vorhanden | übernommen |
| Zufallsgenerator, Gruppen | belegt (E3, E4) | vorhanden | übernommen |
| Würfel | unbekannt | vorhanden | übernommen |
| Text, Notizzettel | abgeleitet | vorhanden | übernommen, dazu fett, Textfarbe, Notizfarben |
| Bilder | abgeleitet | Hochladen, Ctrl+V, Hineinziehen | dazu Bild per Adresse; grosse Bilder werden verkleinert |
| Videos | abgeleitet | YouTube als Link | **neu**: YouTube (mit Startzeit), Vimeo, Videodateien per Adresse oder Hochladen |
| Webseiten einbinden | abgeleitet | nur als Link | **neu**: Webseite als Fenster auf der Tafel (iframe) mit «Neu laden» und «Neuer Tab»; Google Docs/Slides als Vorschau |
| Speichern und Exportieren | belegt (E2), Format unbekannt | JSON-Datei | **neu**: HTML-Datei (offline präsentieren), PDF (Druck), Wandtafel-Datei (JSON mit allen Medien), Sicherung aller Fächer |
| Ordner, Duplizieren | belegt für Pinnwand (E5) | eine Tafel pro Präsentation | **neu**: Fächer › Kapitel/Themen › Tafeln; duplizieren, verschieben, umbenennen, sortieren |
| Mehrere Seiten pro Tafel | unbekannt | Folien der Präsentation in der Seitenleiste | **neu**: Seiten wie Folien, mit Seitenliste, Präsentationsmodus und Pfeiltasten |
| Konto, Teilen per Link, gemeinsames Arbeiten | belegt (E4) | nicht vorhanden | bewusst nicht nachgebaut (siehe unten) |

## Entscheidungen

- **Statische Website wie MI_Connected3.** GitHub Pages, kein Server, kein Konto. Deshalb gibt es kein Teilen per
  Link und kein gemeinsames Bearbeiten in Echtzeit. Weitergegeben wird über den Export.
- **Speicher im Browser (IndexedDB) statt localStorage.** localStorage fasst nur etwa 5 MB, zu wenig für mehrere
  Tafeln mit Bildern und Videos. Bilder und Videos liegen als eigene Einträge im Speicher und werden in den Tafeln
  nur verknüpft; Rückgängig und Speichern bleiben dadurch schnell.
- **Seiten statt einer einzigen Fläche.** Der Auftrag spricht von interaktiven Präsentationen. Jede Seite hat die
  feste Grösse 1600 × 900 (wie in MI_Connected3) und wird auf jeden Bildschirm skaliert.
- **Export in drei Formaten.** Die HTML-Datei enthält Schrift, Bilder, Videos, Darstellung und Bedienung und läuft
  per Doppelklick ohne diese Website (wie die Offline-HTML in MI_Connected3). Das PDF entsteht über den Druckdialog
  des Browsers, Webseiten und Videos erscheinen dort als Platzhalter mit Adresse (YouTube mit Vorschaubild).
  Die Wandtafel-Datei lässt sich auf jedem Gerät wieder importieren; auch eine exportierte HTML-Datei lässt sich
  wieder importieren.

## Unbekannt und Grenzen

- Die genaue Oberfläche der fobizz-Tafel (Anordnung der Werkzeuge, Namen, Elementtypen ausserhalb der belegten
  Module) ist nicht belegt, weil fobizz.com aus der Arbeitsumgebung nicht erreichbar war (E1). Die Bedienung folgt
  deshalb der bereits fobizz-nahen Tafel aus MI_Connected3.
- Welche Dateiformate fobizz beim Export anbietet, ist nicht belegt.
- Ob eine eingebundene Webseite angezeigt wird, entscheidet die Webseite selbst (`X-Frame-Options`,
  `Content-Security-Policy`). Das lässt sich im Browser nicht vorher prüfen. Bleibt die Fläche leer, hilft
  «Neuer Tab» oder ein Link.
- Daten liegen nur in dem Browser, in dem sie angelegt wurden. Browserdaten löschen löscht auch die Tafeln.
  Die App bittet den Browser um dauerhaften Speicher (`navigator.storage.persist`), regelmässig «Alles sichern»
  bleibt trotzdem nötig.

## Verifikation

`node tools/pruefen.mjs` prüft im Browser (Chromium) jede Vorgabe, insgesamt über 60 Prüfpunkte, darunter:

| Vorgabe | Geprüft |
|---|---|
| Fächer anlegen | Fach anlegen, wechseln, löschen; Fach steht in der Adresse |
| Kapitel/Themen | Kapitel anlegen; Tafel in Kapitel anlegen; Tafel in anderes Fach verschieben; Suche über alle Fächer |
| Webseiten, Videos, Bilder | Bild hochladen und nach Neuladen wieder anzeigen; YouTube mit Startzeit; Videodatei hochladen; Webseite mit Titel und «Neuer Tab»; Link ohne `https://` |
| Export | HTML-Datei ist eigenständig (Schrift und Bild eingebettet), läuft per `file://`, blättert, ist nicht bearbeitbar; PDF hat so viele Seiten wie die Tafel, Webseiten und Videos als Platzhalter; Wandtafel-Datei enthält Bild und Video; Sicherung löschen und wieder importieren; HTML-Datei wieder importieren |
| Präsentation | Seiten, Zeichnen, Rückgängig/Wiederholen, Präsentationsmodus mit Pfeiltasten und Zeichnen, Beispiel als Präsentation, Übersicht auf dem Handy ohne seitliches Scrollen, keine JavaScript-Fehler |

## Zweite Runde: Untersuchung mit den REA-Tools

Ziel: **alle** Funktionen der fobizz-Tafel nachbauen. Diesmal war fobizz erreichbar, und die Untersuchung lief
mit dem REA-MCP-Server (`rea-agents` 6.7.0) statt nur mit öffentlichen Beschreibungen.

### Vorgehen

| Schritt | REA-Werkzeug | Evidenz | Ergebnis |
|---|---|---|---|
| 1. Tools-Übersicht öffnen | `capture_browser_scenario` (Chrome, headless, ohne Konto) | `ev_fad65d10…cacb0` | Die Tafel heisst bei fobizz «Digitale Tafel», Info-Seite `/teaching_board/info` |
| 2. Info-Seite der Tafel | `capture_browser_scenario` mit Accessibility-Baum und Bildschirmfoto | `ev_92b6ecdd…4753` | Beschreibung: multimediale Tafelbilder, Inhalte einbinden, teilen, «digitale Uhr, Timer und Symbole für Arbeitsphasen» |
| 3. Ausgelieferte Skripte sichern | `capture_browser_scenario` mit Antwortinhalten, dann `export_web_scripts` | `ev_4685b055…0ebe`, `ev_9d7e67ba…6c99` | Router der App: die Tafel heisst intern `classroom_screen` |
| 4. Tafel-Code statisch lesen | Chunk-Graph aus dem Router (`__vite__mapDeps`), öffentliche Vite-Chunks, Komponenten- und Textschlüssel | Chunks `ScreenPageLayout`, `Page`, `classroomScreen` (Store), deutsche Texte im Haupt-Chunk | Vollständige Liste der Kartentypen, Werkzeuge und Texte (unten) |

Der Editor selbst (`/teaching_board/screens/:id`) verlangt ein fobizz-Konto und wurde **nicht** ausgeführt. Alle
Aussagen über den Editor stammen aus dem ausgelieferten, öffentlich abrufbaren JavaScript (statisch gelesen, nicht
ausgeführt). Code von fobizz wurde nicht übernommen; die Rohdaten liegen nur lokal im ignorierten Ordner `build/rea/`.

### Befunde (Funktionsinventar)

Beobachtet = sichtbar auf öffentlichen Seiten; statisch = aus Komponentennamen, Textschlüsseln und deutschen Texten
im ausgelieferten Code; abgeleitet = Schluss daraus.

| Bereich | fobizz (Quelle) | Interaktive Wandtafel |
|---|---|---|
| Aufbau | Tafel → Seiten (Reihenfolge per Ziehen) → Karten (`classroomScreen`-Store, statisch) | Fach → Kapitel → Tafel → Seiten → Elemente (schon vorhanden) |
| Karten | Text, Bild, Video, Einbetten, Datei, Link (mit QR-Code), Tool, Uhr, Timer, Stoppuhr, Ampel, Würfel, Gruppe, Lostopf, Sozialform (`classroomScreen.components`, statisch) | alle ausser «Tool» (siehe Grenzen); neu: **Uhr, Ampel, Sozialform, Datei, QR-Code** |
| Timer | «5 Minuten», «10 Minuten», «15 Minuten», «Anderer Timer» mit Minuten und Sekunden, Ton am Ende (statisch) | **neu**: Vorgaben 5/10/15 min und eigene Zeit |
| Lostopf | «Lose in den Topf geben», «Neues Los ziehen», «Alle Lose zurück in den Topf», «Der Topf ist leer!» (statisch) | Zufall umbenannt zu **Lostopf** mit diesen Abläufen |
| Gruppe | «Anzahl Gruppen» oder «Gruppengröße», «Gruppen mischen» (statisch) | **neu**: Wahl zwischen Gruppengrösse und Anzahl Gruppen |
| Würfel | «Anzahl Würfel» (statisch, Höchstzahl unbekannt) | **neu**: 1 bis 6 Würfel |
| Ampel | Rotes, gelbes, grünes Licht (statisch) | **neu** |
| Sozialform | Einzelarbeit, Partnerarbeit, Gruppenarbeit, Plenum (statisch) | **neu** |
| Einbetten | «URL oder iFrame-Snippet», YouTube/Vimeo (statisch) | **neu**: iFrame-Snippets werden erkannt |
| Datei | «Datei hochladen», Vorschau wenn darstellbar, sonst Symbol nach Endung (statisch) | **neu**: Datei-Karte mit Vorschau (Bild, PDF, Audio), Öffnen, Herunterladen |
| Karten-Aktionen | Duplizieren, «Seite {page}» (verschieben), Löschen, «Karte im Spotlight-Modus öffnen», Titel max. 45 Zeichen (statisch) | **neu**: Spotlight, auf andere Seite verschieben (Menü «…») |
| Zeichnen | Zeichenmodus/Werkzeugmodus, Stift, Marker, Radierer, «Alle Zeichnungen entfernen»; Farben Magenta, Rot, Gelb, Weiss, Cyan, Grün, Indigo, Lila; Dicken klein, mittel, gross (statisch) | Farben auf **neun** erweitert (fobizz-Farben plus Schwarz und Dunkelblau) |
| Bild bemalen | Bildeditor mit Freihand, Farbe, Dicke, Rückgängig, Wiederholen, Zurücksetzen, Speichern (`VpEditor`, statisch) | **neu**: «Bild bemalen» |
| Seitendesign | Farbe, Muster, Hintergrundbild pro Seite (`ScreenPageThemePage`, statisch) | **neu**: «Eigenes Design» mit Farbe, Muster, Bild, für eine oder alle Seiten |
| Präsentieren | Vollbild ein/aus (statisch) | schon vorhanden |
| Teilen, Schüleransicht, Passwort, Kopieren mit eingebetteten fobizz-Tools | Routen `share`, `settings`, `public_screens` (statisch) | ohne Server nicht möglich; Ersatz: Export als HTML-Datei und Wandtafel-Datei |
| Mindestbreite | Tafel erst ab 768 px Breite (Titel des Hilfeartikels beobachtet, Text statisch) | nicht übernommen, die Tafel skaliert auf jede Breite |

### Grenzen und Unbekanntes

- **Nicht ausgeführt**: Der Editor wurde nicht im Browser bedient (Konto nötig). Reihenfolge und Aussehen der
  Werkzeuge sind deshalb nicht belegt; die Bedienung folgt weiter der eigenen Oberfläche.
- **Tool-Karte**: bindet andere fobizz-Inhalte ein (Arbeitsblatt, Pinnwand usw.). Ohne fobizz-Konto und Server nicht
  nachbaubar; eine Webseite oder ein iFrame-Snippet erfüllt den gleichen Zweck für andere Anbieter.
- **Bildquellen**: fobizz bietet im Bildwähler weitere Quellen (Reiter, unter anderem KI-Bilder). Hier: Hochladen,
  Adresse, Einfügen, Hineinziehen.
- **Textformat**: fobizz verwendet einen Texteditor mit Werkzeugleiste. Hier: Grösse, fett, Farbe. Welche Formate
  der fobizz-Editor genau anbietet, ist nicht belegt.
- **Grenzwerte** wie die höchste Würfelzahl oder Gruppenzahl sind im gelesenen Code nicht eindeutig; eigene Werte:
  bis 6 Würfel, 2 bis 20 Gruppen.

### Verifikation der zweiten Runde

`node tools/pruefen.mjs` prüft zusätzlich im Abschnitt «Funktionen wie bei fobizz»: Uhr, Ampel, Sozialform, Lostopf
(leerer Topf, zurücklegen), Gruppen nach Anzahl, fünf Würfel, Timer-Vorgaben und eigene Zeit, Link mit QR-Code,
iFrame-Snippet, Datei mit Download, Spotlight (öffnen, Esc), Verschieben auf eine andere Seite, eigenes Design mit
Farbe, Muster und Bild, Bild bemalen, neun Zeichenfarben, Export mit Hintergrundbild und Datei, Offline-Ansicht mit
den neuen Karten, Spotlight beim Präsentieren.
