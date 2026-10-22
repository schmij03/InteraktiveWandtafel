#!/usr/bin/env python3
"""
Erzeugt docs/lektionen/02-algorithmen-3-sek.wandtafel.json: eine Sammlung fuer
Medien und Informatik > 3. Sek > 02-Algorithmen mit 5 Lektionen (Insertionsort,
Tournamentsort, Suchen, Fairness, Mergesort), nach der Unterrichtspraesentation
«Wettbewerb der Algorithmen».

Aufruf: python3 tools/lektion-algorithmen.py [zieldatei]
"""
import json, os, sys

W, H = 1600, 900
BLAU, PETROL, ORANGE, GRUEN, SCHWARZ, WEISS = "#21295c", "#065a82", "#e4572e", "#2e7d32", "#1f2933", "#ffffff"
GELB, ROSA, HGRUEN, HBLAU, HORANGE = "#fff3a8", "#ffd6e0", "#d4f1d6", "#d6ecfb", "#ffe1c2"
GRAU = "#e6e8eb"


class Seite:
    def __init__(self, titel, hg, notizen="", uebergang="blenden"):
        self.d = {"titel": titel, "hintergrund": hg, "notizen": notizen, "uebergang": uebergang,
                  "elemente": [], "striche": []}

    def el(self, typ, x, y, b, h, daten, anim=None, effekt="einblenden"):
        if typ == "text":
            # Beim Bearbeiten hat auch Text oben eine Griffleiste von 44 Punkten
            h = min(h + 44, H - y)
        assert x >= 0 and y >= 0 and x + b <= W and y + h <= H, (self.d["titel"], typ, x, y, b, h)
        e = {"id": "e%d" % (len(self.d["elemente"]) + 1), "typ": typ, "x": x, "y": y, "b": b, "h": h,
             "z": len(self.d["elemente"]) + 1, "daten": daten}
        if anim:
            e["anim"] = {"effekt": effekt, "nr": anim}
        self.d["elemente"].append(e)
        return self

    def linie(self, x1, y1, x2, y2, farbe=PETROL, dicke=4):
        self.d["striche"].append({"werkzeug": "stift", "farbe": farbe, "dicke": dicke, "punkte": [x1, y1, x2, y2]})
        return self

    # Bausteine
    def kopf(self, label, titel, hell=True, labelfarbe=None):
        f = BLAU if hell else WEISS
        self.el("text", 80, 16, 1440, 50, {"text": label, "groesse": 24, "fett": True,
                                          "farbe": labelfarbe or (ORANGE if hell else "#ffb38a")})
        self.el("text", 80, 58, 1440, 96, {"text": titel, "groesse": 52, "fett": True, "farbe": f})
        return self

    def text(self, x, y, b, h, t, groesse=30, farbe=SCHWARZ, anim=None, **mehr):
        d = {"text": t, "groesse": groesse, "farbe": farbe}
        d.update(mehr)
        return self.el("text", x, y, b, h, d, anim)

    def notiz(self, x, y, b, h, t, farbe=GELB, groesse=28, anim=None):
        return self.el("notiz", x, y, b, h, {"text": t, "groesse": groesse, "farbe": farbe}, anim)

    def form(self, x, y, b, h, t, fuellung=HBLAU, rand=PETROL, groesse=28, anim=None, form="abgerundet",
             fett=False, farbe=SCHWARZ, vertikal="mitte", effekt="einblenden", ausrichtung=None):
        d = {"form": form, "text": t, "groesse": groesse, "fett": fett, "farbe": farbe,
             "fuellung": fuellung, "rand": rand, "randDicke": 3 if rand != "keine" else 0, "vertikal": vertikal}
        if ausrichtung:
            d["ausrichtung"] = ausrichtung
        return self.el("form", x, y, b, h, d, anim, effekt)

    def karte(self, x, y, b, h, titel, t, fuellung=HBLAU, rand=PETROL, anim=None, groesse=26):
        """Begriffskarte: fetter Titel, darunter Text"""
        return self.form(x, y, b, h, titel + "\n" + t, fuellung, rand, groesse, anim)

    def tabelle(self, x, y, b, zellen, groesse=26, anim=None, zeile=56):
        h = 60 + zeile * len(zellen)
        assert len(set(len(z) for z in zellen)) == 1
        return self.el("tabelle", x, y, b, h, {"zellen": zellen, "kopf": True, "groesse": groesse}, anim)


def lernziele_seite(nr, datum, dossier, titel, ziele, notizen):
    s = Seite("Start", "dunkel", notizen)
    s.form(80, 60, 150, 150, str(nr), fuellung=ORANGE, rand="keine", form="ellipse", groesse=80, fett=True, farbe=WEISS)
    s.text(270, 60, 1250, 50, "LEKTION %d  ·  %s  ·  DOSSIER %s" % (nr, datum, dossier), 24, "#ffb38a", fett=True)
    s.text(270, 110, 1250, 120, titel, 56, WEISS, fett=True)
    s.text(80, 290, 1440, 50, "LERNZIELE DIESER LEKTION", 26, "#9fd3e6", fett=True)
    s.text(80, 350, 1440, 300, "\n".join(ziele), 34, WEISS, liste="punkte")
    return s


def auftrag_seite(nr, titel, schritte, minuten, sozialform, sozialtext, dossier, tipp, notizen, schrift=30):
    s = Seite("Auftrag %d" % nr, "dunkel", notizen)
    s.form(80, 30, 120, 120, str(nr), fuellung=ORANGE, rand="keine", form="ellipse", groesse=60, fett=True, farbe=WEISS)
    s.text(230, 16, 1290, 50, "ARBEITSAUFTRAG %d  ·  %s  ·  DOSSIER %s" % (nr, sozialtext.upper(), dossier.upper()),
           24, "#ffb38a", fett=True)
    s.text(230, 58, 1290, 90, titel, 52, WEISS, fett=True)
    s.text(80, 200, 900, 440, "\n".join(schritte), schrift, WEISS, liste="nummern")
    s.el("timer", 1040, 200, 480, 300, {"sekunden": minuten * 60})
    s.el("sozialform", 1040, 530, 480, 330, {"form": sozialform})
    s.notiz(80, 670, 900, 190, tipp, GELB, 26)
    return s


def loesung_kopf(s, label, titel):
    s.form(80, 30, 100, 100, "✓", fuellung=GRUEN, rand="keine", form="ellipse", groesse=56, fett=True, farbe=WEISS)
    s.text(210, 16, 1310, 50, "LÖSUNG  ·  " + label, 24, GRUEN, fett=True)
    s.text(210, 58, 1310, 90, titel, 50, BLAU, fett=True)
    return s


def abschluss_seite(ziele, frage, notizen):
    s = Seite("Abschluss", "gruen", notizen)
    s.text(80, 10, 1440, 90, "Wo stehst du?", 56, WEISS, fett=True)
    s.text(80, 120, 1100, 60, "Zeige mit der Ampel: grün = kann ich, gelb = fast, rot = noch unsicher.", 28, WEISS, kursiv=True)
    s.text(80, 220, 1100, 380, "\n".join(ziele), 32, WEISS, liste="punkte")
    s.el("ampel", 1300, 150, 220, 500, {"licht": ""})
    s.notiz(80, 660, 1100, 200, frage, GELB, 30)
    return s


def pruefung_seite(notizen):
    s = Seite("Prüfung 11.11.", "weiss", notizen)
    s.kopf("11.11.2026  ·  PRÜFUNG", "Das musst du für die Prüfung können")
    spalten = [
        ("SORTIEREN", ["Algorithmus erklären", "Insertionsort anwenden", "Worst Case berechnen",
                       "Tournamentsort erklären", "Mergesort beschreiben"], HBLAU, PETROL),
        ("SUCHEN", ["Warum sortieren?", "Lineare und binäre Suche", "Teile und herrsche"], HORANGE, ORANGE),
        ("FAIRNESS", ["Gewichtung berechnen", "Unfairness beurteilen", "Einfluss beschreiben"], HGRUEN, GRUEN),
    ]
    for i, (t, punkte, f, r) in enumerate(spalten):
        x = 80 + i * 490
        s.form(x, 200, 460, 70, t, fuellung=r, rand="keine", groesse=30, fett=True, farbe=WEISS)
        s.form(x, 280, 460, 380, "\n".join("• " + p for p in punkte), fuellung=f, rand=r, groesse=28,
               vertikal="oben")
    s.notiz(80, 700, 1440, 160, "Dein korrigiertes Dossier ist dein Lernmittel. Die vollständige Lernzielübersicht "
            "steht auf der letzten Dossierseite. Prüfung: rund 40 Minuten, sieben Aufgaben.", HGRUEN, 28)
    return s


def tafel(tid, titel, seiten):
    out = []
    for i, s in enumerate(seiten):
        d = s.d
        d["id"] = "s%d" % (i + 1)
        out.append(d)
    return {"id": tid, "titel": titel, "seiten": out}


