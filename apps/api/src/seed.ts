import { randomBytes } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { SEED_SHOPS, generateKey, derivePub, policyHash, type PolicySpec } from "@kitestall/core";
import { now, row, rows, run, tx, type DB } from "./db.ts";

/** SHOP_SIGNING_KEYS = JSON {"<shopId>":"<ed25519 seed, base64url>"}. Env wins so receipts keep verifying across ephemeral deploys. */
export function parseSigningKeys(env: NodeJS.ProcessEnv): Record<string, string> {
  if (!env.SHOP_SIGNING_KEYS) return {};
  try { const j = JSON.parse(env.SHOP_SIGNING_KEYS); return typeof j === "object" && j ? j : {}; } catch { throw new Error("SHOP_SIGNING_KEYS must be JSON like {\"nomad\":\"<seed>\"}"); }
}

/** Idempotent. Seed floors in the repo are demo defaults (public); deployments get a fresh random salt and may override floors via FLOOR_PCT_<SHOP>. */
export function seed(db: DB, env: NodeJS.ProcessEnv = process.env, historyFile?: string) {
  const keys = parseSigningKeys(env);
  // historic published policies must exist BEFORE the live policy picks its version number
  if (historyFile && existsSync(historyFile)) importPolicies(db, JSON.parse(readFileSync(historyFile, "utf8")));
  tx(db, () => {
    for (const s of SEED_SHOPS) {
      const wallet = env[`SHOP_WALLET_ADDRESS_${s.id.toUpperCase()}`] ?? "";
      const envSeed = keys[s.id];
      const existing = row(db, "SELECT id FROM shops WHERE id=?", s.id);
      if (!existing) {
        const k = envSeed ? { seed: envSeed, publicKey: derivePub(envSeed) } : generateKey();
        run(db, "INSERT INTO shops(id,name,blurb,wallet,signing_seed,public_key,created_at) VALUES(?,?,?,?,?,?,?)", s.id, s.name, s.blurb, wallet, k.seed, k.publicKey, now());
        for (const it of s.items) run(db, "INSERT INTO items(shop_id,id,name,list_cents,stock) VALUES(?,?,?,?,?)", s.id, it.id, it.name, it.list_cents, it.stock);
      } else {
        if (wallet) run(db, "UPDATE shops SET wallet=? WHERE id=?", wallet, s.id);
        if (envSeed) run(db, "UPDATE shops SET signing_seed=?, public_key=? WHERE id=?", envSeed, derivePub(envSeed), s.id);
      }
      if (!row(db, "SELECT 1 x FROM policies WHERE shop_id=? AND active=1", s.id)) {
        const version = (row(db, "SELECT MAX(version) v FROM policies WHERE shop_id=?", s.id)?.v ?? 0) + 1; // historic (imported) versions stay immutable
        const pct = Number(env[`FLOOR_PCT_${s.id.toUpperCase()}`] ?? s.policy.private.floor.default_pct_of_list);
        const p: PolicySpec = { ...s.policy, version, created_at: now(), private: { floor: { default_pct_of_list: pct }, salt: randomBytes(16).toString("hex") } };
        run(db, "INSERT INTO policies(shop_id,version,hash,public_json,private_json,created_at,active) VALUES(?,?,?,?,?,?,1)", s.id, p.version, policyHash(p), JSON.stringify(p.public), JSON.stringify(p.private), p.created_at);
      }
    }
  });
}

function importPolicies(db: DB, h: History) {
  for (const p of h.policies) run(db, "INSERT OR IGNORE INTO policies(shop_id,version,hash,public_json,private_json,created_at,active) VALUES(?,?,?,?,?,?,0)", p.shop_id, p.version, p.hash, p.public_json, "{}", p.created_at);
}
interface History { policies: { shop_id: string; version: number; hash: string; public_json: string; created_at: string }[]; sales: any[] }

