/*
 * Elemente der Tafel und Zeichnungen. Wird von der Tafel (bearbeiten und
 * praesentieren) und von der exportierten Ansicht (nur ansehen, drucken) benutzt.
 *
 * Eine Seite ist eine feste Flaeche von 1600 x 900 Punkten. Jedes Element hat
 * Lage (x, y, b, h, z), einen Typ und typabhaengige Daten.
 *
 * kontext = {
 *   bearbeitbar  Texte und Einstellungen aenderbar
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
    wuerfel: [360, 280]
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
    zufall: "Zufall",
    gruppen: "Gruppen",
    wuerfel: "Würfel"
  };

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

  var laufend = {}; // Intervalle von Timer und Stoppuhr pro Element

  function stoppen(id) {
    if (laufend[id]) {
      clearInterval(laufend[id]);
      delete laufend[id];
    }
  }

  function alleStoppen() {
    Object.keys(laufend).forEach(stoppen);
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
    return { knoten: knoten, griff: griff, werkzeuge: werkzeuge, koerper: koerper };
  }

  function lage(knoten, e) {
    knoten.style.left = e.x + "px";
    knoten.style.top = e.y + "px";
    knoten.style.width = e.b + "px";
    knoten.style.height = e.h + "px";
    knoten.style.zIndex = e.z;
  }

  /** Fuellt den Inhalt eines Elements */
  function inhaltBauen(e, teile, kontext) {
    var bauer = INHALT[e.typ];
    if (bauer) bauer(e, teile.koerper, teile.werkzeuge, teile.knoten, kontext);
    else teile.koerper.appendChild(el("p", "platzhalter-text", "Unbekanntes Element: " + e.typ));
  }

  /** Bearbeitbarer Text (nur reiner Text, kein HTML) */
  function textFeld(e, koerper, platzhalterText, kontext) {
    var feld = el("div", "textfeld");
    feld.dataset.platzhalter = kontext.bearbeitbar ? platzhalterText : "";
    feld.textContent = e.daten.text || "";
    feld.style.fontSize = (e.daten.groesse || 32) + "px";
    feld.style.fontWeight = e.daten.fett ? "700" : "";
    feld.style.textAlign = e.daten.ausrichtung || "";
    if (e.daten.farbe && e.typ === "text") feld.style.color = e.daten.farbe;
    if (kontext.bearbeitbar) {
      feld.contentEditable = "true";
      feld.spellcheck = false;
      feld.addEventListener("paste", function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var text = (ev.clipboardData || window.clipboardData).getData("text/plain");
        document.execCommand("insertText", false, text);
      });
      feld.addEventListener("input", function () {
        e.daten.text = feld.innerText.replace(/\n$/, "");
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
      e.daten.groesse = begrenzen((e.daten.groesse || 32) + schritt, 14, 200);
      feld.style.fontSize = e.daten.groesse + "px";
      kontext.festhalten();
    }
    if (mitFarbe) {
      werkzeug(werkzeuge, "farbe", "Textfarbe wechseln", function () {
        var i = TEXTFARBEN.indexOf(e.daten.farbe || TEXTFARBEN[0]);
        e.daten.farbe = TEXTFARBEN[(i + 1) % TEXTFARBEN.length];
        feld.style.color = e.daten.farbe;
        kontext.festhalten();
      });
    }
    werkzeug(werkzeuge, "fett", "Fett", function () {
      e.daten.fett = !e.daten.fett;
      feld.style.fontWeight = e.daten.fett ? "700" : "";
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
      var feld = textFeld(e, koerper, "Text eingeben …", kontext);
      schriftWerkzeuge(e, werkzeuge, feld, kontext, true);
    },

    notiz: function (e, koerper, werkzeuge, knoten, kontext) {
      if (!e.daten.farbe) e.daten.farbe = NOTIZFARBEN[0];
      knoten.style.setProperty("--notiz", e.daten.farbe);
      var feld = textFeld(e, koerper, "Notiz …", kontext);
      if (!e.daten.groesse) feld.style.fontSize = "28px";
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

    link: function (e, koerper) {
      var url = sicherUrl(e.daten.url);
      var karte = el("div", "link-karte");
      var a = el("a", null, e.daten.titel || url || "Link");
      if (url) {
        a.href = url;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
      }
      karte.appendChild(a);
      if (url) karte.appendChild(el("small", null, host(url)));
      koerper.appendChild(karte);
    },

    timer: function (e, koerper, werkzeuge, knoten, kontext) {
      if (!e.daten.sekunden) e.daten.sekunden = 300;
      var rest = e.daten.sekunden;
      var ende = 0;
      var anzeige = el("div", "gross-zahl", zeitText(rest));
      var balken = el("div", "zeit-balken");
      var fuellung = el("span");
      balken.appendChild(fuellung);
      var knoepfe = el("div", "widget-knoepfe");
      var minus = wKnopf("−1 min");
      var start = wKnopf("Start", true);
      var plus = wKnopf("+1 min");
      var neu = wKnopf("Zurück");
      [minus, start, plus, neu].forEach(function (k) {
        knoepfe.appendChild(k);
      });
      koerper.appendChild(anzeige);
      koerper.appendChild(balken);
      koerper.appendChild(knoepfe);

      function zeichnen() {
        anzeige.textContent = zeitText(rest);
        fuellung.style.width = (rest / e.daten.sekunden) * 100 + "%";
        koerper.classList.toggle("abgelaufen", rest <= 0);
      }
      function anhalten() {
        stoppen(e.id);
        start.textContent = "Start";
      }
      start.addEventListener("click", function () {
        if (laufend[e.id]) {
          anhalten();
          return;
        }
        if (rest <= 0) rest = e.daten.sekunden;
        ende = Date.now() + rest * 1000;
        start.textContent = "Pause";
        laufend[e.id] = setInterval(function () {
          rest = (ende - Date.now()) / 1000;
          if (rest <= 0) {
            rest = 0;
            anhalten();
            signal();
          }
          zeichnen();
        }, 200);
        zeichnen();
      });
      function verstellen(schritt) {
        anhalten();
        e.daten.sekunden = begrenzen(e.daten.sekunden + schritt, 60, 99 * 60);
        rest = e.daten.sekunden;
        zeichnen();
        kontext.festhalten();
      }
      minus.addEventListener("click", function () {
        verstellen(-60);
      });
      plus.addEventListener("click", function () {
        verstellen(60);
      });
      neu.addEventListener("click", function () {
        anhalten();
        rest = e.daten.sekunden;
        zeichnen();
      });
      zeichnen();
    },

    stoppuhr: function (e, koerper) {
      var vorher = 0;
      var seit = 0;
      var anzeige = el("div", "gross-zahl", "00:00.0");
      var knoepfe = el("div", "widget-knoepfe");
      var start = wKnopf("Start", true);
      var neu = wKnopf("Zurück");
      knoepfe.appendChild(start);
      knoepfe.appendChild(neu);
      koerper.appendChild(anzeige);
      koerper.appendChild(knoepfe);
      function zeichnen() {
        var ms = vorher + (laufend[e.id] ? Date.now() - seit : 0);
        var s = Math.floor(ms / 1000);
        anzeige.textContent = zweistellig(Math.floor(s / 60)) + ":" + zweistellig(s % 60) + "." + Math.floor((ms % 1000) / 100);
      }
      start.addEventListener("click", function () {
        if (laufend[e.id]) {
          vorher += Date.now() - seit;
          stoppen(e.id);
          start.textContent = "Start";
        } else {
          seit = Date.now();
          laufend[e.id] = setInterval(zeichnen, 100);
          start.textContent = "Pause";
        }
        zeichnen();
      });
      neu.addEventListener("click", function () {
        stoppen(e.id);
        vorher = 0;
        start.textContent = "Start";
        zeichnen();
      });
    },

    zufall: function (e, koerper, werkzeuge, knoten, kontext) {
      if (e.daten.namen == null) e.daten.namen = "";
      if (!e.daten.gezogen) e.daten.gezogen = [];
      if (e.daten.ohne == null) e.daten.ohne = true;
      koerper.innerHTML = "";

      if (!namenListe(e.daten.namen).length || e.daten.bearbeiten) {
        var feld = el("textarea", "namen-feld");
        feld.placeholder = "Namen, einer pro Zeile";
        feld.value = e.daten.namen;
        var zeile = el("label", "widget-option");
        var ohne = el("input");
        ohne.type = "checkbox";
        ohne.checked = e.daten.ohne;
        zeile.appendChild(ohne);
        zeile.appendChild(document.createTextNode(" Gezogene nicht wiederholen"));
        var fertig = wKnopf("Fertig", true);
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
      var ziehen = wKnopf("Ziehen", true);
      var neu = wKnopf("Neu mischen");
      var liste = wKnopf("Namen");
      [ziehen, neu, liste].forEach(function (k) {
        knoepfe2.appendChild(k);
      });
      function infoZeigen() {
        info.textContent = e.daten.ohne ? namen.length - e.daten.gezogen.length + " von " + namen.length + " übrig" : namen.length + " Namen";
      }
      ziehen.addEventListener("click", function () {
        var offen = e.daten.ohne
          ? namen.filter(function (n) {
              return e.daten.gezogen.indexOf(n) === -1;
            })
          : namen;
        if (!offen.length) {
          anzeige.textContent = "Alle gezogen";
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
        var zeile = el("label", "widget-option", "Personen pro Gruppe ");
        var zahl = el("input");
        zahl.type = "number";
        zahl.min = "2";
        zahl.max = "10";
        zahl.value = e.daten.groesse;
        zeile.appendChild(zahl);
        var bilden = wKnopf("Gruppen bilden", true);
        bilden.addEventListener("click", function () {
          e.daten.namen = feld.value;
          e.daten.groesse = begrenzen(parseInt(zahl.value, 10) || 3, 2, 10);
          var namen = mischen(namenListe(e.daten.namen));
          if (namen.length < 2) {
            W.melden("Mindestens zwei Namen eingeben.");
            return;
          }
          var anzahl = Math.max(1, Math.round(namen.length / e.daten.groesse));
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
      [1, 2, 3].forEach(function (n) {
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
    stricheZeichnen: stricheZeichnen,
    seitenTitel: seitenTitel,
    hintergruende: [
      { wert: "weiss", text: "Weiss" },
      { wert: "kariert", text: "Kariert" },
      { wert: "liniert", text: "Liniert" },
      { wert: "punkte", text: "Punkte" },
      { wert: "gruen", text: "Wandtafel grün" },
      { wert: "dunkel", text: "Dunkelblau" },
      { wert: "kork", text: "Kork" }
    ]
  };
})();
