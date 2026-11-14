import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import qrcode from "qrcode-generator";
import { REPO, TestnetBadge } from "./ui";
import { StatsStrip, BudgetBanner } from "./live";

const NAV: [string, string][] = [["home", "Home"], ["arena", "Arena"], ["watch", "Watch a shopper"], ["owner", "Open a stall"], ["verify", "Verify"]];

/** The Kitestall mark sits on its own cream tile, so it is shown as a small rounded square. */
export const Mark = ({ size = 32 }: { size?: number }) => <img className="mark-sq" src="/kitestall-mark.svg" alt="" width={size} height={size} />;

export function SiteHeader({ route }: { route: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => setOpen(false), [route]);
  useEffect(() => { // mobile sheet: lock page scroll, close on Escape or when the viewport grows to desktop, restore focus
    if (!open) return;
    const prev = document.body.style.overflow; document.body.style.overflow = "hidden"; const opener = btn.current;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    const mq = matchMedia("(min-width: 901px)"); const onMq = () => mq.matches && setOpen(false);
    addEventListener("keydown", onKey); mq.addEventListener("change", onMq);
    return () => { document.body.style.overflow = prev; removeEventListener("keydown", onKey); mq.removeEventListener("change", onMq); opener?.focus(); };
  }, [open]);
  const link = (to: string, label: string, cls = "") => <a key={to} href={`#/${to}`} className={(route === to ? "on " : "") + cls} aria-current={route === to ? "page" : undefined}>{label}</a>;
  return (
    <header className="hdr page">
      <div className="hdr-bar">
        <a className="brand" href="#/home" aria-label="Kitestall home"><Mark />Kitestall</a>
        <nav className="nav" aria-label="Main">{NAV.map(([to, label]) => link(to, label))}</nav>
        <span className="hdr-right">
          <TestnetBadge />
          <a className="btn white cta-pill" href="#/arena">Try the Arena</a>
          <button ref={btn} className="btn grey menu-btn" aria-expanded={open} aria-controls="mobile-sheet" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen(!open)}>
            <span className="burger" aria-hidden="true"><i /><i /><i /></span><span className="menu-label">Menu</span>
          </button>
        </span>
      </div>
      {open && (
        <div id="mobile-sheet" className="sheet-menu" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="sheet-top">
            <a className="brand" href="#/home" onClick={() => setOpen(false)}><Mark />Kitestall</a>
            <button className="btn grey" onClick={() => setOpen(false)} aria-label="Close menu">Close</button>
          </div>
          <nav aria-label="Mobile">{NAV.map(([to, label]) => link(to, label))}</nav>
          <div className="sheet-foot"><TestnetBadge /><a className="btn primary" href="#/arena">Try the Arena</a></div>
        </div>
      )}
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
          <div className="ftr-brand"><img className="mark-sq big" src="/kitestall-mark.svg" alt="" width="72" height="72" /><div className="ftr-word">Kitestall<sup style={{ fontSize: ".25em", verticalAlign: "top" }}>®</sup></div></div>
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
