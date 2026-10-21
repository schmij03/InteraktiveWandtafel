/*
 * Uebersicht (index.html): Faecher anlegen, darin optional Jahre (z. B. 1. Sek),
 * darin Kapitel/Themen, darin Tafeln.
 * Gewaehltes Fach und Jahr stehen in der Adresse (#fach=<id>&jahr=<id>).
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var S = W.Speicher;
  var E = W.Elemente;
  var X = W.Export;
  var el = W.el;

  var JAHR_VORSCHLAEGE = ["1. Sek", "2. Sek", "3. Sek"];
  var FACHFARBEN = ["#065a82", "#e4572e", "#2e7d32", "#7b3fa0", "#c2185b", "#00838f", "#ef6c00", "#21295c"];

  var inhalt = document.getElementById("inhalt");
  var suche = document.getElementById("suche");
  var sammlung = null;
  var tafeln = {}; // id -> Tafel
  var fachId = null;
  var jahrId = null; // gewaehltes Jahr im Fach, null = alle
  var importZiel = null;

  // ---------- Laden und Speichern ----------

  function laden() {
    return Promise.all([S.sammlung(), S.alleTafeln()]).then(function (r) {
      sammlung = r[0];
      tafeln = {};
      r[1].forEach(function (t) {
        tafeln[t.id] = t;
      });
      // Tafeln, die in keinem Kapitel stehen (z. B. nach einem Fehler), nicht verlieren
      var eingeordnet = {};
      sammlung.faecher.forEach(function (f) {
        f.kapitel.forEach(function (k) {
          if (k.jahr && !W.jahrVon(f, k)) delete k.jahr;
          k.tafeln = k.tafeln.filter(function (id) {
            return tafeln[id];
          });
          k.tafeln.forEach(function (id) {
            eingeordnet[id] = true;
          });
        });
      });
      var lose = Object.keys(tafeln).filter(function (id) {
        return !eingeordnet[id];
      });
      if (lose.length) {
        var fach = fachFinden("Ohne Fach") || neuesFachObjekt("Ohne Fach");
        if (sammlung.faecher.indexOf(fach) === -1) sammlung.faecher.push(fach);
        if (!fach.kapitel.length) fach.kapitel.push(neuesKapitelObjekt("Wiederhergestellt"));
        fach.kapitel[0].tafeln = fach.kapitel[0].tafeln.concat(lose);
        return S.sammlungSpeichern(sammlung);
      }
    });
  }

  function sichern() {
    return S.sammlungSpeichern(sammlung).catch(function (f) {
      W.melden(f.message, 7000);
    });
  }

  function fachFinden(name) {
    return sammlung.faecher.find(function (f) {
      return W.normal(f.name) === W.normal(name);
    });
  }

  function fachVonId(id) {
    return sammlung.faecher.find(function (f) {
      return f.id === id;
    });
  }

  function neuesFachObjekt(name, farbe) {
    return { id: W.neueId("f"), name: name, farbe: farbe || FACHFARBEN[sammlung.faecher.length % FACHFARBEN.length], kapitel: [] };
  }

  function neuesKapitelObjekt(name) {
    return { id: W.neueId("k"), name: name, tafeln: [] };
  }

  function neuesJahrObjekt(name) {
    return { id: W.neueId("j"), name: name };
  }

  function jahreVon(fach) {
    return fach.jahre || [];
  }

  /** Kapitel eines Jahres; jahr null = Kapitel ohne Jahr */
  function kapitelImJahr(fach, jahr) {
    return fach.kapitel.filter(function (k) {
      return (k.jahr || null) === (jahr ? jahr.id : null);
    });
  }

  function anzahlTafeln(fach, kapitelListe) {
    return (kapitelListe || fach.kapitel).reduce(function (n, k) {
      return n + k.tafeln.length;
    }, 0);
  }

  function mehrzahl(n, eins, viele) {
    return n + " " + (n === 1 ? eins : viele);
  }

  // ---------- Faecher ----------

  function fachDialog(fach) {
    var felder = [
      { name: "name", label: "Name des Fachs", wert: fach ? fach.name : "", platzhalter: "z. B. Medien und Informatik", pflicht: true },
      { name: "farbe", label: "Farbe", typ: "farbe", optionen: FACHFARBEN, wert: fach ? fach.farbe : FACHFARBEN[sammlung.faecher.length % FACHFARBEN.length] }
    ];
    if (!fach) {
      felder.push({ typ: "hinweis", text: "Jahre (freiwillig): darin legst du später die Themen an. Weitere Jahre gehen jederzeit mit «+ Jahr»." });
      JAHR_VORSCHLAEGE.forEach(function (name, i) {
        felder.push({ name: "jahr" + i, label: name, typ: "haken" });
      });
    }
    return W.dialog({
      titel: fach ? "Fach bearbeiten" : "Neues Fach",
      felder: felder,
      knopf: fach ? "Speichern" : "Anlegen"
    });
  }

  function fachAnlegen() {
    fachDialog().then(function (w) {
      if (!w || !w.name) return;
      var fach = neuesFachObjekt(w.name, w.farbe);
      JAHR_VORSCHLAEGE.forEach(function (name, i) {
        if (w["jahr" + i]) (fach.jahre = fach.jahre || []).push(neuesJahrObjekt(name));
      });
      if (!fach.jahre) fach.kapitel.push(neuesKapitelObjekt("Allgemein"));
      sammlung.faecher.push(fach);
      sichern().then(function () {
        fachWaehlen(fach.id);
      });
    });
  }

  function fachBearbeiten(fach) {
    fachDialog(fach).then(function (w) {
      if (!w || !w.name) return;
      fach.name = w.name;
      fach.farbe = w.farbe;
      sichern().then(zeichnen);
    });
  }

  function fachLoeschen(fach) {
    var n = anzahlTafeln(fach);
    W.bestaetigen("Das Fach «" + fach.name + "» mit " + mehrzahl(fach.kapitel.length, "Kapitel", "Kapiteln") + " und " + mehrzahl(n, "Tafel", "Tafeln") + " löschen? Das lässt sich nicht rückgängig machen. Tipp: vorher exportieren.").then(function (ja) {
      if (!ja) return;
      var ids = [];
      fach.kapitel.forEach(function (k) {
        ids = ids.concat(k.tafeln);
      });
      sammlung.faecher = sammlung.faecher.filter(function (f) {
        return f !== fach;
      });
      tafelnLoeschen(ids).then(function () {
        fachId = null;
        zeichnen();
        W.melden("Fach gelöscht.");
      });
    });
  }

  function fachVerschieben(fach, schritt) {
    var i = sammlung.faecher.indexOf(fach);
    var ziel = i + schritt;
    if (ziel < 0 || ziel >= sammlung.faecher.length) return;
    sammlung.faecher.splice(i, 1);
    sammlung.faecher.splice(ziel, 0, fach);
    sichern().then(zeichnen);
  }

  // ---------- Jahre ----------

  function jahrAnlegen(fach) {
    var vorschlag = JAHR_VORSCHLAEGE.find(function (name) {
      return !jahreVon(fach).some(function (j) {
        return W.normal(j.name) === W.normal(name);
      });
    });
    W.dialog({
      titel: "Neues Jahr in «" + fach.name + "»",
      felder: [{ name: "name", label: "Name", wert: vorschlag || "", platzhalter: "z. B. 1. Sek", pflicht: true, hilfe: "Zum Beispiel 1. Sek, 2. Sek, 3. Sek oder 5. Klasse" }],
      knopf: "Anlegen"
    }).then(function (w) {
      if (!w || !w.name) return;
      var jahr = neuesJahrObjekt(w.name);
      (fach.jahre = fach.jahre || []).push(jahr);
      sichern().then(function () {
        jahrWaehlen(jahr.id);
      });
    });
  }

  function jahrUmbenennen(jahr) {
    W.dialog({
      titel: "Jahr umbenennen",
      felder: [{ name: "name", label: "Name", wert: jahr.name, pflicht: true }],
      knopf: "Speichern"
    }).then(function (w) {
      if (!w || !w.name) return;
      jahr.name = w.name;
      sichern().then(zeichnen);
    });
  }

  function jahrVerschieben(fach, jahr, schritt) {
    var i = fach.jahre.indexOf(jahr);
    var ziel = i + schritt;
    if (ziel < 0 || ziel >= fach.jahre.length) return;
    fach.jahre.splice(i, 1);
    fach.jahre.splice(ziel, 0, jahr);
    sichern().then(zeichnen);
  }

  /** Entfernt nur das Jahr; seine Kapitel und Tafeln bleiben (danach «Ohne Jahr») */
  function jahrEntfernen(fach, jahr) {
    var n = kapitelImJahr(fach, jahr).length;
    W.bestaetigen(
      "Das Jahr «" + jahr.name + "» entfernen?" + (n ? " Die " + mehrzahl(n, "Kapitel", "Kapitel") + " darin bleiben mit allen Tafeln erhalten und stehen danach unter «Ohne Jahr»." : ""),
      "Entfernen"
    ).then(function (ja) {
      if (!ja) return;
      fach.kapitel.forEach(function (k) {
        if (k.jahr === jahr.id) delete k.jahr;
      });
      fach.jahre = fach.jahre.filter(function (j) {
        return j !== jahr;
      });
      if (!fach.jahre.length) delete fach.jahre;
      jahrId = null;
      sichern().then(zeichnen);
    });
  }

  function jahrOptionen(fach) {
    return [{ wert: "", text: "Ohne Jahr" }].concat(
      jahreVon(fach).map(function (j) {
        return { wert: j.id, text: j.name };
      })
    );
  }

  // ---------- Kapitel ----------

  function kapitelAnlegen(fach) {
    var felder = [{ name: "name", label: "Name", platzhalter: "z. B. Kapitel 2: Daten und Codierung", pflicht: true }];
    if (jahreVon(fach).length) felder.push({ name: "jahr", label: "Jahr", typ: "select", optionen: jahrOptionen(fach), wert: jahrId || "" });
    W.dialog({
      titel: "Neues Kapitel oder Thema in «" + fach.name + "»",
      felder: felder,
      knopf: "Anlegen"
    }).then(function (w) {
      if (!w || !w.name) return;
      var kapitel = neuesKapitelObjekt(w.name);
      if (w.jahr) kapitel.jahr = w.jahr;
      fach.kapitel.push(kapitel);
      // Im gewaehlten Jahr bleiben, wenn das Kapitel dorthin gehoert, sonst alle zeigen
      var bleiben = !jahrId || jahrId === kapitel.jahr;
      sichern().then(function () {
        jahrWaehlen(bleiben ? jahrId : null);
      });
    });
  }

  function kapitelJahrAendern(fach, kapitel) {
    W.dialog({
      titel: "«" + kapitel.name + "» in ein anderes Jahr",
      felder: [{ name: "jahr", label: "Jahr", typ: "select", optionen: jahrOptionen(fach), wert: kapitel.jahr || "" }],
      knopf: "Verschieben"
    }).then(function (w) {
      if (!w) return;
      if (w.jahr) kapitel.jahr = w.jahr;
      else delete kapitel.jahr;
      sichern().then(zeichnen);
    });
  }

  function kapitelUmbenennen(kapitel) {
    W.dialog({
      titel: "Kapitel umbenennen",
      felder: [{ name: "name", label: "Name", wert: kapitel.name, pflicht: true }],
      knopf: "Speichern"
    }).then(function (w) {
      if (!w || !w.name) return;
      kapitel.name = w.name;
      sichern().then(zeichnen);
    });
  }

  /** Tauscht mit dem Nachbarn im selben Jahr */
  function kapitelVerschieben(fach, kapitel, schritt) {
    var gruppe = kapitelImJahr(fach, W.jahrVon(fach, kapitel));
    var nachbar = gruppe[gruppe.indexOf(kapitel) + schritt];
    if (!nachbar) return;
    var i = fach.kapitel.indexOf(kapitel);
    var j = fach.kapitel.indexOf(nachbar);
    fach.kapitel[i] = nachbar;
    fach.kapitel[j] = kapitel;
    sichern().then(zeichnen);
  }

  function kapitelLoeschen(fach, kapitel) {
    W.bestaetigen("Das Kapitel «" + kapitel.name + "» mit " + mehrzahl(kapitel.tafeln.length, "Tafel", "Tafeln") + " löschen?").then(function (ja) {
      if (!ja) return;
      fach.kapitel = fach.kapitel.filter(function (k) {
        return k !== kapitel;
      });
      tafelnLoeschen(kapitel.tafeln).then(zeichnen);
    });
  }

  // ---------- Tafeln ----------

  function tafelAnlegen(kapitel) {
    W.dialog({
      titel: "Neue Tafel in «" + kapitel.name + "»",
      felder: [{ name: "titel", label: "Titel", platzhalter: "z. B. Lektion 1: Einstieg", pflicht: true }],
      knopf: "Anlegen und öffnen"
    }).then(function (w) {
      if (!w || !w.titel) return;
      var t = S.neueTafel(w.titel);
      S.tafelSpeichern(t)
        .then(function () {
          kapitel.tafeln.push(t.id);
          return sichern();
        })
        .then(function () {
          window.location.href = "tafel.html?t=" + encodeURIComponent(t.id);
        })
        .catch(fehler);
    });
  }

  function tafelUmbenennen(t) {
    W.dialog({
      titel: "Tafel umbenennen",
      felder: [{ name: "titel", label: "Titel", wert: t.titel, pflicht: true }],
      knopf: "Speichern"
    }).then(function (w) {
      if (!w || !w.titel) return;
      t.titel = w.titel;
      t.geaendert = Date.now();
      S.tafelSpeichern(t).then(zeichnen, fehler);
    });
  }

  function tafelDuplizieren(kapitel, t) {
    var kopie = JSON.parse(JSON.stringify(t));
    kopie.id = W.neueId("t");
    kopie.titel = t.titel + " (Kopie)";
    kopie.erstellt = kopie.geaendert = Date.now();
    S.tafelSpeichern(kopie)
      .then(function () {
        tafeln[kopie.id] = kopie;
        kapitel.tafeln.splice(kapitel.tafeln.indexOf(t.id) + 1, 0, kopie.id);
        return sichern();
      })
      .then(zeichnen, fehler);
  }

  function kapitelOptionen() {
    var optionen = [];
    sammlung.faecher.forEach(function (f) {
      f.kapitel.forEach(function (k) {
        optionen.push({ wert: f.id + "|" + k.id, text: W.ortText(f, k) });
      });
    });
    return optionen;
  }

  function tafelVerschieben(kapitel, t) {
    W.dialog({
      titel: "Tafel verschieben",
      felder: [{ name: "ziel", label: "In welches Kapitel?", typ: "select", optionen: kapitelOptionen() }],
      knopf: "Verschieben"
    }).then(function (w) {
      if (!w) return;
      var teile = w.ziel.split("|");
      var fach = fachVonId(teile[0]);
      var ziel = fach.kapitel.find(function (k) {
        return k.id === teile[1];
      });
      if (!ziel || ziel === kapitel) return;
      kapitel.tafeln = kapitel.tafeln.filter(function (id) {
        return id !== t.id;
      });
      ziel.tafeln.push(t.id);
      sichern().then(function () {
        W.melden("Verschoben nach «" + W.ortText(fach, ziel) + "».");
        zeichnen();
      });
    });
  }

  function tafelLoeschen(kapitel, t) {
    W.bestaetigen("Die Tafel «" + t.titel + "» löschen?").then(function (ja) {
      if (!ja) return;
      kapitel.tafeln = kapitel.tafeln.filter(function (id) {
        return id !== t.id;
      });
      tafelnLoeschen([t.id]).then(zeichnen);
    });
  }

  function tafelnLoeschen(ids) {
    return sichern()
      .then(function () {
        return Promise.all(
          ids.map(function (id) {
            delete tafeln[id];
            return S.tafelLoeschen(id);
          })
        );
      })
      .then(speicherInfo)
      .catch(fehler);
  }

  function fehler(f) {
    W.melden(f && f.message ? f.message : String(f), 7000);
  }

  // ---------- Export und Import ----------

  /** Exportiert ein Fach, nur ein Jahr (teil.jahr) oder nur ein Kapitel (teil.kapitel) */
  function fachExport(fach, teil) {
    teil = teil || {};
    var kopie = JSON.parse(JSON.stringify(fach));
    if (teil.kapitel) {
      kopie.kapitel = kopie.kapitel.filter(function (k) {
        return k.id === teil.kapitel.id;
      });
    } else if (teil.jahr) {
      kopie.kapitel = kopie.kapitel.filter(function (k) {
        return k.jahr === teil.jahr.id;
      });
    }
    if (kopie.jahre) {
      kopie.jahre = kopie.jahre.filter(function (j) {
        return kopie.kapitel.some(function (k) {
          return k.jahr === j.id;
        }) || (!teil.kapitel && !teil.jahr);
      });
    }
    var zusatz = teil.kapitel ? "_" + teil.kapitel.name : teil.jahr ? "_" + teil.jahr.name : "";
    X.sammlungPaket([kopie])
      .then(function (p) {
        X.jsonSpeichern(p, fach.name + zusatz);
      })
      .catch(fehler);
  }

  function allesSichern() {
    if (!sammlung.faecher.length) {
      W.melden("Noch nichts zu sichern.");
      return;
    }
    X.sammlungPaket(sammlung.faecher)
      .then(function (p) {
        X.jsonSpeichern(p, "Wandtafel_Sicherung");
      })
      .catch(fehler);
  }

  function importStarten(ziel) {
    importZiel = ziel || null;
    document.getElementById("import-datei").click();
  }

  function importDatei(datei) {
    var gelesen = null;
    var warten = null;
    if (W.PptxLesen && W.PptxLesen.istPptx(datei)) {
      warten = true;
      W.melden("PowerPoint wird gelesen …", 60000);
    }
    X.paketLesen(datei)
      .then(function (paket) {
        gelesen = paket;
        if (paket.art === "sammlung") return X.importieren(paket);
        if (importZiel) return X.importieren(paket, importZiel);
        // Einzelne Tafel: Kapitel waehlen (oder neues Fach anlegen)
        var optionen = kapitelOptionen();
        if (!optionen.length) {
          var fach = neuesFachObjekt("Importiert");
          fach.kapitel.push(neuesKapitelObjekt("Allgemein"));
          sammlung.faecher.push(fach);
          return sichern().then(function () {
            return X.importieren(paket, { fachId: fach.id, kapitelId: fach.kapitel[0].id });
          });
        }
        var vorschlag = optionen.find(function (o) {
          return o.wert.indexOf(fachId + "|") === 0;
        });
        return W.dialog({
          titel: "Tafel «" + paket.tafel.titel + "» importieren",
          felder: [{ name: "ziel", label: "In welches Kapitel?", typ: "select", optionen: optionen, wert: vorschlag ? vorschlag.wert : null }],
          knopf: "Importieren"
        }).then(function (w) {
          if (!w) return null;
          var teile = w.ziel.split("|");
          return X.importieren(paket, { fachId: teile[0], kapitelId: teile[1] });
        });
      })
      .then(function (ergebnis) {
        importZiel = null;
        if (warten) W.melden("");
        if (!ergebnis) return;
        if (gelesen && gelesen.quelle === "pptx" && ergebnis.tafelId) return pptxFertig(gelesen, ergebnis);
        return laden().then(function () {
          if (ergebnis.fachId) fachId = ergebnis.fachId;
          zeichnen();
          W.melden(ergebnis.text, 5000);
        });
      })
      .catch(function (f) {
        importZiel = null;
        if (warten) W.melden("");
        fehler(f);
      });
  }

  /** Nach dem PowerPoint-Import: kurz zusammenfassen und die neue Tafel öffnen */
  function pptxFertig(paket, ergebnis) {
    var seiten = paket.tafel.seiten;
    var elemente = seiten.reduce(function (n, s) {
      return n + s.elemente.length;
    }, 0);
    var felder = [];
    if (paket.hinweis) felder.push({ typ: "hinweis", text: paket.hinweis });
    return laden().then(function () {
      if (ergebnis.fachId) fachId = ergebnis.fachId;
      zeichnen();
      return W.dialog({
        titel: "PowerPoint übernommen",
        text: "«" + paket.tafel.titel + "»: " + mehrzahl(seiten.length, "Folie", "Folien") + " mit " + mehrzahl(elemente, "Element", "Elementen") + " sind jetzt eine Tafel. Texte, Formen und Tabellen lassen sich direkt bearbeiten; ergänze Module wie Timer oder Lostopf.",
        felder: felder,
        knopf: "Tafel öffnen",
        abbrechen: "Später"
      }).then(function (w) {
        if (w) window.location.href = "tafel.html?t=" + encodeURIComponent(ergebnis.tafelId);
      });
    });
  }

  // ---------- Beispiel ----------

  function beispielAnlegen() {
    var t = S.neueTafel("Einstieg: Wie kommt eine Webseite zu mir?");
    var s1 = t.seiten[0];
    s1.hintergrund = "gruen";
    s1.titel = "Einstieg";
    s1.elemente = [
      { id: W.neueId("e"), typ: "text", x: 80, y: 60, b: 1100, h: 170, z: 1, daten: { text: "Wie kommt eine Webseite zu mir?", groesse: 64, fett: true, farbe: "#ffffff" } },
      { id: W.neueId("e"), typ: "notiz", x: 80, y: 300, b: 420, h: 300, z: 2, daten: { text: "Was passiert, wenn du eine Adresse eintippst? Schreibe deine Vermutung auf.", farbe: "#fff3a8" } },
      { id: W.neueId("e"), typ: "notiz", x: 560, y: 300, b: 420, h: 300, z: 3, daten: { text: "Tipp: Mit «Video» oder «Webseite» bindest du Material aus dem Internet ein.", farbe: "#d6ecfb" } },
      { id: W.neueId("e"), typ: "timer", x: 1100, y: 300, b: 400, h: 300, z: 4, daten: { sekunden: 180 } }
    ];
    var s2 = S.leereSeite();
    s2.titel = "Nachlesen";
    s2.elemente = [
      { id: W.neueId("e"), typ: "webseite", x: 40, y: 40, b: 1000, h: 820, z: 1, daten: { url: "https://de.wikipedia.org/wiki/Internet", titel: "Wikipedia: Internet" } },
      { id: W.neueId("e"), typ: "link", x: 1080, y: 40, b: 480, h: 170, z: 2, daten: { url: "https://www.klicksafe.de/", titel: "klicksafe: Sicher im Netz" } },
      { id: W.neueId("e"), typ: "notiz", x: 1080, y: 250, b: 480, h: 300, z: 3, daten: { text: "Suche im Artikel: Wer hat das World Wide Web erfunden?", farbe: "#d4f1d6" } }
    ];
    var s3 = S.leereSeite();
    s3.titel = "Austausch";
    s3.hintergrund = "kariert";
    s3.elemente = [
      { id: W.neueId("e"), typ: "text", x: 60, y: 40, b: 900, h: 120, z: 1, daten: { text: "Wer erklärt der Klasse?", groesse: 48, fett: true } },
      { id: W.neueId("e"), typ: "zufall", x: 60, y: 200, b: 520, h: 420, z: 2, daten: { namen: "Anna\nBen\nCelina\nDario\nElif\nFinn", ohne: true } },
      { id: W.neueId("e"), typ: "gruppen", x: 640, y: 200, b: 620, h: 440, z: 3, daten: { namen: "Anna\nBen\nCelina\nDario\nElif\nFinn", groesse: 2 } },
      { id: W.neueId("e"), typ: "wuerfel", x: 1300, y: 200, b: 260, h: 260, z: 4, daten: {} }
    ];
    t.seiten.push(s2, s3);
    var fach = fachFinden("Medien und Informatik") || neuesFachObjekt("Medien und Informatik", FACHFARBEN[0]);
    if (sammlung.faecher.indexOf(fach) === -1) sammlung.faecher.push(fach);
    var kapitel = neuesKapitelObjekt("Kapitel 1: Internet");
    kapitel.tafeln.push(t.id);
    fach.kapitel.push(kapitel);
    var thema = neuesKapitelObjekt("Kapitel 2: Daten und Codierung");
    fach.kapitel.push(thema);
    S.tafelSpeichern(t)
      .then(function () {
        tafeln[t.id] = t;
        return sichern();
      })
      .then(function () {
        fachWaehlen(fach.id);
        W.melden("Beispiel angelegt.");
      })
      .catch(fehler);
  }

  // ---------- Darstellung ----------

  // Vorschau fuellt die Kartenbreite: 1600 Punkte auf die Breite der Karte
  var vorschauBeobachter = new ResizeObserver(function (eintraege) {
    eintraege.forEach(function (e) {
      var flaeche = e.target.firstChild;
      if (flaeche) flaeche.style.transform = "scale(" + e.contentRect.width / E.BREITE + ")";
    });
  });
  var vorschauKontext = {
    bearbeitbar: false,
    druck: true,
    festhalten: function () {},
    speichern: function () {},
    mediumUrl: S.mediumUrl
  };

  /** Verkleinerte Ansicht der ersten Seite */
  function vorschau(t) {
    var box = el("div", "tafel-vorschau");
    var seite = t.seiten[0];
    var flaeche = el("div", "tafel");
    E.hintergrundAnwenden(flaeche, seite, S.mediumUrl);
    flaeche.style.width = E.BREITE + "px";
    flaeche.style.height = E.HOEHE + "px";
    flaeche.style.transform = "scale(0.2)";
    var ebene = el("div", "ebene-elemente");
    seite.elemente.forEach(function (e) {
      var teile = E.rahmenBauen(e, vorschauKontext);
      E.inhaltBauen(e, teile, vorschauKontext);
      ebene.appendChild(teile.knoten);
    });
    flaeche.appendChild(ebene);
    if (seite.striche.length) {
      var leinwand = el("canvas", "ebene-zeichnung");
      leinwand.width = E.BREITE / 2;
      leinwand.height = E.HOEHE / 2;
      flaeche.appendChild(leinwand);
      E.stricheZeichnen(leinwand, seite.striche);
    }
    box.appendChild(flaeche);
    box.setAttribute("aria-hidden", "true");
    vorschauBeobachter.observe(box);
    return box;
  }

  function tafelKarte(fach, kapitel, t, mitOrt) {
    var karte = el("article", "tafel-karte");
    karte.dataset.id = t.id;
    var link = el("a", "tafel-karte-bild");
    link.href = "tafel.html?t=" + encodeURIComponent(t.id);
    link.setAttribute("aria-label", "Tafel «" + t.titel + "» öffnen");
    link.appendChild(vorschau(t));
    karte.appendChild(link);

    var text = el("div", "tafel-karte-text");
    text.appendChild(el("h3", null, t.titel));
    if (mitOrt) text.appendChild(el("p", "tafel-ort", W.ortText(fach, kapitel)));
    text.appendChild(el("p", "tafel-daten", mehrzahl(t.seiten.length, "Seite", "Seiten") + " · geändert " + W.datumText(t.geaendert)));
    karte.appendChild(text);

    var aktionen = el("div", "tafel-karte-aktionen");
    var oeffnen = el("a", "knopf knopf-haupt knopf-klein", "Bearbeiten");
    oeffnen.href = link.href;
    var zeigen = el("a", "knopf knopf-klein", "Präsentieren");
    zeigen.href = link.href + "&praesentieren=1";
    var mehr = W.knopf("knopf knopf-klein knopf-icon", "mehr", "Weitere Aktionen für «" + t.titel + "»");
    mehr.setAttribute("aria-haspopup", "true");
    mehr.addEventListener("click", function () {
      W.menue(mehr, [
        { text: "Umbenennen …", aktion: function () { tafelUmbenennen(t); } },
        { text: "Duplizieren", aktion: function () { tafelDuplizieren(kapitel, t); } },
        { text: "Verschieben …", aktion: function () { tafelVerschieben(kapitel, t); } },
        { trenner: true },
        { text: "Export: HTML-Datei (offline)", aktion: function () { X.htmlSpeichern(t).catch(fehler); } },
        { text: "Export: PDF (Drucken)", aktion: function () { X.pdfDrucken(t).catch(fehler); } },
        {
          text: "Export: Wandtafel-Datei",
          aktion: function () {
            X.tafelPaket(t)
              .then(function (p) {
                X.jsonSpeichern(p, t.titel);
              })
              .catch(fehler);
          }
        },
        { trenner: true },
        { text: "Löschen", gefahr: true, aktion: function () { tafelLoeschen(kapitel, t); } }
      ]);
    });
    aktionen.appendChild(oeffnen);
    aktionen.appendChild(zeigen);
    aktionen.appendChild(mehr);
    karte.appendChild(aktionen);
    return karte;
  }

  function faecherListe() {
    var liste = document.getElementById("faecher-liste");
    liste.innerHTML = "";
    sammlung.faecher.forEach(function (f) {
      var li = el("li");
      var a = el("a", "fach-eintrag" + (f.id === fachId ? " aktiv" : ""));
      a.href = "#fach=" + encodeURIComponent(f.id);
      a.style.setProperty("--fach", f.farbe);
      a.appendChild(el("span", "fach-punkt"));
      a.appendChild(el("span", "fach-name", f.name));
      a.appendChild(el("span", "fach-zahl", String(anzahlTafeln(f))));
      if (f.id === fachId) a.setAttribute("aria-current", "page");
      li.appendChild(a);
      liste.appendChild(li);
    });
  }

  function willkommen() {
    var box = el("section", "willkommen");
    var kopf = el("div", "willkommen-kopf");
    kopf.appendChild(el("p", "willkommen-marke", "Interaktive Wandtafel"));
    kopf.appendChild(el("h1", null, "Unterricht, der sich bewegt"));
    kopf.appendChild(el("p", "willkommen-lead", "Tafeln mit mehreren Seiten wie eine Präsentation, aber interaktiv: Texte, Bilder, Videos, Webseiten, Timer, Lostopf, Gruppen und Würfel. Darüber zeichnest du mit Stift und Marker."));
    box.appendChild(kopf);

    var wege = el("div", "willkommen-wege");
    function weg(icon, titel, text, knopfText, klasse, aktion, id) {
      var karte = el("article", "weg-karte");
      var symbol = el("span", "weg-symbol");
      symbol.innerHTML = W.icon(icon);
      karte.appendChild(symbol);
      karte.appendChild(el("h2", null, titel));
      karte.appendChild(el("p", null, text));
      var k = el("button", "knopf " + klasse, knopfText);
      k.type = "button";
      if (id) k.id = id;
      k.addEventListener("click", aktion);
      karte.appendChild(k);
      wege.appendChild(karte);
    }
    weg("ordner", "Neu beginnen", "Fach anlegen, darin Kapitel oder Themen und darin deine Tafeln.", "Erstes Fach anlegen", "knopf-haupt", fachAnlegen);
    weg("praesentieren", "Aus PowerPoint", "Eine .pptx-Datei hochladen: Jede Folie wird eine bearbeitbare Seite.", "PowerPoint hochladen", "knopf-akzent", function () {
      importStarten();
    }, "willkommen-pptx");
    weg("seiten", "Ausprobieren", "Eine fertige Beispieltafel mit Timer, Lostopf und Gruppen ansehen.", "Beispiel laden", "", beispielAnlegen, "beispiel");
    box.appendChild(wege);

    var fuss = el("p", "hinweis-klein");
    fuss.appendChild(document.createTextNode("Alles bleibt nur in diesem Browser auf diesem Gerät. Mit «Alles sichern» erstellst du eine Sicherungsdatei, die du auf einem anderen Gerät "));
    var imp = el("button", "text-knopf", "importieren");
    imp.type = "button";
    imp.addEventListener("click", function () {
      importStarten();
    });
    fuss.appendChild(imp);
    fuss.appendChild(document.createTextNode(" kannst."));
    box.appendChild(fuss);
    return box;
  }

  function fachAnsicht(fach) {
    var frag = document.createDocumentFragment();
    var jahre = jahreVon(fach);
    var jahr = jahrId && jahreVon(fach).find(function (j) {
      return j.id === jahrId;
    });
    var kopf = el("header", "fach-kopf");
    kopf.style.setProperty("--fach", fach.farbe);
    var titel = el("div", "fach-titel");
    titel.appendChild(el("h1", null, fach.name));
    titel.appendChild(
      el("p", null, (jahre.length ? mehrzahl(jahre.length, "Jahr", "Jahre") + " · " : "") + mehrzahl(fach.kapitel.length, "Kapitel", "Kapitel") + " · " + mehrzahl(anzahlTafeln(fach), "Tafel", "Tafeln"))
    );
    kopf.appendChild(titel);
    var neuKapitel = el("button", "knopf knopf-haupt", "+ Kapitel / Thema");
    neuKapitel.type = "button";
    neuKapitel.addEventListener("click", function () {
      kapitelAnlegen(fach);
    });
    var neuJahr = el("button", "knopf", "+ Jahr");
    neuJahr.type = "button";
    neuJahr.id = "jahr-neu";
    neuJahr.title = "Jahr anlegen, z. B. 1. Sek; darin legst du Kapitel oder Themen an";
    neuJahr.addEventListener("click", function () {
      jahrAnlegen(fach);
    });
    var mehr = W.knopf("knopf knopf-icon", "mehr", "Weitere Aktionen für das Fach");
    mehr.setAttribute("aria-haspopup", "true");
    var i = sammlung.faecher.indexOf(fach);
    mehr.addEventListener("click", function () {
      W.menue(mehr, [
        { text: "Name und Farbe …", aktion: function () { fachBearbeiten(fach); } },
        i > 0 ? { text: "In der Liste nach oben", aktion: function () { fachVerschieben(fach, -1); } } : null,
        i < sammlung.faecher.length - 1 ? { text: "In der Liste nach unten", aktion: function () { fachVerschieben(fach, 1); } } : null,
        { text: "Fach exportieren (Wandtafel-Datei)", aktion: function () { fachExport(fach); } },
        { trenner: true },
        { text: "Fach löschen", gefahr: true, aktion: function () { fachLoeschen(fach); } }
      ]);
    });
    var kopfKnoepfe = el("div", "fach-knoepfe");
    kopfKnoepfe.appendChild(neuKapitel);
    kopfKnoepfe.appendChild(neuJahr);
    kopfKnoepfe.appendChild(mehr);
    kopf.appendChild(kopfKnoepfe);
    frag.appendChild(kopf);

    if (jahre.length) frag.appendChild(jahrReiter(fach, jahr));

    if (jahr) {
      var imJahr = kapitelImJahr(fach, jahr);
      if (!imJahr.length) frag.appendChild(el("p", "leer-hinweis", "Noch kein Kapitel oder Thema in «" + jahr.name + "». Lege mit «+ Kapitel / Thema» das erste an."));
      imJahr.forEach(function (kapitel) {
        frag.appendChild(kapitelAbschnitt(fach, kapitel));
      });
    } else if (jahre.length) {
      // Alle Jahre untereinander, danach Kapitel ohne Jahr
      jahre.concat([null]).forEach(function (j) {
        var gruppe = kapitelImJahr(fach, j);
        if (!j && !gruppe.length) return;
        var kopfJahr = el("h2", "jahr-titel");
        var link = el("a", null, j ? j.name : "Ohne Jahr");
        if (j) link.href = "#fach=" + encodeURIComponent(fach.id) + "&jahr=" + encodeURIComponent(j.id);
        kopfJahr.appendChild(link);
        frag.appendChild(kopfJahr);
        if (!gruppe.length) frag.appendChild(el("p", "leer-hinweis", "Noch kein Kapitel oder Thema in diesem Jahr."));
        gruppe.forEach(function (kapitel) {
          frag.appendChild(kapitelAbschnitt(fach, kapitel));
        });
      });
    } else {
      if (!fach.kapitel.length) frag.appendChild(el("p", "leer-hinweis", "Noch kein Kapitel. Lege mit «+ Kapitel / Thema» das erste an."));
      fach.kapitel.forEach(function (kapitel) {
        frag.appendChild(kapitelAbschnitt(fach, kapitel));
      });
    }
    return frag;
  }

  /** Reiter «Alle», «1. Sek», «2. Sek» … mit Anzahl Tafeln; Aktionen fuer das gewaehlte Jahr */
  function jahrReiter(fach, jahr) {
    var reiter = el("nav", "jahr-reiter");
    reiter.setAttribute("aria-label", "Jahre");
    function eintrag(text, j, zahl) {
      var a = el("a", "jahr-knopf" + ((j ? j.id : null) === (jahr ? jahr.id : null) ? " aktiv" : ""));
      a.href = "#fach=" + encodeURIComponent(fach.id) + (j ? "&jahr=" + encodeURIComponent(j.id) : "&jahr=alle");
      a.appendChild(document.createTextNode(text));
      a.appendChild(el("span", "jahr-zahl", String(zahl)));
      if (a.classList.contains("aktiv")) a.setAttribute("aria-current", "page");
      reiter.appendChild(a);
    }
    eintrag("Alle", null, anzahlTafeln(fach));
    var jahre = jahreVon(fach);
    jahre.forEach(function (j) {
      eintrag(j.name, j, anzahlTafeln(fach, kapitelImJahr(fach, j)));
    });
    if (jahr) {
      var n = jahre.indexOf(jahr);
      var mehr = W.knopf("knopf knopf-klein knopf-icon", "mehr", "Weitere Aktionen für das Jahr «" + jahr.name + "»");
      mehr.setAttribute("aria-haspopup", "true");
      mehr.addEventListener("click", function () {
        W.menue(mehr, [
          { text: "Umbenennen …", aktion: function () { jahrUmbenennen(jahr); } },
          n > 0 ? { text: "Nach links", aktion: function () { jahrVerschieben(fach, jahr, -1); } } : null,
          n < jahre.length - 1 ? { text: "Nach rechts", aktion: function () { jahrVerschieben(fach, jahr, 1); } } : null,
          { text: "Jahr exportieren (Wandtafel-Datei)", aktion: function () { fachExport(fach, { jahr: jahr }); } },
          { trenner: true },
          { text: "Jahr entfernen …", gefahr: true, aktion: function () { jahrEntfernen(fach, jahr); } }
        ]);
      });
      reiter.appendChild(mehr);
    }
    return reiter;
  }

  function kapitelAbschnitt(fach, kapitel) {
    var gruppe = kapitelImJahr(fach, W.jahrVon(fach, kapitel));
    var k = gruppe.indexOf(kapitel);
    var abschnitt = el("section", "kapitel");
    abschnitt.dataset.id = kapitel.id;
    var kk = el("div", "kapitel-kopf");
    kk.appendChild(el("h2", null, kapitel.name));
    kk.appendChild(el("span", "kapitel-zahl", mehrzahl(kapitel.tafeln.length, "Tafel", "Tafeln")));
    var neu = el("button", "knopf knopf-klein knopf-akzent", "+ Tafel");
    neu.type = "button";
    neu.addEventListener("click", function () {
      tafelAnlegen(kapitel);
    });
    var km = W.knopf("knopf knopf-klein knopf-icon", "mehr", "Weitere Aktionen für das Kapitel «" + kapitel.name + "»");
    km.setAttribute("aria-haspopup", "true");
    km.addEventListener("click", function () {
      W.menue(km, [
        { text: "Umbenennen …", aktion: function () { kapitelUmbenennen(kapitel); } },
        jahreVon(fach).length ? { text: "Jahr ändern …", aktion: function () { kapitelJahrAendern(fach, kapitel); } } : null,
        k > 0 ? { text: "Nach oben", aktion: function () { kapitelVerschieben(fach, kapitel, -1); } } : null,
        k < gruppe.length - 1 ? { text: "Nach unten", aktion: function () { kapitelVerschieben(fach, kapitel, 1); } } : null,
        { text: "PowerPoint oder Tafel importieren …", aktion: function () { importStarten({ fachId: fach.id, kapitelId: kapitel.id }); } },
        { text: "Kapitel exportieren (Wandtafel-Datei)", aktion: function () { fachExport(fach, { kapitel: kapitel }); } },
        { trenner: true },
        { text: "Kapitel löschen", gefahr: true, aktion: function () { kapitelLoeschen(fach, kapitel); } }
      ]);
    });
    kk.appendChild(neu);
    kk.appendChild(km);
    abschnitt.appendChild(kk);

    if (!kapitel.tafeln.length) {
      abschnitt.appendChild(el("p", "leer-hinweis", "Noch keine Tafel in diesem Kapitel."));
    } else {
      var raster = el("div", "tafel-raster");
      kapitel.tafeln.forEach(function (id) {
        if (tafeln[id]) raster.appendChild(tafelKarte(fach, kapitel, tafeln[id]));
      });
      abschnitt.appendChild(raster);
    }
    return abschnitt;
  }

  function suchAnsicht(begriff) {
    var frag = document.createDocumentFragment();
    frag.appendChild(el("h1", "such-titel", "Suche: «" + begriff + "»"));
    var raster = el("div", "tafel-raster");
    var n = W.normal(begriff);
    sammlung.faecher.forEach(function (f) {
      f.kapitel.forEach(function (k) {
        k.tafeln.forEach(function (id) {
          var t = tafeln[id];
          if (!t) return;
          var text = [t.titel, W.ortText(f, k)]
            .concat(
              t.seiten.map(function (s, i) {
                return E.seitenTitel(s, i + 1) + " " + s.elemente.map(function (e) {
                  return (e.daten.text || "") + " " + (e.daten.titel || "") + " " + (e.daten.url || "");
                }).join(" ");
              })
            )
            .join(" ");
          if (W.normal(text).indexOf(n) !== -1) raster.appendChild(tafelKarte(f, k, t, true));
        });
      });
    });
    if (!raster.children.length) frag.appendChild(el("p", "leer-hinweis", "Keine Tafel gefunden."));
    else frag.appendChild(raster);
    return frag;
  }

  function zeichnen() {
    if (fachId && !fachVonId(fachId)) fachId = null;
    if (!fachId && sammlung.faecher.length && !suche.value.trim()) fachId = sammlung.faecher[0].id;
    var fach = fachVonId(fachId);
    if (jahrId && !(fach && jahreVon(fach).some(function (j) {
      return j.id === jahrId;
    }))) jahrId = null;
    faecherListe();
    inhalt.innerHTML = "";
    var begriff = suche.value.trim();
    if (begriff) inhalt.appendChild(suchAnsicht(begriff));
    else if (!sammlung.faecher.length) inhalt.appendChild(willkommen());
    else inhalt.appendChild(fachAnsicht(fach));
    var jahr = fach && jahrId && jahreVon(fach).find(function (j) {
      return j.id === jahrId;
    });
    document.title = (fach && !begriff ? fach.name + (jahr ? " " + jahr.name : "") + " · " : "") + "Interaktive Wandtafel";
  }

  function fachWaehlen(id, jahr) {
    fachId = id;
    jahrId = jahr || null;
    suche.value = "";
    var hash = "#fach=" + encodeURIComponent(id) + (jahrId ? "&jahr=" + encodeURIComponent(jahrId) : "");
    if (window.location.hash !== hash) history.replaceState(null, "", hash);
    zeichnen();
  }

  function jahrWaehlen(id) {
    fachWaehlen(fachId, id);
  }

  /** { fach, jahr } aus der Adresse; jahr=alle zeigt alle Jahre */
  function hashLesen() {
    var f = window.location.hash.match(/fach=([^&]+)/);
    var j = window.location.hash.match(/jahr=([^&]+)/);
    return { fach: f ? decodeURIComponent(f[1]) : null, jahr: j && j[1] !== "alle" ? decodeURIComponent(j[1]) : null };
  }

  function speicherInfo() {
    return S.platz().then(function (p) {
      var info = document.getElementById("speicher-info");
      if (!p || !p.usage) {
        info.textContent = "";
        return;
      }
      var mb = p.usage / 1024 / 1024;
      info.textContent = "Belegt im Browser: " + (mb < 10 ? mb.toFixed(1) : Math.round(mb)) + " MB";
    });
  }

  function starten() {
    document.querySelectorAll("[data-icon]").forEach(function (k) {
      k.insertAdjacentHTML("afterbegin", W.icon(k.dataset.icon));
    });
    document.getElementById("fach-neu").addEventListener("click", fachAnlegen);
    document.getElementById("sichern").addEventListener("click", allesSichern);
    document.getElementById("importieren").addEventListener("click", function () {
      importStarten();
    });
    document.getElementById("pptx-import").addEventListener("click", function () {
      importStarten();
    });
    document.getElementById("import-datei").addEventListener("change", function () {
      if (this.files[0]) importDatei(this.files[0]);
      this.value = "";
    });
    suche.addEventListener("input", zeichnen);
    window.addEventListener("hashchange", function () {
      var ort = hashLesen();
      if (ort.fach && (ort.fach !== fachId || ort.jahr !== jahrId)) fachWaehlen(ort.fach, ort.jahr);
    });
    // Wandtafel-Dateien auf die Seite ziehen
    document.addEventListener("dragover", function (ev) {
      ev.preventDefault();
    });
    document.addEventListener("drop", function (ev) {
      ev.preventDefault();
      var d = ev.dataTransfer && ev.dataTransfer.files[0];
      if (d && /\.(json|html?|pptx)$/i.test(d.name)) importDatei(d);
    });
    // Beim Zurueckkehren aus einer Tafel die Vorschau aktualisieren
    window.addEventListener("pageshow", function (ev) {
      if (ev.persisted) laden().then(zeichnen);
    });

    laden()
      .then(function () {
        var ort = hashLesen();
        fachId = ort.fach;
        jahrId = ort.jahr;
        zeichnen();
        speicherInfo();
        // Installierte App: mit der Wandtafel geoeffnete PowerPoint-Datei importieren
        if (window.launchQueue) {
          window.launchQueue.setConsumer(function (start) {
            if (start.files && start.files[0]) start.files[0].getFile().then(importDatei);
          });
        }
      })
      .catch(function (f) {
        inhalt.innerHTML = "";
        inhalt.appendChild(el("p", "leer-hinweis", f.message));
      });
  }

  starten();
})();
