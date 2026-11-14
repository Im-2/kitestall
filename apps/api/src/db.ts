import { createRequire } from "node:module";
import type { DatabaseSync as DS } from "node:sqlite";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as { DatabaseSync: typeof DS };
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export type DB = DS;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS shops(id TEXT PRIMARY KEY, name TEXT, blurb TEXT, wallet TEXT, signing_seed TEXT, public_key TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS items(shop_id TEXT, id TEXT, name TEXT, list_cents INTEGER, stock INTEGER, PRIMARY KEY(shop_id,id));
CREATE TABLE IF NOT EXISTS policies(shop_id TEXT, version INTEGER, hash TEXT, public_json TEXT, private_json TEXT, created_at TEXT, active INTEGER DEFAULT 1, PRIMARY KEY(shop_id,version));
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, shop_id TEXT, item_id TEXT, qty INTEGER, ask_cents INTEGER, round INTEGER DEFAULT 0, status TEXT DEFAULT 'open', buyer TEXT, ip TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS rounds(id INTEGER PRIMARY KEY AUTOINCREMENT, session_id TEXT, shop_id TEXT, round INTEGER, buyer_message TEXT, offer_cents INTEGER, status TEXT, ask_cents INTEGER, message TEXT, rules_json TEXT, guard TEXT, serv_status TEXT, concession TEXT, action TEXT, serv_json TEXT, est_cost_usd REAL DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS quotes(id TEXT PRIMARY KEY, session_id TEXT, shop_id TEXT, item_id TEXT, qty INTEGER, unit_price_cents INTEGER, total_cents INTEGER, policy_version INTEGER, status TEXT, expires_at TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS orders(id TEXT PRIMARY KEY, quote_id TEXT UNIQUE, shop_id TEXT, item_id TEXT, qty INTEGER, total_cents INTEGER, voucher TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS receipts(id TEXT PRIMARY KEY, order_id TEXT, shop_id TEXT, json TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS payments(id INTEGER PRIMARY KEY AUTOINCREMENT, quote_id TEXT, nonce TEXT UNIQUE, tx_hash TEXT UNIQUE, payer TEXT, amount_wei TEXT, status TEXT, detail TEXT, signer_kind TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY AUTOINCREMENT, kind TEXT, shop_id TEXT, session_id TEXT, detail TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS ledger_fees(id INTEGER PRIMARY KEY AUTOINCREMENT, shop_id TEXT, kind TEXT, ref TEXT, amount_cents INTEGER, accrued_only INTEGER DEFAULT 1, created_at TEXT);
CREATE TABLE IF NOT EXISTS serv_spend(id INTEGER PRIMARY KEY AUTOINCREMENT, day TEXT, kind TEXT, usd REAL, created_at TEXT);
CREATE INDEX IF NOT EXISTS idx_spend_day ON serv_spend(day);
CREATE INDEX IF NOT EXISTS idx_rounds_session ON rounds(session_id);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
`;

export function openDb(path: string): DB {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;");
  db.exec(SCHEMA);
  return db;
}

export function tx<T>(db: DB, fn: () => T): T {
  db.exec("BEGIN IMMEDIATE");
  try { const r = fn(); db.exec("COMMIT"); return r; } catch (e) { db.exec("ROLLBACK"); throw e; }
}
export const now = () => new Date().toISOString();
export const rows = <T = any>(db: DB, sql: string, ...p: any[]): T[] => db.prepare(sql).all(...p) as T[];
export const row = <T = any>(db: DB, sql: string, ...p: any[]): T | undefined => db.prepare(sql).get(...p) as T | undefined;
export const run = (db: DB, sql: string, ...p: any[]) => db.prepare(sql).run(...p);
