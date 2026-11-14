import { useRef, useState } from "react";
import { sse, usd, EXPLORER, short } from "../lib";

const LABEL: Record<string, string> = { signer: "Signer", discover: "Discover", offer: "Offer", counter: "Shop", quote: "Quote", payment_required: "402", paying: "Paying", budget_error: "Budget hit", walk_away: "Walk away", receipt: "Receipt", error: "Error", scenario: "Scenario", done: "Done" };

export function Watch() {
  const [events, setEvents] = useState<any[]>([]); const [running, setRunning] = useState(false); const [scenario, setScenario] = useState("story-a"); const stop = useRef<null | (() => void)>(null);
  function run() {
    setEvents([]); setRunning(true);
    stop.current = sse(`/api/demo-shopper/stream?scenario=${scenario}&shop=nomad`, (e) => { setEvents((x) => [...x, e]); if (e.type === "done") { stop.current?.(); setRunning(false); } }, () => setRunning(false));
  }
  const rc = events.find((e) => e.type === "receipt");
  return (
    <div>
      <div className="app-top"><h1>Watch a shopper agent buy</h1>
      <p>A server-side demo shopper negotiates with Nomad Desk, then pays with a <b>real Kite testnet transaction</b>. It uses a <b>dev signer</b> (a funded testnet key), not a Kite Passport session, so the “session limit” in Story A is <b>simulated</b> and labeled as such.</p></div>
      <section className="card">
      <div className="row" style={{ alignItems: "flex-end", maxWidth: 620 }}>
        <div><label htmlFor="sc">Scenario</label><select id="sc" value={scenario} onChange={(e) => setScenario(e.target.value)} disabled={running}><option value="story-a">Story A: meet in the middle (buyer limit vs seller floor)</option><option value="plain">Plain purchase</option></select></div>
        <button className="btn" onClick={run} disabled={running}>{running ? "Running…" : "Run the demo shopper"}</button>
      </div>
      <p className="sm">Limited to 3 runs per 5 minutes. Each run spends testnet tokens from a demo wallet.</p>
      </section>
      <div className="card" aria-live="polite" style={{ minHeight: 120, marginTop: 16 }}>
        {events.length === 0 ? <p className="empty">Nothing running. Press the button; each step streams in live.</p> : events.map((e, i) => (
          <div className="ev" key={i}>
            <div className="t">{LABEL[e.type] ?? e.type}</div>
            <div>
              {e.type === "signer" && <>{e.label} <span className="mono">{short(e.payer)}</span></>}
              {e.type === "scenario" && <>{e.scenario}{e.simulated_session_cap_cents ? <> · <span className="badge warn">simulated session cap {usd(e.simulated_session_cap_cents)}</span></> : null}</>}
              {e.type === "discover" && <>{e.shop}: {e.item}, list {usd(e.list_cents)}</>}
              {e.type === "offer" && <>Round {e.round}: offers <b>{usd(e.offer_cents)}</b> — “{e.message}”</>}
              {e.type === "counter" && <>{e.message} {e.serv?.guard === "blocked" && <span className="badge">guard block</span>} {e.rules_fired?.map((r: string) => <span className="chip" key={r}>{r}</span>)} {e.serv?.status === "live" ? <span className="badge ok">SERV</span> : e.serv?.status === "fallback" ? <span className="badge warn">fallback</span> : null}</>}
              {e.type === "quote" && <>Quote <span className="mono">{e.quote_id}</span>: <b>{usd(e.total_cents)}</b></>}
              {e.type === "payment_required" && <>HTTP 402: pay <span className="mono">{(Number(BigInt(e.amount_wei) / 10n ** 14n) / 10000).toFixed(2)} PYUSD</span> to <span className="mono">{short(e.pay_to)}</span> on Kite testnet</>}
              {e.type === "paying" && <>Signing EIP-3009 authorization… settling on-chain</>}
              {e.type === "budget_error" && <><span className="err">{e.code}</span>: needs {usd(e.requested_cents)} but the (simulated) session limit is {usd(e.limit_cents)}. Telling the shop my hard budget and renegotiating.</>}
              {e.type === "walk_away" && <>No deal within budget. {e.reason}</>}
              {e.type === "receipt" && <>Paid. Tx <a href={`${EXPLORER}/tx/${e.tx_hash}`} target="_blank" rel="noreferrer" className="mono">{short(e.tx_hash)}</a></>}
              {e.type === "error" && <span className="err">{e.message}</span>}
              {e.type === "done" && <>{e.ok ? "Completed" : `Ended: ${e.reason ?? "no sale"}`}</>}
            </div>
          </div>
        ))}
      </div>
      {rc && <div className="card" style={{ marginTop: 16 }}>
        <h2>Signed receipt</h2>
        <div className="receipt">{JSON.stringify(rc.receipt, null, 2)}</div>
        <p className="row" style={{ marginTop: 12 }}><a className="btn primary" href={`#/verify?id=${rc.receipt.receipt_id}`}>Verify this receipt</a> <a className="btn ghost" href={`${EXPLORER}/tx/${rc.tx_hash}`} target="_blank" rel="noreferrer">View on Kitescan (testnet)</a></p>
        <p className="sm">Settled via: {rc.receipt.payment.settled_via}. {rc.receipt.payment.settled_via === "self-relay" && "The Kite facilitator's settle call was failing, so the server submitted the signed EIP-3009 transfer itself."}</p>
      </div>}
    </div>
  );
}
