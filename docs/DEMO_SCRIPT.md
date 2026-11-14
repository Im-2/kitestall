# Demo video storyboard (final: 3:09.8, 1080p, captions burned in)

The shipped video follows [docs/VIDEO_SCRIPT_FINAL.md](VIDEO_SCRIPT_FINAL.md) exactly (narration text, scene timings, on-screen actions and the evidence for every claim). This page is the short shot list.

Prep: shopper wallet funded (`node scripts/balances.mjs`; claim testnet PYUSD with `node scripts/claim-token.mjs`), site awake (`curl https://kitestall.onrender.com/healthz`), do not restart or redeploy the service, SERV credits available (one take costs about $0.05 estimated).

| Time | Shot (all on https://kitestall.onrender.com, real actions) | Narration summary |
|---|---|---|
| 0:00-0:19 | Title card, landing hero | Problem: buyers' agents have spending limits, sellers have no safe equivalent. Kitestall is the seller side, for the Kite track. |
| 0:20-0:40 | Landing: live stats, bento, how it works | Price travels inside the x402 402; every number is live; testnet. |
| 0:41-1:15 | Arena: haggle, injection flagged by Prompt Guard, live trace, accepted quote | Prompt Guard on every message; the model picks a concession level, code clamps at the floor; fallback is labelled. |
| 1:16-1:53 | Watch: Story A live | Session budget hit (simulated, Passport is mainnet-only), renegotiation, Shadow Agent re-checks near-final decisions in this demo flow, code-computed best-and-final rule, 402 paid to the shop's wallet, real testnet tx. |
| 1:53-2:15 | Receipt, Verify (6 checks) | Signature, public rules, price bounds, policy hash, on-chain transfer; no private floor; verifiable seller identity. |
| 2:15-2:35 | Owner dashboard | Plain English policy compiled by SERV, owner approves; ledger; fees accrued; the collected 5-cent firm quote. |
| 2:35-3:10 | Results slide, "What to know" slide, end card | 45 attacks, 0 floor breaches, 0 leaks; testnet, simulated session limit, accrued fees, self-relay settlement; live URL, repo URL, Kite and OpenServ logos. |

Honesty lines that are spoken and shown: testnet only; Story A's session limit is simulated by the dev signer; fees are accrued, not collected; settlement uses the self-relay fallback; Shadow Agent runs only in the Watch demo flow (off in the public Arena to protect credits).

Commands: `node scripts/video/tts.mjs`, `node scripts/video/record.mjs landing arena storya verify owner`, `node scripts/video/slides.mjs`, `node scripts/video/compose.mjs`. Output in `out/video/` (gitignored).
