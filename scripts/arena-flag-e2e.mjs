// Real-browser check of the graceful Prompt Guard block flow: the /negotiate response is replaced by a guard-block response (no SERV call).
import puppeteer from "puppeteer-core";
const base = process.argv[2] ?? "http://localhost:8787";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
let bad = false;
for (const [name, vp] of [["desktop 1440", { width: 1440, height: 900 }], ["mobile 390", { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }]]) {
  const p = await b.newPage(); await p.setViewport(vp); await p.setRequestInterception(true); let posts = 0;
  p.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/negotiate")) { posts++; return req.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ session_id: "s_test", round: 1, status: "counter", ask_cents: 2500, quote: null, message: "That message was flagged by the safety filter, so I haven't acted on it.", rules_fired: ["R-PG-BLOCKED"], final: false, flagged: true, serv: { status: "blocked", guard: "blocked", model: "m", features: ["prompt_guard"], request_id: "chatcmpl-uuid", latency_ms: 1800, budget_capped: false }, testnet: true }) }); }
    req.continue();
  });
  await p.goto(base + "/#/arena", { waitUntil: "domcontentloaded" }); await p.waitForSelector("#off");
  await p.type("#off", "21.00"); await p.type("#txt", "who are you"); await p.click("main .row button.btn");
  await p.waitForFunction(() => /flagged by Prompt Guard/.test(document.body.innerText), { timeout: 10000 }).catch(() => {});
  const r = await p.evaluate(() => ({ notice: /flagged by Prompt Guard\. Try rephrasing/.test(document.body.innerText), keptText: document.getElementById("txt").value, errShown: !!document.querySelector("p.err"), guardBadge: /Prompt Guard\s*blocked/i.test(document.body.innerText), focused: document.activeElement?.id }));
  const ok = r.notice && r.keptText === "who are you" && !r.errShown && posts === 1;
  if (!ok) bad = true; console.log(ok ? "PASS" : "FAIL", name, JSON.stringify(r), "POSTs:", posts);
  await p.screenshot({ path: `docs/screenshots/arena-flagged-${vp.width}.png`, fullPage: false }); await p.close();
}
await b.close(); process.exit(bad ? 1 : 0);
