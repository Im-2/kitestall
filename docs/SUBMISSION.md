# Submission checklist (deadline Nov 15, 2026 23:59 UTC; form: https://openserv.typeform.com/submissions02)

- [x] Repo public: https://github.com/Im-2/kitestall
- [x] MIT license
- [x] No secrets committed (history scanned; `.env` ignored; `.dockerignore`)
- [ ] Demo URL live (human: Render **free** Blueprint deploy; then smoke test landing, Arena, Watch, Verify)
- [ ] Free uptime pinger set up (UptimeRobot, HTTP monitor on `<DEPLOY_URL>/healthz`, 5-minute interval) and a warm-up request sent before recording/judging
- [ ] Fund SERV credits (balance was $0.03 at last check) and set `SERV_DAILY_BUDGET_USD`
- [ ] Re-run `pnpm e2e:kite <DEPLOY_URL> story-a` against the deployed URL (log appends to docs/E2E_LOG.md); commit
- [ ] Demo video recorded and uploaded (docs/DEMO_SCRIPT.md)
- [x] Write-up draft (docs/WRITEUP.md; fill `<DEPLOY_URL>`)
- [ ] X post published (docs/X_POST.md), URL copied
- [ ] Form submitted
- [ ] OpenServ console data-collection setting checked (console.openserv.ai/settings/organization) if Edition 02 requires it
