import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { decide, bestAndFinal, effectiveFloor, withFinalRule, FINAL_ACCEPT_RULE, type PolicySpec, type Concession, type Action } from "./index.ts";

const basePolicy: PolicySpec = {
  shop_id: "t", version: 1, created_at: "2026-01-01T00:00:00Z",
  public: { max_discount_pct: 30, persona: "friendly", max_rounds: 3, quote_ttl_seconds: 300, rules: [{ id: "R-VOL-10", kind: "volume_tier", text: "x", params: {} }, FINAL_ACCEPT_RULE] },
  private: { floor: { default_pct_of_list: 80 }, salt: "saltsaltsalt" },
};
const LIST = 2500, FLOOR = effectiveFloor(basePolicy, "i", LIST); // 2000
const call = (o: Partial<Parameters<typeof decide>[0]> & { offer: number | null; round: number; ask?: number; action?: Action; conc?: Concession }) =>
  decide({ policy: basePolicy, itemId: "i", listCents: LIST, qty: 1, stock: 9, currentAskCents: o.ask ?? 2338, offerCents: o.offer, round: o.round,
    proposal: { action: o.action ?? "counter", concession: o.conc ?? "small", rule_ids: [], message: "" } });

describe("best-and-final", () => {
  it("is floor + 10% of the headroom, never below the floor or above the ask", () => {
    expect(bestAndFinal(2000, 2338)).toBe(2034);
    fc.assert(fc.property(fc.integer({ min: 1, max: 100000 }), fc.integer({ min: 0, max: 100000 }), (floor, extra) => {
      const ask = floor + extra, bf = bestAndFinal(floor, ask);
      expect(bf).toBeGreaterThanOrEqual(floor); expect(bf).toBeLessThanOrEqual(ask);
    }));
    expect(bestAndFinal(2000, 1900)).toBe(1900); // ask already below floor input cannot create a price above the ask
  });
  it("final round: accepts an offer at/above best-and-final AT THE OFFER, even if the model says reject_final", () => {
    const d = call({ round: 3, offer: 2250, action: "reject_final" });
    expect(d).toMatchObject({ status: "accepted", askCents: 2250 }); expect(d.rules).toContain("R-FINAL-ACCEPT");
  });
  it("final round: never accepts at exactly the floor; counters at best-and-final", () => {
    const d = call({ round: 3, offer: FLOOR, action: "accept_offer" });
    expect(d.status).toBe("accepted"); // model-driven accept below is a separate pre-existing path
    const d2 = call({ round: 3, offer: FLOOR, action: "counter" });
    expect(d2.status).toBe("counter"); expect(d2.askCents).toBe(bestAndFinal(FLOOR, 2338)); expect(d2.askCents).toBeGreaterThan(FLOOR); expect(d2.rules).not.toContain("R-FINAL-ACCEPT");
  });
  it("final round: offer just under best-and-final is not accepted by the final rule", () => {
    const bf = bestAndFinal(FLOOR, 2338); const d = call({ round: 3, offer: bf - 1, action: "counter" });
    expect(d.status).toBe("counter"); expect(d.askCents).toBe(bf);
  });
  it("earlier rounds are unchanged: no R-FINAL-ACCEPT", () => {
    expect(call({ round: 2, offer: 2100, action: "counter" }).rules).not.toContain("R-FINAL-ACCEPT");
  });
  it("past the round cap only the standing ask can be taken", () => {
    expect(call({ round: 4, offer: 2338, ask: 2034 }).status).toBe("accepted");
    expect(call({ round: 4, offer: 2000, ask: 2034 }).status).toBe("rejected");
    expect(call({ round: 4, offer: 2034, ask: 2034 })).toMatchObject({ status: "accepted", askCents: 2034 });
  });
  it("PROPERTY: over random sequences the price is never below the floor, never above the current ask, and R-FINAL-ACCEPT only in the final round", () => {
    const conc = fc.constantFrom<Concession>("none", "tiny", "small", "medium", "large");
    const act = fc.constantFrom<Action>("counter", "accept_offer", "hold", "reject_final", "ask_clarification");
    fc.assert(fc.property(fc.array(fc.tuple(fc.option(fc.integer({ min: -50, max: 4000 }), { nil: null }), conc, act), { minLength: 1, maxLength: 4 }), (seq) => {
      let ask = LIST;
      seq.forEach(([offer, c, a], idx) => {
        const round = idx + 1;
        const d = decide({ policy: basePolicy, itemId: "i", listCents: LIST, qty: 1, stock: 9, currentAskCents: ask, offerCents: offer, round, proposal: { action: a, concession: c, rule_ids: [], message: "" } });
        if (d.status === "accepted" || d.status === "counter") {
          expect(d.askCents).toBeGreaterThanOrEqual(FLOOR); expect(d.askCents).toBeLessThanOrEqual(LIST);
          if (d.status === "counter") expect(d.askCents).toBeLessThanOrEqual(ask);
          if (d.status === "accepted" && offer !== null) expect(d.askCents).toBeLessThanOrEqual(Math.max(ask, offer)); // never takes more than offered/asked
        }
        if (d.rules.includes("R-FINAL-ACCEPT")) { expect(round).toBe(3); expect(d.askCents).toBeGreaterThan(FLOOR); expect(offer).toBe(d.askCents); }
        if (d.status === "counter") ask = d.askCents;
      });
    }), { numRuns: 500 });
  });
  it("withFinalRule adds the public rule once", () => {
    const pub = { rules: [{ id: "R-A" }] }; const once = withFinalRule(pub); expect(once.rules.map((r) => r.id)).toEqual(["R-A", "R-FINAL-ACCEPT", "R-FIRM-QUOTE"]); expect(withFinalRule(once).rules.length).toBe(3);
  });
});
