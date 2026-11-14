// Extra screenshots: unlocked owner dashboard and a verified receipt (desktop + mobile).
import puppeteer from "puppeteer-core";
import { loadEnv } from "./_env.mjs"; loadEnv();
const base = process.argv[2] ?? "http://localhost:8787";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
const rid = (await (await fetch(base + "/api/public/activity")).json()).sales[0]?.receipt_id;
for (const [n, vp] of [["desktop", { width: 1440, height: 900 }], ["mobile", { width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 }]]) {
  const p = await b.newPage(); await p.setViewport(vp);
  await p.goto(base + "/#/home", { waitUntil: "networkidle0" });
  await p.evaluate((t) => sessionStorage.setItem("kitestall_owner_token", t), process.env.OWNER_TOKEN);
  await p.goto(base + "/#/owner", { waitUntil: "networkidle0" }); await new Promise((r) => setTimeout(r, 1800));
  await p.screenshot({ path: `docs/screenshots/owner-unlocked-${n}.png`, fullPage: true });
  await p.goto(base + `/#/verify?id=${rid}`, { waitUntil: "networkidle0" }); await new Promise((r) => setTimeout(r, 2500));
  await p.screenshot({ path: `docs/screenshots/verify-result-${n}.png`, fullPage: true });
  await p.close();
}
await b.close(); console.log("ok");
