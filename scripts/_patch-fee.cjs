const fs = require("fs");
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  for (const [x, y] of pairs) { if (!s.includes(x)) { console.log("MISSING in", f, ":", String(x).slice(0, 80)); continue; } s = s.replace(x, () => y); }
  fs.writeFileSync(f, s);
};
edit("packages/shopper/src/index.ts", [
  ['export async function runFirmQuoteShopper(o: Omit<ShopperOpts, "budgetCents" | "eager" | "maxRoundsPerSession">)', 'export async function runFirmQuoteShopper(o: Omit<ShopperOpts, "budgetCents" | "eager" | "maxRoundsPerSession"> & { feeOnly?: boolean })'],
  ['  const c1 = await j(`${base}/shops/${o.shopId}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quote_id: fq.quote_id }) });\n  if (c1.status !== 402) { emit("error", { message: "expected 402", status: c1.status }); return { ok: false, reason: "no402", firmQuote: fq',
   '  if (o.feeOnly) return { ok: true, firmQuote: fq, feeTx: fq.fee.tx_hash }; // buy only the 5-cent firm quote; do not purchase the item\n  const c1 = await j(`${base}/shops/${o.shopId}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quote_id: fq.quote_id }) });\n  if (c1.status !== 402) { emit("error", { message: "expected 402", status: c1.status }); return { ok: false, reason: "no402", firmQuote: fq'],
]);
edit("scripts/e2e-firm-quote.ts", [
  ['const base = process.argv[2] ?? "http://localhost:8787", shopId = process.argv[3] ?? "nomad", itemId = process.argv[4] ?? "day-pass";', 'const feeOnly = process.argv.includes("--fee-only"); const pos = process.argv.slice(2).filter((a) => !a.startsWith("--"));\nconst base = pos[0] ?? "http://localhost:8787", shopId = pos[1] ?? "nomad", itemId = pos[2] ?? "day-pass";'],
  ["const res = await runFirmQuoteShopper({ baseUrl: base, shopId, itemId, signer,", "const res = await runFirmQuoteShopper({ feeOnly, baseUrl: base, shopId, itemId, signer,"],
  ['PAID FIRM QUOTE (x402 micro-fee) — ${shopId}/${itemId} — ${res.ok ? "FEE + SALE SETTLED"', 'PAID FIRM QUOTE (x402 micro-fee${feeOnly ? ", fee only, no purchase" : ""}) — ${shopId}/${itemId} — ${res.ok ? (feeOnly ? "FEE SETTLED" : "FEE + SALE SETTLED")'],
  ["if (res.ok) { const v: any", "if (res.firmQuote) { const { writeFileSync: w, mkdirSync: m } = await import(\"node:fs\"); m(\"docs/evidence\", { recursive: true }); w(`docs/evidence/firm-quote-${res.firmQuote.firm_quote_id}.json`, JSON.stringify(res.firmQuote, null, 2)); md += `- Signed firm quote saved: docs/evidence/firm-quote-${res.firmQuote.firm_quote_id}.json\\n`; }\nif (res.ok && !feeOnly) { const v: any"],
]);
// importer + exporter: firm-quote fee rows survive restarts
edit("apps/api/src/seed.ts", [
  ["interface History { policies:", "interface History { firm_quotes?: any[]; policies:"],
  ["  return { imported, skipped };\n}", `  // paid firm-quote fees (REAL on-chain testnet payments): ledger row (collected) + payment row, verbatim from the signed quote document
  for (const f of h.firm_quotes ?? []) {
    const q = f.firm_quote; if (row(db, "SELECT 1 x FROM ledger_fees WHERE kind='firm_quote_fee' AND ref=?", q.firm_quote_id)) continue;
    run(db, "INSERT INTO ledger_fees(shop_id,kind,ref,amount_cents,accrued_only,created_at) VALUES(?,?,?,?,0,?)", q.shop_id, "firm_quote_fee", q.firm_quote_id, q.fee.cents, q.issued_at);
    run(db, "INSERT OR IGNORE INTO payments(quote_id,nonce,tx_hash,payer,amount_wei,status,signer_kind,created_at) VALUES(?,?,?,?,?,?,?,?)", q.firm_quote_id, null, q.fee.tx_hash, q.fee.payer, f.amount_wei, "settled", "firm_quote", q.issued_at);
  }
  return { imported, skipped };
}`],
]);
console.log("ok");
