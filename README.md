# AWS Health → AWS Transform: guided remediation (mock)

**Purpose.** A customer opens AWS Health and sees planned lifecycle events (PLEs), for example *Lambda end of support:
Node.js 16*, with affected resources and a deadline. This prototype shows how AWS Transform takes them from that notice to
closed events, and keeps them ahead of the next one (the CM first-run onboarding spec):

1. **Understand.** AWS Health › Scheduled changes summarizes what AWS Transform can resolve (8 of 11 changes, 16 Lambda
   functions on Node.js 16, Python 3.10 and Java 11) and offers **Upgrade** per event, per selection, or for all of them.
2. **Get started.** One event, or several at once, pinned at the top with deadlines and affected functions.
3. **Set up in four steps:** 1 connect source (provider, personal access token, AWS Health access), 2 find the affected
   code, 3 review the plan (read-only, generated from the search; nothing is created), 4 schedule continuous analysis and
   open pull requests.
4. **Fix and verify.** One campaign per event (several events share one page), tracked until Lambda shows every function
   on its new runtime and AWS Health marks the events resolved.

Clickable mock. All data is in memory (seeded in `src/data.js` and `src/ple/data.js`) and resets on reload.

```
npm install
npm run dev     # http://127.0.0.1:5174
```

## Walkthrough

The app opens on AWS Health › Scheduled changes. Click **Upgrade 9 functions** (Node.js 16 only) or **Upgrade 16 functions**
(all three runtimes).

| Screen | Route |
|---|---|
| AWS Health › Scheduled changes (one row per event per Region) | `#/console/health` |
| Get started, one event | `#/app/ple/welcome?event=<arn>&account=…&source=health` |
| Get started, several events | `#/app/ple/welcome?events=<id,id,…>&account=…&source=health` |
| Setup steps 1–4 | `#/app/ple/{connect,analyze,plan,schedule}` |
| Campaign tracked against its event(s) | `#/app/cm/campaigns/<id>` |
| Findings, grouped; PLE groups pinned (source filter: AWS Health PLEs) | `#/app/cm/findings?tab=ple` |
| New PLE arrives (ElastiCache Redis OSS 6, banner on Findings) | `#/app/cm/findings` |

Code lives in `src/ple/` (seed data, reducer/simulation, screens). Dashed **Demo controls (mock only)** panels reach the
alternate states: existing CM customer, account mismatch, auth failure/admin approval, new PLE arrival, owners merging PRs,
and fast-forwarding AWS Health's ~72h refresh (which also deploys the held `statements` and `billing-exports` merges).
Finishing step 2 sets `localStorage['atx-mock-cm-customer']` so later deep links behave like an existing customer; reset
it from the Health page demo panel.

## Rest of the CM console

Routes (hash-based): `#/console`, `#/console/service`, `#/app/chat`, `#/app/cm/{dashboard|findings|remediations|analyses|sources|settings}`,
`#/app/cm/analyses/new`, plus detail pages `#/app/cm/{findings|remediations|analyses|sources}/<id>`.

Simulated work: analyses (~12–25s) emit findings when done; remediations (~20s) resolve their findings;
source connections (~2.5s) and stack deploys (~6s) flip status. Access tokens are validated for presence only and never stored.
