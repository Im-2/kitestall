// Generates 3 testnet wallets into .env (only if blank). Prints PUBLIC addresses only.
import { readFileSync, writeFileSync } from "node:fs";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
let env = readFileSync(".env", "utf8");
const get = (k) => (env.match(new RegExp(`^${k}=(.*)$`, "m")) ?? [])[1]?.trim();
const set = (k, v) => { env = new RegExp(`^${k}=`, "m").test(env) ? env.replace(new RegExp(`^${k}=.*$`, "m"), `${k}=${v}`) : env + `\n${k}=${v}`; };
const out = {};
for (const [name, addrKey, pkKey] of [["Nomad payTo", "SHOP_WALLET_ADDRESS_NOMAD", "SHOP_WALLET_PK_NOMAD"], ["Brightbean payTo", "SHOP_WALLET_ADDRESS_BRIGHTBEAN", "SHOP_WALLET_PK_BRIGHTBEAN"], ["Demo shopper", "DEMO_SHOPPER_ADDRESS", "DEMO_SHOPPER_PRIVATE_KEY"], ["Platform fee wallet", "PLATFORM_WALLET_ADDRESS", "PLATFORM_WALLET_PK"]]) {
  let pk = get(pkKey);
  if (!pk) { pk = generatePrivateKey(); set(pkKey, pk); }
  const addr = privateKeyToAccount(pk).address; set(addrKey, addr); out[name] = addr;
}
if (!get("OWNER_TOKEN")) set("OWNER_TOKEN", [...crypto.getRandomValues(new Uint8Array(24))].map((b) => b.toString(16).padStart(2, "0")).join(""));
writeFileSync(".env", env);
console.log(out);
