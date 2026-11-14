# Kitestall

**A storefront agent that haggles within your rules and shows its work.**
Seller-side agent on Kite: a shop publishes a price policy, a SERV Reasoning agent negotiates with shopper agents, the agreed price is carried in an x402 `402 Payment Required`, and every sale ends with a signed receipt that cites the public rules that produced the price.

> OpenServ SERV Hackathon Edition 02, Track 02 (Kite). **Everything here is Kite TESTNET.** Status: work in progress, first draft README.

## Design rules
- The model never sees the private floor and never outputs a price. It picks a concession level (enum) and writes a short message. Code enforces price, stock, payment and leak rules.
- Prompt Guard runs on every buyer-authored string and is never retried without it.
- Receipts are ed25519-signed over RFC 8785 canonical JSON and verifiable without the private floor.

## Layout
`packages/core` (money, policy, engine, SERV client, payments, receipts) · `apps/api` · `apps/web` · `scripts/` · `docs/`

## Docs
[docs/DISCOVERY.md](docs/DISCOVERY.md) (verified external facts) · [docs/DECISIONS.md](docs/DECISIONS.md) · [docs/BENCHMARKS.md](docs/BENCHMARKS.md) (generated)

## Dev
```bash
pnpm install
cp .env.example .env   # fill in values; never commit .env
pnpm --filter @kitestall/core test
node --experimental-strip-types scripts/adversarial.ts
```

License: MIT
