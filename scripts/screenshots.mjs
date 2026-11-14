// Dev tool: captures desktop + mobile screenshots of every page with a local Chrome. Usage: node scripts/screenshots.mjs [baseUrl]
import puppeteer from "puppeteer-core";
const base = process.argv[2] ?? "http://localhost:8787";
const chrome = process.env.CHROME_PATH ?? "C:/Program Files/Google/Chrome/Application/chrome.exe";
const browser = await puppeteer.launch({ executablePath: chrome, headless: true, args: ["--no-sandbox"] });
const sizes = { desktop: { width: 1440, height: 900, deviceScaleFactor: 1 }, mobile: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true } };
const pages = { landing: "#/home", arena: "#/arena", watch: "#/watch", owner: "#/owner", verify: "#/verify" };
const errors = [];
for (const [sname, vp] of Object.entries(sizes)) {
  const page = await browser.newPage(); await page.setViewport(vp);
  page.on("pageerror", (e) => errors.push(`${sname}: ${e.message}`)); page.on("console", (m) => m.type() === "error" && errors.push(`${sname} console: ${m.text()}`));
  for (const [pname, hash] of Object.entries(pages)) {
    await page.goto(base + "/" + hash, { waitUntil: "networkidle0" });
    await new Promise((r) => setTimeout(r, 1200));
    const h = await page.evaluate(() => document.documentElement.scrollHeight);
    for (let y = 0; y < h; y += 500) { await page.evaluate((yy) => window.scrollTo(0, yy), y); await new Promise((r) => setTimeout(r, 220)); }
    await page.evaluate(() => window.scrollTo(0, 0)); await new Promise((r) => setTimeout(r, 600));
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    if (overflow > 1) errors.push(`${sname}/${pname}: horizontal overflow ${overflow}px`);
    await page.screenshot({ path: `docs/screenshots/${pname}-${sname}.png`, fullPage: true });
    console.log("shot", pname, sname, "height", h, "overflow", overflow);
  }
  await page.close();
}
await browser.close();
console.log(errors.length ? "ISSUES:\n" + errors.join("\n") : "no console errors, no horizontal overflow");