# ------------------------------------------------------------------ Lektion 1
def lektion1():
    S = []
    S.append(lernziele_seite(1, "16.09.2026", "S. 1 BIS 3", "Insertionsort: Sortieren durch Einfügen", [
        "Ich kann in eigenen Worten erklären, was ein Algorithmus ist.",
        "Ich kann Anweisungen so genau formulieren, dass ein Roboter sie fehlerfrei ausführt.",
        "Ich kann eine Liste nach dem Insertionsort-Prinzip von Hand sortieren."],
        "Einstieg ins Kapitel: Wie ordnen und finden Computer Daten, und wer entscheidet eigentlich über uns?\n"
        "Lernziele entsprechen Woche 1 und 2 der Lernzielübersicht im Dossier."))

    s = Seite("Modul-Überblick", "weiss",
              "Einmal in Lektion 1 zeigen.\nAchtung Reihenfolge: Im Dossier steht der Mergesort-Teil vor dem "
              "Fairness-Kapitel. Gemäss Jahresplan kommt er erst in Lektion 5. Der Klasse sagen, damit sie im "
              "Dossier vorwärts- und rückwärtsblättern kann.\nKorrekturfarbe konsequent einfordern: Das macht das "
              "Dossier zu einem verlässlichen Lernmittel für die Prüfung.")
    s.kopf("ÜBERBLICK", "Wettbewerb der Algorithmen: So läuft das Modul ab")
    s.tabelle(80, 190, 1440, [
        ["", "Datum", "Thema", "Dossier"],
        ["1", "16.09.", "Insertionsort", "S. 1 bis 3, Aufgaben 1 bis 3"],
        ["2", "30.09.", "Tournamentsort", "S. 4 bis 6, Aufgabe 4"],
        ["3", "21.10.", "Suchen", "S. 7 bis 12, Aufgaben 5 bis 7"],
        ["4", "28.10.", "Fairness", "S. 15 bis 20, Aufgaben 9 und 10"],
        ["5", "04.11.", "Mergesort", "S. 13 und 14, Aufgabe 8"],
        ["P", "11.11.", "Prüfung", "Lernzielübersicht, letzte Dossierseite"]], 26, zeile=52)
    s.form(80, 660, 700, 200, "● Dunkle Seite = Arbeitsauftrag\nSie bleibt stehen, solange ihr arbeitet: Zeit, "
           "Sozialform, Dossier.", fuellung=BLAU, rand="keine", groesse=26, farbe=WEISS)
    s.form(820, 660, 700, 200, "✓ Helle Seite = Lösung\nVergleichen und im Dossier mit einer anderen Farbe "
           "korrigieren.", fuellung=HGRUEN, rand=GRUEN, groesse=26)
    S.append(s)

    s = Seite("Einstieg", "gruen", "Phase: Einstieg (5 Min.)\nErst sammeln lassen (Partner, 2 Min.), dann mit "
              "«Weiter» die Kacheln aufdecken. Überleitung zum Sortiertheater auf Dossierseite 1.")
    s.text(80, 30, 1100, 100, "Wo begegnen euch Algorithmen?", 60, WEISS, fett=True)
    s.text(80, 150, 1100, 60, "Sammelt zu zweit möglichst viele Beispiele aus eurem Alltag.", 30, WEISS, kursiv=True)
    s.el("timer", 1200, 20, 320, 280, {"sekunden": 120})
    for i, (t, u) in enumerate([("Navigation", "berechnet die schnellste Route"),
                                ("Suchmaschine", "ordnet Millionen Treffer"),
                                ("Social Feed", "entscheidet, was oben steht"),
                                ("Online-Shop", "schlägt Produkte vor")]):
        s.form(80 + i * 370, 320, 330, 220, t + "\n" + u, fuellung=WEISS, rand=PETROL, groesse=28,
               anim=i + 1, effekt="zoomen")
    s.notiz(80, 600, 1440, 220, "Ein Algorithmus ist eine genaue Anleitung, die ein Problem Schritt für Schritt löst.",
            GELB, 38, anim=5)
    S.append(s)

    S.append(auftrag_seite(1, "Sortiertheater", [
        "Die eine Hälfte geht in den Gang und stellt sich beliebig auf.",
        "Eine Person nach der anderen kommt herein und reiht sich nach dem Geburtstag ein. Links am Fenster: wer zuerst im Jahr Geburtstag hat.",
        "Erlaubt ist nur die Frage: Hast du vor oder nach mir Geburtstag?",
        "Die andere Hälfte beobachtet und zählt, wie oft gefragt wird."],
        10, "plenum", "Klasse, zwei Gruppen", "Text S. 1",
        "Zweiter Durchgang: Die Gruppe im Gang heimlich vorsortieren lassen und normal spielen. Das ergibt den Best Case.",
        "Phase: Erarbeitung (10 Min.)\nEntspricht Buch 1A, Aufgabe 101. Das doppelte Erleben (mitspielen und "
        "beobachten) erleichtert das anschliessende Beschreiben.\nNächste Seite: Klasse in zwei Gruppen teilen und "
        "Fragen zählen.", schrift=28))

    s = Seite("Sortiertheater: Gruppen und Zählen", "kork",
              "Lostopf und Gruppen: Beim ersten Mal die Namensliste der Klasse einfügen.\nZählt die beobachtende "
              "Gruppe die Fragen; Ergebnis direkt in die Tabelle schreiben (Bearbeiten-Modus).")
    s.text(80, 10, 1440, 80, "Zwei Gruppen, zwei Durchgänge", 50, WEISS, fett=True)
    s.el("gruppen", 80, 150, 760, 500, {"namen": "", "nach": "anzahl", "gruppenzahl": 2})
    s.tabelle(900, 150, 620, [["Durchgang", "Anzahl Fragen"], ["1 · zufällig", ""], ["2 · vorsortiert", ""]], 28)
    s.el("stoppuhr", 900, 440, 620, 210, {})
    s.notiz(80, 700, 1440, 160, "Wann musste am meisten gefragt werden, wann am wenigsten? Warum?", GELB, 32)
    S.append(s)

    S.append(auftrag_seite(2, "Den Algorithmus aufschreiben", [
        "Aufgabe 1: Beschreibe das gespielte Verfahren mit eigenen Worten oder als Pseudocode.",
        "Dein Text muss so klar sein, dass eine fremde Person damit eine Gruppe korrekt sortieren könnte.",
        "Aufgabe 2: Definiere, was ein Algorithmus ist, und nenne mindestens drei Beispiele."],
        12, "einzel", "Einzelarbeit", "Aufgaben 1 und 2, S. 1 bis 2",
        "Tipp: Nummeriert eure Schritte und schreibt so knapp wie möglich.",
        "Phase: Erarbeitung (12 Min.)\nAufgabe 1 entspricht Buch 1A, Aufgabe 102. Zwei bis drei Lösungen vorlesen "
        "lassen (Lostopf auf der nächsten Seite), bevor die Lösung aufgedeckt wird."))

    s = Seite("Lösung Aufgabe 1", "weiss",
              "Zuerst 2–3 Lösungen vorlesen lassen (Lostopf), dann die Schritte mit «Weiter» aufdecken.\n"
              "Nicht auf die exakte Formulierung pochen, sondern auf Eindeutigkeit und Vollständigkeit. "
              "Häufiger Fehler: Die Abbruchbedingung fehlt (Schritt 4).")
    loesung_kopf(s, "DOSSIER AUFGABE 1", "Insertionsort als Pseudocode")
    s.el("zufall", 80, 200, 440, 420, {"namen": "", "ohne": True})
    for i, (t, u) in enumerate([
            ("Schritt 1", "Die erste Person stellt sich ganz links hin. Sie gilt als sortierter Bereich."),
            ("Schritt 2", "Die nächste Person kommt und vergleicht sich mit der Person ganz rechts in der Reihe."),
            ("Schritt 3", "Früher Geburtstag? Eine Person weiter nach links und erneut vergleichen. Sonst rechts daneben stellen."),
            ("Schritt 4", "Schritt 2 und 3 wiederholen, bis alle eingereiht sind.")]):
        s.karte(570 + (i % 2) * 485, 200 + (i // 2) * 215, 465, 195, t, u, anim=i + 1, groesse=24)
    s.notiz(80, 650, 1440, 200, "Prüfkriterium: Jeder Schritt muss eindeutig sein. Wörter wie «ungefähr» oder "
            "«passend» sind zu unscharf für einen Roboter.", HGRUEN, 30, anim=5)
    S.append(s)

    s = Seite("Lösung Aufgabe 2", "weiss",
              "Wichtig für die Prüfung: Algorithmus von Programm und Gerät unterscheiden können.")
    loesung_kopf(s, "DOSSIER AUFGABE 2", "Was ist ein Algorithmus?")
    s.form(80, 200, 1440, 170, "Ein Algorithmus ist eine eindeutige Anleitung, die ein Problem Schritt für Schritt "
           "und in endlich vielen Schritten löst. Jeder Schritt ist so klar, dass es keinen Interpretationsspielraum gibt.",
           fuellung=HGRUEN, rand=GRUEN, groesse=30, anim=1)
    s.karte(80, 400, 700, 230, "Aus dem Alltag", "Kochrezept, Bauanleitung eines Möbels, Bedienungsanleitung, "
            "schriftliches Rechnen", fuellung=HORANGE, rand=ORANGE, anim=2, groesse=28)
    s.karte(820, 400, 700, 230, "Aus der Technik", "Route im Navi, Rangliste im Social Feed, Suchtreffer bei Google, "
            "Gesichtserkennung beim Entsperren", anim=3, groesse=28)
    s.notiz(80, 660, 1440, 190, "Ein Rezept zählt, «mein Handy» zählt nicht: Das ist ein Gerät und keine Anleitung.",
            GELB, 30, anim=4)
    S.append(s)

    s = Seite("Merkmale eines Algorithmus", "weiss",
              "Nach Aufgabe 2 einführen, wenn die Klasse eigene Definitionen formuliert hat. Prüfungsrelevant und "
              "Grundlage für das Bewerten von Pseudocode.\nZuerst die Frage stellen: Ist «Mach das Essen fertig» ein "
              "Algorithmus?")
    s.kopf("LEKTION 1  ·  THEORIE", "Woran erkennt man einen Algorithmus?")
    for i, (t, u) in enumerate([
            ("1  Eindeutig", "Jeder Schritt ist klar. Kein Spielraum für eigene Interpretation. «Etwa in der Mitte» wäre zu ungenau."),
            ("2  Endlich", "Das Verfahren hört irgendwann auf und liefert ein Ergebnis."),
            ("3  Allgemein", "Es funktioniert für alle gleichartigen Fälle, nicht nur für ein Beispiel.")]):
        s.karte(80 + i * 490, 210, 460, 330, t, u, anim=i + 1, groesse=28)
    s.notiz(80, 590, 1440, 250, "Ein Kochrezept erfüllt alle drei Punkte.\n«Mach das Essen fertig» erfüllt keinen davon.",
            GELB, 34, anim=4)
    S.append(s)

    s = Seite("Best Case und Worst Case", "weiss",
              "Text auf Dossierseite 2. Die Formel bewusst noch nicht zeigen, sie wird erst nach dem Kartenspiel aufgedeckt.")
    s.kopf("LEKTION 1  ·  THEORIE", "Best Case und Worst Case")
    s.karte(80, 220, 700, 380, "BEST CASE", "Das neue Element gehört schon ans Ende. Niemand muss zur Seite rücken. "
            "Das geht am schnellsten.", fuellung=HGRUEN, rand=GRUEN, anim=1, groesse=32)
    s.karte(820, 220, 700, 380, "WORST CASE", "Das neue Element muss ganz nach vorne. Alle anderen rücken einen Platz "
            "zur Seite. Das dauert am längsten.", fuellung=ROSA, rand=ORANGE, anim=2, groesse=32)
    s.notiz(80, 660, 1440, 180, "Gleich testet ihr den Worst Case selbst mit fünf Spielkarten.", GELB, 32, anim=3)
    S.append(s)

    s = Seite("Insertionsort Schritt für Schritt", "kariert",
              "Vor dem Kartenspiel zeigen und Zeile für Zeile («Weiter») laut mitsprechen lassen.\nZentral: Der "
              "Computer sieht immer nur eine Karte und den sortierten Bereich, nie die ganze Reihe.")
    s.kopf("LEKTION 1  ·  THEORIE", "Insertionsort Schritt für Schritt")
    reihen = [("Start", [5, 2, 4, 1, 3], 1, "Die erste Karte gilt bereits als sortiert."),
              ("Schritt 1", [2, 5, 4, 1, 3], 2, "Die 2 wandert an der 5 vorbei nach vorne."),
              ("Schritt 2", [2, 4, 5, 1, 3], 3, "Die 4 schiebt sich zwischen 2 und 5."),
              ("Schritt 3", [1, 2, 4, 5, 3], 4, "Die 1 muss an allen vorbei: 3 Verschiebungen."),
              ("Schritt 4", [1, 2, 3, 4, 5], 5, "Fertig. Alle Karten sind sortiert.")]
    for r, (name, karten, sortiert, text) in enumerate(reihen):
        y = 190 + r * 120
        s.text(80, y + 20, 180, 60, name, 28, BLAU, anim=r + 1, fett=True)
        for k, wert in enumerate(karten):
            gruen = k < sortiert
            s.form(270 + k * 100, y, 84, 104, str(wert), fuellung=HGRUEN if gruen else GRAU,
                   rand=GRUEN if gruen else "#9aa5b1", groesse=40, fett=True, anim=r + 1, form="rechteck")
        s.text(800, y + 20, 720, 70, text, 28, SCHWARZ, anim=r + 1)
    s.text(80, 805, 1440, 60, "Grün = schon sortierter Bereich.   Grau = noch nicht angeschaut.", 26, PETROL, kursiv=True)
    S.append(s)

    S.append(auftrag_seite(3, "Insertionsort mit Karten", [
        "Aufgabe 3a: Legt 5 Karten gemischt hin und sortiert sie streng nach dem Insertionsort-Prinzip.",
        "Aufgabe 3b: Legt die Karten so hin, dass der Algorithmus maximal viel Arbeit hat.",
        "Zählt für jede Karte, an wie vielen sie vorbei muss, und notiert die Gesamtzahl.",
        "Zusatz: Wie viele Verschiebungen wären es bei 10 Karten? Formel für n Karten?"],
        15, "partner", "Partnerarbeit", "Aufgabe 3, S. 2 bis 3",
        "Geht streng wie ein Computer vor: immer nur eine Karte im Blick, keine Gesamtübersicht.",
        "Phase: Erarbeitung (15 Min.)\nHäufigste Abweichung: Teams sortieren intuitiv statt Schritt für Schritt. "
        "Beim Rundgang darauf achten und gegebenenfalls eine Gruppe vormachen lassen.", schrift=28))

    s = Seite("Lösung Aufgabe 3b", "weiss",
              "Zuerst die Tabelle rechts mit der Klasse füllen (Bearbeiten-Modus), dann aufdecken.\nDie Formel heisst "
              "kleine Summenformel von Gauss. Wer sie selbst gefunden hat, darf den Weg an der Wandtafel zeigen.\n"
              "Kontrolle Buch 1B: 4 Personen 6, 8 Personen 28, 20 Personen 190.")
    loesung_kopf(s, "DOSSIER AUFGABE 3B UND ZUSATZAUFGABE 1", "Der Worst Case beim Insertionsort")
    s.karte(80, 200, 880, 160, "Worst Case", "Die Karten liegen genau umgekehrt: 5, 4, 3, 2, 1. Jede neue Karte muss "
            "an allen bisherigen vorbei.", fuellung=ROSA, rand=ORANGE, anim=1, groesse=26)
    s.karte(80, 380, 880, 120, "Bei 5 Karten", "0 + 1 + 2 + 3 + 4 = 10 Verschiebungen", anim=2, groesse=28)
    s.karte(80, 520, 880, 120, "Bei 10 Karten", "0 + 1 + 2 + … + 9 = 45 Verschiebungen", anim=3, groesse=28)
    s.form(80, 660, 880, 200, "Formel:  n × (n − 1) ÷ 2\n10 × 9 ÷ 2 = 45. Doppelt so viele Karten, etwa viermal so viel Arbeit.",
           fuellung=HGRUEN, rand=GRUEN, groesse=28, anim=4, fett=True)
    s.text(1010, 200, 510, 50, "Ausfüllen: Wie viele Verschiebungen?", 24, PETROL, fett=True)
    s.tabelle(1010, 260, 510, [["Karten", "Worst Case"], ["4", ""], ["5", ""], ["8", ""], ["10", ""], ["20", ""]], 28)
    S.append(s)

    S.append(abschluss_seite([
        "Ich kann erklären, was ein Algorithmus ist.",
        "Ich kann eindeutige Anweisungen formulieren.",
        "Ich kann Karten mit dem Insertionsort sortieren."],
        "Ausblick: Geht das auch schneller? Nächste Lektion lassen wir die Karten gegeneinander antreten.",
        "Phase: Abschluss (3 Min.)\nKurze Selbsteinschätzung mit der Ampel."))
    return tafel("t-l1", "Lektion 1: Insertionsort", S)


# ------------------------------------------------------------------ Lektion 2
def lektion2():
    S = []
    S.append(lernziele_seite(2, "30.09.2026", "S. 4 BIS 6", "Tournamentsort: Sortieren wie die Champions", [
        "Ich kann erklären, wie der Tournamentsort mit dem Turnierbaum funktioniert.",
        "Ich kann die Anzahl Vergleiche beider Verfahren auszählen und vergleichen.",
        "Ich kann sagen, warum der Tournamentsort bei riesigen Datenmengen schneller ist."],
        "Lernziele entsprechen Woche 2 der Lernzielübersicht."))

    s = Seite("Blitzlicht", "gruen", "Phase: Einstieg (3 Min.)\nZwei Minuten Blitzlicht: Wer erklärt den "
              "Insertionsort? Dann Überleitung: Geht das auch schneller?")
    s.text(80, 20, 1440, 100, "Wie funktionierte der Insertionsort nochmals?", 56, WEISS, fett=True)
    s.el("zufall", 80, 200, 560, 440, {"namen": "", "ohne": True})
    s.el("timer", 700, 200, 400, 300, {"sekunden": 120})
    s.notiz(1160, 200, 360, 300, "Stichworte: sortierter Bereich, eine Karte, einfügen, verschieben", GELB, 28)
    s.notiz(700, 560, 820, 280, "Geht das auch schneller?", HORANGE, 48, anim=1)
    S.append(s)

    s = Seite("Das Turnier-Prinzip", "weiss",
              "Häufige Fehlerquelle: Die Verlierenden werden nicht von unten nachgerückt. Eine Karte darf nur dann "
              "gegen eine leere Position antreten, wenn darunter nichts mehr nachrücken kann. Solche Forfait-Siege "
              "zählen als Vergleich mit.")
    s.kopf("LEKTION 2  ·  THEORIE", "Das Turnier-Prinzip")
    for i, (t, u) in enumerate([("1  Zweikampf", "Immer zwei Karten treten gegeneinander an."),
                                ("2  Aufsteigen", "Die Siegerkarte steigt eine Ebene nach oben."),
                                ("3  Nachrücken", "Von unten rücken Karten auf die freien Plätze nach."),
                                ("4  Rangliste", "Wer oben ankommt, belegt den nächsten freien Rang.")]):
        s.karte(80 + i * 370, 210, 340, 300, t, u, anim=i + 1, groesse=28)
    s.notiz(80, 560, 1440, 280, "MERKE: Der Tournamentsort braucht immer gleich viele Vergleiche, egal wie die "
            "Karten am Anfang liegen. Es gibt also weder Best Case noch Worst Case.", HGRUEN, 32, anim=5)
    S.append(s)

    s = Seite("Der Turnierbaum", "kariert",
              "Anzahl Ebenen = Logarithmus zur Basis 2 der Kartenzahl: 8 Karten 3 Ebenen, 64 Karten 6. Für die Prüfung "
              "reicht «Anzahl Ebenen», der Logarithmus ist Zusatzwissen.\nVideo: connected 4, Kapitel 4.1 (LMVZ).")
    s.kopf("LEKTION 2  ·  THEORIE", "Der Turnierbaum und sein Aufwand")
    bw, gap, x0 = 80, 18, 80
    ys = {1: 700, 2: 540, 3: 380, 4: 220}
    breite = 8 * bw + 7 * gap
    mitten = {}
    for ebene, anzahl in [(1, 8), (2, 4), (3, 2), (4, 1)]:
        schritt = breite / anzahl
        mitten[ebene] = []
        for k in range(anzahl):
            mx = x0 + schritt * k + schritt / 2
            mitten[ebene].append(mx)
            s.form(int(mx - bw / 2), ys[ebene], bw, 90, "Rang" if ebene == 4 else "",
                   fuellung=HORANGE if ebene == 4 else (WEISS if ebene == 1 else HBLAU),
                   rand=ORANGE if ebene == 4 else PETROL, groesse=22, fett=True, form="rechteck")
    for ebene in (2, 3, 4):
        for k, mx in enumerate(mitten[ebene]):
            for kind in (mitten[ebene - 1][2 * k], mitten[ebene - 1][2 * k + 1]):
                s.linie(int(kind), ys[ebene - 1], int(mx), ys[ebene] + 90)
    for ebene, name in [(1, "Ebene 1"), (2, "Ebene 2"), (3, "Ebene 3")]:
        s.text(x0 + breite + 30, ys[ebene] + 20, 160, 50, name, 26, PETROL, fett=True)
    s.notiz(1060, 200, 460, 250, "8 Karten × 3 Ebenen\n= 24 Vergleiche", HGRUEN, 36, anim=1)
    s.notiz(1060, 470, 460, 180, "3 Ebenen, weil 2³ = 8\nAllgemein: n × log₂(n)", GELB, 28, anim=2)
    s.el("link", 1060, 670, 460, 190, {"url": "https://003.lmvz.ch/connected/connected_4/4_1.html",
                                       "titel": "Video: connected 4, Kapitel 4.1"})
    S.append(s)

    S.append(auftrag_seite(4, "Turnierbaum legen", [
        "Verteilt die 8 Profile zufällig auf die unterste Ebene des Turnierbaums.",
        "Legt fest, welche Eigenschaft über Sieg oder Niederlage entscheidet.",
        "Spielt das Turnier durch und rückt die Verlierenden immer von unten nach.",
        "Aufgabe 4: Notiert die Anzahl Vergleiche für beide Verfahren und eure Vermutung."],
        18, "gruppe", "Partner- oder Gruppenarbeit", "Aufgabe 4, S. 5",
        "Macht für jeden Zweikampf einen Strich, auch für Vergleiche mit einem leeren Feld.",
        "Phase: Erarbeitung (18 Min.)\nEntspricht Buch 1D, Aufgaben 108 und 109. Turnierbaum und Instagram-Profile "
        "bereitlegen.", schrift=28))

    s = Seite("Eure Ergebnisse", "kork", "Ergebnisse der Teams eintragen (Bearbeiten-Modus). Abweichende Zahlen "
              "liegen meist am fehlenden Nachrücken: kurz am Turnierbaum nachvollziehen.")
    s.text(80, 10, 1440, 80, "Wie viele Vergleiche habt ihr gezählt?", 50, WEISS, fett=True)
    s.tabelle(80, 150, 1000, [["Team", "Tournamentsort", "Insertionsort", "Vermutung"]] +
              [["", "", "", ""] for _ in range(6)], 28)
    s.el("zufall", 1120, 150, 400, 420, {"namen": "", "ohne": True})
    s.notiz(1120, 600, 400, 260, "Warum haben alle beim Tournamentsort dieselbe Zahl?", GELB, 28)
    S.append(s)

    s = Seite("Lösung Aufgabe 4", "weiss", "Kontrolle: 4 Karten → 8 Vergleiche, 8 Karten → 24 Vergleiche.")
    loesung_kopf(s, "DOSSIER AUFGABE 4", "Wie viele Vergleiche braucht es?")
    s.karte(80, 200, 700, 300, "Tournamentsort", "Genau 24 Vergleiche bei 8 Elementen. Immer gleich, egal wie die "
            "Karten am Anfang liegen.", anim=1, groesse=28)
    s.karte(820, 200, 700, 300, "Insertionsort", "Zwischen 7 und 28 Vergleichen: Best Case 7 (sortiert), Worst Case 28 "
            "(umgekehrt), im Schnitt etwa 18.", fuellung=HORANGE, rand=ORANGE, anim=2, groesse=28)
    s.form(80, 540, 1440, 300, "Welcher ist effektiver?\nBei 8 Elementen liegen beide nahe beieinander. Ab 8 Elementen "
           "wird der Tournamentsort günstiger, und je mehr Daten, desto grösser sein Vorsprung.",
           fuellung=HGRUEN, rand=GRUEN, groesse=30, anim=3)
    S.append(s)

    S.append(auftrag_seite(5, "Die Tabelle und das Diagramm", [
        "Zusatzaufgabe 2: Berechnet die Vergleiche beider Verfahren für 4, 8, 16, 32 und 64 Elemente.",
        "Insertionsort (Worst Case): n × (n − 1) ÷ 2",
        "Tournamentsort: n × Anzahl Ebenen",
        "Zusatzaufgabe 3: Zeichnet die Werte ins Diagramm, je Verfahren eine Farbe."],
        15, "partner", "Partnerarbeit", "Zusatzaufgaben 2 und 3, S. 5 bis 6",
        "Ebenen: 4 Elemente → 2, 8 → 3, 16 → 4, 32 → 5, 64 → 6.",
        "Phase: Vertiefung (15 Min.)\nEntspricht Buch 1D, Aufgabe 110. Taschenrechner bereithalten. Wer schnell "
        "ist, kann das Diagramm in Excel erstellen.", schrift=28))

    s = Seite("Lösung Zusatzaufgaben 2 und 3", "weiss",
              "Die Klasse soll die Form der Kurven beschreiben: Der Insertionsort steigt immer steiler an, der "
              "Tournamentsort fast gerade. Das ist der Unterschied zwischen quadratischem und logarithmischem Wachstum.\n"
              "Balken mit «Weiter» Paar für Paar aufdecken.")
    loesung_kopf(s, "ZUSATZAUFGABEN 2 UND 3", "Die ausgefüllte Tabelle und das Diagramm")
    werte = [(4, 6, 8), (8, 28, 24), (16, 120, 64), (32, 496, 160), (64, 2016, 384)]
    s.tabelle(80, 200, 560, [["Elemente", "Insertion", "Tournament"]] + [[str(a), str(b), str(c)] for a, b, c in werte], 28)
    # Balkendiagramm: Grundlinie y=760, max 2016 -> 500 Punkte
    basis, hmax = 760, 500
    for i, (n, ins, tour) in enumerate(werte):
        x = 720 + i * 160
        for j, (wert, farbe) in enumerate([(ins, ORANGE), (tour, PETROL)]):
            h = max(4, round(wert / 2016 * hmax))
            s.form(x + j * 62, basis - h, 56, h, "", fuellung=farbe, rand="keine", form="rechteck", anim=i + 1,
                   effekt="wischen")
        s.text(x - 10, basis + 10, 140, 44, str(n), 26, SCHWARZ, fett=True, ausrichtung="center")
    s.linie(700, basis, 1520, basis, SCHWARZ, 3)
    s.form(720, 200, 260, 50, "Insertionsort", fuellung=ORANGE, rand="keine", groesse=22, farbe=WEISS, fett=True)
    s.form(720, 260, 260, 50, "Tournamentsort", fuellung=PETROL, rand="keine", groesse=22, farbe=WEISS, fett=True)
    s.notiz(80, 600, 560, 260, "Bei 64 Elementen braucht der Insertionsort über fünfmal so viele Vergleiche.",
            GELB, 26, anim=6)
    S.append(s)

    s = Seite("Zwei Arten von Wachstum", "weiss",
              "Direkt nach dem Diagramm zeigen; die Folie gibt der Kurvenform einen Namen. Für die Prüfung genügt "
              "«der Aufwand wächst viel schneller bzw. viel langsamer».")
    s.kopf("LEKTION 2  ·  THEORIE", "Zwei Arten von Wachstum")
    s.karte(80, 210, 700, 420, "INSERTIONSORT\nQuadratisches Wachstum",
            "Doppelte Datenmenge: etwa vierfacher Aufwand.\n\n32 Elemente → 496 Vergleiche\n64 Elemente → 2016 Vergleiche",
            fuellung=HORANGE, rand=ORANGE, anim=1, groesse=28)
    s.karte(820, 210, 700, 420, "TOURNAMENTSORT UND MERGESORT\nLogarithmisches Wachstum",
            "Doppelte Datenmenge: pro Karte nur eine Ebene mehr.\n\n32 Elemente → 160 Vergleiche\n64 Elemente → 384 Vergleiche",
            anim=2, groesse=28)
    s.notiz(80, 670, 1440, 180, "Genau darum arbeiten grosse Datenbanken nie mit dem Insertionsort.", HGRUEN, 34, anim=3)
    S.append(s)

    S.append(abschluss_seite([
        "Ich kann den Tournamentsort mit dem Turnierbaum erklären.",
        "Ich kann die Vergleiche beider Verfahren auszählen.",
        "Ich weiss, warum der Tournamentsort bei vielen Daten schneller ist."],
        "Exit-Frage: Warum braucht der Tournamentsort immer gleich viele Vergleiche? Erkläre in einem Satz.",
        "Phase: Abschluss (3 Min.)"))
    return tafel("t-l2", "Lektion 2: Tournamentsort", S)


# ------------------------------------------------------------------ Lektion 3
def lektion3():
    S = []
    S.append(lernziele_seite(3, "21.10.2026", "S. 7 BIS 12", "Suchen: Die Nadel im Heuhaufen finden", [
        "Ich kann erklären, warum Daten sortiert sein müssen, damit eine Suche schnell ist.",
        "Ich kann lineare und binäre Suche unterscheiden.",
        "Ich kann das Prinzip Teile und herrsche erklären und beim Zahlenraten anwenden."],
        "Woche 3 der Lernzielübersicht. Ablauf: zuerst Aufgabe 5 (Vergleichstabelle, S. 7) als Wiedereinstieg nach "
        "den Ferien, danach Übergang zum Suchen mit dem TikTok-Beispiel auf S. 8."))

    S.append(auftrag_seite(6, "Partner-Check und Vergleich", [
        "Klärt mündlich zu zweit: Wie funktioniert der Insertionsort?",
        "Wie funktioniert der Tournamentsort? Denkt an das K.-o.-System.",
        "Welcher ist bei vielen Daten schneller?",
        "Erst wenn ihr euch einig seid: Füllt Aufgabe 5, die Vergleichstabelle, aus."],
        12, "partner", "Partnerarbeit, dann Einzelarbeit", "Aufgabe 5, S. 7",
        "Zuerst reden, dann schreiben. Wer es erklären kann, hat es verstanden.",
        "Phase: Wiedereinstieg (12 Min.)\nAus Lektion 2 verschoben: Partner-Check als Repetition von Insertionsort "
        "und Tournamentsort. Beim Rundgang hineinhören und typische Fehlvorstellungen notieren."))

    s = Seite("Lösung Aufgabe 5", "weiss",
              "Prüfungsrelevant. Die Klasse ergänzt mit Farbe, nicht einfach abschreiben. Eigene Formulierungen sind "
              "erlaubt; wichtig ist, dass Prinzip, Analogie und Effizienz klar unterschieden werden.\nZeilen nacheinander "
              "aufdecken.")
    loesung_kopf(s, "DOSSIER AUFGABE 5", "Die ausgefüllte Vergleichstabelle")
    s.form(80, 200, 300, 60, "", fuellung="keine", rand="keine")
    s.form(400, 200, 550, 60, "Insertionsort", fuellung=ORANGE, rand="keine", groesse=28, fett=True, farbe=WEISS)
    s.form(970, 200, 550, 60, "Tournamentsort", fuellung=PETROL, rand="keine", groesse=28, fett=True, farbe=WEISS)
    zeilen = [("Prinzip", "Jedes neue Element wird an der richtigen Stelle in den sortierten Bereich eingefügt.",
               "Je zwei Elemente treten gegeneinander an, der Sieger steigt auf, von unten wird nachgerückt."),
              ("Analogie", "Spielkarten in die Hand einsortieren, sich nach Geburtstag in eine Reihe stellen.",
               "Sportturnier im Cupsystem, zum Beispiel ein Fussballturnier."),
              ("Effizienz", "Bei grossen Datenmengen langsam: Der Aufwand wächst quadratisch.",
               "Bei grossen Datenmengen schnell: immer gleich viele Vergleiche.")]
    for i, (k, a, b) in enumerate(zeilen):
        y = 280 + i * 195
        s.form(80, y, 300, 175, k, fuellung=GRAU, rand="keine", groesse=30, fett=True)
        s.form(400, y, 550, 175, a, fuellung=HORANGE, rand=ORANGE, groesse=25, anim=i + 1)
        s.form(970, y, 550, 175, b, fuellung=HBLAU, rand=PETROL, groesse=25, anim=i + 1)
    S.append(s)

    s = Seite("Vom Sortieren zum Suchen", "dunkel",
              "Übergang nach Aufgabe 5. Zuerst links als Rückblick: zwei Lektionen nur sortiert. Dann rechts aufdecken "
              "und die Frage offen lassen. Keine Antwort verraten, die Klasse schreibt die Vermutung in Aufgabe 6 (S. 8).\n"
              "Optional live: Stichwort in die TikTok-Suche tippen.")
    s.text(80, 16, 1440, 50, "LEKTION 3  ·  ÜBERGANG", 24, "#ffb38a", fett=True)
    s.text(80, 58, 1440, 96, "Vom Sortieren zum Suchen", 52, WEISS, fett=True)
    s.karte(80, 210, 700, 400, "BISHER: Wir haben sortiert", "Karten, Profile und Personen in die richtige "
            "Reihenfolge bringen. Doch wozu eigentlich?\n\nInsertionsort · Tournamentsort", fuellung=HBLAU, rand=PETROL,
            groesse=28)
    s.karte(820, 210, 700, 400, "HEUTE: Wir suchen", "Du tippst auf TikTok ein Stichwort ein und bekommst sofort "
            "passende Videos.\n\n1 Milliarde Videos → Ergebnis in 0,1 Sekunden", fuellung=HORANGE, rand=ORANGE,
            groesse=28, anim=1)
    s.notiz(80, 650, 1440, 200, "Wie schafft TikTok das? Eure Vermutung schreibt ihr gleich auf Seite 8 auf.", GELB, 34,
            anim=2)
    S.append(s)

    S.append(auftrag_seite(7, "Die Nadel im Heuhaufen", [
        "Lest das Beispiel auf Seite 8: 1 Milliarde Videos, Ergebnis in 0,1 Sekunden.",
        "Aufgabe 6: Schreibt eure Vermutung auf, warum TikTok die Daten sortiert haben muss.",
        "Denkt daran: Würde der Computer jedes Video einzeln prüfen, bräuchte er Jahre."],
        8, "einzel", "Einzelarbeit", "Aufgabe 6, S. 8",
        "Es gibt hier noch keine richtige oder falsche Antwort. Eure Vermutung zählt.",
        "Phase: Erarbeitung (8 Min.)\nBewusst als Vermutungsaufgabe halten. Lösung erst nach dem Theorietext "
        "«Suchen und Finden» aufdecken."))

    s = Seite("Lösung Aufgabe 6", "weiss", "Brücke von Lektion 1 und 2 zu Lektion 3: diesen Zusammenhang explizit benennen.")
    loesung_kopf(s, "DOSSIER AUFGABE 6", "Warum Sortieren die Suche schnell macht")
    s.karte(80, 200, 460, 400, "Ohne Ordnung", "Der Computer müsste jedes Video anschauen: 1 Milliarde Mal "
            "nachsehen. Viel zu lange.", fuellung=ROSA, rand=ORANGE, anim=1, groesse=28)
    s.karte(570, 200, 460, 400, "Mit Ordnung", "Mit jedem Schritt fällt die Hälfte aller Videos weg, ohne sie "
            "anzusehen. Er weiss ja, wo etwas stehen müsste.", anim=2, groesse=28)
    s.karte(1060, 200, 460, 400, "Die Zahl dazu", "Bei 1 Milliarde Einträgen genügen rund 30 Halbierungsschritte.",
            fuellung=HORANGE, rand=ORANGE, anim=3, groesse=28)
    s.notiz(80, 640, 1440, 210, "Kernsatz für die Prüfung: Sortieren ist die Vorarbeit, die schnelles Suchen überhaupt "
            "erst möglich macht.", HGRUEN, 34, anim=4)
    S.append(s)

    s = Seite("Lineare und binäre Suche", "weiss",
              "Text auf Dossierseite 10. Gleich danach folgt das Zahlen-Duell, bei dem die Klasse die Strategie selbst "
              "entdeckt.")
    s.kopf("LEKTION 3  ·  THEORIE", "Zwei Wege, ein Wort zu finden")
    s.karte(80, 210, 700, 420, "LINEARE SUCHE: der Blätter-Weg", "Du beginnst auf Seite 1 mit Aal, Abend, Apfel und "
            "blätterst jede Seite einzeln um, bis du bei Zebra bist.\n\n1000 Seiten → bis zu 1000 Schritte",
            fuellung=HORANGE, rand=ORANGE, anim=1, groesse=28)
    s.karte(820, 210, 700, 420, "BINÄRE SUCHE: der Profi-Weg", "Du schlägst in der Mitte auf, siehst «Maus» und wirfst "
            "die vordere Hälfte weg. Dann wieder Mitte, wieder halbieren.\n\n1000 Seiten → höchstens 10 Schritte",
            anim=2, groesse=28)
    s.notiz(80, 670, 1440, 180, "Voraussetzung: Die Daten müssen sortiert sein. Im Wörterbuch ist das das Alphabet.",
            GELB, 32, anim=3)
    S.append(s)

    S.append(auftrag_seite(8, "Das Zahlen-Duell", [
        "Person A denkt sich eine ganze Zahl zwischen 1 und 100.",
        "Person B rät. A antwortet nur mit höher, tiefer oder richtig.",
        "Zählt laut mit, wie viele Versuche ihr braucht. Dann Rollen tauschen.",
        "Runde 3, Profi-Runde: so effizient wie möglich. Notiert euren besten ersten Tipp."],
        15, "partner", "Partnerarbeit", "Aufgabe 7, S. 10",
        "Am Schluss vergleichen: Wer hat am wenigsten Versuche gebraucht, und warum?",
        "Phase: Erarbeitung (15 Min.)\nEntspricht Buch 1G, Aufgabe 117 (dort 1 bis 50). Die Klasse entdeckt die "
        "Halbierungsstrategie in der Regel selbst.", schrift=28))

    s = Seite("Zahlen-Duell: Auswertung", "kork",
              "Rekorde der Paare eintragen (Bearbeiten-Modus).\nHäufige Fehlvorstellung: Ein Glückstreffer sei die "
              "beste Strategie. Herausarbeiten, dass es um den garantiert schlechtesten Fall geht.")
    s.text(80, 10, 1440, 80, "Wer hat am wenigsten Versuche gebraucht?", 50, WEISS, fett=True)
    s.tabelle(80, 150, 1000, [["Paar", "Runde 1", "Runde 2", "Profi-Runde", "Erster Tipp"]] +
              [["", "", "", "", ""] for _ in range(6)], 28)
    s.el("zufall", 1120, 150, 400, 420, {"namen": "", "ohne": True})
    s.notiz(1120, 600, 400, 260, "Ist ein Glückstreffer eine gute Strategie?", GELB, 28)
    S.append(s)

    s = Seite("Lösung Aufgabe 7", "weiss", "")
    loesung_kopf(s, "DOSSIER AUFGABE 7", "Die beste Ratestrategie")
    s.karte(80, 200, 460, 400, "Bester erster Tipp", "Die 50, also die Mitte. Egal ob höher oder tiefer: Es fallen "
            "sofort 50 Zahlen weg.", anim=1, groesse=28)
    s.karte(570, 200, 460, 400, "Der Weg danach", "Immer die Mitte des Restbereichs raten:\n100 → 50 → 25 → 13 → 7 → 4 → 2 → 1",
            anim=2, groesse=28)
    s.karte(1060, 200, 460, 400, "Anzahl Versuche", "Höchstens 7. Wer der Reihe nach rät, braucht im schlechtesten "
            "Fall 100 und im Schnitt 50.", fuellung=HORANGE, rand=ORANGE, anim=3, groesse=28)
    s.notiz(80, 640, 1440, 210, "Regel: Jede Halbierung kostet einen Versuch. Bei 1 Million Zahlen wären es weniger "
            "als 20 Versuche.", HGRUEN, 32, anim=4)
    S.append(s)

    s = Seite("Binäre Suche Schritt für Schritt", "kariert",
              "Erst nach dem Zahlen-Duell zeigen. Mit «Weiter» Versuch für Versuch halbieren. Die Zahlenreihe unten "
              "stellt den Bezug zum TikTok-Beispiel wieder her.")
    s.kopf("LEKTION 3  ·  THEORIE", "Die binäre Suche Schritt für Schritt")
    s.text(80, 170, 1440, 50, "So schrumpft der Suchbereich, wenn du immer die Mitte rätst:", 28, SCHWARZ, kursiv=True)
    zahlen = [100, 50, 25, 13, 7, 4, 2, 1]
    for i, z in enumerate(zahlen):
        x = 80 + i * 185
        d = 170 - i * 12
        s.form(x + (170 - d) // 2, 280 + (170 - d) // 2, d, d, str(z), fuellung=HBLAU if i else GRAU,
               rand=PETROL, form="ellipse", groesse=40 - i * 2, fett=True, anim=i if i else None, effekt="zoomen")
        if i:
            s.text(x, 430, 170, 44, "Versuch %d" % i, 24, PETROL, anim=i, ausrichtung="center", fett=True)
    s.karte(80, 560, 700, 290, "DIE REGEL", "Jede Halbierung kostet genau einen Versuch. Verdoppelt sich der "
            "Suchbereich, kommt nur ein Versuch dazu.", fuellung=HGRUEN, rand=GRUEN, anim=8, groesse=28)
    s.karte(820, 560, 700, 290, "ZUM VERGLEICH", "1000 Zahlen: 10 Versuche\n1 Million Zahlen: 20 Versuche\n"
            "1 Milliarde Zahlen: 30 Versuche", fuellung=HORANGE, rand=ORANGE, anim=9, groesse=28)
    S.append(s)

    s = Seite("Teile und herrsche", "weiss",
              "Den Lückentext auf Dossierseite 12 zuerst selbst ausfüllen lassen, dann aufdecken. Lösungswörter: Mitte "
              "und wegwerfen.")
    s.kopf("LEKTION 3  ·  DAS PRINZIP", "Teile und herrsche")
    s.karte(80, 200, 700, 220, "TEILE", "Mach das Problem kleiner: Zerlege die riesige Datenmenge in zwei Hälften.",
            anim=1, groesse=30)
    s.karte(820, 200, 700, 220, "HERRSCHE", "Entscheide, welche Hälfte die richtige ist, und wirf den Rest weg.",
            fuellung=HORANGE, rand=ORANGE, anim=2, groesse=30)
    s.notiz(80, 460, 1440, 260, "Merksatz: Wenn Daten sortiert sind, muss ich nicht jedes Element einzeln anschauen. "
            "Ich gehe in die ________, vergleiche und kann so jedes Mal die Hälfte der Daten ________. So finde ich auch "
            "unter 1 Million Daten das Ziel in weniger als 20 Schritten.", GELB, 30)
    s.form(80, 750, 400, 110, "Mitte", fuellung=HGRUEN, rand=GRUEN, groesse=40, fett=True, anim=3, effekt="zoomen")
    s.form(520, 750, 400, 110, "wegwerfen", fuellung=HGRUEN, rand=GRUEN, groesse=40, fett=True, anim=4, effekt="zoomen")
    S.append(s)

    S.append(abschluss_seite([
        "Ich weiss, warum Daten für eine schnelle Suche sortiert sein müssen.",
        "Ich kann lineare und binäre Suche unterscheiden.",
        "Ich kann Teile und herrsche erklären."],
        "Exit-Frage: Wie viele Versuche brauchst du höchstens, um eine Zahl zwischen 1 und 1000 zu erraten?",
        "Phase: Abschluss (3 Min.)\nAntwort: 10 Versuche."))
    return tafel("t-l3", "Lektion 3: Suchen", S)


# ------------------------------------------------------------------ Lektion 4
def lektion4():
    S = []
    S.append(lernziele_seite(4, "28.10.2026", "S. 15 BIS 20", "Wer entscheidet über mich?", [
        "Ich kann zeigen, wie ein Algorithmus durch Gewichtung von Eigenschaften entscheidet.",
        "Ich kann beurteilen, warum eine algorithmische Entscheidung unfair sein kann.",
        "Ich kann beschreiben, wie Algorithmen mein Verhalten beeinflussen."],
        "Achtung: Im Dossier steht vor diesem Kapitel der Mergesort-Teil. Den überspringen wir heute und holen ihn in "
        "Lektion 5 nach."))

    s = Seite("Algorithmen entscheiden über Menschen", "weiss",
              "Theorietext auf Dossierseite 15. Perspektivenwechsel von der Technik zur Gesellschaft. Zuerst Beispiele "
              "aus der Klasse sammeln (Frage oben), dann die Karten aufdecken.")
    s.kopf("LEKTION 4  ·  THEORIE", "Algorithmen entscheiden über Menschen")
    s.notiz(80, 190, 1440, 110, "Wo entscheidet ein Algorithmus heute schon über dich mit?", GELB, 32)
    for i, (t, u) in enumerate([
            ("1  Sie sind überall", "Algorithmen werten im Hintergrund Personendaten aus und personalisieren Werbung, Suchtreffer und Inhalte."),
            ("2  Big Data", "Datenmengen, die zu gross, zu schnelllebig und zu komplex für herkömmliche Methoden sind."),
            ("3  Neu ist das Tempo", "Kundendaten wurden schon früher ausgewertet. Neu ist die enorme Geschwindigkeit.")]):
        s.karte(80 + i * 490, 330, 460, 320, t, u, anim=i + 1, groesse=26)
    s.notiz(80, 690, 1440, 160, "Es geht längst nicht nur um Werbung: Auch Versicherungsprämien, Schulzuteilungen, "
            "Kredite und Lehrstellen werden von Algorithmen mitentschieden.", HORANGE, 28, anim=4)
    S.append(s)

    s = Seite("Du bist jetzt der Algorithmus", "dunkel",
              "Text auf Dossierseite 15. Verkürzte Fassung von Buch 1H: ohne Datentabelle mit 1024 Datensätzen, "
              "dafür fünf feste Eigenschaften.\nGewichte der Klasse per Abstimmung in die Tabelle eintragen (Bearbeiten-Modus).")
    s.text(80, 16, 1440, 50, "LEKTION 4  ·  SZENARIO", 24, "#ffb38a", fett=True)
    s.text(80, 58, 1440, 96, "Du bist jetzt der Algorithmus", 52, WEISS, fett=True)
    s.text(80, 200, 700, 300, "Du programmierst bei der Firma Likely. Dein Algorithmus soll entscheiden, wer den "
           "Job bekommt.", 34, WEISS)
    s.notiz(80, 540, 700, 300, "Verteile die Gewichte 1 bis 5 auf die fünf Eigenschaften. Jedes Gewicht darfst du "
            "nur einmal benutzen.", GELB, 30)
    s.tabelle(840, 200, 680, [["Eigenschaft", "Gewicht"], ["Online-Zeit", "?"], ["Freunde", "?"], ["Schulnoten", "?"],
                              ["Sport", "?"], ["Kaufverhalten", "?"]], 32, zeile=70)
    S.append(s)

    s = Seite("Wert × Gewicht = Punkte", "weiss",
              "Vor Aufgabe 9 zeigen. Verhindert die häufigste Fehlerquelle: Die Klasse addiert die Gewichte, statt Wert "
              "mal Gewicht zu rechnen. Unterschied zwischen Wert und Gewicht ausdrücklich benennen.")
    s.kopf("LEKTION 4  ·  THEORIE", "Wie ein Algorithmus zu einer Zahl kommt")
    teile = [("Wert", "0 bis 10\nvon der Firma gemessen", HBLAU, PETROL), ("×", None, None, None),
             ("Gewicht", "1 bis 5\nvon dir festgelegt", HORANGE, ORANGE), ("=", None, None, None),
             ("Punkte", "alle Zeilen\nzusammenzählen", HGRUEN, GRUEN)]
    x = 80
    for t, u, f, r in teile:
        if u is None:
            s.text(x, 250, 100, 120, t, 80, BLAU, fett=True, ausrichtung="center")
            x += 110
        else:
            s.karte(x, 200, 380, 230, t, u, fuellung=f, rand=r, groesse=30)
            x += 400
    s.form(80, 470, 1440, 110, "Beispiel Schulnoten:   Wert 8  ×  Gewicht 5  =  40 Punkte", fuellung=GRAU,
           rand="keine", groesse=34, fett=True, anim=1)
    s.notiz(80, 610, 700, 240, "Derselbe Wert 8 mit Gewicht 1 bringt nur 8 Punkte. Das Gewicht entscheidet, wie stark "
            "etwas zählt.", GELB, 28, anim=2)
    s.notiz(820, 610, 700, 240, "Schwelle: Ab 100 Punkten gibt es den Job. Ein Punkt Unterschied kann über eine "
            "Lehrstelle entscheiden.", HORANGE, 28, anim=3)
    S.append(s)

    S.append(auftrag_seite(9, "Bewerte Rahel Haas", [
        "Aufgabe 9a: Verteile die Gewichte 1 bis 5 auf die fünf Eigenschaften, jedes nur einmal.",
        "Aufgabe 9b: Berechne Rahels Gesamtpunktzahl: Wert × Gewicht, dann alles zusammenzählen.",
        "Aufgabe 9c: Ab 100 Punkten gibt es den Job. Bekommt Rahel ihn bei dir?",
        "Vergleiche dein Ergebnis mit deinem Sitznachbarn."],
        15, "einzel", "Einzelarbeit, dann zu zweit", "Aufgabe 9, S. 15 bis 17",
        "Alle rechnen mit derselben Person, aber jede und jeder mit den eigenen Gewichten.",
        "Phase: Erarbeitung (15 Min.)\nDer Aha-Moment entsteht erst beim Vergleich: genügend Zeit für den Austausch "
        "zu zweit einplanen.", schrift=28))

    s = Seite("Rahels Punkte live", "kariert",
              "Mit einer Person aus der Klasse live rechnen: Gewichte eintragen, Punkte ausrechnen (Bearbeiten-Modus).\n"
              "Rahels Werte: Online-Zeit 7, Freunde 2, Schulnoten 8, Sport 5, Kaufverhalten 9.\nHinweis: Die im Dossier "
              "genannten 155 Punkte als Maximum sind mit Rahels Werten nicht erreichbar; das Maximum liegt bei 110 "
              "(9×5 + 8×4 + 7×3 + 5×2 + 2×1).")
    s.kopf("LEKTION 4  ·  RECHNEN", "Bekommt Rahel den Job?")
    s.tabelle(80, 200, 1000, [["Eigenschaft", "Rahels Wert", "Gewicht", "Punkte"],
                              ["Online-Zeit", "7", "", ""], ["Freunde", "2", "", ""], ["Schulnoten", "8", "", ""],
                              ["Sport", "5", "", ""], ["Kaufverhalten", "9", "", ""], ["Total", "", "", ""]], 30, zeile=62)
    s.form(1130, 200, 390, 200, "Ab 100 Punkten:\nJob!", fuellung=HGRUEN, rand=GRUEN, groesse=36, fett=True)
    s.el("zufall", 1130, 430, 390, 400, {"namen": "", "ohne": True})
    S.append(s)

    s = Seite("Lösung Aufgabe 9b und 9c", "weiss", "Rechnet eure Punktzahl gegenseitig nach. Die Rechnung muss stimmen, "
              "die Gewichte dürfen frei sein.")
    loesung_kopf(s, "DOSSIER AUFGABE 9B UND 9C", "Zwei Algorithmen, zwei Ergebnisse")
    s.karte(80, 200, 1440, 160, "Variante A: Schulnoten sind am wichtigsten",
            "7×1 + 2×2 + 8×5 + 5×3 + 9×4 = 7 + 4 + 40 + 15 + 36 = 102 Punkte → Rahel bekommt den Job.",
            fuellung=HGRUEN, rand=GRUEN, anim=1, groesse=28)
    s.karte(80, 390, 1440, 160, "Variante B: Sport ist am wichtigsten",
            "7×2 + 2×3 + 8×1 + 5×5 + 9×4 = 14 + 6 + 8 + 25 + 36 = 89 Punkte → Rahel bekommt den Job nicht.",
            fuellung=ROSA, rand=ORANGE, anim=2, groesse=28)
    s.notiz(80, 590, 1440, 260, "Es gibt keine einzige richtige Lösung. Jede Punktzahl ist korrekt, solange richtig "
            "gerechnet wurde. Entscheidend: Dieselbe Person wird je nach Gewichtung unterschiedlich beurteilt.",
            GELB, 30, anim=3)
    S.append(s)

    S.append(auftrag_seite(10, "Reflexion und das Duell", [
        "Aufgabe 9d: Rahel ist immer dieselbe Person. Warum bekommt sie trotzdem nicht überall den Job?",
        "Zusatzaufgabe 5: Berechne die Punkte für Silas mit denselben Gewichten und vergleiche.",
        "Zusatzaufgabe 6: Kannst du die Gewichte so ändern, dass plötzlich der andere gewinnt?"],
        12, "einzel", "Einzelarbeit, dann Plenum", "Aufgabe 9d, Zusatz 5 und 6, S. 17 bis 19",
        "Aufgabe 9d zuerst schriftlich beantworten, danach sammeln wir im Plenum.",
        "Phase: Vertiefung (12 Min.)\nZusatzaufgaben eignen sich für schnelle Klassen oder als Hausaufgabe.\n"
        "Silas: Online-Zeit 3, Freunde 9, Schulnoten 5, Sport 10, Kaufverhalten 2."))

    s = Seite("Lösung Aufgabe 9d", "weiss",
              "Kernaussage für die Prüfung: Algorithmen sind nicht neutral, weil Menschen ihre Kriterien festlegen. "
              "Diese Formulierung festhalten.")
    loesung_kopf(s, "DOSSIER AUFGABE 9D UND ZUSATZAUFGABEN", "Warum das ein Problem ist")
    s.karte(80, 200, 1440, 180, "Aufgabe 9d", "Menschen entscheiden, welche Eigenschaften zählen und wie stark. Die "
            "Gewichte sind Meinungen, keine objektive Wahrheit. Darum können algorithmische Entscheidungen unfair sein.",
            anim=1, groesse=26)
    s.karte(80, 400, 700, 220, "Zusatzaufgabe 5", "Gewichte aus Variante A: Silas erreicht 3×1 + 9×2 + 5×5 + 10×3 + 2×4 "
            "= 84 Punkte. Rahel liegt mit 102 vorn.", fuellung=HORANGE, rand=ORANGE, anim=2, groesse=26)
    s.karte(820, 400, 700, 220, "Zusatzaufgabe 6", "Ja. Wer Sport oder Freunde mit 5 gewichtet, dreht das Ergebnis "
            "zugunsten von Silas.", fuellung=HORANGE, rand=ORANGE, anim=3, groesse=26)
    s.notiz(80, 650, 1440, 200, "Algorithmen sind nicht neutral, weil Menschen ihre Kriterien festlegen.", HGRUEN, 36,
            anim=4)
    S.append(s)

    s = Seite("Die Filterblase", "weiss",
              "Einstieg in die Synthese-Aufgabe auf Dossierseite 20. Der Begriff Filterblase ist prüfungsrelevant und "
              "kehrt in Kapitel 4 des Lehrmittels wieder.")
    s.kopf("LEKTION 4  ·  THEORIE", "Die Filterblase")
    s.form(80, 200, 640, 640, "Alles, was du nie siehst", fuellung=GRAU, rand="#9aa5b1", form="rechteck", groesse=24,
           vertikal="oben", farbe="#52606d")
    s.form(150, 300, 500, 500, "Was der Algorithmus zeigt", fuellung=HBLAU, rand=PETROL, form="ellipse", groesse=24,
           vertikal="oben")
    s.form(300, 470, 200, 200, "Du", fuellung=ORANGE, rand="keine", form="ellipse", groesse=44, fett=True, farbe=WEISS)
    for i, (t, u) in enumerate([("1  Der Algorithmus lernt", "Er merkt sich, was du anschaust, likest und wie lange du bleibst."),
                                ("2  Er zeigt dir mehr davon", "Inhalte, die deiner Meinung widersprechen, tauchen seltener auf."),
                                ("3  Du merkst es nicht", "Es fühlt sich an wie die ganze Welt. Du siehst nur einen Ausschnitt.")]):
        s.karte(780, 200 + i * 175, 740, 160, t, u, anim=i + 1, groesse=24)
    s.notiz(780, 730, 740, 120, "Algorithmen reagieren auf dich. Aber du reagierst auch auf Algorithmen.", GELB, 26, anim=4)
    S.append(s)

    S.append(auftrag_seite(11, "Synthese: Wer steuert wen?", [
        "Aufgabe 10a: Vervollständige die beiden Szenarien zu Werbung und zu einseitigen Nachrichten.",
        "Aufgabe 10b: Wer ist der Chef, du oder der Algorithmus?",
        "Schreibe eine konkrete Idee auf, wie du verhindern kannst, dass der Algorithmus dein Verhalten steuert."],
        12, "einzel", "Einzelarbeit, dann Plenum", "Aufgabe 10, S. 20",
        "Eure Ideen sammeln wir anschliessend an der Wandtafel.",
        "Phase: Synthese (12 Min.)\nEntspricht Buch 1I."))

    s = Seite("Ideen sammeln", "kork",
              "Ideen der Klasse als Notizen anheften und ordnen: grün = positiv, gelb = neutral, rosa = negativ. "
              "Daraus eine kurze Mindmap bauen.")
    s.form(560, 330, 480, 220, "Wer ist der Chef:\ndu oder der Algorithmus?", fuellung=BLAU, rand="keine", groesse=32,
           fett=True, farbe=WEISS, form="ellipse")
    s.text(80, 10, 1440, 70, "Unsere Ideen gegen die Steuerung durch Algorithmen", 44, WEISS, fett=True)
    for i, (x, y, f, t) in enumerate([(80, 150, HGRUEN, "positiv: …"), (600, 150, GELB, "neutral: …"),
                                      (1120, 150, ROSA, "negativ: …"), (80, 600, HGRUEN, ""), (600, 600, GELB, ""),
                                      (1120, 600, ROSA, "")]):
        s.notiz(x, y, 400, 160 if y == 150 else 240, t, f, 26)
    S.append(s)

    s = Seite("Lösung Aufgabe 10", "weiss", "Viele richtige Antworten. Wichtig ist, dass die Idee konkret und umsetzbar ist.")
    loesung_kopf(s, "DOSSIER AUFGABE 10A UND 10B", "Mögliche Antworten")
    s.karte(80, 200, 700, 280, "Shopping", "… dass ich mir irgendwann neue Turnschuhe kaufe, obwohl ich keine wollte. "
            "Der Algorithmus hat mein Bedürfnis nicht erkannt, sondern erzeugt.", anim=1, groesse=26)
    s.karte(820, 200, 700, 280, "Meinung", "… halte ich meine Meinung für die einzig richtige und weiss gar nicht mehr, "
            "dass es andere Sichtweisen gibt. Das nennt man Filterblase.", anim=2, groesse=26)
    s.karte(80, 510, 1440, 330, "Aufgabe 10b: Ideen", "Bewusst nach Gegenmeinungen suchen · Empfehlungen ignorieren · "
            "Verlauf und Werbe-ID löschen · Personalisierung abschalten · Bildschirmzeit begrenzen · verschiedene Quellen "
            "und Apps nutzen", fuellung=HGRUEN, rand=GRUEN, anim=3, groesse=28)
    S.append(s)

    S.append(pruefung_seite("Am Ende von Lektion 4 und nochmals am Ende von Lektion 5 zeigen. Die Prüfung dauert rund "
                            "40 Minuten und umfasst sieben Aufgaben mit steigendem Schwierigkeitsgrad."))
    S.append(abschluss_seite([
        "Ich kann zeigen, wie Gewichtung eine Entscheidung verändert.",
        "Ich kann beurteilen, warum das unfair sein kann.",
        "Ich kann die Filterblase erklären."],
        "Exit-Frage: Warum ist ein Algorithmus nie ganz neutral?", "Phase: Abschluss (3 Min.)"))
    return tafel("t-l4", "Lektion 4: Fairness", S)


# ------------------------------------------------------------------ Lektion 5
def lektion5():
    S = []
    s = lernziele_seite(5, "04.11.2026", "S. 13 UND 14", "Mergesort: Sortieren im Team", [
        "Ich erlebe das Prinzip Teile und herrsche beim Sortieren körperlich.",
        "Ich kann die zwei Phasen Aufteilen und Zusammenführen beschreiben.",
        "Ich kann die drei Sortierverfahren vor der Prüfung gegenüberstellen."],
        "Diese Lektion findet draussen statt. Bei schlechtem Wetter mit 8 Karten in Partnerarbeit im Schulzimmer arbeiten.")
    s.notiz(80, 680, 1440, 160, "Heute sind wir draussen! Bei Regen: 8 Karten, Partnerarbeit im Schulzimmer.", GELB, 30)
    S.append(s)

    s = Seite("Die zwei Phasen", "weiss",
              "Text auf Dossierseite 13. Vor dem Hinausgehen einmal trocken durchsprechen, dann geht die Aussenaktivität "
              "deutlich schneller.")
    s.kopf("LEKTION 5  ·  THEORIE", "Die zwei Phasen des Mergesort")
    s.karte(80, 210, 700, 420, "PHASE 1: Aufteilen", "Eine Startperson teilt den Kartenstapel und gibt die beiden "
            "Hälften weiter. Das wiederholt sich, bis jede Person nur noch eine Karte hält.", anim=1, groesse=30)
    s.karte(820, 210, 700, 420, "PHASE 2: Zusammenführen", "Nun geht es wieder nach oben. Bei jedem Kartenpaar wird die "
            "höhere Karte zuerst genommen und die tiefere darauf gelegt. So entstehen immer grössere sortierte Stapel.",
            fuellung=HORANGE, rand=ORANGE, anim=2, groesse=30)
    s.notiz(80, 670, 1440, 180, "Das ist genau das Prinzip Teile und herrsche, das ihr beim Zahlenraten kennengelernt habt.",
            HGRUEN, 32, anim=3)
    S.append(s)

    s = Seite("Mergesort Schritt für Schritt", "kariert",
              "Vor dem Hinausgehen zeigen, Ebene für Ebene aufdecken. Wichtig: Beim Zusammenführen wird nie ein ganzer "
              "Stapel durchsucht. Es genügt, die beiden obersten Karten zu vergleichen, weil beide Stapel schon sortiert sind.")
    s.kopf("LEKTION 5  ·  THEORIE", "Mergesort Schritt für Schritt")
    s.text(80, 160, 700, 44, "PHASE 1  ·  TEILEN", 26, PETROL, fett=True)
    s.text(820, 160, 700, 44, "PHASE 2  ·  ZUSAMMENFÜHREN", 26, ORANGE, fett=True)

    def reihe(x0, y, stapel, fuellung, rand, anim):
        # stapel: Liste von Listen; zwischen Stapeln mehr Abstand
        kw, gap, sgap = 64, 6, 22
        x = x0
        for st in stapel:
            for wert in st:
                s.form(x, y, kw, 76, str(wert), fuellung=fuellung, rand=rand, groesse=30, fett=True, form="rechteck",
                       anim=anim)
                x += kw + gap
            x += sgap - gap
    teilen = [[[5, 2, 7, 1, 8, 3, 6, 4]], [[5, 2, 7, 1], [8, 3, 6, 4]], [[5, 2], [7, 1], [8, 3], [6, 4]],
              [[5], [2], [7], [1], [8], [3], [6], [4]]]
    zusammen = [[[5], [2], [7], [1], [8], [3], [6], [4]], [[2, 5], [1, 7], [3, 8], [4, 6]], [[1, 2, 5, 7], [3, 4, 6, 8]],
                [[1, 2, 3, 4, 5, 6, 7, 8]]]
    for i, st in enumerate(teilen):
        reihe(80, 268 + i * 102, st, HBLAU, PETROL, i + 1)
    for i, st in enumerate(zusammen):
        reihe(820, 268 + i * 102, st, HORANGE if i < 3 else HGRUEN, ORANGE if i < 3 else GRUEN, 4 + i if i else 4)
    s.notiz(80, 700, 1440, 160, "Bei 8 Karten braucht es 3 Ebenen. Jedes Verdoppeln der Kartenzahl kostet genau eine "
            "Ebene mehr: n × log₂(n) wie beim Tournamentsort.", GELB, 28, anim=8)
    S.append(s)

    S.append(auftrag_seite(12, "Mergesort im Team", [
        "Stellt euch nach Anweisung auf. Von Stufe zu Stufe verdoppelt sich die Anzahl Personen.",
        "Phase 1: Teilt den Stapel und gebt die Hälften weiter, bis jede Person eine Karte hat.",
        "Phase 2: Führt die Karten nach oben zusammen, immer die höhere zuerst.",
        "Aufgabe 8a: Zählt mit, wie viele Ebenen ihr beim Aufteilen gebraucht habt."],
        25, "plenum", "Klasse als Ganzes", "Aufgabe 8a, S. 14",
        "Wer keine Rolle hat, beobachtet und zählt die Ebenen mit.",
        "Phase: Erarbeitung draussen (25 Min.)\nEntspricht Buch 1E, Aufgabe 111. Draussen vorher die Positionen mit "
        "Kreide markieren, das spart viel Zeit.\nRollen: 1 + 2 + 4 + 8 = 15 Personen für 8 Karten.", schrift=28))

    s = Seite("Lösung Aufgabe 8a", "weiss",
              "Der Zusammenhang zwischen Ebenenzahl und Logarithmus ist für die Prüfung nicht zwingend, hilft aber "
              "leistungsstarken Schülerinnen und Schülern.")
    loesung_kopf(s, "DOSSIER AUFGABE 8A UND ZUSATZAUFGABE 4", "Ebenen zählen und umgekehrt sortieren")
    s.tabelle(80, 200, 560, [["Karten", "Ebenen"], ["8", "3"], ["16", "4"], ["32", "5"]], 32, anim=1, zeile=64)
    s.karte(680, 200, 840, 260, "Der Aufwand", "Jede Karte wandert durch alle Ebenen: n × Anzahl Ebenen, also "
            "n × log₂(n). Derselbe Aufwand wie beim Tournamentsort.", anim=2, groesse=28)
    s.karte(680, 490, 840, 260, "Zusatzaufgabe 4: umgekehrt sortieren", "Eine einzige Änderung genügt: Beim "
            "Zusammenführen die tiefere statt die höhere Karte zuerst nehmen.", fuellung=HORANGE, rand=ORANGE, anim=3,
            groesse=28)
    s.notiz(80, 520, 560, 230, "Jedes Verdoppeln der Kartenzahl kostet genau eine zusätzliche Ebene.", HGRUEN, 28, anim=1)
    S.append(s)

    S.append(auftrag_seite(13, "Die drei Verfahren gegenüberstellen", [
        "Aufgabe 8b: Haltet die drei Verfahren in eigenen Worten fest.",
        "Beschreibt für jedes Verfahren kurz das Prinzip und ob es bei vielen Daten schnell oder langsam ist.",
        "Nutzt eure Vergleichstabelle von Aufgabe 5 als Vorlage."],
        10, "einzel", "Einzelarbeit", "Aufgabe 8b, S. 14",
        "Das ist eure Repetition für die Prüfung am 11. November.",
        "Phase: Sicherung (10 Min.)\nBewusst am Ende der Lektionsreihe: Wer hier ins Stocken gerät, weiss, wo er "
        "beim Lernen ansetzen muss."))

    s = Seite("Lösung Aufgabe 8b", "weiss",
              "Repetitionsseite am Ende von Lektion 5 und nochmals kurz vor der Prüfung. Eigene Formulierungen der Klasse "
              "sind ausdrücklich erlaubt. Zeilen nacheinander aufdecken.")
    loesung_kopf(s, "DOSSIER AUFGABE 8B", "Die drei Verfahren im Überblick")
    for j, (t, b) in enumerate([("Verfahren", 300), ("Prinzip", 560), ("Aufwand", 290), ("Tempo", 250)]):
        x = 80 + sum([320, 580, 310][:j])
        s.form(x, 200, b, 60, t, fuellung=BLAU, rand="keine", groesse=26, fett=True, farbe=WEISS)
    zeilen = [("Insertionsort", "Jedes neue Element wird an der richtigen Stelle eingefügt", "n × (n − 1) ÷ 2",
               "langsam bei vielen Daten", HORANGE, ORANGE),
              ("Tournamentsort", "Zweikämpfe im K.-o.-System, Sieger steigen auf", "n × log₂(n)", "schnell, immer gleich",
               HBLAU, PETROL),
              ("Mergesort", "Aufteilen bis zur Einzelkarte, dann zusammenführen", "n × log₂(n)",
               "schnell, teile und herrsche", HGRUEN, GRUEN)]
    for i, (a, b, c, d, f, r) in enumerate(zeilen):
        y = 280 + i * 190
        s.form(80, y, 300, 170, a, fuellung=f, rand=r, groesse=28, fett=True)
        s.form(400, y, 560, 170, b, fuellung=WEISS, rand=r, groesse=26, anim=i + 1)
        s.form(980, y, 290, 170, c, fuellung=WEISS, rand=r, groesse=28, fett=True, anim=i + 1)
        s.form(1290, y, 230, 170, d, fuellung=WEISS, rand=r, groesse=24, anim=i + 1)
    S.append(s)

    s = Seite("Repetition: Thema ziehen", "gruen",
              "Partnerarbeit: Eine Person zieht ein Thema und erklärt es in 60 Sekunden, die andere prüft mit dem Dossier. "
              "Dann tauschen.")
    s.text(80, 10, 1440, 90, "Zieh ein Thema und erkläre es in 60 Sekunden", 52, WEISS, fett=True)
    s.el("zufall", 80, 160, 700, 480, {"namen": "Insertionsort\nWorst Case beim Insertionsort\nTournamentsort\nMergesort\n"
                                                "Lineare Suche\nBinäre Suche\nTeile und herrsche\nWarum sortieren?\n"
                                                "Wert × Gewicht\nWarum Algorithmen unfair sein können\nFilterblase",
                                       "ohne": True})
    s.el("timer", 840, 160, 380, 300, {"sekunden": 60})
    s.el("sozialform", 1260, 160, 260, 300, {"form": "partner"})
    s.notiz(840, 510, 680, 340, "Die andere Person prüft mit dem Dossier:\nStimmt es? Fehlt etwas Wichtiges?", GELB, 30)
    S.append(s)

    S.append(pruefung_seite("Am Ende von Lektion 5 nochmals zeigen. Prüfung rund 40 Minuten, sieben Aufgaben mit "
                            "steigendem Schwierigkeitsgrad."))
    S.append(abschluss_seite([
        "Ich kann die zwei Phasen des Mergesort beschreiben.",
        "Ich kann Insertionsort, Tournamentsort und Mergesort vergleichen.",
        "Ich weiss, was ich bis zur Prüfung noch üben muss."],
        "Prüfung am 11.11.2026. Lernt mit eurem korrigierten Dossier.", "Phase: Abschluss (3 Min.)"))
    return tafel("t-l5", "Lektion 5: Mergesort", S)


tafeln = [lektion1(), lektion2(), lektion3(), lektion4(), lektion5()]
paket = {
    "format": "interaktive-wandtafel", "version": 1, "art": "sammlung",
    "faecher": [{"id": "f-mi", "name": "Medien und Informatik", "farbe": "#065a82",
                 "jahre": [{"id": "j3", "name": "3. Sek"}],
                 "kapitel": [{"id": "k-alg", "name": "02-Algorithmen", "jahr": "j3",
                              "tafeln": [t["id"] for t in tafeln]}]}],
    "tafeln": tafeln, "medien": {}}
ziel = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(__file__), "..", "docs", "lektionen",
                                                          "02-algorithmen-3-sek.wandtafel.json")
with open(ziel, "w") as f:
    json.dump(paket, f, ensure_ascii=False, indent=1)
    f.write("\n")
for t in tafeln:
    print(t["titel"], len(t["seiten"]), "Seiten")
