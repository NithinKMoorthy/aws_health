import React, { useEffect, useMemo, useState } from 'react';
import { fmtDate, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Button, Icon, Link, Modal, MultiSelect, Pagination, SearchInput, Severity, Tabs } from '../components/ui';
import { continueInChat, startCustomGroupChat } from '../components/Chat';
import { NotesModal } from '../cm/Findings';
import { byDeadline, DemoPanel, DependencyWarning, eventsTitle, groupView, HealthSetupPrompt, noticeTitle, shortTitle, unit } from './common';
import { ACCOUNT_ENV, daysLeft } from './data';
import { groupPath, groupTitle, NewPleBanner, planPath, remediatePath, skillPath } from './Groups';

// Findings: groups and standalone findings in one list, in recommended order.
// A group row rolls up its findings; expanding it lists them with the same
// columns. An AWS Transform summary on top says what it grouped and where to start.

const PAGE = 10;
const SEV_RANK = { High: 3, Medium: 2, Low: 1 };

// Analysis filter: by type of analysis, with AWS Health findings as Health analysis.
const analysisKey = (f) => (f.pleId ? 'ple' : f.analysisType);
const analysisName = (k) => (k === 'ple' ? 'Health analysis' : typeLabel(k));
const isActive = (f) => f.status === 'Open' || f.status === 'In remediation';
const rollupStatus = (fs) => (fs.some((f) => f.status === 'Open') ? 'Open' : fs.some((f) => f.status === 'In remediation') ? 'In remediation' : fs[0]?.status);
const plural = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

// Scope tags: what makes these findings matter, from the event, the findings and the repositories.
function scopeTags(fs, e) {
  const repos = [...new Set(fs.map((f) => f.repo))].join(' ');
  const text = fs.map((f) => `${f.title} ${f.category}`).join(' ');
  const prod = e ? e.resources.some((r) => ACCOUNT_ENV[r.account] === 'prod') : /(payment|ledger|billing|settlement|order|checkout)/i.test(repos);
  const tags = [
    (e || /end[- ]of[- ]life|end of support|EOL|runtime|deprecated/i.test(text)) && ['EOL', 'red'],
    /(security|cve|vulnerab|secret|credential)/i.test(text) && ['Known CVEs', 'red'],
    prod && ['Prod-critical', ''],
    /(bff|edge|web|api|gateway|storefront|mobile|portal)/i.test(repos) && ['Internet-facing', ''],
    /(payment|card|billing|ledger|settlement|checkout)/i.test(repos) && ['PCI scope', ''],
    (e?.service === 'EKS' || /react native|major/i.test(text)) && ['Breaking changes', 'amber'],
    /(test|coverage)/i.test(text) && !e && ['Low test coverage', 'amber'],
  ].filter(Boolean);
  return tags.slice(0, 4);
}

// The skill being generated (or generated) for a row: the group's own, or a standalone finding's one-off group.
const skillGroupOf = (r, state) => (r.kind === 'group' ? r.g : state.ple.groups.find((x) => x.adhoc && x.findingIds.includes(r.f.id)));
const isComplex = (fs) => fs.length > 3 || new Set(fs.map((f) => f.repo)).size > 2;
const GEN_MS = { complex: 30000, simple: 18000 };
const GEN_MIN = { complex: 15, simple: 8 };

// Remediation filter: how each row gets fixed.
const REM_KINDS = [['td', 'Managed TD ready'], ['skill', 'Specialized skill'], ['generating', 'Generating skill'], ['none', 'Needs a skill'], ['campaign', 'In a campaign']];
function remKind(r, state) {
  const m = remediation(r, state, () => {});
  if (m.generating) return 'generating';
  return { 'View campaign': 'campaign', 'Review specialized skill': 'skill', 'Review managed TD': 'td' }[m.label] ?? 'none';
}