/** Re-imports REAL settled sales (verbatim rows exported by scripts/export-history.ts). Idempotent: an order already present is skipped. Nothing is altered. */
export function importHistory(db: DB, file: string): { imported: number; skipped: number } {
  if (!existsSync(file)) return { imported: 0, skipped: 0 };
  const h: History = JSON.parse(readFileSync(file, "utf8")); let imported = 0, skipped = 0;
  tx(db, () => {
    importPolicies(db, h); // historic published policies: public part + hash only, inactive, no private part
    for (const s of h.sales) {
      if (row(db, "SELECT 1 x FROM orders WHERE id=?", s.order.id)) { skipped++; continue; }
      const se = s.session; run(db, "INSERT OR IGNORE INTO sessions(id,shop_id,item_id,qty,ask_cents,round,status,buyer,ip,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)", se.id, se.shop_id, se.item_id, se.qty, se.ask_cents, se.round, se.status, se.buyer, se.ip, se.created_at);
      for (const r of s.rounds) run(db, "INSERT INTO rounds(session_id,shop_id,round,buyer_message,offer_cents,status,ask_cents,message,rules_json,guard,serv_status,concession,action,serv_json,est_cost_usd,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)", r.session_id, r.shop_id, r.round, r.buyer_message, r.offer_cents, r.status, r.ask_cents, r.message, r.rules_json, r.guard, r.serv_status, r.concession, r.action, r.serv_json, r.est_cost_usd, r.created_at);
      const q = s.quote; run(db, "INSERT OR IGNORE INTO quotes(id,session_id,shop_id,item_id,qty,unit_price_cents,total_cents,policy_version,status,expires_at,created_at) VALUES(?,?,?,?,?,?,?,?,?,?,?)", q.id, q.session_id, q.shop_id, q.item_id, q.qty, q.unit_price_cents, q.total_cents, q.policy_version, q.status, q.expires_at, q.created_at);
      const o = s.order; run(db, "INSERT INTO orders(id,quote_id,shop_id,item_id,qty,total_cents,voucher,created_at) VALUES(?,?,?,?,?,?,?,?)", o.id, o.quote_id, o.shop_id, o.item_id, o.qty, o.total_cents, o.voucher, o.created_at);
      run(db, "INSERT INTO receipts(id,order_id,shop_id,json,created_at) VALUES(?,?,?,?,?)", s.receipt.id, s.receipt.order_id, s.receipt.shop_id, s.receipt.json, s.receipt.created_at);
      const pm = s.payment; run(db, "INSERT OR IGNORE INTO payments(quote_id,nonce,tx_hash,payer,amount_wei,status,detail,signer_kind,created_at) VALUES(?,?,?,?,?,?,?,?,?)", pm.quote_id, pm.nonce, pm.tx_hash, pm.payer, pm.amount_wei, pm.status, pm.detail, pm.signer_kind, pm.created_at);
      if (s.fee) run(db, "INSERT INTO ledger_fees(shop_id,kind,ref,amount_cents,accrued_only,created_at) VALUES(?,?,?,?,?,?)", s.fee.shop_id, s.fee.kind, s.fee.ref, s.fee.amount_cents, s.fee.accrued_only, s.fee.created_at);
      run(db, "UPDATE items SET stock=MAX(0, stock-?) WHERE shop_id=? AND id=?", o.qty, o.shop_id, o.item_id); // keep stock consistent with real sales
      imported++;
    }
  });
  return { imported, skipped };
}

/** Boot-time check: both seed shops have a wallet-independent active policy and a catalog. Throws so a broken boot fails fast instead of serving empty pages. */
export function assertSeeded(db: DB): { shops: number; items: number; sales: number } {
  const shops = rows(db, "SELECT id FROM shops").length; const items = row(db, "SELECT COUNT(*) n FROM items")?.n ?? 0;
  const active = row(db, "SELECT COUNT(DISTINCT shop_id) n FROM policies WHERE active=1")?.n ?? 0;
  if (shops < SEED_SHOPS.length || active < SEED_SHOPS.length || items < 1) throw new Error(`DB not seeded: shops=${shops} activePolicies=${active} items=${items}`);
  return { shops, items, sales: row(db, "SELECT COUNT(*) n FROM orders")?.n ?? 0 };
}
