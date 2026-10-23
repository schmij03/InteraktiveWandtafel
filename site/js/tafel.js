/*
 * Tafel bearbeiten und praesentieren (tafel.html?t=<id>).
 *
 * Eine Tafel hat mehrere Seiten (wie Folien einer Praesentation). Jede Seite
 * ist eine feste Flaeche von 1600 x 900 Punkten, die auf den Bildschirm
 * skaliert wird. Darauf liegen Elemente (siehe elemente.js), darueber eine
 * Zeichenebene. Im Modus «Zeichnen» schreibt man auf die ganze Seite, im
 * Modus «Bearbeiten» verschiebt und aendert man die Elemente.
 *
 * Gespeichert wird automatisch im Browser (speicher.js).
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var S = W.Speicher;
  var E = W.Elemente;
  var X = W.Export;
  var el = W.el;
  var begrenzen = W.begrenzen;

  var BREITE = E.BREITE;
  var HOEHE = E.HOEHE;
  var MAX_VERLAUF = 60;

  // Zeichenfarben wie bei fobizz (dazu Schwarz und Dunkelblau fuer weisse Seiten)
  var FARBEN = ["#1f2933", "#065a82", "#dc3545", "#b3177b", "#fde725", "#69b645", "#22b5b7", "#4338ca", "#ffffff"];
  var FARBNAMEN = ["Schwarz", "Dunkelblau", "Rot", "Magenta", "Gelb", "Grün", "Cyan", "Indigo", "Weiss"];
  var DICKEN = [3, 6, 12];
  var MODULE = ["timer", "stoppuhr", "uhr", "ampel", "sozialform", "zufall", "gruppen", "wuerfel"];

  var parameter = new URLSearchParams(window.location.search);
  var tafelId = parameter.get("t");

  var tafelEl = document.getElementById("tafel");
  var rahmen = document.getElementById("rahmen");
  var ebene = document.getElementById("elemente");
  var leinwand = document.getElementById("zeichnung");

  var tafel = null;
  var seiteNr = 0;
  var modus = "bearbeiten";
  var praesentiert = false;
  var werkzeug = "stift";
  var farbe = FARBEN[0];
  var dicke = DICKEN[1];
  var massstab = 1;
  var gewaehlt = null;
  var verlauf = [];
  var verlaufPos = -1;
  var animation = null; // Animationen der Seite beim Praesentieren
  var referent = null; // Fenster der Referentenansicht
  var vollbildVerlassen = false; // Vollbild mit dem Knopf verlassen, weiter praesentieren
  var FORMATIERBAR = { text: true, notiz: true, form: true, tabelle: true };
  var KOPIE_TYP = "application/x-wandtafel-element";

  function seite() {
    return tafel.seiten[seiteNr];
  }

  var kontext = {
    bearbeitbar: true,
    eintragbar: false, // beim Praesentieren: Texte und Tabellen ausfuellen, nichts verschieben
    druck: false,
    festhalten: function () {
      festhalten();
    },
    speichern: function () {
      speichern();
    },
    mediumUrl: S.mediumUrl
  };

  // ---------- Speichern und Verlauf ----------

  var speicherTakt = null;
  var speicherFehler = false;

  function jetztSpeichern() {
    clearTimeout(speicherTakt);
    speicherTakt = null;
    tafel.geaendert = Date.now();
    return S.tafelSpeichern(tafel).then(
      function () {
        speicherFehler = false;
      },
      function (fehler) {
        if (!speicherFehler) W.melden(fehler.message, 8000);
        speicherFehler = true;
      }
    );
  }

  function speichern() {
    clearTimeout(speicherTakt);
    speicherTakt = setTimeout(jetztSpeichern, 400);
  }

  function stand() {
    return JSON.stringify({ seiten: tafel.seiten, nr: seiteNr });
  }

  /** Haelt den aktuellen Stand fuer Rueckgaengig fest und speichert ihn. */
  function festhalten() {
    var s = stand();
    if (verlauf[verlaufPos] === s) return;
    verlauf = verlauf.slice(0, verlaufPos + 1);
    verlauf.push(s);
    if (verlauf.length > MAX_VERLAUF) verlauf.shift();
    verlaufPos = verlauf.length - 1;
    verlaufKnoepfe();
    seitenListeBauen();
    speichern();
  }

  function zurueckholen(schritt) {
    var ziel = verlaufPos + schritt;
    if (ziel < 0 || ziel >= verlauf.length) return;
    verlaufPos = ziel;
    var alt = JSON.parse(verlauf[verlaufPos]);
    tafel.seiten = alt.seiten;
    seiteNr = begrenzen(alt.nr, 0, tafel.seiten.length - 1);
    seiteZeigen();
    verlaufKnoepfe();
    speichern();
  }

  function verlaufKnoepfe() {
    document.getElementById("rueckgaengig").disabled = verlaufPos <= 0;
    document.getElementById("wiederholen").disabled = verlaufPos >= verlauf.length - 1;
    document.getElementById("p-rueckgaengig").disabled = verlaufPos <= 0;
  }

  // ---------- Massstab ----------

  function einpassen() {
    var rand = praesentiert ? 0 : 24;
    var b = rahmen.clientWidth - rand;
    var h = rahmen.clientHeight - rand;
    massstab = Math.max(0.1, Math.min(b / BREITE, h / HOEHE));
    tafelEl.style.transform = "scale(" + massstab + ")";
    tafelEl.style.left = Math.max(rand / 2, (rahmen.clientWidth - BREITE * massstab) / 2) + "px";
    tafelEl.style.top = Math.max(rand / 2, (rahmen.clientHeight - HOEHE * massstab) / 2) + "px";
  }

  /** Bildschirmpunkt in Tafelkoordinaten */
  function tafelPunkt(ereignis) {
    var r = tafelEl.getBoundingClientRect();
    return { x: (ereignis.clientX - r.left) / massstab, y: (ereignis.clientY - r.top) / massstab };
  }

  // ---------- Elemente ----------

  /** Sucht die Stelle, an der ein neues Element am wenigsten verdeckt. */
  function freierPlatz(b, h) {
    var bester = null;
    for (var y = 20; y <= HOEHE - h - 20; y += 40) {
      for (var x = 20; x <= BREITE - b - 20; x += 40) {
        var verdeckt = 0;
        seite().elemente.forEach(function (e) {
          var ub = Math.min(x + b, e.x + e.b) - Math.max(x, e.x);
          var uh = Math.min(y + h, e.y + e.h) - Math.max(y, e.y);
          if (ub > 0 && uh > 0) verdeckt += ub * uh;
        });
        if (!bester || verdeckt < bester.verdeckt) bester = { x: x, y: y, verdeckt: verdeckt };
        if (verdeckt === 0) return bester;
      }
    }
    return bester || { x: (BREITE - b) / 2, y: (HOEHE - h) / 2 };
  }

  function hinzufuegen(typ, daten, ort) {
    var g = E.GROESSE[typ];
    var b = Math.min(BREITE, (ort && ort.b) || g[0]);
    var h = Math.min(HOEHE, (ort && ort.h) || g[1]);
    var x, y;
    if (ort && ort.x != null) {
      x = ort.x;
      y = ort.y;
    } else {
      var platz = freierPlatz(b, h);
      x = platz.x;
      y = platz.y;
    }
    var e = {
      id: W.neueId("e"),
      typ: typ,
      x: Math.round(begrenzen(x, 0, BREITE - 60)),
      y: Math.round(begrenzen(y, 0, HOEHE - 40)),
      b: b,
      h: h,
      z: hoechsteEbene() + 1,
      daten: daten || {}
    };
    if (modus === "zeichnen") modusSetzen("bearbeiten");
    seite().elemente.push(e);
    var knoten = elementBauen(e);
    ebene.appendChild(knoten);
    waehlen(e.id);
    festhalten();
    return knoten;
  }

  function hoechsteEbene() {
    return seite().elemente.reduce(function (m, e) {
      return Math.max(m, e.z || 0);
    }, 0);
  }

  function finden(id) {
    var liste = seite().elemente;
    for (var i = 0; i < liste.length; i++) if (liste[i].id === id) return liste[i];
    return null;
  }

  function knotenVon(id) {
    return ebene.querySelector('[data-id="' + id + '"]');
  }

  function waehlen(id) {
    gewaehlt = id;
    ebene.querySelectorAll(".element").forEach(function (k) {
      k.classList.toggle("gewaehlt", k.dataset.id === id);
    });
  }

  function entfernen(id) {
    E.vergessen(id);
    seite().elemente = seite().elemente.filter(function (e) {
      return e.id !== id;
    });
    var k = knotenVon(id);
    if (k) k.remove();
    if (gewaehlt === id) gewaehlt = null;
    festhalten();
  }

  function nachVorne(e, knoten) {
    if (e.z === hoechsteEbene()) return;
    e.z = hoechsteEbene() + 1;
    knoten.style.zIndex = e.z;
  }

  function nachHinten(e, knoten) {
    var tiefste = seite().elemente.reduce(function (m, x) {
      return Math.min(m, x.z || 0);
    }, Infinity);
    e.z = tiefste - 1;
    knoten.style.zIndex = e.z;
    festhalten();
  }

  /** Baut ein Element mit Griffleiste, Inhalt und Ziehpunkt. */
  function elementBauen(e) {
    var teile = E.rahmenBauen(e, kontext);
    var knoten = teile.knoten;
    var werkzeuge = teile.werkzeuge;

    // Seltenere Aktionen im Menue, damit die Kopfleiste zum Anfassen frei bleibt
    var mehr = W.knopf("g-knopf", "mehr", "Weitere Aktionen");
    mehr.setAttribute("aria-haspopup", "true");
    mehr.addEventListener("click", function () {
      W.menue(mehr, [
        { text: "Im Spotlight zeigen", aktion: function () { E.spotlight(knoten, true); } },
        e.typ === "bild" ? { text: "Bild bemalen …", aktion: function () { bildBemalen(e); } } : null,
        FORMATIERBAR[e.typ] ? { text: "Format …", aktion: function () { formatBearbeiten(e); } } : null,
        e.typ === "tabelle" ? { text: e.daten.kopf ? "Kopfzeile ausschalten" : "Kopfzeile einschalten", aktion: function () { e.daten.kopf = !e.daten.kopf; neuBauen(e); festhalten(); } } : null,
        { text: e.anim ? "Animation ändern …" : "Animation hinzufügen …", aktion: function () { animationBearbeiten(e); } },
        { text: "Auf der Seite ausrichten …", aktion: function () { ausrichten(e, mehr); } },
        { text: "Duplizieren (Ctrl+D)", aktion: function () { duplizieren(e); } },
        { text: "Auf andere Seite verschieben …", aktion: function () { elementVerschieben(e, mehr); } },
        { text: "In den Vordergrund", aktion: function () { nachVorne(e, knoten); festhalten(); } },
        { text: "Nach hinten legen", aktion: function () { nachHinten(e, knoten); } },
        { trenner: true },
        { text: "Löschen", gefahr: true, aktion: function () { entfernen(e.id); } }
      ]);
    });
    if (werkzeuge && FORMATIERBAR[e.typ]) {
      var format = W.knopf("g-knopf", "format", "Format: Schrift, Farbe, Ausrichtung, Liste …");
      format.addEventListener("click", function () {
        formatBearbeiten(e);
      });
      werkzeuge.appendChild(format);
    }
    var weg = W.knopf("g-knopf", "muell", "Löschen (Entf)");
    weg.addEventListener("click", function () {
      entfernen(e.id);
    });
    if (werkzeuge) {
      werkzeuge.appendChild(mehr);
      werkzeuge.appendChild(weg);
    }

    var ziehpunkt = el("div", "ziehpunkt");
    ziehpunkt.title = "Grösse ändern";
    knoten.appendChild(ziehpunkt);

    knoten.addEventListener("pointerdown", function () {
      if (!praesentiert) waehlen(e.id);
    });
    verschiebbar(teile.griff, knoten, e);
    groesseAenderbar(ziehpunkt, knoten, e);

    // Doppelklick auf den Namen: Titel des Elements aendern
    teile.griff.querySelector(".griff-name").addEventListener("dblclick", function () {
      if (praesentiert) return;
      W.dialog({
        titel: "Titel des Elements",
        felder: [{ name: "titel", label: "Titel in der Kopfleiste", wert: e.daten.titel || E.NAMEN[e.typ] }]
      }).then(function (w) {
        if (!w) return;
        e.daten.titel = w.titel && w.titel !== E.NAMEN[e.typ] ? w.titel : "";
        teile.griff.querySelector(".griff-name").textContent = e.daten.titel || E.NAMEN[e.typ];
        festhalten();
      });
    });

    E.inhaltBauen(e, teile, kontext);
    // Bilder und Formen lassen sich auch am Inhalt verschieben
    if (e.typ === "bild" || e.typ === "form") verschiebbar(teile.koerper, knoten, e);
    return knoten;
  }

  /** Element nach einer Aenderung der Einstellungen neu aufbauen */
  function neuBauen(e) {
    var alt = knotenVon(e.id);
    if (!alt) return;
    E.stoppen(e.id);
    alt.replaceWith(elementBauen(e));
    waehlen(e.id);
  }

  // ---------- Format, Animation, Ausrichten (wie in PowerPoint) ----------

  function formatBearbeiten(e) {
    var d = e.daten;
    var felder = [];
    if (e.typ === "form") {
      felder.push(
        { name: "form", label: "Form", typ: "select", wert: E.formVon(d.form).wert, optionen: E.FORMEN },
        { name: "fuellung", label: "Füllfarbe", typ: "farbwert", wert: d.fuellung && d.fuellung !== "keine" ? d.fuellung : E.FORM_STANDARD.fuellung },
        { name: "ohneFuellung", label: "Ohne Füllung (durchsichtig)", typ: "haken", wert: d.fuellung === "keine" },
        { name: "rand", label: "Randfarbe", typ: "farbwert", wert: d.rand || E.FORM_STANDARD.rand },
        { name: "randDicke", label: "Randdicke in Punkten (0 = ohne Rand)", typ: "zahl", wert: d.randDicke != null ? d.randDicke : E.FORM_STANDARD.randDicke }
      );
    }
    felder.push(
      { name: "schrift", label: "Schriftart", typ: "select", wert: d.schrift || "", optionen: E.SCHRIFTEN },
      { name: "groesse", label: "Schriftgrösse", typ: "zahl", wert: d.groesse || E.standardGroesse(e.typ) }
    );
    if (e.typ !== "notiz") felder.push({ name: "farbe", label: "Schriftfarbe", typ: "farbwert", wert: d.farbe || "#1f2933" });
    felder.push(
      { name: "fett", label: "Fett", typ: "haken", wert: d.fett },
      { name: "kursiv", label: "Kursiv", typ: "haken", wert: d.kursiv },
      { name: "unterstrichen", label: "Unterstrichen", typ: "haken", wert: d.unterstrichen },
      {
        name: "ausrichtung",
        label: "Ausrichtung",
        typ: "select",
        wert: d.ausrichtung || (e.typ === "form" ? "center" : "left"),
        optionen: [
          { wert: "left", text: "Linksbündig" },
          { wert: "center", text: "Zentriert" },
          { wert: "right", text: "Rechtsbündig" },
          { wert: "justify", text: "Blocksatz" }
        ]
      }
    );
    if (e.typ !== "tabelle") {
      felder.push({
        name: "liste",
        label: "Aufzählung",
        typ: "select",
        wert: d.liste || "",
        optionen: [
          { wert: "", text: "Keine" },
          { wert: "punkte", text: "• Aufzählungszeichen" },
          { wert: "nummern", text: "1. Nummerierung" }
        ]
      });
    }
    if (e.typ === "form") {
      felder.push({
        name: "vertikal",
        label: "Text in der Form",
        typ: "select",
        wert: d.vertikal || "mitte",
        optionen: [
          { wert: "oben", text: "oben" },
          { wert: "mitte", text: "in der Mitte" },
          { wert: "unten", text: "unten" }
        ]
      });
    }
    W.dialog({ titel: "Format: " + (d.titel || E.NAMEN[e.typ]), felder: felder, knopf: "Übernehmen" }).then(function (w) {
      if (!w) return;
      if (e.typ === "form") {
        d.form = w.form;
        d.fuellung = w.ohneFuellung ? "keine" : w.fuellung;
        d.rand = w.rand;
        d.randDicke = begrenzen(parseInt(w.randDicke, 10) || 0, 0, 30);
        d.vertikal = w.vertikal === "mitte" ? "" : w.vertikal;
      }
      d.schrift = w.schrift;
      d.groesse = begrenzen(parseInt(w.groesse, 10) || E.standardGroesse(e.typ), 8, 300);
      if (w.farbe) d.farbe = w.farbe;
      d.fett = w.fett;
      d.kursiv = w.kursiv;
      d.unterstrichen = w.unterstrichen;
      d.ausrichtung = w.ausrichtung;
      if (e.typ !== "tabelle") d.liste = w.liste;
      neuBauen(e);
      festhalten();
    });
  }

  function animationBearbeiten(e) {
    var hoechste = seite().elemente.reduce(function (m, x) {
      return x.anim && x !== e ? Math.max(m, x.anim.nr || 1) : m;
    }, 0);
    W.dialog({
      titel: "Animation",
      felder: [
        { name: "effekt", label: "Effekt beim Präsentieren", typ: "select", wert: e.anim ? e.anim.effekt : "einblenden", optionen: [{ wert: "", text: "Keine Animation (immer sichtbar)" }].concat(E.EFFEKTE) },
        { name: "nr", label: "Reihenfolge (gleiche Zahl: erscheinen zusammen)", typ: "zahl", wert: e.anim ? e.anim.nr || 1 : hoechste + 1 },
        { typ: "hinweis", text: "Beim Präsentieren sind Elemente mit Animation zuerst versteckt. Jedes «Weiter» (Pfeil rechts, Leertaste, Presenter) zeigt die nächste Nummer, danach kommt die nächste Seite." }
      ],
      knopf: "Übernehmen"
    }).then(function (w) {
      if (!w) return;
      if (w.effekt) e.anim = { effekt: w.effekt, nr: begrenzen(parseInt(w.nr, 10) || 1, 1, 99) };
      else delete e.anim;
      neuBauen(e);
      festhalten();
    });
  }

  function ausrichten(e, anker) {
    function setzen(x, y) {
      if (x != null) e.x = Math.round(x);
      if (y != null) e.y = Math.round(y);
      var k = knotenVon(e.id);
      if (k) E.lage(k, e);
      festhalten();
    }
    W.menue(anker, [
      { text: "Links", aktion: function () { setzen(0, null); } },
      { text: "Horizontal zentrieren", aktion: function () { setzen((BREITE - e.b) / 2, null); } },
      { text: "Rechts", aktion: function () { setzen(BREITE - e.b, null); } },
      { trenner: true },
      { text: "Oben", aktion: function () { setzen(null, 0); } },
      { text: "Vertikal zentrieren", aktion: function () { setzen(null, (HOEHE - e.h) / 2); } },
      { text: "Unten", aktion: function () { setzen(null, HOEHE - e.h); } },
      { trenner: true },
      { text: "Mitte der Seite", aktion: function () { setzen((BREITE - e.b) / 2, (HOEHE - e.h) / 2); } }
    ]);
  }

  // ---------- Hilfslinien beim Verschieben ----------

  var EINRASTEN = 8;

  /** Rastet an Seitenrand, Seitenmitte und an Kanten und Mitten anderer Elemente ein */
  function einrasten(e, x, y) {
    var xs = [0, BREITE / 2, BREITE];
    var ys = [0, HOEHE / 2, HOEHE];
    seite().elemente.forEach(function (a) {
      if (a === e) return;
      xs.push(a.x, a.x + a.b / 2, a.x + a.b);
      ys.push(a.y, a.y + a.h / 2, a.y + a.h);
    });
    function bester(ziele, wert, groesse) {
      var b = null;
      [0, groesse / 2, groesse].forEach(function (versatz) {
        ziele.forEach(function (z) {
          var abstand = Math.abs(z - (wert + versatz));
          if (abstand <= EINRASTEN && (!b || abstand < b.abstand)) b = { abstand: abstand, wert: z - versatz, linie: z };
        });
      });
      return b;
    }
    var bx = bester(xs, x, e.b);
    var by = bester(ys, y, e.h);
    return { x: bx ? bx.wert : x, y: by ? by.wert : y, senkrecht: bx && bx.linie, waagrecht: by && by.linie };
  }

  function hilfslinienZeigen(r) {
    hilfslinienWeg();
    if (r && r.senkrecht != null) {
      var s = el("div", "hilfslinie senkrecht");
      s.style.left = r.senkrecht + "px";
      ebene.appendChild(s);
    }
    if (r && r.waagrecht != null) {
      var w = el("div", "hilfslinie waagrecht");
      w.style.top = r.waagrecht + "px";
      ebene.appendChild(w);
    }
  }

  function hilfslinienWeg() {
    ebene.querySelectorAll(".hilfslinie").forEach(function (l) {
      l.remove();
    });
  }

  function duplizieren(e) {
    elementEinfuegen(JSON.stringify(e));
  }

  /** Kopiertes Element (JSON) einfuegen: auf derselben Seite versetzt, sonst an gleicher Stelle */
  function elementEinfuegen(json) {
    var x;
    try {
      x = JSON.parse(json);
    } catch (f) {
      return;
    }
    if (!x || !E.NAMEN[x.typ] || typeof x.daten !== "object") return;
    var versatz = finden(x.id) ? 30 : 0;
    var knoten = hinzufuegen(x.typ, JSON.parse(JSON.stringify(x.daten)), { x: x.x + versatz, y: x.y + versatz, b: x.b, h: x.h });
    if (x.anim) {
      var neu = finden(knoten.dataset.id);
      neu.anim = { effekt: x.anim.effekt, nr: x.anim.nr };
      neuBauen(neu);
      festhalten();
    }
  }

  function formenMenue(anker) {
    W.menue(
      anker,
      E.FORMEN.map(function (f) {
        return {
          text: f.text,
          aktion: function () {
            var rund = f.wert === "ellipse" || f.wert === "stern" || f.wert === "sechseck";
            hinzufuegen("form", { form: f.wert }, rund ? { b: 280, h: 280 } : null);
          }
        };
      })
    );
  }

  /** Element auf eine andere Seite verschieben (wie «Seite …» bei fobizz) */
  function elementVerschieben(e, anker) {
    var punkte = tafel.seiten.map(function (s, i) {
      if (i === seiteNr) return null;
      return {
        text: "Seite " + (i + 1) + ": " + E.seitenTitel(s, i + 1),
        aktion: function () {
          seite().elemente = seite().elemente.filter(function (x) {
            return x.id !== e.id;
          });
          E.stoppen(e.id);
          e.z = tafel.seiten[i].elemente.reduce(function (m, x) {
            return Math.max(m, x.z || 0);
          }, 0) + 1;
          tafel.seiten[i].elemente.push(e);
          var k = knotenVon(e.id);
          if (k) k.remove();
          gewaehlt = null;
          festhalten();
          W.melden("Auf Seite " + (i + 1) + " verschoben.");
        }
      };
    }).filter(Boolean);
    if (!punkte.length) {
      W.melden("Die Tafel hat nur eine Seite. Zuerst eine Seite hinzufügen.");
      return;
    }
    W.menue(anker, punkte);
  }

  // ---------- Bild bemalen ----------

  /** Einfacher Bildeditor: auf ein Bild zeichnen und als neues Bild speichern */
  function bildBemalen(e) {
    var d = el("dialog", "dialog maler");
    var kopf = el("h2", null, "Bild bemalen");
    var leiste = el("div", "maler-leiste");
    var farbWahl = el("input");
    farbWahl.type = "color";
    farbWahl.value = "#c82d2d";
    farbWahl.setAttribute("aria-label", "Farbe");
    var dickeWahl = el("input");
    dickeWahl.type = "range";
    dickeWahl.min = "1";
    dickeWahl.max = "40";
    dickeWahl.value = "6";
    dickeWahl.setAttribute("aria-label", "Dicke");
    var zurueck = W.knopf("knopf", "zurueck", "Rückgängig");
    var vor = W.knopf("knopf", "vor", "Wiederholen");
    var neu = el("button", "knopf", "Zurücksetzen");
    neu.type = "button";
    [el("span", null, "Stift"), farbWahl, dickeWahl, zurueck, vor, neu].forEach(function (x) {
      leiste.appendChild(x);
    });
    var flaeche = el("div", "maler-flaeche");
    var c = el("canvas");
    flaeche.appendChild(c);
    var knoepfe = el("div", "dialog-knoepfe");
    var abbrechen = el("button", "knopf", "Abbrechen");
    abbrechen.type = "button";
    var sichern = el("button", "knopf knopf-haupt", "Speichern");
    sichern.type = "button";
    knoepfe.appendChild(abbrechen);
    knoepfe.appendChild(sichern);
    [kopf, leiste, flaeche, knoepfe].forEach(function (x) {
      d.appendChild(x);
    });
    document.body.appendChild(d);

    var ctx = c.getContext("2d");
    var bild = new Image();
    var striche = [];
    var weg = [];
    var aktuell = null;
    function zeichnen() {
      ctx.clearRect(0, 0, c.width, c.height);
      ctx.drawImage(bild, 0, 0, c.width, c.height);
      striche.concat(aktuell ? [aktuell] : []).forEach(function (st) {
        ctx.save();
        ctx.strokeStyle = st.farbe;
        ctx.lineWidth = st.dicke;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.beginPath();
        st.punkte.forEach(function (p, i) {
          if (i === 0) ctx.moveTo(p[0], p[1]);
          else ctx.lineTo(p[0], p[1]);
        });
        if (st.punkte.length === 1) ctx.lineTo(st.punkte[0][0] + 0.1, st.punkte[0][1]);
        ctx.stroke();
        ctx.restore();
      });
      zurueck.disabled = !striche.length;
      vor.disabled = !weg.length;
    }
    function punkt(ev) {
      var r = c.getBoundingClientRect();
      return [((ev.clientX - r.left) * c.width) / r.width, ((ev.clientY - r.top) * c.height) / r.height];
    }
    c.addEventListener("pointerdown", function (ev) {
      c.setPointerCapture(ev.pointerId);
      var faktor = c.width / c.getBoundingClientRect().width;
      aktuell = { farbe: farbWahl.value, dicke: dickeWahl.value * faktor, punkte: [punkt(ev)] };
      zeichnen();
    });
    c.addEventListener("pointermove", function (ev) {
      if (!aktuell) return;
      aktuell.punkte.push(punkt(ev));
      zeichnen();
    });
    function ende() {
      if (!aktuell) return;
      striche.push(aktuell);
      weg = [];
      aktuell = null;
      zeichnen();
    }
    c.addEventListener("pointerup", ende);
    c.addEventListener("pointercancel", ende);
    zurueck.addEventListener("click", function () {
      if (striche.length) weg.push(striche.pop());
      zeichnen();
    });
    vor.addEventListener("click", function () {
      if (weg.length) striche.push(weg.pop());
      zeichnen();
    });
    neu.addEventListener("click", function () {
      striche = [];
      weg = [];
      zeichnen();
    });
    function schliessen() {
      d.close();
      d.remove();
    }
    abbrechen.addEventListener("click", schliessen);
    d.addEventListener("cancel", function (ev) {
      ev.preventDefault();
      schliessen();
    });
    sichern.addEventListener("click", function () {
      try {
        c.toBlob(function (blob) {
          if (!blob) return;
          S.mediumSpeichern(blob, (e.daten.name || "Bild").replace(/\.[^.]+$/, "") + "-bemalt.png").then(function (id) {
            e.daten.medium = id;
            delete e.daten.src;
            schliessen();
            seiteZeigen();
            festhalten();
          }, fehlerMelden);
        }, "image/png");
      } catch (f) {
        W.melden("Dieses Bild stammt von einer anderen Webseite und kann nicht bemalt werden. Bild herunterladen und hochladen, dann geht es.", 8000);
      }
    });

    bild.onload = function () {
      // Grosse Bilder verkleinern, kleine vergroessern, damit man darauf zeichnen kann
      var lang = Math.max(bild.naturalWidth, bild.naturalHeight) || 1;
      var f = Math.min(2000, Math.max(800, lang)) / lang;
      c.width = Math.round(bild.naturalWidth * f) || 800;
      c.height = Math.round(bild.naturalHeight * f) || 600;
      zeichnen();
      d.showModal();
    };
    bild.onerror = function () {
      schliessen();
      W.melden("Das Bild konnte nicht geladen werden.");
    };
    if (e.daten.medium) {
      S.mediumUrl(e.daten.medium).then(function (url) {
        bild.src = url;
      });
    } else {
      bild.crossOrigin = "anonymous";
      bild.src = e.daten.src;
    }
  }

  function verschiebbar(anfasser, knoten, e) {
    anfasser.addEventListener("pointerdown", function (start) {
      if (praesentiert || start.button !== 0 || start.target.closest("button, input, select, textarea, a, [contenteditable]")) return;
      start.preventDefault();
      nachVorne(e, knoten);
      var p0 = tafelPunkt(start);
      var x0 = e.x;
      var y0 = e.y;
      anfasser.setPointerCapture(start.pointerId);
      function bewegen(ev) {
        var p = tafelPunkt(ev);
        var x = x0 + p.x - p0.x;
        var y = y0 + p.y - p0.y;
        // Hilfslinien wie in PowerPoint; mit Alt frei verschieben
        var r = ev.altKey ? null : einrasten(e, x, y);
        if (r) {
          x = r.x;
          y = r.y;
        }
        hilfslinienZeigen(r);
        e.x = Math.round(begrenzen(x, -e.b + 60, BREITE - 60));
        e.y = Math.round(begrenzen(y, 0, HOEHE - 40));
        E.lage(knoten, e);
      }
      function ende() {
        anfasser.removeEventListener("pointermove", bewegen);
        anfasser.removeEventListener("pointerup", ende);
        anfasser.removeEventListener("pointercancel", ende);
        knoten.classList.remove("zieht");
        hilfslinienWeg();
        festhalten();
      }
      knoten.classList.add("zieht");
      anfasser.addEventListener("pointermove", bewegen);
      anfasser.addEventListener("pointerup", ende);
      anfasser.addEventListener("pointercancel", ende);
    });
  }

  function groesseAenderbar(punkt, knoten, e) {
    punkt.addEventListener("pointerdown", function (start) {
      if (start.button !== 0) return;
      start.preventDefault();
      start.stopPropagation();
      var p0 = tafelPunkt(start);
      var b0 = e.b;
      var h0 = e.h;
      // Bilder und Videos behalten ihr Seitenverhaeltnis (mit Shift frei)
      var verhaeltnis = (e.typ === "bild" || e.typ === "video") && (h0 - E.GRIFF) / b0;
      punkt.setPointerCapture(start.pointerId);
      function bewegen(ev) {
        var p = tafelPunkt(ev);
        e.b = Math.round(begrenzen(b0 + p.x - p0.x, 140, BREITE));
        e.h = verhaeltnis && !ev.shiftKey ? Math.round(e.b * verhaeltnis) + E.GRIFF : Math.round(begrenzen(h0 + p.y - p0.y, 90, HOEHE));
        E.lage(knoten, e);
      }
      function ende() {
        punkt.removeEventListener("pointermove", bewegen);
        punkt.removeEventListener("pointerup", ende);
        punkt.removeEventListener("pointercancel", ende);
        knoten.classList.remove("zieht");
        festhalten();
      }
      knoten.classList.add("zieht");
      punkt.addEventListener("pointermove", bewegen);
      punkt.addEventListener("pointerup", ende);
      punkt.addEventListener("pointercancel", ende);
    });
  }

  // ---------- Zeichnen ----------

  var aktuellerStrich = null;

  function zeichnungNeu() {
    E.stricheZeichnen(leinwand, seite().striche, aktuellerStrich);
  }

  function zeichnenEinrichten() {
    leinwand.addEventListener("pointerdown", function (ev) {
      if (modus !== "zeichnen" || ev.button > 0) return;
      ev.preventDefault();
      leinwand.setPointerCapture(ev.pointerId);
      var p = tafelPunkt(ev);
      var faktor = werkzeug === "radierer" ? 5 : werkzeug === "marker" ? 4 : 1;
      aktuellerStrich = {
        werkzeug: werkzeug,
        farbe: farbe,
        dicke: dicke * faktor,
        punkte: [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10]
      };
      zeichnungNeu();
    });
    leinwand.addEventListener("pointermove", function (ev) {
      if (!aktuellerStrich) return;
      var liste = ev.getCoalescedEvents ? ev.getCoalescedEvents() : [ev];
      if (!liste.length) liste = [ev];
      liste.forEach(function (einzeln) {
        var p = tafelPunkt(einzeln);
        var n = aktuellerStrich.punkte.length;
        var dx = p.x - aktuellerStrich.punkte[n - 2];
        var dy = p.y - aktuellerStrich.punkte[n - 1];
        if (dx * dx + dy * dy < 1.5) return;
        aktuellerStrich.punkte.push(Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10);
      });
      zeichnungNeu();
    });
    function ende() {
      if (!aktuellerStrich) return;
      seite().striche.push(aktuellerStrich);
      aktuellerStrich = null;
      zeichnungNeu();
      festhalten();
    }
    leinwand.addEventListener("pointerup", ende);
    leinwand.addEventListener("pointercancel", ende);
  }

  function werkzeugSetzen(neu) {
    werkzeug = neu;
    document.querySelectorAll("[data-werkzeug]").forEach(function (w) {
      w.classList.toggle("aktiv", w.dataset.werkzeug === neu);
    });
    document.getElementById("p-radierer").classList.toggle("aktiv", neu === "radierer" && modus === "zeichnen");
  }

  // ---------- Seiten ----------

  function seiteZeigen() {
    E.alleStoppen();
    ebene.innerHTML = "";
    ebene.classList.remove("hat-spotlight");
    seite()
      .elemente.slice()
      .forEach(function (e) {
        ebene.appendChild(elementBauen(e));
      });
    if (gewaehlt && !finden(gewaehlt)) gewaehlt = null;
    waehlen(gewaehlt);
    hintergrundSetzen();
    zeichnungNeu();
    animation = praesentiert ? E.animationen(ebene, seite()) : null;
    seitenListeBauen();
    praesAnzeige();
    notizenZeigen();
  }

  function zuSeite(nr) {
    nr = begrenzen(nr, 0, tafel.seiten.length - 1);
    if (nr === seiteNr) return;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    seiteNr = nr;
    gewaehlt = null;
    seiteZeigen();
    // Seitenwechsel zaehlt nicht als Aenderung, aber Rueckgaengig soll hier weitermachen
    if (verlauf[verlaufPos]) {
      var s = JSON.parse(verlauf[verlaufPos]);
      s.nr = seiteNr;
      verlauf[verlaufPos] = JSON.stringify(s);
    }
  }

  // Folienlayouts wie in PowerPoint: Platzhalter-Texte, die beim Praesentieren leer unsichtbar sind
  function titelText(y, h, groesse, ausrichtung, platzhalter) {
    return { typ: "text", x: 80, y: y, b: 1440, h: h, daten: { platzhalter: platzhalter || "Titel hinzufügen", groesse: groesse, fett: true, ausrichtung: ausrichtung } };
  }
  function inhaltText(x, y, b, h) {
    return { typ: "text", x: x, y: y, b: b, h: h, daten: { platzhalter: "Text hinzufügen", groesse: 36, liste: "punkte" } };
  }
  var LAYOUTS = [
    {
      wert: "titelfolie",
      text: "Titelfolie",
      elemente: function () {
        return [titelText(230, 210, 84, "center"), { typ: "text", x: 200, y: 470, b: 1200, h: 140, daten: { platzhalter: "Untertitel hinzufügen", groesse: 44, ausrichtung: "center", farbe: "#065a82" } }];
      }
    },
    {
      wert: "titelInhalt",
      text: "Titel und Inhalt",
      elemente: function () {
        return [titelText(30, 150, 60, "left"), inhaltText(80, 200, 1440, 660)];
      }
    },
    {
      wert: "zweiInhalte",
      text: "Zwei Inhalte",
      elemente: function () {
        return [titelText(30, 150, 60, "left"), inhaltText(80, 200, 700, 660), inhaltText(820, 200, 700, 660)];
      }
    },
    {
      wert: "vergleich",
      text: "Vergleich",
      elemente: function () {
        function kopf(x) {
          return { typ: "text", x: x, y: 190, b: 700, h: 110, daten: { platzhalter: "Überschrift", groesse: 40, fett: true, farbe: "#065a82" } };
        }
        return [titelText(30, 150, 60, "left"), kopf(80), kopf(820), inhaltText(80, 300, 700, 560), inhaltText(820, 300, 700, 560)];
      }
    },
    {
      wert: "nurTitel",
      text: "Nur Titel",
      elemente: function () {
        return [titelText(30, 150, 60, "left")];
      }
    },
    {
      wert: "abschnitt",
      text: "Abschnittsüberschrift",
      elemente: function () {
        return [titelText(300, 190, 76, "left", "Abschnitt hinzufügen"), { typ: "text", x: 80, y: 500, b: 1440, h: 120, daten: { platzhalter: "Text hinzufügen", groesse: 36, farbe: "#065a82" } }];
      }
    }
  ];

  function layoutMenue(anker) {
    W.menue(
      anker,
      [{ text: "Leere Seite", aktion: function () { seiteHinzufuegen(); } }].concat(
        LAYOUTS.map(function (l) {
          return {
            text: l.text,
            aktion: function () {
              seiteHinzufuegen(null, l);
            }
          };
        })
      )
    );
  }

  function seiteHinzufuegen(kopieVon, layout) {
    var neu = kopieVon != null ? JSON.parse(JSON.stringify(tafel.seiten[kopieVon])) : S.leereSeite();
    if (layout) {
      neu.elemente = layout.elemente().map(function (x, i) {
        x.id = W.neueId("e");
        x.z = i + 1;
        return x;
      });
    }
    neu.id = W.neueId("s");
    if (kopieVon != null) {
      neu.elemente.forEach(function (e) {
        e.id = W.neueId("e");
      });
      if (neu.titel) neu.titel += " (Kopie)";
    } else {
      neu.hintergrund = seite().hintergrund;
      ["hgFarbe", "hgMuster", "hgBild"].forEach(function (k) {
        if (seite()[k]) neu[k] = seite()[k];
      });
    }
    var ziel = (kopieVon != null ? kopieVon : seiteNr) + 1;
    tafel.seiten.splice(ziel, 0, neu);
    seiteNr = ziel;
    gewaehlt = null;
    seiteZeigen();
    festhalten();
  }

  function seiteLoeschen(nr) {
    if (tafel.seiten.length <= 1) {
      W.melden("Eine Tafel braucht mindestens eine Seite.");
      return;
    }
    tafel.seiten.splice(nr, 1);
    seiteNr = begrenzen(seiteNr > nr ? seiteNr - 1 : seiteNr, 0, tafel.seiten.length - 1);
    gewaehlt = null;
    seiteZeigen();
    festhalten();
    W.melden("Seite gelöscht. Rückgängig mit Ctrl+Z.");
  }

  function seiteVerschieben(nr, schritt) {
    seiteVerschiebenNach(nr, nr + schritt);
  }

  function seiteVerschiebenNach(nr, ziel) {
    if (ziel < 0 || ziel >= tafel.seiten.length || ziel === nr) return;
    var s = tafel.seiten.splice(nr, 1)[0];
    tafel.seiten.splice(ziel, 0, s);
    seiteNr = ziel;
    seiteZeigen();
    festhalten();
  }

  function uebergangWaehlen(nr) {
    var s = tafel.seiten[nr];
    W.dialog({
      titel: "Übergang zu Seite " + (nr + 1),
      felder: [
        { name: "art", label: "Übergang beim Präsentieren", typ: "select", wert: s.uebergang || "", optionen: E.UEBERGAENGE },
        { name: "alle", label: "Für alle Seiten übernehmen", typ: "haken", wert: false }
      ],
      knopf: "Übernehmen"
    }).then(function (w) {
      if (!w) return;
      (w.alle ? tafel.seiten : [s]).forEach(function (x) {
        if (w.art) x.uebergang = w.art;
        else delete x.uebergang;
      });
      festhalten();
      // Vorschau wie in PowerPoint
      if (nr === seiteNr) E.uebergang(tafelEl, w.art);
    });
  }

  function seiteAusblenden(nr) {
    var s = tafel.seiten[nr];
    if (s.ausgeblendet) delete s.ausgeblendet;
    else s.ausgeblendet = true;
    festhalten();
  }

  function seiteUmbenennen(nr) {
    var s = tafel.seiten[nr];
    W.dialog({
      titel: "Seite " + (nr + 1) + " benennen",
      felder: [{ name: "titel", label: "Titel der Seite (leer: erster Text auf der Seite)", wert: s.titel || "" }]
    }).then(function (w) {
      if (!w) return;
      s.titel = w.titel;
      festhalten();
      praesAnzeige();
    });
  }

  function seitenListeBauen() {
    var liste = document.getElementById("seiten");
    liste.innerHTML = "";
    tafel.seiten.forEach(function (s, i) {
      var li = el("li", "seite-eintrag" + (i === seiteNr ? " aktiv" : "") + (s.ausgeblendet ? " ausgeblendet" : ""));
      // Seiten per Ziehen umsortieren
      li.draggable = true;
      li.addEventListener("dragstart", function (ev) {
        ev.dataTransfer.setData("application/x-wandtafel-seite", String(i));
        ev.dataTransfer.effectAllowed = "move";
        li.classList.add("wird-gezogen");
      });
      li.addEventListener("dragend", function () {
        li.classList.remove("wird-gezogen");
      });
      li.addEventListener("dragover", function (ev) {
        if (ev.dataTransfer.types.indexOf("application/x-wandtafel-seite") === -1) return;
        ev.preventDefault();
        li.classList.add("ablegen");
      });
      li.addEventListener("dragleave", function () {
        li.classList.remove("ablegen");
      });
      li.addEventListener("drop", function (ev) {
        var von = ev.dataTransfer.getData("application/x-wandtafel-seite");
        li.classList.remove("ablegen");
        if (von === "") return;
        ev.preventDefault();
        seiteVerschiebenNach(parseInt(von, 10), i);
      });
      var k = el("button", "seite-wahl");
      k.type = "button";
      k.title = "Seite " + (i + 1) + " zeigen (Doppelklick: benennen, Ziehen: verschieben)" + (s.ausgeblendet ? " · beim Präsentieren ausgeblendet" : "");
      k.appendChild(el("span", "seite-nr", String(i + 1)));
      var info = el("span", "seite-info");
      info.appendChild(el("span", "seite-name", E.seitenTitel(s, i + 1)));
      var mitAnim = s.elemente.some(function (e) {
        return e.anim;
      });
      info.appendChild(
        el(
          "small",
          null,
          s.elemente.length +
            (s.elemente.length === 1 ? " Element" : " Elemente") +
            (s.striche.length ? " · Zeichnung" : "") +
            (mitAnim ? " · Animation" : "") +
            (s.uebergang ? " · Übergang" : "") +
            (s.notizen ? " · Notizen" : "") +
            (s.ausgeblendet ? " · ausgeblendet" : "")
        )
      );
      k.appendChild(info);
      if (i === seiteNr) k.setAttribute("aria-current", "page");
      k.addEventListener("click", function () {
        zuSeite(i);
      });
      k.addEventListener("dblclick", function () {
        seiteUmbenennen(i);
      });
      li.appendChild(k);
      var mehr = W.knopf("seite-mehr", "mehr", "Seite " + (i + 1) + ": Aktionen");
      mehr.setAttribute("aria-haspopup", "true");
      mehr.addEventListener("click", function () {
        W.menue(mehr, [
          { text: "Benennen …", aktion: function () { seiteUmbenennen(i); } },
          { text: "Duplizieren", aktion: function () { seiteHinzufuegen(i); } },
          { text: "Übergang …", aktion: function () { uebergangWaehlen(i); } },
          { text: s.ausgeblendet ? "Beim Präsentieren wieder zeigen" : "Beim Präsentieren ausblenden", aktion: function () { seiteAusblenden(i); } },
          i > 0 ? { text: "Nach oben", aktion: function () { seiteVerschieben(i, -1); } } : null,
          i < tafel.seiten.length - 1 ? { text: "Nach unten", aktion: function () { seiteVerschieben(i, 1); } } : null,
          { trenner: true },
          { text: "Löschen", gefahr: true, aktion: function () { seiteLoeschen(i); } }
        ]);
      });
      li.appendChild(mehr);
      liste.appendChild(li);
    });
  }

  // ---------- Darstellung ----------

  function hintergrundSetzen() {
    E.hintergrundAnwenden(tafelEl, seite(), S.mediumUrl);
    document.getElementById("hintergrund").value = seite().hintergrund || "weiss";
  }

  /** Eigenes Seitendesign: Farbe, Muster und Hintergrundbild (wie das Design bei fobizz) */
  function designBearbeiten() {
    var s = seite();
    var felder = [
      { name: "farbe", label: "Hintergrundfarbe", typ: "farbwert", wert: s.hgFarbe || "#ffffff" },
      {
        name: "muster",
        label: "Muster",
        typ: "select",
        wert: s.hgMuster || "",
        optionen: [
          { wert: "", text: "Kein Muster" },
          { wert: "kariert", text: "Kariert" },
          { wert: "liniert", text: "Liniert" },
          { wert: "punkte", text: "Punkte" }
        ]
      },
      { name: "bild", label: s.hgBild ? "Hintergrundbild ersetzen" : "Hintergrundbild (freiwillig)", typ: "file", accept: "image/*" }
    ];
    if (s.hgBild) {
      felder.push({
        name: "bildWeg",
        label: "Bisheriges Hintergrundbild",
        typ: "select",
        optionen: [
          { wert: "", text: "behalten" },
          { wert: "ja", text: "entfernen" }
        ]
      });
    }
    felder.push({ name: "alle", label: "Gilt für", typ: "select", optionen: [{ wert: "", text: "diese Seite" }, { wert: "ja", text: "alle Seiten der Tafel" }] });
    return W.dialog({ titel: "Design der Seite", felder: felder, knopf: "Übernehmen" }).then(function (w) {
      if (!w) {
        hintergrundSetzen();
        return;
      }
      var bildId = w.bildWeg === "ja" ? null : s.hgBild || null;
      var weiter = Promise.resolve();
      if (w.bild) {
        weiter = bildVerkleinern(w.bild).then(function (r) {
          return S.mediumSpeichern(r.blob, w.bild.name).then(function (id) {
            bildId = id;
          });
        });
      }
      return weiter.then(function () {
        (w.alle ? tafel.seiten : [s]).forEach(function (x) {
          x.hintergrund = "eigen";
          x.hgFarbe = w.farbe || "#ffffff";
          x.hgMuster = w.muster || "";
          if (bildId) x.hgBild = bildId;
          else delete x.hgBild;
        });
        hintergrundSetzen();
        festhalten();
      }, fehlerMelden);
    });
  }

  function modusSetzen(neu) {
    modus = neu;
    document.body.dataset.modus = neu;
    tafelEl.classList.toggle("zeichnen", neu === "zeichnen");
    document.querySelectorAll("[data-modus]").forEach(function (k) {
      k.classList.toggle("aktiv", k.dataset.modus === neu);
      k.setAttribute("aria-pressed", String(k.dataset.modus === neu));
    });
    document.getElementById("p-zeichnen").classList.toggle("aktiv", neu === "zeichnen" && werkzeug !== "radierer");
    document.getElementById("p-radierer").classList.toggle("aktiv", neu === "zeichnen" && werkzeug === "radierer");
    if (neu === "zeichnen") {
      if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
      waehlen(null);
    }
    window.requestAnimationFrame(einpassen);
  }

  // ---------- Praesentieren ----------

  /** Naechste beim Praesentieren sichtbare Seite in Richtung schritt (ausgeblendete ueberspringen) */
  function sichtbareSeite(von, schritt) {
    for (var i = von + schritt; i >= 0 && i < tafel.seiten.length; i += schritt) {
      if (!tafel.seiten[i].ausgeblendet) return i;
    }
    return null;
  }

  function praesAnzeige() {
    var offen = animation ? animation.anzahl - animation.stand() : 0;
    document.getElementById("p-nummer").textContent = seiteNr + 1 + " / " + tafel.seiten.length;
    document.getElementById("p-titel").textContent = E.seitenTitel(seite(), seiteNr + 1) + (offen ? " · noch " + offen + (offen === 1 ? " Animation" : " Animationen") : "");
    document.getElementById("p-zurueck").disabled = sichtbareSeite(seiteNr, -1) === null && !(animation && animation.stand() > 0);
    document.getElementById("p-weiter").disabled = sichtbareSeite(seiteNr, 1) === null && !offen;
    referentAktualisieren();
  }

  function praesZu(nr, rueckwaerts) {
    if (nr === null || nr === seiteNr) return;
    zuSeite(nr);
    if (rueckwaerts && animation) {
      animation.alle();
      praesAnzeige();
    }
    E.uebergang(tafelEl, seite().uebergang, rueckwaerts);
  }

  /** Weiter wie in PowerPoint: zuerst die Animationen der Seite, dann die naechste Seite */
  function praesWeiter() {
    if (animation && animation.weiter()) {
      praesAnzeige();
      return;
    }
    praesZu(sichtbareSeite(seiteNr, 1), false);
  }

  function praesZurueck() {
    if (animation && animation.zurueck()) {
      praesAnzeige();
      return;
    }
    praesZu(sichtbareSeite(seiteNr, -1), true);
  }

  function praesentieren(an) {
    praesentiert = an;
    document.body.classList.toggle("praesentieren", an);
    document.getElementById("praes-leiste").hidden = !an;
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    waehlen(null);
    kontext.bearbeitbar = !an;
    kontext.eintragbar = an;
    laserSetzen(false);
    abdecken(null);
    if (an) {
      modusSetzen("bearbeiten");
      if (!W.vollbild.aktiv()) W.vollbild.an().then(vollbildKnopf);
      // Ausgeblendete Startseite ueberspringen
      if (seite().ausgeblendet) {
        var erste = sichtbareSeite(seiteNr, 1);
        if (erste === null) erste = sichtbareSeite(seiteNr, -1);
        if (erste !== null) seiteNr = erste;
      }
    } else {
      modusSetzen("bearbeiten");
      W.vollbild.aus();
      if (referent && !referent.closed) referent.close();
      referent = null;
    }
    seiteZeigen();
    vollbildKnopf();
    window.requestAnimationFrame(einpassen);
  }

  /** Vollbild waehrend der Praesentation ein- und ausschalten (bleibt praesentieren) */
  function vollbildWechseln() {
    if (W.vollbild.aktiv()) {
      vollbildVerlassen = !!W.vollbild.echt();
      W.vollbild.aus();
    } else W.vollbild.an().then(vollbildKnopf);
    vollbildKnopf();
  }

  function vollbildKnopf() {
    var k = document.getElementById("p-vollbild");
    var an = W.vollbild.aktiv();
    k.classList.toggle("aktiv", an);
    k.setAttribute("aria-pressed", String(an));
    k.title = an ? "Vollbild verlassen (F)" : "Vollbild (F)";
  }

  // ---------- Laserpointer und abgedunkelter Bildschirm ----------

  var laserAn = false;

  function laserSetzen(an) {
    laserAn = an;
    document.body.classList.toggle("mit-laser", an);
    document.getElementById("laser").hidden = true;
    var k = document.getElementById("p-laser");
    k.classList.toggle("aktiv", an);
    k.setAttribute("aria-pressed", String(an));
    if (an && modus === "zeichnen") modusSetzen("bearbeiten");
  }

  function laserBewegen(ev) {
    if (!laserAn) return;
    var punkt = document.getElementById("laser");
    punkt.hidden = !!ev.target.closest(".praes-leiste");
    punkt.style.left = ev.clientX + "px";
    punkt.style.top = ev.clientY + "px";
  }

  /** Schwarzer oder weisser Bildschirm (Taste B oder W wie in PowerPoint) */
  function abdecken(farbe) {
    var a = document.getElementById("abdeckung");
    a.hidden = !farbe;
    a.className = "abdeckung" + (farbe ? " abdeckung-" + farbe : "");
  }

  // ---------- Referentenansicht ----------

  var referentStart = 0;
  var referentTakt = null;
  var vorschauKontext = {
    bearbeitbar: false,
    druck: true,
    festhalten: function () {},
    speichern: function () {},
    mediumUrl: S.mediumUrl
  };

  /** Verkleinerte, ruhende Ansicht einer Seite */
  function seitenVorschau(s, breite) {
    var box = el("div", "ref-vorschau");
    var f = breite / BREITE;
    box.style.width = breite + "px";
    box.style.height = Math.round(HOEHE * f) + "px";
    var flaeche = el("div", "tafel");
    E.hintergrundAnwenden(flaeche, s, S.mediumUrl);
    flaeche.style.width = BREITE + "px";
    flaeche.style.height = HOEHE + "px";
    flaeche.style.transform = "scale(" + f + ")";
    var schicht = el("div", "ebene-elemente");
    s.elemente.forEach(function (e) {
      var teile = E.rahmenBauen(e, vorschauKontext);
      E.inhaltBauen(e, teile, vorschauKontext);
      schicht.appendChild(teile.knoten);
    });
    flaeche.appendChild(schicht);
    if (s.striche.length) {
      var lw = el("canvas", "ebene-zeichnung");
      lw.width = BREITE / 2;
      lw.height = HOEHE / 2;
      flaeche.appendChild(lw);
      E.stricheZeichnen(lw, s.striche);
    }
    box.appendChild(flaeche);
    return box;
  }

  function referentOeffnen() {
    if (referent && !referent.closed) {
      referent.focus();
      return;
    }
    var w = window.open("", "wandtafel-referent", "width=1180,height=720");
    if (!w) {
      W.melden("Das Fenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.", 7000);
      return;
    }
    referent = w;
    referentStart = Date.now();
    var d = w.document;
    // Mit Doctype, sonst rechnet das leere Fenster im Quirks-Modus
    d.open();
    d.write('<!doctype html><html lang="de-CH"><head><meta charset="utf-8"></head><body></body></html>');
    d.close();
    d.title = "Referentenansicht · " + tafel.titel;
    d.documentElement.lang = "de-CH";
    // Styles der Tafel uebernehmen (ohne neue Anfragen, Adressen in url() absolut)
    var css = "";
    Array.prototype.forEach.call(document.styleSheets, function (blatt) {
      try {
        Array.prototype.forEach.call(blatt.cssRules, function (regel) {
          css +=
            regel.cssText.replace(/url\((["']?)([^"')]+)\1\)/g, function (ganz, zeichen, adresse) {
              return /^(data:|blob:|https?:|#)/.test(adresse) ? ganz : 'url("' + new URL(adresse, blatt.href || window.location.href).href + '")';
            }) + "\n";
        });
      } catch (f) {
        /* Stylesheet nicht lesbar */
      }
    });
    var stil = d.createElement("style");
    stil.textContent = css;
    d.head.appendChild(stil);
    d.body.className = "referent-seite";
    d.body.textContent = "";
    var kopf = el("header", "ref-kopf");
    kopf.appendChild(el("strong", null, tafel.titel));
    var zeit = el("span", "ref-zeit");
    zeit.id = "ref-zeit";
    var neuStart = el("button", "knopf", "Zeit neu starten");
    neuStart.type = "button";
    neuStart.addEventListener("click", function () {
      referentStart = Date.now();
      referentUhr();
    });
    var uhr = el("span", "ref-uhr");
    uhr.id = "ref-uhr";
    [zeit, neuStart, uhr].forEach(function (x) {
      kopf.appendChild(x);
    });
    var haupt = el("main", "ref-haupt");
    var links = el("section", "ref-links");
    links.id = "ref-links";
    var rechts = el("section", "ref-rechts");
    rechts.id = "ref-rechts";
    haupt.appendChild(links);
    haupt.appendChild(rechts);
    var fuss = el("nav", "ref-fuss");
    var zurueck = el("button", "knopf", "‹ Zurück");
    zurueck.type = "button";
    zurueck.addEventListener("click", praesZurueck);
    var weiter = el("button", "knopf knopf-haupt", "Weiter ›");
    weiter.type = "button";
    weiter.addEventListener("click", praesWeiter);
    var ende = el("button", "knopf", "Präsentation beenden");
    ende.type = "button";
    ende.addEventListener("click", function () {
      praesentieren(false);
    });
    [zurueck, weiter, ende].forEach(function (x) {
      fuss.appendChild(x);
    });
    [kopf, haupt, fuss].forEach(function (x) {
      d.body.appendChild(x);
    });
    d.addEventListener("keydown", function (ev) {
      if (ev.key === "ArrowRight" || ev.key === "PageDown" || ev.key === " ") praesWeiter();
      else if (ev.key === "ArrowLeft" || ev.key === "PageUp") praesZurueck();
      else return;
      ev.preventDefault();
    });
    clearInterval(referentTakt);
    referentTakt = setInterval(function () {
      if (!referent || referent.closed) {
        clearInterval(referentTakt);
        return;
      }
      referentUhr();
    }, 1000);
    referentAktualisieren();
  }

  function referentUhr() {
    if (!referent || referent.closed) return;
    var d = referent.document;
    var sek = Math.floor((Date.now() - referentStart) / 1000);
    var jetzt = new Date();
    d.getElementById("ref-zeit").textContent = "Läuft seit " + (sek >= 3600 ? Math.floor(sek / 3600) + ":" : "") + W.zweistellig(Math.floor(sek / 60) % 60) + ":" + W.zweistellig(sek % 60);
    d.getElementById("ref-uhr").textContent = W.zweistellig(jetzt.getHours()) + ":" + W.zweistellig(jetzt.getMinutes());
  }

  function referentAktualisieren() {
    if (!referent || referent.closed || !praesentiert) return;
    var d = referent.document;
    var links = d.getElementById("ref-links");
    var rechts = d.getElementById("ref-rechts");
    if (!links) return;
    links.textContent = "";
    rechts.textContent = "";
    var info = "Seite " + (seiteNr + 1) + " von " + tafel.seiten.length;
    if (animation && animation.anzahl) info += " · Animation " + animation.stand() + " von " + animation.anzahl;
    links.appendChild(el("h2", null, info + ": " + E.seitenTitel(seite(), seiteNr + 1)));
    links.appendChild(seitenVorschau(seite(), 640));
    var naechste = sichtbareSeite(seiteNr, 1);
    rechts.appendChild(el("h2", null, naechste === null ? "Ende der Präsentation" : "Als Nächstes: Seite " + (naechste + 1)));
    if (naechste !== null) rechts.appendChild(seitenVorschau(tafel.seiten[naechste], 360));
    rechts.appendChild(el("h2", null, "Notizen"));
    var notizen = el("div", "ref-notizen", seite().notizen || "Keine Notizen zu dieser Seite.");
    notizen.classList.toggle("leer", !seite().notizen);
    rechts.appendChild(notizen);
    referentUhr();
  }

  // ---------- Notizen zur Seite ----------

  function notizenZeigen() {
    var feld = document.getElementById("notizen");
    if (document.activeElement !== feld) feld.value = seite().notizen || "";
  }

  // ---------- Einfuegen ----------

  function bildVerkleinern(datei) {
    return new Promise(function (ok) {
      var url = URL.createObjectURL(datei);
      var bild = new Image();
      bild.onload = function () {
        var max = 2400;
        var b = bild.naturalWidth;
        var h = bild.naturalHeight;
        if ((datei.size <= 1.5 * 1024 * 1024 && b <= max && h <= max) || /svg|gif/.test(datei.type)) {
          ok({ blob: datei, b: b, h: h });
          return;
        }
        var f = Math.min(1, max / Math.max(b, h));
        var c = document.createElement("canvas");
        c.width = Math.round(b * f);
        c.height = Math.round(h * f);
        var ctx = c.getContext("2d");
        var png = /png|webp/.test(datei.type) && datei.size < 4 * 1024 * 1024;
        if (!png) {
          ctx.fillStyle = "#fff";
          ctx.fillRect(0, 0, c.width, c.height);
        }
        ctx.drawImage(bild, 0, 0, c.width, c.height);
        c.toBlob(
          function (blob) {
            ok({ blob: blob || datei, b: c.width, h: c.height });
          },
          png ? "image/png" : "image/jpeg",
          0.88
        );
        URL.revokeObjectURL(url);
      };
      bild.onerror = function () {
        ok({ blob: datei, b: 640, h: 480 });
      };
      bild.src = url;
    });
  }

  /** Groesse fuer ein Bild oder Video mit Breite b und Hoehe h */
  function passendeLage(b, h, ort) {
    var breite = begrenzen(b || 640, 240, 720);
    var hoehe = Math.round((breite * (h || 360)) / (b || 640));
    if (hoehe > 640) {
      breite = Math.round((breite * 640) / hoehe);
      hoehe = 640;
    }
    var lage = { b: breite, h: Math.max(60, hoehe) + E.GRIFF };
    if (ort) {
      lage.x = ort.x - lage.b / 2;
      lage.y = ort.y - lage.h / 2;
    }
    return lage;
  }

  function bildEinfuegen(datei, ort) {
    if (!datei || !/^image\//.test(datei.type)) return Promise.resolve();
    return bildVerkleinern(datei)
      .then(function (r) {
        return S.mediumSpeichern(r.blob, datei.name).then(function (id) {
          hinzufuegen("bild", { medium: id, name: datei.name || "Bild" }, passendeLage(r.b, r.h, ort));
        });
      })
      .catch(function (f) {
        W.melden("Das Bild konnte nicht gespeichert werden: " + f.message, 6000);
      });
  }

  function videoEinfuegen(datei, ort) {
    if (!datei || !/^video\//.test(datei.type)) return Promise.resolve();
    var mb = datei.size / 1024 / 1024;
    var weiter = mb > 150 ? W.bestaetigen("Das Video ist " + Math.round(mb) + " MB gross. Grosse Videos füllen den Browserspeicher und machen Exporte sehr gross. Trotzdem einfügen?", "Einfügen") : Promise.resolve(true);
    return weiter.then(function (ja) {
      if (!ja) return;
      W.melden("Video wird gespeichert …");
      return S.mediumSpeichern(datei, datei.name).then(
        function (id) {
          hinzufuegen("video", { art: "datei", medium: id, name: datei.name, titel: datei.name.replace(/\.[^.]+$/, "") }, passendeLage(16, 9, ort));
          W.melden("Video eingefügt.");
        },
        function (f) {
          W.melden("Das Video konnte nicht gespeichert werden: " + f.message, 8000);
        }
      );
    });
  }

  function dateiEinfuegen(datei, ort) {
    if (!datei) return Promise.resolve();
    var mb = datei.size / 1024 / 1024;
    var weiter = mb > 100 ? W.bestaetigen("Die Datei ist " + Math.round(mb) + " MB gross. Grosse Dateien füllen den Browserspeicher und machen Exporte sehr gross. Trotzdem einfügen?", "Einfügen") : Promise.resolve(true);
    return weiter.then(function (ja) {
      if (!ja) return;
      return S.mediumSpeichern(datei, datei.name).then(
        function (id) {
          var lage = ort ? { x: ort.x - E.GROESSE.datei[0] / 2, y: ort.y - E.GROESSE.datei[1] / 2 } : null;
          hinzufuegen("datei", { medium: id, name: datei.name || "Datei", groesse: datei.size, mime: datei.type || "" }, lage);
        },
        function (f) {
          W.melden("Die Datei konnte nicht gespeichert werden: " + f.message, 8000);
        }
      );
    });
  }

  function adresseEinfuegen(url, wunsch, titel, mitQr) {
    url = E.snippetUrl(url);
    if (!url) return;
    if (!/^https?:\/\//i.test(url)) url = "https://" + url;
    var r = E.erkennen(url, wunsch);
    if (!r) {
      W.melden("Das ist keine gültige Adresse.");
      return;
    }
    if (titel) r.daten.titel = titel;
    if (wunsch === "bild" && r.typ !== "bild") {
      // Bild-Adresse ohne Dateiendung: trotzdem als Bild versuchen
      r = { typ: "bild", daten: { src: E.sicherUrl(url), titel: titel } };
    }
    if (r.typ === "bild") {
      var probe = new Image();
      probe.onload = function () {
        hinzufuegen("bild", r.daten, passendeLage(probe.naturalWidth, probe.naturalHeight));
      };
      probe.onerror = function () {
        hinzufuegen("bild", r.daten);
      };
      probe.src = r.daten.src;
      return;
    }
    if (r.typ === "video") {
      hinzufuegen("video", r.daten, passendeLage(16, 9));
      return;
    }
    if (r.typ === "link") {
      if (mitQr) r.daten.qr = true;
      hinzufuegen("link", r.daten, mitQr ? { b: 380, h: 440 } : null);
      return;
    }
    hinzufuegen("webseite", r.daten);
  }

  function neuesElement(typ) {
    if (typ === "bild") {
      W.dialog({
        titel: "Bild einfügen",
        felder: [
          { name: "datei", label: "Bild vom Gerät", typ: "file", accept: "image/*" },
          { name: "url", label: "oder Adresse eines Bildes im Internet", typ: "url", platzhalter: "https://…" },
          { typ: "hinweis", text: "Tipp: Bilder lassen sich auch mit Ctrl+V einfügen oder auf die Tafel ziehen." }
        ],
        knopf: "Einfügen"
      }).then(function (w) {
        if (!w) return;
        if (w.datei) bildEinfuegen(w.datei);
        else if (w.url) adresseEinfuegen(w.url, "bild");
      });
      return;
    }
    if (typ === "video") {
      W.dialog({
        titel: "Video einbinden",
        felder: [
          { name: "url", label: "Adresse (YouTube, Vimeo oder Videodatei .mp4/.webm)", typ: "url", platzhalter: "https://www.youtube.com/watch?v=…" },
          { name: "datei", label: "oder Videodatei vom Gerät", typ: "file", accept: "video/*" },
          { typ: "hinweis", text: "YouTube-Videos laufen über youtube-nocookie.com. Eine Startzeit in der Adresse (z. B. &t=90) wird übernommen." }
        ],
        knopf: "Einbinden"
      }).then(function (w) {
        if (!w) return;
        if (w.datei) videoEinfuegen(w.datei);
        else if (w.url) {
          var r = E.erkennen(/^https?:/i.test(w.url) ? w.url : "https://" + w.url);
          if (r && r.typ !== "video") W.melden("Kein Video erkannt, die Adresse wird als Webseite eingebunden.", 5000);
          adresseEinfuegen(w.url, "webseite");
        }
      });
      return;
    }
    if (typ === "datei") {
      W.dialog({
        titel: "Datei hochladen",
        felder: [
          { name: "datei", label: "Datei vom Gerät (PDF, Arbeitsblatt, Audio, …)", typ: "file", pflicht: true },
          { typ: "hinweis", text: "Die Datei erscheint als Karte mit Vorschau (Bilder, PDF, Audio) und lässt sich öffnen oder herunterladen. Dateien lassen sich auch auf die Tafel ziehen." }
        ],
        knopf: "Hochladen"
      }).then(function (w) {
        if (w && w.datei) dateiEinfuegen(w.datei);
      });
      return;
    }
    if (typ === "tabelle") {
      W.dialog({
        titel: "Tabelle einfügen",
        felder: [
          { name: "spalten", label: "Spalten", typ: "zahl", wert: 3 },
          { name: "zeilen", label: "Zeilen (mit Kopfzeile)", typ: "zahl", wert: 4 }
        ],
        knopf: "Einfügen"
      }).then(function (w) {
        if (!w) return;
        var spalten = begrenzen(parseInt(w.spalten, 10) || 3, 1, 12);
        var zeilen = begrenzen(parseInt(w.zeilen, 10) || 4, 1, 20);
        var zellen = [];
        for (var z = 0; z < zeilen; z++) {
          zellen.push([]);
          for (var sp = 0; sp < spalten; sp++) zellen[z].push("");
        }
        var k = hinzufuegen("tabelle", { zellen: zellen, kopf: true }, { b: begrenzen(spalten * 220, 300, 1500), h: Math.min(HOEHE, E.GRIFF + 16 + zeilen * 56) });
        var erste = k.querySelector("th, td");
        if (erste) erste.focus();
      });
      return;
    }
    if (typ === "webseite" || typ === "link") {
      var webseite = typ === "webseite";
      W.dialog({
        titel: webseite ? "Webseite einbetten" : "Link einfügen",
        felder: [
          webseite
            ? { name: "url", label: "Adresse oder iFrame-Snippet", typ: "textarea", platzhalter: "https://… oder <iframe src=\"…\"></iframe>", pflicht: true }
            : { name: "url", label: "Adresse", typ: "url", platzhalter: "https://…", pflicht: true },
          { name: "titel", label: "Titel (freiwillig)" },
          webseite
            ? { typ: "hinweis", text: "Die Seite erscheint direkt auf der Tafel. Einbett-Codes (iFrame-Snippets) von LearningApps, H5P, Padlet, Google und anderen werden erkannt. Manche Seiten verbieten das Einbetten; dann bleibt die Fläche leer. Über «Neuer Tab» öffnet sie sich trotzdem, oder du fügst sie als Link ein." }
            : { name: "qr", label: "QR-Code", typ: "select", optionen: [{ wert: "ja", text: "mit QR-Code (zum Scannen mit dem Handy)" }, { wert: "", text: "ohne QR-Code" }] }
        ],
        knopf: "Einfügen"
      }).then(function (w) {
        if (!w || !w.url) return;
        adresseEinfuegen(w.url, typ, w.titel, w.qr === "ja");
      });
      return;
    }
    var knoten = hinzufuegen(typ, {});
    var feld = knoten.querySelector(".textfeld, textarea");
    if (feld) feld.focus();
  }

  function bearbeitetGerade() {
    var a = document.activeElement;
    return a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName));
  }

  // ---------- Export und Import ----------

  function exportMenue(anker) {
    W.menue(anker, [
      {
        text: "HTML-Datei (offline präsentieren)",
        aktion: function () {
          jetztSpeichern()
            .then(function () {
              return X.htmlSpeichern(tafel);
            })
            .catch(fehlerMelden);
        }
      },
      {
        text: "PDF (Drucken, «Als PDF speichern»)",
        aktion: function () {
          jetztSpeichern()
            .then(function () {
              return X.pdfDrucken(tafel);
            })
            .catch(fehlerMelden);
        }
      },
      {
        text: "PowerPoint (.pptx)",
        aktion: function () {
          W.melden("PowerPoint-Datei wird erstellt …");
          jetztSpeichern()
            .then(function () {
              return W.Pptx.speichern(tafel);
            })
            .catch(fehlerMelden);
        }
      },
      {
        text: "Wandtafel-Datei (zum Weitergeben und Sichern)",
        aktion: function () {
          jetztSpeichern()
            .then(function () {
              return X.tafelPaket(tafel);
            })
            .then(function (p) {
              X.jsonSpeichern(p, tafel.titel);
            })
            .catch(fehlerMelden);
        }
      },
      { trenner: true },
      {
        text: "Seiten aus Datei oder PowerPoint hinzufügen …",
        aktion: function () {
          document.getElementById("import-datei").click();
        }
      }
    ]);
  }

  function fehlerMelden(f) {
    W.melden(f && f.message ? f.message : String(f), 7000);
  }

  /** Haengt die Seiten einer Wandtafel-Datei (oder exportierten HTML-Datei) an */
  function seitenImportieren(datei) {
    X.paketLesen(datei)
      .then(function (paket) {
        if (paket.art !== "tafel") throw new Error("Hier lassen sich nur einzelne Tafeln hinzufügen. Sammlungen auf der Übersicht importieren.");
        return X.medienSpeichern(paket.medien).then(function () {
          paket.tafel.seiten.forEach(function (s) {
            s.id = W.neueId("s");
            tafel.seiten.push(s);
          });
          var erste = tafel.seiten.length - paket.tafel.seiten.length;
          seiteNr = erste;
          seiteZeigen();
          festhalten();
          W.melden(paket.tafel.seiten.length + (paket.tafel.seiten.length === 1 ? " Seite" : " Seiten") + " aus «" + paket.tafel.titel + "» hinzugefügt.");
        });
      })
      .catch(fehlerMelden);
  }

  // ---------- Bedienung ----------

  function leisteEinrichten() {
    document.querySelectorAll("[data-icon]").forEach(function (k) {
      k.insertAdjacentHTML("afterbegin", W.icon(k.dataset.icon));
    });

    var hg = document.getElementById("hintergrund");
    E.hintergruende.forEach(function (h) {
      var o = el("option", null, h.text);
      o.value = h.wert;
      hg.appendChild(o);
    });

    document.querySelectorAll("[data-modus]").forEach(function (k) {
      k.addEventListener("click", function () {
        modusSetzen(k.dataset.modus);
      });
    });
    document.querySelectorAll("[data-neu]").forEach(function (k) {
      k.addEventListener("click", function () {
        neuesElement(k.dataset.neu);
      });
    });
    var formenKnopf = document.getElementById("formen-knopf");
    formenKnopf.addEventListener("click", function () {
      formenMenue(formenKnopf);
    });
    var layoutKnopf = document.getElementById("seite-layout");
    layoutKnopf.addEventListener("click", function () {
      layoutMenue(layoutKnopf);
    });
    var notizenFeld = document.getElementById("notizen");
    notizenFeld.addEventListener("input", function () {
      if (notizenFeld.value) seite().notizen = notizenFeld.value;
      else delete seite().notizen;
      speichern();
    });
    notizenFeld.addEventListener("change", festhalten);
    document.getElementById("notizen-knopf").addEventListener("click", function () {
      var bereich = document.getElementById("notizen-bereich");
      bereich.hidden = !bereich.hidden;
      this.classList.toggle("aktiv", !bereich.hidden);
      this.setAttribute("aria-pressed", String(!bereich.hidden));
      einpassen();
      if (!bereich.hidden) notizenFeld.focus();
    });
    var moduleKnopf = document.getElementById("module-knopf");
    moduleKnopf.addEventListener("click", function () {
      W.menue(
        moduleKnopf,
        MODULE.map(function (typ) {
          return {
            text: E.NAMEN[typ],
            aktion: function () {
              neuesElement(typ);
            }
          };
        })
      );
    });
    document.querySelectorAll("[data-werkzeug]").forEach(function (k) {
      k.addEventListener("click", function () {
        werkzeugSetzen(k.dataset.werkzeug);
      });
    });

    var farbenEl = document.getElementById("farben");
    FARBEN.forEach(function (f, i) {
      var k = el("button", "farbknopf" + (i === 0 ? " aktiv" : ""));
      k.type = "button";
      k.style.setProperty("--farbe", f);
      k.title = FARBNAMEN[i];
      k.setAttribute("aria-label", FARBNAMEN[i]);
      k.addEventListener("click", function () {
        farbe = f;
        if (werkzeug === "radierer") werkzeugSetzen("stift");
        farbenEl.querySelectorAll(".farbknopf").forEach(function (x) {
          x.classList.toggle("aktiv", x === k);
        });
      });
      farbenEl.appendChild(k);
    });
    var dickenEl = document.getElementById("dicken");
    DICKEN.forEach(function (d, i) {
      var k = el("button", "dickknopf" + (d === dicke ? " aktiv" : ""));
      k.type = "button";
      k.style.setProperty("--dicke", 4 + i * 4 + "px");
      k.title = ["Dünn", "Mittel", "Dick"][i];
      k.setAttribute("aria-label", k.title);
      k.addEventListener("click", function () {
        dicke = d;
        dickenEl.querySelectorAll(".dickknopf").forEach(function (x) {
          x.classList.toggle("aktiv", x === k);
        });
      });
      dickenEl.appendChild(k);
    });

    document.getElementById("zeichnung-loeschen").addEventListener("click", function () {
      if (!seite().striche.length) return;
      seite().striche = [];
      zeichnungNeu();
      festhalten();
      W.melden("Zeichnungen gelöscht. Rückgängig mit Ctrl+Z.");
    });
    hg.addEventListener("change", function () {
      if (hg.value === "eigen") {
        designBearbeiten();
        return;
      }
      seite().hintergrund = hg.value;
      hintergrundSetzen();
      festhalten();
    });
    document.getElementById("design-knopf").addEventListener("click", designBearbeiten);
    document.getElementById("rueckgaengig").addEventListener("click", function () {
      zurueckholen(-1);
    });
    document.getElementById("wiederholen").addEventListener("click", function () {
      zurueckholen(1);
    });
    document.getElementById("seiten-knopf").addEventListener("click", function () {
      var liste = document.getElementById("seitenliste");
      liste.hidden = !liste.hidden;
      this.classList.toggle("aktiv", !liste.hidden);
      einpassen();
    });
    document.getElementById("seite-neu").addEventListener("click", function () {
      seiteHinzufuegen();
    });
    var exportKnopf = document.getElementById("export-knopf");
    exportKnopf.addEventListener("click", function () {
      exportMenue(exportKnopf);
    });
    document.getElementById("praesentieren").addEventListener("click", function () {
      praesentieren(true);
    });

    // Praesentationsleiste
    document.getElementById("p-zurueck").addEventListener("click", praesZurueck);
    document.getElementById("p-weiter").addEventListener("click", praesWeiter);
    document.getElementById("p-laser").addEventListener("click", function () {
      laserSetzen(!laserAn);
    });
    document.getElementById("p-referent").addEventListener("click", referentOeffnen);
    document.getElementById("p-vollbild").addEventListener("click", vollbildWechseln);
    document.getElementById("abdeckung").addEventListener("click", function () {
      abdecken(null);
    });
    document.addEventListener("pointermove", laserBewegen);
    document.getElementById("p-zeichnen").addEventListener("click", function () {
      if (modus === "zeichnen" && werkzeug !== "radierer") modusSetzen("bearbeiten");
      else {
        werkzeugSetzen("stift");
        modusSetzen("zeichnen");
      }
    });
    document.getElementById("p-radierer").addEventListener("click", function () {
      if (modus === "zeichnen" && werkzeug === "radierer") modusSetzen("bearbeiten");
      else {
        werkzeugSetzen("radierer");
        modusSetzen("zeichnen");
      }
    });
    document.getElementById("p-rueckgaengig").addEventListener("click", function () {
      zurueckholen(-1);
    });
    document.getElementById("p-ende").addEventListener("click", function () {
      praesentieren(false);
    });

    var titel = document.getElementById("titel");
    titel.addEventListener("input", function () {
      tafel.titel = titel.value.trim() || "Ohne Titel";
      document.title = tafel.titel + " · Interaktive Wandtafel";
      speichern();
    });
    titel.addEventListener("keydown", function (ev) {
      if (ev.key === "Enter" || ev.key === "Escape") titel.blur();
    });

    document.getElementById("import-datei").addEventListener("change", function () {
      if (this.files[0]) seitenImportieren(this.files[0]);
      this.value = "";
    });
    document.getElementById("bild-datei").addEventListener("change", function () {
      if (this.files[0]) bildEinfuegen(this.files[0]);
      this.value = "";
    });
  }

  var sprungNr = "";
  var sprungTakt = null;
  var schiebenTakt = null;

  function tastenEinrichten() {
    document.addEventListener("keydown", function (ev) {
      if (document.querySelector("dialog[open]")) return;
      var strg = ev.ctrlKey || ev.metaKey;
      var taste = ev.key.toLowerCase();
      if (strg && !bearbeitetGerade() && taste === "z") {
        ev.preventDefault();
        zurueckholen(ev.shiftKey ? 1 : -1);
        return;
      }
      if (strg && !bearbeitetGerade() && taste === "y") {
        ev.preventDefault();
        zurueckholen(1);
        return;
      }
      if (strg && !bearbeitetGerade() && taste === "d" && gewaehlt && !praesentiert) {
        ev.preventDefault();
        duplizieren(finden(gewaehlt));
        return;
      }
      if (bearbeitetGerade()) {
        if (ev.key === "Escape") document.activeElement.blur();
        return;
      }
      if (strg || ev.altKey) return;
      if (praesentiert) {
        // Schwarzer/weisser Bildschirm: jede Taste zeigt die Seite wieder
        if (!document.getElementById("abdeckung").hidden) {
          abdecken(null);
          ev.preventDefault();
          return;
        }
        // Leertaste und Enter auf einem Knopf loesen nur den Knopf aus
        if ((ev.key === " " || ev.key === "Enter") && ev.target.closest && ev.target.closest("button")) return;
        // Seitennummer tippen und Enter: direkt zu dieser Seite (wie in PowerPoint)
        if (/^[0-9]$/.test(ev.key)) {
          sprungNr += ev.key;
          clearTimeout(sprungTakt);
          sprungTakt = setTimeout(function () {
            sprungNr = "";
          }, 2500);
          ev.preventDefault();
          return;
        }
        if (ev.key === "Enter" && sprungNr) {
          var ziel = parseInt(sprungNr, 10) - 1;
          sprungNr = "";
          if (ziel >= 0 && ziel < tafel.seiten.length) praesZu(ziel, ziel < seiteNr);
        } else if (ev.key === "ArrowRight" || ev.key === "ArrowDown" || ev.key === "PageDown" || ev.key === " " || ev.key === "Enter") praesWeiter();
        else if (ev.key === "ArrowLeft" || ev.key === "ArrowUp" || ev.key === "PageUp" || ev.key === "Backspace") praesZurueck();
        else if (ev.key === "Home") praesZu(sichtbareSeite(-1, 1), true);
        else if (ev.key === "End") praesZu(sichtbareSeite(tafel.seiten.length, -1), false);
        else if (taste === "z") document.getElementById("p-zeichnen").click();
        else if (taste === "l") laserSetzen(!laserAn);
        else if (taste === "b" || ev.key === ".") abdecken("schwarz");
        else if (taste === "w" || ev.key === ",") abdecken("weiss");
        else if (taste === "r") referentOeffnen();
        else if (taste === "f") vollbildWechseln();
        else if (ev.key === "Escape") praesentieren(false);
        else return;
        ev.preventDefault();
        return;
      }
      // Gewaehltes Element mit den Pfeiltasten verschieben (Shift: grosse Schritte)
      var richtung = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[ev.key];
      if (richtung && gewaehlt && modus === "bearbeiten") {
        var e = finden(gewaehlt);
        if (e) {
          ev.preventDefault();
          var schritt = ev.shiftKey ? 20 : 2;
          e.x = Math.round(begrenzen(e.x + richtung[0] * schritt, -e.b + 60, BREITE - 60));
          e.y = Math.round(begrenzen(e.y + richtung[1] * schritt, 0, HOEHE - 40));
          E.lage(knotenVon(e.id), e);
          clearTimeout(schiebenTakt);
          schiebenTakt = setTimeout(festhalten, 500);
          return;
        }
      }
      if ((ev.key === "Delete" || ev.key === "Backspace") && gewaehlt) {
        ev.preventDefault();
        entfernen(gewaehlt);
      } else if (taste === "z") {
        modusSetzen(modus === "zeichnen" ? "bearbeiten" : "zeichnen");
      } else if (taste === "p") {
        praesentieren(true);
      } else if (ev.key === "PageDown") {
        zuSeite(seiteNr + 1);
      } else if (ev.key === "PageUp") {
        zuSeite(seiteNr - 1);
      } else if (ev.key === "Escape") {
        waehlen(null);
        modusSetzen("bearbeiten");
      }
    });

    // Beim Verlassen des Vollbilds mit Esc auch die Praesentation beenden.
    // Nicht bei offener Referentenansicht: Chrome verlaesst das Vollbild schon beim Oeffnen des Fensters.
    // Auf iPad und iPhone endet das Vollbild auch durch Wischen oder die Tastatur:
    // dort im Pseudo-Vollbild weiter praesentieren.
    W.vollbild.beiWechsel(function () {
      if (!W.vollbild.echt() && praesentiert && !vollbildVerlassen) {
        if (W.IOS) W.vollbild.pseudo(true);
        else if (!(referent && !referent.closed)) praesentieren(false);
      }
      vollbildVerlassen = false;
      vollbildKnopf();
      einpassen();
    });

    // Gewaehltes Element kopieren oder ausschneiden (Ctrl+C, Ctrl+X), auch auf andere Seiten und Tafeln
    function kopieren(ev, ausschneiden) {
      if (bearbeitetGerade() || praesentiert || !gewaehlt || document.querySelector("dialog[open]")) return;
      if (String(window.getSelection() || "")) return;
      var e = finden(gewaehlt);
      if (!e || !ev.clipboardData) return;
      ev.preventDefault();
      ev.clipboardData.setData(KOPIE_TYP, JSON.stringify(e));
      ev.clipboardData.setData("text/plain", e.daten.text || e.daten.url || E.NAMEN[e.typ]);
      if (ausschneiden) entfernen(e.id);
      else W.melden("Element kopiert. Mit Ctrl+V einfügen, auch auf einer anderen Seite.");
    }
    document.addEventListener("copy", function (ev) {
      kopieren(ev, false);
    });
    document.addEventListener("cut", function (ev) {
      kopieren(ev, true);
    });

    // Einfuegen aus der Zwischenablage: Element, Bild, Adresse oder Text
    document.addEventListener("paste", function (ev) {
      if (bearbeitetGerade() || praesentiert || document.querySelector("dialog[open]")) return;
      var daten = ev.clipboardData;
      if (!daten) return;
      var kopie = daten.getData(KOPIE_TYP);
      if (kopie) {
        ev.preventDefault();
        elementEinfuegen(kopie);
        return;
      }
      for (var i = 0; i < daten.items.length; i++) {
        if (/^image\//.test(daten.items[i].type)) {
          ev.preventDefault();
          bildEinfuegen(daten.items[i].getAsFile());
          return;
        }
      }
      var text = (daten.getData("text/plain") || "").trim();
      if (!text) return;
      ev.preventDefault();
      if (/^https?:\/\/\S+$/i.test(text) || /^<iframe[\s>]/i.test(text)) adresseEinfuegen(text, "webseite");
      else hinzufuegen("text", { text: text });
    });

    // Bilder, Videos und Wandtafel-Dateien auf die Tafel ziehen
    rahmen.addEventListener("dragover", function (ev) {
      ev.preventDefault();
    });
    rahmen.addEventListener("drop", function (ev) {
      ev.preventDefault();
      if (praesentiert) return;
      var ort = tafelPunkt(ev);
      var dateien = ev.dataTransfer && ev.dataTransfer.files;
      if (dateien && dateien.length) {
        Array.prototype.forEach.call(dateien, function (d) {
          if (/^image\//.test(d.type)) bildEinfuegen(d, ort);
          else if (/^video\//.test(d.type)) videoEinfuegen(d, ort);
          else if (/\.wandtafel\.json$/i.test(d.name) || /\.(html?|pptx)$/i.test(d.name)) seitenImportieren(d);
          else dateiEinfuegen(d, ort);
        });
        return;
      }
      var url = ev.dataTransfer && (ev.dataTransfer.getData("text/uri-list") || ev.dataTransfer.getData("text/plain"));
      if (url && /^https?:\/\//i.test(url.trim())) adresseEinfuegen(url.trim().split(/\s/)[0], "webseite");
    });

    // Klick auf die leere Tafel hebt die Auswahl auf
    tafelEl.addEventListener("pointerdown", function (ev) {
      if (ev.target === tafelEl || ev.target === ebene) {
        waehlen(null);
        if (bearbeitetGerade()) document.activeElement.blur();
      }
    });

    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden" && speicherTakt) jetztSpeichern();
    });
    window.addEventListener("pagehide", function () {
      if (speicherTakt) jetztSpeichern();
    });
  }

  // ---------- Start ----------

  function ortAnzeigen() {
    return S.sammlung().then(function (sammlung) {
      var ort = document.getElementById("ort");
      sammlung.faecher.forEach(function (f) {
        f.kapitel.forEach(function (k) {
          if (k.tafeln.indexOf(tafel.id) !== -1) {
            ort.textContent = W.ortText(f, k);
            ort.href = "index.html#fach=" + encodeURIComponent(f.id) + (W.jahrVon(f, k) ? "&jahr=" + encodeURIComponent(k.jahr) : "");
            document.getElementById("zur-uebersicht").href = ort.href;
          }
        });
      });
    });
  }

  function fehlerSeite(text) {
    document.body.innerHTML = "";
    var box = el("main", "fehler-seite");
    box.appendChild(el("h1", null, "Tafel nicht gefunden"));
    box.appendChild(el("p", null, text));
    var a = el("a", "knopf knopf-haupt", "Zur Übersicht");
    a.href = "index.html";
    box.appendChild(a);
    document.body.appendChild(box);
  }

  function starten() {
    tafelEl.style.width = BREITE + "px";
    tafelEl.style.height = HOEHE + "px";
    leisteEinrichten();
    if (!tafelId) {
      fehlerSeite("Es wurde keine Tafel angegeben. Tafeln werden auf der Übersicht in einem Kapitel angelegt.");
      return;
    }
    S.tafel(tafelId)
      .then(function (t) {
        if (!S.gueltigeTafel(t)) {
          fehlerSeite("Diese Tafel gibt es in diesem Browser nicht (mehr). Tafeln liegen nur auf dem Gerät, auf dem sie angelegt wurden. Zum Weitergeben «Exportieren» verwenden.");
          return;
        }
        tafel = t;
        var nr = parseInt(parameter.get("seite"), 10);
        seiteNr = nr > 0 ? begrenzen(nr - 1, 0, tafel.seiten.length - 1) : 0;
        document.getElementById("titel").value = tafel.titel;
        document.title = tafel.titel + " · Interaktive Wandtafel";
        zeichnenEinrichten();
        tastenEinrichten();
        modusSetzen("bearbeiten");
        seiteZeigen();
        festhalten();
        verlaufKnoepfe();
        einpassen();
        window.addEventListener("resize", einpassen);
        ortAnzeigen();
        if (parameter.get("praesentieren") === "1") {
          // Vollbild verlangt einen Klick; ohne Klick nur die Ansicht wechseln
          praesentieren(true);
        }
        S.dauerhaft();
      })
      .catch(function (f) {
        fehlerSeite(f.message);
      });
  }

  // Fuer den Browsertest
  window.WandtafelEditor = {
    tafel: function () {
      return tafel;
    },
    seite: function () {
      return seiteNr + 1;
    },
    speichern: function () {
      return jetztSpeichern();
    },
    adresseEinfuegen: adresseEinfuegen,
    elementEinfuegen: elementEinfuegen,
    weiter: praesWeiter,
    zurueck: praesZurueck,
    animation: function () {
      return animation ? { anzahl: animation.anzahl, stand: animation.stand() } : null;
    },
    referent: function () {
      return referent;
    },
    bildEinfuegen: bildEinfuegen,
    videoEinfuegen: videoEinfuegen,
    dateiEinfuegen: dateiEinfuegen
  };

  starten();
})();
