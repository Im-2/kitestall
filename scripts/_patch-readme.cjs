const fs = require("fs");
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  for (const [x, y] of pairs) { if (!s.includes(x)) { console.log("MISSING in", f, ":", String(x).slice(0, 80)); continue; } s = s.replace(x, () => y); }
  fs.writeFileSync(f, s);
};
edit("README.md", [
  ["> **Everything here is Kite TESTNET.** No real money. Fees are accrued in a ledger, not collected.", "> **Everything here is Kite TESTNET.** No real money. Platform and per-round fees are accrued in a ledger, not collected; the optional 5-cent firm-quote fee is really paid on-chain (testnet) and recorded as collected. Payments use a **dev signer**, not a Kite Passport session."],
  ["pnpm check                     # typecheck + unit + integration tests", "pnpm check                     # lint + typecheck + unit + integration tests"],
  ["- **Shadow Agent** is implemented behind `SERV_SHADOW=1` but **off by default** (it roughly doubled latency in our bench; code-side validation already enforces every rule).\n- **Kronos** was not successfully benchmarked; not used.",
   "- **Shadow Agent** (`serv_shadow_agent`, 1 validation iteration) runs **only for the server-side demo shopper on the Watch page, and only on accept-candidate or final-round decisions** (offer within 5% of the ask, or the last round). It is **off for the public Arena**, enforced by a per-boot secret header and covered by tests; the budget counter charges shadowed rounds double. Receipts list `shadow` in their SERV features only when it actually ran. Cost/latency: roughly doubled latency (one live check: 10.4 s for a shadowed round); disable with `DEMO_SHADOW=0`.\n- **Kronos was not measured** (the benchmark attempts failed: a wrong model id, then insufficient credits). We make no Kronos claims and do not use it."],
  ["## Revenue model (accounting only)", "## Revenue model\n**Paid firm quote (real, testnet):** `POST /shops/:shop/firm-quote` costs 5 cents (testnet PYUSD, x402 `402`, paid through the same checkout and self-relay path to a platform wallet) and returns a signed price valid for 10 minutes, derived only from public numbers. The fee is recorded in the ledger as **collected** (one real paid call is logged in `docs/E2E_LOG.md`, shown on the owner dashboard).\n\n**Accounting only:**"],
  ["## Roadmap\nPassport signer via `kpass`; real fee collection (split payment); third seed shop; paid firm-quote endpoint over x402; merchant-side Passport verification when an API exists.", "## Roadmap\nPassport signer via `kpass` (blocked today: needs the owner's email/passkey and pays mainnet USDC.e); collecting the platform fee by split payment; a third seed shop; merchant-side Passport verification when an API exists."],
  ["## Final round: best and final", "## Shop with your own agent\nStep-by-step (curl flow, copy-paste example agent, paid firm quote, verification) and what is NOT available (no MCP server, no Passport): [docs/SHOP_WITH_YOUR_AGENT.md](docs/SHOP_WITH_YOUR_AGENT.md).\n\n## Final round: best and final"],
]);
console.log("ok");
