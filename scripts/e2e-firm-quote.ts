// ONE real paid firm-quote call on Kite TESTNET (fee to the platform wallet) followed by a purchase at the firm price. No SERV involved.
// Usage: tsx scripts/e2e-firm-quote.ts [baseUrl] [shopId] [itemId]. Appends to docs/E2E_LOG.md (only what the run returned).
import { appendFileSync, existsSync, writeFileSync } from "node:fs";
import { DevSigner } from "../packages/core/src/index.ts";
import { runFirmQuoteShopper } from "../packages/shopper/src/index.ts";
if (existsSync(".env")) process.loadEnvFile(".env");
const base = process.argv[2] ?? "http://localhost:8787", shopId = process.argv[3] ?? "nomad", itemId = process.argv[4] ?? "day-pass";
const signer = new DevSigner(process.env.DEMO_SHOPPER_PRIVATE_KEY!);
const res = await runFirmQuoteShopper({ baseUrl: base, shopId, itemId, signer, onEvent: (e) => console.log(JSON.stringify(e).slice(0, 230)) });
const log = "docs/E2E_LOG.md"; if (!existsSync(log)) writeFileSync(log, "# E2E log (Kite TESTNET)\n\n");
let md = `## ${new Date().toISOString()} — PAID FIRM QUOTE (x402 micro-fee) — ${shopId}/${itemId} — ${res.ok ? "FEE + SALE SETTLED" : res.feeTx ? "FEE SETTLED, SALE FAILED: " + res.reason : "FAILED: " + res.reason}\n\n- Base URL: ${base}\n- Signer: ${signer.label}\n`;
if (res.firmQuote) { const fq = res.firmQuote; md += `- Firm quote: ${fq.firm_quote_id}, unit price ${fq.unit_price_cents}c (list ${fq.list_price_cents}c), valid until ${fq.valid_until}, rules ${fq.rules_fired.join(",")}\n- **Fee**: ${fq.fee.cents}c paid to the platform wallet ${fq.fee.pay_to}, settled via ${fq.fee.settled_via}\n- Fee tx: ${fq.fee.tx_hash}\n- Fee explorer: https://testnet.kitescan.ai/tx/${fq.fee.tx_hash}\n`; }
if (res.ok) { const v: any = await (await fetch(`${base}/receipts/${res.receipt.receipt_id}/verify`)).json(); md += `- Purchase receipt: ${res.receipt.receipt_id} (rules ${res.receipt.rules_fired.join(",")}; SERV status ${res.receipt.serv.status}); settled via ${res.receipt.payment.settled_via}\n- Purchase tx: ${res.txHash}\n- Purchase explorer: https://testnet.kitescan.ai/tx/${res.txHash}\n- Verify: ${v.checks.map((c: any) => `${c.name} ${c.ok ? "✓" : "✗"}`).join(", ")}\n`; }
appendFileSync(log, md + "\n"); console.log(res.ok ? `OK fee ${res.feeTx} sale ${res.txHash}` : "FAILED " + res.reason); process.exit(res.ok ? 0 : 1);
