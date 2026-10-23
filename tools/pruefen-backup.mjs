#!/usr/bin/env node
/*
 * Prueft das Backup im Browser (Playwright):
 * Chromium sichert in einen gewaehlten Ordner (im Test der private Browser-Ordner
 * statt OneDrive), ein zweites Geraet laedt das Backup, Aenderungen kommen zurueck,
 * nichts wird doppelt oder durch Aelteres ersetzt. WebKit als iPad sichert ueber
 * den Teilen-Dialog.
 *
 * Aufruf: node tools/pruefen-backup.mjs
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { chromium, webkit, devices } from "playwright";
import { serverStarten } from "./server.mjs";

const server = await serverStarten(0);
const BASIS = `http://localhost:${server.address().port}/`;
const TEMP = fs.mkdtempSync(path.join(os.tmpdir(), "wandtafel-backup-"));
const DATEI = "Wandtafel-Backup.wandtafel.json";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==", "base64");

let fehler = 0;
function pruefe(bedingung, text) {
  console.log((bedingung ? "  ok      " : "  FEHLER  ") + text);
  if (!bedingung) fehler++;
}

function tafel(id, titel, geaendert, elemente) {
  return { id, version: 1, titel, erstellt: geaendert, geaendert, seiten: [{ id: "s-" + id, titel: "", hintergrund: "weiss", striche: [], elemente: elemente || [] }] };
}

const SAMMLUNG = {
  version: 1,
  faecher: [
    {
      id: "f-mi",
      name: "Medien und Informatik",
      farbe: "#065a82",
      jahre: [{ id: "j-3", name: "3. Sek" }],
      kapitel: [{ id: "k-algo", name: "Algorithmen", jahr: "j-3", tafeln: ["t-eins", "t-zwei"] }]
    }
  ]
};

/** Legt Fach, zwei Tafeln und ein Bild an (ohne Bild: Blobs in IndexedDB gehen im Test-WebKit nicht) */
async function anlegen(seite, mitBild) {
  await seite.evaluate(
    async ([sammlung, t1, t2, png]) => {
      const S = window.Wandtafel.Speicher;
      if (png) {
        const blob = await (await fetch("data:image/png;base64," + png)).blob();
        await S.mediumMitIdSpeichern("m-bild", blob, "punkt.png");
      }
      await S.tafelSpeichern(t1);
      await S.tafelSpeichern(t2);
      await S.sammlungSpeichern(sammlung);
    },
    [
      SAMMLUNG,
      tafel("t-eins", "Sortieren", 1000, mitBild ? [{ id: "e-bild", typ: "bild", x: 40, y: 40, b: 200, h: 200, z: 1, daten: { medium: "m-bild" } }] : []),
      tafel("t-zwei", "Suchen", 1000),
      mitBild ? PNG.toString("base64") : null
    ]
  );
  await seite.reload();
  await seite.waitForSelector(".fach-eintrag:has-text('Medien und Informatik')");
}

async function startseite(kontext) {
  const seite = await kontext.newPage();
  const seitenFehler = [];
  seite.on("pageerror", (f) => seitenFehler.push(f.message));
  await seite.goto(BASIS);
  await seite.waitForFunction(() => window.Wandtafel && window.Wandtafel.Backup);
  return { seite, seitenFehler };
}

async function backupMenue(seite, punkt) {
  await seite.click("#sichern");
  await seite.locator(".klappmenue button", { hasText: punkt }).click();
}

async function laden(seite) {
  const d = seite.locator("dialog[open]");
  await d.waitFor();
  const text = await d.textContent();
  await d.locator('button:has-text("Laden")').click();
  await d.waitFor({ state: "detached" });
  return text;
}

const meldung = (seite, text) => seite.waitForSelector(`#meldung:has-text("${text}")`);
const tafelnLesen = (seite) =>
  seite.evaluate(async () => {
    const S = window.Wandtafel.Speicher;
    const s = await S.sammlung();
    const alle = await S.alleTafeln();
    return { ids: s.faecher.flatMap((f) => f.kapitel.flatMap((k) => k.tafeln)), titel: Object.fromEntries(alle.map((t) => [t.id, t.titel])), faecher: s.faecher.length };
  });

