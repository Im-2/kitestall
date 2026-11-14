// Browser click-through of every page against a running server (real Chrome via puppeteer-core). Prints PASS/FAIL per step; never prints secrets.
import puppeteer from "puppeteer-core";
import { loadEnv } from "./_env.mjs"; loadEnv();
const base = process.argv[2] ?? "http://localhost:8787";
const b = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage(); await p.setViewport({ width: 1280, height: 900 });
const errs = []; p.on("pageerror", (e) => errs.push(e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && errs.push(m.text()));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const res = []; const ok = (n, c, d = "") => { res.push(c); console.log(c ? "PASS" : "FAIL", n, d); };
const text = () => p.evaluate(() => document.body.innerText);
await p.goto(base + "/#/home", { waitUntil: "networkidle0" }); await sleep(800);
let t = await text(); ok("landing hero + live stats", /Storefronts that/.test(t) && /Settled sales/.test(t));
ok("landing real numbers (no placeholders)", /Average\s*discount/i.test(t) && !/Up to 45/.test(t));
await p.click('a[href="#/arena"]'); await sleep(900); t = await text(); ok("nav to Arena", /The Arena/.test(t));
await p.type("#off", "18.00"); await p.type("#txt", "Hi, could you do eighteen dollars?"); await p.click("button.btn.primary, .row button.btn");
await p.waitForFunction(() => /Round/.test(document.body.innerText) && /Decided by/.test(document.body.innerText), { timeout: 60000 }).catch(() => {});
t = await text(); ok("Arena haggle returns a decision + trace", /Decided by/.test(t) && /Rules fired/.test(t), (t.match(/Decided by\s*([^\n]+)/) ?? [])[1] ?? "");
await p.goto(base + "/#/verify", { waitUntil: "networkidle0" }); await sleep(500);
const rid = await (await fetch(base + "/api/public/activity")).json().then((j) => j.sales[0]?.receipt_id);
if (rid) { await p.type("#rid", rid); await p.click(".btn.primary"); await p.waitForFunction(() => /all checks pass|failed/i.test(document.body.innerText), { timeout: 30000 }).catch(() => {}); t = await text(); ok("Verify shows checks", /all checks pass/i.test(t) && (t.match(/✓/g) ?? []).length >= 6, `${(t.match(/✓/g) ?? []).length} ticks`); } else ok("Verify (no sales to verify)", false);
await p.goto(base + "/#/owner", { waitUntil: "networkidle0" }); await sleep(500);
const tok = process.env.OWNER_TOKEN; await p.type("#tok", tok); await sleep(1500); t = await text();
ok("Owner dashboard unlocks with token", /Sales ledger/.test(t) && /ACCRUED|accrued/.test(t));
ok("Owner ledger lists sales with tx links", await p.evaluate(() => !!document.querySelector('a[href*="kitescan"]')));
await p.goto(base + "/#/watch", { waitUntil: "networkidle0" }); await sleep(500); t = await text(); ok("Watch page loads with dev-signer disclosure", /dev signer/.test(t) && /simulated/i.test(t));
if (process.argv.includes("--run-watch")) {
  await p.select("#sc", "plain"); await p.click("main button.btn.primary, main button.btn"); await p.waitForFunction(() => /Completed|Ended:/.test(document.body.innerText), { timeout: 150000 }).catch(() => {});
  t = await text(); ok("Watch demo shopper completes", /Completed/.test(t), /Ended:[^\n]*/.exec(t)?.[0] ?? "");
}
ok("no page errors", errs.length === 0, errs.slice(0, 3).join(" | "));
await b.close(); console.log(res.every(Boolean) ? "ALL PASS" : "SOME FAILED"); process.exit(res.every(Boolean) ? 0 : 1);
