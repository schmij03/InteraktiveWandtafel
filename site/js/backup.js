/*
 * Backup in OneDrive (oder einen anderen Cloud-Ordner): eine Datei mit allen
 * Faechern, Tafeln und Medien. Sie heisst immer gleich, damit OneDrive das alte
 * Backup ersetzt und fruehere Fassungen im Versionsverlauf behaelt.
 *
 *   Chrome/Edge am Computer   einmal den OneDrive-Ordner waehlen, danach schreibt
 *                             und liest die Wandtafel die Datei dort direkt
 *   iPad, iPhone, Android     Teilen-Dialog: «In Dateien sichern» > OneDrive
 *   sonst                     Download; die Datei in den OneDrive-Ordner legen
 *
 * Laden fuehrt das Backup mit diesem Geraet zusammen: Neue Tafeln kommen dazu,
 * bei vorhandenen gewinnt die neuere Fassung. Geloescht wird nichts.
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var S = W.Speicher;
  var X = W.Export;
  var DATEI = "Wandtafel-Backup.wandtafel.json";

  function ordnerMoeglich() {
    return typeof window.showDirectoryPicker === "function";
  }

  function teilenMoeglich(datei) {
    if (!W.IOS && !/Android/i.test(navigator.userAgent)) return false;
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [datei] }));
    } catch (e) {
      return false;
    }
  }

  /** Abbrechen im Ordner- oder Teilen-Dialog ist kein Fehler */
  function abgebrochen(f) {
    if (f && f.name === "AbortError") return null;
    throw f;
  }

  // ---------- Ordner (Chrome, Edge) ----------

  function ordnerWaehlen() {
    return window.showDirectoryPicker({ id: "wandtafel-backup", mode: "readwrite" }).then(function (h) {
      return S.einstellungSpeichern("backup-ordner", h).then(function () {
        return h;
      });
    });
  }

  /** Fragt nach, falls der Browser das Recht fuer den Ordner vergessen hat */
  function erlaubt(h, schreiben) {
    if (!h.queryPermission) return Promise.resolve(true);
    var art = { mode: schreiben ? "readwrite" : "read" };
    return h.queryPermission(art).then(function (p) {
      if (p === "granted") return true;
      return h.requestPermission(art).then(function (p2) {
        return p2 === "granted";
      });
    });
  }

  function zielOrdner() {
    return S.einstellung("backup-ordner").then(function (h) {
      if (!h) return ordnerWaehlen();
      return erlaubt(h, true).then(function (ok) {
        if (!ok) throw new Error("Kein Zugriff auf den Backup-Ordner. Bitte «Backup-Ordner wählen» und den OneDrive-Ordner neu auswählen.");
        return h;
      });
    });
  }

  /** Backup-Datei aus dem gewaehlten Ordner, oder null ohne Ordner */
  function ausOrdner() {
    if (!ordnerMoeglich()) return Promise.resolve(null);
    return S.einstellung("backup-ordner").then(function (h) {
      if (!h) return null;
      return erlaubt(h, false).then(function (ok) {
        if (!ok) return null;
        return h.getFileHandle(DATEI).then(
          function (f) {
            return f.getFile();
          },
          function () {
            throw new Error("Im Ordner «" + h.name + "» liegt noch kein Backup.");
          }
        );
      });
    });
  }

  // ---------- Sichern ----------

  function paketBauen() {
    return S.sammlung()
      .then(function (s) {
        if (!s.faecher.length) throw new Error("Noch nichts zu sichern.");
        return X.sammlungPaket(s.faecher);
      })
      .then(function (p) {
        p.sicherung = true;
        return new Blob([JSON.stringify(p)], { type: "application/json" });
      });
  }

  function gemerkt(wie, text) {
    return S.einstellungSpeichern("backup-info", { zeit: Date.now(), wie: wie }).then(function () {
      return { text: text };
    });
  }

  /**
   * Sichert alles. nurDatei: immer herunterladen (ohne Ordner und Teilen).
   * Liefert { text } oder null, wenn abgebrochen.
   */
  function speichern(nurDatei) {
    if (!nurDatei && ordnerMoeglich()) {
      var ordner;
      // Zuerst den Ordner: Auswahl und Rueckfrage brauchen den Klick
      return zielOrdner()
        .then(function (h) {
          ordner = h;
          return paketBauen();
        })
        .then(function (blob) {
          return ordner
            .getFileHandle(DATEI, { create: true })
            .then(function (f) {
              return f.createWritable();
            })
            .then(function (w) {
              return w.write(blob).then(function () {
                return w.close();
              });
            });
        })
        .then(function () {
          return gemerkt("ordner", "Backup in «" + ordner.name + "» gespeichert.");
        })
        .catch(abgebrochen);
    }
    return paketBauen().then(function (blob) {
      var datei = new File([blob], DATEI, { type: "application/json" });
      if (!nurDatei && teilenMoeglich(datei)) {
        // Teilen braucht einen frischen Tipp, das Paket zu bauen dauert zu lange
        return W.dialog({
          titel: "Backup bereit",
          text: "Im nächsten Fenster «In Dateien sichern» wählen, dann OneDrive und einen Ordner, zum Beispiel «Wandtafel». Ein älteres Backup dort ersetzen.",
          knopf: "Weiter"
        })
          .then(function (w) {
            if (!w) return null;
            return navigator.share({ files: [datei], title: "Wandtafel-Backup" }).then(function () {
              return gemerkt("teilen", "Backup gesichert.");
            });
          })
          .catch(abgebrochen);
      }
      W.herunterladen(blob, DATEI);
      return gemerkt("datei", "Backup heruntergeladen. Die Datei in den OneDrive-Ordner legen.");
    });
  }

  // ---------- Wiederherstellen ----------

  function finden(liste, neu, gleich) {
    return (
      liste.find(function (x) {
        return x.id === neu.id;
      }) || liste.find(gleich)
    );
  }

  /**
   * Fuehrt ein Backup mit diesem Geraet zusammen. Faecher, Jahre und Kapitel
   * werden nach ID, sonst nach Namen zugeordnet; Tafeln behalten ihre ID.
   */
  function wiederherstellen(paket) {
    var neu = 0;
    var neuer = 0;
    return X.medienSpeichern(paket.medien)
      .then(function () {
        return Promise.all([S.sammlung(), S.alleTafeln()]);
      })
      .then(function (r) {
        var sammlung = r[0];
        var hier = {};
        r[1].forEach(function (t) {
          hier[t.id] = t;
        });
        var eingeordnet = {};
        sammlung.faecher.forEach(function (f) {
          f.kapitel.forEach(function (k) {
            k.tafeln.forEach(function (id) {
              eingeordnet[id] = true;
            });
          });
        });
        var ausBackup = {};
        paket.tafeln.forEach(function (t) {
          if (S.gueltigeTafel(t)) ausBackup[t.id] = t;
        });

        var erstesFach = null;
        paket.faecher.forEach(function (fNeu) {
          var fach = finden(sammlung.faecher, fNeu, function (f) {
            return W.normal(f.name) === W.normal(fNeu.name);
          });
          if (!fach) {
            fach = { id: fNeu.id, name: fNeu.name, farbe: fNeu.farbe, kapitel: [] };
            sammlung.faecher.push(fach);
          }
          erstesFach = erstesFach || fach;
          var jahrNach = {};
          (fNeu.jahre || []).forEach(function (jNeu) {
            fach.jahre = fach.jahre || [];
            var jahr = finden(fach.jahre, jNeu, function (j) {
              return W.normal(j.name) === W.normal(jNeu.name);
            });
            if (!jahr) {
              jahr = { id: jNeu.id, name: jNeu.name };
              fach.jahre.push(jahr);
            }
            jahrNach[jNeu.id] = jahr.id;
          });
          (fNeu.kapitel || []).forEach(function (kNeu) {
            var jahrId = jahrNach[kNeu.jahr] || null;
            var kapitel = finden(fach.kapitel, kNeu, function (k) {
              return W.normal(k.name) === W.normal(kNeu.name) && (k.jahr || null) === jahrId;
            });
            if (!kapitel) {
              kapitel = { id: kNeu.id, name: kNeu.name, tafeln: [] };
              if (jahrId) kapitel.jahr = jahrId;
              fach.kapitel.push(kapitel);
            }
            // Eine Tafel, die hier schon in einem Kapitel steht, bleibt dort
            (kNeu.tafeln || []).forEach(function (id) {
              if (!ausBackup[id] || eingeordnet[id]) return;
              kapitel.tafeln.push(id);
              eingeordnet[id] = true;
            });
          });
        });

        var schreiben = Object.keys(ausBackup).filter(function (id) {
          var alt = hier[id];
          if (!alt) {
            neu++;
            return true;
          }
          if ((ausBackup[id].geaendert || 0) > (alt.geaendert || 0)) {
            neuer++;
            return true;
          }
          return false;
        });
        return Promise.all(
          schreiben.map(function (id) {
            return S.tafelSpeichern(ausBackup[id]);
          })
        )
          .then(function () {
            return S.sammlungSpeichern(sammlung);
          })
          .then(S.medienAufraeumen)
          .then(function () {
            var teile = [];
            if (neu) teile.push(neu + (neu === 1 ? " neue Tafel" : " neue Tafeln"));
            if (neuer) teile.push(neuer + " aktualisiert");
            return {
              text: "Backup geladen: " + (teile.length ? teile.join(", ") : "alles war schon aktuell") + ".",
              fachId: erstesFach && erstesFach.id
            };
          });
      });
  }

  W.Backup = {
    DATEI: DATEI,
    ordnerMoeglich: ordnerMoeglich,
    ordnerWaehlen: function () {
      return ordnerWaehlen().catch(abgebrochen);
    },
    ausOrdner: ausOrdner,
    speichern: speichern,
    wiederherstellen: wiederherstellen,
    info: function () {
      return S.einstellung("backup-info");
    }
  };
})();
