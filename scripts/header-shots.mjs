// Header checks + screenshots at 360/768/1024/1440 (menu button only below 901px; full-width sheet when open).
import puppeteer from "puppeteer-core";
const base = process.argv[2] ?? "http://localhost:8787";
const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: true, args: ["--no-sandbox"] });
let bad = false;
for (const w of [360, 768, 1024, 1440]) {
  const p = await b.newPage(); await p.setViewport({ width: w, height: 800, deviceScaleFactor: 1, isMobile: w < 900 });
  await p.goto(base + "/#/home", { waitUntil: "networkidle0" }); await new Promise((r) => setTimeout(r, 700));
  const s = await p.evaluate(() => { const vis = (sel) => { const e = document.querySelector(sel); if (!e) return false; const r = e.getBoundingClientRect(); return getComputedStyle(e).display !== "none" && r.width > 0; };
    return { menuBtn: vis(".hdr .menu-btn"), navLinks: vis(".hdr .nav"), badge: vis(".hdr .badge"), cta: vis(".hdr .cta-pill"), overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, logo: document.querySelector(".hdr .brand img")?.getAttribute("src") }; });
  const desktop = w > 900; const ok = desktop ? (!s.menuBtn && s.navLinks && s.badge && s.cta) : (s.menuBtn && !s.navLinks);
  if (!ok || s.overflow > 1) bad = true;
  console.log(`${ok && s.overflow <= 1 ? "PASS" : "FAIL"} ${w}px:`, JSON.stringify(s));
  await p.screenshot({ path: `docs/screenshots/header-${w}.png`, clip: { x: 0, y: 0, width: w, height: 140 } });
  if (!desktop) {
    await p.click(".hdr .menu-btn"); await new Promise((r) => setTimeout(r, 500));
    const sheet = await p.evaluate(() => { const e = document.querySelector(".sheet-menu"); const r = e?.getBoundingClientRect(); return e ? { w: Math.round(r.width), h: Math.round(r.height), links: e.querySelectorAll("nav a").length } : null; });
    const full = sheet && sheet.w === w; if (!full) bad = true; console.log(`${full ? "PASS" : "FAIL"} ${w}px sheet:`, JSON.stringify(sheet));
    await p.screenshot({ path: `docs/screenshots/menu-sheet-${w}.png` });
    await p.keyboard.press("Escape"); await new Promise((r) => setTimeout(r, 300));
    const closed = await p.evaluate(() => !document.querySelector(".sheet-menu")); if (!closed) bad = true; console.log(closed ? "PASS" : "FAIL", `${w}px Escape closes the sheet`);
  }
  await p.close();
}
await b.close(); process.exit(bad ? 1 : 0);
