import { formatCents } from "./money.ts";

const FORBIDDEN =
  /(floor|minimum price|lowest (price|i can)|reserve price|cost price|our cost|margin|salt|system prompt|my instructions|private polic|walk-?away price|bottom price)/i;
const NUM = /\d[\d,]*(?:\.\d+)?/g;

export interface Allowed { prices: number[]; qty?: number; extras?: (string | number)[] }

/** Only numbers equal to code-inserted values may appear in an outgoing message. */
export function leakFilter(message: string, allowed: Allowed, template: string): { text: string; replaced: boolean; reason?: string } {
  const ok = new Set<string>();
  for (const c of allowed.prices) { ok.add(formatCents(c)); ok.add(String(c / 100)); ok.add(String(Math.floor(c / 100))); }
  if (allowed.qty !== undefined) ok.add(String(allowed.qty));
  for (const e of allowed.extras ?? []) ok.add(String(e));
  const clean = message.normalize("NFKC");
  if (FORBIDDEN.test(clean)) return { text: template, replaced: true, reason: "forbidden-pattern" };
  for (const n of clean.match(NUM) ?? []) {
    const bare = n.replace(/,/g, "");
    if (!ok.has(bare)) return { text: template, replaced: true, reason: "unlisted-number" };
  }
  return { text: clean.slice(0, 280), replaced: false };
}
