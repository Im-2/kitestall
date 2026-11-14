import { loadEnv } from "./_env.mjs"; loadEnv();
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
const asset = "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const acct = privateKeyToAccount(process.env.DEMO_SHOPPER_PRIVATE_KEY); const payTo = process.env.SHOP_WALLET_ADDRESS_NOMAD;
const now = Math.floor(Date.now() / 1000);
const auth = { from: acct.address, to: payTo, value: "10000000000000000", validAfter: String(now - 60), validBefore: String(now + 300), nonce: "0x" + randomBytes(32).toString("hex") };
const signature = await acct.signTypedData({ domain: { name: "PYUSD", version: "1", chainId: 2368, verifyingContract: asset },
  types: { TransferWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
  primaryType: "TransferWithAuthorization", message: { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) } });
const req = { scheme: "gokite-aa", network: "kite-testnet", maxAmountRequired: auth.value, resource: "https://x/y", description: "d", mimeType: "application/json", payTo, maxTimeoutSeconds: 300, asset, extra: null, merchantName: "t" };
const tries = [
  ["POST", "/v2/settle", { authorization: auth, signature, network: "kite-testnet" }],
  ["POST", "/v2/settle", { authorization: auth, signature, network: "eip155:2368" }],
  ["POST", "/settle", { authorization: auth, signature, network: "kite-testnet" }],
  ["POST", "/v2/verify", { authorization: auth, signature, network: "kite-testnet" }],
];
for (const [m, p, b] of tries) { const r = await fetch("https://facilitator.pieverse.io" + p, { method: m, headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); console.log(p, JSON.stringify(b).slice(0, 40), r.status, (await r.text()).slice(0, 300)); }
console.log("---- variants");
const mk = (scheme, network, ext) => { const acc = { scheme, network, asset, amount: auth.value, payTo, maxTimeoutSeconds: 300, extra: ext };
  return { x402Version: 2, paymentPayload: { x402Version: 2, resource: { url: "https://x/y", description: "d", mimeType: "application/json" }, accepted: acc, payload: { signature, authorization: auth } }, paymentRequirements: acc }; };
for (const [s, n, e] of [["gokite-aa", "kite-testnet", { name: "PYUSD", version: "1" }], ["exact", "kite-testnet", { name: "PYUSD", version: "1" }], ["exact", "eip155:2368", null]]) {
  for (const ep of ["verify", "settle"]) { const r = await fetch("https://facilitator.pieverse.io/v2/" + ep, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(mk(s, n, e)) }); console.log(s, n, e ? "extra" : "noextra", ep, r.status, (await r.text()).slice(0, 200)); }
}
