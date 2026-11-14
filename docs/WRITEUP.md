# Kitestall — submission write-up

**Track: 02 Kite.** Repo: https://github.com/Im-2/kitestall · Demo: `https://kitestall.onrender.com`

## What it does
Kitestall is the seller's agent on Kite. A shop publishes a price policy; a storefront agent haggles with shopper agents; the agreed price is carried in an x402 `402`; the shopper pays on Kite testnet; the shop returns a voucher and an ed25519-signed receipt listing the public rules that produced the price. Anyone can verify the receipt, without the private floor, at `/#/verify`.

## How it uses SERV Reasoning
- **Prompt Guard** screens every buyer-authored string; blocked text is never retried without it.
- **Strict JSON schema**: the model picks a concession level (enum) and writes a message. It never sees the floor and never outputs a price; code converts levels to cents and enforces floor, stock, rounds and leaks.
- **Multipath** for persona plus competing public rules; **policy compile** turns an owner's plain English into a validated draft.
- Shadow Agent is implemented but off by default (it about doubled latency in our bench). Kronos was not successfully measured.
- Receipts carry SERV request ids and a live/fallback status; fallback rounds are never claimed as SERV decisions.

## What's new and working (all Kite testnet)
- 4 real settled testnet sales (2 shops; 3 logged in `docs/E2E_LOG.md` incl. a buyer-budget renegotiation, plus 1 made through the web UI, recorded in `docs/history.json`): every receipt passes all six verify checks on the live site.
- Adversarial suite on live SERV: 45 attacks + 41 benign messages: **0 floor breaches, 0 leaks**; Prompt Guard blocked 73% of attacks with a 22% benign false-positive rate (`docs/BENCHMARKS.md`).
- Arena with live rule trace, owner dashboard (English → "what I understood" → 5 simulated haggles → publish), sales ledger, signed receipts, agent-readable `/llms.txt`.

## Revenue
Accrued platform fee (1% of settled sales) and per-round quote fee after a free tier, recorded in a ledger. Measured SERV inference cost: about $0.002 per full negotiation (token usage × catalog price; excludes SERV feature surcharges). Fees are accrued, not collected, in this build.

## Try it
Arena: `https://kitestall.onrender.com/#/arena` — try to haggle below the floor. Shopper agent: `https://kitestall.onrender.com/#/watch`. Open a stall: `https://kitestall.onrender.com/#/owner`.

## Honest limits
Testnet only. No Kite Passport session was used: payments use a labeled dev signer, and Story A's session limit is simulated. Pieverse `/v2/settle` returned `transaction_failed` for our PYUSD authorizations, so settlement used a self-relay fallback (recorded in each receipt). Owner auth is a bearer token. Prompt Guard is non-deterministic and had false positives. Repo is new; no code reused.
