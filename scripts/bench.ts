// Latency/cost bench against live SERV. Writes docs/bench/latency.json and regenerates docs/BENCHMARKS.md.
import { writeFileSync, mkdirSync } from "node:fs";
import { servChat, DecisionSchemaJson, buildPrompts, estimateCostUsd, negotiateRound, SEED_SHOPS } from "../packages/core/src/index.ts";
import { renderBenchmarks } from "./render-benchmarks.ts";
import { requireLiveConsent } from "./_budget-guard.mjs";
requireLiveConsent("latency bench (~55 live SERV calls)", 0.2);
if (process.env.OPENSERV_API_KEY === undefined) process.loadEnvFile(".env");
const base = { baseUrl: process.env.SERV_BASE_URL!, apiKey: process.env.OPENSERV_API_KEY!, model: "gpt-5.4-mini" };
const shop = SEED_SHOPS[0]!; const N = 8;
const ctx = { shopName: shop.name, itemName: "Coworking day pass", listCents: 2500, askCents: 2500, offerCents: 2100, round: 1, maxRounds: 3, buyerMessage: "Could you do $21 for one pass?", qty: 1 };
const { system, user } = buildPrompts(shop.policy.public, ctx);
const pct = (a: number[], p: number) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!; };
const variants: [string, any][] = [["guard + schema (baseline)", {}], ["+ multipath", { multipath: true }], ["+ shadow agent", { shadow: true }], ["+ multipath + shadow", { multipath: true, shadow: true }], ["+ kronos + multipath", { kronos: true, multipath: true }]];
const rows: any[] = [];
for (const [name, f] of variants) {
  const lat: number[] = [], tok: number[] = [], cost: number[] = []; let blocked = 0, errs = 0, ok = 0;
  for (let i = 0; i < N; i++) {
    const c = await servChat({ ...base, ...f }, system, user, { name: "decision", schema: DecisionSchemaJson }, "no digits");
    if (c.httpStatus !== 200) { errs++; continue; }
    if (c.blocked) { blocked++; continue; }
    ok++; lat.push(c.latencyMs); tok.push(c.usage.total); cost.push(estimateCostUsd(base.model, c.usage));
    try { JSON.parse(c.content!); } catch { errs++; }
  }
  rows.push({ name: name + (blocked || errs ? ` (blocked ${blocked}, errors ${errs})` : ""), n: ok, p50: ok ? pct(lat, 50) : null, p95: ok ? pct(lat, 95) : null, mean_tokens: ok ? Math.round(tok.reduce((a, b) => a + b) / ok) : null, mean_cost_usd: ok ? (cost.reduce((a, b) => a + b) / ok).toFixed(5) : null });
  console.log(rows.at(-1));
}
// full 3-round negotiation with production config (multipath, guard)
const prod = { ...base, multipath: true }; const negLat: number[] = [], negCost: number[] = [];
for (let k = 0; k < 5; k++) {
  const t0 = Date.now(); let ask = 2500; let cost = 0;
  for (let r = 1; r <= 3; r++) {
    const res = await negotiateRound({ policy: shop.policy, shopName: shop.name, itemId: "day-pass", itemName: "Coworking day pass", listCents: 2500, qty: 1, stock: 40, currentAskCents: ask, offerCents: 2000 + r * 100, round: r, buyerMessage: "Can we meet in the middle?", serv: prod });
    cost += res.serv?.estCostUsd ?? 0; if (res.status === "accepted" || res.status === "rejected") break; ask = res.askCents;
  }
  negLat.push(Date.now() - t0); negCost.push(cost);
}
const out = { generated_at: new Date().toISOString(), variants: rows, production: { name: "gpt-5.4-mini-serv-multipath + prompt guard + schema", neg_n: 5, neg_p50: pct(negLat, 50), neg_p95: pct(negLat, 95), neg_mean_cost_usd: (negCost.reduce((a, b) => a + b) / negCost.length).toFixed(5) } };
mkdirSync("docs/bench", { recursive: true }); writeFileSync("docs/bench/latency.json", JSON.stringify(out, null, 2)); renderBenchmarks(); console.log(out.production);
