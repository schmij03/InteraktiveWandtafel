/*
 * Web-App: Service Worker anmelden (Betrieb ohne Internet) und auf der
 * Startseite den Knopf «Als App installieren» anbieten.
 */
(function () {
  "use strict";

  if ("serviceWorker" in navigator && /^https?:$/.test(window.location.protocol)) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("sw.js").catch(function () {});
    });
  }

  var knopf = document.getElementById("app-installieren");
  if (!knopf) return;
  var angebot = null;
  window.addEventListener("beforeinstallprompt", function (ev) {
    ev.preventDefault();
    angebot = ev;
    knopf.hidden = false;
  });
  knopf.addEventListener("click", function () {
    if (!angebot) return;
    angebot.prompt();
    angebot.userChoice.then(function () {
      angebot = null;
      knopf.hidden = true;
    });
  });
  window.addEventListener("appinstalled", function () {
    knopf.hidden = true;
  });
})();
