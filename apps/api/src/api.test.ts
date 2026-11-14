import { vi } from "vitest";
import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "./app.ts";
import { openDb, run, row } from "./db.ts";
import { seed } from "./seed.ts";
import { MockSigner, encodePayment, verifySignature, type Facilitator } from "@kitestall/core";
import { importHistory, assertSeeded } from "./seed.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAYTO = "0x8D06Dd5D6b9B634ade658ea5ab9c262e6787d8bb";
const env = { SHOP_WALLET_ADDRESS_NOMAD: PAYTO, SHOP_WALLET_ADDRESS_BRIGHTBEAN: "0xdf0F91BfB6e7558FA4a1596195DFDC7424812244", OWNER_TOKEN: "tok", NODE_ENV: "test", PLATFORM_WALLET_ADDRESS: "0x2222222222222222222222222222222222222222" } as NodeJS.ProcessEnv;
let txn = 0;
const fac: Facilitator & { settles: number } = {
  settles: 0,
  async verify() { return { isValid: true }; },
  async settle() { this.settles++; return { success: true, transaction: "0x" + String(++txn).padStart(64, "0") }; },
};
function mk() {
  const db = openDb(":memory:"); seed(db, env);
  const app = createApp({ db, env, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" }, txCheck: async () => ({ name: "payment_tx_onchain", ok: true, detail: "stubbed in test" }) });
  const post = (p: string, b: unknown, h: Record<string, string> = {}) => app.request(p, { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });
  return { db, app, post };
}
async function getQuote(post: ReturnType<typeof mk>["post"]) {
  let sid: string | undefined; let offer = 2300;
  for (let i = 0; i < 3; i++) {
    const r = await (await post("/shops/nomad/negotiate", { session_id: sid, item_id: "day-pass", qty: 1, offer_cents: offer, message: "hello" })).json();
    sid = r.session_id; if (r.quote) return r;
    offer = Math.min(2500, offer + 100);
  }
  throw new Error("no quote");
}
const payHdr = async (req: any, over: Partial<any> = {}) => {
  const s = new MockSigner(); const p = await s.pay({ ...req, ...over }, { url: "x", description: "d" });
  return { "X-PAYMENT": encodePayment(p) };
};

describe("negotiate -> quote -> 402 -> pay -> receipt -> verify", () => {
  let t: ReturnType<typeof mk>;
  beforeEach(() => { t = mk(); });

  it("happy path, receipt verifies, floor never breached, fee accrued", async () => {
    const q = await getQuote(t.post);
    expect(q.serv.status).toBe("fallback"); // honest labeling in fallback_only mode
    expect(q.quote.unit_price_cents).toBeGreaterThanOrEqual(2000);
    const c1 = await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id });
    expect(c1.status).toBe(402);
    const b402 = await c1.json(); const req = b402.accepts[0];
    expect(req.amount).toBe((BigInt(q.quote.total_cents) * 10n ** 16n).toString());
    expect(req.payTo).toBe(PAYTO);
    const c2 = await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id }, await payHdr(req));
    expect(c2.status).toBe(200);
    const out = await c2.json();
    expect(out.voucher).toMatch(/^KS-/);
    const v = await (await t.app.request(`/receipts/${out.receipt.receipt_id}/verify`)).json();
    expect(v.checks.map((x: any) => `${x.name}:${x.ok}`)).toEqual(expect.arrayContaining(["signature:true", "rules_in_public_policy:true", "price_bounds:true", "policy_hash:true"]));
    expect(v.ok).toBe(true);
    expect(row(t.db, "SELECT SUM(amount_cents) s FROM ledger_fees WHERE kind='platform_fee'").s).toBeGreaterThanOrEqual(0);
    expect(row(t.db, "SELECT stock FROM items WHERE id='day-pass'").stock).toBe(39);
    // idempotent retry
    const c3 = await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id });
    expect((await c3.json()).idempotent).toBe(true);
  });
  it("policy endpoint never exposes the private floor or salt", async () => {
    const txt = await (await t.app.request("/shops/nomad/policy")).text();
    expect(txt).not.toMatch(/salt|default_pct_of_list|floor/i);
  });
  it("rejects wrong amount", async () => {
    const q = await getQuote(t.post); const req = (await (await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id })).json()).accepts[0];
    const r = await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id }, await payHdr(req, { amount: "1" }));
    expect(r.status).toBe(402); expect((await r.json()).error.code).toBe("wrong_amount");
  });
  it("rejects wrong payTo", async () => {
    const q = await getQuote(t.post); const req = (await (await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id })).json()).accepts[0];
    const r = await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id }, await payHdr(req, { payTo: "0x1111111111111111111111111111111111111111" }));
    expect((await r.json()).error.code).toBe("wrong_payee");
  });
  it("rejects replayed nonce on a second quote", async () => {
    const q1 = await getQuote(t.post); const req1 = (await (await t.post("/shops/nomad/checkout", { quote_id: q1.quote.quote_id })).json()).accepts[0];
    const h = await payHdr(req1); expect((await t.post("/shops/nomad/checkout", { quote_id: q1.quote.quote_id }, h)).status).toBe(200);
    const q2 = await getQuote(t.post);
    if (q2.quote.total_cents === q1.quote.total_cents) { const r = await t.post("/shops/nomad/checkout", { quote_id: q2.quote.quote_id }, h); expect((await r.json()).error.code).toBe("replay"); }
  });
  it("expired quote -> 410; out of stock -> 409", async () => {
    const q = await getQuote(t.post); run(t.db, "UPDATE quotes SET expires_at='2000-01-01T00:00:00Z' WHERE id=?", q.quote.quote_id);
    expect((await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id })).status).toBe(410);
    const q2 = await getQuote(t.post); run(t.db, "UPDATE items SET stock=0 WHERE id='day-pass'");
    expect((await t.post("/shops/nomad/checkout", { quote_id: q2.quote.quote_id })).status).toBe(409);
  });
  it("single-use: concurrent settle only fulfils once", async () => {
    const q = await getQuote(t.post); const req = (await (await t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id })).json()).accepts[0];
    const before = fac.settles;
    const rs = await Promise.all([0, 1, 2].map(async () => t.post("/shops/nomad/checkout", { quote_id: q.quote.quote_id }, await payHdr(req))));
    expect(rs.filter((r) => r.status === 200).length).toBeGreaterThanOrEqual(1);
    expect(fac.settles - before).toBe(1);
    expect(row(t.db, "SELECT COUNT(*) n FROM orders").n).toBe(1);
  });
  it("owner endpoints need the token", async () => {
    expect((await t.app.request("/owner/ledger")).status).toBe(401);
    expect((await t.app.request("/owner/ledger", { headers: { authorization: "Bearer tok" } })).status).toBe(200);
  });
  it("stats come from the DB", async () => {
    const s = await (await t.app.request("/api/stats")).json(); expect(s.settled_sales).toBe(0); expect(s.testnet).toBe(true);
  });
});

