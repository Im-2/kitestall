export const usd = (c: number | null | undefined) => (c == null ? "—" : `$${(c / 100).toFixed(2)}`);
export async function api<T = any>(path: string, init?: RequestInit): Promise<{ ok: boolean; status: number; data: T }> {
  try {
    const r = await fetch(path, init); const t = await r.text(); let d: any; try { d = JSON.parse(t); } catch { d = { error: { message: t.slice(0, 200) } }; }
    return { ok: r.ok, status: r.status, data: d };
  } catch (e) { return { ok: false, status: 0, data: { error: { message: "Network error: " + (e as Error).message } } as any }; }
}
export const EXPLORER = "https://testnet.kitescan.ai";
export const short = (h?: string) => (h ? h.slice(0, 10) + "…" + h.slice(-6) : "");
export function sse(url: string, onEvent: (e: any) => void, onEnd?: () => void) {
  const es = new EventSource(url);
  es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch { /* ignore */ } };
  es.onerror = () => { es.close(); onEnd?.(); };
  return () => es.close();
}
