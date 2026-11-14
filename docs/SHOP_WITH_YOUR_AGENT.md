# Shop with your own agent (Kite TESTNET)

Everything below runs on **Kite testnet**: no real money. Base URL: `https://kitestall.onrender.com` (free plan: the first request after idle takes about a minute to wake the service). Every step here was run by us against a Kitestall server and a real testnet transaction; the file you can copy is [`scripts/example-shopper.mjs`](../scripts/example-shopper.mjs).

## 0. What your agent needs
- A **testnet** EOA key (never a mainnet key). The buyer needs **testnet PYUSD** only: payment is a signed EIP-3009 authorization and the server pays gas, so the shopper holds no KITE for purchases.
- To get PYUSD: get a little testnet KITE for gas from https://faucet.gokite.ai (it has a reCAPTCHA, so a human must do it once), then claim PYUSD yourself: `SHOPPER_PRIVATE_KEY=0x… node scripts/claim-token.mjs` (each call mints 10 testnet PYUSD to you; repeatable). Token: PYUSD `0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9`, 18 decimals, chain 2368.

## 1. Let your agent read the instructions
Point it at **`/llms.txt`** (agent-readable how-to) and **`/.well-known/kitestall.json`** (shops, endpoints, network, asset, public keys):
```bash
curl -s https://kitestall.onrender.com/llms.txt
curl -s https://kitestall.onrender.com/.well-known/kitestall.json
```

## 2. The curl flow (what an agent does)
```bash
B=https://kitestall.onrender.com
curl -s $B/shops/nomad/catalog                  # items, list prices in integer cents, stock
curl -s $B/shops/nomad/policy                   # public rules + policy_hash (the private floor is never published)
# negotiate (free; at most 3 rounds, 8 messages per session). Prices are integer cents.
curl -s -X POST $B/shops/nomad/negotiate -H 'content-type: application/json' \
  -d '{"item_id":"day-pass","qty":1,"offer_cents":2100,"message":"Hi, could you do 21 dollars?"}'
# reuse the returned session_id for the next rounds; when status is "accepted" you get a single-use quote:
curl -s -X POST $B/shops/nomad/checkout -H 'content-type: application/json' -d '{"quote_id":"q_…"}'   # -> HTTP 402
```
- The 402 body is x402 (`exact`, network `eip155:2368`, the asset above) with `amount` = the agreed price in wei, exactly.
- Sign an EIP-3009 `TransferWithAuthorization` for that amount to `payTo`, base64 the x402 payload and retry the same POST with header `X-PAYMENT`. You get a voucher and an ed25519-signed receipt. The signing code is in `scripts/example-shopper.mjs`.
- If a message is **flagged by Prompt Guard** the response has `serv.guard: "blocked"`, the price does not move and the round is not used: rephrase and send again. Do not try to bypass it.
- In the **final round** the shop accepts any offer at or above its code-computed best-and-final price at your offer (rule `R-FINAL-ACCEPT`). A final counter can be taken with one more message.

Or just run the example agent (Node 20+, `npm i viem`):
```bash
SHOPPER_PRIVATE_KEY=0x… node scripts/example-shopper.mjs https://kitestall.onrender.com nomad day-pass 2300
```
Verified run (local server, real testnet payment): rounds 1–2 countered, round 3 accepted at the buyer's offer via `R-FINAL-ACCEPT`, then 402, signature, receipt `rc_d272e7c109ec`, tx `0x2c840e1758199255fb76d324a96c2666febec523bb6ca9b15743f95500f7e4ff`.

## 3. Optional: a paid firm quote (x402 micro-fee)
Skip the haggling: pay a **5-cent testnet fee** and receive a signed price that is guaranteed for 10 minutes (list price minus half of the public maximum discount; the private floor is never involved).
```bash
curl -s -X POST $B/shops/nomad/firm-quote -H 'content-type: application/json' -d '{"item_id":"day-pass","qty":1}'   # -> 402 (fee to the platform wallet)
# pay it with the same X-PAYMENT flow; the 200 response contains firm_quote{…, quote_id, valid_until, signature} and the fee tx
# then POST /shops/nomad/checkout {"quote_id":"fq_…"} and pay the quoted price as above
```
Verified end to end (see `docs/E2E_LOG.md`, entry "PAID FIRM QUOTE"). The fee is recorded in the owner ledger as **collected** (it was actually paid on-chain on testnet); platform and per-round fees stay **accrued**, not collected.

## 4. Verify what you bought
```bash
curl -s $B/receipts/rc_…/verify        # or the Verify page: https://kitestall.onrender.com/#/verify
node scripts/verify-receipt.mjs $B rc_…
```
Six checks: ed25519 signature, every cited rule is in the published policy, price within public bounds, policy hash, the transfer on Kitescan (testnet), amount and payee.

## 5. Kite MCP / Claude Desktop / Cursor: what is and is not available
- **Kitestall ships no MCP server.** An agent in Claude Desktop, Cursor or any HTTP-capable framework can shop by reading `/llms.txt` and running the flow above (we verified the HTTP flow with plain Node and curl; we did not test it inside Claude Desktop or Cursor).
- **Kite Passport (`kpass` / the Kite MCP)** was **not** used and is not expected to work here: it needs the owner's email and passkey and pays **USDC.e on Kite mainnet** with real money, while this shop settles testnet PYUSD. Reasons and sources: [docs/DISCOVERY.md](DISCOVERY.md). Our payments use a plain testnet key ("dev signer"); there is no Passport session and no Passport enforcement of spending limits. The Watch page's "session limit" is a **simulated** cap labeled as such.
- **No-code option:** the Watch page (`/#/watch`) runs a server-side demo shopper (dev signer) so you can see a purchase, the simulated budget limit, and a paid firm quote without writing code.
