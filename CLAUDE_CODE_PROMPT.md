# Kickoff prompt for Claude Code

Paste everything below the line into Claude Code, with `KITESTALL_BUILD_SPEC.md` placed in an empty project folder.

---

You are building **Kitestall**, a seller-side storefront agent on Kite, for the OpenServ SERV Hackathon Edition 02 (Track 02: Kite). The full product, architecture, security model, test plan, deliverables and build phases are in `KITESTALL_BUILD_SPEC.md` in this folder. **Read it completely before doing anything.** It is the source of truth.

**Operating rules**
1. Start with **Phase 0 (Discovery)** exactly as the spec describes. Several external facts are marked `TO VERIFY` (Kite access path and facilitator endpoints, SERV model names and feature behaviour, token decimals, explorer URLs). Verify them against the live docs and real calls, and write results with source URLs to `docs/DISCOVERY.md`. If reality differs from the spec, follow reality and record the change in `docs/DECISIONS.md`.
2. Create a task list from the phases in section 11 and keep it updated. Finish each phase's acceptance criteria by actually running the tests/scripts before moving on. Keep something demoable at every phase boundary.
3. **Never invent facts, numbers, transactions, or results.** Every figure in the docs, UI and write-up must come from a script you ran or a real transaction. Testnet must always be labeled as testnet. Do not claim SERV decided when the fallback did, and do not claim Passport enforcement when the dev signer was used.
4. Hard design rules: the model never sees the private floor and never outputs a price; it picks a concession level from an enum and writes a short message; code does all price, stock, payment and leak enforcement. Prompt Guard on every buyer-authored string and never retried without it. No numeric range keywords in JSON Schemas for SERV structured output; always send a system message.
5. Secrets only via `.env` (provide `.env.example`). Never commit keys. Add a secret scan before commits.
6. Ask me only for credentials, funded wallets, hosting accounts and the human-only tasks in section 12. In your **first reply after Phase 0 starts**, give me the complete checklist of what you need from me so I can do it in parallel while you build. For everything else, decide, and log it in `docs/DECISIONS.md`.
7. Build the web UI with real design intent (the market-stall / ledger look in section 6.8), not a generic template. Include loading, empty and error states, a visible TESTNET badge wherever money appears, mobile support and accessible contrast.
8. Commit in small, meaningful steps with clear messages. Run `pnpm check` (typecheck, lint, unit, integration) before each phase-end commit.
9. Finish all of section 10 (README, WRITEUP, DEMO_SCRIPT, X_POST, SUBMISSION checklist, generated BENCHMARKS and E2E_LOG). At the end, walk the section 14 checklist item by item and report which boxes are genuinely ticked, with evidence (test output, tx hashes, URLs), and which are not.

**Start now:** read the spec, create the task list, scaffold the repo (pnpm workspace per section 5), and begin Phase 0. Report back with the human checklist and your Phase 0 findings before writing application code.
