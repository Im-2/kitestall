// Adds a REAL live sale to docs/history.json using only PUBLIC data from the live site (receipt, order, published policy row). Nothing is invented:
// session/rounds/quote rows are not public, so this entry is receipt-only (marked receipt_only). Usage: node scripts/add-live-receipt.mjs <baseUrl> <receiptId>
import { readFileSync, writeFileSync } from "node:fs";
const [base, rid] = process.argv.slice(2);
const get = async (p) => { const r = await fetch(base + p); if (!r.ok) throw new Error(p + " " + r.status); return r.json(); };
const receipt = await get(`/receipts/${rid}`);
const act = await get("/api/public/activity"); const sale = act.sales.find((x) => x.receipt_id === rid); if (!sale) throw new Error("receipt not in recent sales");
const order = await get(`/orders/${sale.order_id}`);
const pol = await get(`/shops/${receipt.shop_id}/policy`);
if (pol.version !== receipt.policy.version || pol.policy_hash !== receipt.policy.hash) throw new Error("published policy does not match the receipt (a newer version is live); refusing");
const v = await get(`/receipts/${rid}/verify`); if (!v.ok) throw new Error("receipt does not verify on the live site; refusing");
const file = "docs/history.json"; const h = JSON.parse(readFileSync(file, "utf8"));
if (h.sales.some((s) => s.order.id === order.id)) { console.log("already present"); process.exit(0); }
const keys = await get("/.well-known/kitestall-keys"); if (h.shop_public_keys[receipt.shop_id] !== keys[receipt.shop_id].replace("ed25519:", "")) throw new Error("public key mismatch");
if (!h.policies.some((p) => p.shop_id === receipt.shop_id && p.version === pol.version)) h.policies.push({ shop_id: receipt.shop_id, version: pol.version, hash: pol.policy_hash, public_json: JSON.stringify(pol.public), created_at: pol.created_at });
h.sales.push({ receipt_only: true, order, receipt: { id: receipt.receipt_id, order_id: order.id, shop_id: receipt.shop_id, json: JSON.stringify(receipt), created_at: receipt.issued_at },
  payment: { quote_id: order.quote_id, nonce: null, tx_hash: receipt.payment.tx_hash, payer: receipt.payment.payer, amount_wei: receipt.payment.amount_wei, status: "settled", detail: null, signer_kind: "x402", created_at: receipt.issued_at } });
h.merged_from_live_at = new Date().toISOString(); writeFileSync(file, JSON.stringify(h, null, 2)); console.log("added", order.id, "->", h.sales.length, "sales");