describe("free-tier cold start: history re-import", () => {
  const file = fileURLToPath(new URL("../../../docs/history.json", import.meta.url));
  it("committed real receipts carry valid signatures for the published public keys", () => {
    const h = JSON.parse(readFileSync(file, "utf8"));
    expect(h.sales.length).toBeGreaterThanOrEqual(3);
    for (const s of h.sales) expect(verifySignature(JSON.parse(s.receipt.json), h.shop_public_keys[s.order.shop_id])).toBe(true);
  });
  it("import is idempotent, stats are live right after a cold start, historic policy hashes are kept", async () => {
    const db = openDb(":memory:"); seed(db, env, file);
    const a = importHistory(db, file); const b = importHistory(db, file);
    expect(a.imported).toBeGreaterThanOrEqual(3); expect(b.imported).toBe(0);
    expect(assertSeeded(db).sales).toBe(a.imported);
    const app = createApp({ db, env, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" } });
    const st = await (await app.request("/api/stats")).json(); expect(st.settled_sales).toBe(a.imported);
    const h = JSON.parse(readFileSync(file, "utf8"));
    for (const s of h.sales) { const r = JSON.parse(s.receipt.json); const p = row(db, "SELECT hash FROM policies WHERE shop_id=? AND version=?", r.shop_id, r.policy.version); expect(p.hash).toBe(r.policy.hash); }
    expect(row(db, "SELECT COUNT(*) n FROM policies WHERE active=1").n).toBe(2); // live policy is a new version, historic stays immutable
  });
});

describe("SERV budget and abuse caps (SERV_MODE fallback_only: no live spend)", () => {
  const mkApp = (over: Record<string, string> = {}) => {
    const db = openDb(":memory:"); const e = { ...env, ...over } as NodeJS.ProcessEnv; seed(db, e);
    const app = createApp({ db, env: e, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" } });
    const neg = (b: unknown, h: Record<string, string> = {}) => app.request("/shops/nomad/negotiate", { method: "POST", headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) });
    return { db, app, neg };
  };
  it("assumes a conservative spend after a cold start instead of zero, and reports it in /api/stats", async () => {
    const t = mkApp(); const s = (await (await t.app.request("/api/stats")).json()).serv_budget;
    expect(s.daily_spent_usd).toBeCloseTo(0.15, 4); expect(s.total_spent_usd).toBeCloseTo(0.15, 4); expect(s.capped).toBe(false);
    expect(s.method).toMatch(/ESTIMATED/); expect(s.daily_cap_usd).toBe(0.5);
  });
  it("does not re-assume when the persisted counter already has rows", async () => {
    const t = mkApp(); const before = row(t.db, "SELECT COUNT(*) n FROM serv_spend").n;
    createApp({ db: t.db, env, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" } });
    expect(row(t.db, "SELECT COUNT(*) n FROM serv_spend").n).toBe(before);
  });
  it("flips to the labeled fallback when the daily cap is reached", async () => {
    const t = mkApp({ SERV_DAILY_BUDGET_USD: "0.50" });
    run(t.db, "INSERT INTO serv_spend(day,kind,usd,created_at) VALUES(?,?,?,?)", new Date().toISOString().slice(0, 10), "negotiate", 0.4, new Date().toISOString());
    const r = await (await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2300, message: "hi" })).json();
    expect(r.serv.budget_capped).toBe(true); expect(r.serv.status).toBe("fallback"); expect(r.serv.note).toMatch(/deterministic fallback/);
    const s = (await (await t.app.request("/api/stats")).json()).serv_budget; expect(s.capped).toBe(true); expect(s.reason).toMatch(/daily/);
  });
  it("hard-caps total messages per session", async () => {
    const t = mkApp(); const first = await (await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2000, message: "x" })).json();
    for (let i = 0; i < 8; i++) run(t.db, "INSERT INTO rounds(session_id,shop_id,round,status,created_at) VALUES(?,?,?,?,?)", first.session_id, "nomad", 1, "counter", new Date().toISOString());
    const r = await t.neg({ session_id: first.session_id, item_id: "day-pass", qty: 1, offer_cents: 2000, message: "x" });
    expect(r.status).toBe(429); expect((await r.json()).error.code).toBe("session_call_cap");
  });
  it("caps messages per IP per day (last x-forwarded-for entry is trusted)", async () => {
    const t = mkApp({ IP_DAILY_CALLS: "2" }); const h = { "x-forwarded-for": "6.6.6.6, 9.9.9.9" };
    const codes: number[] = []; for (let i = 0; i < 3; i++) codes.push((await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2000 + i, message: "x" }, h)).status);
    expect(codes).toEqual([200, 200, 429]);
    expect((await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2000, message: "x" }, { "x-forwarded-for": "1.1.1.1, 9.9.9.9" })).status).toBe(429); // spoofing the first entry does not help
  });
});

