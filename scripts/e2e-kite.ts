// Real negotiation + REAL Kite TESTNET payment against a running API. Usage: tsx scripts/e2e-kite.ts [baseUrl] [scenario: plain|story-a] [shopId] [itemId]
// Appends a record to docs/E2E_LOG.md. Never fabricates: only writes what the run returned.
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { DevSigner } from "../packages/core/src/index.ts";
import { runShopper } from "../packages/shopper/src/index.ts";
if (existsSync(".env")) process.loadEnvFile(".env");
const base = process.argv[2] ?? "http://localhost:8787"; const scenario = process.argv[3] ?? "plain"; const shopId = process.argv[4] ?? "nomad"; const itemId = process.argv[5] ?? "day-pass";
const cat: any = await (await fetch(`${base}/shops/${shopId}/catalog`)).json(); const item = cat.items.find((i: any) => i.id === itemId);
const cap = scenario === "story-a" ? Math.floor((item.list_cents * 0.85) / 5) * 5 : undefined; // SIMULATED per-tx session cap (dev signer)
const signer = new DevSigner(process.env.DEMO_SHOPPER_PRIVATE_KEY!, cap);
const events: any[] = [];
const res = await runShopper({ baseUrl: base, shopId, itemId, budgetCents: item.list_cents, signer, eager: scenario === "story-a", onEvent: (e) => { events.push(e); console.log(JSON.stringify(e).slice(0, 260)); } });
const log = "docs/E2E_LOG.md";
if (!existsSync(log)) writeFileSync(log, "# E2E log (Kite TESTNET) — appended by `scripts/e2e-kite.ts`; never hand-edited\n\n");
let md = `## ${new Date().toISOString()} — scenario \`${scenario}\` — ${shopId}/${itemId} — ${res.ok ? "SETTLED" : "FAILED: " + res.reason}\n\n- Base URL: ${base}\n- Signer: ${signer.label}${cap ? ` (SIMULATED per-tx session cap ${cap} cents, enforced by the dev signer, not by Kite Passport)` : ""}\n`;
const budgetErr = events.find((e) => e.type === "budget_error"); if (budgetErr) md += `- Session-limit error hit (simulated): requested ${budgetErr.requested_cents}c > cap ${budgetErr.limit_cents}c → shopper renegotiated\n`;
md += `- Rounds: ${events.filter((e) => e.type === "counter").length}; Prompt Guard blocks: ${events.filter((e) => e.type === "counter" && e.serv?.guard === "blocked").length}; SERV statuses: ${[...new Set(events.filter((e) => e.type === "counter").map((e) => e.serv?.status))].join(", ")}\n`;
if (res.ok) {
  const v: any = await (await fetch(`${base}/receipts/${res.receipt.receipt_id}/verify`)).json();
  md += `- Agreed unit price: ${res.finalPriceCents} cents (list ${item.list_cents})\n- Receipt: ${res.receipt.receipt_id}; settled via: ${res.receipt.payment.settled_via}\n- Tx: ${res.txHash}\n- Explorer: https://testnet.kitescan.ai/tx/${res.txHash}\n- Verify: ${v.checks.map((c: any) => `${c.name} ${c.ok ? "✓" : "✗"}`).join(", ")}\n`;
}
appendFileSync(log, md + "\n");
console.log(res.ok ? "SETTLED " + res.txHash : "FAILED " + res.reason);
process.exit(res.ok ? 0 : 1);
