// Generates the social/OG image (1200x630) from the Kitestall mark. Output: apps/web/public/og-image.png
import puppeteer from "puppeteer-core";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
const pub = resolve("apps/web/public");
const mark = "data:image/svg+xml;base64," + readFileSync(resolve(pub, "kitestall-mark.svg")).toString("base64");
const font = "data:font/woff2;base64," + readFileSync(resolve(pub, "fonts/outfit.woff2")).toString("base64");
const html = `<!doctype html><meta charset="utf-8"><style>
@font-face{font-family:Outfit;src:url(${font}) format("woff2");font-weight:100 900}
*{box-sizing:border-box}body{margin:0;width:1200px;height:630px;background:#E9EAEE;font-family:Outfit,sans-serif;color:#0B0B0C;display:flex;align-items:center;justify-content:center}
.card{width:1104px;height:534px;background:#fff;border-radius:44px;box-shadow:0 30px 80px rgba(15,15,25,.14);padding:56px 64px;display:flex;flex-direction:column;justify-content:space-between;position:relative;overflow:hidden}
.top{display:flex;align-items:center;gap:20px;font-size:40px;font-weight:500;letter-spacing:-.03em}.top img{width:76px;height:76px;border-radius:20px}
.badge{margin-left:auto;border:3px solid #C2310E;color:#C2310E;font:600 22px "IBM Plex Mono",monospace;letter-spacing:.08em;padding:4px 16px;border-radius:99px}
h1{position:relative;z-index:2;font-size:92px;font-weight:300;letter-spacing:-.045em;line-height:1.0;margin:0}h1 em{font-style:normal;color:#767982}.pill{background:#FFC62B;border-radius:99px;padding:0 .28em}
.foot{display:flex;gap:14px;font-size:28px;color:#5A5D66;font-weight:300;align-items:center}.dot{width:10px;height:10px;border-radius:50%;background:#D23A0A}
.corner{position:absolute;right:-40px;bottom:-70px;width:190px;height:190px;z-index:0;border-radius:50%;background:#D23A0A;opacity:.95}
</style><div class="card"><div class="top"><img src="${mark}">Kitestall<span class="badge">KITE TESTNET</span></div>
<h1>A storefront agent that <em>haggles</em> within your <span class="pill">rules</span></h1>
<div class="foot"><span>SERV Reasoning</span><span class="dot"></span><span>x402 on Kite</span><span class="dot"></span><span>Signed receipts</span></div><div class="corner"></div></div>`;
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox", "--allow-file-access-from-files"] });
const p = await b.newPage(); await p.setViewport({ width: 1200, height: 630 });
await p.setContent(html, { waitUntil: "networkidle0" }); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: resolve(pub, "og-image.png") }); await b.close(); console.log("og-image.png written");
