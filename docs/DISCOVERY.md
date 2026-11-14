# Phase 0 Discovery (2026-11-14)

Status legend: **VERIFIED** = read in docs or confirmed by a real call I ran. **PENDING** = needs a credential/funded wallet.

## SERV Reasoning — VERIFIED from docs (no live call yet: needs OPENSERV_API_KEY)
Sources: https://docs.openserv.ai/llms.txt, /serv-reasoning/api/index.md, /api/chat-completions.md, /models.md, /tools.md, /tutorials/{prompt-guard,multipath,shadow-agent,kronos,structured-outputs,usage-and-billing}.md
- Base: `https://inference-api.openserv.ai/v1/chat/completions`, `Authorization: Bearer <key>`. OpenAI format. System message required (400 otherwise).
- Models are plain base IDs, e.g. `gpt-5.4-mini` ($1.00/$6.00 per M in/out), `gpt-5.4-nano`, `gpt-6-luna`, `claude-haiku-4.5`.
- **DIFFERENCE vs spec:** Prompt Guard and Shadow Agent are NOT model-name suffixes. They are marker tools in the `tools` array: `{type:"function",function:{name:"serv_prompt_guard"}}` and `serv_shadow_agent` (config via schema `default`s: `hint`, `max_iterations` 1–10, default 3). Shadow Agent is non-streaming only.
- Multipath and Kronos ARE model suffixes: `gpt-5.4-mini-serv-multipath`, `-serv-kronos`, `-serv-kronos-multipath`.
- Prompt Guard: on injection, SERV returns an "endpoint-shaped refusal" without calling the upstream model. Exact refusal shape: PENDING (smoke-serv.mjs records it). If the guard judge fails after arming, the request continues without verdict (so the code must treat "no verdict" as unknown, not clean). 502 if it cannot arm.
- Structured output: `response_format: {type:"json_schema", json_schema:{name, strict:true, schema}}`. Numeric range keywords rejection: PENDING (smoke test `d_numeric_range`). We avoid them regardless.
- Usage: response has `id` and `usage` (prompt/completion/total tokens). Billing per request includes guard/shadow/multipath components; per-request dollar cost is in the console Usage view; whether it is in the API response: PENDING.
- Edition-02 data-collection requirement (console.openserv.ai/settings/organization): NOT verified; human must check.

## Kite — VERIFIED (docs + real calls)
Sources: https://docs.gokite.ai/llms.txt, /llms/docs.txt (Service Provider Guide, Network Information, Gasless guide, kpass CLI), https://facilitator.pieverse.io/
- **Facilitator (real call, 200):** `https://facilitator.pieverse.io` v2.0.0. `GET /` lists `kite-testnet` and `kite` among supported networks; facilitator address `0x12343e649e6b2b2b77649DFAb88f103c02F3C78b` (kite-testnet balance reported ~99.9 native). Endpoints: `GET /v2/supported`, `POST /v2/verify`, `POST /v2/settle`. `/v2/supported` lists x402Version 2, scheme `exact`, networks `eip155:2368` (Kite testnet) and `eip155:2366` (Kite mainnet) among others.
- Settle body (docs): `{authorization:{...}, signature:"0x...", network:"<network>"}`. Verify body shape not documented → PENDING (probe with a real signed auth).
- 402 shape (docs): `{error, accepts:[{scheme:"gokite-aa", network, maxAmountRequired(wei), resource, description, mimeType, outputSchema, payTo, maxTimeoutSeconds:300, asset, extra:null, merchantName}], x402Version:1}`. `X-PAYMENT` header = base64 JSON authorization.
- Chains: testnet chainId **2368**, explorer **https://testnet.kitescan.ai/**; mainnet 2366, https://kitescan.ai/. Faucet https://faucet.gokite.ai.
- Tokens: testnet **PYUSD** `0x8E04D099b1a8Dd20E6caD4b2Ab2B405B98242ec9`, **18 decimals**, EIP-712 name "PYUSD" v"1", self-claimable (`claim`/`claimTo`). Mainnet USDC.e `0x7aB6f3ed87C42eF0aDb67Ed95090f8bF5240149e`, 6 decimals. Source: gasless guide (`https://gasless.gokite.ai/supported_tokens`).
- **DIFFERENCE vs spec:** sample service host `x402.dev.gokite.ai` does NOT resolve (DNS ENOTFOUND on my machine, 2026-11-14) so smoke test (c) cannot show a live 402 from it; the docs' 402 JSON shape above is used. The spec's "Test USDT 0x0fF5…" asset is not in the current docs; current testnet asset is PYUSD. To be re-checked with the real facilitator verify call.
- **DIFFERENCE vs spec:** Passport is now the `kpass` CLI (signup/login by email OTP, `agent:register`, `agent:session create --max-amount-per-tx --max-total-amount --ttl --assets USDC --payment-approach x402_http`, `agent:session execute --url ...` which handles 402→pay). It is documented with `USDC` assets (mainnet-oriented). Whether kpass sessions can pay a **testnet** `kite-testnet` payTo is UNVERIFIED → human must try `kpass` after signup (checklist below). Spending-limit errors: https://docs.gokite.ai/reference/error-codes.
- Merchant-side Passport verification API: none found in docs. Plan: rely on facilitator verification, record payer address; `passport_status: "not_verified_by_merchant"`.

## Chosen signer path (provisional)
1. Real testnet settlement via `KiteAaSdkSigner`-style dev signer: EIP-3009 `transferWithAuthorization` signed by a funded testnet wallet (viem), settled by Pieverse. Labeled "dev signer, no Passport session" everywhere.
2. If `kpass` can pay a testnet/any x402 endpoint, add `KpassSigner` (shell out to `kpass agent:session execute`) and use it for Story A (real session limit → `InsufficientBudget`-style error).
3. Otherwise Story A uses a simulated session cap, clearly labeled.
