// Merges REAL settled sales from the LIVE site's owner-only export into docs/history.json (verbatim rows, only orders not already present).
// Usage: tsx scripts/merge-live-history.ts https://kitestall.onrender.com [--only o_xxx,o_yyy]   (needs OWNER_TOKEN in .env; the token is never printed)
import { readFileSync, writeFileSync } from "node:fs";
if (process.env.OWNER_TOKEN === undefined) process.loadEnvFile(".env");
const base = process.argv[2] ?? "https://kitestall.onrender.com";
const onlyArg = process.argv.indexOf("--only"); const only = onlyArg >= 0 ? new Set(process.argv[onlyArg + 1]!.split(",")) : null;
const r = await fetch(`${base}/owner/export-history`, { headers: { authorization: `Bearer ${process.env.OWNER_TOKEN}` } });
if (!r.ok) { console.error("export failed", r.status); process.exit(1); }
const live = await r.json() as any; const file = "docs/history.json"; const h = JSON.parse(readFileSync(file, "utf8"));
const have = new Set(h.sales.map((s: any) => s.order.id)); let added = 0;
for (const s of live.sales) {
  if (have.has(s.order.id) || (only && !only.has(s.order.id))) continue;
  h.sales.push(s); added++;
  const rc = JSON.parse(s.receipt.json);
  for (const p of live.policies) if (p.shop_id === rc.shop_id && p.version === rc.policy.version && !h.policies.some((x: any) => x.shop_id === p.shop_id && x.version === p.version)) h.policies.push(p);
}
for (const [id, k] of Object.entries(live.shop_public_keys)) if (h.shop_public_keys[id] !== k) { console.error(`public key mismatch for ${id}: refusing to merge`); process.exit(2); }
h.merged_from_live_at = new Date().toISOString(); writeFileSync(file, JSON.stringify(h, null, 2));
console.log(`merged ${added} real sale(s) from ${base}; history now has ${h.sales.length} sales and ${h.policies.length} policies`);
