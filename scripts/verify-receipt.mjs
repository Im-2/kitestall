// Verify a receipt against a running Kitestall instance. Usage: node scripts/verify-receipt.mjs <baseUrl> <receiptId>
const [base = "http://localhost:8787", id] = process.argv.slice(2);
if (!id) { console.error("usage: verify-receipt <baseUrl> <receiptId>"); process.exit(2); }
const r = await (await fetch(`${base}/receipts/${id}/verify`)).json();
for (const c of r.checks ?? []) console.log(c.ok ? "✓" : "✗", c.name, "-", c.detail);
console.log(r.ok ? "ALL CHECKS PASS" : "FAILED", r.explorer_url ?? "");
process.exit(r.ok ? 0 : 1);