try {
  // ---------- Chromium: Computer mit OneDrive-Ordner ----------
  console.log("Chromium: Backup in einen Ordner");
  const browser = await chromium.launch(process.env.CHROMIUM_PFAD ? { executablePath: process.env.CHROMIUM_PFAD } : {});
  const computer = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  // Statt des Ordnerdialogs den privaten Ordner des Browsers liefern
  await computer.addInitScript(() => {
    window.showDirectoryPicker = () => navigator.storage.getDirectory();
  });
  const { seite: a, seitenFehler: fehlerA } = await startseite(computer);
  await anlegen(a, true);

  await backupMenue(a, "In OneDrive sichern");
  await meldung(a, "Backup in");
  const ausOrdner = () => a.evaluate(async (name) => (await (await (await navigator.storage.getDirectory()).getFileHandle(name)).getFile()).text(), DATEI);
  let paket = JSON.parse(await ausOrdner());
  pruefe(paket.sicherung === true && paket.tafeln.length === 2 && paket.medien["m-bild"], "Backup im Ordner: 2 Tafeln mit Bild");
  pruefe((await a.textContent("#speicher-info")).includes("Letztes Backup"), "Startseite zeigt das letzte Backup");

  const dl = a.waitForEvent("download");
  await backupMenue(a, "Backup als Datei herunterladen");
  const download = await dl;
  pruefe(download.suggestedFilename() === DATEI, "Download heisst " + DATEI);
  const backupA = path.join(TEMP, "a.json");
  await download.saveAs(backupA);

  // ---------- Zweites Geraet ----------
  console.log("Chromium: zweites Gerät lädt das Backup");
  const zweites = await browser.newContext({ viewport: { width: 1400, height: 860 } });
  const { seite: b, seitenFehler: fehlerB } = await startseite(zweites);
  await b.setInputFiles("#import-datei", backupA);
  const frage = await laden(b);
  pruefe(frage.includes("2 Tafeln") && frage.includes("nichts gelöscht"), "Rückfrage nennt Tafeln und dass nichts gelöscht wird");
  await meldung(b, "2 neue Tafeln");
  let stand = await tafelnLesen(b);
  pruefe(stand.faecher === 1 && stand.ids.join() === "t-eins,t-zwei", "Gleiches Fach und gleiche Tafeln (gleiche IDs)");
  const jahr = await b.evaluate(async () => (await window.Wandtafel.Speicher.sammlung()).faecher[0].jahre[0].name);
  pruefe(jahr === "3. Sek", "Jahr übernommen");
  pruefe(await b.evaluate(async () => !!(await window.Wandtafel.Speicher.medium("m-bild"))), "Bild übernommen");

  // Auf dem zweiten Geraet aendern und sichern
  await b.evaluate(async () => {
    const S = window.Wandtafel.Speicher;
    const t = await S.tafel("t-eins");
    t.titel = "Sortieren (überarbeitet)";
    t.geaendert = 5000;
    await S.tafelSpeichern(t);
  });
  const dlB = b.waitForEvent("download");
  await backupMenue(b, "Backup als Datei herunterladen");
  const backupB = path.join(TEMP, "b.json");
  await (await dlB).saveAs(backupB);

  // ---------- Zurueck am Computer: aus dem Ordner laden ----------
  console.log("Chromium: Änderungen zurückholen");
  // Auf dem Computer ist «Suchen» inzwischen neuer als im Backup
  await a.evaluate(async () => {
    const S = window.Wandtafel.Speicher;
    const t = await S.tafel("t-zwei");
    t.titel = "Suchen (neu am Computer)";
    t.geaendert = 9000;
    await S.tafelSpeichern(t);
  });
  // OneDrive hat das Backup vom zweiten Geraet in den Ordner gelegt
  await a.evaluate(
    async ([name, text]) => {
      const f = await (await navigator.storage.getDirectory()).getFileHandle(name, { create: true });
      const w = await f.createWritable();
      await w.write(text);
      await w.close();
    },
    [DATEI, fs.readFileSync(backupB, "utf8")]
  );
  await backupMenue(a, "Backup laden");
  await laden(a);
  await meldung(a, "1 aktualisiert");
  stand = await tafelnLesen(a);
  pruefe(stand.titel["t-eins"] === "Sortieren (überarbeitet)", "Neuere Fassung vom zweiten Gerät übernommen");
  pruefe(stand.titel["t-zwei"] === "Suchen (neu am Computer)", "Neuere Fassung am Computer bleibt");
  pruefe(stand.ids.join() === "t-eins,t-zwei", "Keine doppelten Tafeln");

  await backupMenue(a, "Backup laden");
  await laden(a);
  await meldung(a, "alles war schon aktuell");
  stand = await tafelnLesen(a);
  pruefe(stand.ids.length === 2, "Zweites Laden ändert nichts");

  // Altes Backup laedt eine geloeschte Tafel wieder, loescht aber nichts
  await a.evaluate(async () => {
    const S = window.Wandtafel.Speicher;
    const s = await S.sammlung();
    s.faecher[0].kapitel[0].tafeln = ["t-eins"];
    await S.sammlungSpeichern(s);
    await S.tafelLoeschen("t-zwei");
  });
  await a.setInputFiles("#import-datei", backupA);
  await laden(a);
  await meldung(a, "1 neue Tafel");
  stand = await tafelnLesen(a);
  pruefe(stand.ids.join() === "t-eins,t-zwei" && stand.titel["t-eins"] === "Sortieren (überarbeitet)", "Gelöschte Tafel zurück, neuere bleibt");

  pruefe(fehlerA.length === 0 && fehlerB.length === 0, "Keine Fehler auf der Seite" + (fehlerA.concat(fehlerB).length ? ": " + fehlerA.concat(fehlerB).join(" | ") : ""));
  await browser.close();

  // ---------- WebKit als iPad: Teilen-Dialog ----------
  console.log("WebKit (iPad): Backup über den Teilen-Dialog");
  const wk = await webkit.launch();
  const ipad = await wk.newContext({ ...devices["iPad Pro 11"] });
  await ipad.addInitScript(() => {
    navigator.canShare = () => true;
    navigator.share = async (d) => {
      window.geteilt = { name: d.files[0].name, text: await d.files[0].text() };
    };
  });
  const { seite: i, seitenFehler: fehlerI } = await startseite(ipad);
  await anlegen(i);
  await backupMenue(i, "In OneDrive sichern");
  const bereit = i.locator("dialog[open]");
  await bereit.waitFor();
  pruefe((await bereit.textContent()).includes("In Dateien sichern"), "Hinweis: «In Dateien sichern» > OneDrive");
  await bereit.locator('button:has-text("Weiter")').click();
  await meldung(i, "Backup gesichert");
  const geteilt = await i.evaluate(() => window.geteilt);
  pruefe(geteilt && geteilt.name === DATEI && JSON.parse(geteilt.text).tafeln.length === 2, "Backup-Datei an den Teilen-Dialog übergeben");

  // Auf dem iPad das Backup vom zweiten Geraet laden (Datei aus OneDrive waehlen)
  // (ohne Bild, siehe anlegen)
  const ohneBild = JSON.parse(fs.readFileSync(backupB, "utf8"));
  ohneBild.medien = {};
  ohneBild.tafeln.forEach((t) => t.seiten.forEach((sz) => (sz.elemente = [])));
  const backupI = path.join(TEMP, "i.json");
  fs.writeFileSync(backupI, JSON.stringify(ohneBild));
  await backupMenue(i, "Backup laden");
  await i.setInputFiles("#import-datei", backupI);
  await laden(i);
  await meldung(i, "1 aktualisiert");
  stand = await tafelnLesen(i);
  pruefe(stand.titel["t-eins"] === "Sortieren (überarbeitet)" && stand.ids.length === 2, "iPad lädt das Backup ohne doppelte Tafeln");
  pruefe(fehlerI.length === 0, "Keine Fehler auf der Seite" + (fehlerI.length ? ": " + fehlerI.join(" | ") : ""));
  await wk.close();
} catch (f) {
  console.error(f);
  fehler++;
} finally {
  server.close();
  fs.rmSync(TEMP, { recursive: true, force: true });
}

console.log(fehler ? `\n${fehler} Fehler` : "\nAlles in Ordnung");
process.exit(fehler ? 1 : 0);
