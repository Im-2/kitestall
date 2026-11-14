// Phase 0 smoke test (d): facilitator discovery + supported networks/assets.
const BASE = process.env.KITE_FACILITATOR_URL || "https://facilitator.pieverse.io";
for (const p of ["/", "/v2/supported"]) {
  const r = await fetch(BASE + p);
  console.log("GET", p, "->", r.status);
  console.log((await r.text()).slice(0, 4000));
}
