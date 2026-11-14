# Design system (UI redesign)

Language taken from the supplied reference recording (light geometric landing template): clean white cards on a soft grey backdrop, large light rounded-geometric headlines with grey/yellow-pill emphasis, one black card for contrast, orange-red + yellow accents, a black rounded header bar, inertial scroll and slide-up reveals. No brand names, logos, copy or numbers from the reference are used.

## Tokens
| Token | Value |
|---|---|
| `--bg` (backdrop) | `#E9EAEE` |
| `--card` | `#FFFFFF` · `--card-soft` `#F6F6F8` |
| `--ink` | `#0B0B0C` · `--black` `#0D0D0F` |
| `--grey-word` (de-emphasised headline words) | `#B9BBC2` |
| `--body` | `#5A5D66` (contrast 6.6:1 on white) · `--muted` `#7A7D86` (4.6:1) |
| `--accent` (orange-red) | `#FF4A1C` (on white 3.3:1: used for large text/graphics and as a button *background* with white text at 18px+/600) · `--accent-ink` `#C2310E` for small accent text (5.4:1) |
| `--yellow` | `#FFC62B` (always with ink text) |
| `--ok` / `--bad` | `#12803A` / `#C62D1B` |
| Radii | `--r-xl 36px` sections · `--r-lg 24px` cards · `--r-md 16px` inner · pill `999px` |
| Shadows | `--sh-1: 0 1px 2px rgba(15,15,25,.05), 0 10px 30px rgba(15,15,25,.06)` · `--sh-2: 0 30px 80px rgba(15,15,25,.14)` |
| Type | Outfit (Google Fonts). Display 300/400, letter-spacing −0.035em, line-height 1.02; fluid `clamp(2.4rem, 7.2vw, 6.2rem)` hero, `clamp(1.9rem, 4.6vw, 3.6rem)` h2; body 16–18px/1.6; mono for hashes (IBM Plex Mono) |
| Spacing | 4-pt scale: 4 8 12 16 24 32 48 72 120; page gutter `clamp(14px, 3vw, 40px)` |
| Motion | ease-out-quint `cubic-bezier(.22,1,.36,1)`; reveals 700 ms, line reveals 900 ms stagger 80 ms, count-ups 1400 ms, parallax ±40 px, hover 300 ms. `prefers-reduced-motion`: Lenis, parallax, reveals and count-ups are disabled; content is visible immediately |

## Components
`SiteHeader` (black rounded bar: mark + wordmark, centred nav, pill CTA, TESTNET badge) · `SiteFooter` (black, nav, wordmark, repo link, QR to repo) · `Pill`/`Badge` · `Card` (white/black) · `LineReveal` (headline lines slide up) · `Reveal` (card slide-up) · `CountUp` (number → live value) · `Spark` (SVG sparkline from a real series) · `Bars` (SVG bars) · `DeviceLaptop`/`DevicePhone` (frames that host the real `LiveDashboard`) · `LiveDashboard` (stats, fees accrued, SERV p50, attacks blocked, avg discount, sales ledger, recent negotiations; `compact` for the phone) · `Accordion` (feature rows) · `Marquee` (giant wordmark) · `StepCard` · `PartnerStrip` (Kite × OpenServ SERV) · `CheckList` (Verify ✓/✗) · `Trace` (black live-trace card).

## Data rule
All figures come from `GET /api/stats` and `GET /api/public/activity` (new read-only, redacted). Empty database ⇒ zeros and "No … yet" states. Fees are labelled "accrued", money carries a TESTNET badge, SERV status shows live/fallback honestly.

## Verification (2026-11-14, local server, real data)
- `node scripts/ui-smoke.mjs` (real Chrome): landing, Arena haggle with live trace, Verify (6 ticks), Owner unlock + ledger with Kitescan links, Watch with a real settled testnet purchase: all PASS, no page errors.
- Lighthouse 12 on the landing page (`npx lighthouse`, headless Chrome, simulated throttling on mobile): **desktop** performance 100, accessibility 100, best-practices 100, SEO 92; **mobile** performance **88**, accessibility 100, best-practices 100, SEO 92 (LCP 2.6 s, CLS 0, TBT 330 ms). Mobile performance is below the 90 target: remaining cost is GSAP/ScrollTrigger/Lenis + React parse time on a 4x-throttled CPU. Measured against localhost, so network time is optimistic.
- No horizontal overflow at 390 px or 1440 px on any page (`scripts/screenshots.mjs`). Screenshots: `docs/screenshots/`.
- `prefers-reduced-motion`: Lenis, reveals, parallax, marquee and count-ups are skipped and content is visible immediately.
