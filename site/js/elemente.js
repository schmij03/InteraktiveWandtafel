/*
 * Elemente der Tafel und Zeichnungen. Wird von der Tafel (bearbeiten und
 * praesentieren) und von der exportierten Ansicht (nur ansehen, drucken) benutzt.
 *
 * Eine Seite ist eine feste Flaeche von 1600 x 900 Punkten. Jedes Element hat
 * Lage (x, y, b, h, z), einen Typ und typabhaengige Daten.
 *
 * kontext = {
 *   bearbeitbar  Texte und Einstellungen aenderbar
 *   eintragbar   nur Texte und Tabellen ausfuellen (beim Praesentieren)
 *   druck        fuer den Druck: Webseiten und Videos als Platzhalter
 *   festhalten() Aenderung fuer Rueckgaengig festhalten und speichern
 *   speichern()  nur speichern (z. B. waehrend dem Tippen)
 *   mediumUrl(id) -> Promise mit Adresse eines hochgeladenen Bildes oder Videos
 * }
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var el = W.el;
  var knopf = W.knopf;
  var begrenzen = W.begrenzen;
  var zweistellig = W.zweistellig;

  var BREITE = 1600;
  var HOEHE = 900;
  var GRIFF = 44;

  var NOTIZFARBEN = ["#fff3a8", "#ffd6e0", "#d4f1d6", "#d6ecfb", "#ffe1c2"];
  var TEXTFARBEN = ["#1f2933", "#065a82", "#e4572e", "#2e7d32", "#7b3fa0", "#ffffff"];

  var GROESSE = {
    text: [520, 170],
    notiz: [320, 280],
    bild: [480, 380],
    video: [720, 449],
    webseite: [900, 600],
    link: [520, 170],
    timer: [400, 300],
    stoppuhr: [400, 260],
    zufall: [440, 380],
    gruppen: [620, 440],
    wuerfel: [360, 280],
    uhr: [360, 420],
    ampel: [220, 500],
    sozialform: [460, 380],
    datei: [440, 340],
    form: [360, 240],
    tabelle: [720, 284]
  };

  var NAMEN = {
    text: "Text",
    notiz: "Notiz",
    bild: "Bild",
    video: "Video",
    webseite: "Webseite",
    link: "Link",
    timer: "Timer",
    stoppuhr: "Stoppuhr",
    zufall: "Lostopf",
    gruppen: "Gruppen",
    wuerfel: "Würfel",
    uhr: "Uhr",
    ampel: "Ampel",
    sozialform: "Sozialform",
    datei: "Datei",
    form: "Form",
    tabelle: "Tabelle"
  };

  var SOZIALFORMEN = [
    { wert: "einzel", text: "Einzelarbeit", icon: '<circle cx="12" cy="7" r="3.5"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/>' },
    { wert: "partner", text: "Partnerarbeit", icon: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.5 2.6-6 6-6 1.5 0 2.9.5 4 1.4 1.1-.9 2.5-1.4 4-1.4 3.4 0 6 2.5 6 6"/>' },
    { wert: "gruppe", text: "Gruppenarbeit", icon: '<circle cx="12" cy="6" r="2.6"/><circle cx="5.5" cy="10" r="2.4"/><circle cx="18.5" cy="10" r="2.4"/><path d="M7 21c0-3 2.2-5.5 5-5.5s5 2.5 5 5.5M1 20c0-2.6 1.8-4.6 4.5-4.6M23 20c0-2.6-1.8-4.6-4.5-4.6"/>' },
    { wert: "plenum", text: "Plenum", icon: '<path d="M4 5h16v9H9l-5 4z"/><path d="M8 9h8"/>' }
  ];

  // ---------- Wie in PowerPoint: Formen, Schriften, Animationen, Uebergaenge ----------

  function sternPunkte() {
    var p = [];
    for (var i = 0; i < 10; i++) {
      var r = i % 2 ? 19 : 50;
      var w = ((-90 + i * 36) * Math.PI) / 180;
      p.push(Math.round((50 + r * Math.cos(w)) * 10) / 10 + "," + Math.round((53 + r * Math.sin(w)) * 10) / 10);
    }
    return p.join(" ");
  }

  // Formen in einem Feld von 100 x 100, auf die Groesse des Elements gestreckt.
  // innen: Textbereich [oben, rechts, unten, links] in Prozent; pptx: Vorlage in PowerPoint
  var FORMEN = [
    { wert: "rechteck", text: "Rechteck", pptx: "rect", innen: [4, 4, 4, 4], svg: '<rect width="100" height="100"/>' },
    { wert: "abgerundet", text: "Abgerundetes Rechteck", pptx: "roundRect", innen: [6, 6, 6, 6], svg: '<rect width="100" height="100" rx="12" ry="12" data-rund=""/>' },
    { wert: "ellipse", text: "Ellipse / Kreis", pptx: "ellipse", innen: [15, 15, 15, 15], svg: '<ellipse cx="50" cy="50" rx="50" ry="50"/>' },
    { wert: "dreieck", text: "Dreieck", pptx: "triangle", innen: [45, 22, 4, 22], svg: '<polygon points="50,0 100,100 0,100"/>' },
    { wert: "raute", text: "Raute", pptx: "diamond", innen: [25, 25, 25, 25], svg: '<polygon points="50,0 100,50 50,100 0,50"/>' },
    { wert: "sechseck", text: "Sechseck", pptx: "hexagon", innen: [6, 20, 6, 20], svg: '<polygon points="25,0 75,0 100,50 75,100 25,100 0,50"/>' },
    { wert: "pfeil", text: "Pfeil", pptx: "rightArrow", innen: [28, 30, 28, 4], svg: '<polygon points="0,28 62,28 62,0 100,50 62,100 62,72 0,72"/>' },
    { wert: "stern", text: "Stern", pptx: "star5", innen: [38, 30, 24, 30], svg: '<polygon points="' + sternPunkte() + '"/>' },
    { wert: "sprechblase", text: "Sprechblase", pptx: "wedgeRectCallout", innen: [4, 4, 32, 4], svg: '<path d="M0 0H100V72H38L18 100L22 72H0Z"/>' }
  ];
  var FORM_STANDARD = { fuellung: "#d6ecfb", rand: "#065a82", randDicke: 3 };

  /**
   * Runde Ecken auch bei breiten Formen: Die Zeichnung wird auf die Form gestreckt, darum
   * rx und ry getrennt. rundung = Radius als Anteil der kürzeren Seite (wie in PowerPoint).
   */
  function formEcken(knoten, e) {
    var r = e.typ === "form" && knoten.querySelector(".form-bild rect[data-rund]");
    if (!r || !e.b || !e.h) return;
    var radius = Math.min(e.b, e.h) * (e.daten.rundung != null ? e.daten.rundung : 0.12);
    r.setAttribute("rx", (radius / e.b) * 100);
    r.setAttribute("ry", (radius / e.h) * 100);
  }

  function formVon(wert) {
    for (var i = 0; i < FORMEN.length; i++) if (FORMEN[i].wert === wert) return FORMEN[i];
    return FORMEN[0];
  }

  // Schriftarten; die Standardschrift ist Calibri bzw. Carlito (gleich breit)
  var SCHRIFTEN = [
    { wert: "", text: "Calibri (Standard)", css: "", pptx: "Calibri" },
    { wert: "serif", text: "Georgia (mit Serifen)", css: 'Georgia, "Times New Roman", serif', pptx: "Georgia" },
    { wert: "schreib", text: "Handschrift", css: '"Comic Sans MS", "Chalkboard SE", "Segoe Print", cursive', pptx: "Comic Sans MS" },
    { wert: "mono", text: "Schreibmaschine", css: 'Menlo, Consolas, "Courier New", monospace', pptx: "Courier New" }
  ];

  function schriftVon(wert) {
    for (var i = 0; i < SCHRIFTEN.length; i++) if (SCHRIFTEN[i].wert === (wert || "")) return SCHRIFTEN[i];
    return SCHRIFTEN[0];
  }

  // Animationen: Elemente erscheinen beim Praesentieren nacheinander
  var EFFEKTE = [
    { wert: "einblenden", text: "Verblassen (einblenden)" },
    { wert: "fliegen", text: "Hineinfliegen (von unten)" },
    { wert: "zoomen", text: "Zoomen" },
    { wert: "wischen", text: "Wischen (von links)" }
  ];

  // Folienuebergaenge beim Wechsel auf eine Seite
  var UEBERGAENGE = [
    { wert: "", text: "Ohne Übergang" },
    { wert: "blenden", text: "Verblassen" },
    { wert: "schieben", text: "Schieben" },
    { wert: "wischen", text: "Wischen" },
    { wert: "kreis", text: "Kreis" }
  ];

  function standardGroesse(typ) {
    return typ === "notiz" || typ === "form" ? 28 : typ === "tabelle" ? 24 : 32;
  }

  /** Schrift, Grösse, Farbe, Stil, Ausrichtung und Liste auf ein Textfeld anwenden */
  function textStil(feld, e) {
    var d = e.daten;
    feld.style.fontSize = (d.groesse || standardGroesse(e.typ)) + "px";
    feld.style.fontWeight = d.fett ? "700" : "";
    feld.style.fontStyle = d.kursiv ? "italic" : "";
    feld.style.textDecoration = d.unterstrichen ? "underline" : "";
    feld.style.textAlign = d.ausrichtung || (e.typ === "form" ? "center" : "");
    feld.style.fontFamily = schriftVon(d.schrift).css;
    if (d.farbe && e.typ !== "notiz") feld.style.color = d.farbe;
    feld.classList.toggle("liste-punkte", d.liste === "punkte");
    feld.classList.toggle("liste-nummern", d.liste === "nummern");
  }

  // ---------- Formatierter Text ----------
  // daten.laeufe: [{ t, fett, kursiv, unterstrichen, farbe, groesse, schrift }], nur mit den
  // Abweichungen vom Format des ganzen Elements. Zusammen ergeben die t genau daten.text;
  // sonst (Text anderswo geaendert) gelten sie nicht.

  var LAUF_STIL = ["fett", "kursiv", "unterstrichen", "farbe", "groesse", "schrift"];

  function laeufeVon(d) {
    var l = d.laeufe;
    if (!Array.isArray(l) || !l.length) return null;
    var ganz = l
      .map(function (x) {
        return x && typeof x.t === "string" ? x.t : "";
      })
      .join("");
    return ganz === String(d.text || "") ? l : null;
  }

  function laufFormat(lauf) {
    var f = {};
    LAUF_STIL.forEach(function (k) {
      if (lauf[k] != null && lauf[k] !== "") f[k] = lauf[k];
    });
    return f;
  }

  /** Ein Stueck Text, mit Format als Span (das Format steht auch in data-lauf) */
  function laufKnoten(text, lauf) {
    var f = laufFormat(lauf);
    if (!Object.keys(f).length) return document.createTextNode(text);
    var s = el("span", null, text);
    s.dataset.lauf = JSON.stringify(f);
    if (f.fett != null) s.style.fontWeight = f.fett ? "700" : "400";
    if (f.kursiv != null) s.style.fontStyle = f.kursiv ? "italic" : "normal";
    if (f.unterstrichen != null) s.style.textDecoration = f.unterstrichen ? "underline" : "none";
    if (f.farbe) s.style.color = f.farbe;
    if (f.groesse) s.style.fontSize = f.groesse + "px";
    if (f.schrift) s.style.fontFamily = schriftVon(f.schrift).css;
    return s;
  }

  /**
   * Nach dem Format-Dialog: Was dort geaendert wurde, gilt fuer das ganze Feld. Stellen und
   * Zellen mit eigenem Format uebernehmen es (Grössen im gleichen Verhaeltnis).
   */
  function formatFuerAlle(e, vorher) {
    var d = e.daten;
    var geaendert = Object.keys(vorher).filter(function (k) {
      return String(vorher[k] || "") !== String(d[k] || "");
    });
    var l = laeufeVon(d);
    if (l) {
      l.forEach(function (x) {
        geaendert.forEach(function (k) {
          if (k === "groesse" && x.groesse) x.groesse = Math.max(8, Math.round((x.groesse * d.groesse) / vorher.groesse));
          else if (k !== "groesse") delete x[k];
        });
      });
      if (!l.some(function (x) { return Object.keys(laufFormat(x)).length; })) delete d.laeufe;
    }
    (d.stile || []).forEach(function (zeile) {
      (zeile || []).forEach(function (st) {
        if (!st) return;
        geaendert.forEach(function (k) {
          if (["farbe", "fett", "kursiv", "unterstrichen", "ausrichtung"].indexOf(k) !== -1) st[k] = d[k];
        });
      });
    });
  }

  /** Format einer Tabellenzelle: { fuellung, farbe, fett, kursiv, unterstrichen, ausrichtung } */
  function zellStil(zelle, st) {
    if (!st) return;
    if (st.fuellung) zelle.style.background = st.fuellung;
    if (st.farbe) zelle.style.color = st.farbe;
    if (st.fett != null) zelle.style.fontWeight = st.fett ? "700" : "400";
    if (st.kursiv) zelle.style.fontStyle = "italic";
    if (st.unterstrichen) zelle.style.textDecoration = "underline";
    if (st.ausrichtung) zelle.style.textAlign = st.ausrichtung;
  }

  /** Text einsetzen; bei Listen jede Zeile als eigener Absatz */
  function textSetzen(feld, d) {
    feld.textContent = "";
    var text = String(d.text || "");
    if (!text) return;
    var laeufe = laeufeVon(d);
    if (!laeufe && !d.liste) {
      feld.textContent = text;
      return;
    }
    var zeilen = [[]];
    (laeufe || [{ t: text }]).forEach(function (lauf) {
      lauf.t.split("\n").forEach(function (stueck, i) {
        if (i) zeilen.push([]);
        if (stueck) zeilen[zeilen.length - 1].push(laufKnoten(stueck, lauf));
      });
    });
    // Jede Zeile als Absatz; eine Zeile nur mit kleinerer Schrift bekommt auch die kleinere Zeilenhoehe
    zeilen.forEach(function (teile) {
      var absatz = el("div");
      if (!teile.length) absatz.appendChild(el("br"));
      var groessen = teile.map(function (k) {
        return k.style ? parseFloat(k.style.fontSize) : NaN;
      });
      if (teile.length && groessen.every(isFinite)) absatz.style.fontSize = Math.min.apply(null, groessen) + "px";
      teile.forEach(function (k) {
        absatz.appendChild(k);
      });
      feld.appendChild(absatz);
    });
  }

  /** Nach dem Schreiben: das Format jedes Zeichens aus den Spans zuruecklesen */
  function laeufeLesen(feld, text) {
    var folge = [];
    var gang = document.createTreeWalker(feld, NodeFilter.SHOW_TEXT);
    for (var n = gang.nextNode(); n; n = gang.nextNode()) {
      var span = n.parentNode.closest("[data-lauf]");
      var f = span && feld.contains(span) ? span.dataset.lauf : "";
      for (var i = 0; i < n.data.length; i++) folge.push({ z: n.data[i], f: f });
    }
    // Leerzeichen und geschuetzte Leerzeichen gelten als gleich, Zeilenumbrueche nur untereinander
    var leer = /[^\S\n]/;
    var laeufe = [];
    var pos = 0;
    var vorher = "";
    for (var j = 0; j < text.length; j++) {
      var z = text[j];
      // Zeilenumbrueche fehlen in Listen zwischen den Absaetzen, sie gehoeren zum Text davor
      for (var k = pos; k < Math.min(folge.length, pos + 4); k++) {
        if (folge[k].z === z || (leer.test(folge[k].z) && leer.test(z))) {
          if (z !== "\n") vorher = folge[k].f;
          pos = k + 1;
          break;
        }
      }
      var letzter = laeufe[laeufe.length - 1];
      if (letzter && letzter.f === vorher) letzter.t += z;
      else laeufe.push({ t: z, f: vorher });
    }
    if (!laeufe.some(function (l) { return l.f; })) return null;
    return laeufe.map(function (l) {
      var lauf = l.f ? JSON.parse(l.f) : {};
      lauf.t = l.t;
      return lauf;
    });
  }

  /** Format fuer das ganze Feld geaendert: die Stellen mit eigenem Format anpassen */
  function laeufeAnpassen(e, feld, arbeit) {
    var l = laeufeVon(e.daten);
    if (!l) return;
    l.forEach(arbeit);
    if (!l.some(function (x) { return Object.keys(laufFormat(x)).length; })) delete e.daten.laeufe;
    textSetzen(feld, e.daten);
  }

  /**
   * Animationen einer Seite beim Praesentieren. Elemente mit Animation sind zuerst
   * versteckt; weiter() zeigt die naechste Stufe (gleiche Nummer = gleichzeitig).
   */
  function animationen(ebene, seite) {
    var stufen = [];
    seite.elemente.forEach(function (e) {
      if (e.anim && e.anim.effekt && stufen.indexOf(e.anim.nr || 1) === -1) stufen.push(e.anim.nr || 1);
    });
    stufen.sort(function (a, b) {
      return a - b;
    });
    var pos = 0;
    function jede(nr, arbeit) {
      seite.elemente.forEach(function (e) {
        if (!e.anim || !e.anim.effekt || (e.anim.nr || 1) !== nr) return;
        var k = ebene.querySelector('[data-id="' + e.id + '"]');
        if (k) arbeit(k, e.anim.effekt);
      });
    }
    function verstecken(nr) {
      jede(nr, function (k, effekt) {
        k.classList.remove("anim-" + effekt);
        k.classList.add("anim-wartet");
      });
    }
    function zeigen(nr, mitEffekt) {
      jede(nr, function (k, effekt) {
        k.classList.remove("anim-wartet");
        if (mitEffekt) k.classList.add("anim-" + effekt);
      });
    }
    stufen.forEach(verstecken);
    return {
      anzahl: stufen.length,
      stand: function () {
        return pos;
      },
      weiter: function () {
        if (pos >= stufen.length) return false;
        zeigen(stufen[pos++], true);
        return true;
      },
      zurueck: function () {
        if (pos <= 0) return false;
        verstecken(stufen[--pos]);
        return true;
      },
      alle: function () {
        while (pos < stufen.length) zeigen(stufen[pos++], false);
      }
    };
  }

  /** Spielt den Uebergang einer Seite auf der Flaeche ab */
  function uebergang(flaeche, art, rueckwaerts) {
    UEBERGAENGE.forEach(function (u) {
      if (u.wert) flaeche.classList.remove("ueb-" + u.wert);
    });
    flaeche.classList.remove("rueckwaerts");
    if (!art) return;
    void flaeche.offsetWidth;
    flaeche.classList.add("ueb-" + art);
    flaeche.classList.toggle("rueckwaerts", !!rueckwaerts);
    flaeche.addEventListener("animationend", function ende(ev) {
      if (ev.target !== flaeche) return;
      flaeche.classList.remove("ueb-" + art, "rueckwaerts");
      flaeche.removeEventListener("animationend", ende);
    });
  }

  // ---------- Adressen erkennen ----------

  function sicherUrl(url) {
    try {
      var u = new URL(url, window.location.href);
      return /^https?:$/.test(u.protocol) ? u.href : null;
    } catch (e) {
      return null;
    }
  }

  function youtube(url) {
    var m = String(url).match(/(?:youtube(?:-nocookie)?\.com\/(?:watch\?(?:.*&)?v=|embed\/|shorts\/|live\/|v\/)|youtu\.be\/)([\w-]{11})/);
    if (!m) return null;
    var start = 0;
    var t = String(url).match(/[?&#](?:t|start)=(?:(\d+)h)?(?:(\d+)m)?(\d+)s?/);
    if (t) start = (parseInt(t[1] || 0, 10) * 60 + parseInt(t[2] || 0, 10)) * 60 + parseInt(t[3] || 0, 10);
    return { id: m[1], start: start };
  }

  function vimeo(url) {
    var m = String(url).match(/vimeo\.com\/(?:video\/)?(\d{6,})/);
    return m ? m[1] : null;
  }

  /**
   * Was steckt hinter einer Adresse? Liefert { typ, daten } fuer ein neues Element:
   * YouTube und Vimeo werden Video, Bild- und Videodateien Bild oder Video, alles andere Webseite.
   */
  function erkennen(url, wunsch) {
    url = sicherUrl(url);
    if (!url) return null;
    var yt = youtube(url);
    if (yt) return { typ: "video", daten: { art: "youtube", url: url, id: yt.id, start: yt.start } };
    var vi = vimeo(url);
    if (vi) return { typ: "video", daten: { art: "vimeo", url: url, id: vi } };
    var pfad = url.split(/[?#]/)[0];
    if (/\.(mp4|webm|ogv|ogg|mov|m4v)$/i.test(pfad)) return { typ: "video", daten: { art: "datei", url: url } };
    if (/\.(png|jpe?g|gif|webp|svg|avif|bmp)$/i.test(pfad)) return { typ: "bild", daten: { src: url } };
    return { typ: wunsch === "link" ? "link" : "webseite", daten: { url: url } };
  }

  /** Adresse aus einem iFrame-Snippet (<iframe src="…">) holen, sonst den Text selbst */
  function snippetUrl(text) {
    text = String(text || "").trim();
    var m = text.match(/<iframe[^>]*\ssrc\s*=\s*["']([^"']+)["']/i);
    return m ? m[1].replace(/&amp;/g, "&") : text;
  }

  /** QR-Code einer Adresse als SVG (benoetigt qrcode.js) */
  function qrSvg(text) {
    if (!window.qrcode) return "";
    window.qrcode.stringToBytes = window.qrcode.stringToBytesFuncs["UTF-8"];
    var qr = window.qrcode(0, "M");
    qr.addData(String(text));
    qr.make();
    var n = qr.getModuleCount();
    var pfad = "";
    for (var y = 0; y < n; y++) {
      for (var x = 0; x < n; x++) if (qr.isDark(y, x)) pfad += "M" + (x + 2) + " " + (y + 2) + "h1v1h-1z";
    }
    return (
      '<svg viewBox="0 0 ' + (n + 4) + " " + (n + 4) + '" shape-rendering="crispEdges" role="img" aria-label="QR-Code"><rect width="100%" height="100%" fill="#fff"/><path d="' + pfad + '" fill="#000"/></svg>'
    );
  }

  function dateiGroesse(bytes) {
    if (!bytes) return "";
    if (bytes < 1024 * 1024) return Math.max(1, Math.round(bytes / 1024)) + " KB";
    return (bytes / 1024 / 1024).toFixed(1).replace(".", ",") + " MB";
  }

  /** Bekannte Seiten in ihre Einbett-Adresse umschreiben */
  function einbettUrl(url) {
    var u;
    try {
      u = new URL(url);
    } catch (e) {
      return url;
    }
    // Google Docs, Slides, Sheets: Vorschau statt Bearbeiten
    if (/docs\.google\.com$/.test(u.hostname) && /\/(edit|view)$/.test(u.pathname)) {
      return u.origin + u.pathname.replace(/\/(edit|view)$/, "/preview");
    }
    // LearningApps
    if (/learningapps\.org$/.test(u.hostname)) {
      var la = url.match(/learningapps\.org\/(?:watch\?v=|view)?([\w]+)$/);
      if (la && !/^display/.test(u.pathname.slice(1))) return "https://learningapps.org/watch?v=" + la[1];
    }
    return url;
  }

  // ---------- Hilfen ----------

  var laufend = {}; // Anzeige-Intervalle von Timer, Stoppuhr und Uhr pro Element

  // Zustand von Timer und Stoppuhr pro Element. Bleibt beim Neuaufbau erhalten
  // (Seitenwechsel, Praesentieren beenden, Vollbild verlassen); laufende Timer
  // rechnen mit der Endzeit und melden sich auch, wenn sie gerade nicht zu sehen sind.
  var zustand = {};

  /** Haelt nur die Anzeige an; ein laufender Timer laeuft weiter */
  function stoppen(id) {
    if (laufend[id]) {
      clearInterval(laufend[id]);
      delete laufend[id];
    }
  }

  function alleStoppen() {
    Object.keys(laufend).forEach(stoppen);
  }

  /** Element ist weg: Anzeige und Zustand (auch den Wecker des Timers) aufgeben */
  function vergessen(id) {
    stoppen(id);
    if (zustand[id]) clearTimeout(zustand[id].wecker);
    delete zustand[id];
  }

  function zeitText(sekunden) {
    sekunden = Math.max(0, Math.ceil(sekunden));
    return zweistellig(Math.floor(sekunden / 60)) + ":" + zweistellig(sekunden % 60);
  }

  function namenListe(text) {
    return String(text || "")
      .split(/[\n,;]+/)
      .map(function (n) {
        return n.trim();
      })
      .filter(Boolean);
  }

  function mischen(liste) {
    var a = liste.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function signal() {
    try {
      var Ton = window.AudioContext || window.webkitAudioContext;
      var ton = new Ton();
      [0, 0.35, 0.7].forEach(function (t) {
        var osz = ton.createOscillator();
        var laut = ton.createGain();
        osz.frequency.value = 880;
        laut.gain.setValueAtTime(0.25, ton.currentTime + t);
        laut.gain.exponentialRampToValueAtTime(0.001, ton.currentTime + t + 0.3);
        osz.connect(laut).connect(ton.destination);
        osz.start(ton.currentTime + t);
        osz.stop(ton.currentTime + t + 0.3);
      });
    } catch (e) {
      /* ohne Ton */
    }
  }

  function wKnopf(text, haupt) {
    var k = el("button", "w-knopf" + (haupt ? " w-haupt" : ""), text);
    k.type = "button";
    return k;
  }

  /** Knopf in der Griffleiste vorne einfuegen (nur beim Bearbeiten) */
  function werkzeug(werkzeuge, iconName, titel, aktion) {
    if (!werkzeuge) return null;
    var k = knopf("g-knopf", iconName, titel);
    k.addEventListener("click", aktion);
    werkzeuge.insertBefore(k, werkzeuge.firstChild);
    return k;
  }

  function host(url) {
    try {
      return new URL(url).host.replace(/^www\./, "");
    } catch (e) {
      return url || "";
    }
  }

  /** Ersatz fuer Webseiten und Videos im Druck */
  function platzhalter(koerper, iconName, titel, url, bild) {
    var p = el("div", "platzhalter");
    if (bild) {
      var img = el("img");
      img.src = bild;
      img.alt = "";
      p.appendChild(img);
    }
    var text = el("div", "platzhalter-text");
    text.insertAdjacentHTML("beforeend", W.icon(iconName));
    text.appendChild(el("strong", null, titel));
    if (url) text.appendChild(el("span", null, url));
    p.appendChild(text);
    koerper.appendChild(p);
  }

  // ---------- Rahmen ----------

  /** Baut den Rahmen eines Elements: Griffleiste (mit Werkzeugen beim Bearbeiten) und Inhalt */
  function rahmenBauen(e, kontext) {
    var knoten = el("div", "element element-" + e.typ + (e.daten && e.daten.titel ? " mit-titel" : ""));
    knoten.dataset.id = e.id;
    lage(knoten, e);
    var griff = el("div", "griff");
    griff.appendChild(el("span", "griff-name", (e.daten && e.daten.titel) || NAMEN[e.typ] || e.typ));
    var werkzeuge = null;
    if (kontext.bearbeitbar) {
      werkzeuge = el("span", "griff-werkzeuge");
      griff.appendChild(werkzeuge);
    }
    knoten.appendChild(griff);
    var koerper = el("div", "koerper");
    knoten.appendChild(koerper);
    if (kontext.bearbeitbar && e.anim && e.anim.effekt) {
      var marke = el("span", "anim-marke", String(e.anim.nr || 1));
      marke.title = "Animation " + (e.anim.nr || 1) + ": erscheint beim Präsentieren nacheinander";
      knoten.appendChild(marke);
    }
    if (!kontext.druck) {
      // Spotlight: Element gross ueber der ganzen Seite zeigen (auch beim Praesentieren)
      var spot = knopf("spot-knopf", "vollbild", "Im Spotlight zeigen (Esc schliesst)");
      spot.addEventListener("click", function () {
        spotlight(knoten, !knoten.classList.contains("im-spotlight"));
      });
      knoten.appendChild(spot);
    }
    return { knoten: knoten, griff: griff, werkzeuge: werkzeuge, koerper: koerper };
  }

  /** Zeigt ein Element gross ueber der Seite oder stellt es zurueck (wird nicht gespeichert) */
  function spotlight(knoten, an) {
    var ebene = knoten.parentNode;
    if (!ebene) return;
    ebene.querySelectorAll(".im-spotlight").forEach(function (k) {
      k.classList.remove("im-spotlight");
      var s = k.querySelector(".spot-knopf");
      if (s) s.innerHTML = W.icon("vollbild");
    });
    knoten.classList.toggle("im-spotlight", an);
    ebene.classList.toggle("hat-spotlight", an);
    var knopfSpot = knoten.querySelector(".spot-knopf");
    if (knopfSpot) {
      knopfSpot.innerHTML = W.icon(an ? "schliessen" : "vollbild");
      knopfSpot.title = an ? "Spotlight schliessen (Esc)" : "Im Spotlight zeigen (Esc schliesst)";
    }
    if (an && !ebene.dataset.spotHoert) {
      ebene.dataset.spotHoert = "1";
      ebene.addEventListener("pointerdown", function (ev) {
        if (ev.target === ebene && ebene.classList.contains("hat-spotlight")) spotlightSchliessen();
      });
    }
  }

  /** Schliesst ein offenes Spotlight; liefert true, wenn eines offen war */
  function spotlightSchliessen() {
    var k = document.querySelector(".im-spotlight");
    if (!k) return false;
    spotlight(k, false);
    return true;
  }

  window.addEventListener(
    "keydown",
    function (ev) {
      if (ev.key === "Escape" && !document.querySelector("dialog[open]") && spotlightSchliessen()) {
        ev.preventDefault();
        ev.stopPropagation();
      }
    },
    true
  );

  function lage(knoten, e) {
    knoten.style.left = e.x + "px";
    knoten.style.top = e.y + "px";
    knoten.style.width = e.b + "px";
    knoten.style.height = e.h + "px";
    knoten.style.zIndex = e.z;
    // Formen und Texte haben die Griffleiste oberhalb; ganz oben auf der Seite innen
    if (e.typ === "form" || e.typ === "text") knoten.classList.toggle("griff-innen", e.y < GRIFF);
    formEcken(knoten, e);
  }

  /** Fuellt den Inhalt eines Elements */
  function inhaltBauen(e, teile, kontext) {
    var bauer = INHALT[e.typ];
    if (bauer) bauer(e, teile.koerper, teile.werkzeuge, teile.knoten, kontext);
    else teile.koerper.appendChild(el("p", "platzhalter-text", "Unbekanntes Element: " + e.typ));
  }

  /** Bearbeitbarer Text (reiner Text, eigenes Format einzelner Stellen in Spans) */
  function textFeld(e, koerper, platzhalterText, kontext) {
    var feld = el("div", "textfeld");
    feld.dataset.platzhalter = kontext.bearbeitbar ? platzhalterText : "";
    textSetzen(feld, e.daten);
    textStil(feld, e);
    if (kontext.bearbeitbar || kontext.eintragbar) {
      feld.contentEditable = "true";
      feld.spellcheck = false;
      feld.addEventListener("paste", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var text = (ev.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
      feld.addEventListener("input", function () {
        // Listen: auch die erste Zeile als Absatz, damit sie ein Aufzaehlungszeichen bekommt
        if (e.daten.liste && feld.firstChild && feld.firstChild.nodeType === 3) document.execCommand("formatBlock", false, "div");
        e.daten.text = feld.innerText.replace(/\n$/, "");
        if (e.daten.laeufe) {
          var laeufe = laeufeLesen(feld, e.daten.text);
          if (laeufe) e.daten.laeufe = laeufe;
          else delete e.daten.laeufe;
        }
        kontext.speichern();
      });
      feld.addEventListener("blur", kontext.festhalten);
    }
    koerper.appendChild(feld);
    return feld;
  }

  function schriftWerkzeuge(e, werkzeuge, feld, kontext, mitFarbe) {
    if (!werkzeuge) return;
    function aendern(schritt) {
      var alt = e.daten.groesse || standardGroesse(e.typ);
      e.daten.groesse = begrenzen(alt + schritt, 14, 200);
      feld.style.fontSize = e.daten.groesse + "px";
      // Stellen mit eigener Grösse wachsen im gleichen Verhaeltnis mit
      laeufeAnpassen(e, feld, function (x) {
        if (x.groesse) x.groesse = Math.max(8, Math.round((x.groesse * e.daten.groesse) / alt));
      });
      kontext.festhalten();
    }
    if (mitFarbe) {
      werkzeug(werkzeuge, "farbe", "Textfarbe wechseln", function () {
        var i = TEXTFARBEN.indexOf(e.daten.farbe || TEXTFARBEN[0]);
        e.daten.farbe = TEXTFARBEN[(i + 1) % TEXTFARBEN.length];
        feld.style.color = e.daten.farbe;
        laeufeAnpassen(e, feld, function (x) {
          delete x.farbe;
        });
        kontext.festhalten();
      });
    }
    werkzeug(werkzeuge, "fett", "Fett", function () {
      e.daten.fett = !e.daten.fett;
      feld.style.fontWeight = e.daten.fett ? "700" : "";
      laeufeAnpassen(e, feld, function (x) {
        delete x.fett;
      });
      kontext.festhalten();
    });
    werkzeug(werkzeuge, "groesser", "Schrift grösser", function () {
      aendern(4);
    });
    werkzeug(werkzeuge, "kleiner", "Schrift kleiner", function () {
      aendern(-4);
    });
  }

  var AUGEN = {
    1: [5],
    2: [1, 9],
    3: [1, 5, 9],
    4: [1, 3, 7, 9],
    5: [1, 3, 5, 7, 9],
    6: [1, 3, 4, 6, 7, 9]
  };

  function wuerfelBild(zahl) {
    var w = el("div", "wuerfel");
    w.setAttribute("role", "img");
    w.setAttribute("aria-label", "Würfel zeigt " + zahl);
    for (var i = 1; i <= 9; i++) {
      var feld = el("span");
      if (AUGEN[zahl].indexOf(i) !== -1) feld.className = "auge";
      w.appendChild(feld);
    }
    return w;
  }

  function quelle(daten, kontext, setzen) {
    if (daten.medium) {
      kontext.mediumUrl(daten.medium).then(function (url) {
        setzen(url || "");
      });
    } else setzen(daten.src || daten.url || "");
  }

  // ---------- Inhalte der Elementtypen ----------

  var INHALT = {
    text: function (e, koerper, werkzeuge, knoten, kontext) {
      var feld = textFeld(e, koerper, e.daten.platzhalter || "Text eingeben …", kontext);
      schriftWerkzeuge(e, werkzeuge, feld, kontext, true);
    },

    notiz: function (e, koerper, werkzeuge, knoten, kontext) {
      if (!e.daten.farbe) e.daten.farbe = NOTIZFARBEN[0];
      knoten.style.setProperty("--notiz", e.daten.farbe);
      var feld = textFeld(e, koerper, "Notiz …", kontext);
      schriftWerkzeuge(e, werkzeuge, feld, kontext, false);
      werkzeug(werkzeuge, "farbe", "Farbe wechseln", function () {
        var i = NOTIZFARBEN.indexOf(e.daten.farbe);
        e.daten.farbe = NOTIZFARBEN[(i + 1) % NOTIZFARBEN.length];
        knoten.style.setProperty("--notiz", e.daten.farbe);
        kontext.festhalten();
      });
    },

    bild: function (e, koerper, werkzeuge, knoten, kontext) {
      var bild = el("img");
      bild.alt = e.daten.name || "Bild";
      bild.draggable = false;
      quelle(e.daten, kontext, function (url) {
        bild.src = url;
      });
      koerper.appendChild(bild);
    },

    video: function (e, koerper, werkzeuge, knoten, kontext) {
      var d = e.daten;
      if (kontext.druck) {
        var vorschau = d.art === "youtube" ? "https://img.youtube.com/vi/" + d.id + "/hqdefault.jpg" : null;
        platzhalter(koerper, "video", d.titel || "Video", d.url || (d.name ? "Datei: " + d.name : ""), vorschau);
        return;
      }
      if (d.art === "youtube" || d.art === "vimeo") {
        var f = el("iframe");
        f.src =
          d.art === "youtube"
            ? "https://www.youtube-nocookie.com/embed/" + d.id + "?rel=0" + (d.start ? "&start=" + d.start : "")
            : "https://player.vimeo.com/video/" + d.id + "?dnt=1";
        f.title = d.titel || "Video";
        f.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
        f.allowFullscreen = true;
        f.referrerPolicy = "strict-origin-when-cross-origin";
        f.loading = "lazy";
        koerper.appendChild(f);
        return;
      }
      var v = el("video");
      v.controls = true;
      v.preload = "metadata";
      v.playsInline = true;
      quelle(d, kontext, function (url) {
        v.src = url;
      });
      koerper.appendChild(v);
    },

    webseite: function (e, koerper, werkzeuge, knoten, kontext) {
      var url = sicherUrl(e.daten.url);
      if (kontext.druck || !url) {
        platzhalter(koerper, "webseite", e.daten.titel || host(url) || "Webseite", url || "");
        return;
      }
      var f = el("iframe");
      f.src = einbettUrl(url);
      f.title = e.daten.titel || "Webseite " + host(url);
      f.setAttribute("sandbox", "allow-scripts allow-same-origin allow-forms allow-popups allow-popups-to-escape-sandbox allow-presentation allow-modals");
      f.allow = "fullscreen; autoplay; encrypted-media; clipboard-write";
      f.allowFullscreen = true;
      f.referrerPolicy = "strict-origin-when-cross-origin";
      f.loading = "lazy";
      koerper.appendChild(f);
      var leiste = el("div", "web-leiste");
      leiste.appendChild(el("span", "web-host", host(url)));
      var neu = knopf("web-knopf", "neuladen", "Neu laden");
      neu.addEventListener("click", function () {
        f.src = einbettUrl(url);
      });
      var tab = el("a", "web-knopf");
      tab.href = url;
      tab.target = "_blank";
      tab.rel = "noopener noreferrer";
      tab.title = "In neuem Tab öffnen (falls die Seite leer bleibt)";
      tab.innerHTML = W.icon("neuertab");
      tab.appendChild(el("span", null, "Neuer Tab"));
      leiste.appendChild(neu);
      leiste.appendChild(tab);
      koerper.appendChild(leiste);
    },

    link: function (e, koerper, werkzeuge, knoten, kontext) {
      var url = sicherUrl(e.daten.url);
      var karte = el("div", "link-karte" + (e.daten.qr && url ? " mit-qr" : ""));
      if (e.daten.qr && url) {
        var qr = el("div", "qr-bild");
        qr.innerHTML = qrSvg(url);
        karte.appendChild(qr);
      }
      var a = el("a", null, e.daten.titel || url || "Link");
      if (url) {
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      karte.appendChild(a);
      if (url) karte.appendChild(el("small", null, host(url)));
      koerper.appendChild(karte);
      var qrKnopf = werkzeug(werkzeuge, "qr", e.daten.qr ? "QR-Code ausblenden" : "QR-Code anzeigen", function () {
        e.daten.qr = !e.daten.qr;
        // Mit QR-Code braucht die Karte Platz
        if (e.daten.qr && e.h < 420) {
          e.h = 420;
          e.b = Math.max(e.b, 360);
          lage(knoten, e);
        }
        koerper.innerHTML = "";
        INHALT.link(e, koerper, null, knoten, kontext);
        qrKnopf.title = e.daten.qr ? "QR-Code ausblenden" : "QR-Code anzeigen";
        qrKnopf.setAttribute("aria-label", qrKnopf.title);
        kontext.festhalten();
      });
    },

    timer: function (e, koerper, werkzeuge, knoten, kontext) {
      if (!e.daten.sekunden) e.daten.sekunden = 300;
      // z.ende: Endzeit, solange er laeuft; sonst z.rest in Sekunden
      var z = zustand[e.id] || (zustand[e.id] = { rest: e.daten.sekunden, ende: 0, wecker: null });
      function rest() {
        return z.ende ? Math.max(0, (z.ende - Date.now()) / 1000) : z.rest;
      }
      var anzeige = el("div", "gross-zahl", zeitText(rest()));
      var balken = el("div", "zeit-balken");
      var fuellung = el("span");
      balken.appendChild(fuellung);
      var vorgaben = el("div", "widget-knoepfe timer-vorgaben");
      [5, 10, 15].forEach(function (min) {
        var k = wKnopf(min + " min");
        k.addEventListener("click", function () {
          einstellen(min * 60);
        });
        vorgaben.appendChild(k);
      });
      var eigen = wKnopf("Andere Zeit");
      vorgaben.appendChild(eigen);
      var formular = el("div", "widget-knoepfe timer-eigen");
      formular.hidden = true;
      var minuten = el("input");
      minuten.type = "number";
      minuten.min = "0";
      minuten.max = "99";
      minuten.setAttribute("aria-label", "Minuten");
      var sekunden = el("input");
      sekunden.type = "number";
      sekunden.min = "0";
      sekunden.max = "59";
      sekunden.setAttribute("aria-label", "Sekunden");
      var ok = wKnopf("OK", true);
      formular.appendChild(minuten);
      formular.appendChild(el("span", null, "min"));
      formular.appendChild(sekunden);
      formular.appendChild(el("span", null, "s"));
      formular.appendChild(ok);
      var knoepfe = el("div", "widget-knoepfe");
      var start = wKnopf("Start", true);
      var neu = wKnopf("Zurücksetzen");
      knoepfe.appendChild(start);
      knoepfe.appendChild(neu);
      koerper.appendChild(anzeige);
      koerper.appendChild(balken);
      koerper.appendChild(knoepfe);
      koerper.appendChild(vorgaben);
      koerper.appendChild(formular);

      function zeichnen() {
        var r = rest();
        anzeige.textContent = zeitText(r);
        fuellung.style.width = Math.min(1, r / e.daten.sekunden) * 100 + "%";
        koerper.classList.toggle("abgelaufen", r <= 0);
        start.textContent = z.ende ? "Pause" : "Start";
      }
      function anzeigen() {
        stoppen(e.id);
        if (!z.ende || kontext.druck) return;
        laufend[e.id] = setInterval(function () {
          // Element nicht mehr auf der Seite: nur die Anzeige anhalten
          if (!koerper.isConnected) stoppen(e.id);
          else zeichnen();
        }, 200);
      }
      function anhalten() {
        if (z.ende) z.rest = rest();
        z.ende = 0;
        clearTimeout(z.wecker);
        if (!kontext.druck) stoppen(e.id);
        zeichnen();
      }
      start.addEventListener("click", function () {
        if (z.ende) {
          anhalten();
          return;
        }
        if (z.rest <= 0) z.rest = e.daten.sekunden;
        z.ende = Date.now() + z.rest * 1000;
        z.wecker = setTimeout(function () {
          z.ende = 0;
          z.rest = 0;
          signal();
          // Die gerade sichtbare Anzeige dieses Timers nachfuehren
          var k = document.querySelector('.element[data-id="' + e.id + '"] .koerper');
          if (k && k.timerZeichnen) k.timerZeichnen();
        }, z.rest * 1000);
        anzeigen();
        zeichnen();
      });
      if (!kontext.druck) koerper.timerZeichnen = zeichnen;
      function einstellen(sek) {
        anhalten();
        e.daten.sekunden = begrenzen(Math.round(sek), 1, 99 * 60 + 59);
        z.rest = e.daten.sekunden;
        formular.hidden = true;
        zeichnen();
        kontext.festhalten();
      }
      eigen.addEventListener("click", function () {
        formular.hidden = !formular.hidden;
        minuten.value = Math.floor(e.daten.sekunden / 60);
        sekunden.value = e.daten.sekunden % 60;
        if (!formular.hidden) minuten.focus();
      });
      ok.addEventListener("click", function () {
        einstellen((parseInt(minuten.value, 10) || 0) * 60 + (parseInt(sekunden.value, 10) || 0));
      });
      formular.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter") ok.click();
      });
      neu.addEventListener("click", function () {
        anhalten();
        z.rest = e.daten.sekunden;
        zeichnen();
      });
      zeichnen();
      anzeigen();
    },

    stoppuhr: function (e, koerper, werkzeuge, knoten, kontext) {
      // z.seit: Startzeit, solange sie laeuft; z.vorher: schon gemessene Millisekunden
      var z = zustand[e.id] || (zustand[e.id] = { vorher: 0, seit: 0 });
      var anzeige = el("div", "gross-zahl", "00:00.0");
      var knoepfe = el("div", "widget-knoepfe");
      var start = wKnopf("Start", true);
      var neu = wKnopf("Zurück");
      knoepfe.appendChild(start);
      knoepfe.appendChild(neu);
      koerper.appendChild(anzeige);
      koerper.appendChild(knoepfe);
      function zeichnen() {
        var ms = z.vorher + (z.seit ? Date.now() - z.seit : 0);
        var s = Math.floor(ms / 1000);
        anzeige.textContent = zweistellig(Math.floor(s / 60)) + ":" + zweistellig(s % 60) + "." + Math.floor((ms % 1000) / 100);
        start.textContent = z.seit ? "Pause" : "Start";
      }
      function anzeigen() {
        stoppen(e.id);
        if (!z.seit || kontext.druck) return;
        laufend[e.id] = setInterval(function () {
          if (!koerper.isConnected) stoppen(e.id);
          else zeichnen();
        }, 100);
      }
      start.addEventListener("click", function () {
        if (z.seit) {
          z.vorher += Date.now() - z.seit;
          z.seit = 0;
        } else z.seit = Date.now();
        anzeigen();
        zeichnen();
      });
      neu.addEventListener("click", function () {
        z.vorher = 0;
        z.seit = 0;
        anzeigen();
        zeichnen();
      });
      zeichnen();
      anzeigen();
    },

    zufall: function (e, koerper, werkzeuge, knoten, kontext) {
      if (e.daten.namen == null) e.daten.namen = "";
      if (!e.daten.gezogen) e.daten.gezogen = [];
      if (e.daten.ohne == null) e.daten.ohne = true;
      koerper.innerHTML = "";

      if (!namenListe(e.daten.namen).length || e.daten.bearbeiten) {
        var feld = el("textarea", "namen-feld");
        feld.placeholder = "Ein Los pro Zeile, zum Beispiel Namen";
        feld.value = e.daten.namen;
        var zeile = el("label", "widget-option");
        var ohne = el("input");
        ohne.type = "checkbox";
        ohne.checked = e.daten.ohne;
        zeile.appendChild(ohne);
        zeile.appendChild(document.createTextNode(" Gezogene Lose nicht zurücklegen"));
        var fertig = wKnopf("Lose in den Topf geben", true);
        fertig.addEventListener("click", function () {
          e.daten.namen = feld.value;
          e.daten.ohne = ohne.checked;
          e.daten.gezogen = [];
          e.daten.bearbeiten = false;
          kontext.festhalten();
          INHALT.zufall(e, koerper, werkzeuge, knoten, kontext);
        });
        koerper.appendChild(feld);
        koerper.appendChild(zeile);
        var knoepfe = el("div", "widget-knoepfe");
        knoepfe.appendChild(fertig);
        koerper.appendChild(knoepfe);
        return;
      }

      var namen = namenListe(e.daten.namen);
      var anzeige = el("div", "zufall-name", e.daten.letzter || "?");
      var info = el("div", "widget-info");
      var knoepfe2 = el("div", "widget-knoepfe");
      var ziehen = wKnopf("Los ziehen", true);
      var neu = wKnopf("Alle zurück in den Topf");
      var liste = wKnopf("Lose");
      [ziehen, neu, liste].forEach(function (k) {
        knoepfe2.appendChild(k);
      });
      function infoZeigen() {
        info.textContent = e.daten.ohne ? namen.length - e.daten.gezogen.length + " von " + namen.length + " Losen im Topf" : namen.length + " Lose";
      }
      ziehen.addEventListener("click", function () {
        var offen = e.daten.ohne
          ? namen.filter(function (n) {
              return e.daten.gezogen.indexOf(n) === -1;
            })
          : namen;
        if (!offen.length) {
          anzeige.textContent = "Der Topf ist leer!";
          return;
        }
        var wahl = offen[Math.floor(Math.random() * offen.length)];
        var runden = 0;
        ziehen.disabled = true;
        var takt = setInterval(function () {
          anzeige.textContent = namen[Math.floor(Math.random() * namen.length)];
          if (++runden >= 12) {
            clearInterval(takt);
            anzeige.textContent = wahl;
            ziehen.disabled = false;
            e.daten.letzter = wahl;
            if (e.daten.ohne) e.daten.gezogen.push(wahl);
            infoZeigen();
            kontext.festhalten();
          }
        }, 60);
      });
      neu.addEventListener("click", function () {
        e.daten.gezogen = [];
        e.daten.letzter = "";
        anzeige.textContent = "?";
        infoZeigen();
        kontext.festhalten();
      });
      liste.addEventListener("click", function () {
        e.daten.bearbeiten = true;
        INHALT.zufall(e, koerper, werkzeuge, knoten, kontext);
      });
      koerper.appendChild(anzeige);
      koerper.appendChild(info);
      koerper.appendChild(knoepfe2);
      infoZeigen();
    },

    gruppen: function (e, koerper, werkzeuge, knoten, kontext) {
      if (e.daten.namen == null) e.daten.namen = "";
      if (!e.daten.groesse) e.daten.groesse = 3;
      koerper.innerHTML = "";

      if (!e.daten.gruppen || e.daten.bearbeiten) {
        var feld = el("textarea", "namen-feld");
        feld.placeholder = "Namen, einer pro Zeile";
        feld.value = e.daten.namen;
        var zeile = el("div", "widget-option");
        var art = el("select", "w-wahl");
        art.setAttribute("aria-label", "Bedingung für Gruppenmischung");
        [
          ["groesse", "Gruppengrösse"],
          ["anzahl", "Anzahl Gruppen"]
        ].forEach(function (o) {
          var opt = el("option", null, o[1]);
          opt.value = o[0];
          art.appendChild(opt);
        });
        art.value = e.daten.nach || "groesse";
        var zahl = el("input");
        zahl.type = "number";
        zahl.min = "2";
        zahl.max = "20";
        zahl.setAttribute("aria-label", "Zahl");
        zahl.value = art.value === "anzahl" ? e.daten.gruppenzahl || 4 : e.daten.groesse;
        art.addEventListener("change", function () {
          zahl.value = art.value === "anzahl" ? e.daten.gruppenzahl || 4 : e.daten.groesse;
        });
        zeile.appendChild(art);
        zeile.appendChild(zahl);
        var bilden = wKnopf("Gruppen bilden", true);
        bilden.addEventListener("click", function () {
          e.daten.namen = feld.value;
          e.daten.nach = art.value;
          if (art.value === "anzahl") e.daten.gruppenzahl = begrenzen(parseInt(zahl.value, 10) || 4, 2, 20);
          else e.daten.groesse = begrenzen(parseInt(zahl.value, 10) || 3, 2, 20);
          var namen = mischen(namenListe(e.daten.namen));
          if (namen.length < 2) {
            W.melden("Mindestens zwei Namen eingeben.");
            return;
          }
          var anzahl =
            e.daten.nach === "anzahl"
              ? Math.min(namen.length, e.daten.gruppenzahl)
              : Math.max(1, Math.round(namen.length / e.daten.groesse));
          var gruppen = [];
          for (var i = 0; i < anzahl; i++) gruppen.push([]);
          namen.forEach(function (n, i) {
            gruppen[i % anzahl].push(n);
          });
          e.daten.gruppen = gruppen;
          e.daten.bearbeiten = false;
          kontext.festhalten();
          INHALT.gruppen(e, koerper, werkzeuge, knoten, kontext);
        });
        koerper.appendChild(feld);
        koerper.appendChild(zeile);
        var knoepfe = el("div", "widget-knoepfe");
        knoepfe.appendChild(bilden);
        koerper.appendChild(knoepfe);
        return;
      }

      var raster = el("div", "gruppen-raster");
      e.daten.gruppen.forEach(function (gruppe, i) {
        var karte = el("div", "gruppe");
        karte.appendChild(el("strong", null, "Gruppe " + (i + 1)));
        var ul = el("ul");
        gruppe.forEach(function (n) {
          ul.appendChild(el("li", null, n));
        });
        karte.appendChild(ul);
        raster.appendChild(karte);
      });
      var knoepfe2 = el("div", "widget-knoepfe");
      var neu = wKnopf("Neu mischen", true);
      var aendern = wKnopf("Namen");
      neu.addEventListener("click", function () {
        e.daten.bearbeiten = true;
        INHALT.gruppen(e, koerper, werkzeuge, knoten, kontext);
        koerper.querySelector(".w-haupt").click();
      });
      aendern.addEventListener("click", function () {
        e.daten.bearbeiten = true;
        INHALT.gruppen(e, koerper, werkzeuge, knoten, kontext);
      });
      knoepfe2.appendChild(neu);
      knoepfe2.appendChild(aendern);
      koerper.appendChild(raster);
      koerper.appendChild(knoepfe2);
    },

    wuerfel: function (e, koerper, werkzeuge, knoten, kontext) {
      if (!e.daten.anzahl) e.daten.anzahl = 1;
      if (!e.daten.werte) e.daten.werte = [6];
      var flaeche = el("div", "wuerfel-flaeche");
      var summe = el("div", "widget-info");
      var knoepfe = el("div", "widget-knoepfe");
      var werfen = wKnopf("Würfeln", true);
      var anzahl = el("select", "w-wahl");
      anzahl.setAttribute("aria-label", "Anzahl Würfel");
      [1, 2, 3, 4, 5, 6].forEach(function (n) {
        var o = el("option", null, n + " Würfel");
        o.value = n;
        anzahl.appendChild(o);
      });
      anzahl.value = e.daten.anzahl;
      knoepfe.appendChild(werfen);
      knoepfe.appendChild(anzahl);
      koerper.appendChild(flaeche);
      koerper.appendChild(summe);
      koerper.appendChild(knoepfe);
      function zeichnen(werte) {
        flaeche.innerHTML = "";
        flaeche.classList.toggle("viele", werte.length > 3);
        werte.forEach(function (w) {
          flaeche.appendChild(wuerfelBild(w));
        });
        summe.textContent =
          werte.length > 1
            ? "Summe: " +
              werte.reduce(function (a, b) {
                return a + b;
              }, 0)
            : "";
      }
      function zufall() {
        var werte = [];
        for (var i = 0; i < e.daten.anzahl; i++) werte.push(1 + Math.floor(Math.random() * 6));
        return werte;
      }
      werfen.addEventListener("click", function () {
        var runden = 0;
        werfen.disabled = true;
        flaeche.classList.add("rollt");
        var takt = setInterval(function () {
          zeichnen(zufall());
          if (++runden >= 8) {
            clearInterval(takt);
            flaeche.classList.remove("rollt");
            werfen.disabled = false;
            e.daten.werte = zufall();
            zeichnen(e.daten.werte);
            kontext.festhalten();
          }
        }, 70);
      });
      anzahl.addEventListener("change", function () {
        e.daten.anzahl = parseInt(anzahl.value, 10);
        e.daten.werte = zufall();
        zeichnen(e.daten.werte);
        kontext.festhalten();
      });
      zeichnen(e.daten.werte);
    },

    uhr: function (e, koerper, werkzeuge, knoten, kontext) {
      var NS = "http://www.w3.org/2000/svg";
      var svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "0 0 200 200");
      svg.setAttribute("class", "uhr-blatt");
      svg.setAttribute("role", "img");
      var teile = '<circle cx="100" cy="100" r="94" class="uhr-rand"/>';
      for (var i = 0; i < 60; i++) {
        var lang = i % 5 === 0;
        teile += '<line x1="100" y1="' + (lang ? 14 : 12) + '" x2="100" y2="' + (lang ? 28 : 18) + '" class="' + (lang ? "uhr-strich-lang" : "uhr-strich") + '" transform="rotate(' + i * 6 + ' 100 100)"/>';
      }
      teile +=
        '<line x1="100" y1="100" x2="100" y2="52" class="uhr-stunde"/>' +
        '<line x1="100" y1="100" x2="100" y2="30" class="uhr-minute"/>' +
        '<line x1="100" y1="114" x2="100" y2="24" class="uhr-sekunde"/>' +
        '<circle cx="100" cy="100" r="5" class="uhr-mitte"/>';
      svg.innerHTML = teile;
      var zeiger = svg.querySelectorAll(".uhr-stunde, .uhr-minute, .uhr-sekunde");
      var digital = el("div", "uhr-digital");
      koerper.appendChild(svg);
      koerper.appendChild(digital);
      function zeichnen() {
        var jetzt = new Date();
        var s = jetzt.getSeconds();
        var m = jetzt.getMinutes() + s / 60;
        var h = (jetzt.getHours() % 12) + m / 60;
        zeiger[0].setAttribute("transform", "rotate(" + h * 30 + " 100 100)");
        zeiger[1].setAttribute("transform", "rotate(" + m * 6 + " 100 100)");
        zeiger[2].setAttribute("transform", "rotate(" + s * 6 + " 100 100)");
        digital.textContent = zweistellig(jetzt.getHours()) + ":" + zweistellig(jetzt.getMinutes());
        svg.setAttribute("aria-label", "Uhrzeit " + digital.textContent);
      }
      zeichnen();
      if (kontext.druck) return;
      stoppen(e.id);
      laufend[e.id] = setInterval(function () {
        // Element nicht mehr auf der Seite: Uhr anhalten
        if (!koerper.isConnected) stoppen(e.id);
        else zeichnen();
      }, 1000);
    },

    ampel: function (e, koerper, werkzeuge, knoten, kontext) {
      var ampel = el("div", "ampel");
      ["rot", "gelb", "gruen"].forEach(function (farbe) {
        var licht = el("button", "ampel-licht ampel-" + farbe + (e.daten.licht === farbe ? " an" : ""));
        licht.type = "button";
        licht.setAttribute("aria-label", { rot: "Rotes Licht", gelb: "Gelbes Licht", gruen: "Grünes Licht" }[farbe]);
        licht.setAttribute("aria-pressed", String(e.daten.licht === farbe));
        licht.addEventListener("click", function () {
          e.daten.licht = e.daten.licht === farbe ? "" : farbe;
          ampel.querySelectorAll(".ampel-licht").forEach(function (l) {
            var an = l.classList.contains("ampel-" + e.daten.licht);
            l.classList.toggle("an", an);
            l.setAttribute("aria-pressed", String(an));
          });
          kontext.festhalten();
        });
        ampel.appendChild(licht);
      });
      koerper.appendChild(ampel);
    },

    sozialform: function (e, koerper, werkzeuge, knoten, kontext) {
      if (!e.daten.form) e.daten.form = "einzel";
      var aktuell = el("div", "sozialform-aktuell");
      var wahl = el("div", "sozialform-wahl");
      function svg(f, klasse) {
        return '<svg class="' + klasse + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + f.icon + "</svg>";
      }
      function zeichnen() {
        var f = SOZIALFORMEN.filter(function (x) {
          return x.wert === e.daten.form;
        })[0];
        aktuell.innerHTML = svg(f, "sozialform-icon");
        aktuell.appendChild(el("strong", null, f.text));
        wahl.querySelectorAll("button").forEach(function (k) {
          k.classList.toggle("aktiv", k.dataset.form === e.daten.form);
          k.setAttribute("aria-pressed", String(k.dataset.form === e.daten.form));
        });
      }
      SOZIALFORMEN.forEach(function (f) {
        var k = el("button", "sozialform-knopf");
        k.type = "button";
        k.dataset.form = f.wert;
        k.title = f.text;
        k.setAttribute("aria-label", f.text);
        k.innerHTML = svg(f, "");
        k.addEventListener("click", function () {
          e.daten.form = f.wert;
          zeichnen();
          kontext.festhalten();
        });
        wahl.appendChild(k);
      });
      koerper.appendChild(aktuell);
      koerper.appendChild(wahl);
      zeichnen();
    },

    datei: function (e, koerper, werkzeuge, knoten, kontext) {
      var d = e.daten;
      var name = d.name || "Datei";
      var endung = (name.match(/\.([a-z0-9]{1,5})$/i) || [])[1] || "";
      var karte = el("div", "datei-karte");
      var vorschau = el("div", "datei-vorschau");
      var unten = el("div", "datei-unten");
      var symbol = el("span", "datei-symbol", endung.toUpperCase() || "?");
      var info = el("div", "datei-info");
      info.appendChild(el("strong", null, name));
      info.appendChild(el("small", null, [endung.toUpperCase(), dateiGroesse(d.groesse)].filter(Boolean).join(" · ")));
      var laden = el("a", "w-knopf", "Herunterladen");
      laden.download = name;
      var oeffnen = el("a", "w-knopf", "Öffnen");
      oeffnen.target = "_blank";
      oeffnen.rel = "noopener";
      unten.appendChild(symbol);
      unten.appendChild(info);
      unten.appendChild(oeffnen);
      unten.appendChild(laden);
      karte.appendChild(vorschau);
      karte.appendChild(unten);
      koerper.appendChild(karte);
      if (kontext.druck) {
        vorschau.remove();
        oeffnen.remove();
        laden.remove();
        return;
      }
      quelle(d, kontext, function (url) {
        if (!url) return;
        // Gespeicherte Medien sind data:-Adressen (Export) oder blob:-Adressen; zum Oeffnen ein Blob
        var blobUrl = url;
        if (/^data:/.test(url) && W.dataUrlZuBlob) blobUrl = URL.createObjectURL(W.dataUrlZuBlob(url));
        laden.href = blobUrl;
        oeffnen.href = blobUrl;
        var mime = d.mime || "";
        if (/^image\//.test(mime)) {
          var bild = el("img");
          bild.alt = name;
          bild.src = blobUrl;
          bild.draggable = false;
          vorschau.appendChild(bild);
        } else if (mime === "application/pdf") {
          var f = el("iframe");
          f.src = blobUrl;
          f.title = name;
          vorschau.appendChild(f);
        } else if (/^audio\//.test(mime)) {
          var a = el("audio");
          a.controls = true;
          a.src = blobUrl;
          vorschau.appendChild(a);
        } else {
          vorschau.appendChild(el("span", "datei-gross", endung.toUpperCase() || "Datei"));
        }
      });
    },

    // Form wie in PowerPoint, auf Doppelklick mit Text
    form: function (e, koerper, werkzeuge, knoten, kontext) {
      var d = e.daten;
      var f = formVon(d.form);
      koerper.insertAdjacentHTML("beforeend", '<svg class="form-bild" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">' + f.svg + "</svg>");
      var form = koerper.lastChild.firstChild;
      form.style.fill = d.fuellung === "keine" ? "none" : d.fuellung || FORM_STANDARD.fuellung;
      var dicke = d.randDicke != null ? d.randDicke : FORM_STANDARD.randDicke;
      form.style.stroke = dicke > 0 ? d.rand || FORM_STANDARD.rand : "none";
      form.style.strokeWidth = dicke + "px";
      form.setAttribute("vector-effect", "non-scaling-stroke");
      formEcken(knoten, e);
      var bereich = el("div", "form-text form-" + (d.vertikal || "mitte"));
      bereich.style.inset = f.innen.join("% ") + "%";
      koerper.appendChild(bereich);
      var feld = textFeld(e, bereich, "Text …", kontext);
      if (kontext.eintragbar) {
        // Beim Praesentieren: Antippen der Form schreibt (auch wenn sie noch leer ist)
        koerper.addEventListener("click", function (ev) {
          if (ev.target !== feld && !feld.contains(ev.target)) {
            feld.focus();
            var a = window.getSelection();
            a.selectAllChildren(feld);
            a.collapseToEnd();
          }
        });
      }
      if (!kontext.bearbeitbar) return;
      // Erst auswaehlen und verschieben, Doppelklick schreibt
      feld.addEventListener("focus", function () {
        knoten.classList.add("schreibt");
      });
      feld.addEventListener("blur", function () {
        knoten.classList.remove("schreibt");
      });
      koerper.addEventListener("dblclick", function () {
        feld.focus();
        var auswahl = window.getSelection();
        auswahl.selectAllChildren(feld);
        auswahl.collapseToEnd();
      });
    },

    // Tabelle mit bearbeitbaren Zellen; d.stile (freiwillig) hat das Format jeder Zelle
    tabelle: function (e, koerper, werkzeuge, knoten, kontext) {
      var d = e.daten;
      if (!d.zellen || !d.zellen.length) d.zellen = [["", "", ""], ["", "", ""], ["", "", ""]];
      if (d.kopf == null) d.kopf = true;
      var rahmen = el("div", "tabelle-rahmen");
      var tab = el("table", "tabelle");
      textStil(tab, e);
      rahmen.appendChild(tab);
      koerper.appendChild(rahmen);
      var aktiv = null;

      function bauen() {
        tab.textContent = "";
        tab.classList.toggle("mit-kopf", !!d.kopf);
        d.zellen.forEach(function (zeile, z) {
          var tr = el("tr");
          zeile.forEach(function (wert, s) {
            var zelle = el(z === 0 && d.kopf ? "th" : "td", null, wert);
            zellStil(zelle, d.stile && d.stile[z] && d.stile[z][s]);
            if (kontext.bearbeitbar || kontext.eintragbar) {
              zelle.contentEditable = "true";
              zelle.spellcheck = false;
              zelle.addEventListener("paste", function (ev) {
                ev.preventDefault();
                ev.stopPropagation();
                document.execCommand("insertText", false, (ev.clipboardData || window.clipboardData).getData("text/plain"));
              });
              zelle.addEventListener("focus", function () {
                aktiv = { z: z, s: s };
              });
              zelle.addEventListener("input", function () {
                d.zellen[z][s] = zelle.innerText.replace(/\n$/, "");
                kontext.speichern();
              });
              zelle.addEventListener("blur", kontext.festhalten);
            }
            tr.appendChild(zelle);
          });
          tab.appendChild(tr);
        });
      }
      bauen();
      if (!werkzeuge) return;

      function aendern(arbeit) {
        arbeit();
        bauen();
        kontext.festhalten();
      }
      function zeileNr() {
        return aktiv && aktiv.z < d.zellen.length ? aktiv.z : d.zellen.length - 1;
      }
      function spalteNr() {
        return aktiv && aktiv.s < d.zellen[0].length ? aktiv.s : d.zellen[0].length - 1;
      }
      werkzeug(werkzeuge, "spalteWeg", "Spalte entfernen", function () {
        if (d.zellen[0].length <= 1) return;
        var s = spalteNr();
        aendern(function () {
          d.zellen.forEach(function (zeile) {
            zeile.splice(s, 1);
          });
          (d.stile || []).forEach(function (zeile) {
            if (zeile) zeile.splice(s, 1);
          });
          aktiv = null;
        });
      });
      werkzeug(werkzeuge, "zeileWeg", "Zeile entfernen", function () {
        if (d.zellen.length <= 1) return;
        var z = zeileNr();
        aendern(function () {
          d.zellen.splice(z, 1);
          if (d.stile) d.stile.splice(z, 1);
          aktiv = null;
        });
      });
      werkzeug(werkzeuge, "spalteNeu", "Spalte hinzufügen", function () {
        var s = spalteNr() + 1;
        aendern(function () {
          d.zellen.forEach(function (zeile) {
            zeile.splice(s, 0, "");
          });
          (d.stile || []).forEach(function (zeile) {
            if (zeile) zeile.splice(s, 0, null);
          });
        });
      });
      werkzeug(werkzeuge, "zeileNeu", "Zeile hinzufügen", function () {
        var z = zeileNr() + 1;
        aendern(function () {
          d.zellen.splice(
            z,
            0,
            d.zellen[0].map(function () {
              return "";
            })
          );
          if (d.stile) d.stile.splice(z, 0, null);
        });
      });
    }
  };

  // ---------- Zeichnungen ----------

  function strichZeichnen(stift, s) {
    var p = s.punkte;
    if (!p || p.length < 2) return;
    stift.save();
    stift.lineCap = "round";
    stift.lineJoin = "round";
    stift.strokeStyle = s.farbe;
    stift.fillStyle = s.farbe;
    stift.lineWidth = s.dicke;
    if (s.werkzeug === "radierer") stift.globalCompositeOperation = "destination-out";
    if (s.werkzeug === "marker") stift.globalAlpha = 0.35;
    stift.beginPath();
    if (p.length === 2) {
      stift.arc(p[0], p[1], s.dicke / 2, 0, Math.PI * 2);
      stift.fill();
    } else {
      stift.moveTo(p[0], p[1]);
      // Geglaettet ueber die Mittelpunkte
      for (var i = 2; i < p.length - 2; i += 2) {
        stift.quadraticCurveTo(p[i], p[i + 1], (p[i] + p[i + 2]) / 2, (p[i + 1] + p[i + 3]) / 2);
      }
      stift.lineTo(p[p.length - 2], p[p.length - 1]);
      stift.stroke();
    }
    stift.restore();
  }

  function stricheZeichnen(leinwand, striche, aktuell) {
    var stift = leinwand.getContext("2d");
    var faktor = leinwand.width / BREITE;
    stift.setTransform(faktor, 0, 0, faktor, 0, 0);
    stift.clearRect(0, 0, BREITE, HOEHE);
    striche.forEach(function (s) {
      strichZeichnen(stift, s);
    });
    if (aktuell) strichZeichnen(stift, aktuell);
  }

  // ---------- Hintergrund ----------

  var MUSTER = {
    kariert: function (linie) {
      return { bild: "linear-gradient(" + linie + " 1px, transparent 1px), linear-gradient(90deg, " + linie + " 1px, transparent 1px)", groesse: "40px 40px" };
    },
    liniert: function (linie) {
      return { bild: "linear-gradient(transparent 59px, " + linie + " 59px, " + linie + " 60px)", groesse: "100% 60px" };
    },
    punkte: function (linie) {
      return { bild: "radial-gradient(" + linie + " 1.6px, transparent 1.8px)", groesse: "40px 40px" };
    }
  };

  function hell(farbe) {
    var m = String(farbe).match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
    if (!m) return true;
    var r = parseInt(m[1], 16);
    var g = parseInt(m[2], 16);
    var b = parseInt(m[3], 16);
    return 0.299 * r + 0.587 * g + 0.114 * b > 140;
  }

  /**
   * Setzt den Hintergrund einer Seite auf die Flaeche: eine Vorlage (hg-…) oder ein
   * eigenes Design aus Farbe, Muster und Hintergrundbild.
   */
  function hintergrundAnwenden(flaeche, seite, mediumUrl) {
    var name = seite.hintergrund || "weiss";
    flaeche.className = flaeche.className.replace(/\bhg-\S+/g, "").trim() + " hg-" + name;
    flaeche.style.backgroundColor = "";
    flaeche.style.backgroundImage = "";
    flaeche.style.backgroundSize = "";
    flaeche.style.backgroundPosition = "";
    if (name !== "eigen") return;
    var farbe = seite.hgFarbe || "#ffffff";
    var linie = hell(farbe) ? "rgba(40, 70, 90, 0.22)" : "rgba(255, 255, 255, 0.22)";
    var bilder = [];
    var groessen = [];
    var muster = MUSTER[seite.hgMuster];
    if (muster) {
      var m = muster(linie);
      bilder.push(m.bild);
      groessen.push(m.groesse);
    }
    function setzen(bildUrl) {
      var b = bilder.slice();
      var g = groessen.slice();
      if (bildUrl) {
        b.push('url("' + String(bildUrl).replace(/"/g, "%22") + '")');
        g.push("cover");
      }
      flaeche.style.backgroundColor = farbe;
      flaeche.style.backgroundImage = b.join(", ");
      flaeche.style.backgroundSize = g.join(", ");
      flaeche.style.backgroundPosition = "center";
    }
    setzen(null);
    if (seite.hgBild && mediumUrl) {
      mediumUrl(seite.hgBild).then(function (url) {
        // Seite inzwischen gewechselt?
        if (url && flaeche.classList.contains("hg-eigen")) setzen(url);
      });
    }
  }

  /** Kurzer Titel einer Seite fuer Seitenliste und Navigation */
  function seitenTitel(seite, nummer) {
    if (seite.titel) return seite.titel;
    var texte = seite.elemente
      .filter(function (e) {
        return (e.typ === "text" || e.typ === "notiz") && e.daten.text;
      })
      .sort(function (a, b) {
        return a.y - b.y || a.x - b.x;
      });
    if (texte.length) return texte[0].daten.text.split("\n")[0].slice(0, 60);
    return "Seite " + nummer;
  }

  W.Elemente = {
    BREITE: BREITE,
    HOEHE: HOEHE,
    GRIFF: GRIFF,
    GROESSE: GROESSE,
    NAMEN: NAMEN,
    NOTIZFARBEN: NOTIZFARBEN,
    sicherUrl: sicherUrl,
    youtube: youtube,
    erkennen: erkennen,
    einbettUrl: einbettUrl,
    rahmenBauen: rahmenBauen,
    lage: lage,
    inhaltBauen: inhaltBauen,
    stoppen: stoppen,
    alleStoppen: alleStoppen,
    vergessen: vergessen,
    stricheZeichnen: stricheZeichnen,
    seitenTitel: seitenTitel,
    snippetUrl: snippetUrl,
    qrSvg: qrSvg,
    spotlight: spotlight,
    spotlightSchliessen: spotlightSchliessen,
    hintergrundAnwenden: hintergrundAnwenden,
    SOZIALFORMEN: SOZIALFORMEN,
    FORMEN: FORMEN,
    FORM_STANDARD: FORM_STANDARD,
    formVon: formVon,
    SCHRIFTEN: SCHRIFTEN,
    schriftVon: schriftVon,
    standardGroesse: standardGroesse,
    laeufeVon: laeufeVon,
    formatFuerAlle: formatFuerAlle,
    EFFEKTE: EFFEKTE,
    UEBERGAENGE: UEBERGAENGE,
    animationen: animationen,
    uebergang: uebergang,
    hintergruende: [
      { wert: "weiss", text: "Weiss" },
      { wert: "kariert", text: "Kariert" },
      { wert: "liniert", text: "Liniert" },
      { wert: "punkte", text: "Punkte" },
      { wert: "gruen", text: "Wandtafel grün" },
      { wert: "dunkel", text: "Dunkelblau" },
      { wert: "kork", text: "Kork" },
      { wert: "eigen", text: "Eigenes Design …" }
    ]
  };
})();
