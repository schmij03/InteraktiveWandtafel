/*
 * Export als PowerPoint-Datei (.pptx), ohne fremde Bibliothek.
 *
 * Eine .pptx-Datei ist ein ZIP-Archiv mit XML-Teilen (Office Open XML).
 * Jede Seite der Tafel wird eine Folie im Format 16:9:
 *   Text, Notiz, Form    Textfeld bzw. Form mit Text, bearbeitbar in PowerPoint
 *   Tabelle              PowerPoint-Tabelle
 *   Bild                 Bild (hochgeladene Bilder; Bilder aus dem Internet, wenn erlaubt)
 *   Zeichnung            durchsichtiges Bild ueber der Folie
 *   Hintergrund          Farbe oder Bild (Muster, Kork, eigenes Hintergrundbild)
 *   Video, Webseite, …   Karte mit Titel und anklickbarer Adresse
 * Dazu Notizen, Uebergaenge und ausgeblendete Seiten. Animationen und die
 * interaktiven Module (Timer, Lostopf, …) gibt es in PowerPoint so nicht.
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var S = W.Speicher;
  var E = W.Elemente;

  var BREITE = E.BREITE;
  var HOEHE = E.HOEHE;
  var EMU = 7620; // 12192000 EMU (13,33 Zoll) / 1600 Punkte
  var PUNKT = 60; // Schriftgroesse: 1 Punkt der Tafel = 0,6 pt, in Hundertstel

  var NS_A = "http://schemas.openxmlformats.org/drawingml/2006/main";
  var NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";
  var NS_P = "http://schemas.openxmlformats.org/presentationml/2006/main";
  var NS_REL = "http://schemas.openxmlformats.org/package/2006/relationships";
  var REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships/";
  var KOPF = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
  var WURZEL = ' xmlns:a="' + NS_A + '" xmlns:r="' + NS_R + '" xmlns:p="' + NS_P + '"';

  // ---------- ZIP (ohne Kompression) ----------

  var CRC_TABELLE = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(daten) {
    var c = 0xffffffff;
    for (var i = 0; i < daten.length; i++) c = CRC_TABELLE[(c ^ daten[i]) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  }

  /** dateien: [{ name, daten: Uint8Array }] -> Blob */
  function zip(dateien, typ) {
    var teile = [];
    var verzeichnis = [];
    var versatz = 0;
    var jetzt = new Date();
    var zeit = (jetzt.getHours() << 11) | (jetzt.getMinutes() << 5) | (jetzt.getSeconds() >> 1);
    var datum = ((jetzt.getFullYear() - 1980) << 9) | ((jetzt.getMonth() + 1) << 5) | jetzt.getDate();
    var kodierer = new TextEncoder();
    dateien.forEach(function (d) {
      var name = kodierer.encode(d.name);
      var crc = crc32(d.daten);
      var lokal = new DataView(new ArrayBuffer(30));
      lokal.setUint32(0, 0x04034b50, true);
      lokal.setUint16(4, 20, true);
      lokal.setUint16(6, 0x0800, true); // Namen in UTF-8
      lokal.setUint16(8, 0, true); // ohne Kompression
      lokal.setUint16(10, zeit, true);
      lokal.setUint16(12, datum, true);
      lokal.setUint32(14, crc, true);
      lokal.setUint32(18, d.daten.length, true);
      lokal.setUint32(22, d.daten.length, true);
      lokal.setUint16(26, name.length, true);
      lokal.setUint16(28, 0, true);
      teile.push(new Uint8Array(lokal.buffer), name, d.daten);

      var zentral = new DataView(new ArrayBuffer(46));
      zentral.setUint32(0, 0x02014b50, true);
      zentral.setUint16(4, 20, true);
      zentral.setUint16(6, 20, true);
      zentral.setUint16(8, 0x0800, true);
      zentral.setUint16(10, 0, true);
      zentral.setUint16(12, zeit, true);
      zentral.setUint16(14, datum, true);
      zentral.setUint32(16, crc, true);
      zentral.setUint32(20, d.daten.length, true);
      zentral.setUint32(24, d.daten.length, true);
      zentral.setUint16(28, name.length, true);
      zentral.setUint32(42, versatz, true);
      verzeichnis.push(new Uint8Array(zentral.buffer), name);
      versatz += 30 + name.length + d.daten.length;
    });
    var groesse = verzeichnis.reduce(function (s, t) {
      return s + t.length;
    }, 0);
    var ende = new DataView(new ArrayBuffer(22));
    ende.setUint32(0, 0x06054b50, true);
    ende.setUint16(8, dateien.length, true);
    ende.setUint16(10, dateien.length, true);
    ende.setUint32(12, groesse, true);
    ende.setUint32(16, versatz, true);
    return new Blob(teile.concat(verzeichnis, [new Uint8Array(ende.buffer)]), { type: typ });
  }

  // ---------- Hilfen ----------

  function x(text) {
    return String(text == null ? "" : text)
      .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f￾￿]/g, "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function emu(wert) {
    return Math.round(wert * EMU);
  }

  function farbe(wert, ersatz) {
    var m = String(wert || "").match(/^#?([0-9a-f]{6})$/i);
    if (m) return m[1].toUpperCase();
    var kurz = String(wert || "").match(/^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i);
    if (kurz) return (kurz[1] + kurz[1] + kurz[2] + kurz[2] + kurz[3] + kurz[3]).toUpperCase();
    return ersatz;
  }

  function fuellung(hex) {
    return hex ? '<a:solidFill><a:srgbClr val="' + hex + '"/></a:solidFill>' : "<a:noFill/>";
  }

  function xfrm(x0, y0, b, h, prefix) {
    var p = prefix || "a";
    return "<" + p + ':xfrm><a:off x="' + emu(x0) + '" y="' + emu(y0) + '"/><a:ext cx="' + emu(Math.max(1, b)) + '" cy="' + emu(Math.max(1, h)) + '"/></' + p + ":xfrm>";
  }

  function rels(liste) {
    return (
      KOPF +
      '<Relationships xmlns="' + NS_REL + '">' +
      liste
        .map(function (r) {
          return '<Relationship Id="' + r.id + '" Type="' + REL + r.typ + '" Target="' + x(r.ziel) + '"' + (r.extern ? ' TargetMode="External"' : "") + "/>";
        })
        .join("") +
      "</Relationships>"
    );
  }

  var LEER_GRUPPE =
    '<p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>';

  var FARBZUORDNUNG = 'bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"';

  function thema(name) {
    var linie = function (w) {
      return '<a:ln w="' + w + '"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln>';
    };
    var flaeche = '<a:solidFill><a:schemeClr val="phClr"/></a:solidFill>';
    var schrift = '<a:latin typeface="Calibri"/><a:ea typeface=""/><a:cs typeface=""/>';
    return (
      KOPF +
      '<a:theme xmlns:a="' + NS_A + '" name="' + name + '"><a:themeElements>' +
      '<a:clrScheme name="Wandtafel"><a:dk1><a:srgbClr val="1F2933"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="21295C"/></a:dk2><a:lt2><a:srgbClr val="EEF3F6"/></a:lt2>' +
      '<a:accent1><a:srgbClr val="065A82"/></a:accent1><a:accent2><a:srgbClr val="E4572E"/></a:accent2><a:accent3><a:srgbClr val="2E7D32"/></a:accent3><a:accent4><a:srgbClr val="7B3FA0"/></a:accent4><a:accent5><a:srgbClr val="22B5B7"/></a:accent5><a:accent6><a:srgbClr val="FDE725"/></a:accent6>' +
      '<a:hlink><a:srgbClr val="065A82"/></a:hlink><a:folHlink><a:srgbClr val="7B3FA0"/></a:folHlink></a:clrScheme>' +
      '<a:fontScheme name="Wandtafel"><a:majorFont>' + schrift + "</a:majorFont><a:minorFont>" + schrift + "</a:minorFont></a:fontScheme>" +
      '<a:fmtScheme name="Wandtafel"><a:fillStyleLst>' + flaeche + flaeche + flaeche + "</a:fillStyleLst>" +
      "<a:lnStyleLst>" + linie(6350) + linie(12700) + linie(19050) + "</a:lnStyleLst>" +
      "<a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst>" +
      "<a:bgFillStyleLst>" + flaeche + flaeche + flaeche + "</a:bgFillStyleLst></a:fmtScheme>" +
      "</a:themeElements><a:objectDefaults/><a:extraClrSchemeLst/></a:theme>"
    );
  }

  // ---------- Bilder ----------

  function bildLaden(blob) {
    return new Promise(function (ok, fehler) {
      var url = URL.createObjectURL(blob);
      var bild = new Image();
      bild.onload = function () {
        ok({ bild: bild, url: url });
      };
      bild.onerror = function () {
        URL.revokeObjectURL(url);
        fehler(new Error("Bild nicht lesbar"));
      };
      bild.src = url;
    });
  }

  function leinwandZuPng(c) {
    return new Promise(function (ok) {
      c.toBlob(function (blob) {
        blob.arrayBuffer().then(function (puffer) {
          ok(new Uint8Array(puffer));
        });
      }, "image/png");
    });
  }

  /** Bild als PNG, JPEG oder GIF fuer PowerPoint, mit Groesse in Pixeln */
  function bildFuerPptx(blob) {
    return bildLaden(blob).then(function (r) {
      var b = r.bild.naturalWidth || 800;
      var h = r.bild.naturalHeight || 600;
      var endung = { "image/png": "png", "image/jpeg": "jpeg", "image/gif": "gif" }[blob.type];
      var fertig = endung
        ? blob.arrayBuffer().then(function (puffer) {
            return new Uint8Array(puffer);
          })
        : (function () {
            // SVG, WebP und andere als PNG
            var c = document.createElement("canvas");
            var f = Math.min(1, 2400 / Math.max(b, h));
            c.width = Math.round(b * f) || 800;
            c.height = Math.round(h * f) || 600;
            c.getContext("2d").drawImage(r.bild, 0, 0, c.width, c.height);
            endung = "png";
            return leinwandZuPng(c);
          })();
      return fertig.then(function (daten) {
        URL.revokeObjectURL(r.url);
        return { daten: daten, endung: endung, b: b, h: h, bild: r.bild };
      });
    });
  }

  function blobVon(element) {
    if (element.daten.medium) {
      return S.medium(element.daten.medium).then(function (m) {
        return m ? m.blob : null;
      });
    }
    if (!element.daten.src) return Promise.resolve(null);
    // Bilder aus dem Internet nur, wenn die Seite es erlaubt (CORS)
    return fetch(element.daten.src, { mode: "cors" })
      .then(function (antwort) {
        return antwort.ok ? antwort.blob() : null;
      })
      .catch(function () {
        return null;
      });
  }

  // ---------- Hintergrund ----------

  var HG_FARBEN = { weiss: "FFFFFF", kariert: "FFFFFF", liniert: "FFFFFF", punkte: "FFFFFF", gruen: "2C4F3C", dunkel: "21295C", kork: "C89A63" };

  function musterMalen(ctx, art, linie) {
    ctx.save();
    ctx.strokeStyle = linie;
    ctx.fillStyle = linie;
    ctx.lineWidth = 1;
    var i;
    if (art === "kariert") {
      for (i = 0; i <= BREITE; i += 40) ctx.fillRect(i, 0, 1, HOEHE);
      for (i = 0; i <= HOEHE; i += 40) ctx.fillRect(0, i, BREITE, 1);
    } else if (art === "liniert") {
      for (i = 59; i <= HOEHE; i += 60) ctx.fillRect(0, i, BREITE, 1);
    } else if (art === "punkte") {
      for (var px = 20; px < BREITE; px += 40) {
        for (var py = 20; py < HOEHE; py += 40) {
          ctx.beginPath();
          ctx.arc(px, py, 1.7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
    ctx.restore();
  }

  /** Hintergrund als Farbe (hex) oder, wenn noetig, als Bild (PNG) */
  function hintergrund(seite) {
    var art = seite.hintergrund || "weiss";
    if (art !== "eigen" && art !== "kariert" && art !== "liniert" && art !== "punkte" && art !== "gruen" && art !== "kork") {
      return Promise.resolve({ farbe: HG_FARBEN[art] || "FFFFFF" });
    }
    if (art === "eigen" && !seite.hgMuster && !seite.hgBild) return Promise.resolve({ farbe: farbe(seite.hgFarbe, "FFFFFF") });
    var c = document.createElement("canvas");
    c.width = BREITE;
    c.height = HOEHE;
    var ctx = c.getContext("2d");
    var weiter = Promise.resolve();
    if (art === "gruen") {
      var verlauf = ctx.createRadialGradient(800, 360, 0, 800, 360, 1000);
      verlauf.addColorStop(0, "#3f6b52");
      verlauf.addColorStop(1, "#2c4f3c");
      ctx.fillStyle = verlauf;
      ctx.fillRect(0, 0, BREITE, HOEHE);
    } else if (art === "kork") {
      ctx.fillStyle = "#c89a63";
      ctx.fillRect(0, 0, BREITE, HOEHE);
      ctx.fillStyle = "rgba(90, 50, 10, 0.25)";
      for (var kx = 7; kx < BREITE; kx += 14) for (var ky = 7; ky < HOEHE; ky += 14) ctx.fillRect(kx, ky, 2, 2);
    } else if (art === "eigen") {
      var hex = "#" + farbe(seite.hgFarbe, "FFFFFF");
      ctx.fillStyle = hex;
      ctx.fillRect(0, 0, BREITE, HOEHE);
      if (seite.hgBild) {
        weiter = S.medium(seite.hgBild)
          .then(function (m) {
            return m ? bildLaden(m.blob) : null;
          })
          .then(function (r) {
            if (!r) return;
            // wie background-size: cover
            var f = Math.max(BREITE / r.bild.naturalWidth, HOEHE / r.bild.naturalHeight);
            var b = r.bild.naturalWidth * f;
            var h = r.bild.naturalHeight * f;
            ctx.drawImage(r.bild, (BREITE - b) / 2, (HOEHE - h) / 2, b, h);
            URL.revokeObjectURL(r.url);
          })
          .catch(function () {});
      }
      weiter = weiter.then(function () {
        var m = hex.match(/^#(..)(..)(..)$/);
        var hell = 0.299 * parseInt(m[1], 16) + 0.587 * parseInt(m[2], 16) + 0.114 * parseInt(m[3], 16) > 140;
        musterMalen(ctx, seite.hgMuster, hell ? "rgba(40, 70, 90, 0.22)" : "rgba(255, 255, 255, 0.22)");
      });
    } else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, BREITE, HOEHE);
      musterMalen(ctx, art, art === "punkte" ? "#9fb4c2" : "#cfdde6");
    }
    return weiter.then(function () {
      return leinwandZuPng(c).then(function (daten) {
        return { bild: { daten: daten, endung: "png" } };
      });
    });
  }

  // ---------- Text ----------

  /** Absaetze mit Schrift, Farbe und Stil des Elements */
  function absaetze(text, d, typ, link) {
    var groesse = Math.round((d.groesse || E.standardGroesse(typ)) * PUNKT);
    var schrift = E.schriftVon(d.schrift).pptx;
    var textfarbe = typ === "notiz" ? "1F2933" : farbe(d.farbe, "1F2933");
    var algn = { center: "ctr", right: "r", justify: "just" }[d.ausrichtung || (typ === "form" ? "center" : "")] || "l";
    var rPr =
      '<a:rPr lang="de-CH" sz="' + groesse + '"' + (d.fett ? ' b="1"' : "") + (d.kursiv ? ' i="1"' : "") + (d.unterstrichen ? ' u="sng"' : "") + ' dirty="0">' +
      fuellung(textfarbe) + '<a:latin typeface="' + x(schrift) + '"/>' + (link ? '<a:hlinkClick r:id="' + link + '"/>' : "") + "</a:rPr>";
    var aufzaehlung = "";
    if (d.liste === "punkte") aufzaehlung = ' marL="' + Math.round(groesse * 160) + '" indent="-' + Math.round(groesse * 160) + '"><a:buFont typeface="Arial"/><a:buChar char="•"/></a:pPr>';
    else if (d.liste === "nummern") aufzaehlung = ' marL="' + Math.round(groesse * 200) + '" indent="-' + Math.round(groesse * 200) + '"><a:buAutoNum type="arabicPeriod"/></a:pPr>';
    return String(text || "")
      .split("\n")
      .map(function (zeile) {
        var pPr = '<a:pPr algn="' + algn + '"' + (aufzaehlung || "/>");
        if (!zeile) return "<a:p>" + pPr + '<a:endParaRPr lang="de-CH" sz="' + groesse + '" dirty="0"/></a:p>';
        return "<a:p>" + pPr + "<a:r>" + rPr + "<a:t>" + x(zeile) + "</a:t></a:r></a:p>";
      })
      .join("");
  }

  function textKoerper(inhalt, anker, innen) {
    var i = innen || [10, 14, 10, 14];
    return (
      '<p:txBody><a:bodyPr wrap="square" lIns="' + emu(i[3]) + '" tIns="' + emu(i[0]) + '" rIns="' + emu(i[1]) + '" bIns="' + emu(i[2]) + '" anchor="' + (anker || "t") + '" rtlCol="0"><a:normAutofit/></a:bodyPr><a:lstStyle/>' +
      inhalt +
      "</p:txBody>"
    );
  }

  // ---------- Folie ----------

  function folieBauen(seite, nr, sammler) {
    var formen = [];
    var beziehungen = [{ id: "rId1", typ: "slideLayout", ziel: "../slideLayouts/slideLayout1.xml" }];
    var naechsteId = 2;

    function bildRel(bild) {
      var name = "bild" + ++sammler.bilder + "." + bild.endung;
      sammler.dateien.push({ name: "ppt/media/" + name, daten: bild.daten });
      sammler.endungen[bild.endung] = true;
      var id = "rId" + (beziehungen.length + 1);
      beziehungen.push({ id: id, typ: "image", ziel: "../media/" + name });
      return id;
    }

    function linkRel(url) {
      var id = "rId" + (beziehungen.length + 1);
      beziehungen.push({ id: id, typ: "hyperlink", ziel: url, extern: true });
      return id;
    }

    function form(name, lage, prst, fuell, rand, randDicke, text) {
      var id = naechsteId++;
      var linie = rand && randDicke > 0 ? '<a:ln w="' + Math.round(randDicke * 9525) + '">' + fuellung(rand) + "</a:ln>" : "<a:ln><a:noFill/></a:ln>";
      return (
        '<p:sp><p:nvSpPr><p:cNvPr id="' + id + '" name="' + x(name + " " + id) + '"/><p:cNvSpPr/><p:nvPr/></p:nvSpPr>' +
        "<p:spPr>" + xfrm(lage.x, lage.y, lage.b, lage.h) + '<a:prstGeom prst="' + prst + '"><a:avLst/></a:prstGeom>' + fuellung(fuell) + linie + "</p:spPr>" +
        (text || textKoerper('<a:p><a:endParaRPr lang="de-CH" dirty="0"/></a:p>')) +
        "</p:sp>"
      );
    }

    function bild(name, lage, relId, beschreibung) {
      var id = naechsteId++;
      return (
        '<p:pic><p:nvPicPr><p:cNvPr id="' + id + '" name="' + x(name + " " + id) + '" descr="' + x(beschreibung || name) + '"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr>' +
        '<p:blipFill><a:blip r:embed="' + relId + '"/><a:stretch><a:fillRect/></a:stretch></p:blipFill>' +
        "<p:spPr>" + xfrm(lage.x, lage.y, lage.b, lage.h) + '<a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic>'
      );
    }

    function karte(e, lage) {
      var d = e.daten;
      var titel = d.titel || d.name || "";
      var roh = d.url || d.src || "";
      var url = roh && /^https?:/i.test(roh) ? E.sicherUrl(roh) : null;
      var text = absaetze(E.NAMEN[e.typ] + (titel && titel !== E.NAMEN[e.typ] ? ": " + titel : ""), { groesse: 30, fett: true, farbe: "#065a82" }, "text");
      if (url) text += absaetze(url, { groesse: 22, farbe: "#065a82", unterstrichen: true }, "text", linkRel(url));
      else if (!d.medium) text += absaetze("interaktiv in der Wandtafel", { groesse: 22, kursiv: true, farbe: "#5b6770" }, "text");
      return form(E.NAMEN[e.typ], lage, "roundRect", "F4F8FA", "9FB4C2", 1, textKoerper(text, "ctr", [14, 18, 14, 18]));
    }

    function tabelle(e, lage) {
      var d = e.daten;
      var zellen = d.zellen || [[""]];
      var spalten = zellen[0].length;
      var spaltenBreite = Math.floor(emu(lage.b) / spalten);
      var zeilenHoehe = Math.floor(emu(lage.h) / zellen.length);
      var rand = function (seiteName) {
        return "<a:" + seiteName + ' w="12700"><a:solidFill><a:srgbClr val="9FB4C2"/></a:solidFill></a:' + seiteName + ">";
      };
      var id = naechsteId++;
      var raster = "";
      for (var s = 0; s < spalten; s++) raster += '<a:gridCol w="' + spaltenBreite + '"/>';
      var zeilen = zellen
        .map(function (zeile, z) {
          var kopf = z === 0 && d.kopf;
          var stil = Object.assign({}, d, kopf ? { fett: true, farbe: "#ffffff" } : {});
          return (
            '<a:tr h="' + zeilenHoehe + '">' +
            zeile
              .map(function (wert) {
                return (
                  '<a:tc><a:txBody><a:bodyPr/><a:lstStyle/>' + absaetze(wert, stil, "tabelle") + "</a:txBody><a:tcPr>" +
                  rand("lnL") + rand("lnR") + rand("lnT") + rand("lnB") +
                  fuellung(kopf ? "065A82" : z % 2 ? "FFFFFF" : "F1F6F9") +
                  "</a:tcPr></a:tc>"
                );
              })
              .join("") +
            "</a:tr>"
          );
        })
        .join("");
      return (
        '<p:graphicFrame><p:nvGraphicFramePr><p:cNvPr id="' + id + '" name="Tabelle ' + id + '"/><p:cNvGraphicFramePr><a:graphicFrameLocks noGrp="1"/></p:cNvGraphicFramePr><p:nvPr/></p:nvGraphicFramePr>' +
        xfrm(lage.x, lage.y, lage.b, lage.h, "p") +
        '<a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/table"><a:tbl><a:tblPr firstRow="' + (d.kopf ? 1 : 0) + '" bandRow="1"/><a:tblGrid>' + raster + "</a:tblGrid>" + zeilen + "</a:tbl></a:graphicData></a:graphic></p:graphicFrame>"
      );
    }

    function element(e) {
      var d = e.daten;
      var mitTitel = !!d.titel && e.typ !== "form";
      // Beim Praesentieren fehlt die Griffleiste, ausser das Element hat einen Titel
      var lage = { x: e.x, y: e.y + (mitTitel ? E.GRIFF : 0), b: e.b, h: e.h - (mitTitel ? E.GRIFF : 0) };
      if (e.typ === "text") {
        if (!d.text) return Promise.resolve("");
        return Promise.resolve(form("Text", lage, "rect", null, null, 0, textKoerper(absaetze(d.text, d, "text"))));
      }
      if (e.typ === "notiz") {
        return Promise.resolve(form("Notiz", lage, "rect", farbe(d.farbe, "FFF3A8"), "D0C8A0", 1, textKoerper(absaetze(d.text, d, "notiz"))));
      }
      if (e.typ === "form") {
        var f = E.formVon(d.form);
        var dicke = d.randDicke != null ? d.randDicke : E.FORM_STANDARD.randDicke;
        var anker = { oben: "t", unten: "b" }[d.vertikal] || "ctr";
        var innen = [lage.h * f.innen[0] / 100, lage.b * f.innen[1] / 100, lage.h * f.innen[2] / 100, lage.b * f.innen[3] / 100];
        return Promise.resolve(
          form("Form", lage, f.pptx, d.fuellung === "keine" ? null : farbe(d.fuellung, "D6ECFB"), farbe(d.rand, "065A82"), dicke, textKoerper(absaetze(d.text, d, "form"), anker, innen))
        );
      }
      if (e.typ === "tabelle") return Promise.resolve(tabelle(e, { x: lage.x + 8, y: lage.y + 8, b: lage.b - 16, h: lage.h - 16 }));
      if (e.typ === "bild") {
        return blobVon(e)
          .then(function (blob) {
            return blob ? bildFuerPptx(blob) : null;
          })
          .then(
            function (b) {
              if (!b) return karte(e, lage);
              // wie object-fit: contain
              var f2 = Math.min(lage.b / b.b, lage.h / b.h);
              var bb = b.b * f2;
              var bh = b.h * f2;
              return bild("Bild", { x: lage.x + (lage.b - bb) / 2, y: lage.y + (lage.h - bh) / 2, b: bb, h: bh }, bildRel(b), d.name);
            },
            function () {
              return karte(e, lage);
            }
          );
      }
      return Promise.resolve(karte(e, lage));
    }

    var reihenfolge = seite.elemente.slice().sort(function (a, b) {
      return (a.z || 0) - (b.z || 0);
    });
    var hgXml = "";
    return hintergrund(seite)
      .then(function (hg) {
        var fuell = hg.bild ? '<a:blipFill><a:blip r:embed="' + bildRel(hg.bild) + '"/><a:stretch><a:fillRect/></a:stretch></a:blipFill>' : fuellung(hg.farbe);
        hgXml = "<p:bg><p:bgPr>" + fuell + "<a:effectLst/></p:bgPr></p:bg>";
        // nacheinander, damit die Bildnummern stabil bleiben
        return reihenfolge.reduce(function (kette, e) {
          return kette.then(function () {
            return element(e).then(function (xml) {
              formen.push(xml);
            });
          });
        }, Promise.resolve());
      })
      .then(function () {
        if (!seite.striche.length) return;
        var c = document.createElement("canvas");
        c.width = BREITE * 2;
        c.height = HOEHE * 2;
        E.stricheZeichnen(c, seite.striche);
        return leinwandZuPng(c).then(function (daten) {
          formen.push(bild("Zeichnung", { x: 0, y: 0, b: BREITE, h: HOEHE }, bildRel({ daten: daten, endung: "png" }), "Zeichnung"));
        });
      })
      .then(function () {
        var uebergang = { blenden: "<p:fade/>", schieben: '<p:push dir="l"/>', wischen: '<p:wipe dir="r"/>', kreis: "<p:circle/>" }[seite.uebergang];
        beziehungen.push({ id: "rId" + (beziehungen.length + 1), typ: "notesSlide", ziel: "../notesSlides/notesSlide" + nr + ".xml" });
        var xml =
          KOPF +
          "<p:sld" + WURZEL + (seite.ausgeblendet ? ' show="0"' : "") + "><p:cSld>" + hgXml + "<p:spTree>" + LEER_GRUPPE + formen.join("") + "</p:spTree></p:cSld>" +
          '<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr>' +
          (uebergang ? '<p:transition spd="med">' + uebergang + "</p:transition>" : "") +
          "</p:sld>";
        sammler.dateien.push({ name: "ppt/slides/slide" + nr + ".xml", text: xml });
        sammler.dateien.push({ name: "ppt/slides/_rels/slide" + nr + ".xml.rels", text: rels(beziehungen) });
        sammler.dateien.push({ name: "ppt/notesSlides/notesSlide" + nr + ".xml", text: notizenFolie(seite.notizen || "") });
        sammler.dateien.push({
          name: "ppt/notesSlides/_rels/notesSlide" + nr + ".xml.rels",
          text: rels([
            { id: "rId1", typ: "notesMaster", ziel: "../notesMasters/notesMaster1.xml" },
            { id: "rId2", typ: "slide", ziel: "../slides/slide" + nr + ".xml" }
          ])
        });
      });
  }

  function notizenFolie(text) {
    var absatz = String(text)
      .split("\n")
      .map(function (zeile) {
        return zeile ? '<a:p><a:r><a:rPr lang="de-CH" dirty="0"/><a:t>' + x(zeile) + "</a:t></a:r></a:p>" : '<a:p><a:endParaRPr lang="de-CH" dirty="0"/></a:p>';
      })
      .join("");
    return (
      KOPF +
      "<p:notes" + WURZEL + "><p:cSld><p:spTree>" + LEER_GRUPPE +
      '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Folienbild"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm></p:spPr></p:sp>' +
      '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" idx="3"/></p:nvPr></p:nvSpPr>' +
      '<p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm></p:spPr>' +
      "<p:txBody><a:bodyPr/><a:lstStyle/>" + absatz + "</p:txBody></p:sp>" +
      "</p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:notes>"
    );
  }

  // ---------- Praesentation ----------

  /** Erstellt die PowerPoint-Datei einer Tafel als Blob */
  function erstellen(tafel) {
    var sammler = { dateien: [], bilder: 0, endungen: {} };
    var n = tafel.seiten.length;
    return tafel.seiten
      .reduce(function (kette, seite, i) {
        return kette.then(function () {
          return folieBauen(seite, i + 1, sammler);
        });
      }, Promise.resolve())
      .then(function () {
        var nummern = tafel.seiten.map(function (s, i) {
          return i + 1;
        });
        var typen =
          KOPF +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>' +
          Object.keys(sammler.endungen)
            .map(function (endung) {
              return '<Default Extension="' + endung + '" ContentType="image/' + endung + '"/>';
            })
            .join("") +
          '<Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/>' +
          '<Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>' +
          '<Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/>' +
          '<Override PartName="/ppt/notesMasters/notesMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesMaster+xml"/>' +
          '<Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
          '<Override PartName="/ppt/theme/theme2.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/>' +
          '<Override PartName="/ppt/presProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presProps+xml"/>' +
          '<Override PartName="/ppt/viewProps.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml"/>' +
          '<Override PartName="/ppt/tableStyles.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml"/>' +
          '<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>' +
          '<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>' +
          nummern
            .map(function (i) {
              return (
                '<Override PartName="/ppt/slides/slide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>' +
                '<Override PartName="/ppt/notesSlides/notesSlide' + i + '.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.notesSlide+xml"/>'
              );
            })
            .join("") +
          "</Types>";

        // presentation.xml.rels: Master, Folien, Notizenmaster, Eigenschaften, Thema
        var praesRels = [{ id: "rId1", typ: "slideMaster", ziel: "slideMasters/slideMaster1.xml" }];
        nummern.forEach(function (i) {
          praesRels.push({ id: "rId" + (i + 1), typ: "slide", ziel: "slides/slide" + i + ".xml" });
        });
        var notizenId = "rId" + (n + 2);
        praesRels.push(
          { id: notizenId, typ: "notesMaster", ziel: "notesMasters/notesMaster1.xml" },
          { id: "rId" + (n + 3), typ: "presProps", ziel: "presProps.xml" },
          { id: "rId" + (n + 4), typ: "viewProps", ziel: "viewProps.xml" },
          { id: "rId" + (n + 5), typ: "theme", ziel: "theme/theme1.xml" },
          { id: "rId" + (n + 6), typ: "tableStyles", ziel: "tableStyles.xml" }
        );
        var praesentation =
          KOPF +
          "<p:presentation" + WURZEL + ' saveSubsetFonts="1">' +
          '<p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst>' +
          '<p:notesMasterIdLst><p:notesMasterId r:id="' + notizenId + '"/></p:notesMasterIdLst>' +
          "<p:sldIdLst>" +
          nummern
            .map(function (i) {
              return '<p:sldId id="' + (255 + i) + '" r:id="rId' + (i + 1) + '"/>';
            })
            .join("") +
          "</p:sldIdLst>" +
          '<p:sldSz cx="12192000" cy="6858000"/><p:notesSz cx="6858000" cy="9144000"/>' +
          "</p:presentation>";

        var master =
          KOPF +
          "<p:sldMaster" + WURZEL + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>' + LEER_GRUPPE + "</p:spTree></p:cSld>" +
          "<p:clrMap " + FARBZUORDNUNG + "/>" +
          '<p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst>' +
          '<p:txStyles><p:titleStyle><a:lvl1pPr><a:defRPr sz="4400"/></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr><a:defRPr sz="2000"/></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:lvl1pPr><a:defRPr sz="1800"/></a:lvl1pPr></p:otherStyle></p:txStyles>' +
          "</p:sldMaster>";
        var layout =
          KOPF +
          "<p:sldLayout" + WURZEL + ' type="blank" preserve="1"><p:cSld name="Leer"><p:spTree>' + LEER_GRUPPE + "</p:spTree></p:cSld>" +
          "<p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>";
        var notizenMaster =
          KOPF +
          "<p:notesMaster" + WURZEL + '><p:cSld><p:bg><p:bgRef idx="1001"><a:schemeClr val="bg1"/></p:bgRef></p:bg><p:spTree>' + LEER_GRUPPE +
          '<p:sp><p:nvSpPr><p:cNvPr id="2" name="Folienbild"/><p:cNvSpPr><a:spLocks noGrp="1" noRot="1" noChangeAspect="1"/></p:cNvSpPr><p:nvPr><p:ph type="sldImg" idx="2"/></p:nvPr></p:nvSpPr>' +
          '<p:spPr><a:xfrm><a:off x="381000" y="685800"/><a:ext cx="6096000" cy="3429000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom><a:noFill/><a:ln w="12700"><a:solidFill><a:srgbClr val="000000"/></a:solidFill></a:ln></p:spPr></p:sp>' +
          '<p:sp><p:nvSpPr><p:cNvPr id="3" name="Notizen"/><p:cNvSpPr><a:spLocks noGrp="1"/></p:cNvSpPr><p:nvPr><p:ph type="body" sz="quarter" idx="3"/></p:nvPr></p:nvSpPr>' +
          '<p:spPr><a:xfrm><a:off x="685800" y="4343400"/><a:ext cx="5486400" cy="4114800"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr>' +
          '<p:txBody><a:bodyPr/><a:lstStyle/><a:p><a:endParaRPr lang="de-CH"/></a:p></p:txBody></p:sp>' +
          "</p:spTree></p:cSld>" +
          "<p:clrMap " + FARBZUORDNUNG + '/><p:notesStyle><a:lvl1pPr marL="0" algn="l"><a:defRPr sz="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:notesStyle></p:notesMaster>';
        var jetzt = new Date().toISOString().replace(/\.\d+Z$/, "Z");
        var kern =
          KOPF +
          '<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">' +
          "<dc:title>" + x(tafel.titel) + "</dc:title><dc:creator>Interaktive Wandtafel</dc:creator>" +
          '<dcterms:created xsi:type="dcterms:W3CDTF">' + jetzt + '</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">' + jetzt + "</dcterms:modified></cp:coreProperties>";
        var app =
          KOPF +
          '<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties"><Application>Interaktive Wandtafel</Application><Slides>' + n + "</Slides></Properties>";

        var teile = [
          { name: "[Content_Types].xml", text: typen },
          {
            name: "_rels/.rels",
            text: rels([
              { id: "rId1", typ: "officeDocument", ziel: "ppt/presentation.xml" },
              { id: "rId2", typ: "extended-properties", ziel: "docProps/app.xml" }
            ]).replace("</Relationships>", '<Relationship Id="rId3" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/></Relationships>')
          },
          { name: "docProps/core.xml", text: kern },
          { name: "docProps/app.xml", text: app },
          { name: "ppt/presentation.xml", text: praesentation },
          { name: "ppt/_rels/presentation.xml.rels", text: rels(praesRels) },
          { name: "ppt/slideMasters/slideMaster1.xml", text: master },
          {
            name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
            text: rels([
              { id: "rId1", typ: "slideLayout", ziel: "../slideLayouts/slideLayout1.xml" },
              { id: "rId2", typ: "theme", ziel: "../theme/theme1.xml" }
            ])
          },
          { name: "ppt/slideLayouts/slideLayout1.xml", text: layout },
          { name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels", text: rels([{ id: "rId1", typ: "slideMaster", ziel: "../slideMasters/slideMaster1.xml" }]) },
          { name: "ppt/notesMasters/notesMaster1.xml", text: notizenMaster },
          { name: "ppt/notesMasters/_rels/notesMaster1.xml.rels", text: rels([{ id: "rId1", typ: "theme", ziel: "../theme/theme2.xml" }]) },
          { name: "ppt/theme/theme1.xml", text: thema("Wandtafel") },
          { name: "ppt/theme/theme2.xml", text: thema("Notizen") },
          { name: "ppt/presProps.xml", text: KOPF + "<p:presentationPr" + WURZEL + "/>" },
          { name: "ppt/viewProps.xml", text: KOPF + "<p:viewPr" + WURZEL + "/>" },
          { name: "ppt/tableStyles.xml", text: KOPF + '<a:tblStyleLst xmlns:a="' + NS_A + '" def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>' }
        ].concat(sammler.dateien);
        var kodierer = new TextEncoder();
        return zip(
          teile.map(function (t) {
            return { name: t.name, daten: t.daten || kodierer.encode(t.text) };
          }),
          "application/vnd.openxmlformats-officedocument.presentationml.presentation"
        );
      });
  }

  function speichern(tafel) {
    return erstellen(tafel).then(function (blob) {
      W.herunterladen(blob, W.dateiText(tafel.titel) + ".pptx");
      W.melden("PowerPoint-Datei gespeichert. Animationen und Module (Timer, Lostopf, …) sind darin nicht enthalten.", 7000);
    });
  }

  W.Pptx = { erstellen: erstellen, speichern: speichern, zip: zip };
})();
