import { useEffect, useState } from "react";
import { api, EXPLORER } from "../lib";

export function Verify() {
  const q = new URLSearchParams(location.hash.split("?")[1] ?? "");
  const [id, setId] = useState(q.get("id") ?? ""); const [json, setJson] = useState(""); const [res, setRes] = useState<any>(null); const [err, setErr] = useState(""); const [busy, setBusy] = useState(false);
  async function check(byId?: string) {
    setErr(""); setRes(null); setBusy(true);
    let r;
    if (byId ?? (id && !json)) r = await api(`/receipts/${encodeURIComponent((byId ?? id).trim())}/verify`);
    else { let body: any; try { body = JSON.parse(json); } catch { setErr("That is not valid JSON."); setBusy(false); return; } r = await api("/verify", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ receipt: body }) }); }
    setBusy(false); if (!r.ok && !r.data?.checks) setErr(r.data?.error?.message ?? "Verification failed"); else setRes(r.data);
  }
  useEffect(() => { if (id) check(id); /* eslint-disable-next-line */ }, []);
  return (
    <div>
      <div className="app-top"><h1>Verify a receipt</h1>
      <p>Checks the signature, that every cited rule is in the shop's published policy, that the price is inside the public bounds, that the policy hash matches, and that the payment is on-chain. It never needs the private floor.</p></div>
      <div className="grid2">
        <div className="card">
          <label htmlFor="rid">Receipt ID</label><input id="rid" value={id} onChange={(e) => setId(e.target.value)} placeholder="rc_…" />
          <label htmlFor="rj">…or paste the receipt JSON</label><textarea id="rj" rows={8} className="mono" value={json} onChange={(e) => setJson(e.target.value)} />
          <p><button className="btn primary" onClick={() => check()} disabled={busy || (!id && !json)}>{busy ? "Checking…" : "Verify"}</button></p>
          {err && <p className="err" role="alert">{err}</p>}
        </div>
        <div className="card" aria-live="polite">
          <h2>Result {res && <span className={"badge " + (res.ok ? "ok" : "")}>{res.ok ? "all checks pass" : "failed"}</span>}</h2>
          {!res ? <p className="empty">No result yet.</p> : res.checks.map((c: any) => <div key={c.name} className={"check " + (c.ok ? "ok" : "bad")}><span className="m">{c.ok ? "✓" : "✗"}</span><div><b>{c.name}</b><br /><span className="mono">{c.detail}</span></div></div>)}
          {res?.explorer_url && <p><a href={res.explorer_url.replace("https://testnet.kitescan.ai", EXPLORER)} target="_blank" rel="noreferrer">Open transaction on Kitescan (testnet)</a></p>}
        </div>
      </div>
    </div>
  );
}
