import { randomBytes } from "node:crypto";
import { SEED_SHOPS, generateKey, policyHash, type PolicySpec } from "@kitestall/core";
import { now, row, run, tx, type DB } from "./db.ts";

/** Idempotent. Seed floors in the repo are demo defaults (public); deployments may override via FLOOR_PCT_<SHOP> and always get a fresh random salt. */
export function seed(db: DB, env: NodeJS.ProcessEnv = process.env) {
  tx(db, () => {
    for (const s of SEED_SHOPS) {
      const wallet = env[`SHOP_WALLET_ADDRESS_${s.id.toUpperCase()}`] ?? "";
      if (!row(db, "SELECT id FROM shops WHERE id=?", s.id)) {
        const k = generateKey();
        run(db, "INSERT INTO shops(id,name,blurb,wallet,signing_seed,public_key,created_at) VALUES(?,?,?,?,?,?,?)", s.id, s.name, s.blurb, wallet, k.seed, k.publicKey, now());
        for (const it of s.items) run(db, "INSERT INTO items(shop_id,id,name,list_cents,stock) VALUES(?,?,?,?,?)", s.id, it.id, it.name, it.list_cents, it.stock);
      } else if (wallet) run(db, "UPDATE shops SET wallet=? WHERE id=?", wallet, s.id);
      if (!row(db, "SELECT 1 x FROM policies WHERE shop_id=?", s.id)) {
        const pct = Number(env[`FLOOR_PCT_${s.id.toUpperCase()}`] ?? s.policy.private.floor.default_pct_of_list);
        const p: PolicySpec = { ...s.policy, created_at: now(), private: { floor: { default_pct_of_list: pct }, salt: randomBytes(16).toString("hex") } };
        run(db, "INSERT INTO policies(shop_id,version,hash,public_json,private_json,created_at) VALUES(?,?,?,?,?,?)", s.id, p.version, policyHash(p), JSON.stringify(p.public), JSON.stringify(p.private), p.created_at);
      }
    }
  });
}
