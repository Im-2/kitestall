# KITESTALL — Build Spec for Claude Code

**Tagline:** A storefront agent that haggles within your rules and shows its work.
**Event:** OpenServ SERV Hackathon, Edition 02 — **Track 02: Kite**
**Goal:** Ship a complete, deployed, demoable product that wins on the three published criteria: **creativity, user readiness, revenue potential.**

---

## 0. How to use this document (read first)

You are the builder. This spec is the source of truth. Rules:

1. **Phase 0 comes first.** Several external facts below are marked `TO VERIFY`. Verify them against the live docs and write what you find to `docs/DISCOVERY.md` (with source URLs) before building on them. If reality differs from this spec, reality wins; record the difference and adapt.
2. **Never invent facts, numbers, or results.** Every figure in the README, write-up, landing page and demo must come from a script you ran or a real transaction. Testnet is testnet; say so plainly.
3. **Model proposes, code decides.** No money, price floor, stock, or payment decision is ever made by a model alone.
4. **Work in the phases in section 11.** Each phase has acceptance criteria. Keep something submittable at every phase boundary. Commit often. Never commit secrets.
5. **Ask the human only for:** credentials, funded wallets, hosting accounts, and the human-only tasks in section 12. Everything else, decide and record in `docs/DECISIONS.md`.
6. Use a task list. Last task of every phase: run the tests and verify the acceptance criteria by actually running them.

---

## 1. Product in one paragraph

Every Kite-track project we know of is the **buyer's** agent with a spending leash. Kitestall is the **seller's** side: a small business publishes a price policy in plain English; a **storefront agent** (powered by **SERV Reasoning**) negotiates with *shopper agents* that hold **Kite Agent Passports**; the agreed price is carried in an **x402 `402 Payment Required`** response; the shopper pays on Kite; the shop delivers a booking/voucher and a **signed receipt that lists which policy rules produced the price**, so any agent can verify the quote followed the merchant's published policy. The shopper's Passport session limit protects the buyer; the merchant's floor protects the seller; Kitestall is where the two meet.

### Why this should win (my read; not stated by judges)
- Edition 01 winners each fixed one specific, concrete failure on a brand-new rail, made the money path real and verifiable, put revenue in the product (ASSAY sold answers per call over x402), and let judges try it instantly (Shijima's "free $1, mainnet", Payrun's "try to scam it").
- "Model proposes, code decides" was common among non-winners too, so it is **table stakes**, not a differentiator. Our differentiators: **(a) seller side**, **(b) price lives inside the 402**, **(c) verifiable policy receipts**, **(d) a public Arena where anyone can try to break the floor**, **(e) measured, honest numbers.**

### Criteria mapping
| Criterion | What we show |
|---|---|
| Creativity | Negotiated price inside x402; receipts that cite rule IDs; Arena "haggle below the floor" challenge with live rule trace |
| User readiness | One public URL. Visitor can haggle in the browser in 10 seconds, watch a shopper agent buy live with a real testnet tx, or open their own stall in minutes |
| Revenue potential | Platform fee per settled sale + per-quote fee after a free tier, accrued in a real ledger; unit economics from *measured* SERV cost per negotiation |

---

## 2. Event requirements (verified from openserv.ai/hackathon-2)

