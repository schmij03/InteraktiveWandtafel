#!/usr/bin/env node
/*
 * Erzeugt die App-Symbole (PNG) aus site/bilder/symbol.svg.
 * Nur noetig, wenn sich das Symbol aendert. Aufruf: node tools/symbole.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { chromium } from "playwright";
import { ORDNER } from "./server.mjs";

const svg = fs.readFileSync(path.join(ORDNER, "bilder", "symbol.svg"), "utf8");
const GROESSEN = [
  ["symbol-192.png", 192, false],
  ["symbol-512.png", 512, false],
  // maskable und Apple: das System rundet die Ecken selbst
  ["symbol-maskable-512.png", 512, true],
  ["apple-touch-icon.png", 180, true]
];

const startOptionen = process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {};
const browser = await chromium.launch(startOptionen);
const seite = await browser.newPage();
for (const [name, px, vollflaechig] of GROESSEN) {
  // Vollflaechig: Hintergrund ohne runde Ecken, Tafel auf 80 % verkleinert
  const bild = vollflaechig
    ? svg
        .replace(' rx="112"', "")
        .replace(/(<rect width="512" height="512"[^>]*\/>)/, '$1<g transform="translate(51.2 51.2) scale(0.8)">')
        .replace("</svg>", "</g></svg>")
    : svg;
  await seite.setViewportSize({ width: px, height: px });
  await seite.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${px}px;height:${px}px}</style>${bild}`);
  await seite.screenshot({ path: path.join(ORDNER, "bilder", name), omitBackground: true });
  console.log("bilder/" + name);
}
await browser.close();
