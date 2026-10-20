/*
 * Ansicht einer exportierten Tafel (eigenstaendige HTML-Datei).
 * Die Daten stehen in <script id="wandtafel-daten">. Seiten durchblaettern,
 * Timer, Zufall usw. benutzen; Aenderungen werden nicht gespeichert.
 * Mit der Klasse «drucken» am body werden alle Seiten untereinander fuer den
 * Druck (PDF) aufgebaut und der Druckdialog geoeffnet.
 */
(function () {
  "use strict";

  var W = window.Wandtafel;
  var E = W.Elemente;
  var el = W.el;

  var quelle = document.getElementById("wandtafel-daten");
  if (!quelle) return;
  var paket = JSON.parse(quelle.textContent);
  var tafel = paket.tafel;
  var medien = paket.medien || {};
  var drucken = document.body.classList.contains("drucken");
  var nummer = 0;

  var kontext = {
    bearbeitbar: false,
    druck: drucken,
    festhalten: function () {},
    speichern: function () {},
    mediumUrl: function (id) {
      return Promise.resolve(medien[id] ? medien[id].daten : null);
    }
  };

  function seiteBauen(seite) {
    var flaeche = el("div", "tafel hg-" + (seite.hintergrund || "weiss"));
    flaeche.style.width = E.BREITE + "px";
    flaeche.style.height = E.HOEHE + "px";
    var ebene = el("div", "ebene-elemente");
    seite.elemente
      .slice()
      .sort(function (a, b) {
        return (a.z || 0) - (b.z || 0);
      })
      .forEach(function (e) {
        var teile = E.rahmenBauen(e, kontext);
        E.inhaltBauen(e, teile, kontext);
        ebene.appendChild(teile.knoten);
      });
    var leinwand = el("canvas", "ebene-zeichnung");
    leinwand.width = E.BREITE * 2;
    leinwand.height = E.HOEHE * 2;
    flaeche.appendChild(ebene);
    flaeche.appendChild(leinwand);
    E.stricheZeichnen(leinwand, seite.striche);
    return flaeche;
  }

  // ---------- Druck ----------

  function druckAufbauen() {
    document.title = tafel.titel;
    tafel.seiten.forEach(function (seite) {
      var blatt = el("section", "druck-seite");
      blatt.appendChild(seiteBauen(seite));
      document.body.appendChild(blatt);
    });
    var bilder = Array.prototype.slice.call(document.images);
    Promise.all(
      bilder.map(function (b) {
        return b.complete
          ? null
          : new Promise(function (ok) {
              b.onload = b.onerror = ok;
            });
      })
    ).then(function () {
      setTimeout(function () {
        window.print();
      }, 300);
    });
  }

  // ---------- Praesentieren ----------

  var rahmen, buehne, anzeige, titelEl;

  function einpassen() {
    var flaeche = buehne.firstChild;
    if (!flaeche) return;
    var massstab = Math.min(rahmen.clientWidth / E.BREITE, rahmen.clientHeight / E.HOEHE);
    flaeche.style.transform = "scale(" + massstab + ")";
    flaeche.style.left = (rahmen.clientWidth - E.BREITE * massstab) / 2 + "px";
    flaeche.style.top = (rahmen.clientHeight - E.HOEHE * massstab) / 2 + "px";
  }

  function zeigen(n) {
    nummer = W.begrenzen(n, 0, tafel.seiten.length - 1);
    E.alleStoppen();
    buehne.innerHTML = "";
    buehne.appendChild(seiteBauen(tafel.seiten[nummer]));
    anzeige.textContent = nummer + 1 + " / " + tafel.seiten.length;
    titelEl.textContent = E.seitenTitel(tafel.seiten[nummer], nummer + 1);
    if (history.replaceState) history.replaceState(null, "", "#" + (nummer + 1));
    einpassen();
  }

  function vollbild() {
    if (document.fullscreenElement) document.exitFullscreen();
    else if (document.documentElement.requestFullscreen) document.documentElement.requestFullscreen();
  }

  function praesentationAufbauen() {
    document.title = tafel.titel;
    rahmen = el("main", "ansicht-rahmen");
    buehne = el("div", "ansicht-buehne");
    rahmen.appendChild(buehne);
    document.body.appendChild(rahmen);

    var leiste = el("nav", "praes-leiste");
    leiste.setAttribute("aria-label", "Seiten");
    var zurueck = W.knopf("p-knopf", "links", "Vorherige Seite (Pfeil links)");
    var weiter = W.knopf("p-knopf", "rechts", "Nächste Seite (Pfeil rechts)");
    anzeige = el("span", "praes-nummer");
    titelEl = el("span", "praes-titel");
    var voll = W.knopf("p-knopf", "vollbild", "Vollbild (F)");
    leiste.appendChild(el("strong", "praes-tafel", tafel.titel));
    leiste.appendChild(zurueck);
    leiste.appendChild(anzeige);
    leiste.appendChild(weiter);
    leiste.appendChild(titelEl);
    leiste.appendChild(voll);
    document.body.appendChild(leiste);

    zurueck.addEventListener("click", function () {
      zeigen(nummer - 1);
    });
    weiter.addEventListener("click", function () {
      zeigen(nummer + 1);
    });
    voll.addEventListener("click", vollbild);
    document.addEventListener("keydown", function (ev) {
      var a = document.activeElement;
      if (a && (a.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))) return;
      if (ev.ctrlKey || ev.metaKey || ev.altKey) return;
      if (ev.key === "ArrowRight" || ev.key === "PageDown" || ev.key === " ") zeigen(nummer + 1);
      else if (ev.key === "ArrowLeft" || ev.key === "PageUp") zeigen(nummer - 1);
      else if (ev.key === "Home") zeigen(0);
      else if (ev.key === "End") zeigen(tafel.seiten.length - 1);
      else if (ev.key === "f" || ev.key === "F") vollbild();
      else return;
      ev.preventDefault();
    });
    window.addEventListener("resize", einpassen);
    document.addEventListener("fullscreenchange", einpassen);
    var start = parseInt((location.hash || "").slice(1), 10);
    zeigen(start > 0 ? start - 1 : 0);
  }

  if (drucken) druckAufbauen();
  else praesentationAufbauen();

  window.WandtafelAnsicht = {
    seite: function () {
      return nummer + 1;
    },
    zeigen: function (n) {
      zeigen(n - 1);
    }
  };
})();
