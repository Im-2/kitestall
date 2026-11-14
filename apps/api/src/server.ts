import { serve } from "@hono/node-server";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { PieverseFacilitator, SelfRelayFacilitator, FallbackFacilitator, KITE_TESTNET } from "@kitestall/core";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";
import { seed, importHistory, assertSeeded, ensureFinalRule } from "./seed.ts";

// load repo-root .env for local dev (Render/Docker use real env vars)
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));
const env = process.env;
if (env.NODE_ENV === "production" && env.MOCK_PAYMENTS) throw new Error("MOCK_PAYMENTS is forbidden in production");

const db = openDb(env.DATABASE_PATH || resolve(root, "data/kitestall.db"));
const t0 = Date.now();
const historyFile = resolve(root, "docs/history.json");
seed(db, env, historyFile);
const hist = importHistory(db, historyFile);
ensureFinalRule(db);
const boot = assertSeeded(db);
try { // warn loudly if the configured signing keys do not match the keys that signed the committed history
  const hp = JSON.parse(readFileSync(resolve(root, "docs/history.json"), "utf8")).shop_public_keys ?? {};
  for (const [id, pub] of Object.entries(hp)) { const cur = db.prepare("SELECT public_key FROM shops WHERE id=?").get(id) as { public_key: string } | undefined; if (cur && cur.public_key !== pub) console.warn(`WARNING: signing key for shop ${id} differs from the key that signed docs/history.json; historic receipts will NOT verify. Set SHOP_SIGNING_KEYS.`); }
} catch { /* no history file */ } // throws (fails fast) if the DB is not seeded
const pieverse = new PieverseFacilitator(env.KITE_FACILITATOR_URL || KITE_TESTNET.facilitator);
const relayerKey = env.RELAYER_PRIVATE_KEY || env.DEMO_SHOPPER_PRIVATE_KEY;
const facilitator = relayerKey ? new FallbackFacilitator(pieverse, new SelfRelayFacilitator(relayerKey, pieverse)) : pieverse;
const webDist = resolve(root, "apps/web/dist");
const app = createApp({
  db,
  boot,
  env,
  staticDir: existsSync(webDist) ? relative(process.cwd(), webDist).replace(/\\/g, "/") || "." : undefined,
  serv: {
    baseUrl: env.SERV_BASE_URL || "https://inference-api.openserv.ai/v1",
    apiKey: env.OPENSERV_API_KEY || "",
    model: env.SERV_MODEL_NEGOTIATE || "gpt-5.4-mini",
    multipath: true,
    shadow: env.SERV_SHADOW === "1",
    mode: (env.SERV_MODE as "live" | "fallback_only") || "live",
  },
  facilitator,
});
const port = Number(env.PORT || 8787);
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, () => console.log(`Kitestall API on :${port} (Kite TESTNET, SERV mode=${env.SERV_MODE || "live"}); seeded ${boot.shops} shops, ${boot.items} items, ${boot.sales} real sales (history: +${hist.imported}) in ${Date.now() - t0} ms`));