- Track 02 (Kite): build agents with verifiable identity and spending limits you control so they can shop, book and pay safely. **Every track must use SERV Reasoning.**
- Judging: creativity, user readiness, revenue potential (no weights; no judges listed).
- Submission: **public code repo**, **demo link or video**, **short write-up** (what it does; how it uses SERV Reasoning; which track), **link to an X post** sharing the submission, submitted via https://openserv.typeform.com/submissions02.
- Need an OpenServ account + API key (https://console.openserv.ai/signup). Registration free; pre-registrants got $5 SERV credits.
- Existing projects allowed only if a meaningful feature is added during the hackathon and explained in the write-up. **Kitestall is new; start the repo fresh.** If any code is reused from the human's earlier projects, say so in the write-up.
- Submissions close **Nov 15, 2026, 23:59 UTC** (hard date; plan a buffer).
- `TO VERIFY`: Edition 01 required enabling data collection at console.openserv.ai/settings/organization for eligibility. Check Edition 02's FAQ/page for the same requirement and tell the human.

---

## 3. External facts: verified vs to-verify

### Kite (from docs.gokite.ai; verified by reading)
- x402 sample service: `https://x402.dev.gokite.ai/api/weather`. Unpaid call returns HTTP 402 with fields including `scheme: "gokite-aa"`, `network: "kite-testnet"`, `maxAmountRequired` (in wei; `1000000000000000000` = 1 token), `asset: 0x0fF5393387ad2f9f691FD6Fd28e07E3969e27e63` (testnet stablecoin "Test USDT"), `payTo`.
- Kite MCP tools: `get_payer_addr` (returns the user's AA wallet address) and `approve_payment` (inputs `payer_addr`, `payee_addr`, `amount`, `token_type`, optional `merchant_name`; returns a signed payload for the `X-Payment` header). Flow: call x402 service → 402 → `approve_payment` → send `X-Payment` → payment executes inside the user's authorized session.
- Sessions: budget limits + expiry; at most one active session per agent; errors include `InsufficientBudget` (payment exceeds session limits), `Unauthorized` (OAuth expired), "Session creation required".
- Service providers receive payments **directly to their own wallet**.
- Portal (testnet, per docs): https://x402-portal-eight.vercel.app/ ; demo facilitators: https://github.com/gokite-ai/x402 ; Service Provider Guide: https://docs.gokite.ai/kite-agent-passport/service-provider-guide .
- Hackathon page's priority open-source repos: `CarryWang/kite-x402-explorer`, `BrKDDD/kite-x402-hono`, `tianzeshi-study/kite-x402-axum`, `gokite-ai/kite_counter_dapp`. **Read `kite-x402-hono` first: our merchant server is Hono.**

### Kite `TO VERIFY`
- **Access.** Docs say Passport is *invitation-only during testnet*; Kite also announced mainnet + Passport "available now" (Apr 30, 2026; https://agentpassport.ai/quickstart/). Determine which path the human's account can use. Community pieces exist: `kpass` CLI, `gokite-aa-sdk` (npm), `@kitepass/mcp-server` (community, mainnet).
- Exact facilitator endpoints (verify/settle), request/response shapes, and the testnet facilitator address (the Service Provider Guide lists them; they were not captured).
- Token decimals (sample suggests 18), explorer base URL for tx links.
- Whether service providers can verify an agent's Passport (valid/active, spending constraints) via an API or header. If yes, use it (record payer + passport status in the receipt). If no, rely on facilitator verification and record the payer address.
- Whether Kite **mainnet** payments work with a facilitator today. If cheap and safe, a tiny real-money mainnet sale is a **stretch** (real money impresses judges); otherwise testnet only, clearly labeled.

### SERV Reasoning (from public sources; partly third-party; verify all)
- OpenAI-compatible endpoint reported as `https://inference-api.openserv.ai/v1`, with SERV features toggled **via the model name** (a builder used `gpt-5.4-mini-serv-kronos-multipath`). Features: **Prompt Guard** (screens inbound prompts and outbound leakage), **Multipath** (conflicting rule sets in one graph), **Shadow Agent** (verifier reviews outputs/decisions), **Kronos** (rewrites prompts; one builder turned it off because it can break JSON parsing), bounded reasoning graphs, schema-forced execution.
- Reported quirks (two builders): structured output **rejects numeric range keywords** in JSON Schema (`minimum`, `maximum`, `exclusiveMinimum`, `exclusiveMaximum`, `multipleOf`; string keywords are fine); requests **without a system message are rejected**; measured latency roughly Prompt Guard ≈ 2.9 s, Shadow Agent ≈ 3.4 s, Multipath ≈ free. A blocked-by-Prompt-Guard prompt must **never** be retried without Prompt Guard.
- **First action:** fetch `https://docs.openserv.ai/llms.txt` and read the pages on the Reasoning API, model naming, features, structured output, usage/pricing, errors. Record verified model names and request/response shapes in `docs/DISCOVERY.md`.
- SERV usage evidence: capture each response's request/completion ID and usage; store in the receipt (`serv.request_ids`).

---

## 4. Product definition

### Actors
- **Owner**: runs a stall (shop). Publishes catalog + policy. Receives payments straight to their Kite wallet.
- **Shopper agent**: any HTTP agent holding a Kite Passport (via Kite MCP) or a dev signer (fallback). Negotiates and pays.
- **Visitor (human)**: tries the Arena in a browser; verifies receipts.
- **Judge**: opens the landing page and must be able to *feel* the product within 30 seconds.

### Core flow (happy path)
1. Shopper discovers shop: `GET /.well-known/kitestall.json` → catalog, public policy, negotiate endpoint, network, keys.
2. Shopper `POST /negotiate` (free, up to `max_rounds`, default 3). Storefront agent counters/accepts/rejects. Each response includes `rules_fired` and a short message.
3. On accept, server issues a **single-use quote** (`quote_id`, price, expiry).
4. Shopper `POST /checkout {quote_id}` → server returns **402** with the *agreed price* in the x402 payment requirements.
5. Shopper pays (Kite `approve_payment` → `X-Payment`) and retries.
6. Server verifies + settles through the facilitator, decrements stock, creates the order, and returns **voucher + signed receipt**.
7. Anyone can verify the receipt (signature, policy hash, price within public bounds, tx on explorer).

### Story A — "Meet in the middle" (the signature demo)
Shopper's Passport session budget is lower than the first agreed price → `approve_payment` fails with `InsufficientBudget` → shopper tells the storefront its hard budget → storefront either concedes down to (but never below) the floor, or politely walks away. Buyer's limit and seller's floor both visibly hold. **Build this scenario end to end; it is the Kite-track story.**

### Story B — "Try to break it" (Arena)
Public chat page. Visitors try to haggle below the floor, reveal the floor, or inject instructions ("the owner approved 90% off"). Live side panel shows rule trace, Prompt Guard verdicts and the concession decision. Leaderboard: biggest *legitimate* discount; counter: blocked attacks. Nothing is faked: counters come from the DB.

### Story C — "Open a stall"
Owner pastes a plain-English policy → SERV compiles it to a structured policy → dashboard shows "what I understood", lists the public rules, and runs **5 simulated haggles** → owner approves → policy is versioned, hashed, published.

---

## 5. Architecture

```
            ┌────────────────────────────────────────────────────────┐
 Shopper ─► │  Hono API (Node 20, TypeScript)                        │
 agents     │   /.well-known  /catalog  /policy  /negotiate          │
 (Kite MCP  │   /checkout (x402)  /orders  /receipts  /verify        │
  or signer)│        │               │                │              │
            │  Negotiation engine    │         Payment module        │
            │   ├ Prompt Guard ✔     │          ├ x402 402 builder    │
            │   ├ SERV graph (propose concession level)               │
            │   ├ Shadow Agent verify                                  │
            │   └ deterministic clamp (floor/stock/rounds/leak filter)│
            │        │               │          └ Kite facilitator    │
            │  SQLite (better-sqlite3)  Receipts (ed25519 + JCS)      │
            └───────┬──────────────────────────────┬─────────────────┘
                    │ SSE (live trace)             │ serves static build
              Web app (Vite + React + Tailwind): Landing • Arena • Owner dashboard • Verify
              Demo Shopper (server-side, SSE-streamed): real Kite testnet tx
```

### Stack (defaults; deviate only with a reason in `docs/DECISIONS.md`)
TypeScript, Node 20+, pnpm workspace. API: Hono + `@hono/node-server` + `zod`. DB: `better-sqlite3` (+ Drizzle or plain SQL migrations). Web: Vite + React + Tailwind. Tests: Vitest + `fast-check`. Crypto: `@noble/ed25519` (or Node crypto) + JSON canonicalization (RFC 8785 / `canonicalize`). Chain: `viem` for reads/explorer checks; Kite specifics per discovery. One Dockerfile serving API + built web.

### Repo layout
```
kitestall/
  apps/api/        # Hono server
  apps/web/        # React app
  packages/core/   # money, policy schema, engine, receipts (pure, heavily tested)
  packages/shopper/# shopper agent + PaymentSigner implementations + CLI
  scripts/         # seed, e2e:kite, bench, adversarial, verify-receipt
  docs/            # DISCOVERY, DECISIONS, SERV_NOTES, BENCHMARKS, ARCHITECTURE, WRITEUP, DEMO_SCRIPT, X_POST
  README.md  LICENSE(MIT)  Dockerfile  .env.example
```

---

## 6. Detailed specifications

### 6.1 Money (get this exactly right)
- Internal prices: **integer cents** (USD-equivalent, token treated 1:1 with USD for the demo; state this assumption in the README).
- Chain amounts: **BigInt** wei. `wei = cents * 10^(decimals-2)`; verify decimals in Phase 0. Never use floats for money. Round **against the buyer only on display, never on settlement**: the 402 amount must equal the quote price exactly.
- Property-test every conversion.

### 6.2 Policy model (`PolicySpec v1`, zod-validated)
```ts
PolicySpec = {
  shop_id, version, created_at,
  public: {
    max_discount_pct,           // public upper bound on any discount vs list (enables verifiable receipts)
    rules: [{ id: "R-VOL-10", kind: "volume_tier"|"bundle"|"loyalty"|"time_window"|"cap", text, params }],
    persona: "firm"|"friendly"|"flexible",
    max_rounds, quote_ttl_seconds
  },
  private: {                    // NEVER sent to a model, NEVER logged to clients
    floor: { default_pct_of_list, per_item?: {item_id: cents} },
    salt
  }
}
policy_hash = sha256(JCS(full policy incl. private + salt))
```
- Public policy is served at `/policy` with `policy_hash`, `version`, shop signature. Private parameters are never exposed; the hash is a **commitment**. The owner may reveal the policy for audit.
- **Compile from English:** SERV (graph) extracts text → `PolicySpec` draft. Validate with zod; on failure, show errors and the raw text. The owner must **approve** before publish. Show "what I understood" as a human list and run 5 simulated haggles (using the deterministic engine + SERV) as a preview.

### 6.3 Negotiation engine (the core)
**Design principle: the model never sees the floor, and never outputs a price.** It chooses a *concession level* from an enum and writes a short message. Code converts the level to a price and enforces every rule.

Inputs to the model (system + user): persona, **public** rules, item name, list price, current ask, buyer's last offer, round number / rounds left, a *sanitized* buyer message. Not included: floor, cost, salt, policy internals.

Model output (JSON Schema; **no numeric range keywords**; enums + strings only):
```
{ "action": "counter"|"accept_offer"|"hold"|"reject_final"|"ask_clarification",
  "concession": "none"|"tiny"|"small"|"medium"|"large",
  "rule_ids": ["R-..."],           // must be subset of public rule ids (code verifies)
  "message": "<=280 chars, no numbers except those the code will insert" }
```
Deterministic post-processing (`packages/core/engine.ts`), in order:
1. **Prompt Guard verdict** recorded. If blocked → no model call for that message; respond with a templated refusal, log an attack event. Never retry the same text without Prompt Guard.
2. Concession → price: fraction of *remaining headroom* (`ask − floor`): tiny 10%, small 25%, medium 50%, large 75%. Headroom measured against the private floor in code only.
3. **Clamps:** `price ≥ floor`; `price ≤ current_ask` (**no price creep** — asks only go down); `price ≤ list`; `qty ≤ stock`; `round ≤ max_rounds` (final round = "best and final"); `price ≥ list × (1 − public.max_discount_pct)`.
4. `accept_offer` honored only if buyer's offer ≥ floor margin; if offer ≥ current ask → accept **at the ask** (never take more than asked).
5. **Leak filter:** the outgoing message may contain only numbers equal to the quoted price/list/qty/dates the code inserts. Any other numeric token, or any string matching the floor/cost/salt/"floor"/"minimum price" patterns → replace message with a template. Also scrub system-prompt echoes.
6. **Shadow Agent** verifies that the structured output obeys the schema and the public rules; on failure regenerate (≤2) then fall back to the deterministic formula (`fallback_engine`) and set `serv_status: "fallback"` in the trace. **Never claim SERV decided when it did not.**
7. Emit `rules_fired` (e.g. `R-VOL-10`, `R-ROUND-CAP`, `R-FLOOR-OK`, `R-STOCK-OK`, `R-PG-CLEAN`), `serv` metadata (model, features, request ids, latency, tokens/cost), and persist the round.

**SERV feature usage (document honestly in `docs/SERV_NOTES.md`):**
- **Prompt Guard:** always on for every buyer-authored string (messages, item notes, buyer name/memo).
- **Multipath:** persona and conflicting rule sets (e.g. volume tier vs. loyalty vs. time window) in one graph.
- **Shadow Agent:** verification of each decision.
- **Graph / schema-forced execution:** policy compile and negotiation decisions.
- **Kronos:** test on/off; keep it **off** wherever we parse JSON unless tests show it is safe. Record the experiment.
- Measure latency and cost per negotiation (p50/p95) in `scripts/bench`; use only measured numbers in the write-up. Budget: a 3-round negotiation must feel responsive (stream partial UI state: "checking message…", "deciding…").
- Support `SERV_MODE=live|fallback_only` for tests; production demo must be `live`.

### 6.4 Payments: x402 on Kite
- `/shops/:shop/checkout`:
  - No `X-Payment` → **402** with Kite-compatible requirements: scheme/network/asset/`payTo` (shop wallet)/`maxAmountRequired` = **quote price in wei** (exact), plus a human-readable `description` and `quote_id`. Follow the exact JSON shape from the Kite sample + `kite-x402-hono` (Phase 0).
  - With `X-Payment` → call the facilitator verify, then settle; on success fulfill atomically (DB transaction: mark quote consumed, decrement stock, create order + receipt). Return 200 with voucher + receipt.
- **Rules:** quote single-use; expires; payment amount must equal quote amount; `payTo` must equal the shop wallet; idempotency key per `quote_id`; replay protection (unique tx hash / nonce); if settle succeeds but fulfillment fails, mark `needs_reconcile` and expose it in the dashboard (never silently lose a payment).
- **PaymentSigner interface (shopper side):**
  - `KiteMcpSigner` (preferred): Kite MCP `get_payer_addr` + `approve_payment` (via MCP client or `kpass`).
  - `KiteAaSdkSigner` (fallback): `gokite-aa-sdk` dev signer. If used for the demo, **label it honestly** in the UI/README ("dev signer, no Passport session").
  - `MockSigner` (tests only; guarded by `NODE_ENV=test`; the server refuses `MOCK_PAYMENTS` in production).
- Optional (if Kite exposes it): verify the agent's Passport status and record `passport_status` in the receipt.
- Stretch: one tiny real-money mainnet sale if verified safe and supported. Record decision in `docs/DECISIONS.md`.

### 6.5 Receipts (the verifiability hook)
```json
{
  "receipt_id": "...", "shop_id": "...", "item": {"id":"...","qty":1},
  "list_price_cents": 0, "agreed_price_cents": 0, "rounds": 2,
  "rules_fired": ["R-VOL-10","R-FLOOR-OK","R-STOCK-OK","R-PG-CLEAN"],
  "policy": {"version": 3, "hash": "sha256:..."},
  "serv": {"model":"...","features":["prompt_guard","multipath","shadow"],"request_ids":["..."],"status":"live"},
  "payment": {"network":"kite-testnet","tx_hash":"0x...","payer":"0x...","pay_to":"0x...","amount_wei":"..."},
  "issued_at": "ISO-8601", "signature": "ed25519:..."
}
```
- Sign the RFC 8785 canonical JSON (without `signature`) with the shop's ed25519 key. Public key at `/.well-known/kitestall.json` and `/.well-known/kitestall-keys`.
- **Verifier** (`/verify` page, `GET /receipts/:id/verify`, and `scripts/verify-receipt`): checks (1) signature, (2) every `rules_fired` public id exists in the published public policy of that version, (3) `agreed ≤ list` and `agreed ≥ list × (1 − max_discount_pct)`, (4) payment tx exists on the Kite explorer with matching amount/payTo (when the explorer API is available), (5) policy hash matches the published hash. It must **not** require the private floor. Show each check as ✓/✗.

### 6.6 API reference (all JSON; zod-validated; consistent error shape `{error:{code,message}}`)
| Method & path | Purpose |
|---|---|
| `GET /.well-known/kitestall.json` | Discovery manifest (shop list, endpoints, network, asset, keys) |
| `GET /llms.txt` | Agent-readable how-to (curl + MCP examples) |
| `GET /shops/:shop/catalog` | Items, list price, stock (no floors) |
| `GET /shops/:shop/policy` | Public policy + hash + version + signature |
| `POST /shops/:shop/negotiate` | `{session_id?, item_id, qty, offer_cents?, message?}` → `{session_id, round, status: counter\|accepted\|rejected\|clarify, ask_cents, quote?, message, rules_fired, serv}` |
| `POST /shops/:shop/checkout` | `{quote_id}` → 402 / 200 as above |
| `GET /orders/:id`, `GET /receipts/:id` | Fetch order/receipt |
| `GET /receipts/:id/verify` | Server-side verification report |
| `GET /api/stats` | Real aggregate stats from DB (negotiations, blocked attacks, avg discount, settled sales, SERV latency/cost) |
| `GET /api/arena/leaderboard`, `GET /api/arena/attacks` | Arena data (redacted) |
| `GET /api/trace/:session/stream` | SSE live decision trace |
| Owner (token-protected): `POST /owner/shops`, `PUT /owner/shops/:id/catalog`, `POST /owner/policy/compile`, `POST /owner/policy/preview`, `POST /owner/policy/publish`, `GET /owner/ledger`, `GET /owner/negotiations` | Dashboard backend |
Owner auth for the demo: bearer `OWNER_TOKEN` from env (state limitation in README). Rate-limit all public endpoints per IP/session.

### 6.7 Data model (SQLite)
`shops`, `items`, `policies` (versioned; hash; public JSON; encrypted-or-env-referenced private JSON), `sessions`, `rounds` (messages, decisions, rules, serv metadata), `quotes` (single-use, ttl), `orders`, `receipts`, `payments` (tx hash unique), `events` (attacks/blocks/fallbacks), `ledger_fees`, `leaderboard`. Include migrations and a `pnpm seed` that is idempotent.

### 6.8 Web app (design with intent, not a template)
- **Look:** a market-stall / ledger aesthetic: warm paper tones, ink-black type, stamp-style status chips, monospaced receipts, a "tally strip" along the top showing live stats. Distinctive and legible; accessible contrast; mobile-friendly. Avoid generic SaaS gradients.
- **Landing (`/`)**: one-line pitch; live stats (from `/api/stats` only); three big actions — **Haggle in the Arena**, **Watch a shopper agent buy (real testnet tx)**, **Open your stall**; "run your own shopper" snippet; how SERV and Kite are used in 4 bullets; link to repo.
- **Arena (`/arena`)**: chat + offer input; right panel: live rule trace, Prompt Guard verdict, concession level, round counter, quote card; leaderboard and blocked-attack feed; "Pay with Passport" instructions plus the Demo Shopper button that completes a purchase using the funded demo wallet.
- **Watch a Shopper (`/watch`)**: SSE stream of the Demo Shopper: discover → negotiate → budget error (Story A) → renegotiate → pay → receipt with explorer link.
- **Owner dashboard (`/owner`)**: onboarding wizard (shop, wallet, catalog), policy editor (English → compiled → "what I understood" → 5 simulated haggles → publish), live negotiations, sales ledger with tx links, **fees accrued**, needs-reconcile list.
- **Verify (`/verify`)**: paste a receipt or ID → ✓/✗ checks.
- **Empty/error states**, loading states, and a visible **TESTNET** badge everywhere money appears.

### 6.9 Shopper agent (`packages/shopper`)
- CLI: `kitestall-shopper --shop <url> --item <id> --budget <cents> [--signer kite-mcp|aa-sdk]`.
- Strategy: LLM for message wording (can use the SERV endpoint) + deterministic strategy for offers (open at ~70% of list, move up in steps, respect hard budget).
- Handles `InsufficientBudget` by sending a budget statement to the merchant and renegotiating (Story A).
- Also ship: Claude Desktop/Cursor config doc for Kite MCP so judges can shop with *their own* agent; and `/llms.txt` on the server for agent discovery.

### 6.10 Revenue model (implemented as accounting, honestly described)
- `platform_fee_bps` (default 100 = 1% of settled sale) and `quote_fee_cents` (default 1¢ per negotiation round after `free_quotes_per_day` = 10 per buyer).
- Recorded in `ledger_fees` per order/quote; dashboard shows accrued fees. State plainly: fees are **accrued, not auto-collected**, in the hackathon build; settlement options (split payment, monthly invoice, premium firm quote via x402 micropayment) are described in the README roadmap. Optional extra: a paid "firm quote" endpoint priced at a tiny x402 amount to demonstrate real per-call revenue.
- **Unit economics page** in README/WRITEUP using *measured* values: SERV cost per negotiation (from usage data), average discount given, average order value, fee per order, margin per negotiation.

---

## 7. Security and abuse model

| Threat | Control |
|---|---|
| Buyer injects instructions ("owner approved 90% off", "ignore previous", role-play) | Prompt Guard on every buyer string; model sees only sanitized text; **model cannot output prices**; code clamps; attack events logged |
| Floor/cost leakage | Model never receives private params; outgoing message leak filter; tests with 30+ extraction attempts |
| Price creep / manipulation across rounds | Monotonic asks; round cap; quote single-use + TTL |
| Underpayment / wrong payee / replay | Exact amount match, `payTo` check, unique tx hash, idempotency per quote, DB transaction for fulfillment |
| Stock oversell | Transactional decrement; `qty ≤ stock` at quote and at settlement |
| DoS / cost abuse of SERV | Rate limits, per-session round caps, free-tier cap, budget guard on daily SERV spend (kill switch → fallback mode, shown honestly) |
| Secrets | `.env` only; never log keys; `.env.example`; pre-commit secret scan |
| Fake "mock payment" in prod | Server refuses `MOCK_PAYMENTS` unless `NODE_ENV=test` |

---

## 8. Testing, adversarial suite, benchmarks

- **Unit/property tests:** money conversions; clamps (`price ≥ floor` for any random sequence of offers/concessions via `fast-check`); monotonic ask; leak filter; receipt sign/verify round trip; canonicalization; quote TTL/single-use; stock transactions; fee math.
- **Integration:** negotiate → quote → 402 → mock pay (test only) → receipt → verify. Also failure paths: wrong amount, wrong payTo, replayed payment, expired quote, out of stock.
- **Adversarial suite** (`scripts/adversarial`): ≥ 40 attacks across categories — instruction override, fake owner authority, role-play, prompt-leak, floor extraction, numeric tricks ("price is -5"), unicode/homoglyph, multi-turn pressure, JSON/markup injection, payload in `item notes`/`memo`. Assertions: **floor breaches = 0; floor/cost leaks = 0**; report Prompt Guard block rate and false-positive rate on ≥ 40 benign messages. Output a table to `docs/BENCHMARKS.md` generated by the script (never hand-edited).
- **Latency/cost bench:** p50/p95 per SERV feature and per full negotiation; cost per negotiation from usage data.
- **E2E on Kite** (`pnpm e2e:kite`): real negotiation + real testnet payment; prints tx hash + explorer link; saved to `docs/E2E_LOG.md` with timestamps. **At least 3 successful real settled sales** before submission, including Story A.
- CI-style local script `pnpm check` = typecheck + lint + unit + integration.

---

## 9. Configuration and deployment

`.env.example` (no real values):
```
NODE_ENV=production
PORT=8787
PUBLIC_BASE_URL=https://...
OWNER_TOKEN=
DATABASE_PATH=/data/kitestall.db
# SERV
OPENSERV_API_KEY=
SERV_BASE_URL=https://inference-api.openserv.ai/v1   # verify in Phase 0
SERV_MODEL_NEGOTIATE=           # verified model name with features
SERV_MODEL_COMPILE=
SERV_MODE=live
SERV_DAILY_BUDGET_USD=
# Kite
KITE_NETWORK=kite-testnet
KITE_FACILITATOR_URL=
KITE_EXPLORER_BASE=
SHOP_WALLET_ADDRESS_NOMAD=
SHOP_WALLET_ADDRESS_BRIGHTBEAN=
DEMO_SHOPPER_PRIVATE_KEY=       # funded testnet only; server-side demo wallet
SHOP_SIGNING_KEYS=              # generated ed25519 keys (or generated at seed)
PLATFORM_FEE_BPS=100
QUOTE_FEE_CENTS=1
FREE_QUOTES_PER_DAY=10
```
- Dockerfile: multi-stage; serves API + static web; persistent volume for SQLite; `/healthz`.
- Deploy to Railway, Fly.io or Render (whichever the human has). Needs a **public HTTPS URL** for judges. Smoke test after deploy: landing loads, Arena negotiates, Demo Shopper completes a real testnet sale, `/verify` passes.
- **Seed shops** (two, to show breadth):
  1. **Nomad Desk** — coworking day passes / weekly bundle (perishable inventory; time-window + bundle rules; persona "friendly").
  2. **Brightbean Roasters** — coffee beans by the kg (volume tiers; loyalty; persona "firm").
  Realistic catalogs and policies written in plain English, compiled through the real SERV compile path.
- `pnpm demo:reset` returns the demo to a clean, repeatable state without touching real tx history.

---

## 10. Documentation and submission deliverables

Produce all of these (the write-up is judged):
1. **README.md**: what/why (3 lines); screenshot/GIF; 60-second quickstart; architecture diagram; **"How we use SERV Reasoning"** (each feature, why, honest notes, measured latency/cost); **"How we use Kite"** (Passport sessions, x402, facilitator, which signer was used for the demo); security model; revenue model + measured unit economics; verify-a-receipt guide; limitations (testnet, accrued fees, demo owner auth); roadmap.
2. **docs/DISCOVERY.md, DECISIONS.md, SERV_NOTES.md, ARCHITECTURE.md, BENCHMARKS.md (generated), E2E_LOG.md.**
3. **docs/WRITEUP.md** — the submission text: *What it does* / *How it uses SERV Reasoning* / *Track: 02 Kite* / *What's new and working* / *Revenue* / *Try it* (links) / *Honest limits*. ≤ 500 words, scannable, numbers only from `BENCHMARKS.md` and `E2E_LOG.md`.
4. **docs/DEMO_SCRIPT.md** — a 90-second video storyboard: (0–10s) pitch line + landing; (10–30s) Arena: haggle, a blocked injection attempt with the live trace; (30–60s) Demo Shopper: negotiate → budget limit hit → renegotiate → real testnet payment; (60–80s) receipt + `/verify` ✓✓✓; (80–90s) revenue/fees + repo URL. Record at 1080p; captions on. Provide shot list and exact URLs/commands.
5. **docs/X_POST.md** — 3 draft posts (single hook line first; what it is; the "try to haggle below the floor" CTA; demo video; repo; tag **@openservai**; hashtags `#BuildonSERV #SERV`). Needed for the submission form.
6. **Submission checklist** in `docs/SUBMISSION.md`: repo public ✓, license ✓, no secrets ✓, demo URL live ✓, video uploaded ✓, write-up ✓, X post URL ✓, form submitted ✓ (https://openserv.typeform.com/submissions02).

---

## 11. Build phases with acceptance criteria

**Phase 0 — Discovery & smoke tests (do first)**
- Read `docs.openserv.ai/llms.txt` + Reasoning API pages; Kite Service Provider Guide, Developer Guide, `gokite-ai/x402`, `kite-x402-hono`.
- Smoke tests: (a) one successful SERV chat completion with a system message + strict JSON; (b) Prompt Guard blocks a known injection and passes a benign message; (c) unpaid call to the Kite weather sample shows the 402 JSON; (d) identify the facilitator verify/settle endpoints; (e) determine Passport/signer path.
- ✅ `docs/DISCOVERY.md` lists verified facts + differences from this spec + chosen signer path; scripts for (a)–(c) are saved and re-runnable.

**Phase 1 — Core (pure, tested)**
- Money, `PolicySpec`, deterministic fallback engine, clamps, leak filter, receipts sign/verify.
- ✅ Property tests prove `price ≥ floor`, monotonic ask, no leaks; receipt round trip passes.

**Phase 2 — SERV integration**
- Prompt Guard, structured decisions (enum schema), Shadow Agent verification, policy compile, preview simulation; fallback path; metrics capture.
- ✅ Adversarial suite: floor breaches 0, leaks 0; bench produces latency/cost; `SERV_NOTES.md` documents quirks found.

**Phase 3 — x402 checkout on Kite + receipts**
- 402 builder, facilitator verify/settle, atomic fulfillment, replay/idempotency, reconcile state.
- ✅ `pnpm e2e:kite` completes a **real testnet payment** and returns a receipt that verifies ✓ on all checks.

**Phase 4 — API + Web**
- All endpoints; Landing, Arena (with SSE trace), Owner dashboard, Verify page; owner token auth; rate limits.
- ✅ A human can haggle in the browser, publish a policy, see a ledger entry, and verify a receipt without touching a terminal.

**Phase 5 — Shopper agent + Story A**
- Shopper CLI, signers, Demo Shopper stream, budget-limit renegotiation; Claude Desktop/Cursor MCP doc.
- ✅ Story A runs end to end with a real `InsufficientBudget` (or, if Passport sessions are unavailable, a simulated session cap clearly labeled as such) and a real settled sale.

**Phase 6 — Deploy + polish**
- Docker, deploy, seed, `demo:reset`, TESTNET badges, empty/error states, accessibility pass, mobile pass, `pnpm check` green.
- ✅ Public HTTPS URL passes the post-deploy smoke test; 3+ real settled sales logged in `E2E_LOG.md`.

**Phase 7 — Submission assets**
- README, WRITEUP, BENCHMARKS (generated), DEMO_SCRIPT, X_POST, SUBMISSION checklist.
- ✅ Every number in docs traces to a script/log; a new reader understands the product in 30 seconds.

**Stretch (only after Phase 7):** tiny real-money mainnet sale (if verified safe); paid firm-quote x402 micropayment; passport verification on the merchant side; a third seed shop; owner-side "explain this price" view.

**Fallback rules:** if Passport access is blocked, ship Story A with the `KiteAaSdkSigner`, label it honestly, and keep trying the Passport path. If Kite facilitator calls are flaky, add retries + reconcile state; do not fake settlement. If SERV is down, fallback mode must be visibly labeled and excluded from SERV claims.

---

## 12. Human-only tasks (surface these to the human early, in one checklist)

1. OpenServ account + **API key** (https://console.openserv.ai/signup); check the data-collection setting (console.openserv.ai/settings/organization) if the event requires it.
2. Kite: create a Portal/Passport account (testnet portal and/or agentpassport.ai); request an invite in Kite's Discord if needed; get testnet tokens from the faucet; create an agent + session; fund **three testnet wallets**: shop payTo (×2), demo shopper.
3. Hosting account (Railway / Fly / Render) and a domain if desired.
4. Record the demo video; post on X (tag @openservai); submit the form (https://openserv.typeform.com/submissions02) **before Nov 15 23:59 UTC**.
5. Provide any credentials via `.env` locally; never paste secrets into chat or commit them.

---

## 13. Honesty rules and non-goals

- Testnet means testnet: badge it, say it, do not imply mainnet or real revenue. Fees are *accrued*, not collected, unless you actually implement collection.
- Do not claim SERV decided something when the fallback did. Do not claim Passport enforcement if the dev signer was used.
- Do not hand-write benchmark numbers. Do not fabricate leaderboard entries, stats, testimonials or transactions.
- Non-goals: KYC/compliance, fiat, multi-currency, real inventory integrations, production-grade owner auth, a mobile app.

## 14. Definition of done (the "we win" checklist)

- [ ] Public HTTPS URL; landing makes sense in 30 seconds; live stats are real
- [ ] Arena: visitor can haggle, see rule trace, get blocked on injection
- [ ] Demo Shopper: real Kite testnet tx, with budget-limit renegotiation (Story A)
- [ ] Receipts verify ✓ (signature, public rules, price bounds, tx, policy hash) without revealing the floor
- [ ] Adversarial report: floor breaches = 0, leaks = 0; latency/cost measured
- [ ] SERV used for real (Prompt Guard, Multipath, Shadow, graph); usage evidence in receipts
- [ ] Owner can open a stall from plain English in minutes
- [ ] Fees ledger + unit economics from measured data
- [ ] README, write-up, demo video, X post, submission form all complete
- [ ] `pnpm check` green; no secrets in the repo; MIT license
