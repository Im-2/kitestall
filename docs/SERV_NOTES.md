# SERV Reasoning notes (what we use, what we saw)

All observations are from real calls made on 2026-11-14 with `gpt-5.4-mini` through `https://inference-api.openserv.ai/v1`. Numbers live in [BENCHMARKS.md](BENCHMARKS.md) (generated).

## How each feature is used
| Feature | How | Why | Honest notes |
|---|---|---|---|
| **Prompt Guard** (`serv_prompt_guard` tool) | On **every** negotiation and compile request; buyer text is in the user message | Screen buyer-authored strings for injection/extraction | Block = HTTP 200 with null/refusal content, `finish_reason:"content_filter"` or zero usage. We detect it and fail closed. Never retried without the guard. **Non-deterministic**: identical text was sometimes blocked, sometimes passed; false-positive rate on benign messages is in BENCHMARKS.md. A block never advances the round. |
| **Structured output** (`response_format: json_schema`, strict) | Decision schema = enums + strings only (`action`, `concession`, `rule_ids`, `message`); policy-compile schema | The model cannot output a price | No numeric range keywords used. (`minimum` was accepted with HTTP 200 in our smoke test, contrary to other builders' reports; we still avoid them.) A system message is always sent (omitting it is a 400). |
| **Multipath** (`-serv-multipath` suffix) | Production negotiation model | Persona plus competing public rules (volume vs loyalty vs time window) in one prompt | Multipath added no measurable latency in our bench. Whether it improved decision quality was **not** evaluated, so we make no quality claim. |
| **Shadow Agent** (`serv_shadow_agent` tool) | Supported behind `SERV_SHADOW=1`; **off in the default deployment** | Validate/regenerate drafts | Roughly doubled latency in our bench (see BENCHMARKS.md). Code-side validation (zod parse, rule-id subset, leak filter, clamps) already enforces every rule, so the default skips it for responsiveness. We only claim Shadow Agent verification on rounds where it was enabled. |
| **Kronos** (`-serv-kronos`) | Attempted in the bench only | Prompt audit | **Not successfully measured.** Attempt 1 failed with HTTP 400 "No pricing configured" because we built the combined model id wrongly (`-serv-kronos-serv-multipath`); after fixing it to the documented `-serv-kronos-multipath`, the bench rows errored (HTTP 402: the org's SERV credit balance was down to $0.03). So we make **no Kronos claims** and keep it off in every production path. |
| **Policy compile** | Graph-style single call producing a draft policy, validated by zod | Owner onboarding in plain English | Owner must approve; the preview runs 5 simulated haggles with the deterministic engine (no SERV calls) and says so. |

## What SERV never does here
It never sees the private floor, cost, salt or policy internals, and it never outputs a price. It picks a concession level; code converts it to cents and clamps. If SERV fails twice (bad JSON, timeout, 5xx) the round uses the deterministic fallback and is labeled `fallback` in the trace, receipts and stats — and is excluded from any "SERV decided" claim.

## Evidence in receipts
`serv.request_ids` (the `chatcmpl-…` ids of every round), model, features and `live|fallback|mixed` status are in each signed receipt.

## Cost
The API response has token usage but no dollar cost. Our cost figures are `usage × catalog price` (inference only); SERV feature surcharges (guard/multipath/shadow calls) are billed in the console but are not in the response, so true cost is somewhat higher. We say "estimated" everywhere.
