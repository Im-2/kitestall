import { decide, fallbackProposal, type Decision } from "./engine.ts";
import { leakFilter } from "./leak.ts";
import { dollars, proposeWithServ, sanitizeBuyerText, estimateCostUsd, type ServConfig, type ServCall } from "./serv.ts";
import type { PolicySpec } from "./policy.ts";

export interface RoundInput {
  policy: PolicySpec; shopName: string; itemId: string; itemName: string; listCents: number; qty: number; stock: number;
  currentAskCents: number; offerCents: number | null; round: number; buyerMessage?: string; serv: ServConfig;
}
export interface RoundResult {
  status: Decision["status"]; askCents: number; message: string; rulesFired: string[]; round: number; final: boolean;
  guard: "clean" | "blocked" | "unknown"; servStatus: "live" | "fallback" | "blocked"; fallbackReason?: string;
  concession: string; action: string; leakReplaced: boolean; leakReason?: string;
  serv: { model: string; features: string[]; requestId: string | null; latencyMs: number; tokens: number; estCostUsd: number } | null;
  attack: boolean;
}

const REFUSAL = "That message was flagged by the safety filter, so I haven't acted on it and it did not use up one of your rounds. Please rephrase it and try again.";
const SAFE: Record<string, string> = {
  counter: "Let me meet you partway.", accepted: "Deal, that works for me.", rejected: "I'm afraid I can't go further on this one.",
  clarify: "Could you tell me which item and how many, and what you'd like to pay?",
};

export async function negotiateRound(i: RoundInput): Promise<RoundResult> {
  const pub = i.policy.public;
  const msg = sanitizeBuyerText(i.buyerMessage);
  const ctx = { shopName: i.shopName, itemName: i.itemName, listCents: i.listCents, askCents: i.currentAskCents, offerCents: i.offerCents, round: i.round, maxRounds: pub.max_rounds, buyerMessage: msg, qty: i.qty };
  const res = await proposeWithServ(i.serv, pub, ctx);
  const rules = [] as string[];

  // Prompt Guard blocked: no price movement beyond "hold", templated refusal, logged attack.
  if (res.guard === "blocked") {
    const d = decide({ policy: i.policy, itemId: i.itemId, listCents: i.listCents, qty: i.qty, stock: i.stock, currentAskCents: i.currentAskCents, offerCents: null, round: i.round, proposal: { action: "hold", concession: "none", rule_ids: [], message: "" } });
    return { status: "counter", askCents: i.currentAskCents, message: `${REFUSAL} My current ask is $${dollars(i.currentAskCents)}.`, rulesFired: ["R-PG-BLOCKED", ...d.rules.filter((r) => r === "R-STOCK-OK")], round: i.round, final: d.final, guard: "blocked", servStatus: "blocked", concession: "none", action: "hold", leakReplaced: false, serv: res.call ? meta(res.call) : null, attack: true };
  }

  const usedFallback = res.proposal === null;
  const proposal = res.proposal ?? fallbackProposal(i.currentAskCents, i.offerCents, pub.persona);
  const d = decide({ policy: i.policy, itemId: i.itemId, listCents: i.listCents, qty: i.qty, stock: i.stock, currentAskCents: i.currentAskCents, offerCents: i.offerCents, round: i.round, proposal });
  if (res.guard === "clean") rules.push("R-PG-CLEAN");
  rules.push(...d.rules);

  // Message: model text only if it passes the leak filter; code appends the numbers.
  const modelText = usedFallback ? SAFE[d.status]! : proposal.message;
  const lf = leakFilter(modelText, { prices: [], qty: undefined }, SAFE[d.status]!);
  const tail = d.status === "accepted" ? ` Agreed at $${dollars(d.askCents)}${i.qty > 1 ? ` per unit` : ""}.`
    : d.status === "counter" ? ` My ask is $${dollars(d.askCents)}${d.final ? " (best and final)" : ""}.`
    : d.status === "rejected" ? ` Listed price is $${dollars(i.listCents)}.` : "";
  return {
    status: d.status, askCents: d.askCents, message: (lf.text + tail).trim(), rulesFired: rules, round: i.round, final: d.final,
    guard: res.guard, servStatus: usedFallback ? "fallback" : "live", fallbackReason: res.fallbackReason, concession: d.concession, action: d.action,
    leakReplaced: lf.replaced, leakReason: lf.reason, serv: res.call ? meta(res.call) : null, attack: false,
  };
}
function meta(c: ServCall) {
  return { model: c.model, features: c.features, requestId: c.id, latencyMs: c.latencyMs, tokens: c.usage.total, estCostUsd: estimateCostUsd(c.model.replace(/-serv-.*/, ""), c.usage) };
}
