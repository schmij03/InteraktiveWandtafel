/*
 * Speicher im Browser (IndexedDB). Drei Bereiche:
 *   sammlung  Faecher mit Kapiteln; jedes Kapitel listet die IDs seiner Tafeln
 *   tafeln    eine Tafel pro Eintrag: Titel und Seiten mit Elementen und Zeichnungen
 *   medien    hochgeladene Bilder und Videos als Blob, in den Elementen per ID verknuepft
 *
 * Alles bleibt auf diesem Geraet und in diesem Browser. Zum Sichern und
 * Weitergeben gibt es den Export (export.js).
 */
(function () {
  "use strict";

  var W = (window.Wandtafel = window.Wandtafel || {});
  var NAME = "interaktive-wandtafel";
  var VERSION = 1;
  var verbindung = null;

  function oeffnen() {
    if (verbindung) return verbindung;
    verbindung = new Promise(function (ok, fehler) {
      if (!window.indexedDB) {
        fehler(new Error("Dieser Browser kann keine Daten speichern (IndexedDB fehlt)."));
        return;
      }
      var anfrage = indexedDB.open(NAME, VERSION);
      anfrage.onupgradeneeded = function () {
        var db = anfrage.result;
        if (!db.objectStoreNames.contains("sammlung")) db.createObjectStore("sammlung");
        if (!db.objectStoreNames.contains("tafeln")) db.createObjectStore("tafeln", { keyPath: "id" });
        if (!db.objectStoreNames.contains("medien")) db.createObjectStore("medien", { keyPath: "id" });
      };
      anfrage.onsuccess = function () {
        ok(anfrage.result);
      };
      anfrage.onerror = function () {
        fehler(anfrage.error || new Error("Der Browserspeicher lässt sich nicht öffnen."));
      };
      anfrage.onblocked = function () {
        fehler(new Error("Die Wandtafel ist in einem anderen Tab offen. Bitte dort schliessen und neu laden."));
      };
    });
    return verbindung;
  }

  function vorgang(bereich, art, arbeit) {
    return oeffnen().then(function (db) {
      return new Promise(function (ok, fehler) {
        var tx = db.transaction(bereich, art);
        var ergebnis;
        arbeit(tx.objectStore(bereich), function (wert) {
          ergebnis = wert;
        });
        tx.oncomplete = function () {
          ok(ergebnis);
        };
        tx.onerror = tx.onabort = function () {
          var f = tx.error || new Error("Speichern fehlgeschlagen");
          if (f && f.name === "QuotaExceededError") f = new Error("Der Browserspeicher ist voll. Grosse Videos entfernen oder Tafeln exportieren und löschen.");
          fehler(f);
        };
      });
    });
  }

  function lesen(bereich, schluessel) {
    return vorgang(bereich, "readonly", function (s, setzen) {
      s.get(schluessel).onsuccess = function (ev) {
        setzen(ev.target.result || null);
      };
    });
  }

  function alle(bereich) {
    return vorgang(bereich, "readonly", function (s, setzen) {
      s.getAll().onsuccess = function (ev) {
        setzen(ev.target.result || []);
      };
    });
  }

  function schreiben(bereich, wert, schluessel) {
    return vorgang(bereich, "readwrite", function (s) {
      if (schluessel != null) s.put(wert, schluessel);
      else s.put(wert);
    });
  }

  function loeschen(bereich, schluessel) {
    return vorgang(bereich, "readwrite", function (s) {
      s.delete(schluessel);
    });
  }

  // ---------- Sammlung ----------

  function leereSammlung() {
    return { version: 1, faecher: [] };
  }

  function sammlung() {
    return lesen("sammlung", "sammlung").then(function (s) {
      return s && Array.isArray(s.faecher) ? s : leereSammlung();
    });
  }

  function sammlungSpeichern(s) {
    return schreiben("sammlung", s, "sammlung");
  }

  // ---------- Tafeln ----------

  function leereSeite() {
    return { id: W.neueId("s"), titel: "", hintergrund: "weiss", elemente: [], striche: [] };
  }

  function neueTafel(titel) {
    var jetzt = Date.now();
    return { id: W.neueId("t"), version: 1, titel: titel || "Neue Tafel", erstellt: jetzt, geaendert: jetzt, seiten: [leereSeite()] };
  }

  function gueltigeTafel(t) {
    return (
      t &&
      typeof t.id === "string" &&
      Array.isArray(t.seiten) &&
      t.seiten.length > 0 &&
      t.seiten.every(function (s) {
        return s && Array.isArray(s.elemente) && Array.isArray(s.striche);
      })
    );
  }

  function tafel(id) {
    return lesen("tafeln", id);
  }

  function tafelSpeichern(t) {
    return schreiben("tafeln", t);
  }

  /** IDs aller Medien, die eine Tafel verwendet */
  function medienVon(t) {
    var ids = [];
    (t.seiten || []).forEach(function (s) {
      if (s.hgBild && ids.indexOf(s.hgBild) === -1) ids.push(s.hgBild);
      s.elemente.forEach(function (e) {
        if (e.daten && e.daten.medium && ids.indexOf(e.daten.medium) === -1) ids.push(e.daten.medium);
      });
    });
    return ids;
  }

  /** Loescht Medien, die keine Tafel mehr verwendet */
  function medienAufraeumen() {
    return Promise.all([alle("tafeln"), alle("medien")]).then(function (r) {
      var benutzt = {};
      r[0].forEach(function (t) {
        medienVon(t).forEach(function (id) {
          benutzt[id] = true;
        });
      });
      var weg = r[1].filter(function (m) {
        return !benutzt[m.id];
      });
      return Promise.all(
        weg.map(function (m) {
          return loeschen("medien", m.id);
        })
      );
    });
  }

  function tafelLoeschen(id) {
    return loeschen("tafeln", id).then(medienAufraeumen);
  }

  // ---------- Medien ----------

  function mediumSpeichern(blob, name) {
    var id = W.neueId("m");
    return schreiben("medien", { id: id, blob: blob, typ: blob.type, name: name || "" }).then(function () {
      return id;
    });
  }

  var urlCache = {};
  /** Objekt-URL fuer ein gespeichertes Medium (oder null) */
  function mediumUrl(id) {
    if (urlCache[id]) return Promise.resolve(urlCache[id]);
    return lesen("medien", id).then(function (m) {
      if (!m) return null;
      urlCache[id] = URL.createObjectURL(m.blob);
      return urlCache[id];
    });
  }

  /** Belegter und verfuegbarer Speicher in Bytes, falls der Browser es verraet */
  function platz() {
    if (navigator.storage && navigator.storage.estimate) return navigator.storage.estimate();
    return Promise.resolve(null);
  }

  /** Bittet den Browser, die Daten nicht automatisch zu loeschen */
  function dauerhaft() {
    if (navigator.storage && navigator.storage.persist) return navigator.storage.persist().catch(function () {});
    return Promise.resolve(false);
  }

  W.Speicher = {
    oeffnen: oeffnen,
    sammlung: sammlung,
    sammlungSpeichern: sammlungSpeichern,
    leereSeite: leereSeite,
    neueTafel: neueTafel,
    gueltigeTafel: gueltigeTafel,
    tafel: tafel,
    alleTafeln: function () {
      return alle("tafeln");
    },
    tafelSpeichern: tafelSpeichern,
    tafelLoeschen: tafelLoeschen,
    medienVon: medienVon,
    medienAufraeumen: medienAufraeumen,
    medium: function (id) {
      return lesen("medien", id);
    },
    mediumSpeichern: mediumSpeichern,
    mediumMitIdSpeichern: function (id, blob, name) {
      return schreiben("medien", { id: id, blob: blob, typ: blob.type, name: name || "" });
    },
    mediumUrl: mediumUrl,
    platz: platz,
    dauerhaft: dauerhaft
  };
})();
