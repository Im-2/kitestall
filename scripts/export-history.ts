// Exports REAL settled sales (orders, signed receipts, payments, quotes, sessions, rounds, fee rows) from the dev DB to docs/history.json.
// Nothing is invented or edited: rows are copied as they are. The private part of policies is NOT exported (only the published public policy + hash).
// Also prints the shop PUBLIC keys and writes SHOP_SIGNING_KEYS into .env (never printed) so receipts keep verifying after a re-deploy.
import { createRequire } from "node:module";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const dbPath = process.argv[2] ?? "apps/api/data/kitestall.db";
const db = new DatabaseSync(dbPath);
const all = (sql: string, ...p: unknown[]) => db.prepare(sql).all(...p) as any[];
const one = (sql: string, ...p: unknown[]) => db.prepare(sql).get(...p) as any;

const sales = all("SELECT * FROM orders ORDER BY created_at").map((o) => {
  const quote = one("SELECT * FROM quotes WHERE id=?", o.quote_id);
  const receipt = one("SELECT * FROM receipts WHERE order_id=?", o.id);
  const payment = one("SELECT * FROM payments WHERE quote_id=? AND status='settled'", o.quote_id);
  return {
    session: one("SELECT * FROM sessions WHERE id=?", quote.session_id),
    rounds: all("SELECT session_id,shop_id,round,buyer_message,offer_cents,status,ask_cents,message,rules_json,guard,serv_status,concession,action,serv_json,est_cost_usd,created_at FROM rounds WHERE session_id=? ORDER BY id", quote.session_id),
    quote, order: o, receipt, payment,
    fee: one("SELECT shop_id,kind,ref,amount_cents,accrued_only,created_at FROM ledger_fees WHERE kind='platform_fee' AND ref=?", o.id),
  };
});
const need = new Set(sales.map((s) => `${s.receipt ? JSON.parse(s.receipt.json).shop_id : ""}:${JSON.parse(s.receipt.json).policy.version}`));
const policies = [...need].map((k) => { const [shop, v] = k.split(":"); const p = one("SELECT shop_id,version,hash,public_json,created_at FROM policies WHERE shop_id=? AND version=?", shop, Number(v)); return p; });
const shopPub: Record<string, string> = Object.fromEntries(all("SELECT id, public_key FROM shops").map((s) => [s.id, s.public_key]));
const out = { exported_at: new Date().toISOString(), shop_public_keys: shopPub, note: "Real Kite TESTNET settlements copied verbatim from the dev database by scripts/export-history.ts. Private policy parts are not included.", policies, sales };
writeFileSync("docs/history.json", JSON.stringify(out, null, 2));

const keys: Record<string, string> = {}; const pub: Record<string, string> = {};
for (const s of all("SELECT id, signing_seed, public_key FROM shops")) { keys[s.id] = s.signing_seed; pub[s.id] = s.public_key; }
let env = existsSync(".env") ? readFileSync(".env", "utf8") : "";
const line = `SHOP_SIGNING_KEYS=${JSON.stringify(keys)}`;
env = /^SHOP_SIGNING_KEYS=.*$/m.test(env) ? env.replace(/^SHOP_SIGNING_KEYS=.*$/m, line) : env.trimEnd() + "\n" + line + "\n";
writeFileSync(".env", env);
console.log(`exported ${sales.length} real sales, ${policies.length} historic public policies -> docs/history.json`);
console.log("shop PUBLIC keys:", pub);
console.log("SHOP_SIGNING_KEYS written to .env (value not printed). Paste it into Render from your local .env.");
