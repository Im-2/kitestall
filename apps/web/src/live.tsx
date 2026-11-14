import { useEffect, useState } from "react";
import { api, usd, short, EXPLORER } from "./lib";
import { Spark, Bars, CountUp } from "./ui";

export interface Stats {
  testnet: boolean; negotiations: number; rounds: number; blocked_attacks: number; fallback_rounds: number; quotes: number; settled_sales: number;
  volume_cents: number; avg_discount_pct: number | null; fees_accrued_cents: number; serv_latency_p50_ms: number | null; serv_live_rounds: number;
  serv_budget?: { capped: boolean; reason: string | null; method: string; daily_spent_usd: number; daily_cap_usd: number; daily_remaining_usd: number; total_spent_usd: number; total_cap_usd: number; total_remaining_usd: number };
}
export interface Activity {
  sales: { order_id: string; receipt_id: string; shop_id: string; item_id: string; qty: number; total_cents: number; tx_hash: string; settled_via: string; created_at: string }[];
  rounds: { shop_id: string; round: number; status: string; ask_cents: number; guard: string; serv_status: string; concession: string; created_at: string }[];
  fees: { kind: string; cents: number; n: number }[];
  series: { discount_pct: number[]; latency_ms: number[] };
}

// One shared poller so every widget on the page reads the same real data.
let cache: { stats: Stats | null; activity: Activity | null; err: boolean } = { stats: null, activity: null, err: false };
const subs = new Set<() => void>(); let timer: ReturnType<typeof setInterval> | null = null; let inflight = false;
async function pull() {
  if (inflight) return; inflight = true;
  const [s, a] = await Promise.all([api<Stats>("/api/stats"), api<Activity>("/api/public/activity")]);
  cache = { stats: s.ok ? s.data : cache.stats, activity: a.ok ? a.data : cache.activity, err: !s.ok && !a.ok };
  inflight = false; subs.forEach((f) => f());
}
export function useLive() {
  const [, force] = useState(0);
  useEffect(() => {
    const f = () => force((n) => n + 1); subs.add(f);
    if (!timer) { pull(); timer = setInterval(pull, 15000); } else f();
    return () => { subs.delete(f); if (subs.size === 0 && timer) { clearInterval(timer); timer = null; } };
  }, []);
  return cache;
}
export const fmtMs = (n: number | null | undefined) => (n == null ? "—" : `${Math.round(n)} ms`);

/** Top strip: wraps cleanly on mobile; values straight from /api/stats. */
export function StatsStrip() {
  const { stats: s, err } = useLive();
  return (
    <div className="strip" role="status" aria-label="Live statistics from the database">
      {err ? <span>Stats unavailable right now.</span> : !s ? <span>Loading live stats…</span> : <>
        <span><i className="dot" aria-hidden="true" />LIVE</span>
        <span>Negotiations <b>{s.negotiations}</b></span><span>Settled sales <b>{s.settled_sales}</b></span>
        <span>Volume <b>{usd(s.volume_cents)}</b> <span className="badge">testnet</span></span>
        <span>Attacks blocked <b>{s.blocked_attacks}</b></span><span>Fees accrued <b>{usd(s.fees_accrued_cents)}</b></span>
        <span>SERV p50 <b>{fmtMs(s.serv_latency_p50_ms)}</b></span>
        {s.serv_budget && <span title={s.serv_budget.method}>SERV budget left today <b>{usd(Math.round(s.serv_budget.daily_remaining_usd * 100))}</b> <span className="badge warn">est.</span></span>}
      </>}
    </div>
  );
}

