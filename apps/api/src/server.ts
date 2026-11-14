import { serve } from "@hono/node-server";
import { existsSync } from "node:fs";
import { resolve, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { PieverseFacilitator, SelfRelayFacilitator, FallbackFacilitator, KITE_TESTNET } from "@kitestall/core";
import { createApp } from "./app.ts";
import { openDb } from "./db.ts";
import { seed } from "./seed.ts";

// load repo-root .env for local dev (Render/Docker use real env vars)
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
if (existsSync(resolve(root, ".env"))) process.loadEnvFile(resolve(root, ".env"));
const env = process.env;
if (env.NODE_ENV === "production" && env.MOCK_PAYMENTS) throw new Error("MOCK_PAYMENTS is forbidden in production");

const db = openDb(env.DATABASE_PATH || resolve(root, "data/kitestall.db"));
seed(db, env);
const pieverse = new PieverseFacilitator(env.KITE_FACILITATOR_URL || KITE_TESTNET.facilitator);
const relayerKey = env.RELAYER_PRIVATE_KEY || env.DEMO_SHOPPER_PRIVATE_KEY;
const facilitator = relayerKey ? new FallbackFacilitator(pieverse, new SelfRelayFacilitator(relayerKey, pieverse)) : pieverse;
const webDist = resolve(root, "apps/web/dist");
const app = createApp({
  db,
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
serve({ fetch: app.fetch, port }, () => console.log(`Kitestall API on :${port} (Kite TESTNET, SERV mode=${env.SERV_MODE || "live"})`));
