// One live SERV call with Shadow Agent on an accept-candidate round (offer within 5% of the ask), to confirm guard + schema + multipath + shadow work together.
// Est. cost: 1 call x ~$0.003 x2 (shadow) ~ $0.01. Usage: tsx scripts/shadow-check.ts --allow-live-serv
import { negotiateRound, withFinalRule, SEED_SHOPS } from "../packages/core/src/index.ts";
import { requireLiveConsent } from "./_budget-guard.mjs";
requireLiveConsent("Shadow Agent check (1 live call, shadow on)", 0.01);
if (process.env.OPENSERV_API_KEY === undefined) process.loadEnvFile(".env");
const s = SEED_SHOPS[0]!; const t0 = Date.now();
const r = await negotiateRound({ policy: { ...s.policy, public: withFinalRule(s.policy.public) }, shopName: s.name, itemId: "day-pass", itemName: "Coworking day pass", listCents: 2500, qty: 1, stock: 9, currentAskCents: 2450, offerCents: 2400, round: 2, buyerMessage: "Could we say 24 dollars?",
  serv: { baseUrl: process.env.SERV_BASE_URL!, apiKey: process.env.OPENSERV_API_KEY!, model: "gpt-5.4-mini", multipath: true, shadow: true } });
console.log(JSON.stringify({ status: r.status, ask: r.askCents, guard: r.guard, servStatus: r.servStatus, features: r.serv?.features, latencyMs: r.serv?.latencyMs, wallMs: Date.now() - t0, tokens: r.serv?.tokens, estInferenceUsd: r.serv?.estCostUsd, requestId: r.serv?.requestId }));
