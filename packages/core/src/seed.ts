import type { PolicySpec } from "./policy.ts";

export interface SeedItem { id: string; name: string; list_cents: number; stock: number }
export interface SeedShop { id: string; name: string; blurb: string; english: string; items: SeedItem[]; policy: PolicySpec }

const now = "2026-11-14T00:00:00.000Z";

export const NOMAD_ENGLISH =
  "We're a friendly coworking space. Day passes list at $25, a 5-day bundle at $100. Give 10% off when someone books 3 or more day passes, and 15% off the 5-day bundle on Mondays through Wednesdays (quiet days). Never go more than 30% off list, and never below 80% of list. Haggle for up to 3 rounds, be warm and chatty.";
export const BRIGHTBEAN_ENGLISH =
  "Brightbean Roasters sells whole-bean coffee by the kg. Be firm. 2 kg or more gets 5% off, 5 kg or more gets 10% off, returning customers get 3% extra. Never more than 15% off list and never below 88% of list. Up to 3 rounds.";

export const SEED_SHOPS: SeedShop[] = [
  {
    id: "nomad", name: "Nomad Desk", blurb: "Coworking day passes and bundles. Perishable inventory, friendly haggling.", english: NOMAD_ENGLISH,
    items: [
      { id: "day-pass", name: "Coworking day pass", list_cents: 2500, stock: 40 },
      { id: "week-bundle", name: "5-day pass bundle", list_cents: 10000, stock: 12 },
    ],
    policy: {
      shop_id: "nomad", version: 1, created_at: now,
      public: {
        max_discount_pct: 30, persona: "friendly", max_rounds: 3, quote_ttl_seconds: 300,
        rules: [
          { id: "R-VOL-10", kind: "volume_tier", text: "10% off when booking 3 or more day passes.", params: { min_qty: 3, pct: 10 } },
          { id: "R-WEEKDAY-15", kind: "time_window", text: "15% off the 5-day bundle Monday to Wednesday.", params: { days: [1, 2, 3], pct: 15 } },
          { id: "R-CAP-30", kind: "cap", text: "No discount ever exceeds 30% off list.", params: { pct: 30 } },
        ],
      },
      private: { floor: { default_pct_of_list: 80 }, salt: "nomad-salt-7f3a91c2" },
    },
  },
  {
    id: "brightbean", name: "Brightbean Roasters", blurb: "Whole-bean coffee by the kg. Volume tiers, firm persona.", english: BRIGHTBEAN_ENGLISH,
    items: [
      { id: "house-blend-1kg", name: "House blend, 1 kg", list_cents: 3200, stock: 60 },
      { id: "single-origin-1kg", name: "Single-origin, 1 kg", list_cents: 4800, stock: 25 },
    ],
    policy: {
      shop_id: "brightbean", version: 1, created_at: now,
      public: {
        max_discount_pct: 15, persona: "firm", max_rounds: 3, quote_ttl_seconds: 300,
        rules: [
          { id: "R-VOL-5", kind: "volume_tier", text: "5% off 2 kg or more.", params: { min_qty: 2, pct: 5 } },
          { id: "R-VOL-10", kind: "volume_tier", text: "10% off 5 kg or more.", params: { min_qty: 5, pct: 10 } },
          { id: "R-LOYAL-3", kind: "loyalty", text: "3% extra for returning customers.", params: { pct: 3 } },
          { id: "R-CAP-15", kind: "cap", text: "No discount ever exceeds 15% off list.", params: { pct: 15 } },
        ],
      },
      private: { floor: { default_pct_of_list: 88 }, salt: "brightbean-salt-b21d58e0" },
    },
  },
];
