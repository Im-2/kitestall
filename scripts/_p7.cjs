const fs = require("fs");
let a = fs.readFileSync("apps/api/src/app.ts", "utf8").replace(/\r\n/g, "\n");
const x = "Shopper CLI: kitestall-shopper in packages/shopper. All money is testnet.";
if (!a.includes(x)) throw new Error("llms marker missing");
a = a.replace(x, () => "Optional, paid (testnet): POST /shops/{shop}/firm-quote {\"item_id\",\"qty\"} -> 402 for a small fee (platform wallet); pay with the same X-PAYMENT flow to receive a signed time-locked fixed price and a quote_id for /checkout.\nExample agent (copy it): scripts/example-shopper.mjs in https://github.com/Im-2/kitestall (viem + Node). Guide: docs/SHOP_WITH_YOUR_AGENT.md.\nLimits: 8 messages per session, 30 per IP per day. Prompt Guard screens every message; a flagged message does not use a round, rephrase and retry.\nShopper CLI: kitestall-shopper in packages/shopper. All money is testnet.");
fs.writeFileSync("apps/api/src/app.ts", a);
