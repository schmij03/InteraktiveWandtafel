#!/usr/bin/env node
/*
 * Prueft den Praesentationsmodus im Browser (Playwright):
 * Vollbild bzw. Pseudo-Vollbild (auch WebKit als iPad), Timer und Stoppuhr
 * laufen beim Verlassen weiter, Tabellen und Texte beim Praesentieren ausfuellen.
 *
 * Aufruf: node tools/pruefen-praesentation.mjs [--bilder ordner]
 */
import fs from "node:fs";
import path from "node:path";
import { chromium, webkit, devices } from "playwright";
import { serverStarten } from "./server.mjs";

const args = process.argv.slice(2);
let bilderOrdner = null;
for (let i = 0; i < args.length; i++) {
  if (args[i] === "--bilder") bilderOrdner = path.resolve(args[++i]);
}
if (bilderOrdner) fs.mkdirSync(bilderOrdner, { recursive: true });

const server = await serverStarten(0);
const BASIS = `http://localhost:${server.address().port}/`;

let fehler = 0;
function pruefe(bedingung, text) {
  console.log((bedingung ? "  ok      " : "  FEHLER  ") + text);
  if (!bedingung) fehler++;
}

async function foto(seite, name) {
  if (bilderOrdner) await seite.screenshot({ path: path.join(bilderOrdner, name + ".png") });
}

// Tafel mit zwei Seiten: Timer (6 s), Stoppuhr, leere Tabelle, leerer Text, Form, Notiz
function testTafel() {
  const e = (id, typ, x, y, b, h, daten) => ({ id, typ, x, y, b, h, z: 1, daten });
  return {
    id: "t-praes",
    version: 1,
    titel: "Präsentation",
    erstellt: Date.now(),
    geaendert: Date.now(),
    seiten: [
      {
        id: "s1",
        titel: "Eins",
        hintergrund: "weiss",
        striche: [],
        elemente: [
          e("e-timer", "timer", 40, 40, 400, 300, { sekunden: 6 }),
          e("e-uhr", "stoppuhr", 40, 380, 400, 260, {}),
          e("e-tab", "tabelle", 480, 40, 720, 284, { zellen: [["", ""], ["", ""]], kopf: false }),
          e("e-text", "text", 480, 360, 520, 170, { text: "", platzhalter: "Titel hinzufügen" }),
          e("e-form", "form", 1240, 40, 320, 240, { form: "abgerundet", text: "Example: …" }),
          e("e-notiz", "notiz", 1040, 400, 320, 280, { text: "" })
        ]
      },
      { id: "s2", titel: "Zwei", hintergrund: "weiss", striche: [], elemente: [e("e-t2", "text", 80, 80, 600, 160, { text: "Seite zwei" })] }
    ]
  };
}

async function tafelOeffnen(kontext) {
  const seite = await kontext.newPage();
  const seitenFehler = [];
  seite.on("pageerror", (f) => seitenFehler.push(f.message));
  await seite.goto(BASIS);
  await seite.waitForFunction(() => window.Wandtafel && window.Wandtafel.Speicher);
  await seite.evaluate((t) => window.Wandtafel.Speicher.tafelSpeichern(t), testTafel());
  await seite.goto(BASIS + "tafel.html?t=t-praes");
  await seite.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  return { seite, seitenFehler };
}

const anzeigeText = (seite, typ) => seite.locator(`.element-${typ} .gross-zahl`).textContent();
const praesentiert = (seite) => seite.evaluate(() => document.body.classList.contains("praesentieren"));
const sekunden = (t) => parseInt(t.slice(0, 2), 10) * 60 + parseInt(t.slice(3, 5), 10);

// ---------- Chromium (Desktop) ----------

