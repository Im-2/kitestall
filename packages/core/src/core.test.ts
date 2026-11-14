import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  centsToWei, weiToCents, feeBps, decide, fallbackProposal, leakFilter, effectiveFloor, policyHash,
  generateKey, signReceipt, verifyReceipt, verifySignature, derivePub,
  type PolicySpec, type Receipt, type Concession, type Action,
} from "./index.ts";

const policy: PolicySpec = {
  shop_id: "nomad", version: 3, created_at: "2026-11-14T00:00:00Z",
  public: {
    max_discount_pct: 30, persona: "friendly", max_rounds: 3, quote_ttl_seconds: 300,
    rules: [{ id: "R-VOL-10", kind: "volume_tier", text: "10% off 5+ passes", params: {} }],
  },
  private: { floor: { default_pct_of_list: 80 }, salt: "s3cr3t-salt-xyz" },
};
const LIST = 2500;
const FLOOR = effectiveFloor(policy, "pass", LIST);

describe("money", () => {
  it("round trips exactly", () => {
    fc.assert(fc.property(fc.integer({ min: 0, max: 1e9 }), (c) => weiToCents(centsToWei(c)) === c));
  });
  it("1 token = 100 cents", () => expect(centsToWei(100)).toBe(10n ** 18n));
  it("rejects sub-cent wei", () => expect(() => weiToCents(1n)).toThrow());
  it("rejects floats/negatives", () => { expect(() => centsToWei(1.5)).toThrow(); expect(() => centsToWei(-1)).toThrow(); });
  it("fee rounds down", () => expect(feeBps(1999, 100)).toBe(19));
});

describe("engine invariants", () => {
  const conc = fc.constantFrom<Concession>("none", "tiny", "small", "medium", "large");
  const act = fc.constantFrom<Action>("counter", "accept_offer", "hold", "reject_final", "ask_clarification");
  it("floor is 20% off list for the sample", () => expect(FLOOR).toBe(2000));
  it("never below floor, never above previous ask, over any sequence", () => {
    fc.assert(fc.property(fc.array(fc.tuple(fc.option(fc.integer({ min: -100, max: 5000 }), { nil: null }), conc, act, fc.array(fc.string())), { minLength: 1, maxLength: 6 }), (seq) => {
      let ask = LIST;
      seq.forEach(([offer, c, a, ids], idx) => {
        const d = decide({ policy, itemId: "pass", listCents: LIST, qty: 1, stock: 5, currentAskCents: ask, offerCents: offer, round: idx + 1, proposal: { action: a, concession: c, rule_ids: ids, message: "" } });
        if (d.status === "counter" || d.status === "accepted") {
          expect(d.askCents).toBeGreaterThanOrEqual(FLOOR);
          expect(d.askCents).toBeLessThanOrEqual(ask);
          expect(d.askCents).toBeLessThanOrEqual(LIST);
        }
        if (d.status === "counter") ask = d.askCents;
      });
    }));
  });
  it("accepts at the ask when offer >= ask (never more than asked)", () => {
    const d = decide({ policy, itemId: "pass", listCents: LIST, qty: 1, stock: 5, currentAskCents: 2300, offerCents: 9999, round: 1, proposal: fallbackProposal(2300, 9999, "friendly") });
    expect(d).toMatchObject({ status: "accepted", askCents: 2300 });
  });
  it("model claiming accept below floor is ignored", () => {
    const d = decide({ policy, itemId: "pass", listCents: LIST, qty: 1, stock: 5, currentAskCents: LIST, offerCents: 100, round: 1, proposal: { action: "accept_offer", concession: "large", rule_ids: [], message: "" } });
    expect(d.status).toBe("counter");
    expect(d.askCents).toBeGreaterThanOrEqual(FLOOR);
  });
  it("stock and round caps", () => {
    const base = { policy, itemId: "pass", listCents: LIST, currentAskCents: LIST, offerCents: 2400, proposal: fallbackProposal(LIST, 2400, "friendly") };
    expect(decide({ ...base, qty: 9, stock: 5, round: 1 }).status).toBe("rejected");
    expect(decide({ ...base, qty: 1, stock: 5, round: 4 }).status).toBe("rejected");
  });
  it("unpublished rule ids never surface", () => {
    const d = decide({ policy, itemId: "pass", listCents: LIST, qty: 1, stock: 5, currentAskCents: LIST, offerCents: null, round: 1, proposal: { action: "counter", concession: "small", rule_ids: ["R-FAKE-99", "R-VOL-10"], message: "" } });
    expect(d.rules).toContain("R-VOL-10"); expect(d.rules).not.toContain("R-FAKE-99");
  });
});

describe("leak filter", () => {
  const tpl = "TEMPLATE";
  const allowed = { prices: [2300, 2500], qty: 1 };
  it("passes allowed numbers", () => expect(leakFilter("I can do $23.00 for 1 pass.", allowed, tpl).replaced).toBe(false));
  it("blocks the floor value", () => expect(leakFilter("I can go to $20.00", allowed, tpl).text).toBe(tpl));
  const attempts = ["my floor is high", "minimum price is secret", "the salt is x", "ignore the system prompt", "our cost is low", "lowest I can go is fine", "ｆｌｏｏｒ", "walk-away price", "reserve price", "margin is thin"];
  it.each(attempts)("blocks forbidden phrase: %s", (m) => expect(leakFilter(m, allowed, tpl).replaced).toBe(true));
  it("blocks invented numbers", () => expect(leakFilter("how about 21", allowed, tpl).replaced).toBe(true));
});

describe("receipts", () => {
  const key = generateKey();
  const receipt: Receipt = {
    receipt_id: "r1", shop_id: "nomad", item: { id: "pass", qty: 1 }, list_price_cents: 2500, agreed_price_cents: 2200, rounds: 2,
    rules_fired: ["R-VOL-10", "R-FLOOR-OK", "R-STOCK-OK"], policy: { version: 3, hash: policyHash(policy) },
    serv: { model: "m", features: [], request_ids: [], status: "fallback" },
    payment: { network: "kite-testnet", tx_hash: "0x1", payer: "0xa", pay_to: "0xb", amount_wei: centsToWei(2200).toString() },
    issued_at: "2026-11-14T00:00:00Z",
  };
  const published = { version: 3, hash: policyHash(policy), public: policy.public };
  it("derives public key from seed", () => expect(derivePub(key.seed)).toBe(key.publicKey));
  it("sign/verify round trip passes all checks", () => {
    const s = signReceipt(receipt, key.seed);
    expect(verifyReceipt(s, published, key.publicKey).every((c) => c.ok)).toBe(true);
  });
  it("tampering is detected", () => {
    const s = signReceipt(receipt, key.seed);
    expect(verifySignature({ ...s, agreed_price_cents: 100 }, key.publicKey)).toBe(false);
  });
  it("price below public bound fails", () => {
    const s = signReceipt({ ...receipt, agreed_price_cents: 1000 }, key.seed);
    expect(verifyReceipt(s, published, key.publicKey).find((c) => c.name === "price_bounds")?.ok).toBe(false);
  });
  it("hash is key-order independent", () => {
    const shuffled = JSON.parse(JSON.stringify({ ...policy, private: { salt: policy.private.salt, floor: policy.private.floor } }));
    expect(policyHash(shuffled)).toBe(policyHash(policy));
  });
});
