import { useRef } from "react";
import { useMotion } from "../motion";
import { Accordion, Bars, CountUp, Ico, Icon, Lines, Spark, REPO } from "../ui";
import { LatestSale, LiveDashboard, StatsStrip, fmtMs, useLive } from "../live";
import { usd } from "../lib";

const STEPS = [
  ["Negotiate", "A shopper agent haggles with the storefront. SERV Reasoning picks a concession level and writes the message; code turns it into a price and enforces the floor."],
  ["Price inside the 402", "The agreed price rides in the x402 payment requirements, exactly, in wei. Quotes are single-use and expire."],
  ["Pay on Kite", "The shopper signs an EIP-3009 transfer in testnet PYUSD. The server verifies, settles on-chain and fulfils atomically."],
  ["Signed receipt", "An ed25519 receipt lists the public rules that produced the price. Anyone can verify it without the private floor."],
];

export function Landing() {
  const root = useRef<HTMLDivElement>(null);
  useMotion(root, []);
  const { stats: s, activity: a } = useLive();
  const feesCents = (a?.fees ?? []).reduce((t, f) => t + f.cents, 0);
  return (
    <div ref={root}>
      <section className="hero" aria-labelledby="h1">
        <div className="hero-tile" data-parallax="24"><LatestSale /></div>
        <Lines as="h1" lines={[
          <><Ico c="g">{Icon.bolt}</Ico> <Ico c="o">{Icon.pulse}</Ico> Storefronts that</>,
          <><em>haggle</em> within your</>,
          <>rules <Ico c="y">{Icon.bars}</Ico> and show their work</>,
        ]} />
        <span id="h1" className="sr">Kitestall: a storefront agent that haggles within your rules and shows its work.</span>
        <div className="hero-sub">
          <p className="lead">Most Kite agents are the buyer's. Kitestall is the seller's: it negotiates with shopper agents, puts the agreed price inside an x402 payment, and issues a signed receipt that lists which public rules produced it. <b>All on Kite testnet.</b></p>
          <div className="actions"><a className="btn grey" href="#/watch">Watch a shopper buy</a><a className="btn primary" href="#/arena">Haggle in the Arena</a></div>
        </div>
      </section>

      <StatsStrip />

      <section className="sheet soft" aria-labelledby="bento-h" data-reveal>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 24, flexWrap: "wrap", alignItems: "flex-end" }}>
          <Lines lines={[<span id="bento-h">The seller's side of</span>, <>agent commerce, <em>counted</em></>]} className="sec-title" />
          <p className="sm" style={{ maxWidth: 300 }}>Every figure here is read from the live database. No placeholders, no demo data.</p>
        </div>
        <div className="bento">
          <div className="card" data-reveal>
            <span className="tag-y">Live from the database</span>
            <h3>Sales, quotes and fees</h3>
            <p className="sm">Quote → sale conversion on Kite testnet, with accrued platform fees (accrued, not collected).</p>
            <div className="stat-grid">
              <div className="kpi o"><div className="v"><CountUp value={s ? s.volume_cents / 100 : null} format={(n) => `$${n.toFixed(2)}`} decimals={2} /></div><div className="l">Settled volume (testnet)</div></div>
              <div className="kpi"><div className="v"><CountUp value={s?.settled_sales} /></div><div className="l">Settled sales</div></div>
              <div className="kpi y"><div className="v"><CountUp value={s?.quotes} /></div><div className="l">Quotes issued</div></div>
              <div className="kpi"><div className="v">{usd(feesCents)}</div><div className="l">Fees accrued</div></div>
            </div>
            <div style={{ marginTop: 14 }}><div className="sm">Discount per recent quote (%)</div><Spark data={a?.series.discount_pct ?? []} label="Discount per recent quote" /></div>
          </div>
          <div className="card black" data-reveal>
            <h3>Prompt Guard</h3>
            <p className="sm">Every buyer-authored string is screened by SERV. Blocked messages never move the price.</p>
            <div className="stat-grid">
              <div className="kpi"><div className="v"><CountUp value={s?.blocked_attacks} /></div><div className="l">Attacks blocked</div></div>
              <div className="kpi"><div className="v">{fmtMs(s?.serv_latency_p50_ms)}</div><div className="l">SERV p50 latency</div></div>
              <div className="kpi"><div className="v"><CountUp value={s?.rounds} /></div><div className="l">Rounds negotiated</div></div>
              <div className="kpi"><div className="v"><CountUp value={s?.fallback_rounds} /></div><div className="l">Fallback rounds (labeled)</div></div>
            </div>
            <p className="sm" style={{ marginTop: 14 }}>Fallback rounds used the deterministic engine, not SERV. They are always labeled.</p>
          </div>
        </div>
        <div className="big-num" data-reveal>
          <span className="sm">Average<br />discount</span>
          <span className="n">{s?.avg_discount_pct == null ? "—" : <CountUp value={s.avg_discount_pct} decimals={1} format={(n) => `${n.toFixed(1)}%`} />}</span>
          <span className="t">{s?.avg_discount_pct == null ? "No quotes yet. Haggle in the Arena to create the first one." : "Average discount across quotes issued so far. The private floor, enforced by code, decides how low it can ever go."}</span>
        </div>
      </section>

      <section className="sheet slide-h" aria-labelledby="slide-h" data-reveal>
        <Lines lines={[<span id="slide-h">Price inside the 402,</span>, <><em>receipts</em> that</>]} />
        <div className="slide-row">
          <span className="ico y" style={{ width: "clamp(48px,6vw,84px)", height: "clamp(48px,6vw,84px)", fontSize: "1.4rem", fontWeight: 600 }} aria-hidden="true">✓</span>
          <span className="pill-y" data-slide-x="240">show their work</span>
        </div>
        <div className="hero-sub"><p className="lead">The 402 amount equals the quote in wei, never rounded. The receipt cites the rule ids, the policy hash and the on-chain transaction, so a stranger can check it.</p>
          <div className="actions"><a className="btn grey" href="#/verify">Verify a receipt</a><a className="btn primary" href="#/arena">Start haggling</a></div></div>
      </section>

      <section className="sheet soft" aria-labelledby="how-h">
        <Lines lines={[<span id="how-h">How a sale happens,</span>, <><em>in four steps</em></>]} className="sec-title" />
        <div className="steps" data-stagger>
          {STEPS.map(([t, d], i) => <article className="step" key={t}><span className="num" aria-hidden="true">{i + 1}</span><h3>{t}</h3><p>{d}</p></article>)}
        </div>
      </section>

      <section className="sheet" aria-labelledby="show-h">
        <Lines lines={[<span id="show-h">Turning live data into</span>, <><em>real decisions</em></>]} className="sec-title" />
        <div className="show">
          <Accordion items={[
            { title: "Live sales ledger", body: "Every settled sale with its testnet transaction hash, how it settled (facilitator or self-relay) and a one-click receipt verification." },
            { title: "Negotiation trace", body: "Each round shows the Prompt Guard verdict, the concession level, the rules that fired and whether SERV or the labeled fallback decided." },
            { title: "Fees, accrued honestly", body: "Platform fee per settled sale plus a per-round quote fee after the free tier. Accrued in a ledger, not collected in this build." },
          ]} />
          <div className="devices" data-parallax="18">
            <div className="laptop"><div className="bar" aria-hidden="true"><i /><i /><i /></div><div className="scr"><LiveDashboard /></div></div>
            <div className="laptop-base" aria-hidden="true" />
            <div className="phone" data-parallax="-26"><span className="notch" aria-hidden="true" /><div className="scr"><LiveDashboard compact /></div></div>
          </div>
        </div>
      </section>

      <div className="mark" aria-hidden="true"><span data-marquee>Kitestall Kitestall Kitestall</span></div>

      <section className="sheet soft" aria-labelledby="ctl-h">
        <Lines lines={[<span id="ctl-h">You keep full control</span>, <><em>over your rules</em></>]} className="sec-title" />
        <div className="f2" data-stagger>
          <article className="fcard">
            <div className="plate">
              <div className="eyebrow">Quote → sale</div>
              <div style={{ display: "flex", gap: 14, alignItems: "baseline", flexWrap: "wrap" }}>
                <span style={{ fontSize: "clamp(2.2rem,4vw,3.2rem)", letterSpacing: "-.04em" }}><CountUp value={s?.settled_sales} /> <span className="grey">/ {s?.quotes ?? "—"}</span></span>
                <span className="sm">settled / quotes</span>
              </div>
              <Bars data={a?.series.discount_pct ?? []} label="Discount percent per recent quote" />
            </div>
            <h3>Rules you can audit</h3><p>Public rules and a policy hash are published; the private floor stays private and is enforced in code, never in a prompt.</p>
          </article>
          <article className="fcard">
            <div className="plate">
              <div className="eyebrow">SERV decision latency</div>
              <div style={{ fontSize: "clamp(2.2rem,4vw,3.2rem)", letterSpacing: "-.04em" }}>{fmtMs(s?.serv_latency_p50_ms)} <span className="sm">p50 · {s?.serv_live_rounds ?? 0} live rounds</span></div>
              <Spark data={a?.series.latency_ms ?? []} color="var(--ink)" label="SERV latency of recent live rounds in milliseconds" />
            </div>
            <h3>Measured, not promised</h3><p>Latency comes from the rounds SERV actually decided. Benchmarks and adversarial results are generated by scripts, never typed in.</p>
          </article>
        </div>
      </section>

      <section className="sheet" aria-label="Built on Kite and OpenServ SERV">
        <div className="eyebrow" style={{ textAlign: "center" }}>Built on</div>
        <div className="partners">
          <span className="partner"><img src="/kite-logo-96.png" alt="Kite" width="48" height="48" loading="lazy" />Kite</span>
          <span className="x" aria-hidden="true">×</span>
          <span className="partner dark-chip"><img src="/openserv-logo-white-96.png" alt="OpenServ" width="48" height="48" loading="lazy" />OpenServ SERV</span>
        </div>
        <p className="sm" style={{ textAlign: "center" }}>Kite testnet for x402 payments · SERV Reasoning for Prompt Guard, structured decisions and Multipath</p>
      </section>

      <section className="cta" aria-labelledby="cta-h" data-reveal>
        <div className="tile" aria-hidden="true"><span style={{ width: 34, height: 34, display: "block" }}>{Icon.link}</span></div>
        <h2 id="cta-h">Get Started</h2>
        <p className="lead" style={{ margin: "16px auto 0" }}>Try to haggle below the floor, watch a shopper agent buy with a real testnet transaction, or publish your own policy in plain English.</p>
        <div className="actions"><a className="btn grey" href="#/watch">Watch a shopper buy</a><a className="btn primary" href="#/arena">Haggle in the Arena</a><a className="btn grey" href="#/owner">Open your stall</a><a className="btn grey" href={REPO} target="_blank" rel="noreferrer">View the code</a></div>
      </section>
    </div>
  );
}
