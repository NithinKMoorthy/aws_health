# AWS Health → AWS Transform: guided remediation (mock)

**Purpose.** A customer opens AWS Health and sees a planned lifecycle event (PLE), for example *Lambda Python 3.9
end of support*, with a list of affected resources and a deadline. Most customers don't know what that means for
their code or what to do next. This prototype shows how AWS Transform guides them from that notice to a closed PLE:

1. **Understand.** The Health event explains what is changing, when, and which resources are affected, then offers one
   next step: **Remediate with AWS Transform**.
2. **Get set up.** A welcome page keeps the PLE context (time remaining, affected resources). A wizard then connects their
   repositories and grants AWS Health access, one step at a time.
3. **See the affected code.** AWS Transform matches each affected resource to the file and line that defines it, and
   lists the resources it couldn't find.
4. **Approve a plan.** The user sees which fixes run, in which repositories, and with what transformation, before anything changes.
5. **Fix and verify.** A campaign opens pull requests, tracks validation and merges, and confirms that AWS Health
   marks each resource RESOLVED.

Continuous modernization (findings, analyses, campaigns) is the engine behind these steps; AWS Health is the entry point.

Clickable mock rebuilt from the screenshots in `../cm-governor-ga/references`. All data is in memory (seeded in
`src/data.js` and `src/ple/data.js`) and resets on reload.

```
npm install
npm run dev     # http://127.0.0.1:5174
```

## Walkthrough (Screens 1–11)

The app opens at `#/console/health/lambda-py39` (AWS Health › Scheduled changes › Lambda Python 3.9). Click
**Remediate with AWS Transform** (opens the deep link in a new tab).

| Screen | Route |
|---|---|
| 1 Health PLE detail + CTA | `#/console/health/<eventId>` |
| 2 Welcome with PLE context | `#/app/ple/welcome?event=<arn>&account=…&td=…&source=health` |
| 3–5 Setup wizard: provider · token · source details · review and connect · Health access · find affected code | `#/app/ple/{provider,token,source,review,health,analyze}` |
| 6 Findings, grouped; the PLE you came for is pinned on top (source filter: AWS Health PLEs) | `#/app/cm/findings?tab=ple` |
| 7 Group detail + PLE details drawer | `#/app/cm/findings/<groupId>` |
| 8 Remediation plan (from Findings → select → Create campaign, or a group's Create campaign) | `#/app/cm/campaigns/new?findings=<ids>` · `#/app/cm/findings/<groupId>/plan` |
| Review specialized skill (type C groups, e.g. `G-rds-pg14`) | `#/app/cm/findings/<groupId>/skill` |
| 9–10 Campaign progress · Verification | `#/app/cm/campaigns/<id>` |
| 11 New PLE arrives (banner on Findings) | `#/app/cm/findings` |

Code lives in `src/ple/` (seed data, reducer/simulation, screens). Dashed **Demo controls (mock only)** panels reach the
alternate states: existing CM customer, account mismatch, auth failure/admin approval, no Health API, new PLE arrival,
owners merging PRs, and fast-forwarding AWS Health's ~72h refresh. Finishing setup sets `localStorage['atx-mock-cm-customer']`
so later deep links behave like an existing customer; reset it from the Health page demo panel.

## Rest of the CM console

Routes (hash-based): `#/console`, `#/console/service`, `#/app/chat`, `#/app/cm/{dashboard|findings|remediations|analyses|sources|settings}`,
`#/app/cm/analyses/new`, plus detail pages `#/app/cm/{findings|remediations|analyses|sources}/<id>`.

Simulated work: analyses (~12–25s) emit findings when done; remediations (~20s) resolve their findings;
source connections (~2.5s) and stack deploys (~6s) flip status. Access tokens are validated for presence only and never stored.