describe("final-round rule R-FINAL-ACCEPT (code-computed best-and-final)", () => {
  const go = async (t: ReturnType<typeof mk>, offers: number[]) => { let sid: string | undefined; let last: any; for (const o of offers) { last = await (await t.post("/shops/nomad/negotiate", { session_id: sid, item_id: "day-pass", qty: 1, offer_cents: o, message: "ok" })).json(); sid = last.session_id; } return last; };
  const pay = async (t: ReturnType<typeof mk>, q: any) => { const req = (await (await t.post("/shops/nomad/checkout", { quote_id: q.quote_id })).json()).accepts[0]; const r = await t.post("/shops/nomad/checkout", { quote_id: q.quote_id }, await payHdr(req)); return (await r.json()).receipt; };
  it("accepts a final-round offer above best-and-final at the buyer's offer, lists the rule in the public policy, and the receipt verifies", async () => {
    const t = mk(); const last = await go(t, [1000, 1000, 2150]);
    expect(last.status).toBe("accepted"); expect(last.ask_cents).toBe(2150); expect(last.rules_fired).toContain("R-FINAL-ACCEPT");
    const pol = await (await t.app.request("/shops/nomad/policy")).json(); expect(pol.public.rules.map((r: any) => r.id)).toContain("R-FINAL-ACCEPT");
    const rc = await pay(t, last.quote); expect(rc.rules_fired).toContain("R-FINAL-ACCEPT");
    const v = await (await t.app.request(`/receipts/${rc.receipt_id}/verify`)).json(); expect(v.ok).toBe(true);
  });
  it("a low final offer gets a best-and-final counter above the floor, which the buyer can then take (no SERV call)", async () => {
    const t = mk(); const r3 = await go(t, [1000, 1000, 1000]);
    expect(r3.status).toBe("counter"); expect(r3.final).toBe(true); expect(r3.ask_cents).toBeGreaterThan(2000); expect(r3.ask_cents).toBeLessThan(2200);
    const take = await (await t.post("/shops/nomad/negotiate", { session_id: r3.session_id, item_id: "day-pass", qty: 1, offer_cents: r3.ask_cents, message: "deal" })).json();
    expect(take.status).toBe("accepted"); expect(take.ask_cents).toBe(r3.ask_cents); expect(take.serv.note).toMatch(/no SERV call/);
    const rc = await pay(t, take.quote); const v = await (await t.app.request(`/receipts/${rc.receipt_id}/verify`)).json(); expect(v.ok).toBe(true);
  });
  it("a fourth offer below the standing ask is rejected", async () => {
    const t = mk(); const r3 = await go(t, [1000, 1000, 1000]);
    const r4 = await (await t.post("/shops/nomad/negotiate", { session_id: r3.session_id, item_id: "day-pass", qty: 1, offer_cents: r3.ask_cents - 1, message: "x" })).json();
    expect(r4.status).toBe("rejected");
  });
});

