import { useEffect, useRef, useState, type ReactNode } from "react";
import gsap from "gsap";
import { reduced } from "./motion";

export const REPO = "https://github.com/Im-2/kitestall";

export const Icon = {
  pulse: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M3 12h4l3-8 4 16 3-8h4" /></svg>,
  bolt: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4 14h6l-1 8 9-12h-6z" /></svg>,
  bars: <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="4" y="10" width="3.4" height="10" rx="1.5" /><rect x="10.3" y="4" width="3.4" height="16" rx="1.5" /><rect x="16.6" y="8" width="3.4" height="12" rx="1.5" /></svg>,
  link: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true"><path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1" /><path d="M14 10a4 4 0 0 0-5.7 0l-3 3A4 4 0 0 0 11 18.7l1-1" /></svg>,
  arrow: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>,
};
export const Ico = ({ c, children }: { c: "o" | "y" | "g"; children: ReactNode }) => <span className={`ico ${c}`}>{children}</span>;

/** Headline whose lines slide up on load/scroll. Lines are arrays of nodes so emphasis spans work. */
export function Lines({ as: Tag = "h2", lines, className, delay }: { as?: "h1" | "h2"; lines: ReactNode[]; className?: string; delay?: number }) {
  return (
    <Tag className={className} data-lines data-delay={delay}>
      {lines.map((l, i) => <span className="ln" key={i}><span>{l}</span></span>)}
    </Tag>
  );
}

/** Number that counts up to its real value when scrolled into view. Shows the final value immediately with reduced motion. */
export function CountUp({ value, format = (n: number) => String(Math.round(n)), decimals = 0 }: { value: number | null | undefined; format?: (n: number) => string; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null); const [shown, setShown] = useState<number>(value ?? 0);
  useEffect(() => {
    const v = value ?? 0;
    if (reduced() || !ref.current) { setShown(v); return; }
    const o = { n: 0 };
    const tw = gsap.to(o, { n: v, duration: 1.4, ease: "power3.out", onUpdate: () => setShown(Number(o.n.toFixed(decimals))), scrollTrigger: { trigger: ref.current, start: "top 92%", once: true } });
    return () => { tw.scrollTrigger?.kill(); tw.kill(); };
  }, [value, decimals]);
  return <span ref={ref}>{value == null ? "—" : format(shown)}</span>;
}

export function Accordion({ items }: { items: { title: string; body: string }[] }) {
  const [open, setOpen] = useState(0);
  return (
    <div className="acc">
      {items.map((it, i) => (
        <div className="acc-item" key={it.title} data-open={open === i}>
          <button aria-expanded={open === i} aria-controls={`acc-${i}`} onClick={() => setOpen(open === i ? -1 : i)}>
            <span>{it.title}</span><span className="pm" aria-hidden="true">+</span>
          </button>
          <div className="acc-body" id={`acc-${i}`} role="region"><div><p>{it.body}</p></div></div>
        </div>
      ))}
    </div>
  );
}

/** Inline SVG sparkline from a real series. Renders an honest empty state for <2 points. */
export function Spark({ data, color = "var(--accent)", label }: { data: number[]; color?: string; label: string }) {
  if (data.length < 2) return <p className="empty sm" role="img" aria-label={`${label}: not enough data yet`}>Not enough data yet.</p>;
  const w = 300, h = 80, min = Math.min(...data), max = Math.max(...data), span = max - min || 1;
  const pts = data.map((v, i) => [(i / (data.length - 1)) * w, h - 8 - ((v - min) / span) * (h - 16)] as const);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${data.length} points, min ${min}, max ${max}`}>
      <path d={`${d} L${w} ${h} L0 ${h} Z`} fill={color} opacity=".12" /><path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
export function Bars({ data, color = "var(--yellow)", label }: { data: number[]; color?: string; label: string }) {
  if (data.length === 0) return <p className="empty sm" role="img" aria-label={`${label}: no data yet`}>No data yet.</p>;
  const w = 300, h = 80, max = Math.max(...data, 1), bw = w / data.length;
  return (
    <svg className="spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img" aria-label={`${label}: ${data.join(", ")}`}>
      {data.map((v, i) => <rect key={i} x={i * bw + 2} y={h - (v / max) * (h - 6)} width={Math.max(2, bw - 4)} height={(v / max) * (h - 6)} rx="3" fill={color} />)}
    </svg>
  );
}

export const TestnetBadge = () => <span className="badge" title="Kite testnet: no real money">Testnet</span>;
