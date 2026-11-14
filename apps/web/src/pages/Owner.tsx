import { useEffect, useState } from "react";
import { api, usd, EXPLORER, short } from "../lib";
import { useLive } from "../live";

const TOKEN_KEY = "kitestall_owner_token";
const SAMPLE = "We run a small bakery. Sourdough loaves list at $9. Give 10% off when someone buys 4 or more. Regulars get an extra 5%. Never go more than 25% off list and never below 78% of list. Up to 3 rounds. Be friendly.";

export function Owner() {
  const [token, setToken] = useState(() => { try { return sessionStorage.getItem(TOKEN_KEY) ?? ""; } catch { return ""; } });
  const [shops, setShops] = useState<any[]>([]); const [shop, setShop] = useState("nomad"); const [english, setEnglish] = useState(SAMPLE);
  const [compiled, setCompiled] = useState<any>(null); const [preview, setPreview] = useState<any>(null); const [msg, setMsg] = useState(""); const [busy, setBusy] = useState("");
  const [ledger, setLedger] = useState<any>(null); const [negs, setNegs] = useState<any[]>([]);
  const { stats } = useLive(); const bud = stats?.serv_budget;
  const [nw, setNw] = useState({ id: "", name: "", wallet: "", item: "", price: "", stock: "10" });
  const H = { "content-type": "application/json", authorization: `Bearer ${token}` };
  const save = (t: string) => { setToken(t); try { sessionStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } };

  useEffect(() => { api("/shops").then((r) => r.ok && setShops(r.data.shops)); }, [msg]);
  async function refresh() {
    const l = await api("/owner/ledger", { headers: H }); if (l.ok) setLedger(l.data); else if (l.status === 401) setLedger(null);
    const n = await api("/owner/negotiations", { headers: H }); if (n.ok) setNegs(n.data.rounds);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- refresh closes over the token and is re-created each render; poll only when the token changes
  useEffect(() => { if (token) { refresh(); const t = setInterval(refresh, 15000); return () => clearInterval(t); } }, [token]);

  async function compile() { setBusy("compile"); setMsg(""); setPreview(null); const r = await api("/owner/policy/compile", { method: "POST", headers: H, body: JSON.stringify({ english }) }); setBusy(""); if (r.ok) setCompiled(r.data); else { setCompiled(null); setMsg(r.status === 401 ? "Owner token is missing or wrong." : `Could not compile: ${r.data?.error?.message ?? r.data?.error ?? "unknown"}${r.data?.issues ? " — " + JSON.stringify(r.data.issues).slice(0, 200) : ""}`); } }
  async function runPreview() { setBusy("preview"); const r = await api("/owner/policy/preview", { method: "POST", headers: H, body: JSON.stringify({ draft: compiled.draft, shop_id: shop }) }); setBusy(""); if (r.ok) setPreview(r.data); else setMsg(r.data?.error?.message ?? "Preview failed"); }
  async function publish() { setBusy("publish"); const r = await api("/owner/policy/publish", { method: "POST", headers: H, body: JSON.stringify({ draft: compiled.draft, shop_id: shop }) }); setBusy(""); setMsg(r.ok ? `Published policy v${r.data.version} (hash ${r.data.policy_hash.slice(0, 22)}…) for ${shop}.` : r.data?.error?.message ?? "Publish failed"); }
  async function createShop() {
    setBusy("shop"); const price = Math.round(parseFloat(nw.price) * 100);
    const r = await api("/owner/shops", { method: "POST", headers: H, body: JSON.stringify({ id: nw.id, name: nw.name, wallet: nw.wallet, items: [{ id: nw.item.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40) || "item", name: nw.item, list_cents: price, stock: Number(nw.stock) }] }) });
    setBusy(""); setMsg(r.ok ? `Created shop ${nw.id}. Now compile and publish a policy for it.` : r.data?.error?.message ?? "Could not create shop"); if (r.ok) setShop(nw.id);
  }
  return (
    <div>
      <div className="app-top"><h1>Open your stall</h1>
      <p>Owner access uses a single bearer token set by the operator (demo-grade auth). The token stays in this tab's session storage only.</p></div>
      <div className="card"><label htmlFor="tok">Owner token</label><input id="tok" type="password" value={token} onChange={(e) => save(e.target.value)} autoComplete="off" placeholder="Paste OWNER_TOKEN" style={{ maxWidth: 420 }} /></div>
      {!token ? <p className="empty">Enter the owner token to continue.</p> : <>
        <div className="grid2" style={{ marginTop: 16 }}>
          <section className="card">
            <h2>1 · Your policy, in plain English</h2>
            <label htmlFor="shopsel">Apply to shop</label><select id="shopsel" value={shop} onChange={(e) => setShop(e.target.value)}>{shops.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}</select>
            <label htmlFor="eng">Policy</label><textarea id="eng" rows={7} value={english} onChange={(e) => setEnglish(e.target.value)} />
            <p><button className="btn primary" onClick={compile} disabled={!!busy}>{busy === "compile" ? "Compiling with SERV…" : "Compile with SERV"}</button></p>
            {msg && <p role="status" className={msg.startsWith("Could") || msg.includes("wrong") ? "err" : ""}>{msg}</p>}
          </section>
          <section className="card">
            <h2>2 · What I understood</h2>
            {!compiled ? <p className="empty">Compile a policy to see it here.</p> : <>
              <ul>{compiled.understood.map((u: string, i: number) => <li key={i}>{u}</li>)}</ul>
              <p>Persona <span className="badge blue">{compiled.draft.persona}</span> · max discount <b>{compiled.draft.max_discount_pct}%</b> (public) · rounds <b>{compiled.draft.max_rounds}</b> · private floor <b>{compiled.draft.floor_default_pct}% of list</b> (never published)</p>
              <p>Public rules: {compiled.public_rules.map((r: any) => <span className="chip" key={r.id} title={r.text}>{r.id}</span>)}</p>
              <p className="row"><button className="btn ghost" onClick={runPreview} disabled={!!busy}>{busy === "preview" ? "Simulating…" : "Run 5 simulated haggles"}</button><button className="btn primary" onClick={publish} disabled={!!busy}>Approve & publish</button></p>
            </>}
          </section>
        </div>
        {preview && <section className="card" style={{ marginTop: 16 }}><h2>3 · Simulated haggles</h2><p className="sm">{preview.method}</p>
          <div className="tablewrap"><table><thead><tr><th>Buyer offers</th><th>Outcome</th><th>Final</th><th>Rounds</th></tr></thead><tbody>{preview.simulations.map((s: any, i: number) => <tr key={i}><td>{usd(s.buyer_offer_cents)}</td><td>{s.outcome}</td><td>{usd(s.final_price_cents)}</td><td>{s.rounds}</td></tr>)}</tbody></table></div></section>}
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Create a new shop</h2>
          <div className="row"><div><label htmlFor="n1">Shop id</label><input id="n1" value={nw.id} onChange={(e) => setNw({ ...nw, id: e.target.value })} placeholder="my-bakery" /></div><div><label htmlFor="n2">Name</label><input id="n2" value={nw.name} onChange={(e) => setNw({ ...nw, name: e.target.value })} /></div></div>
          <label htmlFor="n3">Payout wallet (Kite testnet 0x…)</label><input id="n3" value={nw.wallet} onChange={(e) => setNw({ ...nw, wallet: e.target.value })} className="mono" />
          <div className="row"><div><label htmlFor="n4">First item</label><input id="n4" value={nw.item} onChange={(e) => setNw({ ...nw, item: e.target.value })} /></div><div><label htmlFor="n5">List price ($)</label><input id="n5" inputMode="decimal" value={nw.price} onChange={(e) => setNw({ ...nw, price: e.target.value })} /></div><div><label htmlFor="n6">Stock</label><input id="n6" inputMode="numeric" value={nw.stock} onChange={(e) => setNw({ ...nw, stock: e.target.value })} /></div></div>
          <p><button className="btn ghost" onClick={createShop} disabled={!!busy}>Create shop</button></p>
        </section>
        <section className="card black" style={{ marginTop: 16 }}>
          <h2>SERV budget <span className="badge warn">estimated</span></h2>
          {!bud ? <p className="empty">Loading…</p> : <>
            <div className="stat-grid">
              <div className="kpi"><div className="v">${bud.daily_spent_usd.toFixed(3)}</div><div className="l">Spent today (of ${bud.daily_cap_usd.toFixed(2)})</div></div>
              <div className="kpi"><div className="v">${bud.daily_remaining_usd.toFixed(3)}</div><div className="l">Left today</div></div>
              <div className="kpi"><div className="v">${bud.total_spent_usd.toFixed(3)}</div><div className="l">Spent in total (of ${bud.total_cap_usd.toFixed(2)})</div></div>
              <div className="kpi"><div className="v">${bud.total_remaining_usd.toFixed(3)}</div><div className="l">Left in total</div></div>
            </div>
            <p className="sm" style={{ marginTop: 12 }}>{bud.method}. {bud.capped ? <b>Cap reached: the shop is using the deterministic fallback.</b> : "Under the cap: SERV is deciding rounds."}</p>
          </>}
        </section>
        <section className="card" style={{ marginTop: 16 }}>
          <h2>Sales ledger <span className="badge">testnet</span></h2>
          {!ledger ? <p className="empty">Ledger unavailable (check the token).</p> : <>
            <p className="sm">{ledger.note}</p>
            <p>Fees accrued: {ledger.fees.length ? ledger.fees.map((f: any) => <span className="chip" key={f.kind}>{f.kind}: {usd(f.cents)} ({f.n})</span>) : <span className="empty">none yet</span>}</p>
            <p>Fees collected on-chain (testnet): {ledger.collected?.length ? ledger.collected.map((f: any) => <span className="chip" key={f.kind}>{f.kind}: {usd(f.cents)} ({f.n})</span>) : <span className="empty">none yet</span>}</p>
            {ledger.firm_quotes?.length > 0 && <div className="tablewrap"><table><thead><tr><th>Firm quote</th><th>Item</th><th>Price</th><th>Fee</th><th>Fee tx</th></tr></thead><tbody>{ledger.firm_quotes.slice(0, 8).map((f: any) => <tr key={f.firm_quote_id}><td className="mono">{f.firm_quote_id}</td><td>{f.item_id} ×{f.qty}</td><td>{usd(f.unit_price_cents)}</td><td>{usd(f.amount_cents)}</td><td>{f.tx_hash ? <a href={f.explorer_url} target="_blank" rel="noreferrer" className="mono">{short(f.tx_hash)}</a> : "—"}</td></tr>)}</tbody></table></div>}
            {ledger.needs_reconcile.length > 0 ? <p className="err" role="alert">Needs reconcile: {ledger.needs_reconcile.length} payment(s) settled or unknown on-chain without fulfilment.</p> : <p className="sm">Needs reconcile: <b>none</b> (every verified payment has an order).</p>}
            {ledger.sales.length === 0 ? <p className="empty">No settled sales yet.</p> : <div className="tablewrap"><table><thead><tr><th>When</th><th>Shop</th><th>Item</th><th>Total</th><th>Tx</th><th>Receipt</th></tr></thead><tbody>{ledger.sales.map((s: any) => <tr key={s.order_id}><td>{new Date(s.created_at).toLocaleString()}</td><td>{s.shop_id}</td><td>{s.item_id} ×{s.qty}</td><td>{usd(s.total_cents)}</td><td><a href={`${EXPLORER}/tx/${s.tx_hash}`} target="_blank" rel="noreferrer" className="mono">{short(s.tx_hash)}</a></td><td><a href={`#/verify?id=${s.receipt_id}`}>verify</a></td></tr>)}</tbody></table></div>}
          </>}
        </section>
        <section className="card" style={{ marginTop: 16 }}><h2>Live negotiations</h2>
          {negs.length === 0 ? <p className="empty">No rounds yet.</p> : <div className="tablewrap"><table><thead><tr><th>Shop</th><th>Rd</th><th>Offer</th><th>Ask</th><th>Status</th><th>Guard</th><th>By</th></tr></thead><tbody>{negs.slice(0, 25).map((n, i) => <tr key={i}><td>{n.shop_id}</td><td>{n.round}</td><td>{n.offer_cents != null ? usd(n.offer_cents) : "—"}</td><td>{usd(n.ask_cents)}</td><td>{n.status}</td><td>{n.guard}</td><td>{n.serv_status}</td></tr>)}</tbody></table></div>}</section>
      </>}
    </div>
  );
}
