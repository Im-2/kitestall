import { Hono, type Context } from "hono";
import { streamSSE } from "hono/streaming";
import { serveStatic } from "@hono/node-server/serve-static";
import { z } from "zod";
import { randomBytes, randomUUID, createHash } from "node:crypto";
import { createPublicClient, http } from "viem";
import {
  negotiateRound, build402, decodePayment, centsToWei, weiToCents, feeBps, signReceipt, verifyReceipt, policyHash, publicView, compilePolicy,
  PolicySpecSchema, effectiveFloor, decide, fallbackProposal, KITE_TESTNET, DevSigner, estimateCostUsd,
  type PolicySpec, type Facilitator, type ServConfig, type Receipt, type Check,
} from "@kitestall/core";
import { runShopper } from "@kitestall/shopper";
import { now, row, rows, run, tx, type DB } from "./db.ts";

export interface Deps {
  db: DB; serv: ServConfig; facilitator: Facilitator; env: NodeJS.ProcessEnv;
  /** on-chain verification of the settled tx; injectable for tests */
  txCheck?: (hash: string, payTo: string, amountWei: string, asset: string) => Promise<Check>;
  staticDir?: string;
}

const err = (c: Context, status: number, code: string, message: string, extra: object = {}) => c.json({ error: { code, message, ...extra } }, status as any);
const id = (p: string) => `${p}_${randomBytes(6).toString("hex")}`;

// ---------- trace bus (SSE) ----------
const bus = new Map<string, { events: any[]; subs: Set<(e: any) => void> }>();
export function emitTrace(session: string, e: Record<string, unknown>) {
  let b = bus.get(session); if (!b) { b = { events: [], subs: new Set() }; bus.set(session, b); if (bus.size > 500) bus.delete(bus.keys().next().value!); }
  const ev = { ts: now(), ...e }; b.events.push(ev); if (b.events.length > 50) b.events.shift(); b.subs.forEach((f) => f(ev));
}

// ---------- rate limiting (in-memory token bucket) ----------
const buckets = new Map<string, { n: number; t: number }>();
function limited(key: string, max: number, windowMs: number) {
  const t = Date.now(); const b = buckets.get(key);
  if (!b || t - b.t > windowMs) { buckets.set(key, { n: 1, t }); return false; }
  b.n++; return b.n > max;
}

export function loadPolicy(db: DB, shopId: string, version?: number): PolicySpec | null {
  const r = version ? row(db, "SELECT * FROM policies WHERE shop_id=? AND version=?", shopId, version) : row(db, "SELECT * FROM policies WHERE shop_id=? AND active=1 ORDER BY version DESC LIMIT 1", shopId);
  if (!r) return null;
  return { shop_id: shopId, version: r.version, created_at: r.created_at, public: JSON.parse(r.public_json), private: JSON.parse(r.private_json) };
}

const TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
export async function rpcTxCheck(hash: string, payTo: string, amountWei: string, asset: string): Promise<Check> {
  try {
    const c = createPublicClient({ transport: http(KITE_TESTNET.rpc) });
    const rc = await c.getTransactionReceipt({ hash: hash as `0x${string}` });
    const ok = rc.status === "success" && rc.logs.some((l) => l.address.toLowerCase() === asset.toLowerCase() && l.topics[0] === TRANSFER_TOPIC && l.topics[2]?.toLowerCase().endsWith(payTo.slice(2).toLowerCase()) && BigInt(l.data) === BigInt(amountWei));
    return { name: "payment_tx_onchain", ok, detail: ok ? `Transfer of ${amountWei} wei to payTo found in tx on Kite testnet` : "tx found but no matching Transfer log" };
  } catch (e) { return { name: "payment_tx_onchain", ok: false, detail: `tx lookup failed: ${(e as Error).message.slice(0, 80)}` }; }
}

