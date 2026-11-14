import canonicalize from "canonicalize";
import { createPrivateKey, createPublicKey, sign as edSign, verify as edVerify, generateKeyPairSync, type KeyObject } from "node:crypto";
import type { PublicPolicy } from "./policy.ts";

export interface Receipt {
  receipt_id: string;
  shop_id: string;
  item: { id: string; qty: number };
  list_price_cents: number;
  agreed_price_cents: number;
  rounds: number;
  rules_fired: string[];
  policy: { version: number; hash: string };
  serv: { model: string; features: string[]; request_ids: string[]; status: "live" | "fallback" | "mixed" | "none" };
  payment: { network: string; tx_hash: string; payer: string; pay_to: string; amount_wei: string; settled_via?: string };
  passport?: { status: string };
  issued_at: string;
  signature?: string;
}

const PKCS8_PREFIX = Buffer.from("302e020100300506032b657004220420", "hex");

function privKey(seed: string): KeyObject {
  return createPrivateKey({ key: Buffer.concat([PKCS8_PREFIX, Buffer.from(seed, "base64url")]), format: "der", type: "pkcs8" });
}
export function derivePub(seed: string): string {
  return (createPublicKey(privKey(seed)).export({ format: "jwk" }) as { x: string }).x;
}
export function generateKey(): { seed: string; publicKey: string } {
  const { privateKey } = generateKeyPairSync("ed25519");
  const jwk = privateKey.export({ format: "jwk" }) as { d: string; x: string };
  return { seed: jwk.d, publicKey: jwk.x };
}
function pubKey(x: string): KeyObject {
  return createPublicKey({ key: { kty: "OKP", crv: "Ed25519", x }, format: "jwk" });
}
function body(r: Receipt): Buffer {
  const { signature: _s, ...rest } = r;
  return Buffer.from(canonicalize(rest) as string);
}

export function signReceipt(r: Receipt, seed: string): Receipt {
  return { ...r, signature: "ed25519:" + edSign(null, body(r), privKey(seed)).toString("base64url") };
}
export function verifySignature(r: Receipt, publicKey: string): boolean {
  if (!r.signature?.startsWith("ed25519:")) return false;
  try { return edVerify(null, body(r), pubKey(publicKey), Buffer.from(r.signature.slice(8), "base64url")); } catch { return false; }
}

/** Signs any JSON document (RFC 8785 canonical form, ed25519) with a shop key; used for firm quotes. */
export function signPayload<T extends object>(doc: T, seed: string): T & { signature: string } {
  const { signature: _s, ...rest } = doc as T & { signature?: string };
  return { ...(rest as T), signature: "ed25519:" + edSign(null, Buffer.from(canonicalize(rest) as string), privKey(seed)).toString("base64url") };
}
export function verifyPayload(doc: { signature?: string } & Record<string, unknown>, publicKey: string): boolean {
  if (!doc.signature?.startsWith("ed25519:")) return false;
  const { signature, ...rest } = doc;
  try { return edVerify(null, Buffer.from(canonicalize(rest) as string), pubKey(publicKey), Buffer.from(signature.slice(8), "base64url")); } catch { return false; }
}

export interface Check { name: string; ok: boolean; detail: string }

/** Needs no private floor. Callers add the on-chain tx check. */
export function verifyReceipt(r: Receipt, published: { version: number; hash: string; public: PublicPolicy }, publicKey: string): Check[] {
  const ids = new Set(published.public.rules.map((x) => x.id));
  const builtin = (id: string) => /^R-(FLOOR|STOCK|ROUND|PG|REJECT)-?/.test(id);
  const unknown = r.rules_fired.filter((id) => !ids.has(id) && !builtin(id));
  const min = Math.ceil((r.list_price_cents * (100 - published.public.max_discount_pct)) / 100);
  return [
    { name: "signature", ok: verifySignature(r, publicKey), detail: "ed25519 over RFC 8785 canonical JSON" },
    { name: "rules_in_public_policy", ok: unknown.length === 0, detail: unknown.length ? `unknown: ${unknown.join(",")}` : "all rule ids are published" },
    { name: "price_bounds", ok: r.agreed_price_cents <= r.list_price_cents && r.agreed_price_cents >= min, detail: `${min} <= ${r.agreed_price_cents} <= ${r.list_price_cents} (cents per unit)` },
    { name: "policy_hash", ok: r.policy.hash === published.hash && r.policy.version === published.version, detail: `receipt ${r.policy.hash.slice(0, 19)}… vs published ${published.hash.slice(0, 19)}…` },
  ];
}
