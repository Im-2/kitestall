import { encodePayment, SessionLimitError, type PaymentSigner, type PaymentRequirements } from "@kitestall/core";

export type ShopperEvent = { type: string; ts: string; [k: string]: unknown };
export interface ShopperOpts {
  baseUrl: string; shopId: string; itemId: string; qty?: number; budgetCents: number; signer: PaymentSigner;
  onEvent?: (e: ShopperEvent) => void; maxRoundsPerSession?: number; eager?: boolean;
  /** extra HTTP headers for /negotiate (the server-side demo shopper uses this to opt in to Shadow Agent verification) */
  headers?: Record<string, string>;
}
export interface ShopperResult { ok: boolean; reason?: string; receipt?: any; order?: any; txHash?: string; finalPriceCents?: number }

const dollars = (c: number) => `$${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;

async function j(url: string, init?: RequestInit) {
  const r = await fetch(url, init);
  const text = await r.text(); let body: any; try { body = JSON.parse(text); } catch { body = { raw: text }; }
  return { status: r.status, body, headers: r.headers };
}

/** Shopper agent: deterministic offer strategy, hard budget, handles session-limit errors by renegotiating (Story A). */
export async function runShopper(o: ShopperOpts): Promise<ShopperResult> {
  const emit = (type: string, d: Record<string, unknown> = {}) => o.onEvent?.({ type, ts: new Date().toISOString(), ...d });
  const qty = o.qty ?? 1;
  const base = o.baseUrl.replace(/\/$/, "");
  const payer = await o.signer.address();
  emit("signer", { kind: o.signer.kind, label: o.signer.label, payer });

  const cat = await j(`${base}/shops/${o.shopId}/catalog`);
  if (cat.status !== 200) { emit("error", { message: "catalog unavailable" }); return { ok: false, reason: "catalog" }; }
  const item = cat.body.items.find((i: any) => i.id === o.itemId);
  if (!item) { emit("error", { message: "item not found" }); return { ok: false, reason: "item" }; }
  emit("discover", { shop: cat.body.shop.name, item: item.name, list_cents: item.list_cents, testnet: true });
  const budget = o.budgetCents; // per-unit hard budget (what the signer/session will allow)

  let cap = budget; let attempt = 0; let prevAsk: number | undefined;
  while (attempt < 3) {
    attempt++;
    let sessionId: string | undefined; let offer = attempt > 1 ? Math.min(cap, prevAsk ?? cap) : Math.min(Math.round(item.list_cents * 0.7), cap);
    let quote: any = null; let lastAsk = item.list_cents;
    const maxR = o.maxRoundsPerSession ?? 3;
    let blocks = 0;
    for (let round = 1; round <= maxR; round++) {
      const message = attempt === 1 ? (round === 1 ? "Hi! I'd like to buy this. Can you do a bit better than list?" : "Can we meet in the middle?")
        : `My hard spending limit is ${dollars(cap)} per unit. Can you work within that?`;
      emit("offer", { round, offer_cents: offer, message });
      const r = await j(`${base}/shops/${o.shopId}/negotiate`, { method: "POST", headers: { "content-type": "application/json", ...(o.headers ?? {}) }, body: JSON.stringify({ session_id: sessionId, item_id: o.itemId, qty, offer_cents: offer, message, payer }) });
      if (r.status !== 200) { emit("error", { message: r.body?.error?.message ?? "negotiate failed", status: r.status }); return { ok: false, reason: "negotiate" }; }
      sessionId = r.body.session_id; lastAsk = r.body.ask_cents;
      emit("counter", { round, status: r.body.status, ask_cents: r.body.ask_cents, message: r.body.message, rules_fired: r.body.rules_fired, serv: r.body.serv });
      if (r.body.serv?.guard === "blocked" && blocks++ < 3) { round--; continue; } // a guard block does not consume a negotiation round
      if (r.body.status === "accepted") { quote = r.body.quote; break; }
      if (r.body.status === "rejected") break;
      if (o.eager && attempt === 1 && r.body.ask_cents <= cap) { offer = r.body.ask_cents; continue; }
      if (r.body.ask_cents <= cap) offer = Math.min(cap, Math.max(offer + 1, Math.ceil((offer + r.body.ask_cents) / 2)));
      else offer = Math.min(cap, Math.max(offer + 1, Math.ceil((offer * 3 + r.body.ask_cents) / 4)));
      // final-ask within budget: take it
      if (r.body.ask_cents <= cap && round === maxR) { offer = r.body.ask_cents; }
    }
    if (!quote && sessionId && lastAsk <= cap && lastAsk < item.list_cents) { // take the standing best-and-final ask
      emit("offer", { round: maxR + 1, offer_cents: lastAsk, message: "I accept your best-and-final price." });
      const r = await j(`${base}/shops/${o.shopId}/negotiate`, { method: "POST", headers: { "content-type": "application/json", ...(o.headers ?? {}) }, body: JSON.stringify({ session_id: sessionId, item_id: o.itemId, qty, offer_cents: lastAsk, message: "I accept your best-and-final price.", payer }) });
      if (r.status === 200) { emit("counter", { round: r.body.round, status: r.body.status, ask_cents: r.body.ask_cents, message: r.body.message, rules_fired: r.body.rules_fired, serv: r.body.serv }); if (r.body.status === "accepted") quote = r.body.quote; }
    }
    prevAsk = lastAsk;
    if (!quote) {
      if (lastAsk <= cap && attempt < 3) { /* try once more at the ask */ continue; }
      emit("walk_away", { reason: "no agreement within budget", last_ask_cents: lastAsk, budget_cents: cap });
      return { ok: false, reason: "no_agreement" };
    }
    emit("quote", { quote_id: quote.quote_id, price_cents: quote.unit_price_cents, total_cents: quote.total_cents, expires_at: quote.expires_at });
    // checkout -> 402
    const c1 = await j(`${base}/shops/${o.shopId}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quote_id: quote.quote_id }) });
    if (c1.status !== 402) { emit("error", { message: "expected 402", status: c1.status }); return { ok: false, reason: "no402" }; }
    const req: PaymentRequirements = c1.body.accepts[0];
    emit("payment_required", { amount_wei: req.amount, pay_to: req.payTo, network: req.network, asset: req.asset, quote_id: quote.quote_id });
    let payload;
    try { payload = await o.signer.pay(req, { url: `${base}/shops/${o.shopId}/checkout`, description: req.description ?? "Kitestall purchase" }); }
    catch (e) {
      if (e instanceof SessionLimitError) {
        emit("budget_error", { code: e.code, limit_cents: e.limitCents, requested_cents: e.requestedCents, signer: o.signer.label });
        cap = Math.min(cap, e.limitCents);
        continue; // renegotiate with the hard budget stated to the merchant (Story A)
      }
      emit("error", { message: String((e as Error).message) }); return { ok: false, reason: "sign" };
    }
    emit("paying", { payer, signer: o.signer.label });
    const c2 = await j(`${base}/shops/${o.shopId}/checkout`, { method: "POST", headers: { "content-type": "application/json", "X-PAYMENT": encodePayment(payload) }, body: JSON.stringify({ quote_id: quote.quote_id }) });
    if (c2.status !== 200) { emit("error", { message: c2.body?.error?.message ?? "payment failed", status: c2.status, detail: c2.body }); return { ok: false, reason: "payment" }; }
    emit("receipt", { receipt: c2.body.receipt, order: c2.body.order, tx_hash: c2.body.receipt?.payment?.tx_hash, explorer: c2.body.explorer_url });
    return { ok: true, receipt: c2.body.receipt, order: c2.body.order, txHash: c2.body.receipt?.payment?.tx_hash, finalPriceCents: quote.unit_price_cents };
  }
  emit("walk_away", { reason: "attempts exhausted" });
  return { ok: false, reason: "exhausted" };
}

