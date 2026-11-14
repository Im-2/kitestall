// Probe facilitator /v2/verify with an EIP-3009 payload signed by the demo shopper (no funds needed; verify is read-only).
import { loadEnv } from "./_env.mjs"; loadEnv();
import { privateKeyToAccount } from "viem/accounts";
import { randomBytes } from "node:crypto";
const asset = process.argv[2] || "0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9";
const name = process.argv[3] || "PYUSD";
const acct = privateKeyToAccount(process.env.DEMO_SHOPPER_PRIVATE_KEY);
const payTo = process.env.SHOP_WALLET_ADDRESS_NOMAD;
const now = Math.floor(Date.now() / 1000);
const auth = { from: acct.address, to: payTo, value: "10000000000000000", validAfter: String(now - 60), validBefore: String(now + 300), nonce: "0x" + randomBytes(32).toString("hex") };
const signature = await acct.signTypedData({
  domain: { name, version: "1", chainId: 2368, verifyingContract: asset },
  types: { TransferWithAuthorization: [{ name: "from", type: "address" }, { name: "to", type: "address" }, { name: "value", type: "uint256" }, { name: "validAfter", type: "uint256" }, { name: "validBefore", type: "uint256" }, { name: "nonce", type: "bytes32" }] },
  primaryType: "TransferWithAuthorization", message: { ...auth, value: BigInt(auth.value), validAfter: BigInt(auth.validAfter), validBefore: BigInt(auth.validBefore) },
});
const accepted = { scheme: "exact", network: "eip155:2368", asset, amount: auth.value, payTo, maxTimeoutSeconds: 300, extra: { name, version: "1" } };
const body = { x402Version: 2, paymentPayload: { x402Version: 2, resource: { url: "https://kitestall.example/checkout", description: "probe", mimeType: "application/json" }, accepted, payload: { signature, authorization: auth } }, paymentRequirements: accepted };
const r = await fetch("https://facilitator.pieverse.io/v2/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
console.log(r.status, await r.text());
