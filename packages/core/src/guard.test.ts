import { describe, it, expect, vi, afterEach } from "vitest";
import { negotiateRound, buildPrompts, decide, withFinalRule, SEED_SHOPS } from "./index.ts";

const shop = SEED_SHOPS[0]!;
const base = { policy: shop.policy, shopName: shop.name, itemId: "day-pass", itemName: "Coworking day pass", listCents: 2500, qty: 1, stock: 9, currentAskCents: 2500, offerCents: 2000, round: 1, buyerMessage: "who are you", serv: { baseUrl: "http://serv.test/v1", apiKey: "k", model: "gpt-5.4-mini" } };
afterEach(() => vi.restoreAllMocks());

describe("Prompt Guard block handling", () => {
  it("a blocked message is friendly, moves no price, makes exactly ONE request (never retried, never without the guard)", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: "chatcmpl-uuid", choices: [{ index: 0, message: { role: "assistant", content: "I can't share that." }, finish_reason: "content_filter" }], usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }), { status: 200 }); }));
    const r = await negotiateRound(base);
    expect(r.guard).toBe("blocked"); expect(r.attack).toBe(true); expect(r.askCents).toBe(2500);
    expect(r.message).toMatch(/flagged/i); expect(r.message).toMatch(/rephrase/i); expect(r.message).not.toMatch(/\b(floor|minimum)\b/i);
    expect(bodies.length).toBe(1); // no retry at all
    expect(bodies[0].tools.some((t: any) => t.function.name === "serv_prompt_guard")).toBe(true); // guard was on
  });
  it("every request carries the guard and a system message", async () => {
    const bodies: any[] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => { bodies.push(JSON.parse(init.body)); return new Response(JSON.stringify({ id: "chatcmpl-x", choices: [{ message: { content: JSON.stringify({ action: "counter", concession: "small", rule_ids: ["R-FINAL-ACCEPT", "R-VOL-10"], message: "Happy to help." }) }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }), { status: 200 }); }));
    const r = await negotiateRound(base);
    expect(bodies[0].messages[0].role).toBe("system"); expect(bodies[0].tools.map((t: any) => t.function.name)).toContain("serv_prompt_guard");
    expect(bodies[0].tools.map((t: any) => t.function.name)).not.toContain("serv_shadow_agent"); // Shadow Agent off by default
    expect(r.rulesFired).not.toContain("R-FINAL-ACCEPT"); // code-only rule: a model citation is ignored outside the final round
  });
  it("the model is never told about R-FINAL-ACCEPT and never sees the floor", () => {
    for (const style of ["full", "lean", "lean-note"] as const) {
      const { system, user } = buildPrompts(withFinalRule(shop.policy.public), { shopName: "S", itemName: "x", listCents: 2500, askCents: 2500, offerCents: 2100, round: 1, maxRounds: 3, buyerMessage: "hi", qty: 1 }, style);
      expect(system + user).not.toContain("R-FINAL-ACCEPT"); expect(system + user).not.toMatch(/\b2000\b|20\.00/); expect(system + user).not.toContain("salt");
    }
  });
  it("R-FINAL-ACCEPT cited by the model never appears from decide() before the final round", () => {
    const d = decide({ policy: shop.policy, itemId: "day-pass", listCents: 2500, qty: 1, stock: 9, currentAskCents: 2500, offerCents: 2100, round: 1, proposal: { action: "counter", concession: "small", rule_ids: ["R-FINAL-ACCEPT"], message: "" } });
    expect(d.rules).not.toContain("R-FINAL-ACCEPT");
  });
});