/** Firm-quote path: pay a small x402 fee first (to the platform wallet), receive a signed time-locked price, then check out at that price. No haggling, no SERV. */
export async function runFirmQuoteShopper(o: Omit<ShopperOpts, "budgetCents" | "eager" | "maxRoundsPerSession">): Promise<ShopperResult & { firmQuote?: any; feeTx?: string }> {
  const emit = (type: string, d: Record<string, unknown> = {}) => o.onEvent?.({ type, ts: new Date().toISOString(), ...d });
  const qty = o.qty ?? 1; const base = o.baseUrl.replace(/\/$/, ""); const payer = await o.signer.address();
  emit("signer", { kind: o.signer.kind, label: o.signer.label, payer });
  const cat = await j(`${base}/shops/${o.shopId}/catalog`); const item = cat.body?.items?.find((i: any) => i.id === o.itemId);
  if (!item) { emit("error", { message: "item not found" }); return { ok: false, reason: "item" }; }
  emit("discover", { shop: cat.body.shop.name, item: item.name, list_cents: item.list_cents, testnet: true });
  const f1 = await j(`${base}/shops/${o.shopId}/firm-quote`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ item_id: o.itemId, qty }) });
  if (f1.status !== 402) { emit("error", { message: f1.body?.error?.message ?? "firm quotes unavailable", status: f1.status }); return { ok: false, reason: "no402" }; }
  const freq: PaymentRequirements = f1.body.accepts[0];
  emit("firm_quote_offer", { unit_price_cents: f1.body.firm_quote_preview.unit_price_cents, fee_cents: f1.body.firm_quote_preview.fee_cents, valid_seconds: f1.body.firm_quote_preview.valid_seconds, pay_to: freq.payTo, amount_wei: freq.amount });
  let fp; try { fp = await o.signer.pay(freq, { url: `${base}/shops/${o.shopId}/firm-quote`, description: freq.description ?? "Firm quote fee" }); } catch (e) { emit("error", { message: String((e as Error).message) }); return { ok: false, reason: "sign" }; }
  emit("paying", { what: "firm-quote fee", payer, signer: o.signer.label });
  const f2 = await j(`${base}/shops/${o.shopId}/firm-quote`, { method: "POST", headers: { "content-type": "application/json", "X-PAYMENT": encodePayment(fp) }, body: JSON.stringify({ item_id: o.itemId, qty }) });
  if (f2.status !== 200) { emit("error", { message: f2.body?.error?.message ?? "firm quote payment failed", status: f2.status }); return { ok: false, reason: "firm_payment" }; }
  const fq = f2.body.firm_quote; emit("firm_quote", { firm_quote: fq, fee_tx: fq.fee.tx_hash, explorer: f2.body.explorer_url });
  const c1 = await j(`${base}/shops/${o.shopId}/checkout`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ quote_id: fq.quote_id }) });
  if (c1.status !== 402) { emit("error", { message: "expected 402", status: c1.status }); return { ok: false, reason: "no402", firmQuote: fq, feeTx: fq.fee.tx_hash }; }
  const req: PaymentRequirements = c1.body.accepts[0]; emit("payment_required", { amount_wei: req.amount, pay_to: req.payTo, network: req.network, asset: req.asset, quote_id: fq.quote_id });
  const payload = await o.signer.pay(req, { url: `${base}/shops/${o.shopId}/checkout`, description: req.description ?? "Kitestall purchase" }); emit("paying", { what: "purchase", payer, signer: o.signer.label });
  const c2 = await j(`${base}/shops/${o.shopId}/checkout`, { method: "POST", headers: { "content-type": "application/json", "X-PAYMENT": encodePayment(payload) }, body: JSON.stringify({ quote_id: fq.quote_id }) });
  if (c2.status !== 200) { emit("error", { message: c2.body?.error?.message ?? "payment failed", status: c2.status }); return { ok: false, reason: "payment", firmQuote: fq, feeTx: fq.fee.tx_hash }; }
  emit("receipt", { receipt: c2.body.receipt, order: c2.body.order, tx_hash: c2.body.receipt?.payment?.tx_hash, explorer: c2.body.explorer_url });
  return { ok: true, receipt: c2.body.receipt, order: c2.body.order, txHash: c2.body.receipt?.payment?.tx_hash, finalPriceCents: fq.unit_price_cents, firmQuote: fq, feeTx: fq.fee.tx_hash };
}
