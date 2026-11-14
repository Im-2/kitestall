/** Money: integer cents internally, BigInt wei on chain. No floats. 1 token == $1 (demo assumption). */
export const DEFAULT_DECIMALS = 18;

export function assertCents(n: number): number {
  if (!Number.isSafeInteger(n) || n < 0) throw new RangeError(`invalid cents: ${n}`);
  return n;
}

export function centsToWei(cents: number | bigint, decimals = DEFAULT_DECIMALS): bigint {
  const c = typeof cents === "bigint" ? cents : BigInt(assertCents(cents));
  if (c < 0n) throw new RangeError("negative cents");
  if (decimals < 2) throw new RangeError("decimals must be >= 2");
  return c * 10n ** BigInt(decimals - 2);
}

/** Exact inverse; throws if wei is not a whole number of cents (never round on settlement). */
export function weiToCents(wei: bigint | string, decimals = DEFAULT_DECIMALS): number {
  const w = typeof wei === "bigint" ? wei : BigInt(wei);
  const unit = 10n ** BigInt(decimals - 2);
  if (w < 0n || w % unit !== 0n) throw new RangeError("wei is not a whole number of cents");
  const c = w / unit;
  if (c > BigInt(Number.MAX_SAFE_INTEGER)) throw new RangeError("too large");
  return Number(c);
}

/** Display only. */
export function formatCents(cents: number): string {
  const c = assertCents(cents);
  return `${Math.floor(c / 100)}.${String(c % 100).padStart(2, "0")}`;
}

/** Fee math in integer arithmetic; fee rounds down (accrued fee never overstated). */
export function feeBps(amountCents: number, bps: number): number {
  return Number((BigInt(assertCents(amountCents)) * BigInt(bps)) / 10000n);
}
