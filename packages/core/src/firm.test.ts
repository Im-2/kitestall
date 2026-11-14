import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { firmPriceCents, effectiveFloor, signPayload, verifyPayload, generateKey, type PolicySpec } from "./index.ts";

const pol = (max: number, floorPct: number): PolicySpec => ({ shop_id: "t", version: 1, created_at: "x", public: { max_discount_pct: max, persona: "firm", max_rounds: 3, quote_ttl_seconds: 300, rules: [] }, private: { floor: { default_pct_of_list: floorPct }, salt: "saltsaltsalt" } });

describe("firm quote price", () => {
  it("is list minus half of the public max discount (Nomad: 25.00 -> 21.25)", () => expect(firmPriceCents(pol(30, 80), "i", 2500)).toBe(2125));
  it("falls back to the list price when that would sit below the private floor (never sells below the floor)", () => expect(firmPriceCents(pol(30, 95), "i", 2500)).toBe(2500));
  it("PROPERTY: never below the floor, never above list", () => {
    fc.assert(fc.property(fc.integer({ min: 100, max: 100000 }), fc.integer({ min: 0, max: 90 }), fc.integer({ min: 1, max: 100 }), (list, max, fl) => {
      const p = pol(max, fl); const price = firmPriceCents(p, "i", list);
      expect(price).toBeGreaterThanOrEqual(effectiveFloor(p, "i", list)); expect(price).toBeLessThanOrEqual(list);
    }));
  });
});
describe("signed payloads", () => {
  it("round trips and detects tampering", () => {
    const k = generateKey(); const doc = signPayload({ kind: "firm", price: 2125 }, k.seed);
    expect(verifyPayload(doc, k.publicKey)).toBe(true); expect(verifyPayload({ ...doc, price: 1 }, k.publicKey)).toBe(false);
  });
});
