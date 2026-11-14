import { now, row, run, type DB } from "./db.ts";

/** Hard SERV spend budget. OpenServ exposes NO balance API for API keys (probed /v1/balance, /credits, /usage, /billing: all 404; the
 *  balance only appears inside a 402 error once it is already too low), so spend is ESTIMATED from token usage x catalog price x a
 *  conservative multiplier that stands in for SERV feature calls (guard / multipath) that the response does not meter. */
export interface BudgetCfg { dailyCapUsd: number; totalCapUsd: number; multiplier: number; blockedCallUsd: number; assumedOnResetUsd: number; headroomUsd: number }
const num = (v: string | undefined, d: number) => (v !== undefined && v !== "" && Number.isFinite(Number(v)) ? Number(v) : d);

export function budgetCfg(env: NodeJS.ProcessEnv): BudgetCfg {
  return {
    dailyCapUsd: num(env.SERV_DAILY_BUDGET_USD, 0.5),
    totalCapUsd: num(env.SERV_TOTAL_BUDGET_USD, 1.7), // $2.00 topped up, minus slack for estimate error
    multiplier: num(env.SERV_COST_MULTIPLIER, 3),
    blockedCallUsd: num(env.SERV_BLOCKED_CALL_USD, 0.0008), // a guard-blocked call returns zero usage but is still billed for the guard
    assumedOnResetUsd: num(env.SERV_ASSUMED_SPENT_ON_RESET_USD, 0.15),
    headroomUsd: 0.01, // stop before the cap so one more call cannot overshoot it
  };
}

const today = () => new Date().toISOString().slice(0, 10);

/** On a cold start with an empty counter (free plan: the DB resets), assume a conservative amount was already spent instead of zero. */
export function initBudget(db: DB, cfg: BudgetCfg): { assumed: boolean } {
  const n = row(db, "SELECT COUNT(*) n FROM serv_spend")?.n ?? 0;
  if (n === 0 && cfg.assumedOnResetUsd > 0) { recordSpend(db, "assumed_after_reset", cfg.assumedOnResetUsd); return { assumed: true }; }
  return { assumed: false };
}
export function recordSpend(db: DB, kind: string, usd: number) {
  if (!(usd > 0)) return;
  run(db, "INSERT INTO serv_spend(day,kind,usd,created_at) VALUES(?,?,?,?)", today(), kind, usd, now());
}
/** Cost charged for one SERV call. Zero when SERV was never called. */
export function chargeFor(serv: { estCostUsd: number; tokens: number } | null, cfg: BudgetCfg): number {
  if (!serv) return 0;
  return serv.tokens === 0 ? cfg.blockedCallUsd : serv.estCostUsd * cfg.multiplier;
}

export interface BudgetState {
  capped: boolean; reason: string | null; method: string; multiplier: number;
  daily_spent_usd: number; daily_cap_usd: number; daily_remaining_usd: number;
  total_spent_usd: number; total_cap_usd: number; total_remaining_usd: number;
}
const r4 = (n: number) => Math.round(n * 10000) / 10000;
export function budgetState(db: DB, cfg: BudgetCfg): BudgetState {
  const daily = row(db, "SELECT COALESCE(SUM(usd),0) s FROM serv_spend WHERE day=?", today())?.s ?? 0;
  const total = row(db, "SELECT COALESCE(SUM(usd),0) s FROM serv_spend")?.s ?? 0;
  const dailyCapped = daily + cfg.headroomUsd > cfg.dailyCapUsd, totalCapped = total + cfg.headroomUsd > cfg.totalCapUsd;
  return {
    capped: dailyCapped || totalCapped,
    reason: totalCapped ? "total SERV budget reached" : dailyCapped ? "daily SERV budget reached" : null,
    method: `ESTIMATED from token usage x catalog price x ${cfg.multiplier} (OpenServ exposes no balance API); not the real balance`,
    multiplier: cfg.multiplier,
    daily_spent_usd: r4(daily), daily_cap_usd: cfg.dailyCapUsd, daily_remaining_usd: r4(Math.max(0, cfg.dailyCapUsd - daily)),
    total_spent_usd: r4(total), total_cap_usd: cfg.totalCapUsd, total_remaining_usd: r4(Math.max(0, cfg.totalCapUsd - total)),
  };
}