export function createApp(d: Deps) {
  const { db, env } = d;
  const app = new Hono();
  const explorer = env.KITE_EXPLORER_BASE || KITE_TESTNET.explorer;
  const feeBpsV = Number(env.PLATFORM_FEE_BPS ?? 100), quoteFee = Number(env.QUOTE_FEE_CENTS ?? 1), freeQ = Number(env.FREE_QUOTES_PER_DAY ?? 10);
  const budgetUsd = env.SERV_DAILY_BUDGET_USD ? Number(env.SERV_DAILY_BUDGET_USD) : Infinity;
  const baseUrl = () => env.PUBLIC_BASE_URL || `http://localhost:${env.PORT ?? 8787}`;
  const ip = (c: Context) => (c.req.header("x-forwarded-for") ?? "local").split(",")[0]!.trim();

  app.use("*", async (c, next) => { // public rate limit
    if (!c.req.path.startsWith("/assets") && limited(`ip:${ip(c)}`, 240, 60_000)) return err(c, 429, "rate_limited", "Too many requests");
    await next();
  });
  app.onError((e, c) => { console.error("ERR", e.message); return err(c, 500, "internal", "Internal error"); });

  app.get("/healthz", (c) => c.json({ ok: true, network: "kite-testnet" }));

  const shopRow = (sid: string) => row(db, "SELECT * FROM shops WHERE id=?", sid);

  app.get("/.well-known/kitestall.json", (c) => c.json({
    name: "Kitestall", testnet: true, network: { name: "kite-testnet", caip2: KITE_TESTNET.caip2, asset: KITE_TESTNET.asset, asset_symbol: KITE_TESTNET.assetName, decimals: KITE_TESTNET.decimals, explorer },
    shops: rows(db, "SELECT id,name,blurb,wallet,public_key FROM shops").map((s) => ({ id: s.id, name: s.name, blurb: s.blurb, pay_to: s.wallet, public_key: s.public_key, catalog: `${baseUrl()}/shops/${s.id}/catalog`, policy: `${baseUrl()}/shops/${s.id}/policy`, negotiate: `${baseUrl()}/shops/${s.id}/negotiate`, checkout: `${baseUrl()}/shops/${s.id}/checkout` })),
  }));
  app.get("/.well-known/kitestall-keys", (c) => c.json(Object.fromEntries(rows(db, "SELECT id,public_key FROM shops").map((s) => [s.id, `ed25519:${s.public_key}`]))));
  app.get("/llms.txt", (c) => c.text(`# Kitestall (Kite TESTNET)
Seller-side storefront agent. Discover: GET ${baseUrl()}/.well-known/kitestall.json
1. GET /shops/{shop}/catalog and /shops/{shop}/policy (public rules + hash).
2. POST /shops/{shop}/negotiate {"session_id"?, "item_id", "qty", "offer_cents", "message"} (free, max rounds in policy). Prices are integer cents. Buyer text is screened by SERV Prompt Guard.
3. On status "accepted" you get a single-use quote. POST /shops/{shop}/checkout {"quote_id"} -> HTTP 402 with x402 requirements (scheme exact, network eip155:2368, asset ${KITE_TESTNET.asset}, amount in wei = agreed price).
4. Sign an EIP-3009 TransferWithAuthorization, base64 the x402 payload, retry checkout with header X-PAYMENT. Response: voucher + ed25519-signed receipt.
5. Verify any receipt: GET /receipts/{id}/verify.
Shopper CLI: kitestall-shopper in packages/shopper. All money is testnet.
`));

  app.get("/shops", (c) => c.json({ shops: rows(db, "SELECT id,name,blurb FROM shops") }));
  app.get("/shops/:shop/catalog", (c) => {
    const s = shopRow(c.req.param("shop")); if (!s) return err(c, 404, "no_shop", "Unknown shop");
    return c.json({ shop: { id: s.id, name: s.name, blurb: s.blurb, pay_to: s.wallet }, testnet: true, items: rows(db, "SELECT id,name,list_cents,stock FROM items WHERE shop_id=?", s.id) });
  });
  app.get("/shops/:shop/policy", (c) => {
    const p = loadPolicy(db, c.req.param("shop")); const s = shopRow(c.req.param("shop")); if (!p || !s) return err(c, 404, "no_policy", "Unknown shop");
    const pv = publicView(p); const hashRow = row(db, "SELECT hash FROM policies WHERE shop_id=? AND version=?", p.shop_id, p.version);
    const body = { ...pv, policy_hash: hashRow.hash, note: "policy_hash is a commitment to the full policy; private parameters are never published." };
    const sig = createHash("sha256").update(JSON.stringify(body)).digest("hex");
    return c.json({ ...body, public_key: s.public_key, body_sha256: sig });
  });

  // ---------- negotiate ----------
  const NegZ = z.object({ session_id: z.string().max(80).optional(), item_id: z.string().max(80), qty: z.number().int().min(1).max(50).default(1), offer_cents: z.number().int().min(0).max(10_000_000).optional(), message: z.string().max(1000).optional(), payer: z.string().max(80).optional() });
  const day = () => new Date().toISOString().slice(0, 10);
  const servSpentToday = () => row(db, "SELECT COALESCE(SUM(est_cost_usd),0) s FROM rounds WHERE created_at >= ?", day())?.s ?? 0;

  app.post("/shops/:shop/negotiate", async (c) => {
    if (limited(`neg:${ip(c)}`, 40, 60_000)) return err(c, 429, "rate_limited", "Slow down");
    const shopId = c.req.param("shop"); const shop = shopRow(shopId); if (!shop) return err(c, 404, "no_shop", "Unknown shop");
    const parsed = NegZ.safeParse(await c.req.json().catch(() => null)); if (!parsed.success) return err(c, 400, "bad_request", parsed.error.issues[0]?.message ?? "invalid body");
    const b = parsed.data;
    const item = row(db, "SELECT * FROM items WHERE shop_id=? AND id=?", shopId, b.item_id); if (!item) return err(c, 404, "no_item", "Unknown item");
    const policy = loadPolicy(db, shopId)!;
    let sess = b.session_id ? row(db, "SELECT * FROM sessions WHERE id=?", b.session_id) : undefined;
    if (sess && (sess.shop_id !== shopId || sess.item_id !== b.item_id)) return err(c, 400, "bad_session", "Session belongs to another shop/item");
    if (sess && sess.status !== "open") return err(c, 409, "session_closed", `Session is ${sess.status}`);
    const sid = sess?.id ?? (b.session_id && /^[A-Za-z0-9_-]{8,80}$/.test(b.session_id) ? b.session_id : id("s"));
    if (!sess) { run(db, "INSERT INTO sessions(id,shop_id,item_id,qty,ask_cents,round,status,buyer,ip,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", sid, shopId, item.id, b.qty, item.list_cents, 0, "open", b.payer ?? null, ip(c), now()); sess = row(db, "SELECT * FROM sessions WHERE id=?", sid); }
    const recent = row(db, "SELECT COUNT(*) n FROM sessions WHERE item_id=? AND (ip=? OR buyer=?) AND created_at>=?", b.item_id, ip(c), b.payer ?? "-", new Date(Date.now() - 3600_000).toISOString())?.n ?? 0;
    if (ip(c) !== "local" && (!b.session_id || !row(db, "SELECT 1 x FROM rounds WHERE session_id=?", sid)) && recent > 8) return err(c, 429, "too_many_sessions", "Too many negotiation sessions for this item; try later");
    const round = sess.round + 1;
    emitTrace(sid, { phase: "received", round });
    if (round > policy.public.max_rounds) {
      run(db, "UPDATE sessions SET status='rejected' WHERE id=?", sid);
      return c.json({ session_id: sid, round, status: "rejected", ask_cents: sess.ask_cents, message: "We've reached the round limit for this item.", rules_fired: ["R-ROUND-CAP"], serv: null });
    }
    const buyerKey = b.payer ?? ip(c);
    const used = row(db, "SELECT COUNT(*) n FROM rounds r JOIN sessions s ON s.id=r.session_id WHERE (s.buyer=? OR s.ip=?) AND r.created_at>=?", buyerKey, buyerKey, day())?.n ?? 0;
    if (used >= freeQ) run(db, "INSERT INTO ledger_fees(shop_id,kind,ref,amount_cents,created_at) VALUES(?,?,?,?,?)", shopId, "quote_fee", sid, quoteFee, now());
    const killSwitch = servSpentToday() >= budgetUsd;
    emitTrace(sid, { phase: "guard", detail: "Prompt Guard screening buyer text" });
    const r = await negotiateRound({
      policy, shopName: shop.name, itemId: item.id, itemName: item.name, listCents: item.list_cents, qty: b.qty, stock: item.stock,
      currentAskCents: sess.ask_cents, offerCents: b.offer_cents ?? null, round, buyerMessage: b.message, serv: killSwitch ? { ...d.serv, mode: "fallback_only" } : d.serv,
    });
    emitTrace(sid, { phase: "decision", guard: r.guard, concession: r.concession, action: r.action, status: r.status, ask_cents: r.askCents, rules: r.rulesFired, serv_status: r.servStatus });
    run(db, "INSERT INTO rounds(session_id,shop_id,round,buyer_message,offer_cents,status,ask_cents,message,rules_json,guard,serv_status,concession,action,serv_json,est_cost_usd,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
      sid, shopId, round, (b.message ?? "").slice(0, 600), b.offer_cents ?? null, r.status, r.askCents, r.message, JSON.stringify(r.rulesFired), r.guard, r.servStatus, r.concession, r.action, JSON.stringify(r.serv), r.serv?.estCostUsd ?? 0, now());
    if (r.attack) run(db, "INSERT INTO events(kind,shop_id,session_id,detail,created_at) VALUES('attack',?,?,?,?)", shopId, sid, JSON.stringify({ message: (b.message ?? "").slice(0, 120), guard: "blocked" }), now());
    if (r.servStatus === "fallback") run(db, "INSERT INTO events(kind,shop_id,session_id,detail,created_at) VALUES('fallback',?,?,?,?)", shopId, sid, JSON.stringify({ reason: r.fallbackReason }), now());
    if (r.leakReplaced) run(db, "INSERT INTO events(kind,shop_id,session_id,detail,created_at) VALUES('leak_filter',?,?,?,?)", shopId, sid, JSON.stringify({ reason: r.leakReason }), now());
    let quote: any = null;
    const status = r.status;
    run(db, "UPDATE sessions SET round=?, ask_cents=?, status=? WHERE id=?", r.attack ? sess.round : round, status === "counter" || status === "accepted" ? r.askCents : sess.ask_cents, status === "accepted" ? "accepted" : status === "rejected" ? "rejected" : "open", sid);
    if (status === "accepted") {
      const qid = id("q"); const ttl = policy.public.quote_ttl_seconds; const total = r.askCents * b.qty;
      run(db, "INSERT INTO quotes(id,session_id,shop_id,item_id,qty,unit_price_cents,total_cents,policy_version,status,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", qid, sid, shopId, item.id, b.qty, r.askCents, total, policy.version, "open", new Date(Date.now() + ttl * 1000).toISOString(), now());
      quote = { quote_id: qid, unit_price_cents: r.askCents, total_cents: total, qty: b.qty, expires_at: new Date(Date.now() + ttl * 1000).toISOString(), testnet: true };
    }
    return c.json({ session_id: sid, round, status, ask_cents: r.askCents, quote, message: r.message, rules_fired: r.rulesFired, final: r.final,
      serv: { status: r.servStatus, guard: r.guard, model: r.serv?.model ?? null, features: r.serv?.features ?? [], request_id: r.serv?.requestId ?? null, latency_ms: r.serv?.latencyMs ?? null }, testnet: true });
  });

  app.get("/api/trace/:session/stream", (c) => streamSSE(c, async (s) => {
    const sid = c.req.param("session");
    let b = bus.get(sid); if (!b) { b = { events: [], subs: new Set() }; bus.set(sid, b); }
    const q: any[] = [...b.events]; let wake: (() => void) | null = null; const f = (e: any) => { q.push(e); wake?.(); }; b.subs.add(f);
    s.onAbort(() => { b!.subs.delete(f); });
    const t0 = Date.now();
    while (!s.aborted && Date.now() - t0 < 120_000) {
      while (q.length) await s.writeSSE({ data: JSON.stringify(q.shift()) });
      await new Promise<void>((res) => { wake = res; setTimeout(res, 15000); });
      if (!q.length) await s.writeSSE({ event: "ping", data: "{}" });
    }
    b.subs.delete(f);
  }));

  // ---------- checkout (x402) ----------
  app.post("/shops/:shop/checkout", async (c) => {
    const shopId = c.req.param("shop"); const shop = shopRow(shopId); if (!shop) return err(c, 404, "no_shop", "Unknown shop");
    const body = await c.req.json().catch(() => null); const quoteId = body?.quote_id; if (typeof quoteId !== "string") return err(c, 400, "bad_request", "quote_id required");
    const q = row(db, "SELECT * FROM quotes WHERE id=? AND shop_id=?", quoteId, shopId); if (!q) return err(c, 404, "no_quote", "Unknown quote");
    if (q.status === "consumed") { // idempotent: return the existing receipt
      const o = row(db, "SELECT * FROM orders WHERE quote_id=?", q.id); const rc = row(db, "SELECT json FROM receipts WHERE order_id=?", o?.id);
      if (rc) return c.json({ order: o, receipt: JSON.parse(rc.json), idempotent: true, explorer_url: `${explorer}/tx/${JSON.parse(rc.json).payment.tx_hash}` });
    }
    if (q.status !== "open") return err(c, 409, "quote_unavailable", `Quote is ${q.status}`);
    if (new Date(q.expires_at).getTime() < Date.now()) { run(db, "UPDATE quotes SET status='expired' WHERE id=?", q.id); return err(c, 410, "quote_expired", "Quote expired"); }
    if (!shop.wallet) return err(c, 503, "no_wallet", "Shop has no payTo wallet configured");
    const item = row(db, "SELECT * FROM items WHERE shop_id=? AND id=?", shopId, q.item_id);
    if (item.stock < q.qty) return err(c, 409, "out_of_stock", "Out of stock");
    const wei = centsToWei(q.total_cents).toString();
    const req402 = build402({ quoteId: q.id, priceCents: q.total_cents, payTo: shop.wallet, shopName: shop.name, description: `${q.qty} x ${item.name} at ${(q.unit_price_cents / 100).toFixed(2)} (Kite TESTNET)`, resourceUrl: `${baseUrl()}/shops/${shopId}/checkout`, ttl: 300 });
    const hdr = c.req.header("x-payment") ?? c.req.header("payment-signature");
    if (!hdr) return c.json(req402, 402);

    const pay = decodePayment(hdr); if (!pay?.payload?.authorization) return err(c, 400, "bad_payment", "Malformed X-PAYMENT");
    const a = pay.payload.authorization; const accepted = req402.accepts[0]!;
    const low = (s: string) => String(s).toLowerCase();
    if (low(a.to) !== low(shop.wallet) || low(pay.accepted?.payTo) !== low(shop.wallet)) return err(c, 402, "wrong_payee", "payTo does not match the shop wallet");
    if (a.value !== wei || pay.accepted?.amount !== wei) return err(c, 402, "wrong_amount", "Payment amount must equal the quote exactly", { expected_wei: wei });
    if (low(pay.accepted?.asset) !== low(accepted.asset)) return err(c, 402, "wrong_asset", "Unexpected asset");
    if (row(db, "SELECT 1 x FROM payments WHERE nonce=?", a.nonce)) return err(c, 409, "replay", "Payment nonce already used");
    // claim the quote atomically so concurrent checkouts cannot both settle
    const claimed = run(db, "UPDATE quotes SET status='settling' WHERE id=? AND status='open'", q.id);
    if (claimed.changes !== 1) return err(c, 409, "quote_unavailable", "Quote is being settled");
    const reopen = () => run(db, "UPDATE quotes SET status='open' WHERE id=? AND status='settling'", q.id);
    const v: any = await d.facilitator.verify(pay, accepted);
    if (!v?.isValid) { reopen(); return err(c, 402, "payment_invalid", `Facilitator rejected payment: ${v?.invalidReason ?? v?.error ?? "unknown"}`, { accepts: req402.accepts }); }
    run(db, "INSERT INTO payments(quote_id,nonce,payer,amount_wei,status,signer_kind,created_at) VALUES(?,?,?,?,?,?,?)", q.id, a.nonce, a.from, wei, "verified", pay.accepted ? "x402" : "", now());
    const st: any = await d.facilitator.settle(pay, accepted);
    if (!st?.success || !st.transaction) {
      const unreachable = st?.raw?.error === "facilitator_unreachable";
      run(db, "UPDATE payments SET status=?, detail=? WHERE nonce=?", unreachable ? "needs_reconcile" : "settle_failed", JSON.stringify(st?.raw ?? st).slice(0, 500), a.nonce);
      if (unreachable) { run(db, "UPDATE quotes SET status='needs_reconcile' WHERE id=?", q.id); return err(c, 502, "settle_unknown", "Settlement status unknown; flagged for reconciliation"); }
      reopen(); run(db, "DELETE FROM payments WHERE nonce=? AND status='settle_failed'", a.nonce);
      return err(c, 502, "settle_failed", `Settlement failed: ${st?.errorReason ?? "unknown"}`);
    }
    // fulfil atomically
    try {
      const out = tx(db, () => {
        const dec = run(db, "UPDATE items SET stock=stock-? WHERE shop_id=? AND id=? AND stock>=?", q.qty, shopId, q.item_id, q.qty);
        if (dec.changes !== 1) throw new Error("OUT_OF_STOCK_AFTER_PAYMENT");
        const oid = id("o"); const voucher = "KS-" + randomBytes(4).toString("hex").toUpperCase();
        run(db, "INSERT INTO orders(id,quote_id,shop_id,item_id,qty,total_cents,voucher,created_at) VALUES(?,?,?,?,?,?,?,?)", oid, q.id, shopId, q.item_id, q.qty, q.total_cents, voucher, now());
        const rds = rows(db, "SELECT * FROM rounds WHERE session_id=? ORDER BY round", q.session_id);
        const rules = [...new Set(rds.flatMap((r) => JSON.parse(r.rules_json) as string[]).filter((x) => x !== "R-PG-BLOCKED"))];
        const reqIds = rds.map((r) => JSON.parse(r.serv_json)?.requestId).filter(Boolean);
        const statuses = new Set(rds.map((r) => r.serv_status));
        const feats = [...new Set(rds.flatMap((r) => JSON.parse(r.serv_json)?.features ?? []))];
        const pol = loadPolicy(db, shopId, q.policy_version)!; const ph = row(db, "SELECT hash FROM policies WHERE shop_id=? AND version=?", shopId, q.policy_version).hash;
        const rcpt: Receipt = {
          receipt_id: id("rc"), shop_id: shopId, item: { id: q.item_id, qty: q.qty }, list_price_cents: item.list_cents, agreed_price_cents: q.unit_price_cents, rounds: rds.length,
          rules_fired: rules, policy: { version: pol.version, hash: ph },
          serv: { model: JSON.parse(rds.at(-1)?.serv_json ?? "null")?.model ?? "none", features: feats, request_ids: reqIds, status: statuses.size > 1 ? "mixed" : statuses.has("fallback") ? "fallback" : "live" },
          payment: { network: KITE_TESTNET.network, tx_hash: st.transaction, payer: a.from, pay_to: shop.wallet, amount_wei: wei, settled_via: st.raw?.via ?? "pieverse" },
          passport: { status: "not_verified_by_merchant" }, issued_at: now(),
        };
        const signed = signReceipt(rcpt, shop.signing_seed);
        run(db, "INSERT INTO receipts(id,order_id,shop_id,json,created_at) VALUES(?,?,?,?,?)", signed.receipt_id, oid, shopId, JSON.stringify(signed), now());
        run(db, "UPDATE payments SET status='settled', tx_hash=? WHERE nonce=?", st.transaction, a.nonce);
        run(db, "UPDATE quotes SET status='consumed' WHERE id=?", q.id);
        run(db, "INSERT INTO ledger_fees(shop_id,kind,ref,amount_cents,created_at) VALUES(?,?,?,?,?)", shopId, "platform_fee", oid, feeBps(q.total_cents, feeBpsV), now());
        return { order: row(db, "SELECT * FROM orders WHERE id=?", oid), receipt: signed };
      });
      return c.json({ ...out, voucher: out.order.voucher, explorer_url: `${explorer}/tx/${st.transaction}`, testnet: true });
    } catch (e) {
      run(db, "UPDATE payments SET status='needs_reconcile', tx_hash=?, detail=? WHERE nonce=?", st.transaction, String((e as Error).message), a.nonce);
      run(db, "UPDATE quotes SET status='needs_reconcile' WHERE id=?", q.id);
      return err(c, 500, "fulfilment_failed", "Payment settled but fulfilment failed; flagged for reconciliation", { tx_hash: st.transaction });
    }
  });

  // ---------- orders, receipts, verify ----------
  app.get("/orders/:id", (c) => { const o = row(db, "SELECT * FROM orders WHERE id=?", c.req.param("id")); return o ? c.json(o) : err(c, 404, "not_found", "No such order"); });
  app.get("/receipts/:id", (c) => { const r = row(db, "SELECT json FROM receipts WHERE id=?", c.req.param("id")); return r ? c.json(JSON.parse(r.json)) : err(c, 404, "not_found", "No such receipt"); });
  async function verifyAny(rcpt: Receipt) {
    const shop = shopRow(rcpt.shop_id); if (!shop) return { ok: false, checks: [{ name: "shop", ok: false, detail: "unknown shop" }] };
    const pol = row(db, "SELECT * FROM policies WHERE shop_id=? AND version=?", rcpt.shop_id, rcpt.policy?.version);
    if (!pol) return { ok: false, checks: [{ name: "policy_published", ok: false, detail: "policy version not found" }] };
    const checks: Check[] = verifyReceipt(rcpt, { version: pol.version, hash: pol.hash, public: JSON.parse(pol.public_json) }, shop.public_key);
    checks.push(await (d.txCheck ?? rpcTxCheck)(rcpt.payment?.tx_hash, rcpt.payment?.pay_to, rcpt.payment?.amount_wei, KITE_TESTNET.asset));
    const amtOk = (() => { try { return weiToCents(rcpt.payment.amount_wei) === rcpt.agreed_price_cents * rcpt.item.qty; } catch { return false; } })();
    checks.push({ name: "amount_matches_price", ok: amtOk && rcpt.payment.pay_to.toLowerCase() === shop.wallet.toLowerCase(), detail: "payment amount equals agreed price x qty and payTo equals the shop wallet" });
    return { ok: checks.every((x) => x.ok), checks, network: "kite-testnet", explorer_url: `${explorer}/tx/${rcpt.payment?.tx_hash}`, note: "Verification does not need or reveal the private floor." };
  }
  app.get("/receipts/:id/verify", async (c) => { const r = row(db, "SELECT json FROM receipts WHERE id=?", c.req.param("id")); return r ? c.json(await verifyAny(JSON.parse(r.json))) : err(c, 404, "not_found", "No such receipt"); });
  app.post("/verify", async (c) => { const b = await c.req.json().catch(() => null); const r = b?.receipt ?? b; if (!r?.receipt_id) return err(c, 400, "bad_request", "Provide a receipt JSON"); return c.json(await verifyAny(r)); });

  // ---------- stats / arena ----------
  app.get("/api/stats", (c) => {
    const n = (sql: string, ...p: any[]) => row(db, sql, ...p)?.n ?? 0;
    const lat = rows(db, "SELECT json_extract(serv_json,'$.latencyMs') l FROM rounds WHERE serv_json IS NOT NULL AND serv_json!='null' AND serv_status='live'").map((x) => x.l).filter((x: any) => typeof x === "number").sort((a: number, b: number) => a - b);
    const disc = row(db, "SELECT AVG(100.0*(i.list_cents - q.unit_price_cents)/i.list_cents) a FROM quotes q JOIN items i ON i.shop_id=q.shop_id AND i.id=q.item_id WHERE q.status IN ('consumed','open','expired')")?.a;
    return c.json({
      testnet: true, negotiations: n("SELECT COUNT(*) n FROM sessions"), rounds: n("SELECT COUNT(*) n FROM rounds"), blocked_attacks: n("SELECT COUNT(*) n FROM events WHERE kind='attack'"),
      fallback_rounds: n("SELECT COUNT(*) n FROM events WHERE kind='fallback'"), quotes: n("SELECT COUNT(*) n FROM quotes"), settled_sales: n("SELECT COUNT(*) n FROM orders"),
      volume_cents: n("SELECT COALESCE(SUM(total_cents),0) n FROM orders"), avg_discount_pct: disc == null ? null : Math.round(disc * 10) / 10,
      fees_accrued_cents: n("SELECT COALESCE(SUM(amount_cents),0) n FROM ledger_fees"), serv_latency_p50_ms: lat.length ? lat[Math.floor(lat.length / 2)] : null, serv_live_rounds: lat.length,
    });
  });
  app.get("/api/arena/leaderboard", (c) => c.json({ leaders: rows(db, `SELECT q.id, q.shop_id, q.item_id, q.unit_price_cents, i.list_cents, ROUND(100.0*(i.list_cents-q.unit_price_cents)/i.list_cents,1) AS discount_pct, q.created_at FROM quotes q JOIN items i ON i.shop_id=q.shop_id AND i.id=q.item_id ORDER BY discount_pct DESC, q.created_at ASC LIMIT 10`) }));
  app.get("/api/arena/attacks", (c) => c.json({ attacks: rows(db, "SELECT shop_id, detail, created_at FROM events WHERE kind='attack' ORDER BY id DESC LIMIT 20").map((e) => ({ shop_id: e.shop_id, message: String(JSON.parse(e.detail).message).slice(0, 80), at: e.created_at })) }));

  // ---------- demo shopper (server-side, SSE) ----------
  app.get("/api/demo-shopper/stream", (c) => {
    const pk = env.DEMO_SHOPPER_PRIVATE_KEY; const shopId = c.req.query("shop") ?? "nomad"; const scenario = c.req.query("scenario") ?? "story-a";
    return streamSSE(c, async (s) => {
      if (limited(`demo:${ip(c)}`, 3, 300_000)) { await s.writeSSE({ data: JSON.stringify({ type: "error", message: "Demo shopper is rate limited (3 runs / 5 min)" }) }); return; }
      if (!pk) { await s.writeSSE({ data: JSON.stringify({ type: "error", message: "Demo shopper wallet not configured on this server" }) }); return; }
      const sh = shopRow(shopId); const item = sh ? rows(db, "SELECT * FROM items WHERE shop_id=?", shopId)[0] : null;
      if (!sh || !item) { await s.writeSSE({ data: JSON.stringify({ type: "error", message: "unknown shop" }) }); return; }
      const pol = loadPolicy(db, shopId)!; const floor = effectiveFloor(pol, item.id, item.list_cents);
      // Story A: a SIMULATED Passport-style per-tx session cap (labeled) sits between the floor and the first ask.
      const cap = scenario === "story-a" ? Math.floor((floor + item.list_cents) / 2 / 5) * 5 - 0 : undefined;
      const signer = new DevSigner(pk, cap);
      await s.writeSSE({ data: JSON.stringify({ type: "scenario", scenario, simulated_session_cap_cents: cap ?? null, note: cap ? "Session cap is SIMULATED by the dev signer (no Passport session)." : undefined }) });
      const q: any[] = []; let wake: (() => void) | null = null; let done = false;
      const p = runShopper({ baseUrl: `http://127.0.0.1:${env.PORT ?? 8787}`, shopId, itemId: item.id, budgetCents: item.list_cents, signer, eager: scenario === "story-a", onEvent: (e) => { q.push(e); wake?.(); } }).then((r) => { q.push({ type: "done", ok: r.ok, reason: r.reason }); done = true; wake?.(); });
      while (!done || q.length) { while (q.length) await s.writeSSE({ data: JSON.stringify(q.shift()) }); if (!done) await new Promise<void>((res) => { wake = res; setTimeout(res, 20000); }); }
      await p;
    });
  });

  // ---------- owner (bearer token) ----------
  const owner = async (c: Context, next: () => Promise<void>) => {
    const tok = env.OWNER_TOKEN; const h = c.req.header("authorization") ?? "";
    if (!tok || h !== `Bearer ${tok}`) return err(c, 401, "unauthorized", "Owner token required");
    if (limited(`own:${ip(c)}`, 60, 60_000)) return err(c, 429, "rate_limited", "Slow down");
    await next();
  };
  app.use("/owner/*", owner as any);

  const DraftZ = z.object({
    persona: z.enum(["firm", "friendly", "flexible"]), max_discount_pct: z.number().int(), floor_default_pct: z.number().int(), max_rounds: z.number().int(),
    rules: z.array(z.object({ id: z.string(), kind: z.enum(["volume_tier", "bundle", "loyalty", "time_window", "cap"]), text: z.string() })), understood: z.array(z.string()).default([]),
  });
  function draftToSpec(shopId: string, version: number, dr: z.infer<typeof DraftZ>): { ok: true; spec: PolicySpec } | { ok: false; errors: string[] } {
    const spec = { shop_id: shopId, version, created_at: now(), public: { max_discount_pct: Math.min(90, Math.max(0, dr.max_discount_pct)), persona: dr.persona, max_rounds: Math.min(6, Math.max(1, dr.max_rounds || 3)), quote_ttl_seconds: 300, rules: dr.rules.map((r) => ({ id: r.id.toUpperCase().replace(/[^A-Z0-9-]/g, "-").replace(/^(?!R-)/, "R-").slice(0, 24), kind: r.kind, text: r.text.slice(0, 300), params: {} })) }, private: { floor: { default_pct_of_list: Math.min(100, Math.max(1, dr.floor_default_pct)) }, salt: randomBytes(16).toString("hex") } };
    const v = PolicySpecSchema.safeParse(spec); return v.success ? { ok: true, spec: v.data } : { ok: false, errors: v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) };
  }
  app.post("/owner/shops", async (c) => {
    const b = await c.req.json().catch(() => null); const S = z.object({ id: z.string().regex(/^[a-z0-9-]{3,30}$/), name: z.string().min(2).max(60), blurb: z.string().max(200).default(""), wallet: z.string().regex(/^0x[0-9a-fA-F]{40}$/), items: z.array(z.object({ id: z.string().regex(/^[a-z0-9-]{2,40}$/), name: z.string().max(80), list_cents: z.number().int().min(1).max(10_000_000), stock: z.number().int().min(0).max(100000) })).min(1).max(30) }).safeParse(b);
    if (!S.success) return err(c, 400, "bad_request", S.error.issues[0]?.message ?? "invalid");
    if (shopRow(S.data.id)) return err(c, 409, "exists", "Shop id taken");
    const { generateKey } = await import("@kitestall/core"); const k = generateKey();
    tx(db, () => { run(db, "INSERT INTO shops(id,name,blurb,wallet,signing_seed,public_key,created_at) VALUES(?,?,?,?,?,?,?)", S.data.id, S.data.name, S.data.blurb, S.data.wallet, k.seed, k.publicKey, now()); for (const it of S.data.items) run(db, "INSERT INTO items(shop_id,id,name,list_cents,stock) VALUES(?,?,?,?,?)", S.data.id, it.id, it.name, it.list_cents, it.stock); });
    return c.json({ shop_id: S.data.id, public_key: k.publicKey, next: "POST /owner/policy/compile then /owner/policy/publish" });
  });
  app.put("/owner/shops/:id/catalog", async (c) => {
    const sid = c.req.param("id"); if (!shopRow(sid)) return err(c, 404, "no_shop", "Unknown shop");
    const b = await c.req.json().catch(() => null); const S = z.object({ items: z.array(z.object({ id: z.string(), name: z.string(), list_cents: z.number().int().min(1), stock: z.number().int().min(0) })).min(1) }).safeParse(b); if (!S.success) return err(c, 400, "bad_request", "invalid catalog");
    tx(db, () => { for (const it of S.data.items) run(db, "INSERT INTO items(shop_id,id,name,list_cents,stock) VALUES(?,?,?,?,?) ON CONFLICT(shop_id,id) DO UPDATE SET name=excluded.name,list_cents=excluded.list_cents,stock=excluded.stock", sid, it.id, it.name, it.list_cents, it.stock); });
    return c.json({ ok: true });
  });
  app.post("/owner/policy/compile", async (c) => {
    const b = await c.req.json().catch(() => null); const english = b?.english; if (typeof english !== "string" || english.length < 20) return err(c, 400, "bad_request", "english policy text required");
    const res = await compilePolicy(d.serv, english);
    if (!res.ok) return c.json({ ok: false, error: res.error, raw: (res as any).raw ?? null }, 422);
    const z2 = DraftZ.safeParse(res.draft); if (!z2.success) return c.json({ ok: false, error: "Draft failed validation", issues: z2.error.issues, raw: res.draft }, 422);
    const spec = draftToSpec("preview", 1, z2.data); if (!spec.ok) return c.json({ ok: false, error: "Draft failed policy validation", issues: spec.errors, raw: res.draft }, 422);
    return c.json({ ok: true, draft: z2.data, understood: z2.data.understood, public_rules: spec.spec.public.rules, serv: { model: res.call.model, request_id: res.call.id, latency_ms: res.call.latencyMs } });
  });
  app.post("/owner/policy/preview", async (c) => {
    const b = await c.req.json().catch(() => null); const dr = DraftZ.safeParse(b?.draft); if (!dr.success) return err(c, 400, "bad_request", "draft invalid");
    const sid = b?.shop_id as string; const itm = sid ? row(db, "SELECT * FROM items WHERE shop_id=? ORDER BY id LIMIT 1", sid) : null; const list = itm?.list_cents ?? Number(b?.list_cents ?? 2500);
    const sp = draftToSpec(sid ?? "preview", 1, dr.data); if (!sp.ok) return err(c, 400, "bad_policy", sp.errors.join("; "));
    const sims = [55, 65, 75, 85, 95].map((pct) => {
      let ask = list; const offer = Math.round((list * pct) / 100); let last: any = null;
      for (let r = 1; r <= sp.spec.public.max_rounds; r++) { const dd = decide({ policy: sp.spec, itemId: "x", listCents: list, qty: 1, stock: 99, currentAskCents: ask, offerCents: offer, round: r, proposal: fallbackProposal(ask, offer, sp.spec.public.persona) }); last = { round: r, ...dd }; if (dd.status !== "counter") break; ask = dd.askCents; }
      return { buyer_offer_cents: offer, outcome: last.status, final_price_cents: last.askCents, rounds: last.round, rules: last.rules };
    });
    return c.json({ ok: true, list_cents: list, method: "simulated with the deterministic engine (no SERV calls); live negotiation uses SERV for concession choice and wording", simulations: sims, never_below_cents: undefined });
  });
  app.post("/owner/policy/publish", async (c) => {
    const b = await c.req.json().catch(() => null); const sid = b?.shop_id as string; if (!shopRow(sid)) return err(c, 404, "no_shop", "Unknown shop");
    const dr = DraftZ.safeParse(b?.draft); if (!dr.success) return err(c, 400, "bad_request", "draft invalid");
    const ver = (row(db, "SELECT MAX(version) v FROM policies WHERE shop_id=?", sid)?.v ?? 0) + 1; const sp = draftToSpec(sid, ver, dr.data); if (!sp.ok) return err(c, 400, "bad_policy", sp.errors.join("; "));
    const h = policyHash(sp.spec);
    tx(db, () => { run(db, "UPDATE policies SET active=0 WHERE shop_id=?", sid); run(db, "INSERT INTO policies(shop_id,version,hash,public_json,private_json,created_at,active) VALUES(?,?,?,?,?,?,1)", sid, ver, h, JSON.stringify(sp.spec.public), JSON.stringify(sp.spec.private), sp.spec.created_at); });
    return c.json({ ok: true, version: ver, policy_hash: h });
  });
  app.get("/owner/ledger", (c) => c.json({
    testnet: true, note: "Fees are ACCRUED in this ledger, not auto-collected, in the hackathon build.",
    sales: rows(db, "SELECT o.id order_id, o.shop_id, o.item_id, o.qty, o.total_cents, o.voucher, o.created_at, r.id receipt_id, json_extract(r.json,'$.payment.tx_hash') tx_hash FROM orders o JOIN receipts r ON r.order_id=o.id ORDER BY o.created_at DESC LIMIT 100").map((s) => ({ ...s, explorer_url: `${explorer}/tx/${s.tx_hash}` })),
    fees: rows(db, "SELECT kind, SUM(amount_cents) cents, COUNT(*) n FROM ledger_fees GROUP BY kind"),
    needs_reconcile: rows(db, "SELECT p.*, q.shop_id FROM payments p JOIN quotes q ON q.id=p.quote_id WHERE p.status IN ('needs_reconcile','settle_unknown')"),
  }));
  app.get("/owner/negotiations", (c) => c.json({ rounds: rows(db, "SELECT session_id, shop_id, round, offer_cents, status, ask_cents, guard, serv_status, concession, rules_json, substr(buyer_message,1,120) buyer_message, message, created_at FROM rounds ORDER BY id DESC LIMIT 100") }));

  // ---------- static web ----------
  if (d.staticDir) {
    app.use("/assets/*", serveStatic({ root: d.staticDir }));
    app.get("*", async (c, next) => { if (/^\/(shops|api|owner|receipts|orders|healthz|\.well-known|llms)/.test(c.req.path)) return next(); return serveStatic({ root: d.staticDir, path: "index.html" })(c, next); });
  }
  return app;
}
