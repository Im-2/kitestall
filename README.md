# Kitestall

**A storefront agent that haggles within your rules, and shows its work.**

Most Kite agents are the *buyer's*. Kitestall is the *seller's*: a shop publishes a price policy, a SERV Reasoning agent negotiates with shopper agents, the agreed price rides inside an x402 `402 Payment Required`, and every sale ends with an ed25519-signed receipt that cites the public rules that produced the price, verifiable without the private floor.

> **Everything here is Kite TESTNET.** No real money. Fees are accrued in a ledger, not collected. OpenServ SERV Hackathon Edition 02, **Track 02: Kite**.

- Repo: https://github.com/Im-2/kitestall · Live demo: `<DEPLOY_URL>` (fill in after the Render deploy)
- Proof it works: [docs/E2E_LOG.md](docs/E2E_LOG.md) (real testnet settlements, tx hashes, verify results) · [docs/BENCHMARKS.md](docs/BENCHMARKS.md) (generated: adversarial suite, latency, cost)

## 60-second quickstart
```bash
pnpm install
cp .env.example .env        # add OPENSERV_API_KEY, wallets (see scripts/gen-wallets.mjs), OWNER_TOKEN
node scripts/gen-wallets.mjs   # generates 3 testnet wallets into .env (prints addresses only)
pnpm build && pnpm start       # http://localhost:8787  (API + web, seeds two shops)
pnpm check                     # typecheck + unit + integration tests
```
Fund the demo shopper with testnet KITE from https://faucet.gokite.ai (reCAPTCHA, manual), then `node scripts/claim-token.mjs` (self-claims 10 testnet PYUSD per call). Run a real purchase:
```bash
pnpm e2e:kite http://localhost:8787 plain nomad day-pass
pnpm e2e:kite http://localhost:8787 story-a          # buyer limit vs seller floor
pnpm verify-receipt http://localhost:8787 <receipt_id>
```

## Architecture
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). Core rule: **the model proposes, code decides.**
```
shopper ─► /negotiate ─► Prompt Guard + SERV (concession enum, message) ─► decide() clamps ─► leak filter
        ─► quote ─► /checkout → 402 (price in wei) → X-PAYMENT → verify → settle → receipt (signed)
```

## How we use SERV Reasoning
Details and honest caveats in [docs/SERV_NOTES.md](docs/SERV_NOTES.md).
- **Prompt Guard** on every buyer-authored string; a block never advances the round and is never retried without the guard.
- **Strict JSON schema** (enums + strings only): the model picks `action` and `concession` (none/tiny/small/medium/large) and writes a short message. It never sees the floor and never outputs a price.
- **Multipath** (`-serv-multipath`) for persona plus competing public rules.
- **Shadow Agent** is implemented behind `SERV_SHADOW=1` but **off by default** (it roughly doubled latency in our bench; code-side validation already enforces every rule).
- **Kronos** was not successfully benchmarked; not used.
- **Policy compile**: plain English → structured draft, zod-validated, owner approves after 5 simulated haggles.
- Every receipt records SERV request ids and whether each round was `live` or `fallback`. Fallback rounds are labeled and never claimed as SERV decisions.

## How we use Kite
- **x402**: `/checkout` returns a 402 whose `amount` is exactly the quote in wei (testnet **PYUSD**, 18 decimals, chain `eip155:2368`). The shopper signs an EIP-3009 `transferWithAuthorization`; the server checks payee/amount/asset/nonce, calls the **Pieverse facilitator** `/v2/verify`, then settles.
- **Honest finding:** Pieverse `/v2/settle` returned `transaction_failed` for every PYUSD authorization we tried (details in [docs/DISCOVERY.md](docs/DISCOVERY.md)). So the server falls back to **self-relay**: it submits the signed `transferWithAuthorization` itself (gas paid by the relayer). Receipts record `settled_via`. All three recorded sales settled via self-relay.
- **Signer used: dev signer** (a funded testnet EOA). **No Kite Passport session was used**, so Passport enforcement is *not* claimed. Story A's "session limit" is a **simulated** per-transaction cap enforced by the dev signer, labeled as such in the UI and logs. The signer sits behind a `PaymentSigner` interface so a `kpass`/Passport signer can be plugged in.

