/*
 * Import einer PowerPoint-Datei (.pptx) als neue Tafel, ohne fremde Bibliothek.
 *
 * Eine .pptx-Datei ist ein ZIP-Archiv mit XML-Teilen (Office Open XML); entpackt
 * wird mit DecompressionStream des Browsers. Jede Folie wird eine Seite, Folien
 * im Format 4:3 werden mittig eingepasst:
 *   Titel, Textfelder        Text mit Schrift, Grösse, Farbe, Stil, Ausrichtung, Aufzählung;
 *                            Zeilen und Wörter mit anderem Format als Läufe
 *   Formen mit Füllung       Form (die ähnlichste Wandtafel-Form) mit Text
 *   Bilder                   Bild (im Browser gespeichert)
 *   Tabellen                 Tabelle mit Zellfarben und Fettdruck (auch aus dem Tabellenstil)
 *   Linien und Verbinder     Zeichnung
 *   Videos                   Video (Datei, YouTube, Vimeo), andere Adressen als Link
 *   Gruppen                  aufgelöst in einzelne Elemente
 * Dazu Hintergrund (Farbe oder Bild), Formen und Bilder aus Master und Layout,
 * Notizen, Übergänge, Animationen beim Erscheinen und ausgeblendete Folien.
 * Diagramme, SmartArt, eingebettete Objekte und Audio werden gezählt und
 * gemeldet, aber nicht übernommen.
 *
 * Liefert ein Paket wie eine Wandtafel-Datei: { format, art: "tafel", tafel, medien }.
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var E = W.Elemente;
  var X = W.Export;

  var BREITE = E.BREITE;
  var HOEHE = E.HOEHE;
  var NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  var EMU_PUNKT = 12700;

  // ---------- ZIP lesen ----------

  function entpacken(roh) {
    if (typeof DecompressionStream === "undefined") {
      return Promise.reject(new Error("Dieser Browser kann PowerPoint-Dateien nicht öffnen. Bitte einen aktuellen Browser verwenden."));
    }
    var strom = new Blob([roh]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
    return new Response(strom).arrayBuffer().then(function (puffer) {
      return new Uint8Array(puffer);
    });
  }

  /** Inhaltsverzeichnis des ZIP-Archivs; lesen(name) liefert die entpackten Bytes */
  function zipOeffnen(puffer) {
    var daten = new Uint8Array(puffer);
    var sicht = new DataView(puffer);
    var ende = -1;
    for (var i = daten.length - 22; i >= Math.max(0, daten.length - 65557); i--) {
      if (sicht.getUint32(i, true) === 0x06054b50) {
        ende = i;
        break;
      }
    }
    if (ende < 0) throw new Error("Das ist keine PowerPoint-Datei (.pptx). Ältere .ppt-Dateien zuerst in PowerPoint als .pptx speichern.");
    var anzahl = sicht.getUint16(ende + 10, true);
    var pos = sicht.getUint32(ende + 16, true);
    var dekoder = new TextDecoder();
    var eintraege = {};
    for (var n = 0; n < anzahl && pos + 46 <= daten.length; n++) {
      if (sicht.getUint32(pos, true) !== 0x02014b50) break;
      var namenLaenge = sicht.getUint16(pos + 28, true);
      var name = dekoder.decode(daten.subarray(pos + 46, pos + 46 + namenLaenge));
      eintraege[name] = {
        methode: sicht.getUint16(pos + 10, true),
        gepackt: sicht.getUint32(pos + 20, true),
        lokal: sicht.getUint32(pos + 42, true)
      };
      pos += 46 + namenLaenge + sicht.getUint16(pos + 30, true) + sicht.getUint16(pos + 32, true);
    }
    return {
      gibt: function (name) {
        return !!eintraege[name];
      },
      lesen: function (name) {
        var e = eintraege[name];
        if (!e) return Promise.resolve(null);
        var start = e.lokal + 30 + sicht.getUint16(e.lokal + 26, true) + sicht.getUint16(e.lokal + 28, true);
        var roh = daten.subarray(start, start + e.gepackt);
        if (e.methode === 0) return Promise.resolve(roh);
        if (e.methode === 8) return entpacken(roh);
        return Promise.reject(new Error("Teile der PowerPoint-Datei sind unbekannt gepackt."));
      }
    };
  }

  // ---------- XML ----------

  function kinder(knoten, name) {
    var liste = [];
    if (!knoten) return liste;
    for (var k = knoten.firstElementChild; k; k = k.nextElementSibling) if (!name || k.localName === name) liste.push(k);
    return liste;
  }

  /** kind(knoten, "a", "b") = erstes Kind a, davon erstes Kind b */
  function kind(knoten) {
    for (var i = 1; i < arguments.length && knoten; i++) knoten = kinder(knoten, arguments[i])[0] || null;
    return knoten;
  }

  function alle(knoten, name) {
    return knoten ? Array.prototype.slice.call(knoten.getElementsByTagNameNS("*", name)) : [];
  }

  function zahl(knoten, attribut, ersatz) {
    var wert = knoten && knoten.getAttribute(attribut);
    return wert == null || wert === "" ? ersatz : parseFloat(wert);
  }

  function rId(knoten, name) {
    return knoten && (knoten.getAttributeNS(NS_R, name) || knoten.getAttribute("r:" + name));
  }

  /** Pfad eines Ziels relativ zum Ordner eines Teils */
  function pfadAufloesen(ordner, ziel) {
    var teile = (ziel.charAt(0) === "/" ? ziel.slice(1) : ordner + ziel).split("/");
    var aus = [];
    teile.forEach(function (t) {
      if (t === "..") aus.pop();
      else if (t && t !== ".") aus.push(t);
    });
    return aus.join("/");
  }

  /** Liest einen XML-Teil mit seinen Beziehungen: { pfad, wurzel, rels } */
  function teilLesen(zip, pfad, zwischenspeicher) {
    if (zwischenspeicher[pfad]) return zwischenspeicher[pfad];
    var ordner = pfad.replace(/[^/]*$/, "");
    var relsPfad = ordner + "_rels/" + pfad.slice(ordner.length) + ".rels";
    var dekoder = new TextDecoder();
    var parser = new DOMParser();
    function xml(name) {
      return zip.lesen(name).then(function (b) {
        if (!b) return null;
        var doc = parser.parseFromString(dekoder.decode(b), "application/xml");
        return doc.getElementsByTagName("parsererror").length ? null : doc.documentElement;
      });
    }
    zwischenspeicher[pfad] = Promise.all([xml(pfad), xml(relsPfad)]).then(function (r) {
      var rels = {};
      kinder(r[1], "Relationship").forEach(function (b) {
        var extern = b.getAttribute("TargetMode") === "External";
        var ziel = b.getAttribute("Target") || "";
        rels[b.getAttribute("Id")] = {
          typ: (b.getAttribute("Type") || "").replace(/.*\//, ""),
          ziel: extern ? ziel : pfadAufloesen(ordner, ziel),
          extern: extern
        };
      });
      return { pfad: pfad, wurzel: r[0], rels: rels };
    });
    return zwischenspeicher[pfad];
  }

  function relVomTyp(teil, typ) {
    for (var id in teil.rels) if (teil.rels[id].typ === typ) return teil.rels[id];
    return null;
  }

  // ---------- Farben ----------

  var FARBNAMEN = {
    black: "000000", white: "FFFFFF", red: "FF0000", green: "008000", blue: "0000FF", yellow: "FFFF00",
    orange: "FFA500", gray: "808080", grey: "808080", darkBlue: "00008B", darkRed: "8B0000", darkGreen: "006400"
  };

  function hexZuRgb(hex) {
    var n = parseInt(hex, 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  function rgbZuHex(rgb) {
    return rgb
      .map(function (w) {
        var h = Math.round(Math.max(0, Math.min(255, w))).toString(16);
        return h.length < 2 ? "0" + h : h;
      })
      .join("");
  }

  function rgbZuHsl(rgb) {
    var r = rgb[0] / 255, g = rgb[1] / 255, b = rgb[2] / 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    var d = max - min;
    var s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    var h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    return [h / 6, s, l];
  }

  function hslZuRgb(hsl) {
    var h = hsl[0], s = hsl[1], l = hsl[2];
    if (!s) return [l * 255, l * 255, l * 255];
    var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    var p = 2 * l - q;
    return [h + 1 / 3, h, h - 1 / 3].map(function (t) {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      var w = t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * (2 / 3 - t) * 6 : p;
      return w * 255;
    });
  }

  /** Farbe aus einem Behälter wie solidFill; null wenn keine oder durchsichtig */
  function farbeLesen(behaelter, farben) {
    var c = behaelter && behaelter.firstElementChild;
    if (!c) return null;
    var hex = null;
    var art = c.localName;
    if (art === "srgbClr") hex = c.getAttribute("val");
    else if (art === "sysClr") hex = c.getAttribute("lastClr") || (c.getAttribute("val") === "window" ? "FFFFFF" : "000000");
    else if (art === "prstClr") hex = FARBNAMEN[c.getAttribute("val")] || "000000";
    else if (art === "scrgbClr") hex = rgbZuHex(["r", "g", "b"].map(function (k) { return zahl(c, k, 0) / 100000 * 255; }));
    else if (art === "schemeClr") {
      var name = c.getAttribute("val");
      hex = farben.thema[farben.zuordnung[name] || name] || null;
    }
    if (!hex || !/^[0-9a-f]{6}$/i.test(hex)) return null;
    var rgb = hexZuRgb(hex);
    kinder(c).forEach(function (m) {
      var w = zahl(m, "val", 100000) / 100000;
      if (m.localName === "alpha" && w < 0.15) rgb = null;
      if (!rgb) return;
      if (m.localName === "lumMod" || m.localName === "lumOff") {
        var hsl = rgbZuHsl(rgb);
        hsl[2] = m.localName === "lumMod" ? hsl[2] * w : hsl[2] + w;
        hsl[2] = Math.max(0, Math.min(1, hsl[2]));
        rgb = hslZuRgb(hsl);
      } else if (m.localName === "shade") {
        rgb = rgb.map(function (v) { return v * w; });
      } else if (m.localName === "tint") {
        rgb = rgb.map(function (v) { return v + (255 - v) * (1 - w); });
      }
    });
    return rgb ? "#" + rgbZuHex(rgb).toLowerCase() : null;
  }

  /** Füllung eines spPr/bgPr: undefined = nicht angegeben, null = keine, sonst Farbe oder { bild } */
  function fuellungLesen(behaelter, farben) {
    if (!behaelter) return undefined;
    if (kind(behaelter, "noFill")) return null;
    var fest = kind(behaelter, "solidFill");
    if (fest) return farbeLesen(fest, farben);
    var verlauf = kind(behaelter, "gradFill", "gsLst", "gs");
    if (verlauf) return farbeLesen(verlauf, farben);
    var bild = kind(behaelter, "blipFill", "blip");
    if (bild) return { bild: rId(bild, "embed") };
    return undefined;
  }

  // ---------- Schrift und Text ----------

  function schriftWert(name, farben) {
    if (name === "+mj-lt") name = farben.titelSchrift;
    if (name === "+mn-lt") name = farben.textSchrift;
    name = String(name || "").toLowerCase();
    if (/comic|chalk|print|marker|hand|script|bradley|kristen|ink free/.test(name)) return "schreib";
    if (/courier|consol|mono|menlo|lucida console/.test(name)) return "mono";
    if (!/sans/.test(name) && /georgia|times|garamond|cambria|book|palatino|baskerville|rockwell|didot|bodoni|serif/.test(name)) return "serif";
    return "";
  }

  /**
   * Wert für einen Absatz einer Stufe suchen: zuerst am Absatz, dann in den
   * Listenstilen (Form, Layout, Master, Präsentation)
   */
  function stilSuchen(absatz, stufe, kette, holen) {
    var pPr = kind(absatz, "pPr");
    var w = pPr ? holen(pPr) : undefined;
    for (var i = 0; w === undefined && i < kette.length; i++) {
      var ebene = kind(kette[i], "lvl" + (stufe + 1) + "pPr");
      if (ebene) w = holen(ebene);
    }
    return w;
  }

  function laufStil(rPr, absatz, stufe, kette, holen) {
    var w = rPr ? holen(rPr) : undefined;
    if (w !== undefined) return w;
    return stilSuchen(absatz, stufe, kette, function (pPr) {
      var def = kind(pPr, "defRPr");
      return def ? holen(def) : undefined;
    });
  }

  function attr(name) {
    return function (k) {
      var w = k.getAttribute(name);
      return w == null ? undefined : w;
    };
  }

  var LAUF_STIL = ["fett", "kursiv", "unterstrichen", "farbe", "groesse", "schrift"];

  /**
   * Text eines txBody mit dem vorherrschenden Format:
   * { text, groesse (pt), fett, kursiv, unterstrichen, farbe, schrift, ausrichtung, liste, laeufe }
   * laeufe hat die Stellen mit anderem Format (Grösse in pt), oder fehlt.
   */
  function textLesen(txBody, lokal, allgemein, farben, ersatzFarbe) {
    var kette = lokal.concat(allgemein);
    if (!txBody) return null;
    var skala = zahl(kind(txBody, "bodyPr", "normAutofit"), "fontScale", 100000) / 100000;
    // Die Schriftfarbe aus dem Formstil gilt vor den allgemeinen Vorgaben
    var holeFarbe = function (k) {
      var f = kind(k, "solidFill");
      return f ? farbeLesen(f, farben) || undefined : undefined;
    };
    function stilVon(r, absatz, stufe) {
      var farbe = laufStil(r, absatz, stufe, lokal, holeFarbe) || ersatzFarbe || laufStil(null, absatz, stufe, allgemein, holeFarbe);
      var latin = laufStil(r, absatz, stufe, kette, function (k) {
        var l = kind(k, "latin");
        return l ? l.getAttribute("typeface") || undefined : undefined;
      });
      return {
        groesse: (parseFloat(laufStil(r, absatz, stufe, kette, attr("sz"))) || 1800) / 100 * skala,
        fett: /^(1|true)$/.test(laufStil(r, absatz, stufe, kette, attr("b")) || ""),
        kursiv: /^(1|true)$/.test(laufStil(r, absatz, stufe, kette, attr("i")) || ""),
        unterstrichen: !!(laufStil(r, absatz, stufe, kette, attr("u")) || "none").replace("none", ""),
        farbe: farbe || farben.text,
        schrift: schriftWert(latin, farben)
      };
    }
    var zeilen = [];
    var mitListe = 0;
    var mitNummern = 0;
    kinder(txBody, "p").forEach(function (absatz) {
      var pPr = kind(absatz, "pPr");
      var stufe = zahl(pPr, "lvl", 0);
      var stuecke = [];
      kinder(absatz).forEach(function (t) {
        if (t.localName === "r" || t.localName === "fld") {
          var inhalt = (kind(t, "t") || {}).textContent || "";
          if (inhalt) stuecke.push({ t: inhalt, stil: stilVon(kind(t, "rPr"), absatz, stufe) });
        } else if (t.localName === "br") stuecke.push({ t: " ", stil: null });
      });
      var text = stuecke
        .map(function (st) {
          return st.t;
        })
        .join("");
      var liste = "";
      if (text.trim()) {
        var aufz = stilSuchen(absatz, stufe, kette, function (p) {
          if (kind(p, "buNone")) return "";
          if (kind(p, "buAutoNum")) return "nummern";
          if (kind(p, "buChar") || kind(p, "buBlip")) return "punkte";
          return undefined;
        });
        liste = aufz || "";
        if (liste) mitListe++;
        if (liste === "nummern") mitNummern++;
      }
      var ausrichtung = { ctr: "center", r: "right", just: "justify", dist: "justify" }[stilSuchen(absatz, stufe, kette, attr("algn"))] || "";
      zeilen.push({ text: text, stufe: stufe, liste: liste, stuecke: stuecke, ausrichtung: ausrichtung });
    });
    while (zeilen.length && !zeilen[zeilen.length - 1].text.trim()) zeilen.pop();
    while (zeilen.length && !zeilen[0].text.trim()) zeilen.shift();
    // Das Format und die Ausrichtung mit dem meisten Text gelten für das ganze Element
    var nachStil = {};
    var nachAusrichtung = {};
    zeilen.forEach(function (z) {
      z.stuecke.forEach(function (st) {
        if (!st.stil || !st.t.trim()) return;
        var k = JSON.stringify(st.stil);
        nachStil[k] = (nachStil[k] || 0) + st.t.length;
        nachAusrichtung[z.ausrichtung] = (nachAusrichtung[z.ausrichtung] || 0) + st.t.length;
      });
    });
    var meiste = function (zaehler) {
      return Object.keys(zaehler).reduce(function (a, b) {
        return a === null || zaehler[b] > zaehler[a] ? b : a;
      }, null);
    };
    var hauptStil = meiste(nachStil);
    if (hauptStil === null) return null;
    var haupt = JSON.parse(hauptStil);
    haupt.ausrichtung = meiste(nachAusrichtung) || "";

    var volleZeilen = zeilen.filter(function (z) {
      return z.text.trim();
    }).length;
    var liste = mitListe * 2 >= volleZeilen ? (mitNummern * 2 > mitListe ? "nummern" : "punkte") : "";
    var einzug = "   ";
    // Stellen mit anderem Format; Einzug, Umbrüche und Zeilenenden wie der Text davor
    var laeufe = [];
    var vorher = {};
    function anhaengen(t, stil) {
      var abw = vorher;
      if (stil) {
        abw = {};
        LAUF_STIL.forEach(function (k) {
          if (stil[k] !== haupt[k] && stil[k] != null) abw[k] = stil[k];
        });
        vorher = abw;
      }
      var letzter = laeufe[laeufe.length - 1];
      if (letzter && JSON.stringify(letzter.abw) === JSON.stringify(abw)) letzter.t += t;
      else laeufe.push({ t: t, abw: abw });
    }
    zeilen.forEach(function (z, i) {
      if (i) anhaengen("\n", null);
      var vorne = new Array(z.stufe + 1).join(einzug);
      // Absätze ohne Aufzählungszeichen in einer Liste behalten ihren Text, andere bekommen einen Strich
      if (!liste && z.liste && volleZeilen > 1) vorne += "– ";
      var erster = z.stuecke.filter(function (st) {
        return st.stil;
      })[0];
      if (vorne) anhaengen(vorne, erster ? erster.stil : null);
      z.stuecke.forEach(function (st) {
        anhaengen(st.t, st.stil);
      });
    });
    haupt.text = laeufe
      .map(function (l) {
        return l.t;
      })
      .join("");
    haupt.liste = liste;
    if (laeufe.some(function (l) { return Object.keys(l.abw).length; })) {
      haupt.laeufe = laeufe.map(function (l) {
        var lauf = { t: l.t };
        Object.keys(l.abw).forEach(function (k) {
          lauf[k] = l.abw[k];
        });
        return lauf;
      });
    }
    return haupt;
  }

  // ---------- Formen ----------

  var FORM_NACH_PRST = {
    roundRect: "abgerundet", round1Rect: "abgerundet", round2SameRect: "abgerundet", round2DiagRect: "abgerundet",
    flowChartAlternateProcess: "abgerundet", plaque: "abgerundet",
    ellipse: "ellipse", flowChartConnector: "ellipse", donut: "ellipse",
    triangle: "dreieck", rtTriangle: "dreieck", flowChartExtract: "dreieck",
    diamond: "raute", flowChartDecision: "raute",
    hexagon: "sechseck", octagon: "sechseck", heptagon: "sechseck", decagon: "sechseck", dodecagon: "sechseck", pentagon: "sechseck",
    rightArrow: "pfeil", leftArrow: "pfeil", upArrow: "pfeil", downArrow: "pfeil", notchedRightArrow: "pfeil",
    stripedRightArrow: "pfeil", chevron: "pfeil", homePlate: "pfeil",
    wedgeRectCallout: "sprechblase", wedgeRoundRectCallout: "sprechblase", wedgeEllipseCallout: "sprechblase", cloudCallout: "sprechblase"
  };

  function formWert(prst) {
    if (/^star\d+$/.test(prst)) return "stern";
    return FORM_NACH_PRST[prst] || "rechteck";
  }

  // ---------- Tabellen ----------

  // Der Standard-Tabellenstil von PowerPoint («Mittlere Formatvorlage 2 - Akzent 1»). Er steht
  // oft nicht in ppt/tableStyles.xml, weil PowerPoint ihn kennt.
  var STANDARD_TABELLE =
    '<a:tblStyle xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" styleId="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}">' +
    '<a:wholeTbl><a:tcTxStyle><a:fontRef idx="minor"/><a:schemeClr val="dk1"/></a:tcTxStyle><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"><a:tint val="20000"/></a:schemeClr></a:solidFill></a:fill></a:tcStyle></a:wholeTbl>' +
    '<a:band1H><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"><a:tint val="40000"/></a:schemeClr></a:solidFill></a:fill></a:tcStyle></a:band1H>' +
    '<a:band1V><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"><a:tint val="40000"/></a:schemeClr></a:solidFill></a:fill></a:tcStyle></a:band1V>' +
    '<a:lastCol><a:tcTxStyle b="on"><a:fontRef idx="minor"/><a:schemeClr val="lt1"/></a:tcTxStyle><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fill></a:tcStyle></a:lastCol>' +
    '<a:firstCol><a:tcTxStyle b="on"><a:fontRef idx="minor"/><a:schemeClr val="lt1"/></a:tcTxStyle><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fill></a:tcStyle></a:firstCol>' +
    '<a:lastRow><a:tcTxStyle b="on"><a:fontRef idx="minor"/><a:schemeClr val="lt1"/></a:tcTxStyle><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fill></a:tcStyle></a:lastRow>' +
    '<a:firstRow><a:tcTxStyle b="on"><a:fontRef idx="minor"/><a:schemeClr val="lt1"/></a:tcTxStyle><a:tcStyle><a:fill><a:solidFill><a:schemeClr val="accent1"/></a:solidFill></a:fill></a:tcStyle></a:firstRow>' +
    "</a:tblStyle>";

  /** Teile eines Tabellenstils, die für eine Zelle gelten, vom schwächsten zum stärksten */
  function tabellenTeile(tblPr, z, s, zeilen, spalten) {
    var an = function (n) {
      return /^(1|true)$/.test((tblPr && tblPr.getAttribute(n)) || "");
    };
    var teile = ["wholeTbl"];
    if (an("bandCol")) teile.push((s - (an("firstCol") ? 1 : 0)) % 2 ? "band2V" : "band1V");
    if (an("bandRow")) teile.push((z - (an("firstRow") ? 1 : 0)) % 2 ? "band2H" : "band1H");
    if (an("lastCol") && s === spalten - 1) teile.push("lastCol");
    if (an("firstCol") && s === 0) teile.push("firstCol");
    if (an("lastRow") && z === zeilen - 1) teile.push("lastRow");
    if (an("firstRow") && z === 0) teile.push("firstRow");
    return teile;
  }

  /** Format einer Zelle: aus dem Tabellenstil, dann direkt an der Zelle und ihrem Text */
  function zellStilLesen(tc, vorlage, teile, farben) {
    var st = {};
    teile.forEach(function (name) {
      var teil = kind(vorlage, name);
      if (!teil) return;
      var tx = kind(teil, "tcTxStyle");
      if (tx) {
        if (tx.getAttribute("b")) st.fett = tx.getAttribute("b") === "on";
        if (tx.getAttribute("i")) st.kursiv = tx.getAttribute("i") === "on";
        var farbKind = kinder(tx).filter(function (k) {
          return /Clr$/.test(k.localName);
        })[0];
        var farbe = farbKind ? farbeLesen({ firstElementChild: farbKind }, farben) : null;
        if (farbe) st.farbe = farbe;
      }
      var fuellung = fuellungLesen(kind(teil, "tcStyle", "fill"), farben);
      if (fuellung === undefined && kind(teil, "tcStyle", "fillRef")) fuellung = farbeLesen(kind(teil, "tcStyle", "fillRef"), farben);
      if (fuellung === null) st.fuellung = "transparent";
      else if (fuellung && !fuellung.bild) st.fuellung = fuellung;
    });
    var direkt = fuellungLesen(kind(tc, "tcPr"), farben);
    if (direkt === null) st.fuellung = "transparent";
    else if (direkt && !direkt.bild) st.fuellung = direkt;
    var lauf = alle(tc, "r").filter(function (r) {
      return ((kind(r, "t") || {}).textContent || "").trim();
    })[0];
    var rPr = kind(lauf, "rPr");
    if (rPr) {
      if (rPr.getAttribute("b")) st.fett = /^(1|true)$/.test(rPr.getAttribute("b"));
      if (rPr.getAttribute("i")) st.kursiv = /^(1|true)$/.test(rPr.getAttribute("i"));
      if (rPr.getAttribute("u") && rPr.getAttribute("u") !== "none") st.unterstrichen = true;
      var eigen = farbeLesen(kind(rPr, "solidFill"), farben);
      if (eigen) st.farbe = eigen;
    }
    var algn = { ctr: "center", r: "right", just: "justify", dist: "justify" }[(kind(tc, "txBody", "p", "pPr") || { getAttribute: function () {} }).getAttribute("algn")];
    if (algn) st.ausrichtung = algn;
    return st;
  }

  var EFFEKT_NACH_ID = { 2: "fliegen", 12: "fliegen", 22: "wischen", 23: "zoomen", 53: "zoomen", 21: "zoomen" };

  function uebergangLesen(sld) {
    var uebergaenge = alle(sld, "transition");
    for (var i = uebergaenge.length - 1; i >= 0; i--) {
      var art = (uebergaenge[i].firstElementChild || {}).localName;
      if (!art || art === "sndAc" || art === "extLst") continue;
      if (/^(push|cover|pull|ripple|conveyor|pan|gallery|switch|flip|ferris|reveal)$/.test(art)) return "schieben";
      if (/^(wipe|split|blinds|strips|checker|comb|randomBar|vortex|shred|curtains|wind|prism|doors|window)$/.test(art)) return "wischen";
      if (/^(circle|zoom|wheel|wheelReverse|wedge|plus|diamond|flash|honeycomb|glitter|warp)$/.test(art)) return "kreis";
      return "blenden";
    }
    return "";
  }

  // ---------- Lesen ----------

  /**
   * Liest die .pptx-Datei und liefert ein Tafel-Paket. Im Feld «hinweis» steht,
   * was nicht übernommen wurde.
   */
  function lesen(datei) {
    var zwischenspeicher = {};
    var zip;
    var praesentation;
    var medien = {};
    var medienNachPfad = {};
    var fehlt = {};
    var groesse = { cx: 12192000, cy: 6858000 };
    var basis;
    var standardText;
    var tabellenStile = null;

    function fehlen(einzahl, mehrzahl) {
      var f = (fehlt[mehrzahl] = fehlt[mehrzahl] || { anzahl: 0, einzahl: einzahl });
      f.anzahl++;
    }

    function teil(pfad) {
      return teilLesen(zip, pfad, zwischenspeicher);
    }

    /** Speichert eine Datei aus dem Archiv als Medium (einmal pro Datei) */
    function medium(pfad) {
      if (medienNachPfad[pfad]) return medienNachPfad[pfad];
      var name = pfad.replace(/.*\//, "");
      var endung = name.replace(/.*\./, "").toLowerCase();
      var typ = {
        png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", bmp: "image/bmp", svg: "image/svg+xml",
        webp: "image/webp", mp4: "video/mp4", m4v: "video/mp4", mov: "video/quicktime", webm: "video/webm"
      }[endung];
      if (!typ) return Promise.resolve(null);
      medienNachPfad[pfad] = zip.lesen(pfad).then(function (bytes) {
        if (!bytes) return null;
        return W.dateiLesen(new Blob([bytes], { type: typ })).then(function (url) {
          var id = W.neueId("m");
          medien[id] = { daten: url, name: name };
          return id;
        });
      });
      return medienNachPfad[pfad];
    }

    /** Platzhalter (Titel, Inhalt, …) im Layout oder Master finden */
    function platzhalterIn(baum, ph) {
      if (!baum || !ph) return null;
      var typ = ph.getAttribute("type") || "body";
      var idx = ph.getAttribute("idx");
      var nachTyp = null;
      var formen = alle(baum, "sp");
      for (var i = 0; i < formen.length; i++) {
        var p = kind(formen[i], "nvSpPr", "nvPr", "ph");
        if (!p) continue;
        var t = p.getAttribute("type") || "body";
        if (idx != null && p.getAttribute("idx") === idx && (t === typ || !ph.getAttribute("type"))) return formen[i];
        if (!nachTyp && (t === typ || (typ === "ctrTitle" && t === "title") || (typ === "subTitle" && t === "body") || (typ === "obj" && t === "body"))) nachTyp = formen[i];
      }
      if (nachTyp) return nachTyp;
      if (idx != null) {
        for (var j = 0; j < formen.length; j++) {
          var q = kind(formen[j], "nvSpPr", "nvPr", "ph");
          if (q && q.getAttribute("idx") === idx) return formen[j];
        }
      }
      return null;
    }

    function folieLesen(pfad, nr) {
      var seite = { id: W.neueId("s"), titel: "", hintergrund: "weiss", elemente: [], striche: [] };
      var nachId = {};
      var z = 0;

      return teil(pfad).then(function (folie) {
        if (!folie.wurzel) throw new Error("Folie " + nr + " lässt sich nicht lesen.");
        var layoutRel = relVomTyp(folie, "slideLayout");
        return (layoutRel ? teil(layoutRel.ziel) : Promise.resolve(null)).then(function (layout) {
          var masterRel = layout && relVomTyp(layout, "slideMaster");
          return (masterRel ? teil(masterRel.ziel) : Promise.resolve(null)).then(function (master) {
            var themaRel = master && relVomTyp(master, "theme");
            return (themaRel ? teil(themaRel.ziel) : Promise.resolve(null)).then(function (thema) {
              return folieBauen(folie, layout, master, thema);
            });
          });
        });
      });

      function folieBauen(folie, layout, master, thema) {
        var farben = farbenVon(master, thema);
        var arbeit = [];
        var sld = folie.wurzel;
        if (sld.getAttribute("show") === "0") seite.ausgeblendet = true;
        var uebergang = uebergangLesen(sld);
        if (uebergang) seite.uebergang = uebergang;

        // Hintergrund: Folie, sonst Layout, sonst Master
        var hgTeil = null;
        var hg = null;
        [folie, layout, master].some(function (t) {
          hg = t && t.wurzel && kind(t.wurzel, "cSld", "bg");
          hgTeil = t;
          return !!hg;
        });
        if (hg) {
          var bgPr = kind(hg, "bgPr");
          var fuell = bgPr ? fuellungLesen(bgPr, farben) : farbeLesen(kind(hg, "bgRef"), farben);
          if (fuell && fuell.bild) {
            var rel = hgTeil.rels[fuell.bild];
            if (rel && !rel.extern) {
              arbeit.push(
                medium(rel.ziel).then(function (id) {
                  if (!id) return;
                  seite.hintergrund = "eigen";
                  seite.hgBild = id;
                  seite.hgFarbe = seite.hgFarbe || "#ffffff";
                })
              );
            }
          } else if (fuell && fuell !== "#ffffff") {
            seite.hintergrund = "eigen";
            seite.hgFarbe = fuell;
          }
        }

        // Massstab: Folie mittig auf 1600 x 900
        var s = Math.min(BREITE / groesse.cx, HOEHE / groesse.cy);
        basis = { sx: s, sy: s, dx: (BREITE - groesse.cx * s) / 2, dy: (HOEHE - groesse.cy * s) / 2, s: s };

        var layoutBaum = layout && layout.wurzel && kind(layout.wurzel, "cSld", "spTree");
        var masterBaum = master && master.wurzel && kind(master.wurzel, "cSld", "spTree");
        var mitMaster = sld.getAttribute("showMasterSp") !== "0";
        if (mitMaster && master && layout && layout.wurzel.getAttribute("showMasterSp") !== "0") baumLesen(masterBaum, basis, master, null, true);
        if (mitMaster && layout) baumLesen(layoutBaum, basis, layout, null, true);
        baumLesen(kind(sld, "cSld", "spTree"), basis, folie, { layout: layoutBaum, master: masterBaum, txStyles: master && kind(master.wurzel, "txStyles") }, false);
        animationenLesen(sld);

        // Notizen
        var notizRel = relVomTyp(folie, "notesSlide");
        if (notizRel) {
          arbeit.push(
            teil(notizRel.ziel).then(function (notiz) {
              if (!notiz.wurzel) return;
              var text = [];
              alle(notiz.wurzel, "sp").forEach(function (sp) {
                var ph = kind(sp, "nvSpPr", "nvPr", "ph");
                if (!ph || ph.getAttribute("type") !== "body") return;
                kinder(kind(sp, "txBody"), "p").forEach(function (p) {
                  text.push(
                    alle(p, "t")
                      .map(function (t) {
                        return t.textContent;
                      })
                      .join("")
                  );
                });
              });
              var notizen = text.join("\n").trim();
              if (notizen) seite.notizen = notizen;
            })
          );
        }

        return Promise.all(arbeit.concat(seite.elemente.map(function (e) {
          return e._warten;
        }))).then(function () {
          seite.elemente = seite.elemente.filter(function (e) {
            var ok = !e._weg;
            delete e._warten;
            delete e._weg;
            return ok;
          });
          return seite;
        });

        // ----- Formen eines Baums (Folie, Layout, Master oder Gruppe) -----

        function lage(xfrm, t) {
          var off = kind(xfrm, "off");
          var ext = kind(xfrm, "ext");
          if (!off || !ext) return null;
          return {
            x: Math.round(t.dx + t.sx * zahl(off, "x", 0)),
            y: Math.round(t.dy + t.sy * zahl(off, "y", 0)),
            b: Math.max(1, Math.round(t.sx * zahl(ext, "cx", 0))),
            h: Math.max(1, Math.round(t.sy * zahl(ext, "cy", 0)))
          };
        }

        function neu(typ, l, daten, id, nurDeko) {
          var e = { id: W.neueId("e"), typ: typ, x: l.x, y: l.y, b: Math.max(l.b, 40), h: Math.max(l.h, 40), z: ++z, daten: daten };
          seite.elemente.push(e);
          if (id && !nurDeko) nachId[id] = e;
          return e;
        }

        function baumLesen(baum, t, quelle, vorlagen, nurDeko) {
          kinder(baum).forEach(function (k) {
            formLesen(k, t, quelle, vorlagen, nurDeko);
          });
        }

        function formLesen(k, t, quelle, vorlagen, nurDeko) {
          var art = k.localName;
          if (art === "AlternateContent") {
            var wahl = kind(k, "Fallback") || kind(k, "Choice");
            baumLesen(wahl, t, quelle, vorlagen, nurDeko);
          } else if (art === "grpSp") {
            var gx = kind(k, "grpSpPr", "xfrm");
            var off = kind(gx, "off"), ext = kind(gx, "ext"), chOff = kind(gx, "chOff"), chExt = kind(gx, "chExt");
            var t2 = t;
            if (off && ext && chOff && chExt) {
              var fx = zahl(chExt, "cx", 0) ? zahl(ext, "cx", 0) / zahl(chExt, "cx", 1) : 1;
              var fy = zahl(chExt, "cy", 0) ? zahl(ext, "cy", 0) / zahl(chExt, "cy", 1) : 1;
              t2 = {
                sx: t.sx * fx,
                sy: t.sy * fy,
                dx: t.dx + t.sx * (zahl(off, "x", 0) - zahl(chOff, "x", 0) * fx),
                dy: t.dy + t.sy * (zahl(off, "y", 0) - zahl(chOff, "y", 0) * fy),
                s: t.s
              };
            }
            baumLesen(k, t2, quelle, vorlagen, nurDeko);
          } else if (art === "sp") {
            formAusSp(k, t, quelle, vorlagen, nurDeko);
          } else if (art === "cxnSp") {
            linie(k, t, kind(k, "spPr"), kind(k, "style"));
          } else if (art === "pic") {
            bildAusPic(k, t, quelle, nurDeko);
          } else if (art === "graphicFrame") {
            rahmenLesen(k, t);
          } else if (art === "contentPart") {
            fehlen("Freihandzeichnung", "Freihandzeichnungen");
          }
        }

        function linie(k, t, spPr, stil) {
          var l = lage(kind(spPr, "xfrm"), t);
          if (!l) return;
          var ln = kind(spPr, "ln");
          var farbe = ln ? fuellungLesen(ln, farben) : undefined;
          if (farbe === null) return;
          if (farbe === undefined || (farbe && farbe.bild)) farbe = farbeLesen(kind(stil, "lnRef"), farben) || "#1f2933";
          var dicke = Math.max(2, Math.round(zahl(ln, "w", 12700) * t.s));
          var xfrm = kind(spPr, "xfrm");
          var x1 = l.x, y1 = l.y, x2 = l.x + l.b, y2 = l.y + l.h;
          if (xfrm.getAttribute("flipH") === "1") { x1 = x2; x2 = l.x; }
          if (xfrm.getAttribute("flipV") === "1") { y1 = y2; y2 = l.y; }
          seite.striche.push({ werkzeug: "stift", farbe: farbe, dicke: dicke, punkte: [x1, y1, x2, y2] });
        }

        function formAusSp(sp, t, quelle, vorlagen, nurDeko) {
          var ph = kind(sp, "nvSpPr", "nvPr", "ph");
          // Platzhalter in Master und Layout zeigen nur Beispieltext
          if (ph && nurDeko) return;
          var id = zahl(kind(sp, "nvSpPr", "cNvPr"), "id", null);
          var spPr = kind(sp, "spPr");
          var stil = kind(sp, "style");
          var vorLayout = ph && vorlagen ? platzhalterIn(vorlagen.layout, ph) : null;
          var vorMaster = ph && vorlagen ? platzhalterIn(vorlagen.master, vorLayout ? kind(vorLayout, "nvSpPr", "nvPr", "ph") || ph : ph) : null;
          // Ohne eigene Lage gilt die des Platzhalters im Layout oder Master (in Folienkoordinaten)
          var l = kind(spPr, "xfrm") ? lage(kind(spPr, "xfrm"), t) : lage(kind(vorLayout, "spPr", "xfrm") || kind(vorMaster, "spPr", "xfrm"), basis);
          if (!l) return;
          var geo = kind(spPr, "prstGeom");
          var prst = geo ? geo.getAttribute("prst") : kind(spPr, "custGeom") ? "eigen" : "rect";
          if (prst === "line" || /Connector/.test(prst)) {
            linie(sp, t, spPr, stil);
            return;
          }

          // Listenstile von innen nach aussen: Form, Layout, Master, dann allgemein
          var phTyp = ph ? ph.getAttribute("type") || "body" : null;
          var istTitel = /^(title|ctrTitle)$/.test(phTyp);
          var lokal = [kind(sp, "txBody", "lstStyle")];
          var allgemein = [];
          if (ph) {
            lokal.push(kind(vorLayout, "txBody", "lstStyle"), kind(vorMaster, "txBody", "lstStyle"));
            var ts = vorlagen && vorlagen.txStyles;
            allgemein.push(istTitel ? kind(ts, "titleStyle") : /^(body|subTitle|obj)$/.test(phTyp) ? kind(ts, "bodyStyle") : kind(ts, "otherStyle"));
          }
          allgemein.push(standardText);
          var schriftFarbe = farbeLesen(kind(stil, "fontRef"), farben);
          var text = textLesen(kind(sp, "txBody"), lokal.filter(Boolean), allgemein.filter(Boolean), farben, schriftFarbe);
          if (text && istTitel && !seite.titel) seite.titel = text.text.replace(/\s+/g, " ").trim().slice(0, 80);

          var fuell = fuellungLesen(spPr, farben);
          if (fuell === undefined && ph) fuell = fuellungLesen(kind(vorLayout, "spPr"), farben);
          if (fuell === undefined) fuell = farbeLesen(zahl(kind(stil, "fillRef"), "idx", 0) ? kind(stil, "fillRef") : null, farben);
          var ln = kind(spPr, "ln");
          var rand = ln ? fuellungLesen(ln, farben) : undefined;
          if (rand === undefined) rand = zahl(kind(stil, "lnRef"), "idx", 0) ? farbeLesen(kind(stil, "lnRef"), farben) : null;
          var randDicke = rand ? Math.max(1, Math.round(zahl(ln, "w", 12700) * basis.s)) : 0;

          if (fuell && fuell.bild) {
            // Form mit Bild gefüllt: als Bild übernehmen
            var r = quelle.rels[fuell.bild];
            if (!r || r.extern) return;
            var e = neu("bild", l, { name: (kind(sp, "nvSpPr", "cNvPr") || sp).getAttribute("name") || "Bild" }, id, nurDeko);
            e._warten = medium(r.ziel).then(function (m) {
              if (m) e.daten.medium = m;
              else e._weg = true;
            });
            return;
          }
          if (!text && !fuell && !rand) return;

          var daten = {};
          if (text) {
            daten.text = text.text;
            daten.groesse = Math.max(8, Math.round(text.groesse * EMU_PUNKT * basis.s));
            if (text.fett) daten.fett = true;
            if (text.kursiv) daten.kursiv = true;
            if (text.unterstrichen) daten.unterstrichen = true;
            if (text.farbe) daten.farbe = text.farbe;
            if (text.schrift) daten.schrift = text.schrift;
            if (text.liste) daten.liste = text.liste;
            var laeufe = laeufeUmrechnen(text.laeufe, daten.groesse);
            if (laeufe) daten.laeufe = laeufe;
          }
          if (fuell || rand || (prst !== "rect" && prst !== "eigen")) {
            var form = formWert(prst);
            var bodyPr = kind(sp, "txBody", "bodyPr");
            var anker = (bodyPr && bodyPr.getAttribute("anchor")) || (kind(vorLayout, "txBody", "bodyPr") || { getAttribute: function () {} }).getAttribute("anchor") || "t";
            daten.form = form;
            daten.fuellung = fuell || "keine";
            daten.rand = rand || "#065a82";
            daten.randDicke = randDicke;
            daten.vertikal = { t: "oben", b: "unten" }[anker] || "mitte";
            // Formen zentrieren ohne Angabe, PowerPoint richtet dann links aus
            if (text) daten.ausrichtung = text.ausrichtung || "left";
            else daten.text = "";
            neu("form", l, daten, id, nurDeko);
            return;
          }
          if (text && text.ausrichtung) daten.ausrichtung = text.ausrichtung;
          neu("text", l, daten, id, nurDeko);
        }

        /** Grössen der Läufe von pt in Punkte der Tafel; null, wenn nichts mehr abweicht */
        function laeufeUmrechnen(laeufe, groesse) {
          if (!laeufe) return null;
          var abweichung = false;
          var liste = laeufe.map(function (l) {
            var lauf = Object.assign({}, l);
            if (lauf.groesse != null) {
              lauf.groesse = Math.max(8, Math.round(lauf.groesse * EMU_PUNKT * basis.s));
              if (lauf.groesse === groesse) delete lauf.groesse;
            }
            if (Object.keys(lauf).length > 1) abweichung = true;
            return lauf;
          });
          return abweichung ? liste : null;
        }

        function bildAusPic(pic, t, quelle, nurDeko) {
          var l = lage(kind(pic, "spPr", "xfrm"), t);
          if (!l) return;
          var cNvPr = kind(pic, "nvPicPr", "cNvPr");
          var id = zahl(cNvPr, "id", null);
          var nvPr = kind(pic, "nvPicPr", "nvPr");
          var titel = (cNvPr && (cNvPr.getAttribute("descr") || cNvPr.getAttribute("name"))) || "";
          // Video oder Audio
          var video = kind(nvPr, "videoFile");
          var audio = kind(nvPr, "audioFile");
          var medienTeil = alle(nvPr, "media")[0];
          if (video || medienTeil) {
            var rel = quelle.rels[rId(video, "link")] || quelle.rels[rId(medienTeil, "embed")] || quelle.rels[rId(medienTeil, "link")];
            if (rel && rel.extern) {
              var erkannt = E.erkennen(rel.ziel, "link");
              if (erkannt && erkannt.typ === "video") {
                erkannt.daten.titel = titel;
                neu("video", l, erkannt.daten, id, nurDeko);
                return;
              }
              if (erkannt) {
                neu("link", l, { url: erkannt.daten.url || rel.ziel, titel: titel }, id, nurDeko);
                return;
              }
            } else if (rel && /\.(mp4|m4v|mov|webm)$/i.test(rel.ziel)) {
              var v = neu("video", l, { art: "datei", name: rel.ziel.replace(/.*\//, ""), titel: titel }, id, nurDeko);
              v._warten = medium(rel.ziel).then(function (m) {
                if (m) v.daten.medium = m;
                else v._weg = true;
              });
              return;
            }
            fehlen("Video", "Videos");
            return;
          }
          if (audio) {
            fehlen("Audiodatei", "Audiodateien");
            return;
          }
          var blip = kind(pic, "blipFill", "blip");
          var bildRel = quelle.rels[rId(blip, "embed")];
          if (!bildRel || bildRel.extern) {
            if (bildRel && bildRel.extern) neu("bild", l, { src: bildRel.ziel, name: titel }, id, nurDeko);
            return;
          }
          if (!/\.(png|jpe?g|gif|bmp|svg|webp)$/i.test(bildRel.ziel)) {
            fehlen("Grafik im Windows-Format (EMF/WMF)", "Grafiken im Windows-Format (EMF/WMF)");
            return;
          }
          var e = neu("bild", l, { name: titel || "Bild" }, id, nurDeko);
          e._warten = medium(bildRel.ziel).then(function (m) {
            if (m) e.daten.medium = m;
            else e._weg = true;
          });
        }

        function rahmenLesen(rahmen, t) {
          var daten = kind(rahmen, "graphic", "graphicData");
          var uri = (daten && daten.getAttribute("uri")) || "";
          var l = lage(kind(rahmen, "xfrm"), t);
          if (/table$/.test(uri) && l) {
            var tbl = kind(daten, "tbl");
            var tblPr = kind(tbl, "tblPr");
            var reihen = kinder(tbl, "tr");
            var zellen = reihen.map(function (tr) {
              return kinder(tr, "tc").map(function (tc) {
                return kinder(kind(tc, "txBody"), "p")
                  .map(function (p) {
                    return alle(p, "t")
                      .map(function (x) {
                        return x.textContent;
                      })
                      .join("");
                  })
                  .join("\n")
                  .trim();
              });
            });
            if (!zellen.length || !zellen[0].length) return;
            var spalten = Math.max.apply(null, zellen.map(function (z) { return z.length; }));
            zellen.forEach(function (z) {
              while (z.length < spalten) z.push("");
            });
            var erste = alle(tbl, "rPr").filter(function (r) {
              return r.getAttribute("sz");
            })[0];
            var tdaten = {
              zellen: zellen,
              kopf: zahl(tblPr, "firstRow", 0) === 1,
              groesse: Math.max(10, Math.round(zahl(erste, "sz", 1800) / 100 * EMU_PUNKT * basis.s))
            };
            // Farben und Fettdruck: aus dem Tabellenstil und direkt an den Zellen
            var stilId = ((kind(tblPr, "tableStyleId") || {}).textContent || "").trim();
            var vorlage = kinder(tabellenStile, "tblStyle").filter(function (t) {
              return t.getAttribute("styleId") === stilId;
            })[0];
            if (!vorlage && stilId === "{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}") vorlage = new DOMParser().parseFromString(STANDARD_TABELLE, "application/xml").documentElement;
            var mitFormat = false;
            var stile = reihen.map(function (tr, z) {
              return zellen[z].map(function (wert, s) {
                var tc = kinder(tr, "tc")[s];
                if (!tc) return null;
                var st = zellStilLesen(tc, vorlage, tabellenTeile(tblPr, z, s, reihen.length, spalten), farben);
                if (!Object.keys(st).length) return null;
                mitFormat = true;
                return st;
              });
            });
            if (mitFormat) {
              // Ohne eigene Füllung auch keine Streifen der Wandtafel, damit es wie in PowerPoint aussieht
              var flaechig = stile.some(function (zeile) {
                return zeile.some(function (st) {
                  return st && st.fuellung;
                });
              });
              if (flaechig) {
                stile = stile.map(function (zeile) {
                  return zeile.map(function (st) {
                    st = st || {};
                    if (!st.fuellung) st.fuellung = "transparent";
                    if (!st.farbe) st.farbe = farben.text || "#1f2933";
                    return st;
                  });
                });
              }
              tdaten.stile = stile;
            }
            // Die Tabelle der Wandtafel hat innen 8 Punkte Rand
            neu("tabelle", { x: l.x - 8, y: l.y - 8, b: l.b + 16, h: l.h + 16 }, tdaten, zahl(kind(rahmen, "nvGraphicFramePr", "cNvPr"), "id", null), false);
          } else if (/chart/.test(uri)) fehlen("Diagramm", "Diagramme");
          else if (/diagram/.test(uri)) fehlen("SmartArt-Grafik", "SmartArt-Grafiken");
          else fehlen("eingebettetes Objekt", "eingebettete Objekte");
        }

        function animationenLesen(sld) {
          var folge = alle(sld, "cTn").filter(function (c) {
            return c.getAttribute("nodeType") === "mainSeq";
          })[0];
          if (!folge) return;
          kinder(kind(folge, "childTnLst"), "par").forEach(function (schritt, i) {
            alle(schritt, "cTn").forEach(function (c) {
              if (c.getAttribute("presetClass") !== "entr") return;
              var ziel = alle(c, "spTgt")[0];
              var e = ziel && nachId[ziel.getAttribute("spid")];
              if (!e || e.anim) return;
              e.anim = { effekt: EFFEKT_NACH_ID[c.getAttribute("presetID")] || "einblenden", nr: i + 1 };
            });
          });
        }
      }
    }

    function farbenVon(master, thema) {
      var farben = { thema: {}, zuordnung: {}, text: null, titelSchrift: "", textSchrift: "" };
      var schema = thema && thema.wurzel && alle(thema.wurzel, "clrScheme")[0];
      kinder(schema).forEach(function (f) {
        var c = f.firstElementChild;
        if (!c) return;
        farben.thema[f.localName] = c.getAttribute("val") === "windowText" || c.getAttribute("val") === "window" ? c.getAttribute("lastClr") : c.getAttribute("val") || c.getAttribute("lastClr");
      });
      var zuordnung = master && master.wurzel && kind(master.wurzel, "clrMap");
      ["bg1", "tx1", "bg2", "tx2", "accent1", "accent2", "accent3", "accent4", "accent5", "accent6", "hlink", "folHlink"].forEach(function (n) {
        farben.zuordnung[n] = (zuordnung && zuordnung.getAttribute(n)) || { bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2" }[n] || n;
      });
      var tx = farben.thema[farben.zuordnung.tx1];
      farben.text = tx ? "#" + tx.toLowerCase() : null;
      var schriften = thema && thema.wurzel && alle(thema.wurzel, "fontScheme")[0];
      farben.titelSchrift = (kind(schriften, "majorFont", "latin") || { getAttribute: function () { return ""; } }).getAttribute("typeface");
      farben.textSchrift = (kind(schriften, "minorFont", "latin") || { getAttribute: function () { return ""; } }).getAttribute("typeface");
      return farben;
    }

    return datei
      .arrayBuffer()
      .then(function (puffer) {
        zip = zipOeffnen(puffer);
        if (!zip.gibt("ppt/presentation.xml")) throw new Error("Das ist keine PowerPoint-Präsentation (.pptx).");
        return Promise.all([teil("ppt/presentation.xml"), teil("docProps/core.xml")]);
      })
      .then(function (r) {
        praesentation = r[0];
        var wurzel = praesentation.wurzel;
        var sz = kind(wurzel, "sldSz");
        if (sz) groesse = { cx: zahl(sz, "cx", groesse.cx), cy: zahl(sz, "cy", groesse.cy) };
        standardText = kind(wurzel, "defaultTextStyle");
        var stilRel = relVomTyp(praesentation, "tableStyles");
        return (stilRel ? teil(stilRel.ziel) : Promise.resolve(null)).then(function (t) {
          tabellenStile = t && t.wurzel;
          return r;
        });
      })
      .then(function (r) {
        var wurzel = praesentation.wurzel;
        var titel = r[1].wurzel ? (alle(r[1].wurzel, "title")[0] || {}).textContent : "";
        var folien = kinder(kind(wurzel, "sldIdLst"), "sldId")
          .map(function (s) {
            var rel = praesentation.rels[rId(s, "id")];
            return rel ? rel.ziel : null;
          })
          .filter(Boolean);
        if (!folien.length) throw new Error("Die Präsentation enthält keine Folien.");
        var seiten = [];
        return folien
          .reduce(function (kette, pfad, i) {
            return kette.then(function () {
              return folieLesen(pfad, i + 1).then(function (s) {
                seiten.push(s);
              });
            });
          }, Promise.resolve())
          .then(function () {
            var name = (datei.name || "").replace(/\.pptx$/i, "");
            var tafel = {
              id: W.neueId("t"),
              version: 1,
              titel: (titel || "").trim() || name || seiten[0].titel || "PowerPoint",
              erstellt: Date.now(),
              geaendert: Date.now(),
              seiten: seiten
            };
            var hinweis = Object.keys(fehlt).map(function (was) {
              return fehlt[was].anzahl + " " + (fehlt[was].anzahl === 1 ? fehlt[was].einzahl : was);
            });
            return {
              format: X.FORMAT,
              version: 1,
              art: "tafel",
              quelle: "pptx",
              hinweis: hinweis.length ? "Nicht übernommen: " + hinweis.join(", ") + "." : "",
              tafel: tafel,
              medien: medien
            };
          });
      });
  }

  /** Ist das eine PowerPoint-Datei? (Name oder Typ) */
  function istPptx(datei) {
    return !!datei && (/\.pptx$/i.test(datei.name || "") || datei.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation");
  }

  W.PptxLesen = { lesen: lesen, istPptx: istPptx, zipOeffnen: zipOeffnen };
})();
