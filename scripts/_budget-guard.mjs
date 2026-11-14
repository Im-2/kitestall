// Safety rail: scripts that call the LIVE SERV API directly spend real, limited credits ($2 total budget, no top-ups).
// They refuse to run unless you pass --allow-live-serv (or ALLOW_LIVE_SERV=1) and print the estimated cost first.
export function requireLiveConsent(what, estimateUsd) {
  const ok = process.argv.includes("--allow-live-serv") || process.env.ALLOW_LIVE_SERV === "1";
  console.log(`[budget] ${what}: estimated SERV cost ~$${estimateUsd.toFixed(3)} (token usage x catalog price x 3 safety multiplier; OpenServ exposes no balance API).`);
  if (!ok) {
    console.error("[budget] REFUSING to run against live SERV. Re-run with --allow-live-serv after the owner approves this spend.");
    process.exit(3);
  }
}
