// Real-browser test of the Arena send flow at desktop and mobile width. Usage: node scripts/arena-e2e.mjs [baseUrl] [--slow-catalog]
// WARNING: against a live-SERV server each send is one live SERV round. Use a SERV_MODE=fallback_only server for free runs.
import puppeteer from "puppeteer-core";
const base = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "http://localhost:8787";
const slow = process.argv.includes("--slow-catalog");
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let failed = false;
for (const [name, vp] of [["desktop 1440", { width: 1440, height: 900 }], ["mobile 390", { width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 }]]) {
  const p = await b.newPage(); await p.setViewport(vp);
  const log = { negotiate: [], sse: 0, errors: [] };
  await p.setRequestInterception(true);
  p.on("request", async (req) => { if (slow && /\/catalog$/.test(req.url())) await sleep(4000); req.continue(); });
  p.on("response", async (res) => { const u = res.url(); if (u.includes("/negotiate")) log.negotiate.push(res.status()); if (u.includes("/api/trace/")) log.sse++; });
  p.on("pageerror", (e) => log.errors.push(e.message)); p.on("console", (m) => m.type() === "error" && !/Failed to load resource/.test(m.text()) && log.errors.push(m.text()));
  const before = (await (await fetch(base + "/api/stats")).json()).rounds;
  await p.goto(base + "/#/arena", { waitUntil: "domcontentloaded" });
  await p.waitForSelector("#off"); await p.type("#off", "21.00"); await p.type("#txt", "Hi, could you do twenty-one dollars?");
  const disabledAtClick = await p.$eval("main .row button.btn", (el) => el.disabled);
  const labelAtClick = await p.$eval("main .row button.btn", (el) => el.textContent);
  await p.click("main .row button.btn");
  const t0 = Date.now(); let decided = false;
  try { await p.waitForFunction(() => /Decided by/.test(document.body.innerText), { timeout: slow ? 20000 : 15000 }); decided = true; } catch { /* handled below */ }
  const text = await p.evaluate(() => document.body.innerText);
  const after = (await (await fetch(base + "/api/stats")).json()).rounds;
  const ev = await p.evaluate(() => [...document.querySelectorAll("summary")].map((s) => s.textContent).join(" "));
  const ok = decided && after === before + 1 && log.negotiate.includes(200);
  console.log(`${ok ? "PASS" : "FAIL"} ${name}: button disabled at click=${disabledAtClick} label="${labelAtClick}" | POST /negotiate statuses=${JSON.stringify(log.negotiate)} | rounds ${before}->${after} | trace stream requests=${log.sse} (${ev.trim()}) | decided in ${Date.now() - t0} ms | page errors: ${log.errors.length ? log.errors.join(" / ") : "none"}`);
  console.log("   decision text:", (text.match(/Decided by\s*([^\n]+)/) ?? [])[1], "| shop reply:", (text.match(/My ask is \$[0-9.]+/) ?? [""])[0]);
  if (!ok) failed = true;
  await p.close();
}
await b.close(); process.exit(failed ? 1 : 0);
