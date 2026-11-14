# Kitestall — submission write-up

**Track: 02 Kite.** Repo: https://github.com/Im-2/kitestall · Demo: https://kitestall.onrender.com

## What it does
Kitestall is the seller's agent on Kite. A shop publishes a price policy; a storefront agent haggles with shopper agents; the agreed price is carried in an x402 `402`; the shopper pays on Kite testnet; the shop returns a voucher and an ed25519-signed receipt listing the public rules that produced the price. Anyone can verify the receipt, without the private floor, at `/#/verify`.

## How it uses SERV Reasoning
- **Prompt Guard** screens every buyer-authored string; blocked text is never retried without it.
- **Strict JSON schema**: the model picks a concession level (enum) and writes a message. It never sees the floor and never outputs a price; code converts levels to cents and enforces floor, stock, rounds and leaks.
- **Multipath** for persona plus competing public rules; **policy compile** turns an owner's plain English into a validated draft.
- **Shadow Agent** validates accept/final-round decisions in the Watch demo flow (about double latency; off in the public Arena to protect credits). **Kronos was not measured** and is not claimed.
- Receipts carry SERV request ids and a live/fallback status; fallback rounds are never claimed as SERV decisions.

## What's new and working (all Kite testnet)
- 5 real settled sales on 2 shops (tx hashes in `docs/E2E_LOG.md`, `docs/history.json`); the latest is a live Story A run (simulated buyer limit hit, renegotiated, settled at $22.50 via the final-round rule). Receipts pass all six verify checks on the live site.
- Adversarial suite on live SERV, 45 attacks + 41 benign messages: **0 floor breaches, 0 leaks**. Prompt Guard blocked 73% of attacks and flagged 22% of benign messages (per message over up to 3 replays; 0/16 on a fixed single-call set). Flagged messages get a friendly retry notice (`docs/BENCHMARKS.md`).
- Code-computed final-round rule `R-FINAL-ACCEPT`; lint plus 73 tests in `pnpm check`; a guide for judges to shop with their own agent (`docs/SHOP_WITH_YOUR_AGENT.md`).
- Arena with live rule trace, owner dashboard (English → "what I understood" → 5 simulated haggles → publish), sales ledger, `/llms.txt`.

## Revenue
A **paid firm quote**: a 5-cent testnet fee over x402 to a platform wallet buys a signed 10-minute price (one real paid call in `docs/E2E_LOG.md`), recorded as collected. A 1% platform fee and a per-round quote fee are **accrued, not collected**. Estimated SERV inference cost: about $0.002 per 3-round negotiation (token usage × catalog price; excludes SERV feature surcharges).

## Try it
Arena: https://kitestall.onrender.com/#/arena (try to haggle below the floor) · Shopper agent: `/#/watch` · Open a stall: `/#/owner`.

## Honest limits
Testnet only. **No Kite Passport session was used**: Passport needs the owner's email and passkey and pays mainnet USDC.e, while this shop settles testnet PYUSD. Payments use a labeled dev signer, and Story A's session limit is simulated. Pieverse `/v2/settle` returned `transaction_failed` for our PYUSD authorizations, so settlement used a self-relay fallback (recorded in each receipt). Owner auth is a bearer token. Prompt Guard is non-deterministic. The repo is new; no code reused.
