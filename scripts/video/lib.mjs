// Shared helpers for recording scripted browser scenes: visible smooth cursor, deliberate scrolling and typing.
import puppeteer from "puppeteer-core";
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const CHROME = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
export async function launch() {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ["--no-sandbox", "--hide-scrollbars", "--force-device-scale-factor=1", "--window-size=1920,1080"], defaultViewport: { width: 1920, height: 1080, deviceScaleFactor: 1 } });
  const page = await browser.newPage(); await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  return { browser, page };
}
const CURSOR = `(() => { if (window.__kc) return; const c = document.createElement("div"); c.id = "kcursor";
  c.style.cssText = "position:fixed;left:0;top:0;width:34px;height:34px;z-index:2147483647;pointer-events:none;transform:translate(-100px,-100px);filter:drop-shadow(0 3px 5px rgba(0,0,0,.45))";
  c.innerHTML = '<svg viewBox="0 0 24 24" width="34" height="34"><path d="M3 2l17 8.2-7.4 2.1L9.8 20z" fill="#fff" stroke="#0B0B0C" stroke-width="1.6" stroke-linejoin="round"/></svg>';
  const r = document.createElement("div"); r.id = "kripple"; r.style.cssText = "position:fixed;width:46px;height:46px;border-radius:50%;border:3px solid #FF4A1C;z-index:2147483646;pointer-events:none;opacity:0;transform:translate(-100px,-100px)";
  const hb = document.createElement("div"); hb.style.cssText = "position:fixed;right:0;bottom:0;width:3px;height:3px;z-index:2147483645;pointer-events:none;animation:khb .033s steps(1) infinite"; const st = document.createElement("style"); st.textContent = "@keyframes khb{0%{background:#e9eaee}50%{background:#e9eaed}}"; document.documentElement.append(st, hb); // heartbeat: keeps the screencast emitting frames so idle time is not dropped
  document.documentElement.append(c, r); window.__kc = { x: -100, y: -100 };
  window.__kmove = (x, y) => { window.__kc = { x, y }; c.style.transform = "translate(" + x + "px," + y + "px)"; };
  window.__kclick = (x, y) => { r.style.transition = "none"; r.style.opacity = "1"; r.style.transform = "translate(" + (x - 15) + "px," + (y - 15) + "px) scale(.4)"; requestAnimationFrame(() => { r.style.transition = "all .45s ease-out"; r.style.opacity = "0"; r.style.transform = "translate(" + (x - 15) + "px," + (y - 15) + "px) scale(1.4)"; }); };
})();`;
export async function prepare(page) { await page.evaluateOnNewDocument(CURSOR); }
export async function ensureCursor(page) { await page.evaluate(CURSOR); }
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
let pos = { x: 960, y: 540 };
/** Smooth, eased cursor movement over `ms` milliseconds. */
export async function moveTo(page, x, y, ms = 900) {
  const from = { ...pos }, steps = Math.max(12, Math.round(ms / 16));
  for (let i = 1; i <= steps; i++) { const t = ease(i / steps); const px = from.x + (x - from.x) * t, py = from.y + (y - from.y) * t; await page.mouse.move(px, py); await page.evaluate((a, b) => window.__kmove?.(a, b), px, py); await sleep(ms / steps); }
  pos = { x, y };
}
export async function center(page, selector) {
  const h = await page.waitForSelector(selector, { visible: true, timeout: 30000 }); await h.evaluate((e) => e.scrollIntoView({ block: "center", behavior: "instant" })); await sleep(150);
  const b = await h.boundingBox(); return { x: b.x + b.width / 2, y: b.y + Math.min(b.height / 2, 24), el: h, box: b };
}
export async function clickEl(page, selector, ms = 900) {
  const { x, y, el } = await center(page, selector); await moveTo(page, x, y, ms); await page.evaluate((a, b) => window.__kclick?.(a, b), x, y); await sleep(120); await el.click(); return el;
}
export async function typeInto(page, selector, text, perChar = 70) { await clickEl(page, selector, 700); await page.keyboard.down("Control"); await page.keyboard.press("KeyA"); await page.keyboard.up("Control"); await page.keyboard.press("Backspace"); for (const ch of text) { await page.keyboard.type(ch); await sleep(perChar + Math.random() * 40); } }
/** Smooth deliberate scroll by dy pixels over ms milliseconds. */
export async function scrollBy(page, dy, ms = 2500) {
  const steps = Math.round(ms / 16); let done = 0;
  for (let i = 1; i <= steps; i++) { const target = dy * ease(i / steps); await page.evaluate((d) => window.scrollBy(0, d), target - done); done = target; await sleep(ms / steps); }
}
export async function waitText(page, re, timeout = 90000) { await page.waitForFunction((s) => new RegExp(s, "i").test(document.body.innerText), { timeout }, re.source ?? re); }
