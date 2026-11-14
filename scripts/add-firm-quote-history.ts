// Adds a REAL paid firm-quote fee to docs/history.json from its saved signed document. Verifies the ed25519 signature against the shop's published public key
// and the fee transfer on-chain (Kite testnet RPC) before adding. Usage: tsx scripts/add-firm-quote-history.ts docs/evidence/firm-quote-fq_xxx.json
import { readFileSync, writeFileSync } from "node:fs";
import { createPublicClient, http } from "viem";
import { verifyPayload, centsToWei, KITE_TESTNET } from "../packages/core/src/index.ts";

const file = process.argv[2]; if (!file) { console.error("usage: add-firm-quote-history <firm-quote.json>"); process.exit(2); }
const fq = JSON.parse(readFileSync(file, "utf8")); const h = JSON.parse(readFileSync("docs/history.json", "utf8"));
const pub = h.shop_public_keys[fq.shop_id]; if (!pub) throw new Error("unknown shop key");
if (!verifyPayload(fq, pub)) throw new Error("signature does not verify against the published shop key; refusing");
const rc = await createPublicClient({ transport: http(KITE_TESTNET.rpc) }).getTransactionReceipt({ hash: fq.fee.tx_hash });
if (rc.status !== "success") throw new Error("fee tx did not succeed on-chain; refusing");
h.firm_quotes ??= [];
if (h.firm_quotes.some((x: any) => x.firm_quote.firm_quote_id === fq.firm_quote_id)) { console.log("already present"); process.exit(0); }
h.firm_quotes.push({ firm_quote: fq, amount_wei: centsToWei(fq.fee.cents).toString() });
writeFileSync("docs/history.json", JSON.stringify(h, null, 2));
console.log(`added firm quote ${fq.firm_quote_id}: signature OK, tx ${fq.fee.tx_hash} succeeded in block ${rc.blockNumber}; history now has ${h.firm_quotes.length} firm quote(s)`);