async function desktop() {
  console.log("Chromium, Desktop");
  const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
  const kontext = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const { seite, seitenFehler } = await tafelOeffnen(kontext);

  await seite.click("#praesentieren");
  await seite.waitForFunction(() => document.body.classList.contains("praesentieren"));
  await seite.waitForTimeout(300);
  const vb = await seite.evaluate(() => ({ echt: !!document.fullscreenElement, pseudo: document.documentElement.classList.contains("pseudo-vollbild") }));
  pruefe(vb.echt || vb.pseudo, `Vollbild beim Präsentieren (echt: ${vb.echt}, pseudo: ${vb.pseudo})`);

  // Timer und Stoppuhr starten, Praesentation verlassen, im Editor warten, zurueck
  await seite.locator(".element-timer button:has-text('Start')").click();
  await seite.locator(".element-stoppuhr button:has-text('Start')").click();
  await seite.waitForTimeout(1200);
  await seite.click("#p-ende");
  pruefe(!(await praesentiert(seite)), "Präsentation beendet (Editor)");
  pruefe((await seite.locator(".element-timer .w-haupt >> nth=0").textContent()) === "Pause", "Timer läuft im Editor weiter (Knopf «Pause»)");
  await seite.waitForTimeout(1500);
  const imEditor = sekunden(await anzeigeText(seite, "timer"));
  pruefe(imEditor <= 4 && imEditor >= 2, `Timer zählt im Editor weiter (${imEditor} s übrig)`);
  const uhr1 = await anzeigeText(seite, "stoppuhr");
  pruefe(sekunden(uhr1) >= 2, `Stoppuhr läuft im Editor weiter (${uhr1})`);

  await seite.click("#praesentieren");
  await seite.waitForFunction(() => document.body.classList.contains("praesentieren"));
  pruefe((await seite.locator(".element-timer .w-haupt >> nth=0").textContent()) === "Pause", "Timer läuft nach der Rückkehr weiter");
  await seite.waitForFunction(() => document.querySelector(".element-timer .koerper").classList.contains("abgelaufen"), null, { timeout: 8000 });
  pruefe((await anzeigeText(seite, "timer")) === "00:00", "Timer nach Endzeit abgelaufen (00:00)");

  // Timer laeuft ab, waehrend eine andere Seite gezeigt wird
  await seite.locator(".element-timer button:has-text('Start')").click();
  await seite.keyboard.press("ArrowRight");
  await seite.waitForFunction(() => window.WandtafelEditor.seite() === 2);
  await seite.waitForTimeout(6500);
  await seite.keyboard.press("ArrowLeft");
  await seite.waitForFunction(() => window.WandtafelEditor.seite() === 1);
  pruefe(
    (await anzeigeText(seite, "timer")) === "00:00" && (await seite.locator(".element-timer .w-haupt >> nth=0").textContent()) === "Start",
    "Timer ist auf einer anderen Seite abgelaufen (Endzeit statt Ticks)"
  );
  const uhr2 = await anzeigeText(seite, "stoppuhr");
  pruefe(sekunden(uhr2) >= 9, `Stoppuhr lief auf der anderen Seite weiter (${uhr2})`);
  await seite.locator(".element-stoppuhr button:has-text('Pause')").click();
  const uhr3 = await anzeigeText(seite, "stoppuhr");
  await seite.waitForTimeout(600);
  pruefe((await anzeigeText(seite, "stoppuhr")) === uhr3, "Stoppuhr angehalten");

  // ---------- Eintragen beim Praesentieren ----------
  const lage = () => seite.evaluate(() => JSON.stringify(window.WandtafelEditor.tafel().seiten[0].elemente.map((e) => [e.id, e.x, e.y, e.b, e.h])));
  const lageVorher = await lage();
  await seite.locator(".element-tabelle td").first().click();
  await seite.keyboard.type("Algorithmus");
  await seite.keyboard.press("Tab");
  await seite.locator(".element-tabelle td").nth(3).click();
  await seite.keyboard.type("Schritt 1");
  pruefe(await praesentiert(seite), "Beim Tippen in der Tabelle bleibt die Präsentation offen");
  pruefe(await seite.evaluate(() => window.WandtafelEditor.seite() === 1), "Tippen blättert nicht um");
  await seite.keyboard.press("Backspace");
  await seite.keyboard.press("ArrowRight");
  pruefe(await seite.evaluate(() => window.WandtafelEditor.seite() === 1), "Rücktaste und Pfeil im Feld blättern nicht");

  await seite.locator(".element-text .textfeld").click();
  await seite.keyboard.type("Was ist ein Algorithmus?");
  await seite.locator(".element-notiz .textfeld").click();
  await seite.keyboard.type("Notiz im Unterricht");
  // Form: Platzhaltertext «Example: …» ersetzen
  await seite.locator(".element-form .koerper").click();
  await seite.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A");
  await seite.keyboard.type("Beispiel: Rezept");
  await seite.keyboard.press("Escape");
  pruefe(await praesentiert(seite), "Esc im Feld beendet nur das Schreiben, nicht die Präsentation");

  // Ziehen an der Form und Entf duerfen nichts verschieben oder loeschen
  const box = await seite.locator(".element-form").boundingBox();
  await seite.mouse.move(box.x + 20, box.y + 20);
  await seite.mouse.down();
  await seite.mouse.move(box.x + 160, box.y + 120, { steps: 6 });
  await seite.mouse.up();
  await seite.keyboard.press("Escape");
  await seite.keyboard.press("Delete");
  pruefe((await lage()) === lageVorher, "Nichts verschoben, in der Grösse verändert oder gelöscht");
  pruefe((await seite.locator(".element .griff-werkzeuge").count()) === 0, "Keine Werkzeuge (Löschen, Zeilen) beim Präsentieren");

  await seite.evaluate(() => window.WandtafelEditor.speichern());
  const gespeichert = await seite.evaluate(() => window.Wandtafel.Speicher.tafel("t-praes"));
  const el = (id) => gespeichert.seiten[0].elemente.find((e) => e.id === id).daten;
  pruefe(el("e-tab").zellen[0][0] === "Algorithmus" && el("e-tab").zellen[1][1] === "Schritt ", `Tabelle in IndexedDB gespeichert (${JSON.stringify(el("e-tab").zellen)})`);
  pruefe(el("e-text").text === "Was ist ein Algorithmus?", "Text in IndexedDB gespeichert");
  pruefe(el("e-notiz").text === "Notiz im Unterricht", "Notiz in IndexedDB gespeichert");
  pruefe(el("e-form").text === "Beispiel: Rezept", `Form in IndexedDB gespeichert («${el("e-form").text}»)`);
  await foto(seite, "praes-01-chromium-eingetragen");

  // Nach dem Neuladen sind die Eintraege noch da
  await seite.evaluate(() => window.WandtafelEditor.speichern());
  await seite.reload();
  await seite.waitForFunction(() => window.WandtafelEditor && window.WandtafelEditor.tafel());
  pruefe((await seite.locator(".element-text .textfeld").textContent()) === "Was ist ein Algorithmus?", "Einträge nach dem Neuladen vorhanden");

  // Vollbild-Knopf: Vollbild verlassen, Praesentation bleibt
  await seite.click("#praesentieren");
  await seite.waitForFunction(() => document.body.classList.contains("praesentieren"));
  await seite.waitForTimeout(300);
  await seite.click("#p-vollbild");
  await seite.waitForTimeout(400);
  pruefe(
    (await praesentiert(seite)) && !(await seite.evaluate(() => window.Wandtafel.vollbild.aktiv())),
    "Vollbild-Knopf verlässt das Vollbild, die Präsentation bleibt"
  );
  await seite.click("#p-vollbild");
  await seite.waitForTimeout(400);
  pruefe(await seite.evaluate(() => window.Wandtafel.vollbild.aktiv()), "Vollbild-Knopf schaltet das Vollbild wieder ein");
  await seite.keyboard.press("Escape");
  await seite.waitForTimeout(300);
  pruefe(!(await seite.evaluate(() => window.Wandtafel.vollbild.aktiv())), "Präsentation beendet: kein Vollbild mehr");

  pruefe(seitenFehler.length === 0, "Keine JavaScript-Fehler" + (seitenFehler.length ? ": " + seitenFehler.join(" | ") : ""));
  await browser.close();
}

