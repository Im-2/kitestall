# Arena send bug: evidence (2026-11-14)

**Cause:** the Send button was disabled until the shop catalog finished loading. On a Render free-plan cold start the catalog is slow, so an early click did nothing and sent no request (a silent dead button). Reproduced with `node scripts/arena-e2e.mjs http://localhost:8787 --slow-catalog` (catalog delayed 4 s): before the fix, button disabled at click, 0 POSTs, rounds unchanged. Not a CORS or SSE problem: the app is same-origin and the trace stream connected in every run.

**Fix:** Send is never dead: an early click queues the message and sends it automatically once the shop is ready ("Waiting…" label plus a visible note), the catalog load retries 6 times, and a Retry button appears if the shop never answers. Enter in the offer field also sends.

**After the fix** (fallback_only server, real Chrome via puppeteer):
```
PASS desktop 1440: button disabled at click=false label="Send" | POST /negotiate statuses=[200] | rounds 27->28 | trace stream requests=1 (Stream (3)) | decided in 39 ms | page errors: none
   decision text: DETERMINISTIC FALLBACK | shop reply: My ask is $24.50.
PASS mobile 390: button disabled at click=false label="Send" | POST /negotiate statuses=[200] | rounds 28->29 | trace stream requests=1 (Stream (3)) | decided in 32 ms | page errors: none
   decision text: DETERMINISTIC FALLBACK | shop reply: My ask is $24.50.
PASS desktop 1440: button disabled at click=false label="Send" | POST /negotiate statuses=[200] | rounds 29->30 | trace stream requests=1 (Stream (3)) | decided in 3833 ms | page errors: none
   decision text: DETERMINISTIC FALLBACK | shop reply: My ask is $24.50.
PASS mobile 390: button disabled at click=false label="Send" | POST /negotiate statuses=[200] | rounds 30->31 | trace stream requests=1 (Stream (3)) | decided in 3673 ms | page errors: none
   decision text: DETERMINISTIC FALLBACK | shop reply: My ask is $24.50.
```
