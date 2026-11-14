import { useEffect, useMemo, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { REPO, TestnetBadge } from "./ui";
import { StatsStrip, BudgetBanner } from "./live";

const NAV: [string, string][] = [["home", "Home"], ["arena", "Arena"], ["watch", "Watch a shopper"], ["owner", "Open a stall"], ["verify", "Verify"]];

export function SiteHeader({ route }: { route: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [route]);
  return (
    <header className="hdr page">
      <div className="hdr-bar">
        <a className="brand" href="#/home" aria-label="Kitestall home"><img src="/kite-logo-96.png" alt="" width="30" height="30" />Kitestall</a>
        <nav className={"nav" + (open ? " open" : "")} aria-label="Main">
          {NAV.map(([to, label]) => <a key={to} href={`#/${to}`} className={route === to || (to === "home" && route === "home") ? "on" : ""} aria-current={route === to ? "page" : undefined}>{label}</a>)}
        </nav>
        <TestnetBadge />
        <a className="btn white cta-pill" href="#/arena">Try the Arena</a>
        <button className="btn grey menu-btn" aria-expanded={open} aria-label="Menu" onClick={() => setOpen(!open)}>{open ? "Close" : "Menu"}</button>
      </div>
    </header>
  );
}

function Qr({ text }: { text: string }) {
  const svg = useMemo(() => { const q = qrcode(0, "M"); q.addData(text); q.make(); return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true }); }, [text]);
  return <div className="qr" role="img" aria-label={`QR code linking to ${text}`} dangerouslySetInnerHTML={{ __html: svg }} />;
}

export function SiteFooter() {
  return (
    <footer className="page" style={{ padding: 0 }}>
      <div className="ftr">
        <div className="ftr-top">
          <nav aria-label="Footer">{NAV.map(([to, l]) => <a key={to} href={`#/${to}`}>{l}</a>)}<a href="/llms.txt">llms.txt</a><a href="/.well-known/kitestall.json">Discovery</a></nav>
          <a className="ftr-mail" href={REPO} target="_blank" rel="noreferrer">github.com/Im-2/kitestall</a>
        </div>
        <div className="ftr-mid">
          <div><b style={{ color: "#fff" }}>Built on</b><br />Kite testnet (x402, PYUSD) and OpenServ SERV Reasoning.</div>
          <div><b style={{ color: "#fff" }}>Honest by design</b><br />Fees are accrued, not collected. Payments use a labeled dev signer, not a Passport session.</div>
          <div><b style={{ color: "#fff" }}>Hackathon</b><br />OpenServ SERV Hackathon Ed. 02, Track 02: Kite. MIT licensed.</div>
        </div>
        <div className="ftr-bot">
          <div className="ftr-word">Kitestall<sup style={{ fontSize: ".25em", verticalAlign: "top" }}>®</sup></div>
          <Qr text={REPO} />
        </div>
        <p className="fine">Everything shown is Kite <b>testnet</b>. Numbers on this site come from the live database. Kite and OpenServ marks belong to their owners.</p>
      </div>
    </footer>
  );
}

export function Shell({ route, children }: { route: string; children: ReactNode }) {
  return (
    <>
      <a className="skip" href="#main">Skip to content</a>
      <SiteHeader route={route} />
      <main id="main" className="page" tabIndex={-1}>
        <BudgetBanner />
        {route !== "home" && <StatsStrip />}
        {children}
      </main>
      <SiteFooter />
    </>
  );
}