// Skills AWS Transform is generating, or has generated and is waiting for review.
function SkillGenerations({ groups }) {
  const { state, dispatch, notify } = useStore();
  if (!groups.length) {
    return <div className="table-empty"><strong>No skill generations</strong><p className="muted">When you generate a specialized skill, its progress shows here.</p></div>;
  }
  return (
    <>
      <div className="table-wrap">
        <table className="table findings-table skillgen-table">
          <thead><tr><th>Skill for</th><th style={{ width: '24%' }}>Progress</th><th style={{ width: 130 }}>Agent minutes</th><th style={{ width: '18%' }}>Next</th></tr></thead>
          <tbody>
            {groups.map((g) => {
              const sk = g.skill;
              const v = groupView(state, g);
              const n = v.findings.length;
              const repos = [...new Set(v.findings.map((f) => f.repo))];
              const ready = sk.status === 'ready';
              const total = sk.minutes ?? GEN_MIN.simple;
              const frac = ready ? 1 : Math.min(1, (Date.now() - sk.startedAt) / sk.duration);
              const left = Math.max(1, Math.round((1 - frac) * total));
              const step = frac < 0.5 ? 1 : frac < 0.85 ? 2 : 3;
              const title = g.adhoc ? g.name : groupTitle(g);
              const open = () => navigate(g.adhoc ? `/app/cm/findings/${g.findingIds[0]}` : groupPath(g));
              const cancel = () => { dispatch({ type: 'PLE_SKILL_UPDATE', groupId: g.id, patch: { status: g.type === 'C' ? 'proposed' : 'cancelled', startedAt: null, autoRemediate: false } }); notify(`Stopped generating the skill for ${title}.`, 'info'); };
              return (
                <tr key={g.id}>
                  <td>
                    <Link onClick={open}><strong>{title}</strong></Link>
                    <div className="muted small">{g.adhoc ? 'Standalone' : 'Group'} · {plural(n, 'finding')} · {repos.length === 1 ? repos[0] : plural(repos.length, 'repository', 'repositories')}</div>
                  </td>
                  <td>
                    <div className="sg-head">
                      <strong className={ready ? 'sg-ok' : 'sg-run'}>{ready ? 'Ready to review' : step === 1 ? 'Generating' : 'Validating'}</strong>
                      <span className="muted small">{ready ? 'Done' : `~${left} min left`}</span>
                    </div>
                    <span className={`sg-bar ${ready ? 'ok' : ''}`}><span style={{ width: `${Math.max(4, frac * 100)}%` }} /></span>
                    <div className="muted small">{ready ? `Passed validation on all ${plural(n, 'finding')}` : `Step ${step} of 3 · ${['reading the code', `testing against the ${plural(n, 'finding')}`, 'checking for regressions'][step - 1]}`}</div>
                  </td>
                  <td>{ready ? total : `${Math.max(1, Math.round(frac * total))} so far`}</td>
                  <td>
                    {ready ? (
                      <Button variant="primary" onClick={() => navigate(skillPath(g), { return: g.adhoc ? `/app/cm/campaigns/new?findings=${g.findingIds[0]}` : planPath(g) })}>Review skill</Button>
                    ) : (
                      <>
                        <div className="small">{sk.autoRemediate ? 'Runs automatically once it passes validation' : 'You review it when it’s done'}</div>
                        <Link onClick={cancel}><strong>Cancel</strong></Link>
                      </>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted small table-note">Skills keep generating if you leave this page. You’ll get a notification when one is ready to review.</p>
    </>
  );
}

// What fixes a row. Review links open the remediation plan with that item's review panel open;
// Generate skill asks first, then shows progress on the row.
function remediation(r, state, openGenerate) {
  const sg = skillGroupOf(r, state);
  if (sg?.skill?.status === 'generating') return { generating: sg };
  if (r.kind === 'group') {
    const { g, v } = r;
    if (v.campaigns[0]) return { label: 'View campaign', sub: `Campaign · ${v.status === 'Complete' ? 'complete' : 'in progress'}`, go: () => navigate(`/app/cm/campaigns/${v.campaigns[0].id}`) };
    const go = () => navigate(planPath(g), { review: '1' });
    const ready = g.skill?.status === 'ready' || g.skill?.approved;
    // A generated skill is reviewed on its own page, then returns to the plan.
    const review = () => navigate(skillPath(g), { return: planPath(g) });
    if (g.type === 'C' || ready) return { label: 'Review specialized skill', sub: `${ready ? 'Ready' : 'Proposed'} · 1 skill · ${plural(v.repos.length, 'repo')}`, go: review };
    if (v.td) return { label: 'Review managed TD', sub: `Ready · ${v.td}`, go };
    return { label: 'Generate skill', sub: 'No matching skill yet', go: () => openGenerate(r) };
  }
  const { f } = r;
  if (f.status === 'In remediation') {
    const c = state.ple.campaigns.find((x) => x.repos.some((rr) => rr.findingIds?.includes(f.id)) || x.groups.some((gg) => state.ple.groups.find((g) => g.id === gg.id)?.findingIds.includes(f.id)));
    return { label: 'View campaign', sub: 'In a campaign', go: () => navigate(c ? `/app/cm/campaigns/${c.id}` : '/app/cm/remediations') };
  }
  const go = () => navigate('/app/cm/campaigns/new', { findings: f.id, review: '1' });
  if (sg?.skill?.status === 'ready') return { label: 'Review specialized skill', sub: 'Ready · 1 skill', go: () => navigate(skillPath(sg), { return: `/app/cm/campaigns/new?findings=${f.id}` }) };
  if (f.transformation) return { label: 'Review managed TD', sub: `Ready · ${f.transformation}`, go };
  return { label: 'Generate skill', sub: 'No matching skill yet', go: () => openGenerate(r) };
}

// Recommended order: severity, then not yet in a campaign, then security and the nearest AWS Health deadline, then size.
function recommendScore(r) {
  const fs = r.kind === 'group' ? r.children : [r.f];
  const security = fs.some((f) => f.category === 'Security');
  const urgency = r.e ? daysLeft(r.e.changeDate) : security ? -1 : 9999;
  return [-SEV_RANK[r.severity], r.status === 'In remediation' ? 1 : 0, urgency, r.kind === 'group' ? 0 : 1, -fs.length];
}
const byScore = (a, b) => {
  const x = recommendScore(a);
  const y = recommendScore(b);
  for (let i = 0; i < x.length; i += 1) if (x[i] !== y[i]) return x[i] - y[i];
  return 0;
};

export function FindingsGrouped({ query }) {
  const { state, dispatch, notify } = useStore();
  const [search, setSearch] = useState('');
  // Filters are multi-select; empty means all.
  const [repoSel, setRepoSel] = useState(query.repo ? [query.repo] : []);
  // How each row gets fixed; empty means any.
  const [remSel, setRemSel] = useState([]);
  const [analysisSel, setAnalysisSel] = useState(query.analysis === 'ple' ? ['ple'] : []);
  const [selected, setSelected] = useState(() => (query.sel ? query.sel.split(',') : []));
  // Recommended: open groups and standalone findings, plus every AWS Health PLE, best first. Groups: every group. All findings: one row per finding.
  const [tab, setTab] = useState(query.tab === 'ple' ? 'groups' : 'recommended');
  const [expanded, setExpanded] = useState(() => new Set(query.highlight ? [query.highlight] : []));
  const [page, setPage] = useState(1);
  const [modal, setModal] = useState(null);
  const [, tick] = useState(0);
  const generating = state.ple.groups.some((g) => g.skill?.status === 'generating');
  // Progress on generating rows moves on its own.
  useEffect(() => {
    if (!generating) return undefined;
    const t = setInterval(() => tick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, [generating]);
  // Auto-remediate: once a skill passes validation, its campaign starts by itself.
  useEffect(() => {
    state.ple.groups
      .filter((g) => g.skill?.autoStart && g.skill.status === 'ready' && !state.ple.campaigns.some((c) => c.groups.some((x) => x.id === g.id)))
      .forEach((g) => {
        dispatch({ type: 'PLE_SKILL_UPDATE', groupId: g.id, patch: { autoStart: false } });
        dispatch({ type: 'PLE_START_CAMPAIGN', name: `Remediate ${g.shortName}`, target: `"${g.shortName}" resolved in every repository`, dueDate: null, groupIds: [g.id], checks: { equivalence: true, deps: true }, now: Date.now() });
        notify(`The skill for ${g.shortName} passed validation. AWS Transform started remediating it.`);
      });
  }, [state.ple.groups]); // eslint-disable-line react-hooks/exhaustive-deps
  const openGenerate = (r) => setModal({ type: 'generate', r });
  // Arriving from AWS Health: only the event(s) that brought you here, until you ask for everything.
  const entryIds = state.ple.entryEventIds?.length ? state.ple.entryEventIds : [state.ple.entryEventId].filter(Boolean);
  const entryEvents = byDeadline(state.ple.events.filter((e) => entryIds.includes(e.id)));
  const [focus, setFocus] = useState(!!query.highlight && entryEvents.length > 0);

  const listed = state.ple.groups.filter((g) => !g.adhoc);

  const q = search.trim().toLowerCase();
  const keep = (f) =>
    (!focus || entryIds.includes(f.pleId)) &&
    isActive(f) &&
    (!repoSel.length || repoSel.includes(f.repo)) &&
    (!analysisSel.length || analysisSel.includes(analysisKey(f))) &&
    (!q || [f.title, f.repo, f.transformation ?? '', f.category, f.file ?? '', f.evidence ?? ''].some((x) => x.toLowerCase().includes(q)));

  const { rows, totals, tabCounts } = useMemo(() => {
    const groupOf = new Map();
    listed.forEach((g) => g.findingIds.forEach((id) => groupOf.set(id, g)));
    const out = [];
    listed.forEach((g) => {
      const v = groupView(state, g);
      const children = v.findings.filter(keep);
      if (!children.length) return;
      const e = v.event;
      out.push({ key: g.id, kind: 'group', g, v, e, children, title: groupTitle(g), severity: ['High', 'Medium', 'Low'].find((s) => children.some((f) => f.severity === s)), status: rollupStatus(children) });
    });
    state.findings
      .filter((f) => !groupOf.has(f.id) && keep(f))
      .forEach((f) => out.push({ key: f.id, kind: 'finding', f, e: null, title: f.title, severity: f.severity, status: f.status }));
    const all = out;
    const flat = all.flatMap((r) => (r.kind === 'group' ? r.children.map((f) => ({ key: f.id, kind: 'finding', f, e: null, title: f.title, severity: f.severity, status: f.status, group: r })) : [r]));
    const inTab = { recommended: all.filter((r) => r.status === 'Open' || !!r.e), groups: all.filter((r) => r.kind === 'group'), all: flat };
    const shown = (inTab[tab] ?? []).filter((r) => !remSel.length || remSel.includes(remKind(r.group ?? r, state)));
    shown.sort(byScore);
    // First visit from AWS Health: the PLE you came for is pinned to the top.
    const pin = shown.findIndex((r) => r.key === query.highlight);
    if (pin > 0) shown.unshift(...shown.splice(pin, 1));
    return {
      rows: shown,
      tabCounts: { recommended: inTab.recommended.length, groups: inTab.groups.length, all: flat.length },
      totals: {
        items: all.length,
        findings: all.reduce((n, r) => n + (r.kind === 'group' ? r.children.length : 1), 0),
        groups: all.filter((r) => r.kind === 'group'),
        standalone: all.filter((r) => r.kind === 'finding').length,
      },
    };
  }, [state, search, repoSel, analysisSel, remSel, focus, query.highlight, tab]); // eslint-disable-line react-hooks/exhaustive-deps

  const skillRows = state.ple.groups.filter((g) => ['generating', 'ready'].includes(g.skill?.status) && !groupView(state, g).campaigns.length);
  const nReady = skillRows.filter((g) => g.skill.status === 'ready').length;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const pageRows = rows.slice((cur - 1) * PAGE, cur * PAGE);
  const recommendedKey = rows.find((r) => r.status === 'Open')?.key;

  // Selection is by finding; selecting a group row selects its findings.
  const selFindings = state.findings.filter((f) => selected.includes(f.id));
  const toggleSel = (ids) => {
    const all = ids.every((id) => selected.includes(id));
    setSelected(all ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])]);
  };
  const toggleExp = (key) => setExpanded((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const pageIds = pageRows.flatMap((r) => (r.kind === 'group' ? r.children.map((f) => f.id) : [r.f.id]));
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const reset = () => { setPage(1); setSelected([]); };

  const repos = [...new Set(state.findings.filter(isActive).map((f) => f.repo))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  const analysisKeys = [...new Set(state.findings.filter(isActive).map(analysisKey))].sort((a, b) => analysisName(a).localeCompare(analysisName(b)));

  const selItems = rows.filter((r) => (r.kind === 'group' ? r.children.some((f) => selected.includes(f.id)) : selected.includes(r.f.id)));
  const selOpen = selFindings.filter((f) => f.status === 'Open');
  const selRepos = new Set(selOpen.map((f) => f.repo));
  const crossRepo = selItems.some((r) => r.kind === 'group' && (r.v.safety.pairs ?? []).some(([a, b]) => selRepos.has(a) && selRepos.has(b)));
  const createCampaign = () => navigate('/app/cm/campaigns/new', { findings: selOpen.map((f) => f.id).join(',') });
  // One standalone finding: review how it's fixed. A group or several items: a campaign.
  const soloFinding = selItems.length === 1 && selItems[0].kind === 'finding' ? selItems[0].f : null;
  const primary = soloFinding ? (
    <Button variant="primary" disabled={!selOpen.length} onClick={() => navigate('/app/cm/campaigns/new', { findings: soloFinding.id, review: '1' })}>
      {soloFinding.transformation ? 'Review managed TD' : 'Review specialized skill'}
    </Button>
  ) : (
    <Button variant="primary" disabled={!selOpen.length} onClick={createCampaign}>Create campaign</Button>
  );

  // AWS Transform's summary: what it grouped, where to start, and the nearest deadline.
  const pleGroups = totals.groups.filter((r) => r.e);
  const grouped = totals.groups.reduce((n, r) => n + r.children.length, 0);
  const firstDue = byDeadline(pleGroups.map((r) => r.e))[0];
  const startWith = rows.filter((r) => r.status === 'Open').slice(0, 2).map((r) => r.title);
  const summary =
    `I grouped ${plural(grouped, 'finding')} into ${plural(totals.groups.length, 'group')}` +
    `${totals.standalone ? ` and left ${totals.standalone} standalone` : ''}.` +
    `${startWith.length ? ` Start with ${startWith[0]}${startWith[1] ? `, then ${startWith[1]}` : ''}.` : ''}`;

  return (
    <div className="findings-v2">
      {!focus && <NewPleBanner />}
      <HealthSetupPrompt state={state} />
      <NextStepBanner groupId={query.highlight} />
      {focus ? (
        <div className="focus-bar">
          <span className="aws-ple-tag">AWS Health PLE</span>
          <span>
            Showing only <strong>{entryEvents.length > 1 ? eventsTitle(entryEvents) : noticeTitle(entryEvents[0])}</strong>, the {entryEvents.length > 1 ? 'events' : 'event'} that
            brought you here.
          </span>
          <span className="grow" />
          <Link onClick={() => { setFocus(false); reset(); }}><strong>Show all findings</strong></Link>
        </div>
      ) : (
        totals.items > 0 && (
          <div className="ai-summary">
            <span className="ai-summary-icon">✦</span>
            <p>{summary}</p>
            <Button className="ai-ghost-btn" onClick={() => { startCustomGroupChat(selFindings.map((f) => f.id)); setSelected([]); }}>Create custom group</Button>
            <Button className="ai-chat-btn" onClick={() => continueInChat(`Walk me through my findings. ${summary}${firstDue ? ` The earliest AWS Health deadline is ${shortTitle(firstDue)}, due ${fmtDate(firstDue.changeDate)}.` : ''}`)}>✦ Continue in chat</Button>
          </div>
        )
      )}
      <div className="section-head">
        <h2>
          {focus ? 'Affected code' : 'Findings'} <span className="muted">({totals.findings})</span>
          <span className="muted small heading-note"> · {plural(totals.groups.length, 'group')} · {totals.standalone} standalone</span>
        </h2>
        {selected.length > 0 && (
          <div className="actions">
            {primary}
          </div>
        )}
      </div>
      <Tabs
        className="findings-tabs"
        active={tab}
        onChange={(t) => { setTab(t); reset(); }}
        tabs={[['recommended', 'Recommended'], ['groups', 'Groups'], ['skills', 'Skill generations'], ['all', 'All findings']].map(([id, label]) => ({ id, label: <>{label} <span className="tab-count">{id === 'skills' ? skillRows.length : tabCounts[id]}</span></> }))}
      />
      <div className="filters">
        <SearchInput value={search} onChange={(v) => { setSearch(v); reset(); }} placeholder="Find findings" width={240} />
        <MultiSelect width={220} value={repoSel} onChange={(v) => { setRepoSel(v); reset(); }} allLabel="All repositories" noun="repositories" placeholder="Find repositories" sections={[{ options: repos.map((r) => ({ value: r, label: r })) }]} />
        <MultiSelect width={220} value={remSel} onChange={(v) => { setRemSel(v); reset(); }} allLabel="Any remediation" noun="remediations" placeholder="Find remediations" sections={[{ options: REM_KINDS.map(([value, label]) => ({ value, label })) }]} />
        <MultiSelect width={220} value={analysisSel} onChange={(v) => { setAnalysisSel(v); reset(); }} allLabel="All analyses" noun="analyses" placeholder="Find analyses" sections={[{ options: analysisKeys.map((k) => ({ value: k, label: analysisName(k) })) }]} />
        <span className="grow" />
        <span className="muted small">
          {tab === 'skills' ? [nReady && `${nReady} ready to review`, skillRows.length - nReady && `${skillRows.length - nReady} generating`].filter(Boolean).join(' · ') || 'None in progress' : `Sorted by recommended · ${pageRows.length} of ${rows.length}`}
        </span>
      </div>

      {selected.length > 0 && (
        <div className="selection-bar">
          <strong>{selItems.length} selected</strong>
          <span>{plural(selOpen.length, 'finding')} · {plural(selRepos.size, 'repository', 'repositories')}</span>
          {crossRepo && <span className="tag tag-amber"><Icon.warn width={11} height={11} /> Cross-repo dependency</span>}
          <span className="sel-sep" />
          <span className="muted">Ordered by dependency, one pull request per repository</span>
          <span className="grow" />
          <Link onClick={() => setSelected([])}>Clear selection</Link>
        </div>
      )}
      {tab === 'skills' ? <SkillGenerations groups={skillRows} /> : <>
      <div className="table-wrap">
        <table className="table findings-table">
          <thead>
            <tr>
              <th className="cb"><input type="checkbox" checked={allOnPage} onChange={() => setSelected(allOnPage ? selected.filter((x) => !pageIds.includes(x)) : [...new Set([...selected, ...pageIds])])} aria-label="Select all" /></th>
              <th>Finding</th>
              <th style={{ width: 84 }}>Severity</th>
              <th style={{ width: '22%' }}>Scope</th>
              <th style={{ width: '22%' }}>Remediation</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) =>
              r.kind === 'group' ? (
                <GroupRows key={r.key} r={r} openGenerate={openGenerate} recommended={r.key === recommendedKey} open={expanded.has(r.key)} toggle={() => toggleExp(r.key)} selected={selected} toggleSel={toggleSel} />
              ) : (
                <FindingRow key={r.key} r={r} openGenerate={openGenerate} recommended={r.key === recommendedKey} selected={selected} toggleSel={toggleSel} onNotes={(f) => setModal({ type: 'notes', f })} />
              ),
            )}
          </tbody>
        </table>
        {rows.length === 0 && (
          <div className="table-empty">
            <strong>No findings</strong>
            <p className="muted">No findings match the filters.</p>
          </div>
        )}
      </div>
      {rows.length > 0 && (
        <div className="table-foot">
          <span className="muted small">{pages > 1 ? `Showing ${pageRows.length} of ${rows.length}` : `Showing all ${rows.length}`}</span>
          {pages > 1 && <Pagination page={cur} pages={pages} onChange={setPage} />}
        </div>
      )}
      </>}

      {modal?.type === 'notes' && <NotesModal finding={modal.f} onClose={() => setModal(null)} />}
      {modal?.type === 'generate' && <GenerateSkillModal r={modal.r} onClose={() => setModal(null)} />}

      <DemoPanel>
        <div className="demo-row">
          <span>AWS Health publishes a new PLE (ElastiCache for Redis OSS v6)</span>
          <Button
            disabled={!state.ple.onboarded || state.ple.events.some((e) => e.id === 'cache-redis6')}
            onClick={() => { dispatch({ type: 'PLE_NEW_EVENT' }); notify('New PLE received from AWS Health.', 'info'); }}
          >
            {state.ple.events.some((e) => e.id === 'cache-redis6') ? 'Received' : 'Simulate new PLE'}
          </Button>
        </div>
      </DemoPanel>
    </div>
  );
}

// Arriving from AWS Health: say what to do next with the PLE you came for,
// until it's in a campaign.
function NextStepBanner({ groupId }) {
  const { state } = useStore();
  const g = groupId && state.ple.groups.find((x) => x.id === groupId);
  if (!g) return null;
  const v = groupView(state, g);
  if (!v.event || v.campaigns.length || !v.open.some((f) => f.status === 'Open')) return null;
  return (
    <Alert
      type="info"
      title={`Next: fix ${groupTitle(g)}`}
      action={
        <div className="actions">
          <Button onClick={() => navigate(groupPath(g))}>Review affected code</Button>
          <Button variant="primary" onClick={() => navigate(remediatePath(g))}>Create campaign</Button>
        </div>
      }
    >
      AWS Transform found the code behind {v.found.length === v.resources.length ? `all ${v.resources.length}` : `${v.found.length} of ${v.resources.length}`} affected{' '}
      {unit(v.event, v.resources.length)} in {plural(v.repos.length, 'repository', 'repositories')}.
      Review the code, then create a campaign: AWS Transform opens one pull request per repository for your teams to review and merge. Nothing changes until you approve the plan.
    </Alert>
  );
}

const ScopeCell = ({ fs, e }) => {
  const repos = [...new Set(fs.map((f) => f.repo))];
  const tags = scopeTags(fs, e);
  return (
    <div className="scope-cell">
      <span>{repos.length === 1 ? repos[0] : plural(repos.length, 'repository', 'repositories')}</span>
      {tags.length > 0 && (
        <div className="scope-tags">
          {tags.slice(0, 2).map(([t, tone]) => <span key={t} className={`scope-tag ${tone}`}>{t}</span>)}
          {tags.length > 2 && <span className="scope-tag" title={tags.slice(2).map(([t]) => t).join(', ')}>+{tags.length - 2}</span>}
        </div>
      )}
    </div>
  );
};

function RemediationCell({ r, openGenerate }) {
  const { state } = useStore();
  const m = remediation(r, state, openGenerate);
  if (m.generating) {
    const sk = m.generating.skill;
    const total = sk.minutes ?? GEN_MIN.simple;
    const frac = Math.min(1, (Date.now() - sk.startedAt) / sk.duration);
    const left = Math.max(1, Math.round((1 - frac) * total));
    const view = () => (r.kind === 'group' ? navigate(planPath(r.g), { review: '1' }) : navigate('/app/cm/campaigns/new', { findings: r.f.id, review: '1' }));
    return (
      <div className="remed-cell">
        <strong className="gen-title"><span className="gen-spark">✦</span> Generating skill · {Math.round(frac * 100)} %</strong>
        <span className="gen-meter"><span style={{ width: `${Math.max(4, frac * 100)}%` }} /></span>
        <div className="muted small">About {left} min left · <Link onClick={view}><strong>Details</strong></Link></div>
      </div>
    );
  }
  return (
    <div className="remed-cell">
      {m.label ? <Link onClick={m.go}><strong>{m.label}</strong></Link> : null}
      <div className="muted small">{m.sub}</div>
    </div>
  );
}

// Asks before generating: what it costs, why a skill is needed, and whether to remediate automatically.
function GenerateSkillModal({ r, onClose }) {
  const { state, dispatch, notify } = useStore();
  const [auto, setAuto] = useState(false);
  const fs = r.kind === 'group' ? r.children : [r.f];
  const repos = [...new Set(fs.map((f) => f.repo))];
  const complex = isComplex(fs);
  const text = fs.map((f) => `${f.title} ${f.category}`).join(' ');
  const why = /region|hard-?coded|config/i.test(text)
    ? ['Values are spread across code, config files and infrastructure templates', 'No managed TD knows which values are safe to turn into parameters']
    : /react native|framework|end-of-life|eol/i.test(text)
      ? ['The upgrade crosses several breaking framework releases', 'No managed TD covers this framework and its native modules']
      : /secur|vulnerab|secret|cve/i.test(text)
        ? ['Fixes touch code and configuration together, so they must follow each repository’s patterns', 'No managed TD covers these vulnerability patterns']
        : [`No managed or custom TD covers ${fs[0].category.toLowerCase()} findings like these`, 'The right fix depends on how each repository is structured'];
  const generate = () => {
    let gid = r.kind === 'group' ? r.g.id : `G-adhoc-${r.f.id}`;
    if (r.kind === 'finding') dispatch({ type: 'PLE_ADHOC_GROUP', finding: r.f });
    dispatch({ type: 'PLE_SKILL_GENERATE', groupId: gid, now: Date.now(), duration: complex ? GEN_MS.complex : GEN_MS.simple, autoRemediate: auto });
    dispatch({ type: 'PLE_SKILL_UPDATE', groupId: gid, patch: { minutes: complex ? GEN_MIN.complex : GEN_MIN.simple } });
    notify(`Generating a specialized skill for ${r.title}. Progress shows on its row.`, 'info');
    onClose();
  };
  return (
    <Modal
      title={<><span className="gen-spark">✦</span> Generate a specialized skill</>}
      width={560}
      onClose={onClose}
      footer={<><Button variant="link" onClick={onClose}>Cancel</Button><Button variant="primary" onClick={generate}>Generate skill</Button></>}
    >
      <p>
        No managed or custom TD covers <strong>{r.title}</strong>, so AWS Transform will build a specialized skill for it.
        {complex && ' This group is complex, so generating the skill takes longer and uses more agent minutes than running an existing TD.'}
      </p>
      <h4 className="gen-h">Why a skill is needed</h4>
      <ul className="gen-why">{why.map((w) => <li key={w}>{w}</li>)}</ul>
      <div className="gen-stats">
        <div><span className="muted small">Time to generate</span><strong>{complex ? '5–10 min' : '2–5 min'}</strong><span className="muted small">You can leave this page</span></div>
        <div><span className="muted small">Agent minutes</span><strong>{complex ? '20–30' : '10–15'}</strong><span className="muted small">vs. ~10 for a managed TD</span></div>
        <div><span className="muted small">Covers</span><strong>{plural(fs.length, 'finding')}</strong><span className="muted small">{plural(repos.length, 'repository', 'repositories')}</span></div>
      </div>
      <p className="muted small">Estimates, billed at your account’s agent-minute rate.</p>
      <label className="checkbox block option gen-auto">
        <input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} />
        <span>
          <strong>Auto-remediate when the skill is ready</strong>
          <span className="muted small">
            After validation, runs on {plural(repos.length, 'repository', 'repositories')} and opens {repos.length === 1 ? 'a pull request' : 'pull requests'}. Uses more agent minutes; you still review and merge.
          </span>
        </span>
      </label>
      <p className="muted small">Progress shows on this {r.kind === 'group' ? 'group’s' : 'finding’s'} row{auto ? '.' : '. You review the skill before it runs.'}</p>
    </Modal>
  );
}

function GroupRows({ r, openGenerate, recommended, open, toggle, selected, toggleSel }) {
  const { g, v, e, children } = r;
  const ids = children.map((f) => f.id);
  const sel = ids.every((id) => selected.includes(id));
  const partial = !sel && ids.some((id) => selected.includes(id));
  const repos = [...new Set(children.map((f) => f.repo))];
  const kind = e ? 'Suggested group' : g.custom ? 'Custom group' : 'Suggested group';
  return (
    <>
      <tr className={`group-row ${sel ? 'selected' : ''}`}>
        <td className="cb">
          <input type="checkbox" checked={sel} ref={(el) => el && (el.indeterminate = partial)} onChange={() => toggleSel(ids)} aria-label={`Select ${r.title}`} />
        </td>
        <td>
          <div className="group-cell">
            <button type="button" className="icon-btn" aria-expanded={open} aria-label={open ? 'Collapse group' : 'Expand group'} onClick={toggle}>
              <Icon.caret className={open ? '' : 'rot'} />
            </button>
            <div>
              <Link onClick={() => navigate(groupPath(g))}><strong>{r.title}</strong></Link>
              {g.custom && <> <span className="custom-tag">Custom group</span></>}
              {g.isNew && <span className="badge badge-green">New</span>}
              {e && <div><span className="aws-ple-tag due-tag">AWS Health · due {fmtDate(e.changeDate)}</span></div>}
              <div className="muted small">Group · {plural(children.length, 'finding')}</div>
            </div>
          </div>
        </td>
        <td><Severity value={r.severity} /></td>
        <td><ScopeCell fs={children} e={e} /></td>
        <td><RemediationCell r={r} openGenerate={openGenerate} /></td>
      </tr>
      {open && repos.length > 1 && !v.campaigns.length && (
        <tr className="child-row dep-row">
          <td className="cb" />
          <td colSpan={4}>
            <DependencyWarning repos={repos} onSetOrder={() => navigate(planPath(g), { review: '1' })} setOrderLabel="Set the order in the plan" />
          </td>
        </tr>
      )}
      {open && children.map((f) => <ChildRow key={f.id} f={f} e={e} selected={selected} toggleSel={toggleSel} />)}
    </>
  );
}

// A finding inside a group. AWS Health findings are one per affected resource: name and where it's defined.
function ChildRow({ f, e, selected, toggleSel }) {
  const sel = selected.includes(f.id);
  const res = e && f.functions?.length === 1 ? e.resources.find((x) => x.name === f.functions[0]) : null;
  return (
    <tr className={`child-row ${sel ? 'selected' : ''}`}>
      <td className="cb" />
      <td>
        <div className="child-cell">
          <input type="checkbox" checked={sel} onChange={() => toggleSel([f.id])} aria-label={`Select ${f.title}`} />
          <div>
            <Link onClick={() => navigate(`/app/cm/findings/${f.id}`)}>{res ? res.name : f.title}</Link>
            {res && <div className="muted small mono">{f.file}:{f.line}</div>}
          </div>
        </div>
      </td>
      <td><Severity value={f.severity} /></td>
      <td>{f.repo}</td>
      <td className="muted small">Remediated with this group</td>
    </tr>
  );
}

function FindingRow({ r, openGenerate, recommended, selected, toggleSel, onNotes }) {
  const { state } = useStore();
  const { f } = r;
  const sel = selected.includes(f.id);
  return (
    <tr className={sel ? 'selected' : ''}>
      <td className="cb">
        <input type="checkbox" checked={sel} onChange={() => toggleSel([f.id])} aria-label={`Select ${f.title}`} />
      </td>
      <td>
        <div className="group-cell">
          <span className="caret-spacer" />
          <div>
            <Link onClick={() => navigate(`/app/cm/findings/${f.id}`)}><strong>{f.title}</strong></Link>
            <div className="muted small">{r.group ? <>In group: <Link onClick={() => navigate(groupPath(r.group.g))}>{r.group.title}</Link></> : 'Standalone'}</div>
          </div>
        </div>
      </td>
      <td><Severity value={f.severity} /></td>
      <td><ScopeCell fs={[f]} e={null} /></td>
      {/* In All findings, a grouped finding is fixed together with its group. */}
      <td>{r.group ? <span className="muted small">Fixed with its group</span> : <RemediationCell r={r} openGenerate={openGenerate} />}</td>
    </tr>
  );
}
