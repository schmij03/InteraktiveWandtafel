/*
 * Export und Import.
 *
 *   Wandtafel-Datei (.wandtafel.json)  eine Tafel oder ein ganzes Fach/Kapitel mit allen Medien,
 *                                      laesst sich auf jedem Geraet wieder importieren
 *   HTML-Datei (offline)               eine Tafel als einzelne Datei zum Ansehen und Praesentieren,
 *                                      ohne diese Website; laesst sich ebenfalls wieder importieren
 *   PDF                                die HTML-Ansicht im Druckmodus, «Als PDF speichern» im Druckdialog
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var S = W.Speicher;
  var FORMAT = "interaktive-wandtafel";

  function blobZuDataUrl(blob) {
    return W.dateiLesen(blob, "dataurl");
  }

  /** Alle Medien der Tafeln als { id: dataUrl } */
  function medienSammeln(tafeln) {
    var ids = [];
    tafeln.forEach(function (t) {
      S.medienVon(t).forEach(function (id) {
        if (ids.indexOf(id) === -1) ids.push(id);
      });
    });
    var medien = {};
    return Promise.all(
      ids.map(function (id) {
        return S.medium(id).then(function (m) {
          if (!m) return null;
          return blobZuDataUrl(m.blob).then(function (url) {
            medien[id] = { daten: url, name: m.name || "" };
          });
        });
      })
    ).then(function () {
      return medien;
    });
  }

  function tafelPaket(tafel) {
    return medienSammeln([tafel]).then(function (medien) {
      return { format: FORMAT, version: 1, art: "tafel", exportiert: new Date().toISOString(), tafel: tafel, medien: medien };
    });
  }

  /** faecher: Liste von Faechern (ganz oder mit gefilterten Kapiteln) */
  function sammlungPaket(faecher) {
    var ids = [];
    faecher.forEach(function (f) {
      f.kapitel.forEach(function (k) {
        ids = ids.concat(k.tafeln);
      });
    });
    return Promise.all(ids.map(S.tafel)).then(function (tafeln) {
      tafeln = tafeln.filter(Boolean);
      return medienSammeln(tafeln).then(function (medien) {
        return { format: FORMAT, version: 1, art: "sammlung", exportiert: new Date().toISOString(), faecher: faecher, tafeln: tafeln, medien: medien };
      });
    });
  }

  function heute() {
    var d = new Date();
    return d.getFullYear() + "-" + W.zweistellig(d.getMonth() + 1) + "-" + W.zweistellig(d.getDate());
  }

  function jsonSpeichern(paket, name) {
    W.herunterladen(JSON.stringify(paket), W.dateiText(name) + "_" + heute() + ".wandtafel.json", "application/json");
  }

  // ---------- HTML (offline) ----------

  var DATEIEN = {
    css: ["css/basis.css", "css/tafel.css"],
    js: ["js/gemeinsam.js", "js/qrcode.js", "js/elemente.js", "js/ansicht.js"]
  };

  function holen(pfad, art) {
    return fetch(pfad, { cache: "no-cache" }).then(function (r) {
      if (!r.ok) throw new Error(pfad + " fehlt");
      return art === "blob" ? r.blob() : r.text();
    });
  }

  /** Schriften im CSS durch eingebettete Daten ersetzen */
  function cssEinbetten(css, basis) {
    var urls = [];
    css.replace(/url\("?([^")]+\.woff2)"?\)/g, function (_, u) {
      urls.push(u);
    });
    return Promise.all(
      urls.map(function (u) {
        return holen(new URL(u, new URL(basis, window.location.href)).href, "blob")
          .then(blobZuDataUrl)
          .catch(function () {
            return null;
          });
      })
    ).then(function (daten) {
      urls.forEach(function (u, i) {
        if (daten[i]) css = css.split(u).join(daten[i]);
      });
      return css;
    });
  }

  function textEinbetten(text) {
    return text.replace(/<\/(script|style)/gi, "<\\/$1");
  }

  function htmlEscape(text) {
    return String(text).replace(/[&<>"]/g, function (z) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[z];
    });
  }

  /** Baut eine eigenstaendige HTML-Datei mit Tafel, Medien, Darstellung und Bedienung */
  function htmlBauen(tafel, optionen) {
    optionen = optionen || {};
    return Promise.all([
      tafelPaket(tafel),
      Promise.all(
        DATEIEN.css.map(function (p) {
          return holen(p).then(function (css) {
            return cssEinbetten(css, p);
          });
        })
      ),
      Promise.all(
        DATEIEN.js.map(function (p) {
          return holen(p);
        })
      )
    ]).then(function (r) {
      var paket = r[0];
      var json = JSON.stringify(paket).replace(/</g, "\\u003c");
      return (
        "<!doctype html>\n" +
        '<html lang="de-CH">\n<head>\n<meta charset="utf-8">\n' +
        '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
        '<meta name="referrer" content="strict-origin-when-cross-origin">\n' +
        '<meta name="generator" content="Interaktive Wandtafel">\n' +
        "<title>" + htmlEscape(tafel.titel) + "</title>\n" +
        "<style>\n" + textEinbetten(r[1].join("\n")) + "\n</style>\n" +
        "</head>\n" +
        '<body class="oberflaeche ansicht-seite' + (optionen.drucken ? " drucken" : "") + '">\n' +
        '<script type="application/json" id="wandtafel-daten">' + json + "</script>\n" +
        "<script>\n" + textEinbetten(r[2].join("\n;\n")) + "\n</script>\n" +
        "</body>\n</html>\n"
      );
    });
  }

  function htmlSpeichern(tafel) {
    return htmlBauen(tafel).then(function (html) {
      W.herunterladen(html, W.dateiText(tafel.titel) + ".html", "text/html");
    });
  }

  /** Oeffnet die Druckansicht in einem neuen Fenster (dort «Als PDF speichern» waehlen) */
  function pdfDrucken(tafel) {
    var fenster = window.open("", "_blank");
    if (!fenster) {
      W.melden("Das Druckfenster wurde blockiert. Bitte Pop-ups für diese Seite erlauben.", 6000);
      return Promise.resolve();
    }
    fenster.document.write("<p style='font:20px sans-serif;padding:40px'>PDF wird vorbereitet …</p>");
    return htmlBauen(tafel, { drucken: true }).then(
      function (html) {
        var url = URL.createObjectURL(new Blob([html], { type: "text/html" }));
        fenster.location.href = url;
        setTimeout(function () {
          URL.revokeObjectURL(url);
        }, 60000);
      },
      function (fehler) {
        fenster.close();
        throw fehler;
      }
    );
  }

  // ---------- Import ----------

  /** Liest eine Wandtafel-Datei (.json), eine exportierte HTML-Datei oder eine PowerPoint-Datei (.pptx) */
  function paketLesen(datei) {
    if (W.PptxLesen && W.PptxLesen.istPptx(datei)) return W.PptxLesen.lesen(datei);
    return W.dateiLesen(datei, "text").then(function (text) {
      if (/^PK/.test(text)) throw new Error("Diese Datei lässt sich nicht importieren. Möglich sind PowerPoint (.pptx), Wandtafel-Dateien (.json) und exportierte HTML-Dateien.");
      var json = text;
      if (/^\s*</.test(text)) {
        var m = text.match(/<script type="application\/json" id="wandtafel-daten">([\s\S]*?)<\/script>/);
        if (!m) throw new Error("Diese HTML-Datei stammt nicht aus der Wandtafel.");
        json = m[1];
      }
      var paket;
      try {
        paket = JSON.parse(json);
      } catch (e) {
        throw new Error("Die Datei lässt sich nicht lesen.");
      }
      if (!paket || paket.format !== FORMAT) throw new Error("Das ist keine Datei der Interaktiven Wandtafel.");
      if (paket.art === "tafel" && !S.gueltigeTafel(paket.tafel)) throw new Error("Die Tafel in der Datei ist beschädigt.");
      if (paket.art === "sammlung" && (!Array.isArray(paket.faecher) || !Array.isArray(paket.tafeln))) throw new Error("Die Sammlung in der Datei ist beschädigt.");
      return paket;
    });
  }

  function medienSpeichern(medien) {
    return Promise.all(
      Object.keys(medien || {}).map(function (id) {
        var m = medien[id];
        return S.mediumMitIdSpeichern(id, W.dataUrlZuBlob(m.daten), m.name);
      })
    );
  }

  /** Speichert eine Tafel unter neuer ID und liefert die neue ID */
  function tafelUebernehmen(t) {
    var kopie = JSON.parse(JSON.stringify(t));
    kopie.id = W.neueId("t");
    kopie.geaendert = Date.now();
    return S.tafelSpeichern(kopie).then(function () {
      return kopie.id;
    });
  }

  /**
   * Importiert ein Paket in die Sammlung.
   *   Tafel: in das Kapitel ziel = { fachId, kapitelId }
   *   Sammlung: Faecher mit gleichem Namen werden ergaenzt, sonst neu angelegt
   * Liefert eine kurze Beschreibung, was importiert wurde.
   */
  function importieren(paket, ziel) {
    return medienSpeichern(paket.medien).then(function () {
      return S.sammlung().then(function (sammlung) {
        if (paket.art === "tafel") {
          var fach = sammlung.faecher.find(function (f) {
            return f.id === ziel.fachId;
          });
          var kapitel = fach && fach.kapitel.find(function (k) {
            return k.id === ziel.kapitelId;
          });
          if (!kapitel) throw new Error("Kapitel nicht gefunden.");
          return tafelUebernehmen(paket.tafel).then(function (id) {
            kapitel.tafeln.push(id);
            return S.sammlungSpeichern(sammlung).then(function () {
              return { text: "Tafel «" + paket.tafel.titel + "» importiert.", fachId: fach.id, tafelId: id };
            });
          });
        }

        var tafelNach = {};
        paket.tafeln.forEach(function (t) {
          if (S.gueltigeTafel(t)) tafelNach[t.id] = t;
        });
        var anzahl = 0;
        var erstesFach = null;
        var arbeit = Promise.resolve();
        paket.faecher.forEach(function (fNeu) {
          var fach = sammlung.faecher.find(function (f) {
            return W.normal(f.name) === W.normal(fNeu.name);
          });
          if (!fach) {
            fach = { id: W.neueId("f"), name: fNeu.name, farbe: fNeu.farbe, kapitel: [] };
            sammlung.faecher.push(fach);
          }
          erstesFach = erstesFach || fach;
          // Jahre mit gleichem Namen zusammenlegen; alte ID -> ID in dieser Sammlung
          var jahrNach = {};
          (fNeu.jahre || []).forEach(function (jNeu) {
            fach.jahre = fach.jahre || [];
            var jahr = fach.jahre.find(function (j) {
              return W.normal(j.name) === W.normal(jNeu.name);
            });
            if (!jahr) {
              jahr = { id: W.neueId("j"), name: jNeu.name };
              fach.jahre.push(jahr);
            }
            jahrNach[jNeu.id] = jahr.id;
          });
          (fNeu.kapitel || []).forEach(function (kNeu) {
            var jahrId = jahrNach[kNeu.jahr] || null;
            var kapitel = fach.kapitel.find(function (k) {
              return W.normal(k.name) === W.normal(kNeu.name) && (k.jahr || null) === jahrId;
            });
            if (!kapitel) {
              kapitel = { id: W.neueId("k"), name: kNeu.name, tafeln: [] };
              if (jahrId) kapitel.jahr = jahrId;
              fach.kapitel.push(kapitel);
            }
            (kNeu.tafeln || []).forEach(function (tid) {
              if (!tafelNach[tid]) return;
              arbeit = arbeit.then(function () {
                return tafelUebernehmen(tafelNach[tid]).then(function (id) {
                  kapitel.tafeln.push(id);
                  anzahl++;
                });
              });
            });
          });
        });
        return arbeit
          .then(function () {
            return S.sammlungSpeichern(sammlung);
          })
          .then(function () {
            return {
              text: paket.faecher.length + (paket.faecher.length === 1 ? " Fach" : " Fächer") + " mit " + anzahl + (anzahl === 1 ? " Tafel" : " Tafeln") + " importiert.",
              fachId: erstesFach && erstesFach.id
            };
          });
      });
    });
  }

  W.Export = {
    FORMAT: FORMAT,
    tafelPaket: tafelPaket,
    sammlungPaket: sammlungPaket,
    jsonSpeichern: jsonSpeichern,
    htmlBauen: htmlBauen,
    htmlSpeichern: htmlSpeichern,
    pdfDrucken: pdfDrucken,
    paketLesen: paketLesen,
    medienSpeichern: medienSpeichern,
    importieren: importieren
  };
})();
