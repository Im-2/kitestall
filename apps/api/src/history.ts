import { row, rows, type DB } from "./db.ts";

/** Verbatim export of REAL settled sales (+ the published public policies they cite) so they survive the free plan's ephemeral disk.
 *  Private policy parts are never exported. Used by scripts/export-history.ts and the owner-only GET /owner/export-history. */
export function exportHistory(db: DB) {
  const sales = rows(db, "SELECT * FROM orders ORDER BY created_at").map((o) => {
    const quote = row(db, "SELECT * FROM quotes WHERE id=?", o.quote_id);
    const receipt = row(db, "SELECT * FROM receipts WHERE order_id=?", o.id);
    return {
      session: quote ? row(db, "SELECT * FROM sessions WHERE id=?", quote.session_id) : undefined, // receipt-only imported sales have no session/rounds/quote rows
      rounds: quote ? rows(db, "SELECT session_id,shop_id,round,buyer_message,offer_cents,status,ask_cents,message,rules_json,guard,serv_status,concession,action,serv_json,est_cost_usd,created_at FROM rounds WHERE session_id=? ORDER BY id", quote.session_id) : [],
      quote, order: o, receipt,
      payment: row(db, "SELECT * FROM payments WHERE quote_id=? AND status='settled'", o.quote_id),
      fee: row(db, "SELECT shop_id,kind,ref,amount_cents,accrued_only,created_at FROM ledger_fees WHERE kind='platform_fee' AND ref=?", o.id),
    };
  });
  const need = new Set(sales.map((s) => { const r = JSON.parse(s.receipt.json); return `${r.shop_id}:${r.policy.version}`; }));
  const policies = [...need].map((k) => { const [shop, v] = k.split(":"); return row(db, "SELECT shop_id,version,hash,public_json,created_at FROM policies WHERE shop_id=? AND version=?", shop, Number(v)); });
  const shop_public_keys = Object.fromEntries(rows(db, "SELECT id, public_key FROM shops").map((s) => [s.id, s.public_key]));
  return { exported_at: new Date().toISOString(), shop_public_keys, policies, sales };
}
