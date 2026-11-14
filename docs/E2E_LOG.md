# E2E log (Kite TESTNET) — appended by `scripts/e2e-kite.ts`; never hand-edited

## 2026-11-14T12:53:53.210Z — scenario `plain` — nomad/day-pass — FAILED: payment

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session)
- Rounds: 6; Prompt Guard blocks: 1; SERV statuses: live, blocked

## 2026-11-14T12:54:49.510Z — scenario `plain` — nomad/day-pass — FAILED: payment

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session)
- Rounds: 6; Prompt Guard blocks: 1; SERV statuses: blocked, live

## 2026-11-14T12:55:11.099Z — scenario `plain` — nomad/day-pass — FAILED: negotiate

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session)
- Rounds: 0; Prompt Guard blocks: 0; SERV statuses: 

## 2026-11-14T12:55:55.711Z — scenario `plain` — nomad/day-pass — SETTLED

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session)
- Rounds: 3; Prompt Guard blocks: 0; SERV statuses: live
- Agreed unit price: 2219 cents (list 2500)
- Receipt: rc_40356fd647b3; settled via: self-relay
- Tx: 0xf5e8803995ab92ee391128982904d13be7459af8f9df23fcee00a7cdf53700e1
- Explorer: https://testnet.kitescan.ai/tx/0xf5e8803995ab92ee391128982904d13be7459af8f9df23fcee00a7cdf53700e1
- Verify: signature ✓, rules_in_public_policy ✓, price_bounds ✓, policy_hash ✓, payment_tx_onchain ✓, amount_matches_price ✓

## 2026-11-14T12:56:22.833Z — scenario `story-a` — nomad/day-pass — FAILED: no_agreement

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session) (SIMULATED per-tx session cap 2125 cents, enforced by the dev signer, not by Kite Passport)
- Session-limit error hit (simulated): requested 2450c > cap 2125c → shopper renegotiated
- Rounds: 5; Prompt Guard blocks: 1; SERV statuses: live, blocked

## 2026-11-14T12:57:15.243Z — scenario `story-a` — nomad/day-pass — SETTLED

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session) (SIMULATED per-tx session cap 2125 cents, enforced by the dev signer, not by Kite Passport)
- Session-limit error hit (simulated): requested 2450c > cap 2125c → shopper renegotiated
- Rounds: 6; Prompt Guard blocks: 1; SERV statuses: live, blocked
- Agreed unit price: 2125 cents (list 2500)
- Receipt: rc_72290a7fb3e9; settled via: self-relay
- Tx: 0xe09c50f624f8f808d9546bba7cc9fac83df3a9ccdcd7aae429f17a979a7f8c29
- Explorer: https://testnet.kitescan.ai/tx/0xe09c50f624f8f808d9546bba7cc9fac83df3a9ccdcd7aae429f17a979a7f8c29
- Verify: signature ✓, rules_in_public_policy ✓, price_bounds ✓, policy_hash ✓, payment_tx_onchain ✓, amount_matches_price ✓

## 2026-11-14T13:04:32.992Z — scenario `plain` — brightbean/house-blend-1kg — SETTLED

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session)
- Rounds: 3; Prompt Guard blocks: 0; SERV statuses: live
- Agreed unit price: 2889 cents (list 3200)
- Receipt: rc_4af3cbe411a9; settled via: self-relay
- Tx: 0xf8ddeba47a9555d267b5bf7b42cf5a0a825e1ca8301554ae9335981428fd7405
- Explorer: https://testnet.kitescan.ai/tx/0xf8ddeba47a9555d267b5bf7b42cf5a0a825e1ca8301554ae9335981428fd7405
- Verify: signature ✓, rules_in_public_policy ✓, price_bounds ✓, policy_hash ✓, payment_tx_onchain ✓, amount_matches_price ✓

## 2026-11-14T16:21:25.715Z — LIVE site run, scenario `story-a` (demo shopper SSE stream) — SETTLED

- Base URL: https://kitestall.onrender.com
- Signer: dev signer (no Passport session); session cap 2250c is SIMULATED
- Session-limit error (simulated): requested 2450c > cap 2250c → shopper renegotiated
- Rounds: 5; Prompt Guard blocks: 0; SERV statuses: live
- Agreed unit price: 2250 cents (list 2500); rules: R-PG-CLEAN, R-CAP-30, R-STOCK-OK, R-FINAL-ACCEPT, R-ROUND-CAP, R-FLOOR-OK
- Receipt: rc_dd819f9c3b40; settled via: self-relay; SERV request ids: 3
- Tx: 0xfe5b534ad9d982a96d30154dbee28cb1600323bf93936a669d2738c6f65c0c51
- Explorer: https://testnet.kitescan.ai/tx/0xfe5b534ad9d982a96d30154dbee28cb1600323bf93936a669d2738c6f65c0c51
- Verify (live): signature ✓, rules_in_public_policy ✓, price_bounds ✓, policy_hash ✓, payment_tx_onchain ✓, amount_matches_price ✓
- Raw stream: docs/evidence/live-story-a-2026-11-14.sse.txt

## 2026-11-14T16:45:14.977Z — PAID FIRM QUOTE (x402 micro-fee) — nomad/day-pass — FEE + SALE SETTLED

- Base URL: http://localhost:8787
- Signer: dev signer (testnet EOA, no Passport session)
- Firm quote: fq_90b4c314c0ba, unit price 2125c (list 2500c), valid until 2026-11-14T16:55:11.609Z, rules R-FIRM-QUOTE
- **Fee**: 5c paid to the platform wallet 0x9E6219F8EEe17742838567F44e18875cCD41Cb39, settled via self-relay
- Fee tx: 0xbde15220b4d50e064314b861a50ea5ef6018f318a52127afbb853a27b3c2e08a
- Fee explorer: https://testnet.kitescan.ai/tx/0xbde15220b4d50e064314b861a50ea5ef6018f318a52127afbb853a27b3c2e08a
- Purchase receipt: rc_1798bbad2a28 (rules R-FIRM-QUOTE,R-STOCK-OK,R-FLOOR-OK; SERV status none); settled via self-relay
- Purchase tx: 0x4ca2fd77197c03a2049073878f533035c8ec8903e1f4b2eecf6f8181cfe7fcc7
- Purchase explorer: https://testnet.kitescan.ai/tx/0x4ca2fd77197c03a2049073878f533035c8ec8903e1f4b2eecf6f8181cfe7fcc7
- Verify: signature ✓, rules_in_public_policy ✓, price_bounds ✓, policy_hash ✓, payment_tx_onchain ✓, amount_matches_price ✓

