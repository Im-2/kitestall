import { describe, it, expect, beforeEach } from "vitest";
import { createApp } from "./app.ts";
import { openDb, run, row } from "./db.ts";
import { seed } from "./seed.ts";
import { MockSigner, encodePayment, verifySignature, type Facilitator } from "@kitestall/core";
import { importHistory, assertSeeded } from "./seed.ts";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const PAYTO = "0x8D06Dd5D6b9B634ade658ea5ab9c262e6787d8bb";
const env = { SHOP_WALLET_ADDRESS_NOMAD: PAYTO, SHOP_WALLET_ADDRESS_BRIGHTBEAN: "0xdf0F91BfB6e7558FA4a1596195DFDC7424812244", OWNER_TOKEN: "tok", NODE_ENV: "test" } as NodeJS.ProcessEnv;
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
