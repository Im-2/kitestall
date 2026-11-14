// Phase 0 smoke test (c): unpaid call to Kite x402 weather sample -> 402 JSON.
const URL_ = process.env.KITE_SAMPLE_URL || "https://x402.dev.gokite.ai/api/weather";
const r = await fetch(URL_);
const text = await r.text();
console.log("GET", URL_, "->", r.status);
console.log(text);
if (r.status !== 402) { console.error("Expected 402"); process.exit(1); }