/** The REAL dashboard widgets (no placeholder numbers). Used inside the laptop/phone frames and standalone. */
export function LiveDashboard({ compact = false }: { compact?: boolean }) {
  const { stats: s, activity: a, err } = useLive();
  if (err) return <div className={"dash" + (compact ? " compact" : "")}><p className="empty">Live data unavailable.</p></div>;
  if (!s || !a) return <div className={"dash" + (compact ? " compact" : "")}><p className="empty">Loading live data…</p></div>;
  const fees = a.fees.find((f) => f.kind === "platform_fee"), qfees = a.fees.find((f) => f.kind === "quote_fee");
  return (
    <div className={"dash" + (compact ? " compact" : "")} aria-label="Live Kitestall dashboard">
      <div className="dh"><span>Kitestall live</span><span className="badge">Testnet</span></div>
      <div className="row2">
        <div className="kpi o"><div className="v">{usd(s.volume_cents)}</div><div className="l">Settled volume</div></div>
        <div className="kpi"><div className="v">{s.settled_sales}</div><div className="l">Settled sales</div></div>
        {!compact && <div className="kpi y"><div className="v">{s.avg_discount_pct == null ? "—" : `${s.avg_discount_pct}%`}</div><div className="l">Avg discount</div></div>}
        <div className="kpi"><div className="v">{s.blocked_attacks}</div><div className="l">Attacks blocked</div></div>
        <div className="kpi"><div className="v">{fmtMs(s.serv_latency_p50_ms)}</div><div className="l">SERV p50</div></div>
        <div className="kpi"><div className="v">{usd((fees?.cents ?? 0) + (qfees?.cents ?? 0))}</div><div className="l">Fees accrued</div></div>
      </div>
      <div className="two">
        <div>
          <div className="dh">Sales ledger</div>
          {a.sales.length === 0 ? <p className="empty">No settled sales yet.</p> : (
            <table><thead><tr><th>Item</th><th>Total</th>{!compact && <th>Tx</th>}</tr></thead>
              <tbody>{a.sales.slice(0, compact ? 3 : 5).map((x) => <tr key={x.order_id}><td>{x.shop_id}/{x.item_id}</td><td>{usd(x.total_cents)}</td>{!compact && <td className="mono">{short(x.tx_hash)}</td>}</tr>)}</tbody></table>
          )}
        </div>
        <div>
          <div className="dh">Recent negotiations</div>
          {a.rounds.length === 0 ? <p className="empty">No rounds yet.</p> : (
            <table><thead><tr><th>Rd</th><th>Status</th><th>Ask</th></tr></thead>
              <tbody>{a.rounds.slice(0, compact ? 3 : 5).map((r, i) => <tr key={i}><td>{r.round}</td><td>{r.guard === "blocked" ? "blocked" : r.status}</td><td>{usd(r.ask_cents)}</td></tr>)}</tbody></table>
          )}
        </div>
      </div>
    </div>
  );
}

/** Honest banner: shown whenever the SERV budget cap has switched the shop to the deterministic fallback engine. */
export function BudgetBanner() {
  const { stats: s } = useLive();
  if (!s?.serv_budget?.capped) return null;
  return <div className="banner" role="status"><b>SERV budget reached ({s.serv_budget.reason}).</b> Negotiations are being decided by the <b>deterministic fallback engine</b>, not SERV Reasoning, and are labeled that way. Prices, floors and receipts work exactly the same.</div>;
}

/** Small "latest settlement" tile for the hero. */
export function LatestSale() {
  const { activity: a } = useLive(); const s = a?.sales[0];
  return (
    <div>
      <div className="eyebrow">Latest settlement <span className="badge">testnet</span></div>
      {!a ? <p className="sm">Loading…</p> : !s ? <p className="sm" style={{ marginTop: 8 }}>No settled sale yet. Be the first shopper.</p> : <>
        <div style={{ fontSize: "2.4rem", letterSpacing: "-.04em", lineHeight: 1.1, marginTop: 6 }}>{usd(s.total_cents)}</div>
        <p className="sm">{s.shop_id} · {s.item_id}</p>
        <p className="sm"><a className="mono" href={`${EXPLORER}/tx/${s.tx_hash}`} target="_blank" rel="noreferrer">{short(s.tx_hash)}</a></p>
        <p className="sm">settled via {s.settled_via}</p>
      </>}
    </div>
  );
}

export { Spark, Bars, CountUp };
