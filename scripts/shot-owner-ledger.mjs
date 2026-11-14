// Screenshot of the owner sales ledger (incl. collected firm-quote fees) from a running server. Usage: node scripts/shot-owner-ledger.mjs [baseUrl]
import puppeteer from "puppeteer-core";
import { loadEnv } from "./_env.mjs";
loadEnv();
const base = process.argv[2] ?? "http://localhost:8787";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const p = await b.newPage();
await p.setViewport({ width: 1440, height: 900 });
await p.goto(base + "/#/home", { waitUntil: "networkidle0" });
await p.evaluate((t) => sessionStorage.setItem("kitestall_owner_token", t), process.env.OWNER_TOKEN);
await p.goto(base + "/#/owner", { waitUntil: "networkidle0" });
await p.waitForFunction(() => /Fees collected on-chain/.test(document.body.innerText), { timeout: 15000 }).catch(() => {});
const t = await p.evaluate(() => document.body.innerText);
console.log((t.match(/Fees collected on-chain[^\n]*/) ?? ["MISSING"])[0], "| firm quote row:", /fq_/.test(t));
for (const e of await p.$$("section.card")) {
  const h = await e.evaluate((x) => x.innerText.slice(0, 20));
  if (/Sales ledger/.test(h)) { await e.screenshot({ path: "docs/screenshots/owner-firm-quote-ledger.png" }); break; }
}
await b.close();
