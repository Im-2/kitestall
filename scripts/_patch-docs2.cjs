const fs = require("fs");
const edit = (f, pairs) => {
  let s = fs.readFileSync(f, "utf8").replace(/\r\n/g, "\n");
  for (const [x, y] of pairs) { if (!s.includes(x)) { console.log("MISSING in", f, ":", String(x).slice(0, 80)); continue; } s = s.replace(x, () => y); }
  fs.writeFileSync(f, s);
};
edit("scripts/render-benchmarks.ts", [
  ['    for (const r of b.variants) L.push(`| ${r.name} | ${r.n} | ${r.p50} | ${r.p95} | ${r.mean_tokens} | ${r.mean_cost_usd} |`);', '    for (const r of b.variants) L.push(`| ${r.name} | ${r.n} | ${r.p50} | ${r.p95} | ${r.mean_tokens} | ${r.mean_cost_usd} |`);\n    L.push("", "**Kronos was NOT measured:** its row errored on every call (a wrong model id on the first attempt, then insufficient SERV credits), so it shows n=0. No Kronos figure or claim is made anywhere. Shadow Agent rows above are from the bench run; Shadow is used in production only for the demo shopper on accept/final rounds.");'],
]);
edit("docs/SERV_NOTES.md", [
  ["| **Shadow Agent** (`serv_shadow_agent` tool) | Supported behind `SERV_SHADOW=1`; **off in the default deployment** |", "| **Shadow Agent** (`serv_shadow_agent` tool, 1 iteration) | **Only for the server-side demo shopper (Watch page) on accept-candidate or final-round decisions**; off for the public Arena (secret-header gated, tested); `DEMO_SHADOW=0` disables it |"],
]);
edit("docs/WRITEUP.md", [
  ["- Shadow Agent is implemented but off by default (it about doubled latency in our bench). Kronos was not successfully measured.", "- **Shadow Agent** validates accept/final-round decisions, only for the demo shopper (about double latency; off for the public Arena to protect credits). **Kronos was not measured** and is not claimed."],
  ["## Revenue\nAccrued platform fee", "## Revenue\nA **paid firm quote** (5-cent testnet fee over x402 to a platform wallet, one real paid call logged in `docs/E2E_LOG.md`) plus an accrued platform fee"],
  ["- Arena with live rule trace", "- Code-computed final-round rule `R-FINAL-ACCEPT`, lint + 90+ tests in `pnpm check`, and a guide for judges to shop with their own agent (`docs/SHOP_WITH_YOUR_AGENT.md`).\n- Arena with live rule trace"],
]);
edit("docs/DEMO_SCRIPT.md", [
  ["| 60–80s | Receipt panel → **Verify this receipt** |", "| 60–70s | (optional) Watch → scenario **Paid firm quote** | Show the 5-cent x402 fee tx on Kitescan, then the signed fixed price and the purchase. \"Revenue that is really paid on-chain, testnet.\" |\n| 60–80s | Receipt panel → **Verify this receipt** |"],
  ["Honesty lines to keep in the voice-over:", "Shadow Agent note: the demo shopper's accept/final rounds are validated by SERV Shadow Agent (about double latency), so Story A takes a bit longer on screen; the Arena does not use it.\n\nHonesty lines to keep in the voice-over:"],
]);
edit("docs/X_POST.md", [
  ["**C**", "**D**\nRevenue for a storefront agent, for real (testnet): a 5-cent x402 \"firm quote\": pay the fee on @gokite_ai, get a signed fixed price valid for 10 minutes, then buy. Fee tx on Kitescan, receipts verify ✓✓✓. Built for the SERV Hackathon (Kite track).\nhttps://kitestall.onrender.com @openservai #BuildonSERV #SERV\n\n**C**"],
]);
console.log("ok");
