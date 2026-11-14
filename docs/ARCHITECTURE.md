# Architecture

```
 Shopper agent ──HTTP──► Hono API (Node 24, TypeScript, tsx)
 (CLI / demo)             ├ /negotiate ─► negotiateRound()
                          │     1. sanitize buyer text
                          │     2. SERV call: Prompt Guard + strict JSON schema (+ Multipath)
                          │        blocked → templated refusal, attack event, round not consumed
                          │        error/invalid → deterministic fallback (labeled)
                          │     3. decide(): concession enum → cents, clamps
                          │        (floor, ask-only-down, list, stock, rounds, public max discount)
                          │     4. leak filter on the outgoing message; code appends the numbers
                          ├ /checkout ─► 402 (x402 "exact", eip155:2368, PYUSD, amount = quote in wei)
                          │     X-PAYMENT → payee/amount/asset/nonce checks → quote claimed atomically
                          │     → facilitator.verify (Pieverse) → settle (Pieverse, else self-relay)
                          │     → one DB transaction: stock, order, signed receipt, fees
                          ├ /receipts/:id/verify ─► signature, public rules, price bounds,
                          │     policy hash, on-chain Transfer log, amount/payTo
                          └ SQLite (node:sqlite): shops, items, policies (versioned, hashed),
                            sessions, rounds, quotes, orders, receipts, payments, events, ledger_fees
 Web (Vite + React, plain CSS): Landing · Arena (SSE trace) · Watch (SSE demo shopper) · Owner · Verify
```

## Invariants (all covered by tests)
- `price >= floor`, `price <= previous ask`, `price <= list`, `qty <= stock`, `round <= max_rounds` — `packages/core/src/core.test.ts` (property-based) and the adversarial suite.
- The 402 amount equals the quote total in wei, exactly; `weiToCents` throws on sub-cent amounts.
- Quote single-use (atomic `open → settling` claim), TTL, nonce replay protection, idempotent re-checkout, concurrent-settle test — `apps/api/src/api.test.ts`.
- Settled-but-unfulfilled payments become `needs_reconcile` and surface in the owner ledger.
- `MockSigner` throws in production; the server refuses `MOCK_PAYMENTS` in production.

## Trust model for receipts
The shop signs RFC 8785-canonical receipt JSON with an ed25519 key (public key at `/.well-known/kitestall-keys`). The policy hash is a commitment to the full policy including the private floor and a salt; the floor is never published. A verifier checks the signature, rule ids against the published public policy for that version, price bounds from `max_discount_pct`, the hash, and the on-chain transfer.

## Known limits
Owner auth is one bearer token. Private policy and signing keys sit in SQLite on the server's disk (demo-grade). Fees are accrued, not collected. Passport sessions were not used (see DISCOVERY.md); the demo's session cap is simulated.
