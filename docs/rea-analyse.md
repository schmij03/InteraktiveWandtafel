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
| E1 | Direkter Abruf von fobizz.com aus der Arbeitsumgebung | **Nicht möglich**: Der Netzwerk-Proxy der Arbeitsumgebung sperrt fobizz.com (HTTP 403). Die Oberfläche konnte deshalb nicht live beobachtet werden (kein Bildschirmfoto, keine DOM- oder Netzwerkanalyse). |
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
