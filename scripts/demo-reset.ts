// Returns the demo to a clean, repeatable state WITHOUT touching real tx history (orders, receipts, payments, platform fees stay).
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { SEED_SHOPS } from "../packages/core/src/index.ts";
if (existsSync(".env")) process.loadEnvFile(".env");
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const path = process.env.DATABASE_PATH ?? "apps/api/data/kitestall.db";
const db = new DatabaseSync(path);
db.exec("DELETE FROM rounds; DELETE FROM sessions; DELETE FROM events; DELETE FROM quotes WHERE status!='consumed'; DELETE FROM ledger_fees WHERE kind='quote_fee';");
for (const s of SEED_SHOPS) for (const it of s.items) db.prepare("UPDATE items SET stock=? WHERE shop_id=? AND id=?").run(it.stock, s.id, it.id);
console.log("demo reset done on", path, "(orders/receipts/payments kept)");
