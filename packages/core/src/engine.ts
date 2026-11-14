import { effectiveFloor, type PolicySpec } from "./policy.ts";

export type Action = "counter" | "accept_offer" | "hold" | "reject_final" | "ask_clarification";
export type Concession = "none" | "tiny" | "small" | "medium" | "large";
export const CONCESSION_PCT: Record<Concession, number> = { none: 0, tiny: 10, small: 25, medium: 50, large: 75 };

/** What the model is allowed to produce. No prices. */
export interface Proposal { action: Action; concession: Concession; rule_ids: string[]; message: string }

export interface DecideInput {
  policy: PolicySpec;
  itemId: string;
  listCents: number;
  qty: number;
  stock: number;
  currentAskCents: number; // first round: list
  offerCents: number | null;
  round: number; // 1-based round being decided
  proposal: Proposal;
}
export type Status = "counter" | "accepted" | "rejected" | "clarify";
export interface Decision { status: Status; askCents: number; rules: string[]; final: boolean; action: Action; concession: Concession }

function mk(status: Status, askCents: number, rules: string[], final: boolean, action: Action, concession: Concession): Decision {
  return { status, askCents, rules, final, action, concession };
}

/** Best-and-final price: the floor plus 10% of the remaining headroom (never below the floor, never above the current ask).
 *  Computed in code only; the model never sees it. */
export function bestAndFinal(floor: number, ask: number): number {
  const headroom = Math.max(0, ask - floor);
  return Math.min(ask, floor + Math.ceil(headroom / 10));
}

/** Pure decision. The floor is read here only; it is never passed to any model. */
export function decide(i: DecideInput): Decision {
  const rules: string[] = [];
  const { policy, listCents } = i;
  const floor = effectiveFloor(policy, i.itemId, listCents);
  const ask = Math.min(i.currentAskCents, listCents); // asks only go down
  const maxRounds = policy.public.max_rounds;
  const final = i.round >= maxRounds;
  const pubRules = new Set(policy.public.rules.map((r) => r.id));
  for (const r of i.proposal.rule_ids) if (pubRules.has(r) && !["R-FINAL-ACCEPT", "R-FIRM-QUOTE"].includes(r) && !rules.includes(r)) rules.push(r); // code-only rules: a model citation is ignored

  if (i.qty < 1 || i.qty > i.stock) return mk("rejected", ask, [...rules, "R-STOCK-LIMIT"], final, "reject_final", "none");
  const offer = i.offerCents;
  if (i.round > maxRounds) {
    // Past the round cap the only thing left is taking the standing (best-and-final) ask, never a lower price.
    if (offer !== null && offer >= ask) return mk("accepted", ask, ["R-STOCK-OK", "R-ROUND-CAP", "R-FLOOR-OK"], true, "accept_offer", "none");
    return mk("rejected", ask, [...rules, "R-ROUND-CAP"], true, "reject_final", "none");
  }
  rules.push("R-STOCK-OK");

  // Offer at/above ask: accept at the ask, never more than asked.
  if (offer !== null && offer >= ask) { rules.push("R-FLOOR-OK"); return mk("accepted", ask, rules, final, "accept_offer", "none"); }

  // FINAL ROUND (code rule, independent of the model): accept any offer at or above the best-and-final price, at the buyer's offer.
  const bf = bestAndFinal(floor, ask);
  if (final && offer !== null && offer >= bf && offer > floor) {
    rules.push("R-ROUND-CAP", "R-FINAL-ACCEPT", "R-FLOOR-OK");
    return mk("accepted", offer, rules, true, "accept_offer", "none");
  }
  // Offer at/above floor and model says accept: accept at the offer.
  if (offer !== null && offer >= floor && i.proposal.action === "accept_offer") {
    rules.push("R-FLOOR-OK");
    return mk("accepted", Math.max(offer, floor), rules, final, "accept_offer", "none");
  }
  if (i.proposal.action === "reject_final" && !final) return mk("rejected", ask, [...rules, "R-REJECT"], final, "reject_final", "none");
  if (i.proposal.action === "ask_clarification") return mk("clarify", ask, rules, final, "ask_clarification", "none");

  const conc: Concession = i.proposal.action === "hold" ? "none" : i.proposal.concession;
  let next = ask - Math.floor(((ask - floor) * CONCESSION_PCT[conc]) / 100);
  next = Math.min(Math.max(next, floor), ask, listCents);
  if (final) {
    // Best and final: the standing ask is computed by code, not chosen by the model (a model "reject" cannot override it).
    rules.push("R-ROUND-CAP");
    next = Math.min(next, bf);
    next = Math.max(next, floor);
    if (offer !== null && offer >= next && offer > floor) { rules.push("R-FINAL-ACCEPT", "R-FLOOR-OK"); return mk("accepted", offer, rules, true, "accept_offer", conc); }
    if (next === floor) rules.push("R-FLOOR-HIT");
    return mk("counter", next, rules, true, "counter", conc);
  }
  if (offer !== null && offer >= next) { rules.push("R-FLOOR-OK"); return mk("accepted", next, rules, final, "accept_offer", conc); }
  if (next === floor) rules.push("R-FLOOR-HIT");
  return mk("counter", next, rules, final, "counter", conc);
}

/** Deterministic stand-in for the model: fallback, previews, tests. */
export function fallbackProposal(ask: number, offer: number | null, persona: "firm" | "friendly" | "flexible"): Proposal {
  let concession: Concession = "small";
  if (offer === null) concession = "tiny";
  else {
    const rel = ask > 0 ? ((ask - offer) * 100) / ask : 0;
    concession = rel <= 5 ? "medium" : rel <= 15 ? "small" : "tiny";
  }
  if (persona === "firm" && concession === "medium") concession = "small";
  if (persona === "flexible" && concession === "small") concession = "medium";
  return { action: "counter", concession, rule_ids: [], message: "Here is my best counter." };
}
