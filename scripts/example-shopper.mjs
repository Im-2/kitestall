// Minimal, dependency-light shopper agent for Kitestall (Kite TESTNET). Needs: Node 20+, `npm i viem`, and a funded TESTNET key (KITE for nothing, PYUSD for the purchase).
//   SHOPPER_PRIVATE_KEY=0x... node scripts/example-shopper.mjs https://kitestall.onrender.com nomad day-pass 2300
// It discovers the shop, haggles (opening at the offer you give and moving up), gets an x402 402, signs an EIP-3009 transfer and retries with X-PAYMENT.
// This is a DEV signer: a plain EOA signature, not a Kite Passport session.
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";

const [base = "http://localhost:8787", shopId = "nomad", itemId = "day-pass", maxOffer = "2300"] = process.argv.slice(2);
const key = process.env.SHOPPER_PRIVATE_KEY; if (!key) { console.error("Set SHOPPER_PRIVATE_KEY (funded Kite TESTNET key)"); process.exit(2); }
const acct = privateKeyToAccount(key);
const post = async (path, body, headers = {}) => { const r = await fetch(base + path, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: JSON.stringify(body) }); return { status: r.status, body: await r.json() }; };

const cat = await (await fetch(`${base}/shops/${shopId}/catalog`)).json();
const item = cat.items.find((i) => i.id === itemId); console.log(`${cat.shop.name}: ${item.name}, list ${item.list_cents / 100} (TESTNET)`);

let sid, quote, offer = Math.round(item.list_cents * 0.8), lastAsk = item.list_cents; const cap = Number(maxOffer);
for (let round = 1; round <= 4 && !quote; round++) {
  offer = Math.min(cap, round === 4 ? lastAsk : offer);                       // round 4 = take the standing best-and-final ask if affordable
  const r = await post(`/shops/${shopId}/negotiate`, { session_id: sid, item_id: itemId, qty: 1, offer_cents: offer, message: "Hello, I'd like to buy one." });
  if (r.status !== 200) { console.log("negotiate error", r.status, r.body.error?.message); break; }
  sid = r.body.session_id; lastAsk = r.body.ask_cents; console.log(`round ${r.body.round}: offered ${offer / 100} -> ${r.body.status}, ask ${lastAsk / 100} [${r.body.rules_fired.join(",")}]`);
  if (r.body.status === "accepted") quote = r.body.quote; else if (r.body.status === "rejected") break;
  offer = Math.min(cap, Math.ceil((offer + lastAsk) / 2));
}
if (!quote) { console.log("No deal within your budget."); process.exit(1); }

const c1 = await post(`/shops/${shopId}/checkout`, { quote_id: quote.quote_id });          // 402 with the agreed price in the x402 requirements
const req = c1.body.accepts[0]; console.log(`HTTP ${c1.status}: pay ${Number(BigInt(req.amount) / 10n ** 14n) / 10000} ${req.extra.name} to ${req.payTo} on ${req.network}`);
const now = Math.floor(Date.now() / 1000);
const authorization = { from: acct.address, to: req.payTo, value: req.amount, validAfter: "0", validBefore: String(now + req.maxTimeoutSeconds), nonce: "0x" + randomBytes(32).toString("hex") };
const signature = await acct.signTypedData({
  domain: { name: req.extra.name, version: req.extra.version, chainId: 2368, verifyingContract: req.asset },
  types: { TransferWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
  primaryType: "TransferWithAuthorization", message: { ...authorization, value: BigInt(authorization.value), validAfter: 0n, validBefore: BigInt(authorization.validBefore) },
});
const payment = { x402Version: 2, resource: { url: `${base}/shops/${shopId}/checkout`, description: req.description, mimeType: "application/json" }, accepted: req, payload: { signature, authorization } };
const c2 = await post(`/shops/${shopId}/checkout`, { quote_id: quote.quote_id }, { "X-PAYMENT": Buffer.from(JSON.stringify(payment)).toString("base64") });
if (c2.status !== 200) { console.log("payment failed", c2.status, c2.body.error?.message); process.exit(1); }
console.log(`PAID. voucher ${c2.body.voucher}; receipt ${c2.body.receipt.receipt_id}; tx ${c2.body.receipt.payment.tx_hash}; settled via ${c2.body.receipt.payment.settled_via}`);
console.log(`verify: ${base}/receipts/${c2.body.receipt.receipt_id}/verify  |  explorer: ${c2.body.explorer_url}`);
