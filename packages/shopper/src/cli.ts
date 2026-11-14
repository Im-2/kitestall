#!/usr/bin/env tsx
// kitestall-shopper --shop <url> --shop-id <id> --item <id> --budget <cents> [--qty n] [--sim-session-cap <cents>]
import { DevSigner } from "@kitestall/core";
import { runShopper } from "./index.ts";

const a = process.argv.slice(2);
const arg = (k: string, d?: string) => { const i = a.indexOf("--" + k); return i >= 0 ? a[i + 1] : d; };
const pk = process.env.SHOPPER_PRIVATE_KEY ?? process.env.DEMO_SHOPPER_PRIVATE_KEY;
if (!pk) { console.error("Set SHOPPER_PRIVATE_KEY (funded Kite TESTNET key)."); process.exit(2); }
const cap = arg("sim-session-cap");
const signer = new DevSigner(pk, cap ? Number(cap) : undefined);
const res = await runShopper({
  baseUrl: arg("shop", "http://localhost:8787")!, shopId: arg("shop-id", "nomad")!, itemId: arg("item", "day-pass")!, qty: Number(arg("qty", "1")),
  budgetCents: Number(arg("budget", "2500")), signer, onEvent: (e) => console.log(JSON.stringify(e)),
});
console.log(JSON.stringify({ ok: res.ok, reason: res.reason, txHash: res.txHash }));
process.exit(res.ok ? 0 : 1);
