import { StrictMode, Suspense, lazy, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import "./styles.css";
import { Shell } from "./layout";
import { Landing } from "./pages/Landing";
import { initScroll, scrollToTop } from "./motion";

const Arena = lazy(() => import("./pages/Arena").then((m) => ({ default: m.Arena })));
const Watch = lazy(() => import("./pages/Watch").then((m) => ({ default: m.Watch })));
const Owner = lazy(() => import("./pages/Owner").then((m) => ({ default: m.Owner })));
const Verify = lazy(() => import("./pages/Verify").then((m) => ({ default: m.Verify })));

function useRoute() {
  const get = () => ((location.hash.replace(/^#\/?/, "") || "home").split("?")[0] || "home");
  const [r, setR] = useState(get());
  useEffect(() => { const f = () => { setR(get()); scrollToTop(); }; addEventListener("hashchange", f); return () => removeEventListener("hashchange", f); }, []);
  return r;
}

function App() {
  const r = useRoute();
  useEffect(() => { initScroll(); }, []);
  const route = ["arena", "watch", "owner", "verify"].includes(r) ? r : "home";
  return (
    <Shell route={route}>
      <Suspense fallback={<p className="empty" role="status" style={{ padding: 40 }}>Loading…</p>}>
        {route === "arena" ? <Arena /> : route === "watch" ? <Watch /> : route === "owner" ? <Owner /> : route === "verify" ? <Verify /> : <Landing />}
      </Suspense>
    </Shell>
  );
}
createRoot(document.getElementById("root")!).render(<StrictMode><App /></StrictMode>);
