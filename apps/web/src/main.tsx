import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Landing, TallyStrip } from "./pages/Landing";
import { Arena } from "./pages/Arena";
import { Watch } from "./pages/Watch";
import { Owner } from "./pages/Owner";
import { Verify } from "./pages/Verify";

function useRoute() {
  const get = () => (location.hash.replace(/^#\/?/, "") || "").split("?")[0] || "home";
  const [r, setR] = useState(get());
  useEffect(() => { const f = () => setR(get()); addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}

function App() {
  const r = useRoute();
  const link = (to: string, label: string) => <a className={"link" + (r === to ? " on" : "")} href={`#/${to}`}>{label}</a>;
  return (
    <>
      <TallyStrip />
      <div className="wrap">
        <nav aria-label="Main">
          <a className="brand" href="#/home">Kitestall</a>
          {link("arena", "Arena")}{link("watch", "Watch a shopper")}{link("owner", "Open a stall")}{link("verify", "Verify")}
          <span className="badge" title="All payments are on Kite testnet. No real money.">Testnet</span>
        </nav>
        <main>
          {r === "arena" ? <Arena /> : r === "watch" ? <Watch /> : r === "owner" ? <Owner /> : r.startsWith("verify") ? <Verify /> : <Landing />}
        </main>
        <footer>
          Kitestall is a hackathon build (OpenServ SERV Hackathon Ed. 02, Kite track). Everything shown is Kite <b>testnet</b>; fees are accrued, not collected.
          {" "}<a href="https://github.com/Im-2/kitestall">Source</a> · <a href="/llms.txt">llms.txt</a> · <a href="/.well-known/kitestall.json">discovery</a>
        </footer>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
