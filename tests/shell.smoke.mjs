/*
 * Shell-Smoke (Kochfreunde) — echter Browser (Chromium), headless.
 * Prüft die VERDRAHTUNG der Hülle mit comm-core im Browser:
 *   - die Tarn-App (Rezepte) rendert,
 *   - Ersteinrichtung (enroll) legt den versteckten Bereich an,
 *   - Losungswort über den "Frag den Chefkoch"-Pfad öffnet ihn still,
 *   - der versteckte Bereich zeigt den eigenen Schlüssel,
 *   - die Ablage in localStorage ist ein namenloser Chiffrat-Klumpen.
 * NICHT geprüft (ehrlich): echte öffentliche Relais (Netz), zweites Gerät,
 * Live-Mikrofon — das ist Klaus' Browser-Sichttest am Ende von Stufe A.
 *
 * Lauf: node tests/shell.smoke.mjs
 */
import { chromium } from "playwright-core";
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const EXE = "/opt/pw-browsers/chromium-1194/chrome-linux/chrome";
const PORT = 8391;
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.error("  ✗ " + m); } };

const srv = spawn("python3", ["-m", "http.server", String(PORT)], { cwd: ROOT, stdio: "ignore" });
await new Promise(r => setTimeout(r, 700));

let browser;
try {
  browser = await chromium.launch({ executablePath: EXE, args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: "networkidle" });

  // 1. Tarn-App rendert
  ok((await page.title()).includes("Kochfreunde"), "Titel Kochfreunde");
  await page.waitForSelector(".card", { timeout: 5000 });
  ok((await page.$$(".card")).length >= 3, "Rezept-Karten sichtbar (echte Tarnung)");
  ok(await page.$("#chefInput"), "„Frag den Chefkoch“-Feld vorhanden");
  ok(!(await page.isVisible("#priv")), "versteckter Bereich anfangs unsichtbar");

  // 2. Ersteinrichtung (enroll) über die Debug-Brücke (steht für die Lang-Druck-Geste)
  const phrase = "wie macht man omas gulasch";
  const en = await page.evaluate(async p => await window.__kf.CommCore.enroll.fromSpokenPhrase(p), phrase);
  ok(en.ok && en.created && /^[0-9a-f]{64}$/.test(en.pub), "enroll legt versteckten Bereich an");

  // Ablage ist ein namenloser Chiffrat-Klumpen (existenz-unsichtbar)
  const rawStore = await page.evaluate(() => localStorage.getItem("kf_state_v1"));
  ok(rawStore && !/jason|sbkim|tresor|priv|pub|AES|PBKDF2/i.test(rawStore), "localStorage-Ablage trägt keine Krypto-/Identitäts-Etiketten");

  // sperren, dann Losungswort über den echten Chef-Pfad → öffnet still
  await page.evaluate(() => window.__kf.CommCore.unlock.lock());
  await page.fill("#chefInput", phrase);
  await page.evaluate(p => window.__kf.handleChef(p), phrase);
  await page.waitForSelector("#priv.show", { timeout: 4000 });
  ok(await page.isVisible("#priv"), "richtiges Losungswort öffnet den versteckten Bereich");

  // 3. versteckter Bereich zeigt den eigenen Schlüssel
  await page.waitForSelector("#myKey", { timeout: 3000 });
  const key = (await page.textContent("#myKey")).trim();
  ok(/^[0-9a-f]{64}$/.test(key), "eigener Schlüssel wird angezeigt");

  // falsches Wort öffnet NICHT (nach lock)
  await page.evaluate(() => { window.__kf.CommCore.unlock.lock(); document.querySelector("#priv").classList.remove("show"); });
  await page.evaluate(() => window.__kf.handleChef("irgendein rezept mit kartoffeln"));
  await page.waitForTimeout(300);
  ok(!(await page.isVisible("#priv")), "harmlose Frage öffnet NICHTS (bleibt Rezept-App)");

  ok(errors.length === 0, "keine JS-Fehler im Browser (" + errors.join(" | ") + ")");
} catch (e) {
  fail++; console.error(e);
} finally {
  if (browser) await browser.close();
  srv.kill();
}
console.log(`\nShell-Smoke (Kochfreunde): ${pass} grün, ${fail} rot`);
process.exit(fail ? 1 : 0);
