/*
 * Service Worker: legt alle Dateien der Wandtafel im Browser ab, damit sie
 * auch ohne Internet startet. Antwortet sofort aus dem Zwischenspeicher und
 * holt im Hintergrund die neueste Fassung (gilt ab dem naechsten Laden).
 *
 * Neue Datei in site/? Hier in DATEIEN eintragen (der Browsertest prueft das).
 */
var CACHE = "wandtafel-v1";
var DATEIEN = [
  "./",
  "index.html",
  "tafel.html",
  "manifest.webmanifest",
  "css/basis.css",
  "css/start.css",
  "css/tafel.css",
  "js/app.js",
  "js/gemeinsam.js",
  "js/speicher.js",
  "js/qrcode.js",
  "js/elemente.js",
  "js/export.js",
  "js/pptx-lesen.js",
  "js/pptx.js",
  "js/start.js",
  "js/tafel.js",
  "js/ansicht.js",
  "fonts/carlito-latin-400-normal.woff2",
  "fonts/carlito-latin-400-italic.woff2",
  "fonts/carlito-latin-700-normal.woff2",
  "fonts/carlito-latin-700-italic.woff2",
  "bilder/symbol.svg",
  "bilder/symbol-192.png",
  "bilder/symbol-512.png",
  "bilder/symbol-maskable-512.png",
  "bilder/apple-touch-icon.png"
];

self.addEventListener("install", function (ev) {
  ev.waitUntil(
    caches.open(CACHE).then(function (c) {
      return c.addAll(DATEIEN.map(function (d) {
        return new Request(d, { cache: "reload" });
      }));
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener("activate", function (ev) {
  ev.waitUntil(
    caches.keys().then(function (namen) {
      return Promise.all(namen.filter(function (n) {
        return n.indexOf("wandtafel-") === 0 && n !== CACHE;
      }).map(function (n) {
        return caches.delete(n);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener("fetch", function (ev) {
  var anfrage = ev.request;
  var url = new URL(anfrage.url);
  // Nur eigene Dateien; YouTube, Webseiten usw. gehen direkt ins Internet
  if (anfrage.method !== "GET" || url.origin !== self.location.origin) return;
  // tafel.html?t=... und index.html#fach=... sind dieselbe Datei
  var schluessel = url.origin + url.pathname;

  ev.respondWith(
    caches.open(CACHE).then(function (c) {
      return c.match(schluessel).then(function (gespeichert) {
        var neu = fetch(anfrage).then(function (antwort) {
          if (antwort.ok && antwort.type === "basic") c.put(schluessel, antwort.clone());
          return antwort;
        });
        if (gespeichert) {
          ev.waitUntil(neu.catch(function () {}));
          return gespeichert;
        }
        return neu;
      });
    })
  );
});
