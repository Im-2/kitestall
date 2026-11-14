import { useEffect, useState } from "react";
import { api, usd } from "../lib";

export function TallyStrip() {
  const [s, setS] = useState<any>(null); const [err, setErr] = useState(false);
  useEffect(() => { const f = () => api("/api/stats").then((r) => (r.ok ? (setS(r.data), setErr(false)) : setErr(true))); f(); const t = setInterval(f, 15000); return () => clearInterval(t); }, []);
  return (
    <div className="tally" role="status" aria-label="Live statistics from the database">
      <div className="wrap">
        {err ? <span>stats unavailable</span> : !s ? <span>loading tally…</span> : <>
          <span>NEGOTIATIONS <b>{s.negotiations}</b></span><span>SETTLED SALES <b>{s.settled_sales}</b></span><span>VOLUME <b>{usd(s.volume_cents)}</b> testnet</span>
          <span>ATTACKS BLOCKED <b>{s.blocked_attacks}</b></span><span>AVG DISCOUNT <b>{s.avg_discount_pct ?? "—"}{s.avg_discount_pct != null ? "%" : ""}</b></span>
          <span>FEES ACCRUED <b>{usd(s.fees_accrued_cents)}</b></span><span>SERV p50 <b>{s.serv_latency_p50_ms ?? "—"}{s.serv_latency_p50_ms ? " ms" : ""}</b></span>
        </>}
      </div>
    </div>
  );
}

export function Landing() {
  return (
    <>
      <section className="hero">
        <span className="badge">Kite testnet</span>
        <h1>A storefront agent that haggles within your rules — and shows its work.</h1>
        <p className="lead">Most Kite agents are the buyer's. Kitestall is the seller's: it negotiates with shopper agents using SERV Reasoning, puts the agreed price inside an x402 <code>402</code>, and issues a signed receipt that lists which public rules produced the price. The floor is code, not a prompt.</p>
      </section>
      <section className="cta" aria-label="Start here">
        <a className="card" href="#/arena"><h2>Haggle in the Arena</h2><p>Try to talk the shop below its floor. Watch the live rule trace and Prompt Guard verdicts.</p></a>
        <a className="card" href="#/watch"><h2>Watch a shopper agent buy</h2><p>A real testnet purchase, including a buyer budget limit and a renegotiation.</p></a>
        <a className="card" href="#/owner"><h2>Open your stall</h2><p>Paste your pricing policy in plain English, preview 5 simulated haggles, publish.</p></a>
      </section>
      <section className="grid2">
        <div className="card">
          <h2>How it works</h2>
          <ul className="steps">
            <li><b>SERV Reasoning</b> picks a concession level (an enum) and writes the message. It never sees the floor and never outputs a price.</li>
            <li><b>Prompt Guard</b> screens every buyer-authored string. A blocked message is never retried without it.</li>
            <li><b>Code</b> converts the level to a price and enforces floor, stock, rounds and leaks.</li>
            <li><b>Kite</b>: the agreed price rides in the x402 requirements (testnet PYUSD). The payment settles on-chain.</li>
            <li><b>Receipts</b> are ed25519-signed and verifiable without the private floor.</li>
          </ul>
        </div>
        <div className="card">
          <h2>Run your own shopper</h2>
          <pre className="mono" style={{ whiteSpace: "pre-wrap", margin: 0 }}>{`git clone https://github.com/Im-2/kitestall
pnpm install
SHOPPER_PRIVATE_KEY=0x… \\
pnpm --filter @kitestall/shopper exec tsx src/cli.ts \\
  --shop ${location.origin} --shop-id nomad \\
  --item day-pass --budget 2500`}</pre>
          <p>Agent-readable docs: <a href="/llms.txt">/llms.txt</a>. Use a funded Kite <b>testnet</b> key only.</p>
        </div>
      </section>
    </>
  );
}
