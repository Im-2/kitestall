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

