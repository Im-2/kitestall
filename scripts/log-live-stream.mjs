// Appends a record of a LIVE demo-shopper run (saved SSE stream) to docs/E2E_LOG.md. Nothing is invented: every line comes from the saved stream,
// and the verify result is fetched from the live site. Usage: node scripts/log-live-stream.mjs <sse file> <baseUrl>
import { readFileSync, appendFileSync } from "node:fs";
const [file, base = "https://kitestall.onrender.com"] = process.argv.slice(2);
const ev = readFileSync(file, "utf8").split("\n").filter((l) => l.startsWith("data: ")).map((l) => JSON.parse(l.slice(6)));
const rc = ev.find((e) => e.type === "receipt"); const sc = ev.find((e) => e.type === "scenario"); const be = ev.find((e) => e.type === "budget_error");
const counters = ev.filter((e) => e.type === "counter");
let md = `## ${rc?.ts ?? ev.at(-1)?.ts} — LIVE site run, scenario \`${sc?.scenario}\` (demo shopper SSE stream) — ${rc ? "SETTLED" : "NO SALE"}\n\n- Base URL: ${base}\n- Signer: dev signer (no Passport session); session cap ${sc?.simulated_session_cap_cents}c is SIMULATED\n`;
if (be) md += `- Session-limit error (simulated): requested ${be.requested_cents}c > cap ${be.limit_cents}c → shopper renegotiated\n`;
md += `- Rounds: ${counters.length}; Prompt Guard blocks: ${counters.filter((e) => e.serv?.guard === "blocked").length}; SERV statuses: ${[...new Set(counters.map((e) => e.serv?.status))].join(", ")}\n`;
if (rc) {
  const v = await (await fetch(`${base}/receipts/${rc.receipt.receipt_id}/verify`)).json();
  md += `- Agreed unit price: ${rc.receipt.agreed_price_cents} cents (list ${rc.receipt.list_price_cents}); rules: ${rc.receipt.rules_fired.join(", ")}\n- Receipt: ${rc.receipt.receipt_id}; settled via: ${rc.receipt.payment.settled_via}; SERV request ids: ${rc.receipt.serv.request_ids.length}\n- Tx: ${rc.tx_hash}\n- Explorer: https://testnet.kitescan.ai/tx/${rc.tx_hash}\n- Verify (live): ${v.checks.map((c) => `${c.name} ${c.ok ? "✓" : "✗"}`).join(", ")}\n- Raw stream: docs/evidence/${file.split(/[\\/]/).pop()}\n`;
}
appendFileSync("docs/E2E_LOG.md", md + "\n"); console.log("logged");
