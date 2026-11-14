import { z } from "zod";
import canonicalize from "canonicalize";
import { createHash } from "node:crypto";

export const RuleSchema = z.object({
  id: z.string().regex(/^R-[A-Z0-9-]{2,24}$/),
  kind: z.enum(["volume_tier", "bundle", "loyalty", "time_window", "cap", "final_round"]),
  text: z.string().min(1).max(300),
  params: z.record(z.unknown()).default({}),
});

export const PublicPolicySchema = z.object({
  max_discount_pct: z.number().int().min(0).max(90),
  rules: z.array(RuleSchema).max(20),
  persona: z.enum(["firm", "friendly", "flexible"]),
  max_rounds: z.number().int().min(1).max(6).default(3),
  quote_ttl_seconds: z.number().int().min(30).max(3600).default(300),
});

export const PrivatePolicySchema = z.object({
  floor: z.object({
    default_pct_of_list: z.number().int().min(1).max(100),
    per_item: z.record(z.number().int().nonnegative()).optional(),
  }),
  salt: z.string().min(8),
});

export const PolicySpecSchema = z.object({
  shop_id: z.string(),
  version: z.number().int().positive(),
  created_at: z.string(),
  public: PublicPolicySchema,
  private: PrivatePolicySchema,
});
export type PolicySpec = z.infer<typeof PolicySpecSchema>;
export type PublicPolicy = z.infer<typeof PublicPolicySchema>;

const canon = (v: unknown) => canonicalize(v) as string;

/** Commitment to the full policy including private part + salt. */
export function policyHash(p: PolicySpec): string {
  return "sha256:" + createHash("sha256").update(canon(p)).digest("hex");
}

/** Public view served to buyers (no private part). */
export function publicView(p: PolicySpec) {
  return { shop_id: p.shop_id, version: p.version, created_at: p.created_at, public: p.public, policy_hash: policyHash(p) };
}

/** Effective floor in cents: private floor, never below the public max-discount bound. */
export function effectiveFloor(p: PolicySpec, itemId: string, listCents: number): number {
  const pub = Math.ceil((listCents * (100 - p.public.max_discount_pct)) / 100);
  const priv = p.private.floor.per_item?.[itemId] ?? Math.ceil((listCents * p.private.floor.default_pct_of_list) / 100);
  return Math.min(listCents, Math.max(pub, priv));
}

/** The public best-and-final rule. Every published policy lists it so receipts that cite it verify against the public policy. */
export const FINAL_ACCEPT_RULE = {
  id: "R-FINAL-ACCEPT", kind: "final_round" as const,
  text: "In the final round the shop accepts any offer at or above its best-and-final price (slightly above its minimum), at the buyer's offer.",
  params: {},
};
/** The public firm-quote rule: a paid, time-locked quote at a price derived only from public numbers. */
export const FIRM_QUOTE_RULE = {
  id: "R-FIRM-QUOTE", kind: "final_round" as const,
  text: "A firm quote sells a guaranteed price for a short time. The price is the list price minus half of the public maximum discount (or the list price if that would be below the shop's minimum); no haggling.",
  params: {},
};
/** Adds the built-in public rules (final-round acceptance and firm quote) to a public policy if missing. Name kept for compatibility. */
export function withFinalRule<T extends { rules: { id: string }[] }>(pub: T): T {
  let rules = pub.rules;
  for (const r of [FINAL_ACCEPT_RULE, FIRM_QUOTE_RULE]) if (!rules.some((x) => x.id === r.id)) rules = [...rules, r];
  return rules === pub.rules ? pub : { ...pub, rules };
}
/** Firm-quote unit price in cents: list - half the PUBLIC max discount, rounded up; falls back to list if that is below the private floor. */
export function firmPriceCents(p: PolicySpec, itemId: string, listCents: number): number {
  const half = Math.ceil((listCents * (200 - p.public.max_discount_pct)) / 200);
  return half >= effectiveFloor(p, itemId, listCents) ? half : listCents;
}