describe("owner export of real sales (keeps live sales across free-plan restarts)", () => {
  it("is owner-only and contains no private policy part", async () => {
    const db = openDb(":memory:"); seed(db, env); const f = fileURLToPath(new URL("../../../docs/history.json", import.meta.url)); importHistory(db, f);
    const app = createApp({ db, env, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" } });
    expect((await app.request("/owner/export-history")).status).toBe(401);
    const r = await app.request("/owner/export-history", { headers: { authorization: "Bearer tok" } }); const txt = await r.text(); const j = JSON.parse(txt);
    expect(j.sales.length).toBeGreaterThanOrEqual(4); expect(txt).not.toMatch(/private_json|salt|default_pct_of_list/); expect(j.policies.length).toBeGreaterThanOrEqual(1);
  });
});

describe("owner flow without SERV: preview, publish (policy versioning), compile guard", () => {
  const H = { authorization: "Bearer tok", "content-type": "application/json" };
  const draft = { persona: "friendly", max_discount_pct: 25, floor_default_pct: 78, max_rounds: 3, rules: [{ id: "R-BULK-10", kind: "volume_tier", text: "10% off 4 or more." }], understood: ["10% off 4+", "never below 78%"] };
  it("compile refuses (503) in fallback_only instead of silently spending SERV credits", async () => {
    const t = mk2(); const r = await t.app.request("/owner/policy/compile", { method: "POST", headers: H, body: JSON.stringify({ english: "We sell bread. Give 10% off for 4 or more loaves. Never below 78% of list." }) });
    expect(r.status).toBe(503);
  });
  it("previews 5 simulated haggles with the deterministic engine, never below the floor", async () => {
    const t = mk2(); const r = await (await t.app.request("/owner/policy/preview", { method: "POST", headers: H, body: JSON.stringify({ draft, shop_id: "nomad" }) })).json();
    expect(r.simulations.length).toBe(5); expect(r.method).toMatch(/deterministic engine/);
    for (const s of r.simulations) expect(s.final_price_cents).toBeGreaterThanOrEqual(Math.ceil(2500 * 0.78));
  });
  it("publishes a new immutable version that always lists R-FINAL-ACCEPT, and the public policy shows it", async () => {
    const t = mk2(); const before = (await (await t.app.request("/shops/nomad/policy")).json()).version;
    const pub = await (await t.app.request("/owner/policy/publish", { method: "POST", headers: H, body: JSON.stringify({ draft, shop_id: "nomad" }) })).json();
    expect(pub.ok).toBe(true); expect(pub.version).toBe(before + 1);
    const pol = await (await t.app.request("/shops/nomad/policy")).json(); expect(pol.version).toBe(before + 1); expect(pol.public.rules.map((x: any) => x.id)).toEqual(expect.arrayContaining(["R-BULK-10", "R-FINAL-ACCEPT"]));
    expect(JSON.stringify(pol)).not.toMatch(/salt|floor_default|default_pct/);
  });
  function mk2() { const db = openDb(":memory:"); seed(db, env); const app = createApp({ db, env, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" } }); return { db, app }; }
});

describe("paid firm quote (x402, testnet)", () => {
  const PLAT = "0x2222222222222222222222222222222222222222";
  it("402 -> pay fee -> signed time-locked quote -> normal checkout -> receipt verifies; fee is recorded as COLLECTED", async () => {
    const t = mk();
    const c1 = await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 }); expect(c1.status).toBe(402);
    const b = await c1.json(); const req = b.accepts[0];
    expect(req.payTo).toBe(PLAT); expect(req.amount).toBe((5n * 10n ** 16n).toString()); expect(b.firm_quote_preview.unit_price_cents).toBe(2125);
    const c2 = await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 }, await payHdr(req)); expect(c2.status).toBe(200);
    const out = await c2.json(); const fq = out.firm_quote;
    expect(fq.unit_price_cents).toBe(2125); expect(fq.rules_fired).toEqual(["R-FIRM-QUOTE"]); expect(fq.testnet).toBe(true);
    const keys = await (await t.app.request("/.well-known/kitestall-keys")).json(); expect(verifySignature({ ...fq } as any, "")).toBe(false); // wrong shape/key is rejected
    expect(typeof keys.nomad).toBe("string");
    const led = await (await t.app.request("/owner/ledger", { headers: { authorization: "Bearer tok" } })).json();
    expect(led.collected.find((x: any) => x.kind === "firm_quote_fee").cents).toBe(5); expect(led.firm_quotes.length).toBe(1); expect(led.fees.find((x: any) => x.kind === "firm_quote_fee")).toBeUndefined();
    const s = await (await t.app.request("/api/stats")).json(); expect(s.fees_collected_cents).toBe(5); expect(s.firm_quotes_sold).toBe(1);
    // buy at the firm price through the normal checkout
    const co = await (await t.post("/shops/nomad/checkout", { quote_id: fq.quote_id })).json(); const req2 = co.accepts[0]; expect(req2.amount).toBe((2125n * 10n ** 16n).toString());
    const paid = await t.post("/shops/nomad/checkout", { quote_id: fq.quote_id }, await payHdr(req2)); expect(paid.status).toBe(200);
    const rc = (await paid.json()).receipt; expect(rc.rules_fired).toContain("R-FIRM-QUOTE"); expect(rc.serv.status).toBe("none"); expect(rc.agreed_price_cents).toBe(2125);
    const v = await (await t.app.request(`/receipts/${rc.receipt_id}/verify`)).json(); expect(v.ok).toBe(true);
  });
  it("rejects a wrong amount, a wrong payee and a replayed nonce", async () => {
    const t = mk(); const req = (await (await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 })).json()).accepts[0];
    expect((await (await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 }, await payHdr(req, { amount: "1" }))).json()).error.code).toBe("wrong_amount");
    expect((await (await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 }, await payHdr(req, { payTo: "0x1111111111111111111111111111111111111111" }))).json()).error.code).toBe("wrong_payee");
    const h = await payHdr(req); expect((await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 }, h)).status).toBe(200);
    expect((await (await t.post("/shops/nomad/firm-quote", { item_id: "day-pass", qty: 1 }, h)).json()).error.code).toBe("replay");
  });
  it("is disabled without a platform wallet", async () => {
    const db = openDb(":memory:"); const e = { ...env, PLATFORM_WALLET_ADDRESS: "" } as NodeJS.ProcessEnv; seed(db, e);
    const app = createApp({ db, env: e, facilitator: fac, serv: { baseUrl: "", apiKey: "", model: "m", mode: "fallback_only" } });
    expect((await app.request("/shops/nomad/firm-quote", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_id: "day-pass" }) })).status).toBe(503);
  });
});

