/*
 * Gemeinsame Hilfsfunktionen fuer Startseite, Tafel und exportierte Ansicht:
 * Elemente bauen, Icons, Dialoge, Meldungen, Dateien herunterladen.
 * Alles haengt an window.Wandtafel.
 */
(function () {
  "use strict";

  var W = (window.Wandtafel = window.Wandtafel || {});

  var ICONS = {
    zeiger: '<path d="M5 3l14 7-6 2-2 6z"/>',
    stift: '<path d="M4 20l4-1L19 8l-3-3L5 16z"/><path d="M14 7l3 3"/>',
    marker: '<path d="M9 15l-3 5h6l1-3"/><path d="M9 15l7-11 4 3-7 10z"/>',
    radierer: '<path d="M8 20h12"/><path d="M4 15l9-9 6 6-8 8H8z"/><path d="M9 10l6 6"/>',
    text: '<path d="M5 6V4h14v2M12 4v16M9 20h6"/>',
    notiz: '<path d="M4 4h16v11l-5 5H4z"/><path d="M15 20v-5h5"/>',
    bild: '<rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="10" r="2"/><path d="M21 17l-5-5-9 8"/>',
    video: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9v6l5-3z"/>',
    webseite: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M6.5 6.5h.01M9 6.5h.01"/>',
    link: '<path d="M10 14a4 4 0 0 0 6 0l3-3a4 4 0 0 0-6-6l-1 1"/><path d="M14 10a4 4 0 0 0-6 0l-3 3a4 4 0 0 0 6 6l1-1"/>',
    timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2.5M9 2h6"/>',
    stoppuhr: '<circle cx="12" cy="13" r="8"/><path d="M12 13V8M10 2h4M19 6l1.5-1.5"/>',
    zufall: '<path d="M3 7h3c5 0 7 10 12 10h3"/><path d="M3 17h3c2 0 3.5-1.6 4.6-3.6M13.4 9.6C14.5 7.6 16 7 18 7h3"/><path d="M19 4l3 3-3 3M19 14l3 3-3 3"/>',
    gruppen: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6"/><circle cx="17" cy="9" r="2.8"/><path d="M17 14c2.8 0 4.5 2 4.5 5"/>',
    wuerfel: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1" fill="currentColor"/><circle cx="15" cy="15" r="1" fill="currentColor"/><circle cx="12" cy="12" r="1" fill="currentColor"/>',
    muell: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    zurueck: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    vor: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    datei: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
    export: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 14v6h14v-6"/>',
    import: '<path d="M12 15V3M7 10l5 5 5-5"/><path d="M5 14v6h14v-6"/>',
    vollbild: '<path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/>',
    kopie: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V4H4v12h4"/>',
    links: '<path d="M15 5l-7 7 7 7"/>',
    rechts: '<path d="M9 5l7 7-7 7"/>',
    hoch: '<path d="M5 15l7-7 7 7"/>',
    runter: '<path d="M5 9l7 7 7-7"/>',
    farbe: '<circle cx="12" cy="12" r="8"/>',
    groesser: '<path d="M4 18L9 6l5 12M6 14h6M18 9v6M15 12h6"/>',
    kleiner: '<path d="M4 18L9 6l5 12M6 14h6M15 12h6"/>',
    fett: '<path d="M7 4h6a4 4 0 0 1 0 8H7zM7 12h7a4 4 0 0 1 0 8H7z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    stift2: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
    praesentieren: '<rect x="3" y="4" width="18" height="12" rx="1"/><path d="M8 20h8M12 16v4M10 8v4l3-2z"/>',
    schliessen: '<path d="M6 6l12 12M18 6L6 18"/>',
    seiten: '<rect x="4" y="3" width="12" height="15" rx="1.5"/><path d="M8 21h10.5a1.5 1.5 0 0 0 1.5-1.5V7"/>',
    ordner: '<path d="M3 6a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
    mehr: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    neuertab: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>',
    qr: '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 17h4v4h-4"/>',
    uhr: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
    ampel: '<rect x="7" y="2" width="10" height="20" rx="3"/><circle cx="12" cy="7" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="12" cy="17" r="1.6"/>',
    sozialform: '<circle cx="8" cy="8" r="3"/><circle cx="16" cy="8" r="3"/><path d="M2 20c0-3.5 2.6-6 6-6 1.5 0 2.9.5 4 1.4 1.1-.9 2.5-1.4 4-1.4 3.4 0 6 2.5 6 6"/>',
    verschieben: '<rect x="3" y="5" width="11" height="14" rx="1.5"/><path d="M14 12h7M18 9l3 3-3 3"/>',
    pinsel: '<path d="M14 4l6 6-8 8H6v-6z"/><path d="M4 20l2-2"/>',
    design: '<path d="M12 3a9 9 0 1 0 0 18c1.5 0 2-1 2-2s-1-1.5-1-2.5 1-1.5 2-1.5h2a4 4 0 0 0 4-4c0-4.4-4-8-9-8z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
    neuladen: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
    form: '<rect x="3" y="11" width="10" height="10" rx="1"/><circle cx="16" cy="8" r="5"/>',
    tabelle: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9.5h18M3 15h18M9 4v16M15 4v16"/>',
    format: '<path d="M4 18L9 5l5 13M6 13h6"/><path d="M15 20h6M18 9v11"/>',
    animation: '<path d="M4 18c3-9 7-12 16-13"/><path d="M15 3l5 2-2 5"/><circle cx="5" cy="19" r="1.5"/>',
    laser: '<circle cx="12" cy="12" r="3" fill="currentColor"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M5 5l2 2M17 17l2 2M5 19l2-2M17 7l2-2"/>',
    referent: '<rect x="2" y="4" width="13" height="10" rx="1"/><path d="M17 6h5M17 10h5M17 14h5M5 18h7M8.5 14v4"/>',
    layout: '<rect x="3" y="4" width="18" height="16" rx="1.5"/><path d="M3 9h18M12 9v11"/>',
    zeileNeu: '<rect x="3" y="4" width="18" height="10" rx="1"/><path d="M3 9h18M12 16v6M9 19h6"/>',
    spalteNeu: '<rect x="3" y="3" width="10" height="18" rx="1"/><path d="M8 3v18M16 12h6M19 9v6"/>',
    zeileWeg: '<rect x="3" y="4" width="18" height="10" rx="1"/><path d="M3 9h18M9 19h6"/>',
    spalteWeg: '<rect x="3" y="3" width="10" height="18" rx="1"/><path d="M8 3v18M16 12h6"/>'
  };

  function icon(name) {
    return (
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      (ICONS[name] || "") +
      "</svg>"
    );
  }

  function el(tag, klasse, text) {
    var e = document.createElement(tag);
    if (klasse) e.className = klasse;
    if (text != null) e.textContent = text;
    return e;
  }

  /** Knopf nur mit Icon (Titel als Tooltip und fuer Screenreader) oder mit Icon und Text */
  function knopf(klasse, iconName, titel, text) {
    var k = el("button", klasse);
    k.type = "button";
    k.title = titel;
    if (!text) k.setAttribute("aria-label", titel);
    k.innerHTML = icon(iconName);
    if (text) k.appendChild(el("span", null, text));
    return k;
  }

  function neueId(praefix) {
    return (praefix || "x") + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function begrenzen(wert, min, max) {
    return Math.max(min, Math.min(max, wert));
  }

  function zweistellig(n) {
    return (n < 10 ? "0" : "") + n;
  }

  function datumText(zeit) {
    if (!zeit) return "";
    var d = new Date(zeit);
    return zweistellig(d.getDate()) + "." + zweistellig(d.getMonth() + 1) + "." + d.getFullYear();
  }

  /** Text fuer Dateinamen: ohne Umlaute, Leer- und Sonderzeichen */
  function dateiText(text) {
    return (
      String(text || "Wandtafel")
        .replace(/ä/g, "ae")
        .replace(/ö/g, "oe")
        .replace(/ü/g, "ue")
        .replace(/Ä/g, "Ae")
        .replace(/Ö/g, "Oe")
        .replace(/Ü/g, "Ue")
        .replace(/ß/g, "ss")
        .normalize("NFD")
        .replace(/[̀-ͯ]/g, "")
        .replace(/[^A-Za-z0-9]+/g, "_")
        .replace(/^_+|_+$/g, "")
        .slice(0, 60) || "Wandtafel"
    );
  }

  function normal(text) {
    return String(text || "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/\s+/g, " ");
  }

  function herunterladen(inhalt, name, typ) {
    var blob = inhalt instanceof Blob ? inhalt : new Blob([inhalt], { type: typ || "application/octet-stream" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
  }

  function dateiLesen(datei, art) {
    return new Promise(function (ok, fehler) {
      var leser = new FileReader();
      leser.onload = function () {
        ok(leser.result);
      };
      leser.onerror = function () {
        fehler(leser.error);
      };
      if (art === "text") leser.readAsText(datei);
      else leser.readAsDataURL(datei);
    });
  }

  function dataUrlZuBlob(url) {
    var teile = String(url).split(",");
    var typ = (teile[0].match(/^data:([^;,]+)/) || [])[1] || "application/octet-stream";
    var base64 = /;base64$/.test(teile[0]);
    var roh = base64 ? atob(teile[1]) : decodeURIComponent(teile[1]);
    var bytes = new Uint8Array(roh.length);
    for (var i = 0; i < roh.length; i++) bytes[i] = roh.charCodeAt(i);
    return new Blob([bytes], { type: typ });
  }

  // ---------- Meldung ----------

  var meldungTakt = null;
  function melden(text, dauer) {
    var m = document.getElementById("meldung");
    if (!m) {
      m = el("div", "meldung");
      m.id = "meldung";
      m.setAttribute("role", "status");
      document.body.appendChild(m);
    }
    clearTimeout(meldungTakt);
    if (!text) {
      m.hidden = true;
      return;
    }
    m.textContent = text;
    m.hidden = false;
    meldungTakt = setTimeout(function () {
      m.hidden = true;
    }, dauer || 3500);
  }

  // ---------- Dialog ----------

  /**
   * Zeigt einen Dialog mit Eingabefeldern und liefert die Werte (oder null bei Abbrechen).
   * felder: [{ name, label, typ: text|url|textarea|select|file|farbe|farbwert|zahl|haken|hinweis, wert, optionen, accept, platzhalter }]
   */
  function dialog(angaben) {
    return new Promise(function (ok) {
      var d = el("dialog", "dialog");
      var form = el("form");
      form.method = "dialog";
      form.appendChild(el("h2", null, angaben.titel));
      if (angaben.text) form.appendChild(el("p", "dialog-text", angaben.text));
      var eingaben = {};
      (angaben.felder || []).forEach(function (f) {
        if (f.typ === "hinweis") {
          form.appendChild(el("p", "dialog-hinweis", f.text));
          return;
        }
        var zeile = el("label", "dialog-feld" + (f.typ === "haken" ? " dialog-haken" : ""));
        zeile.appendChild(el("span", null, f.label));
        var eingabe;
        if (f.typ === "textarea") {
          eingabe = el("textarea");
          eingabe.rows = 4;
        } else if (f.typ === "select") {
          eingabe = el("select");
          f.optionen.forEach(function (o) {
            var opt = el("option", null, o.text);
            opt.value = o.wert;
            eingabe.appendChild(opt);
          });
        } else if (f.typ === "farbe") {
          eingabe = el("div", "farbwahl");
          eingabe.setAttribute("role", "radiogroup");
          f.optionen.forEach(function (farbe, i) {
            var r = el("input");
            r.type = "radio";
            r.name = "farbe-" + f.name;
            r.value = farbe;
            r.style.setProperty("--farbe", farbe);
            r.setAttribute("aria-label", "Farbe " + (i + 1));
            r.checked = farbe === (f.wert || f.optionen[0]);
            eingabe.appendChild(r);
          });
          eingabe.wert = function () {
            var gewaehlt = eingabe.querySelector("input:checked");
            return gewaehlt ? gewaehlt.value : f.optionen[0];
          };
        } else {
          eingabe = el("input");
          // Adressen ohne «https://» zulassen (wird beim Einfuegen ergaenzt)
          eingabe.type = f.typ === "file" ? "file" : f.typ === "farbwert" ? "color" : f.typ === "zahl" ? "number" : f.typ === "haken" ? "checkbox" : "text";
          if (f.typ === "haken") eingabe.checked = !!f.wert;
          if (f.typ === "url") {
            eingabe.inputMode = "url";
            eingabe.autocomplete = "url";
            eingabe.spellcheck = false;
          }
          if (f.accept) eingabe.accept = f.accept;
        }
        eingabe.name = f.name;
        if (f.platzhalter) eingabe.placeholder = f.platzhalter;
        if (f.wert != null && f.typ !== "file" && f.typ !== "farbe" && f.typ !== "haken") eingabe.value = f.wert;
        if (f.pflicht) eingabe.required = true;
        zeile.appendChild(eingabe);
        if (f.hilfe) zeile.appendChild(el("small", null, f.hilfe));
        form.appendChild(zeile);
        eingaben[f.name] = { feld: f, eingabe: eingabe };
      });
      var knoepfe = el("div", "dialog-knoepfe");
      var abbrechen = el("button", "knopf", angaben.abbrechen || "Abbrechen");
      abbrechen.type = "button";
      abbrechen.value = "abbrechen";
      var weiter = el("button", "knopf knopf-haupt" + (angaben.gefahr ? " knopf-gefahr" : ""), angaben.knopf || "OK");
      weiter.type = "submit";
      weiter.value = "ok";
      if (angaben.abbrechen !== false) knoepfe.appendChild(abbrechen);
      knoepfe.appendChild(weiter);
      form.appendChild(knoepfe);
      d.appendChild(form);
      document.body.appendChild(d);

      var fertig = false;
      function schliessen(ergebnis) {
        if (fertig) return;
        fertig = true;
        if (d.open) d.close();
        d.remove();
        ok(ergebnis);
      }
      abbrechen.addEventListener("click", function () {
        schliessen(null);
      });
      d.addEventListener("cancel", function (ev) {
        ev.preventDefault();
        schliessen(null);
      });
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        var werte = {};
        Object.keys(eingaben).forEach(function (name) {
          var x = eingaben[name];
          if (x.feld.typ === "file") werte[name] = x.eingabe.files[0] || null;
          else if (x.feld.typ === "farbe") werte[name] = x.eingabe.wert();
          else if (x.feld.typ === "haken") werte[name] = x.eingabe.checked;
          else werte[name] = x.eingabe.value.trim();
        });
        schliessen(werte);
      });
      d.showModal();
      var erstes = form.querySelector("input:not([type=radio]):not([type=checkbox]), textarea, select");
      if (erstes) {
        erstes.focus();
        if (erstes.select && erstes.type !== "file") erstes.select();
      } else weiter.focus();
    });
  }

  function bestaetigen(text, knopfText) {
    return dialog({ titel: "Bitte bestätigen", text: text, knopf: knopfText || "Löschen", gefahr: true }).then(function (w) {
      return !!w;
    });
  }

  /** Kleines Aufklappmenue an einem Knopf. eintraege: [{ text, aktion, gefahr }] */
  function menue(anker, eintraege) {
    var offen = document.querySelector(".klappmenue");
    if (offen) {
      var gleich = offen.anker === anker;
      offen.schliessen();
      if (gleich) return;
    }
    var liste = el("div", "klappmenue");
    liste.setAttribute("role", "menu");
    liste.anker = anker;
    eintraege.forEach(function (e) {
      if (!e) return;
      if (e.trenner) {
        liste.appendChild(el("hr"));
        return;
      }
      var k = el("button", e.gefahr ? "gefahr" : null, e.text);
      k.type = "button";
      k.setAttribute("role", "menuitem");
      k.addEventListener("click", function () {
        schliessen();
        e.aktion();
      });
      liste.appendChild(k);
    });
    document.body.appendChild(liste);
    var r = anker.getBoundingClientRect();
    var b = liste.offsetWidth;
    liste.style.left = Math.max(8, Math.min(window.innerWidth - b - 8, r.right - b)) + "px";
    var oben = r.bottom + 6;
    if (oben + liste.offsetHeight > window.innerHeight - 8) oben = Math.max(8, r.top - liste.offsetHeight - 6);
    liste.style.top = oben + "px";
    anker.setAttribute("aria-expanded", "true");
    function aussen(ev) {
      if (!liste.contains(ev.target) && ev.target !== anker && !anker.contains(ev.target)) schliessen();
    }
    function taste(ev) {
      if (ev.key === "Escape") schliessen();
    }
    function schliessen() {
      liste.remove();
      anker.setAttribute("aria-expanded", "false");
      document.removeEventListener("pointerdown", aussen, true);
      document.removeEventListener("keydown", taste, true);
    }
    liste.schliessen = schliessen;
    setTimeout(function () {
      document.addEventListener("pointerdown", aussen, true);
      document.addEventListener("keydown", taste, true);
    });
    var erster = liste.querySelector("button");
    if (erster) erster.focus();
  }

  W.ICONS = ICONS;
  W.icon = icon;
  W.el = el;
  W.knopf = knopf;
  W.neueId = neueId;
  W.begrenzen = begrenzen;
  W.zweistellig = zweistellig;
  W.datumText = datumText;
  W.dateiText = dateiText;
  W.normal = normal;
  W.herunterladen = herunterladen;
  W.dateiLesen = dateiLesen;
  W.dataUrlZuBlob = dataUrlZuBlob;
  W.melden = melden;
  W.dialog = dialog;
  W.bestaetigen = bestaetigen;
  W.menue = menue;
})();
