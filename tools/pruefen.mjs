#!/usr/bin/env node
/*
 * Prueft die Website automatisch im Browser (Chromium mit Playwright):
 * Faecher, Kapitel und Tafeln anlegen, Elemente und Medien einfuegen, Seiten,
 * Zeichnen, Rueckgaengig, Speichern, Praesentieren, Export (HTML, PDF, Datei)
 * und Import.
 *
 * Aufruf: node tools/pruefen.mjs [--bilder ordner]
 *   --bilder  speichert Bildschirmfotos in diesem Ordner
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";
import { serverStarten } from "./server.mjs";

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
