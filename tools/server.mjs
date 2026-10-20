// Kleiner statischer Webserver fuer site/ (Vorschau und Browsertest)
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const WURZEL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const ORDNER = path.join(WURZEL, "site");

const TYPEN = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".mp4": "video/mp4",
  ".webm": "video/webm"
};

export function serverStarten(port = 0) {
  const server = http.createServer((anfrage, antwort) => {
    let pfad = decodeURIComponent(new URL(anfrage.url, "http://x").pathname);
    if (pfad.endsWith("/")) pfad += "index.html";
    const datei = path.join(ORDNER, path.normalize(pfad));
    if (!datei.startsWith(ORDNER) || !fs.existsSync(datei) || !fs.statSync(datei).isFile()) {
      antwort.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      antwort.end("Nicht gefunden");
      return;
    }
    antwort.writeHead(200, { "Content-Type": TYPEN[path.extname(datei)] || "application/octet-stream" });
    fs.createReadStream(datei).pipe(antwort);
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}