## Security model
| Threat | Control |
|---|---|
| Injection ("the owner approved 90% off") | Prompt Guard on every buyer string; model cannot output prices; code clamps |
| Floor/cost leakage | Model never receives private params; outgoing messages pass a leak filter (numbers must equal code-inserted values; forbidden terms replaced) |
| Price creep | Asks only go down; round cap; quote single-use + TTL |
| Underpay / wrong payee / replay | Exact wei match, payTo check, nonce uniqueness, atomic quote claim, one DB transaction for fulfilment, `needs_reconcile` state |
| Oversell | Transactional stock decrement |
| SERV cost abuse | Per-IP rate limits, round and session caps, daily budget guard that switches to labeled fallback |
| Secrets | `.env` only (gitignored); `.dockerignore` excludes it |

**Adversarial results** (live SERV, see BENCHMARKS.md for the generated table): 45 attacks and 41 benign messages replayed for up to 3 rounds each: **0 floor breaches, 0 leaks**. Prompt Guard blocked 73% of attacks, with a **22% false-positive rate** on benign messages (it is also non-deterministic). The rest is contained by code, not by the guard.

## Revenue model (accounting only)
`platform_fee_bps` = 100 (1% of settled sales) and `quote_fee_cents` = 1 after 10 free rounds/day per buyer, written to `ledger_fees` and shown in the owner dashboard. **Accrued, not auto-collected.** Measured inputs: SERV inference cost per negotiation ≈ **$0.002** (estimate: token usage × catalog price; excludes SERV feature surcharges), see BENCHMARKS.md. Settlement options (split payment, invoice, paid firm quotes via x402) are roadmap.

## Verify a receipt
`/#/verify`, `GET /receipts/:id/verify`, or `pnpm verify-receipt <base> <id>`. Checks: signature, every rule id exists in the published policy for that version, price within public bounds, policy hash, on-chain Transfer to payTo for the exact amount.

## Free-tier limits (Render free plan, no disk)
- **Cold start:** a free web service spins down after ~15 minutes without inbound traffic; the next request waits about a minute while Render wakes it (Render shows a loading page). Our own boot is fast (seeding + history import took ~50 ms locally; the Docker image runs `node --import tsx`, no pnpm at runtime), so almost all of the wait is Render's.
- **Ephemeral data:** the free plan has no persistent disk and Render may restart a free service at any time. SQLite lives in `/tmp`. On **every boot** the server re-seeds the two shops, catalogs and published policies, and re-imports our **real** settled testnet sales from the committed `docs/history.json` (rows copied verbatim by `scripts/export-history.ts`: orders, signed receipts, payments with tx hashes, quotes, rounds). **Sales, negotiations and quotes made on the live site after a boot are lost on the next restart** (they stay visible only until then). Stats and Verify work immediately after a cold start because they are computed from the re-imported rows.
- **Receipts stay verifiable** because each one is self-contained and signed: it carries the price, rule ids, policy version and hash, SERV request ids and the on-chain tx hash, signed with an ed25519 key read from `SHOP_SIGNING_KEYS` (same key on every boot). `/verify` accepts a pasted receipt JSON, checks the signature against the shop's public key and the on-chain Transfer on Kite testnet, and needs no database row. Historic policies are kept as inactive rows with their public part and hash; the live policy is a newer version with a fresh salt.
- **Keeping it awake for judging:** ping `/healthz` every 5 minutes with a free uptime monitor (see docs/SUBMISSION.md). 750 free instance hours/month covers one always-on service (744 h).

## Limitations
Testnet only. Passport/kpass not used. Pieverse settle failing (self-relay used). Owner auth is a single bearer token; private policy and signing keys live in SQLite on the server. Seed floors in `packages/core/src/seed.ts` are public demo defaults (deployments get random salts and can override floors via `FLOOR_PCT_<SHOP>`), so the Arena tests the model/API path, not secrecy of those defaults. Prompt Guard false positives (~22% in our run) can block benign buyers; they cost no round. Live-site data is ephemeral on the free plan (see Free-tier limits). SERV credits are finite: when exhausted the shop runs in labeled fallback mode.

## Roadmap
Passport signer via `kpass`; real fee collection (split payment); third seed shop; paid firm-quote endpoint over x402; merchant-side Passport verification when an API exists.

## Reuse disclosure
This is a new repo created during the hackathon. No code was reused from earlier projects.

License: MIT