// ---------- WebKit als iPad ----------

async function ipad() {
  const browser = await webkit.launch();
  const geraet = devices["iPad Pro 11 landscape"] || devices["iPad Pro 11"];

  console.log("WebKit, iPad Pro 11, ohne Fullscreen-API (wie installierte Web-App)");
  const k1 = await browser.newContext({ ...geraet });
  await k1.addInitScript(() => {
    for (const o of [Element.prototype, HTMLElement.prototype]) {
      delete o.requestFullscreen;
      delete o.webkitRequestFullscreen;
      delete o.webkitRequestFullScreen;
    }
    Object.defineProperty(Document.prototype, "fullscreenEnabled", { get: () => false, configurable: true });
    Object.defineProperty(Document.prototype, "webkitFullscreenEnabled", { get: () => false, configurable: true });
  });
  const a = await tafelOeffnen(k1);
  const s1 = a.seite;
  pruefe(await s1.evaluate(() => window.Wandtafel.IOS), "iPad erkannt");
  await s1.locator("#praesentieren").tap();
  await s1.waitForFunction(() => document.body.classList.contains("praesentieren"));
  await s1.waitForTimeout(300);
  pruefe(await s1.evaluate(() => document.documentElement.classList.contains("pseudo-vollbild")), "Pseudo-Vollbild eingeschaltet");
  const flaeche = await s1.evaluate(() => {
    const r = document.body.getBoundingClientRect();
    const t = document.getElementById("tafel").getBoundingClientRect();
    return { b: r.width, h: r.height, vb: innerWidth, vh: innerHeight, tb: t.width, th: t.height, kopf: getComputedStyle(document.querySelector(".tafel-kopf")).display };
  });
  pruefe(flaeche.b === flaeche.vb && flaeche.h === flaeche.vh, `Fläche deckt den ganzen Bildschirm (${flaeche.b}×${flaeche.h})`);
  pruefe(flaeche.kopf === "none", "Bedienleisten ausgeblendet");
  pruefe(Math.round(flaeche.tb) === flaeche.vb || Math.round(flaeche.th) === flaeche.vh, `Tafel füllt den Bildschirm (${Math.round(flaeche.tb)}×${Math.round(flaeche.th)})`);
  pruefe(await s1.locator("#p-vollbild").evaluate((k) => k.classList.contains("aktiv")), "Vollbild-Knopf zeigt «an»");

  // Timer starten, Vollbild verlassen und wieder einschalten
  await s1.locator(".element-timer button:has-text('Start')").tap();
  await s1.waitForTimeout(1000);
  await s1.locator("#p-vollbild").tap();
  pruefe(!(await s1.evaluate(() => document.documentElement.classList.contains("pseudo-vollbild"))) && (await praesentiert(s1)), "Pseudo-Vollbild verlassen, Präsentation bleibt");
  await s1.waitForTimeout(1000);
  await s1.locator("#p-vollbild").tap();
  const rest = sekunden(await anzeigeText(s1, "timer"));
  pruefe(rest <= 4 && (await s1.locator(".element-timer .w-haupt >> nth=0").textContent()) === "Pause", `Timer lief beim Verlassen weiter (${rest} s übrig)`);

  // Antippen und schreiben
  await s1.locator(".element-tabelle td").first().tap();
  await s1.keyboard.type("iPad");
  await s1.locator(".element-form .koerper").tap();
  await s1.keyboard.type(" ok");
  await s1.evaluate(() => window.WandtafelEditor.speichern());
  const t1 = await s1.evaluate(() => window.Wandtafel.Speicher.tafel("t-praes"));
  pruefe(t1.seiten[0].elemente[2].daten.zellen[0][0] === "iPad", "Tabelle auf dem iPad ausgefüllt und gespeichert");
  pruefe(/ ok/.test(t1.seiten[0].elemente[4].daten.text), `Form auf dem iPad an der angetippten Stelle beschrieben («${t1.seiten[0].elemente[4].daten.text}»)`);
  await foto(s1, "praes-02-ipad-pseudo-vollbild");

  // Sauber aussteigen
  await s1.locator("#p-ende").tap();
  pruefe(!(await praesentiert(s1)) && !(await s1.evaluate(() => document.documentElement.classList.contains("pseudo-vollbild"))), "Beenden: Pseudo-Vollbild und Präsentation aus");
  const kopf = await s1.evaluate(() => getComputedStyle(document.querySelector(".tafel-kopf")).display);
  pruefe(kopf !== "none", "Bedienleisten wieder da");
  pruefe(a.seitenFehler.length === 0, "Keine JavaScript-Fehler" + (a.seitenFehler.length ? ": " + a.seitenFehler.join(" | ") : ""));
  await k1.close();

  console.log("WebKit, iPad Pro 11, mit Fullscreen-API (Safari)");
  const k2 = await browser.newContext({ ...geraet });
  const b = await tafelOeffnen(k2);
  const s2 = b.seite;
  await s2.locator("#praesentieren").tap();
  await s2.waitForFunction(() => document.body.classList.contains("praesentieren"));
  await s2.waitForTimeout(800);
  const zustand = await s2.evaluate(() => ({
    echt: !!(document.fullscreenElement || document.webkitFullscreenElement),
    pseudo: document.documentElement.classList.contains("pseudo-vollbild")
  }));
  pruefe(zustand.echt || zustand.pseudo, `Vollbild beim Präsentieren (echt: ${zustand.echt}, pseudo: ${zustand.pseudo})`);
  // iPad verlaesst das Vollbild z. B. durch Wischen: weiter im Pseudo-Vollbild praesentieren.
  // Headless-WebKit lehnt echtes Vollbild ab; dann das Ereignis nachstellen.
  if (zustand.echt) await s2.evaluate(() => (document.exitFullscreen || document.webkitExitFullscreen).call(document));
  else
    await s2.evaluate(() => {
      document.documentElement.classList.remove("pseudo-vollbild");
      document.dispatchEvent(new Event("webkitfullscreenchange"));
    });
  await s2.waitForTimeout(600);
  pruefe(
    (await praesentiert(s2)) && (await s2.evaluate(() => document.documentElement.classList.contains("pseudo-vollbild"))),
    "Vollbild vom System verlassen: Präsentation läuft im Pseudo-Vollbild weiter" + (zustand.echt ? "" : " (Ereignis nachgestellt)")
  );
  pruefe(b.seitenFehler.length === 0, "Keine JavaScript-Fehler" + (b.seitenFehler.length ? ": " + b.seitenFehler.join(" | ") : ""));
  await browser.close();
}

try {
  await desktop();
  await ipad();
} catch (f) {
  console.error(f);
  fehler++;
} finally {
  server.close();
}

console.log(fehler ? `\n${fehler} Fehler` : "\nAlles in Ordnung");
process.exit(fehler ? 1 : 0);
