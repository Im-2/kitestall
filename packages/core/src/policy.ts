import { z } from "zod";
import canonicalize from "canonicalize";
import { createHash } from "node:crypto";

export const RuleSchema = z.object({
  id: z.string().regex(/^R-[A-Z0-9-]{2,24}$/),
  kind: z.enum(["volume_tier", "bundle", "loyalty", "time_window", "cap"]),
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