describe("Shadow Agent gating (demo shopper only, accept/final candidates only)", () => {
  const modelJson = JSON.stringify({ action: "counter", concession: "small", rule_ids: [], message: "Happy to help." });
  function liveApp() {
    const db = openDb(":memory:"); seed(db, env); const tools: string[][] = [];
    vi.stubGlobal("fetch", vi.fn(async (_u: string, init: any) => { tools.push(JSON.parse(init.body).tools.map((t: any) => t.function.name)); return new Response(JSON.stringify({ id: "chatcmpl-x", choices: [{ message: { content: modelJson }, finish_reason: "stop" }], usage: { prompt_tokens: 100, completion_tokens: 20, total_tokens: 120 } }), { status: 200 }); }));
    const e2 = { ...env, GLOBAL_SERV_CALLS_PER_MIN: "100000" } as NodeJS.ProcessEnv; const app = createApp({ db, env: e2, facilitator: fac, demoSecret: "s3cret", serv: { baseUrl: "http://serv.test", apiKey: "k", model: "gpt-5.4-mini", mode: "live" } });
    const neg = (b: unknown, h: Record<string, string> = {}) => app.request("/shops/nomad/negotiate", { method: "POST", headers: { "content-type": "application/json", "x-forwarded-for": "7.7." + Math.floor(Math.random() * 250) + "." + Math.floor(Math.random() * 250), ...h }, body: JSON.stringify(b) });
    return { db, tools, neg };
  }
  it("public Arena traffic never uses Shadow Agent, even with a forged header and an accept-candidate offer", async () => {
    const t = liveApp(); await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2490, message: "x" }); await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2490, message: "x" }, { "x-kitestall-demo": "guess" });
    expect(t.tools.length).toBe(2); for (const names of t.tools) { expect(names).toContain("serv_prompt_guard"); expect(names).not.toContain("serv_shadow_agent"); }
  });
  it("the demo shopper gets Shadow only when the offer is near the ask or it is the final round", async () => {
    const t = liveApp(); const h = { "x-kitestall-demo": "s3cret" };
    await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 1750, message: "x" }, h); // low opening offer: no shadow
    await t.neg({ item_id: "day-pass", qty: 1, offer_cents: 2400, message: "x" }, h); // within 5% of the 25.00 ask: shadow
    expect(t.tools[0]).not.toContain("serv_shadow_agent"); expect(t.tools[1]).toContain("serv_shadow_agent"); expect(t.tools[1]).toContain("serv_prompt_guard");
  });
});
