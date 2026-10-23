#!/usr/bin/env node
/*
 * Prueft die Website automatisch im Browser (Chromium mit Playwright):
 * Faecher, Kapitel und Tafeln anlegen, Elemente und Medien einfuegen, Seiten,
 * Zeichnen, Rueckgaengig, Speichern, Praesentieren, Export (HTML, PDF, Datei)
 * und Import, Betrieb als Web-App ohne Internet.
 *
 * Aufruf: node tools/pruefen.mjs [--bilder ordner]
 *   --bilder  speichert Bildschirmfotos in diesem Ordner
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { serverStarten, ORDNER } from "./server.mjs";

const args = process.argv.slice(2);
let bilderOrdner = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bilder") bilderOrdner = path.resolve(args[++i]);
}
if (bilderOrdner) fs.mkdirSync(bilderOrdner, { recursive: true });

const server = await serverStarten(0);
const BASIS = `http://localhost:${server.address().port}/`;
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "wandtafel-"));

let fehler = 0;
function pruefe(bedingung, text) {
  console.log((bedingung ? "  ok      " : "  FEHLER  ") + text);
  if (!bedingung) fehler++;
}

async function foto(seite, name) {
  if (bilderOrdner) await seite.screenshot({ path: path.join(bilderOrdner, name + ".png") });
}

// 1 x 1 Pixel PNG (orange) und eine winzige "Videodatei"
const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z/D/PwAHggJ/PchI7wAAAABJRU5ErkJggg==",
  "base64"
);

const startOptionen = process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {};
const browser = await chromium.launch(startOptionen);
const kontext = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
// Keine Zugriffe ins Internet im Test (YouTube, Wikipedia usw.)
await kontext.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>extern</p>" }));
const seite = await kontext.newPage();
const seitenFehler = [];
seite.on("pageerror", (e) => seitenFehler.push(e.message));
seite.on("dialog", (d) => d.accept());

async function dialogAusfuellen(werte, knopf) {
  const d = seite.locator("dialog[open]");
  await d.waitFor();
  for (const [name, wert] of Object.entries(werte)) {
    const feld = d.locator(`[name="${name}"]`).first();
    if ((await feld.getAttribute("type")) === "file") await feld.setInputFiles(wert);
    else if ((await feld.evaluate((e) => e.tagName)) === "SELECT") await feld.selectOption(wert);
    else await feld.fill(wert);
  }
  await d.locator(knopf ? `button:has-text("${knopf}")` : "button[type=submit]").click();
  await d.waitFor({ state: "detached" });
}

async function menuePunkt(text) {
  await seite.locator(".klappmenue button", { hasText: text }).first().click();
}

try {
  // ---------- Startseite ----------
  console.log("Startseite");
  await seite.goto(BASIS);
  await seite.waitForSelector(".willkommen");
  pruefe(true, "Willkommen bei leerer Sammlung");
  const robots = await (await fetch(BASIS + "robots.txt")).text();
  pruefe(/Disallow: \//.test(robots), "robots.txt sperrt Suchmaschinen");
  pruefe((await seite.locator('meta[name="robots"]').getAttribute("content")).includes("noindex"), "noindex gesetzt");
  await foto(seite, "01-willkommen");

  console.log("Fach und Kapitel anlegen");
  await seite.click("#fach-neu");
  await dialogAusfuellen({ name: "Mathematik" }, "Anlegen");
  await seite.waitForSelector(".fach-kopf h1:has-text('Mathematik')");
  pruefe((await seite.locator(".fach-eintrag").count()) === 1, "Fach erscheint in der Fächerliste");
  pruefe((await seite.locator(".kapitel h2").first().textContent()) === "Allgemein", "Neues Fach hat Kapitel «Allgemein»");
  await seite.click("text=+ Kapitel / Thema");
  await dialogAusfuellen({ name: "Brüche" }, "Anlegen");
  await seite.waitForSelector(".kapitel h2:has-text('Brüche')");
  pruefe((await seite.locator(".kapitel").count()) === 2, "Zweites Kapitel angelegt");
  pruefe(/#fach=/.test(seite.url()), "Fach steht in der Adresse");

  // Zweites Fach fuer Verschieben
  await seite.click("#fach-neu");
  await dialogAusfuellen({ name: "Deutsch" }, "Anlegen");
  await seite.waitForSelector(".fach-kopf h1:has-text('Deutsch')");
  await seite.click(".fach-eintrag:has-text('Mathematik')");
  await seite.waitForSelector(".fach-kopf h1:has-text('Mathematik')");
  pruefe(true, "Wechsel zwischen Fächern");

  console.log("Tafel anlegen");
  await seite.locator(".kapitel", { hasText: "Brüche" }).locator("text=+ Tafel").click();
  await dialogAusfuellen({ titel: "Brüche einführen" }, "Anlegen und öffnen");
  await seite.waitForURL(/tafel\.html\?t=/);
  await seite.waitForSelector("#tafel");
  await seite.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  pruefe((await seite.inputValue("#titel")) === "Brüche einführen", "Tafel geöffnet mit Titel");
  pruefe((await seite.textContent("#ort")).includes("Mathematik › Brüche"), "Ort (Fach › Kapitel) angezeigt");

  // ---------- Elemente ----------
  console.log("Elemente einfügen");
  await seite.click('[data-neu="text"]');
  await seite.keyboard.type("Was ist ein Bruch?");
  await seite.locator("#tafel").click({ position: { x: 5, y: 5 } });
  await seite.click('[data-neu="notiz"]');
  await seite.keyboard.type("1/2 = 2/4");
  await seite.locator("#tafel").click({ position: { x: 5, y: 5 } });

  await seite.click('[data-neu="bild"]');
  await dialogAusfuellen({ datei: { name: "punkt.png", mimeType: "image/png", buffer: PNG } }, "Einfügen");
  await seite.waitForSelector(".element-bild img[src^='blob:']");
  pruefe(true, "Bild hochgeladen (im Browser gespeichert)");

  await seite.click('[data-neu="video"]');
  await dialogAusfuellen({ url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=90" }, "Einbinden");
  const ytSrc = await seite.locator(".element-video iframe").getAttribute("src");
  pruefe(/youtube-nocookie\.com\/embed\/dQw4w9WgXcQ.*start=90/.test(ytSrc), "YouTube-Video mit Startzeit eingebunden");

  await seite.click('[data-neu="video"]');
  await dialogAusfuellen({ datei: { name: "film.webm", mimeType: "video/webm", buffer: Buffer.from("1a45dfa3", "hex") } }, "Einbinden");
  await seite.waitForSelector(".element-video video[src^='blob:']");
  pruefe(true, "Videodatei hochgeladen");

  await seite.click('[data-neu="webseite"]');
  await dialogAusfuellen({ url: "https://de.wikipedia.org/wiki/Bruchrechnung", titel: "Bruchrechnung" }, "Einfügen");
  const web = seite.locator(".element-webseite").last();
  pruefe((await web.locator("iframe").getAttribute("src")) === "https://de.wikipedia.org/wiki/Bruchrechnung", "Webseite als iframe eingebunden");
  pruefe((await web.locator(".griff-name").textContent()) === "Bruchrechnung", "Webseite mit eigenem Titel");
  pruefe((await web.locator("a.web-knopf").getAttribute("target")) === "_blank", "Webseite: «Neuer Tab» vorhanden");

  await seite.click('[data-neu="link"]');
  await dialogAusfuellen({ url: "example.org", titel: "Beispiel" }, "Einfügen");
  pruefe((await seite.locator(".element-link a").getAttribute("href")) === "https://example.org/", "Link ohne https:// ergänzt");

  await seite.click("#module-knopf");
  await menuePunkt("Timer");
  await seite.waitForSelector(".element-timer");
  await seite.click("#module-knopf");
  await menuePunkt("Würfel");
  await seite.locator(".element-wuerfel button:has-text('Würfeln')").click();
  await seite.waitForTimeout(800);
  pruefe((await seite.locator(".element-wuerfel .wuerfel").count()) === 1, "Würfel gewürfelt");

  const anzahl = await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[0].elemente.length);
  pruefe(anzahl === 9, `9 Elemente auf Seite 1 (${anzahl})`);
  const typen = await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[0].elemente.map((e) => e.typ).join(","));
  pruefe(typen === "text,notiz,bild,video,video,webseite,link,timer,wuerfel", "Alle Elementtypen gespeichert: " + typen);
  pruefe((await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[0].elemente[0].daten.text)) === "Was ist ein Bruch?", "Text gespeichert");

  // Verschieben am Griff
  const notiz = seite.locator(".element-notiz");
  const vorher = await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[0].elemente[1].x);
  const griff = await notiz.locator(".griff-name").boundingBox();
  await seite.mouse.move(griff.x + 10, griff.y + 10);
  await seite.mouse.down();
  await seite.mouse.move(griff.x + 80, griff.y + 40, { steps: 5 });
  await seite.mouse.up();
  const nachher = await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[0].elemente[1].x);
  pruefe(nachher > vorher, `Notiz verschoben (${vorher} → ${nachher})`);
  await foto(seite, "02-tafel-seite1");

  // ---------- Seiten und Zeichnen ----------
  console.log("Seiten, Zeichnen, Rückgängig");
  await seite.click("#seite-neu");
  pruefe((await seite.locator(".seite-eintrag").count()) === 2, "Zweite Seite angelegt");
  pruefe((await seite.evaluate(() => window.WandtafelEditor.seite())) === 2, "Zweite Seite ist aktiv");
  await seite.selectOption("#hintergrund", "gruen");
  await seite.click('[data-modus="zeichnen"]');
  const box = await seite.locator("#tafel").boundingBox();
  await seite.mouse.move(box.x + 100, box.y + 100);
  await seite.mouse.down();
  await seite.mouse.move(box.x + 300, box.y + 200, { steps: 10 });
  await seite.mouse.up();
  pruefe((await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[1].striche.length)) === 1, "Strich gezeichnet");
  await seite.keyboard.press("Control+z");
  pruefe((await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[1].striche.length)) === 0, "Rückgängig entfernt den Strich");
  await seite.keyboard.press("Control+y");
  pruefe((await seite.evaluate(() => window.WandtafelEditor.tafel().seiten[1].striche.length)) === 1, "Wiederholen stellt ihn wieder her");
  await seite.click('[data-modus="bearbeiten"]');
  await seite.click('[data-neu="text"]');
  await seite.keyboard.type("Seite zwei");
  await seite.locator("#tafel").click({ position: { x: 5, y: 5 } });
  pruefe((await seite.locator(".seite-eintrag.aktiv .seite-name").textContent()) === "Seite zwei", "Seitenliste zeigt ersten Text als Titel");
  await seite.locator(".seite-wahl").first().click();
  pruefe((await seite.locator(".element").count()) === 9, "Zurück auf Seite 1");
  await foto(seite, "03-tafel-seiten");

  // Speichern und neu laden
  await seite.evaluate(() => window.WandtafelEditor.speichern());
  await seite.reload();
  await seite.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  const geladen = await seite.evaluate(() => {
    const t = window.WandtafelEditor.tafel();
    return { seiten: t.seiten.length, elemente: t.seiten[0].elemente.length, striche: t.seiten[1].striche.length, hg: t.seiten[1].hintergrund };
  });
  pruefe(geladen.seiten === 2 && geladen.elemente === 9 && geladen.striche === 1 && geladen.hg === "gruen", "Nach Neuladen ist alles noch da");
  await seite.waitForSelector(".element-bild img[src^='blob:']");
  pruefe(true, "Bild nach Neuladen aus dem Speicher geladen");

  // ---------- Praesentieren ----------
  console.log("Präsentieren");
  await seite.click("#praesentieren");
  pruefe(await seite.evaluate(() => document.body.classList.contains("praesentieren")), "Präsentationsmodus aktiv");
  pruefe(await seite.locator(".tafel-leiste").isHidden(), "Werkzeugleiste ausgeblendet");
  pruefe((await seite.textContent("#p-nummer")) === "1 / 2", "Seitenanzeige 1 / 2");
  await seite.keyboard.press("ArrowRight");
  pruefe((await seite.textContent("#p-nummer")) === "2 / 2", "Pfeil rechts blättert weiter");
  await seite.click("#p-zeichnen");
  pruefe(await seite.evaluate(() => document.getElementById("tafel").classList.contains("zeichnen")), "Zeichnen in der Präsentation");
  await seite.click("#p-zeichnen");
  await foto(seite, "04-praesentation");
  await seite.click("#p-ende");
  pruefe(!(await seite.evaluate(() => document.body.classList.contains("praesentieren"))), "Präsentation beendet");

  // ---------- Export ----------
  console.log("Export");
  let dl = seite.waitForEvent("download");
  await seite.click("#export-knopf");
  await menuePunkt("HTML-Datei");
  const htmlDownload = await dl;
  const htmlPfad = path.join(TEMP, htmlDownload.suggestedFilename());
  await htmlDownload.saveAs(htmlPfad);
  pruefe(htmlDownload.suggestedFilename() === "Bruche_einfuhren.html" || /^Br.*\.html$/.test(htmlDownload.suggestedFilename()), "HTML-Datei: " + htmlDownload.suggestedFilename());
  const html = fs.readFileSync(htmlPfad, "utf8");
  pruefe(!/<script src=|<link rel="stylesheet"/.test(html), "HTML-Datei ist eigenständig (keine externen Skripte/Styles)");
  pruefe(/data:font\/woff2/.test(html), "Schrift eingebettet");

  dl = seite.waitForEvent("download");
  await seite.click("#export-knopf");
  await menuePunkt("Wandtafel-Datei");
  const jsonDownload = await dl;
  const jsonPfad = path.join(TEMP, jsonDownload.suggestedFilename());
  await jsonDownload.saveAs(jsonPfad);
  const paket = JSON.parse(fs.readFileSync(jsonPfad, "utf8"));
  pruefe(paket.format === "interaktive-wandtafel" && paket.art === "tafel", "Wandtafel-Datei hat das richtige Format");
  pruefe(Object.keys(paket.medien).length === 2, "Bild und Video sind in der Datei enthalten");
  pruefe(/\.wandtafel\.json$/.test(jsonDownload.suggestedFilename()), "Dateiname " + jsonDownload.suggestedFilename());

  // Offline-Ansicht pruefen (Datei per file:// oeffnen)
  const ansicht = await kontext.newPage();
  const ansichtFehler = [];
  ansicht.on("pageerror", (e) => ansichtFehler.push(e.message));
  await ansicht.goto("file://" + htmlPfad);
  await ansicht.waitForSelector(".ansicht-buehne .tafel .element");
  pruefe((await ansicht.locator(".ansicht-buehne .element").count()) === 9, "Offline-Ansicht zeigt Seite 1");
  pruefe(/^data:image\/png/.test(await ansicht.locator(".element-bild img").getAttribute("src")), "Bild in der Offline-Ansicht eingebettet");
  pruefe((await ansicht.locator("[contenteditable]").count()) === 0, "Offline-Ansicht ist nicht bearbeitbar");
  await ansicht.keyboard.press("ArrowRight");
  pruefe((await ansicht.textContent(".praes-nummer")) === "2 / 2", "Offline-Ansicht blättert");
  await ansicht.locator(".element-timer button:has-text('Start')").count();
  await foto(ansicht, "05-offline-ansicht");
  pruefe(ansichtFehler.length === 0, "Keine Fehler in der Offline-Ansicht" + (ansichtFehler.length ? ": " + ansichtFehler.join(" | ") : ""));
  await ansicht.close();

  // Druckansicht (PDF)
  const druckHtml = await seite.evaluate(() => window.Wandtafel.Export.htmlBauen(window.WandtafelEditor.tafel(), { drucken: true }));
  const druckPfad = path.join(TEMP, "druck.html");
  fs.writeFileSync(druckPfad, druckHtml);
  const druck = await kontext.newPage();
  await druck.addInitScript(() => {
    window.print = () => {
      window.__gedruckt = true;
    };
  });
  await druck.goto("file://" + druckPfad);
  await druck.waitForFunction(() => window.__gedruckt === true, null, { timeout: 15000 });
  pruefe((await druck.locator(".druck-seite").count()) === 2, "Druckansicht hat 2 Seiten und öffnet den Druckdialog");
  pruefe((await druck.locator(".druck-seite iframe").count()) === 0, "Webseiten und Videos im Druck als Platzhalter");
  const pdf = await druck.pdf({ preferCSSPageSize: true, printBackground: true });
  const pdfSeiten = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) || []).length;
  pruefe(pdfSeiten === 2, `PDF hat ${pdfSeiten} Seiten`);
  if (bilderOrdner) fs.writeFileSync(path.join(bilderOrdner, "06-export.pdf"), pdf);
  await druck.close();

  // ---------- Zurueck zur Uebersicht ----------
  console.log("Übersicht: Tafeln verwalten");
  await seite.click("#ort");
  await seite.waitForSelector(".tafel-karte");
  const karte = seite.locator(".tafel-karte").first();
  pruefe((await karte.locator("h3").textContent()) === "Brüche einführen", "Tafelkarte im Kapitel");
  pruefe((await karte.locator(".tafel-daten").textContent()).startsWith("2 Seiten"), "Karte zeigt 2 Seiten");
  pruefe((await karte.locator(".tafel-vorschau .element").count()) === 9, "Vorschau der ersten Seite");
  await foto(seite, "07-uebersicht");

  await karte.locator("button[aria-haspopup]").click();
  await menuePunkt("Duplizieren");
  await seite.waitForSelector(".tafel-karte:has-text('(Kopie)')");
  pruefe((await seite.locator(".tafel-karte").count()) === 2, "Tafel dupliziert");

  await seite.locator(".tafel-karte:has-text('(Kopie)') button[aria-haspopup]").click();
  await menuePunkt("Verschieben");
  const ziel = await seite.locator("dialog select option", { hasText: "Deutsch › Allgemein" }).getAttribute("value");
  await dialogAusfuellen({ ziel }, "Verschieben");
  await seite.waitForFunction(() => document.querySelectorAll(".tafel-karte").length === 1);
  pruefe(true, "Kopie in anderes Fach verschoben");

  await seite.fill("#suche", "Kopie");
  await seite.waitForSelector(".such-titel");
  pruefe((await seite.locator(".tafel-karte").count()) === 1 && (await seite.textContent(".tafel-ort")).includes("Deutsch"), "Suche findet die Tafel im anderen Fach");
  await seite.fill("#suche", "");

  // Kapitel und Fach exportieren, alles loeschen, wieder importieren
  dl = seite.waitForEvent("download");
  await seite.click("#sichern");
  await menuePunkt("Backup als Datei herunterladen");
  const sicherung = await dl;
  const sicherungPfad = path.join(TEMP, sicherung.suggestedFilename());
  await sicherung.saveAs(sicherungPfad);
  const sPaket = JSON.parse(fs.readFileSync(sicherungPfad, "utf8"));
  pruefe(sPaket.art === "sammlung" && sPaket.faecher.length === 2 && sPaket.tafeln.length === 2, "Sicherung enthält 2 Fächer und 2 Tafeln");

  for (const name of ["Mathematik", "Deutsch"]) {
    await seite.click(`.fach-eintrag:has-text('${name}')`);
    await seite.waitForSelector(`.fach-kopf h1:has-text('${name}')`);
    await seite.locator(".fach-knoepfe button[aria-haspopup]").click();
    await menuePunkt("Fach löschen");
    await dialogAusfuellen({}, "Löschen");
    await seite.waitForSelector(`.fach-eintrag:has-text('${name}')`, { state: "detached" });
  }
  await seite.waitForSelector(".willkommen");
  const rest = await seite.evaluate(() => Promise.all([window.Wandtafel.Speicher.alleTafeln(), window.Wandtafel.Speicher.medienAufraeumen()]).then((r) => r[0].length));
  pruefe(rest === 0, "Fächer gelöscht, keine Tafeln mehr im Speicher");

  await seite.setInputFiles("#import-datei", sicherungPfad);
  await dialogAusfuellen({}, "Laden");
  await seite.waitForSelector(".fach-eintrag:has-text('Deutsch')");
  pruefe((await seite.locator(".fach-eintrag").count()) === 2, "Sicherung importiert: 2 Fächer");
  await seite.click(".fach-eintrag:has-text('Mathematik')");
  await seite.waitForSelector(".tafel-karte");
  await seite.locator(".tafel-karte a.knopf-haupt").click();
  await seite.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  await seite.waitForSelector(".element-bild img[src^='blob:']");
  pruefe((await seite.locator(".element").count()) === 9, "Importierte Tafel mit Bild vollständig");

  // Einzelne Tafel (HTML-Export) in ein Kapitel importieren
  await seite.goto(BASIS);
  await seite.waitForSelector(".fach-kopf");
  await seite.setInputFiles("#import-datei", htmlPfad);
  await dialogAusfuellen({}, "Importieren");
  await seite.waitForFunction(() => document.querySelectorAll(".tafel-karte").length === 2);
  pruefe(true, "Exportierte HTML-Datei wieder importiert");

  // ---------- Beispiel ----------
  console.log("Beispiel");
  const neu = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  await neu.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>extern</p>" }));
  const bsp = await neu.newPage();
  bsp.on("pageerror", (e) => seitenFehler.push("Beispiel: " + e.message));
  await bsp.goto(BASIS);
  await bsp.click("#beispiel");
  await bsp.waitForSelector(".tafel-karte");
  pruefe((await bsp.locator(".kapitel").count()) === 2, "Beispiel mit zwei Kapiteln");
  await foto(bsp, "08-beispiel");
  await bsp.locator(".tafel-karte a.knopf:has-text('Präsentieren')").click();
  await bsp.waitForFunction(() => document.body.classList.contains("praesentieren"));
  pruefe((await bsp.textContent("#p-nummer")) === "1 / 3", "Beispiel startet als Präsentation");
  await foto(bsp, "09-beispiel-praesentation");
  await bsp.setViewportSize({ width: 390, height: 800 });
  await bsp.goto(BASIS);
  await bsp.waitForSelector(".tafel-karte");
  const breit = await bsp.evaluate(() => document.documentElement.scrollWidth);
  pruefe(breit <= 390, `Übersicht auf dem Handy ohne seitliches Scrollen (${breit}px)`);
  await foto(bsp, "10-handy");
  await neu.close();

  // ---------- Funktionen wie bei fobizz ----------
  {
  console.log("Funktionen wie bei fobizz");
  const fk = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
  await fk.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>extern</p>" }));
  const fs2 = await fk.newPage();
  fs2.on("pageerror", (e) => seitenFehler.push("fobizz: " + e.message));
  fs2.on("dialog", (d) => d.accept());
  const ed = (fn) => fs2.evaluate(fn);
  async function dlg(werte, knopf) {
    const d = fs2.locator("dialog[open]");
    await d.waitFor();
    for (const [name, wert] of Object.entries(werte)) {
      const feld = d.locator(`[name="${name}"]`).first();
      if ((await feld.getAttribute("type")) === "file") await feld.setInputFiles(wert);
      else if ((await feld.evaluate((e) => e.tagName)) === "SELECT") await feld.selectOption(wert);
      else await feld.fill(wert);
    }
    await d.locator(knopf ? `button:has-text("${knopf}")` : "button[type=submit]").click();
    await d.waitFor({ state: "detached" });
  }
  async function modul(name) {
    await fs2.click("#module-knopf");
    await fs2.locator(".klappmenue button", { hasText: new RegExp("^" + name + "$") }).click();
  }
  const daten = (typ) => fs2.evaluate((t) => window.WandtafelEditor.tafel().seiten[window.WandtafelEditor.seite() - 1].elemente.filter((e) => e.typ === t).pop().daten, typ);

  await fs2.goto(BASIS);
  await fs2.click("#beispiel");
  await fs2.waitForSelector(".tafel-karte");
  await fs2.locator(".tafel-karte a.knopf-haupt").first().click();
  await fs2.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  const seitenVorher = await ed(() => window.WandtafelEditor.tafel().seiten.length);
  await fs2.click("#seite-neu");
  await fs2.waitForFunction((n) => window.WandtafelEditor.tafel().seiten.length === n + 1, seitenVorher);

  await modul("Uhr");
  await fs2.waitForSelector(".element-uhr svg.uhr-blatt");
  pruefe(/^\d\d:\d\d$/.test(await fs2.locator(".uhr-digital").textContent()), "Uhr zeigt die aktuelle Zeit");

  await modul("Ampel");
  await fs2.click(".element-ampel .ampel-gruen");
  pruefe((await daten("ampel")).licht === "gruen" && (await fs2.locator(".ampel-gruen.an").count()) === 1, "Ampel auf Grün geschaltet");

  await modul("Sozialform");
  await fs2.click('.element-sozialform button[data-form="gruppe"]');
  pruefe((await daten("sozialform")).form === "gruppe" && (await fs2.locator(".sozialform-aktuell strong").textContent()) === "Gruppenarbeit", "Sozialform auf Gruppenarbeit");

  await modul("Lostopf");
  await fs2.locator(".element-zufall textarea").fill("Anna\nBen");
  await fs2.locator(".element-zufall button", { hasText: "Lose in den Topf geben" }).click();
  for (let i = 0; i < 2; i++) {
    await fs2.locator(".element-zufall button", { hasText: "Los ziehen" }).click();
    await fs2.waitForTimeout(1000);
  }
  await fs2.locator(".element-zufall button", { hasText: "Los ziehen" }).click();
  pruefe((await fs2.locator(".zufall-name").textContent()) === "Der Topf ist leer!", "Lostopf: nach zwei Losen ist der Topf leer");
  await fs2.locator(".element-zufall button", { hasText: "Alle zurück in den Topf" }).click();
  pruefe((await daten("zufall")).gezogen.length === 0, "Lostopf: alle Lose zurück im Topf");

  await modul("Gruppen");
  await fs2.locator(".element-gruppen textarea").fill("A\nB\nC\nD\nE\nF\nG");
  await fs2.locator(".element-gruppen select").selectOption("anzahl");
  await fs2.locator(".element-gruppen input[type=number]").fill("3");
  await fs2.locator(".element-gruppen button", { hasText: "Gruppen bilden" }).click();
  pruefe((await fs2.locator(".element-gruppen .gruppe").count()) === 3, "Gruppen nach Anzahl: 3 Gruppen");

  await modul("Würfel");
  await fs2.locator(".element-wuerfel select").selectOption("5");
  pruefe((await fs2.locator(".element-wuerfel .wuerfel").count()) === 5, "Fünf Würfel");

  await modul("Timer");
  const timer = fs2.locator(".element-timer").last();
  await timer.locator("button", { hasText: "10 min" }).click();
  pruefe((await timer.locator(".gross-zahl").textContent()) === "10:00", "Timer-Vorgabe 10 Minuten");
  await timer.locator("button", { hasText: "Andere Zeit" }).click();
  await timer.locator('input[aria-label="Minuten"]').fill("1");
  await timer.locator('input[aria-label="Sekunden"]').fill("30");
  await timer.locator("button", { hasText: "OK" }).click();
  pruefe((await timer.locator(".gross-zahl").textContent()) === "01:30", "Timer mit eigener Zeit 1:30");

  await fs2.click('[data-neu="link"]');
  await dlg({ url: "https://example.org/aufgabe", qr: "ja" }, "Einfügen");
  pruefe((await fs2.locator(".element-link .qr-bild svg path").count()) === 1, "Link mit QR-Code");

  await fs2.click('[data-neu="webseite"]');
  await dlg({ url: '<iframe src="https://learningapps.org/watch?v=abc123" width="100%"></iframe>' }, "Einfügen");
  pruefe((await fs2.locator(".element-webseite iframe").last().getAttribute("src")) === "https://learningapps.org/watch?v=abc123", "iFrame-Snippet eingebettet");

  await fs2.click('[data-neu="datei"]');
  await dlg({ datei: { name: "arbeitsblatt.txt", mimeType: "text/plain", buffer: Buffer.from("Aufgabe 1") } }, "Hochladen");
  await fs2.waitForSelector(".element-datei a[download][href^='blob:']");
  pruefe((await fs2.locator(".element-datei .datei-info strong").textContent()) === "arbeitsblatt.txt", "Datei hochgeladen mit Download");

  // Spotlight und Verschieben ueber das Menue «…»
  const uhr = fs2.locator(".element-uhr");
  await uhr.hover();
  await uhr.locator('[title="Weitere Aktionen"]').click();
  await fs2.locator(".klappmenue button", { hasText: "Im Spotlight zeigen" }).click();
  pruefe((await fs2.locator(".element.im-spotlight").count()) === 1, "Spotlight geöffnet");
  await fs2.keyboard.press("Escape");
  pruefe((await fs2.locator(".element.im-spotlight").count()) === 0, "Spotlight mit Esc geschlossen");

  const vorherAnzahl = await ed(() => window.WandtafelEditor.tafel().seiten[0].elemente.length);
  await uhr.hover();
  await uhr.locator('[title="Weitere Aktionen"]').click();
  await fs2.locator(".klappmenue button", { hasText: "Auf andere Seite verschieben" }).click();
  await fs2.locator(".klappmenue button", { hasText: "Seite 1:" }).click();
  pruefe((await ed(() => window.WandtafelEditor.tafel().seiten[0].elemente.length)) === vorherAnzahl + 1 && (await fs2.locator(".element-uhr").count()) === 0, "Uhr auf Seite 1 verschoben");

  // Eigenes Design
  await fs2.selectOption("#hintergrund", "eigen");
  await dlg({ farbe: "#203040", muster: "kariert", bild: { name: "hg.png", mimeType: "image/png", buffer: PNG } }, "Übernehmen");
  await fs2.waitForFunction(() => /url\(/.test(document.getElementById("tafel").style.backgroundImage));
  const design = await ed(() => {
    const s = window.WandtafelEditor.tafel().seiten[window.WandtafelEditor.seite() - 1];
    return { hg: s.hintergrund, farbe: s.hgFarbe, muster: s.hgMuster, bild: !!s.hgBild, css: document.getElementById("tafel").style.backgroundImage };
  });
  pruefe(design.hg === "eigen" && design.farbe === "#203040" && design.muster === "kariert" && design.bild && /linear-gradient/.test(design.css), "Eigenes Design: Farbe, Muster und Hintergrundbild");

  // Bild bemalen
  await fs2.click('[data-neu="bild"]');
  await dlg({ datei: { name: "punkt.png", mimeType: "image/png", buffer: PNG } }, "Einfügen");
  await fs2.waitForSelector(".element-bild img[src^='blob:']");
  const altesMedium = (await daten("bild")).medium;
  const bild = fs2.locator(".element-bild").last();
  await bild.hover();
  await bild.locator('[title="Weitere Aktionen"]').click();
  await fs2.locator(".klappmenue button", { hasText: "Bild bemalen" }).click();
  const leinwand = fs2.locator("dialog.maler canvas");
  await leinwand.waitFor();
  const lw = await leinwand.boundingBox();
  await fs2.mouse.move(lw.x + lw.width * 0.2, lw.y + lw.height * 0.2);
  await fs2.mouse.down();
  await fs2.mouse.move(lw.x + lw.width * 0.8, lw.y + lw.height * 0.8, { steps: 5 });
  await fs2.mouse.up();
  await fs2.locator("dialog.maler button", { hasText: "Speichern" }).click();
  await fs2.waitForFunction((alt) => {
    const s = window.WandtafelEditor.tafel().seiten[window.WandtafelEditor.seite() - 1];
    const b = s.elemente.filter((e) => e.typ === "bild").pop();
    return b.daten.medium && b.daten.medium !== alt;
  }, altesMedium);
  pruefe(true, "Bild bemalt und als neues Bild gespeichert");
  await fs2.locator("#tafel").click({ position: { x: 5, y: 5 } });
  await fs2.locator(".element-timer").last().hover();
  await foto(fs2, "10b-fobizz-bearbeiten");

  pruefe((await fs2.locator("#farben .farbknopf").count()) === 9, "Neun Zeichenfarben");

  // Export enthaelt Hintergrundbild und Datei; Offline-Ansicht zeigt die neuen Karten
  const paket = await ed(() => window.Wandtafel.Export.tafelPaket(window.WandtafelEditor.tafel()));
  const nr = await ed(() => window.WandtafelEditor.seite());
  const letzte = paket.tafel.seiten[nr - 1];
  const datei = letzte.elemente.find((e) => e.typ === "datei");
  pruefe(!!paket.medien[letzte.hgBild] && !!paket.medien[datei.daten.medium], "Export enthält Hintergrundbild und Datei");
  await ed(() => window.WandtafelEditor.speichern());
  const [dl] = await Promise.all([fs2.waitForEvent("download"), (async () => {
    await fs2.click("#export-knopf");
    await fs2.locator(".klappmenue button", { hasText: "HTML-Datei" }).click();
  })()]);
  const offlinePfad = path.join(TEMP, "fobizz.html");
  await dl.saveAs(offlinePfad);
  const off = await fk.newPage();
  off.on("pageerror", (e) => seitenFehler.push("fobizz offline: " + e.message));
  await off.goto("file://" + offlinePfad + "#" + nr);
  await off.waitForSelector(".element-datei");
  pruefe((await off.locator(".element-ampel, .element-sozialform, .element-link .qr-bild").count()) === 3, "Offline-Ansicht zeigt Ampel, Sozialform und QR-Code");
  pruefe(/url\(/.test(await off.locator(".tafel").first().evaluate((e) => e.style.backgroundImage)), "Offline-Ansicht mit Hintergrundbild");
  await foto(off, "11-fobizz-offline");

  // Spotlight beim Praesentieren
  await fs2.click("#praesentieren");
  await fs2.waitForFunction(() => document.body.classList.contains("praesentieren"));
  const ampel = fs2.locator(".element-ampel");
  await ampel.hover();
  await ampel.locator(".spot-knopf").click();
  pruefe((await fs2.locator(".element-ampel.im-spotlight").count()) === 1, "Spotlight beim Präsentieren");
  await foto(fs2, "12-spotlight");
  await fs2.keyboard.press("Escape");
  pruefe((await fs2.locator(".im-spotlight").count()) === 0 && (await fs2.evaluate(() => document.body.classList.contains("praesentieren"))), "Esc schliesst zuerst das Spotlight");
  await fk.close();
  }

  // ---------- Funktionen wie in PowerPoint ----------
  {
  console.log("Funktionen wie in PowerPoint");
  const pk = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
  await pk.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>extern</p>" }));
  const pp = await pk.newPage();
  pp.on("pageerror", (e) => seitenFehler.push("powerpoint: " + e.message));
  pp.on("dialog", (d) => d.accept());
  const ed = (fn, arg) => pp.evaluate(fn, arg);
  async function dlg(werte, knopf) {
    const d = pp.locator("dialog[open]");
    await d.waitFor();
    for (const [name, wert] of Object.entries(werte)) {
      const feld = d.locator(`[name="${name}"]`).first();
      const typ = await feld.getAttribute("type");
      if (typ === "checkbox") await feld.setChecked(!!wert);
      else if ((await feld.evaluate((e) => e.tagName)) === "SELECT") await feld.selectOption(wert);
      else await feld.fill(String(wert));
    }
    await d.locator(knopf ? `button:has-text("${knopf}")` : "button[type=submit]").click();
    await d.waitFor({ state: "detached" });
  }
  async function menuePunkt(text) {
    await pp.locator(".klappmenue button", { hasText: text }).first().click();
  }
  const aktuelle = () => ed(() => window.WandtafelEditor.tafel().seiten[window.WandtafelEditor.seite() - 1]);
  const letztes = async (typ) => (await aktuelle()).elemente.filter((e) => e.typ === typ).pop();
  async function elementMenue(knoten, text) {
    await knoten.hover();
    await knoten.locator('[title="Weitere Aktionen"]').click();
    await menuePunkt(text);
  }

  await pp.goto(BASIS);
  await pp.click("#beispiel");
  await pp.waitForSelector(".tafel-karte");
  await pp.locator(".tafel-karte a.knopf-haupt").first().click();
  await pp.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());

  // Folienlayout «Titel und Inhalt»
  const anzahlVorher = await ed(() => window.WandtafelEditor.tafel().seiten.length);
  await pp.click("#seite-layout");
  await menuePunkt("Titel und Inhalt");
  await pp.waitForFunction((n) => window.WandtafelEditor.tafel().seiten.length === n + 1, anzahlVorher);
  const layoutSeite = await aktuelle();
  pruefe(layoutSeite.elemente.length === 2 && layoutSeite.elemente[1].daten.liste === "punkte", "Neue Seite mit Layout «Titel und Inhalt»");
  const ppNr = await ed(() => window.WandtafelEditor.seite());
  await pp.locator(".element-text .textfeld").first().click();
  await pp.keyboard.type("Wasserkreislauf");
  await pp.locator(".element-text .textfeld").nth(1).click();
  await pp.keyboard.type("Verdunstung");
  await pp.keyboard.press("Enter");
  await pp.keyboard.type("Niederschlag");
  await pp.locator("#tafel").click({ position: { x: 5, y: 5 } });
  const inhalt = (await aktuelle()).elemente[1].daten.text;
  pruefe(inhalt === "Verdunstung\nNiederschlag" && (await pp.locator(".element-text .liste-punkte > div").count()) === 2, "Aufzählung mit zwei Punkten");

  // Form mit Text und Format
  await pp.click("#formen-knopf");
  await menuePunkt("Stern");
  await pp.waitForSelector(".element-form svg polygon");
  const form = pp.locator(".element-form").last();
  await form.locator(".koerper").dblclick();
  await pp.keyboard.type("Super");
  await pp.locator("#tafel").click({ position: { x: 5, y: 5 } });
  pruefe((await letztes("form")).daten.text === "Super", "Form «Stern» mit Text");
  await form.hover();
  await form.locator('[title^="Format"]').click();
  await dlg({ form: "pfeil", fuellung: "#ff0000", fett: true, kursiv: true, schrift: "serif" }, "Übernehmen");
  const formDaten = (await letztes("form")).daten;
  const fuell = await pp.locator(".element-form").last().locator(".form-bild > *").evaluate((e) => e.style.fill);
  pruefe(formDaten.form === "pfeil" && formDaten.fett && formDaten.kursiv && /255, 0, 0|#ff0000/.test(fuell), "Format: Pfeil, rot gefüllt, fett und kursiv");

  // Tabelle
  await pp.click('[data-neu="tabelle"]');
  await dlg({ spalten: 2, zeilen: 3 }, "Einfügen");
  await pp.waitForSelector(".element-tabelle th");
  await pp.keyboard.type("Begriff");
  const tab = pp.locator(".element-tabelle").last();
  await tab.locator("td").first().click();
  await pp.keyboard.type("Wolke");
  await tab.hover();
  await tab.locator('[title="Zeile hinzufügen"]').click();
  const tabDaten = (await letztes("tabelle")).daten;
  pruefe(tabDaten.zellen.length === 4 && tabDaten.zellen[0][0] === "Begriff" && tabDaten.zellen[1][0] === "Wolke", "Tabelle mit Kopfzeile, Text und neuer Zeile");

  // Animationen: zuerst die Form, dann die Tabelle
  await elementMenue(pp.locator(".element-form").last(), "Animation hinzufügen");
  await dlg({ effekt: "zoomen", nr: 1 }, "Übernehmen");
  await elementMenue(pp.locator(".element-tabelle").last(), "Animation hinzufügen");
  await dlg({ effekt: "einblenden", nr: 2 }, "Übernehmen");
  pruefe((await pp.locator(".anim-marke").count()) === 2, "Animationen mit Reihenfolge-Nummern");

  // Hilfslinien: Form an die Seitenmitte ziehen
  const f2 = pp.locator(".element-form").last();
  await f2.locator(".koerper").click();
  const fd = await letztes("form");
  const rahmenBox = await pp.locator("#tafel").boundingBox();
  const massstab = rahmenBox.width / 1600;
  const kb = await f2.locator(".koerper").boundingBox();
  const zielX = rahmenBox.x + (800 - fd.b / 2 + 4) * massstab + (kb.x - (rahmenBox.x + fd.x * massstab));
  await pp.mouse.move(kb.x + 20, kb.y + 20);
  await pp.mouse.down();
  await pp.mouse.move(zielX + 10, kb.y + 25, { steps: 6 });
  await pp.mouse.move(zielX + 20, kb.y + 25, { steps: 2 });
  const linieDa = (await pp.locator(".hilfslinie.senkrecht").count()) > 0;
  await pp.mouse.up();
  const fn = await letztes("form");
  pruefe(linieDa && fn.x + fn.b / 2 === 800, "Hilfslinie: Form rastet in der Seitenmitte ein");

  // Pfeiltasten, Duplizieren, Kopieren und Einfügen
  await pp.keyboard.press("ArrowRight");
  await pp.waitForTimeout(600);
  pruefe((await letztes("form")).x === fn.x + 2, "Pfeiltaste verschiebt das gewählte Element");
  await pp.keyboard.press("Control+d");
  pruefe((await aktuelle()).elemente.filter((e) => e.typ === "form").length === 2, "Ctrl+D dupliziert");
  await ed(() => {
    const e = window.WandtafelEditor.tafel().seiten[window.WandtafelEditor.seite() - 1].elemente.find((x) => x.typ === "form");
    const dt = new DataTransfer();
    dt.setData("application/x-wandtafel-element", JSON.stringify(e));
    document.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true }));
  });
  const formen = (await aktuelle()).elemente.filter((e) => e.typ === "form");
  pruefe(formen.length === 3 && formen[2].anim && formen[2].anim.effekt === "zoomen", "Kopiertes Element einfügen (mit Animation)");
  for (let i = 0; i < 2; i++) {
    await pp.locator(".element-form").last().locator(".koerper").click();
    await pp.keyboard.press("Delete");
  }

  // Notizen zur Seite
  await pp.click("#notizen-knopf");
  await pp.locator("#notizen").fill("Zuerst fragen, wo Regen herkommt.");
  await pp.locator("#tafel").click({ position: { x: 5, y: 5 } });
  pruefe((await aktuelle()).notizen === "Zuerst fragen, wo Regen herkommt.", "Notizen zur Seite");

  // Uebergang fuer alle Seiten, eine ausgeblendete Seite danach
  await pp.locator(".seite-eintrag.aktiv .seite-mehr").click();
  await menuePunkt("Übergang");
  await dlg({ art: "schieben", alle: true }, "Übernehmen");
  pruefe(await ed(() => window.WandtafelEditor.tafel().seiten.every((s) => s.uebergang === "schieben")), "Übergang «Schieben» für alle Seiten");
  await pp.click("#seite-layout");
  await menuePunkt("Nur Titel");
  await pp.locator(".seite-eintrag.aktiv .seite-mehr").click();
  await menuePunkt("Beim Präsentieren ausblenden");
  pruefe((await pp.locator(".seite-eintrag.ausgeblendet").count()) === 1, "Seite beim Präsentieren ausgeblendet");
  await pp.locator(".seite-eintrag .seite-wahl").nth(ppNr - 1).click();
  await pp.locator(".element-form").last().locator(".koerper").click();
  await pp.waitForTimeout(800);
  await foto(pp, "13-powerpoint-bearbeiten");

  // Praesentieren: Animationen, ausgeblendete Seite, Uebergang, Laser, Abdecken, Sprung
  await pp.click("#praesentieren");
  await pp.waitForFunction(() => document.body.classList.contains("praesentieren"));
  pruefe((await pp.locator(".element-form.anim-wartet, .element-tabelle.anim-wartet").count()) === 2, "Präsentieren: animierte Elemente zuerst versteckt");
  await pp.keyboard.press("ArrowRight");
  pruefe((await pp.locator(".element-form.anim-zoomen").count()) === 1 && (await pp.locator(".element-tabelle.anim-wartet").count()) === 1, "Weiter zeigt zuerst die Form");
  await pp.keyboard.press("ArrowRight");
  pruefe((await ed(() => window.WandtafelEditor.seite())) === ppNr && (await pp.locator(".anim-wartet").count()) === 0, "Weiter zeigt danach die Tabelle, noch auf derselben Seite");
  // Playwright haelt Anfragen aus about:blank-Fenstern an, solange umgeleitet wird
  await pk.unrouteAll({ behavior: "ignoreErrors" });
  const [ref] = await Promise.all([pp.waitForEvent("popup"), pp.keyboard.press("r")]);
  await ref.waitForSelector(".ref-notizen");
  pruefe((await ref.locator(".ref-notizen").textContent()) === "Zuerst fragen, wo Regen herkommt." && /Animation 2 von 2/.test(await ref.locator("#ref-links h2").textContent()), "Referentenansicht mit Notizen und Animationsstand");
  await ref.locator(".ref-vorschau").first().waitFor();
  await ref.waitForTimeout(400);
  if (bilderOrdner) await ref.screenshot({ path: path.join(bilderOrdner, "14-referentenansicht.png") });
  await ref.locator(".ref-fuss button", { hasText: "Zurück" }).click();
  pruefe((await pp.locator(".element-tabelle.anim-wartet").count()) === 1, "Zurück in der Referentenansicht nimmt die letzte Animation zurück");
  await pp.bringToFront();
  await pp.keyboard.press("ArrowRight");
  await pp.keyboard.press("ArrowRight");
  pruefe((await ed(() => window.WandtafelEditor.seite())) === ppNr + 2, "Ausgeblendete Seite wird übersprungen");
  await pp.keyboard.press("ArrowLeft");
  pruefe(
    (await ed(() => window.WandtafelEditor.seite())) === ppNr && /ueb-schieben/.test(await pp.locator("#tafel").getAttribute("class")) && (await pp.locator(".anim-wartet").count()) === 0,
    "Zurück mit Übergang, die Seite steht mit allen Animationen da"
  );
  await pp.keyboard.press("l");
  await pp.mouse.move(500, 400);
  pruefe((await pp.evaluate(() => document.body.classList.contains("mit-laser"))) && (await pp.locator("#laser").isVisible()), "Laserpointer");
  await pp.keyboard.press("l");
  await pp.keyboard.press("b");
  pruefe(await pp.locator(".abdeckung-schwarz").isVisible(), "Taste B: schwarzer Bildschirm");
  await pp.keyboard.press("x");
  pruefe(!(await pp.locator("#abdeckung").isVisible()), "Beliebige Taste zeigt die Seite wieder");
  await pp.keyboard.type("1");
  await pp.keyboard.press("Enter");
  pruefe((await ed(() => window.WandtafelEditor.seite())) === 1, "Seitennummer und Enter springt zu Seite 1");
  await pp.keyboard.press("End");
  await pp.waitForTimeout(800);
  await foto(pp, "15-powerpoint-praesentieren");
  await Promise.all([ref.waitForEvent("close", { timeout: 5000 }).catch(() => {}), pp.keyboard.press("Escape")]);
  await pk.route(/^https?:\/\/(?!localhost)/, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<p>extern</p>" }));
  pruefe(ref.isClosed() && !(await pp.evaluate(() => document.body.classList.contains("praesentieren"))), "Ende der Präsentation schliesst die Referentenansicht");

  // Seiten per Ziehen umsortieren
  const ersteVorher = await ed(() => window.WandtafelEditor.tafel().seiten[0].id);
  await pp.locator(".seite-eintrag").nth(1).dragTo(pp.locator(".seite-eintrag").nth(0));
  pruefe((await ed(() => window.WandtafelEditor.tafel().seiten[1].id)) === ersteVorher, "Seiten per Ziehen umsortiert");

  // PowerPoint-Export
  await ed(() => window.WandtafelEditor.speichern());
  const [pptxDl] = await Promise.all([pp.waitForEvent("download"), (async () => {
    await pp.click("#export-knopf");
    await menuePunkt("PowerPoint");
  })()]);
  const pptxPfad = path.join(TEMP, "tafel.pptx");
  await pptxDl.saveAs(pptxPfad);
  const pptx = fs.readFileSync(pptxPfad);
  const roh = pptx.toString("utf8");
  const folien = (roh.match(/ppt\/slides\/slide\d+\.xml/g) || []).filter((n, i, a) => a.indexOf(n) === i).length;
  pruefe(
    pptx.subarray(0, 2).toString() === "PK" && pptxDl.suggestedFilename().endsWith(".pptx") && folien === (await ed(() => window.WandtafelEditor.tafel().seiten.length)),
    "PowerPoint-Datei mit einer Folie pro Seite"
  );
  pruefe(
    roh.includes("Wasserkreislauf") && roh.includes('<a:buChar char="•"/>') && roh.includes('prst="rightArrow"') && roh.includes("<a:tbl>") && roh.includes("Zuerst fragen, wo Regen herkommt.") && roh.includes("<p:push") && roh.includes('show="0"'),
    "PowerPoint: Text, Aufzählung, Form, Tabelle, Notizen, Übergang und ausgeblendete Folie"
  );
  if (process.env.PPTX_PRUEFEN) fs.copyFileSync(pptxPfad, process.env.PPTX_PRUEFEN);

  // Offline-Ansicht: Animationen und Uebergaenge laufen auch dort
  const [htmlDl] = await Promise.all([pp.waitForEvent("download"), (async () => {
    await pp.click("#export-knopf");
    await menuePunkt("HTML-Datei");
  })()]);
  const ppOffline = path.join(TEMP, "powerpoint.html");
  await htmlDl.saveAs(ppOffline);
  const nrNachher = await ed(() => window.WandtafelEditor.tafel().seiten.findIndex((s) => s.notizen) + 1);
  const off = await pk.newPage();
  off.on("pageerror", (e) => seitenFehler.push("powerpoint offline: " + e.message));
  await off.goto("file://" + ppOffline + "#" + nrNachher);
  await off.waitForSelector(".element-form", { state: "attached" });
  const wartetVorher = await off.locator(".anim-wartet").count();
  await off.keyboard.press("ArrowRight");
  pruefe(wartetVorher === 2 && (await off.locator(".anim-wartet").count()) === 1, "Offline-Ansicht mit Animationen");
  await pk.close();
  }

  // ---------- PowerPoint importieren ----------
  {
  console.log("PowerPoint importieren");
  const ik = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
  const ip = await ik.newPage();
  ip.on("pageerror", (e) => seitenFehler.push("pptx-import: " + e.message));
  const ied = (fn, arg) => ip.evaluate(fn, arg);
  await ip.goto(BASIS);
  await ip.waitForSelector("#willkommen-pptx");
  pruefe(await ip.locator("#pptx-import").isVisible(), "Knopf «PowerPoint importieren» oben");
  // Vorlage: tools/testdaten/beispiel.pptx (4:3, Platzhalter, Design-Farben, gepackt wie von PowerPoint)
  await ip.setInputFiles("#import-datei", path.join(path.dirname(new URL(import.meta.url).pathname), "testdaten", "beispiel.pptx"));
  const fertig = ip.locator("dialog[open]");
  await fertig.waitFor();
  pruefe(/4 Folien/.test(await fertig.textContent()) && /1 Diagramm\b/.test(await fertig.textContent()), "Zusammenfassung mit Hinweis auf nicht übernommene Diagramme");
  await ip.waitForTimeout(300);
  await foto(ip, "16-pptx-import");
  await fertig.locator("button:has-text('Tafel öffnen')").click();
  await ip.waitForURL(/tafel\.html\?t=/);
  await ip.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  const it = await ied(() => window.WandtafelEditor.tafel());
  const [i1, i2, i3, i4] = it.seiten;
  const textVon = (s, t) => s.elemente.find((e) => (e.daten.text || "").includes(t));
  pruefe(it.titel === "Wasserkreislauf" && it.seiten.length === 4 && i2.titel === "Stationen", "Tafel mit Titel, 4 Seiten und Seitentiteln aus den Folientiteln");
  const titel1 = textVon(i1, "Der Wasserkreislauf");
  pruefe(
    titel1 && titel1.daten.farbe === "#ffffff" && titel1.daten.ausrichtung === "center" && titel1.daten.groesse === 73 && titel1.x === 290,
    "Titel mit Farbe, Ausrichtung und Grösse aus Master und Layout, 4:3 mittig eingepasst"
  );
  pruefe(i1.hintergrund === "eigen" && i1.hgFarbe === "#21295c" && i1.notizen === "Begrüssung und Vorwissen sammeln." && i1.uebergang === "blenden", "Hintergrund, Notizen und Übergang");
  const liste = textVon(i2, "Verdunstung");
  pruefe(liste && liste.daten.liste === "punkte" && liste.daten.groesse === 53 && liste.daten.text.split("\n").length === 4, "Aufzählung mit Stufen aus dem Master");
  const stern = i2.elemente.find((e) => e.typ === "form");
  pruefe(stern && stern.daten.form === "stern" && stern.daten.fuellung === "#e4572e" && stern.daten.farbe === "#ffffff" && stern.anim && stern.anim.effekt === "fliegen", "Form mit Füllung, Textfarbe aus dem Formstil und Animation");
  const bild = i2.elemente.find((e) => e.typ === "bild");
  pruefe(bild && bild.daten.medium, "Bild im Browser gespeichert");
  const tab = i3.elemente.find((e) => e.typ === "tabelle");
  pruefe(tab && tab.daten.kopf && tab.daten.zellen[2][0] === "Lugano", "Tabelle mit Kopfzeile");
  pruefe(i3.elemente.filter((e) => e.typ === "form").length === 2 && i3.striche.length === 1 && i3.striche[0].farbe === "#2e7d32", "Gruppe aufgelöst, Linie als Zeichnung");
  const zusatz = textVon(i4, "Zusatz");
  pruefe(i4.ausgeblendet && zusatz && zusatz.daten.schrift === "serif" && zusatz.daten.fett && i4.elemente.some((e) => e.typ === "video" && e.daten.medium), "Ausgeblendete Folie mit Schriftart und eingebettetem Video");
  const zl = (zusatz && zusatz.daten.laeufe) || [];
  pruefe(
    zusatz.daten.text === "Zusatz für Schnelle\nnur kurz" && zl.some((l) => l.t === "nur " && l.fett === false && l.groesse < zusatz.daten.groesse) && zl.some((l) => l.t === "kurz" && l.farbe === "#065a82"),
    "Zweite Zeile und ein einzelnes Wort mit eigenem Format bleiben erhalten"
  );
  const ts = (tab && tab.daten.stile) || [[{}], [{}], [{}, {}, {}]];
  pruefe(
    ts[0][0].fuellung === "#4f81bd" && ts[0][0].farbe === "#ffffff" && ts[0][0].fett && ts[1][0].fuellung !== ts[2][0].fuellung && ts[2][2].fuellung === "#ffe082" && ts[2][2].fett,
    "Tabelle mit Farben aus dem Tabellenstil, Streifen und eigener Zellfüllung"
  );
  await foto(ip, "17-pptx-titelfolie");
  await ip.locator(".seite-eintrag .seite-wahl").nth(1).click();
  await ip.waitForSelector(".element-form");
  await ip.waitForTimeout(400);
  await foto(ip, "18-pptx-folie2");
  await ip.locator(".seite-eintrag .seite-wahl").nth(2).click();
  await ip.waitForSelector(".element-tabelle td");
  // Zeile 3, Spalte 3 (die Kopfzeile hat th)
  const zelle = await ip.evaluate(() => getComputedStyle(document.querySelectorAll(".element-tabelle td")[5]).backgroundColor);

  // Gemischtes Format wird angezeigt und bleibt beim Weiterschreiben erhalten
  await ip.locator(".seite-eintrag .seite-wahl").nth(3).click();
  const zFeld = ip.locator('.element[data-id="' + zusatz.id + '"] .textfeld');
  await zFeld.waitFor();
  const blau = await zFeld.evaluate((f) => {
    var s = [...f.querySelectorAll("span[data-lauf]")].find((x) => x.textContent === "kurz");
    return s ? getComputedStyle(s).color : "";
  });
  await zFeld.click();
  await zFeld.evaluate((f) => {
    var a = window.getSelection();
    a.selectAllChildren(f);
    a.collapseToEnd();
  });
  await ip.keyboard.type("!");
  const karte = i4.elemente.find((e) => e.typ === "form" && e.daten.form === "abgerundet");
  const ecken = await ip.evaluate((id) => {
    var k = document.querySelector('.element[data-id="' + id + '"]');
    var r = k.querySelector(".form-bild rect");
    var b = k.getBoundingClientRect();
    return { rx: (r.getAttribute("rx") * b.width) / 100, ry: (r.getAttribute("ry") * b.height) / 100 };
  }, karte.id);
  const knapp = textVon(i4, "Auftrag");
  const sichtbar = await ip.evaluate((id) => getComputedStyle(document.querySelector('.element[data-id="' + id + '"] .koerper')).overflow, knapp.id);
  pruefe(
    Math.abs(karte.daten.rundung - 0.16667) < 0.001 && ecken.rx > 10 && Math.abs(ecken.rx - ecken.ry) < 1.5 && sichtbar === "visible",
    "Breite Karte mit runden (nicht gestreckten) Ecken, knappes Textfeld wird nicht abgeschnitten"
  );
  const nachher = await ied((id) => window.WandtafelEditor.tafel().seiten[3].elemente.find((e) => e.id === id).daten, zusatz.id);
  pruefe(
    blau === "rgb(6, 90, 130)" && nachher.text === "Zusatz für Schnelle\nnur kurz!" && nachher.laeufe.some((l) => l.t === "kurz!" && l.farbe === "#065a82") && nachher.laeufe.some((l) => l.t === "nur " && l.fett === false),
    "Wort in eigener Farbe angezeigt, Weiterschreiben behält das Format"
  );
  pruefe(zelle === "rgb(255, 224, 130)", "Zelle mit eigener Füllung angezeigt");

  // Rundlauf: als PowerPoint exportieren und die Datei wieder als Seiten anhängen
  await ied(() => window.WandtafelEditor.speichern());
  const [rundDl] = await Promise.all([ip.waitForEvent("download"), (async () => {
    await ip.click("#export-knopf");
    await ip.locator(".klappmenue button", { hasText: "PowerPoint" }).first().click();
  })()]);
  const rundPfad = path.join(TEMP, "rundlauf.pptx");
  await rundDl.saveAs(rundPfad);
  await ip.setInputFiles("#import-datei", rundPfad);
  await ip.waitForFunction(() => window.WandtafelEditor.tafel().seiten.length === 8);
  const zurueck = await ied(() => window.WandtafelEditor.tafel().seiten.slice(4));
  const r2 = zurueck[1];
  const rListe = r2.elemente.find((e) => (e.daten.text || "").includes("Verdunstung"));
  const rStern = r2.elemente.find((e) => e.typ === "form" && e.daten.form === "stern");
  const rTab = zurueck[2].elemente.find((e) => e.typ === "tabelle");
  const rZusatz = zurueck[3].elemente.find((e) => (e.daten.text || "").includes("Zusatz"));
  const rKarte = zurueck[3].elemente.find((e) => e.typ === "form" && e.daten.form === "abgerundet");
  pruefe(rKarte && Math.abs(rKarte.daten.rundung - 0.16667) < 0.001, "Rundlauf PowerPoint: Rundung der Ecken");
  pruefe(
    rZusatz && (rZusatz.daten.laeufe || []).some((l) => l.t === "kurz!" && l.farbe === "#065a82" && l.fett === false) && rTab && rTab.daten.stile && rTab.daten.stile[2][2].fuellung === "#ffe082" && rTab.daten.stile[0][0].fett,
    "Rundlauf PowerPoint: eigenes Format von Textstellen und Tabellenzellen"
  );
  pruefe(
    rListe && rListe.daten.liste === "punkte" && Math.abs(rListe.daten.groesse - 53) <= 1 && Math.abs(rListe.x - liste.x) <= 1 && rStern && rStern.daten.fuellung === "#e4572e" &&
      rTab && Math.abs(rTab.x - tab.x) <= 1 && Math.abs(rTab.b - tab.b) <= 1 && zurueck[0].notizen === i1.notizen && zurueck[3].ausgeblendet,
    "Rundlauf PowerPoint-Export und -Import: Lage, Grösse, Liste, Form, Tabelle, Notizen"
  );

  // Beispiel-Lektion aus der KI-Anleitung (docs/ki-anleitung.md) laesst sich importieren
  console.log("Beispiel-Lektion der KI-Anleitung");
  await ip.goto(BASIS);
  await ip.waitForSelector(".fach-eintrag");
  await ip.setInputFiles("#import-datei", path.join(path.dirname(new URL(import.meta.url).pathname), "..", "docs", "beispiel-lektion.wandtafel.json"));
  const wohin = ip.locator("dialog[open]");
  await wohin.waitFor();
  await wohin.locator("button[type=submit]").click();
  await ip.waitForSelector(".tafel-karte:has-text('Der Wasserkreislauf (Lektion)')");
  await ip.locator(".tafel-karte:has-text('Der Wasserkreislauf (Lektion)') a.knopf-haupt").click();
  await ip.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  const lektion = await ied(() => window.WandtafelEditor.tafel());
  const typen = new Set(lektion.seiten.flatMap((s) => s.elemente.map((e) => e.typ)));
  pruefe(
    lektion.seiten.length === 5 && ["timer", "sozialform", "gruppen", "zufall", "ampel", "tabelle", "form", "link"].every((t) => typen.has(t)) && lektion.seiten.every((s) => s.notizen),
    "Beispiel-Lektion: 5 Seiten mit Modulen, Tabelle, Formen und Notizen"
  );
  await ip.waitForSelector(".element-timer");
  pruefe((await ip.locator(".element").count()) === 5, "Beispiel-Lektion: alle Elemente der ersten Seite sichtbar");
  await foto(ip, "19-ki-lektion");

  // Fertige Lektionsreihe (docs/lektionen) als Sammlung mit Jahr importieren
  console.log("Lektionsreihe 02-Algorithmen");
  await ip.goto(BASIS);
  await ip.waitForSelector(".fach-eintrag");
  await ip.setInputFiles("#import-datei", path.join(path.dirname(new URL(import.meta.url).pathname), "..", "docs", "lektionen", "02-algorithmen-3-sek.wandtafel.json"));
  await ip.waitForSelector(".jahr-knopf:has-text('3. Sek')");
  const reihe = await ip.evaluate(() =>
    Promise.all([window.Wandtafel.Speicher.sammlung(), window.Wandtafel.Speicher.alleTafeln()]).then(function (r) {
      var fach = r[0].faecher.find((f) => f.name === "Medien und Informatik");
      var jahr = fach && (fach.jahre || []).find((j) => j.name === "3. Sek");
      var kapitel = jahr && fach.kapitel.find((k) => k.name === "02-Algorithmen" && k.jahr === jahr.id);
      var tafeln = kapitel ? kapitel.tafeln.map((id) => r[1].find((t) => t.id === id)) : [];
      return {
        anzahl: tafeln.length,
        titel: tafeln.map((t) => t && t.titel),
        innen: tafeln.every((t) => t && t.seiten.every((s) => s.elemente.every((e) => e.x >= 0 && e.y >= 0 && e.x + e.b <= 1600 && e.y + e.h <= 900)))
      };
    })
  );
  pruefe(reihe.anzahl === 5 && reihe.titel[0] === "Lektion 1: Insertionsort" && reihe.titel[4] === "Lektion 5: Mergesort", "Lektionsreihe: 5 Tafeln in Medien und Informatik › 3. Sek › 02-Algorithmen");
  pruefe(reihe.innen, "Lektionsreihe: alle Elemente innerhalb der Seite");
  await ik.close();
  }

  // ---------- Jahre (Fach > Jahr > Kapitel > Tafel) ----------
  console.log("Jahre im Fach");
  {
    const jk = await browser.newContext({ viewport: { width: 1400, height: 860 }, acceptDownloads: true });
    const jp = await jk.newPage();
    jp.on("pageerror", (e) => seitenFehler.push("Jahre: " + e.message));
    const offenerDialog = () => jp.locator("dialog[open]");
    const bestaetigen = async (knopf) => {
      await offenerDialog().locator(knopf ? `button:has-text("${knopf}")` : "button[type=submit]").click();
      await offenerDialog().waitFor({ state: "detached" });
    };
    const sammlungLesen = () => jp.evaluate(() => window.Wandtafel.Speicher.sammlung());

    await jp.goto(BASIS);
    await jp.click("#fach-neu");
    await offenerDialog().locator('[name="name"]').fill("Geschichte");
    await offenerDialog().locator('[name="jahr0"]').check();
    await offenerDialog().locator('[name="jahr1"]').check();
    await bestaetigen("Anlegen");
    await jp.waitForSelector(".jahr-reiter");
    pruefe(
      JSON.stringify(await jp.locator(".jahr-knopf").evaluateAll((a) => a.map((x) => x.firstChild.textContent))) === JSON.stringify(["Alle", "1. Sek", "2. Sek"]) &&
        (await jp.locator(".kapitel").count()) === 0,
      "Neues Fach mit 1. und 2. Sek, ohne Kapitel «Allgemein»"
    );

    await jp.click("#jahr-neu");
    pruefe((await offenerDialog().locator('[name="name"]').inputValue()) === "3. Sek", "Vorschlag für das nächste Jahr: 3. Sek");
    await bestaetigen("Anlegen");
    await jp.waitForSelector(".jahr-knopf.aktiv:has-text('3. Sek')");
    pruefe(/jahr=/.test(jp.url()), "Neues Jahr gewählt und in der Adresse");

    await jp.click(".jahr-knopf:has-text('1. Sek')");
    await jp.waitForSelector(".jahr-knopf.aktiv:has-text('1. Sek')");
    await jp.click("text=+ Kapitel / Thema");
    pruefe((await offenerDialog().locator('[name="jahr"] option:checked').textContent()) === "1. Sek", "Neues Thema: gewähltes Jahr vorbelegt");
    await offenerDialog().locator('[name="name"]').fill("Die Römer");
    await bestaetigen("Anlegen");
    await jp.waitForSelector(".kapitel h2:has-text('Die Römer')");
    await jp.locator(".kapitel", { hasText: "Die Römer" }).locator("text=+ Tafel").click();
    await offenerDialog().locator('[name="titel"]').fill("Lektion 1: Rom entsteht");
    await bestaetigen("Anlegen und öffnen");
    await jp.waitForURL(/tafel\.html\?t=/);
    await jp.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
    pruefe((await jp.textContent("#ort")) === "Geschichte › 1. Sek › Die Römer", "Ort mit Jahr: Fach › Jahr › Thema");
    await jp.click("#ort");
    await jp.waitForSelector(".jahr-knopf.aktiv:has-text('1. Sek')");
    pruefe((await jp.locator(".tafel-karte").count()) === 1, "Zurück zur Übersicht im selben Jahr");

    await jp.click(".jahr-knopf:has-text('2. Sek')");
    await jp.waitForSelector(".jahr-knopf.aktiv:has-text('2. Sek')");
    pruefe((await jp.locator(".kapitel").count()) === 0 && (await jp.locator(".leer-hinweis").count()) === 1, "Anderes Jahr zeigt nur seine Themen");

    await jp.click(".jahr-knopf:has-text('Alle')");
    await jp.waitForSelector(".jahr-titel");
    pruefe(
      JSON.stringify(await jp.locator(".jahr-titel").allTextContents()) === JSON.stringify(["1. Sek", "2. Sek", "3. Sek"]) && (await jp.locator(".kapitel").count()) === 1,
      "«Alle» zeigt die Jahre mit ihren Themen untereinander"
    );
    await foto(jp, "21-jahre");

    // Thema in ein anderes Jahr verschieben
    await jp.locator(".kapitel", { hasText: "Die Römer" }).locator(".kapitel-kopf button[aria-haspopup]").click();
    await jp.locator(".klappmenue button", { hasText: "Jahr ändern" }).click();
    await offenerDialog().locator('[name="jahr"]').selectOption({ label: "2. Sek" });
    await bestaetigen("Verschieben");
    let sm = await sammlungLesen();
    let g = sm.faecher[0];
    const jahrName = (id) => (g.jahre.find((j) => j.id === id) || {}).name;
    pruefe(jahrName(g.kapitel[0].jahr) === "2. Sek", "Thema ins Jahr 2. Sek verschoben");

    // Sicherung mit Jahren: Fach loeschen und wieder importieren
    const dlJ = jp.waitForEvent("download");
    await jp.click("#sichern");
    await jp.locator(".klappmenue button", { hasText: "Backup als Datei herunterladen" }).click();
    const sicherungJ = path.join(TEMP, "jahre.wandtafel.json");
    await (await dlJ).saveAs(sicherungJ);
    await jp.locator(".fach-knoepfe button[aria-haspopup]").click();
    await jp.locator(".klappmenue button", { hasText: "Fach löschen" }).click();
    await bestaetigen("Löschen");
    await jp.waitForSelector(".willkommen");
    await jp.setInputFiles("#import-datei", sicherungJ);
    await bestaetigen("Laden");
    await jp.waitForSelector(".jahr-reiter");
    sm = await sammlungLesen();
    g = sm.faecher[0];
    pruefe(
      g.jahre.map((j) => j.name).join(",") === "1. Sek,2. Sek,3. Sek" && jahrName(g.kapitel[0].jahr) === "2. Sek" && g.kapitel[0].tafeln.length === 1,
      "Sicherung mit Jahren wieder importiert"
    );

    // Jahr entfernen: Themen und Tafeln bleiben (danach «Ohne Jahr»)
    await jp.click(".jahr-knopf:has-text('2. Sek')");
    await jp.waitForSelector(".jahr-knopf.aktiv:has-text('2. Sek')");
    await jp.locator(".jahr-reiter button[aria-haspopup]").click();
    await jp.locator(".klappmenue button", { hasText: "Jahr entfernen" }).click();
    await bestaetigen();
    await jp.waitForSelector(".jahr-titel:has-text('Ohne Jahr')");
    sm = await sammlungLesen();
    g = sm.faecher[0];
    pruefe(g.jahre.length === 2 && !g.kapitel[0].jahr && g.kapitel[0].tafeln.length === 1, "Jahr entfernt, Thema mit Tafel bleibt unter «Ohne Jahr»");
    await jk.close();
  }

  // ---------- Web-App ohne Internet ----------
  console.log("Web-App ohne Internet");
  {
    const manifest = JSON.parse(fs.readFileSync(path.join(ORDNER, "manifest.webmanifest"), "utf8"));
    pruefe(
      manifest.start_url && manifest.display === "standalone" && manifest.icons.every((i) => fs.existsSync(path.join(ORDNER, i.src))),
      "Manifest mit Startseite und vorhandenen Symbolen"
    );
    // Alle Dateien der Website muessen im Service Worker stehen, sonst fehlen sie offline
    const swText = fs.readFileSync(path.join(ORDNER, "sw.js"), "utf8");
    const liste = [...swText.match(/var DATEIEN = \[([\s\S]*?)\];/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    const alleDateien = fs.readdirSync(ORDNER, { recursive: true })
      .map((d) => d.split(path.sep).join("/"))
      .filter((d) => fs.statSync(path.join(ORDNER, d)).isFile() && d !== "sw.js" && !d.endsWith(".txt"));
    const fehlend = alleDateien.filter((d) => !liste.includes(d));
    const zuviel = liste.filter((d) => d !== "./" && !alleDateien.includes(d));
    pruefe(!fehlend.length && !zuviel.length, "Service Worker kennt alle Dateien" + (fehlend.length || zuviel.length ? ": fehlt " + fehlend.join(", ") + " / gibt es nicht " + zuviel.join(", ") : ""));

    const ok = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const op = await ok.newPage();
    op.on("pageerror", (e) => seitenFehler.push(e.message));
    op.on("dialog", (d) => d.accept());
    await op.goto(BASIS);
    await op.waitForSelector(".willkommen");
    await op.waitForFunction(() => navigator.serviceWorker && navigator.serviceWorker.controller);
    pruefe(true, "Service Worker aktiv");

    await ok.setOffline(true);
    const antwort = await op.reload();
    await op.waitForSelector(".willkommen");
    pruefe(antwort.fromServiceWorker(), "Startseite laedt ohne Internet");
    // Die Schrift laedt auch offline erst nach dem ersten Zeichnen, darauf warten
    pruefe(await op.evaluate(async () => (await document.fonts.load('16px "Carlito"')).length > 0 && document.fonts.check('16px "Carlito"') && getComputedStyle(document.body).backgroundColor !== "rgba(0, 0, 0, 0)"), "Ohne Internet: Stil und Schrift vorhanden");

    // Ohne Internet eine Lektion importieren und praesentieren
    await op.setInputFiles("#import-datei", path.join(path.dirname(new URL(import.meta.url).pathname), "..", "docs", "beispiel-lektion.wandtafel.json"));
    const karte = op.locator(".tafel-karte:has-text('Der Wasserkreislauf (Lektion)') a.knopf-haupt");
    // Bei leerer Sammlung fragt die Wandtafel nicht nach dem Ziel
    await op.locator("dialog[open], .tafel-karte").first().waitFor();
    if (await op.locator("dialog[open]").count()) await op.locator("dialog[open] button[type=submit]").click();
    await karte.waitFor();
    await karte.click();
    await op.waitForSelector(".element-timer");
    pruefe(/tafel\.html\?t=/.test(op.url()) && (await op.locator(".element").count()) === 5, "Ohne Internet: Tafel oeffnet mit allen Elementen");
    await foto(op, "20-offline");
    await ok.close();
  }

  pruefe(seitenFehler.length === 0, "Keine JavaScript-Fehler" + (seitenFehler.length ? ": " + seitenFehler.join(" | ") : ""));
} catch (e) {
  console.error(e);
  fehler++;
} finally {
  await browser.close();
  server.close();
  fs.rmSync(TEMP, { recursive: true, force: true });
}

console.log(fehler ? `\n${fehler} Fehler` : "\nAlles in Ordnung");
process.exit(fehler ? 1 : 0);
