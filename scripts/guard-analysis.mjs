// Mines the dev DB (real rounds already made; NO SERV calls) for which messages Prompt Guard blocked. Usage: node scripts/guard-analysis.mjs [dbPath]
import { createRequire } from "node:module";
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite");
const d = new DatabaseSync(process.argv[2] ?? "apps/api/data/kitestall.db");
const rows = d.prepare("SELECT buyer_message m, offer_cents o, guard g, round r FROM rounds WHERE serv_status IN ('live','blocked') AND buyer_message IS NOT NULL AND buyer_message != ''").all();
const blocked = rows.filter((x) => x.g === "blocked");
console.log(`rounds with a buyer message that reached the guard: ${rows.length}; blocked: ${blocked.length} (${((blocked.length / rows.length) * 100).toFixed(1)}%)`);
const by = {};
for (const x of rows) { const k = x.m.slice(0, 70); (by[k] ??= { b: 0, c: 0 })[x.g === "blocked" ? "b" : "c"]++; }
console.log("\nper distinct message (blocked / clean):");
for (const [k, v] of Object.entries(by).sort((a, b) => b[1].b + b[1].c - (a[1].b + a[1].c))) console.log(`  ${v.b} / ${v.c}  ${k}`);
const feat = (name, f) => { const a = rows.filter(f); console.log(`${name}: ${a.filter((x) => x.g === "blocked").length}/${a.length} blocked`); };
console.log("\nfeatures:");
feat("message contains '$' or a digit", (x) => /[$\d]/.test(x.m));
feat("message contains 'limit'/'hard'/'budget'", (x) => /limit|hard|budget/i.test(x.m));
feat("message contains '?'", (x) => /\?/.test(x.m));
feat("short (< 35 chars)", (x) => x.m.length < 35);
feat("round 1", (x) => x.r === 1); feat("round 2", (x) => x.r === 2); feat("round 3", (x) => x.r === 3);
