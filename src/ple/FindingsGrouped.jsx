import React, { useMemo, useState } from 'react';
import { fmtDate, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Button, Icon, Link, Pagination, SearchInput, Select, Severity, Status } from '../components/ui';
import { NotesModal } from '../cm/Findings';
import { DemoPanel, groupView, PleTag } from './common';
import { DismissModal, groupPath, groupTitle, MoveModal, NewPleBanner, remediatePath, skillPath } from './Groups';

// Findings: the original CM findings table, with groups as expandable rows.
// A group row rolls up its findings; expanding it lists them with the same
// columns. Findings that aren't in a group stay as ordinary rows.

const PAGE = 10;
const SEV_RANK = { High: 3, Medium: 2, Low: 1 };

const STATUS_OPTIONS = [
  { value: 'Open', label: 'Open' },
  { value: 'all-active', label: 'Open + in remediation' },
  { value: 'In remediation', label: 'In remediation' },
  { value: 'Resolved', label: 'Resolved' },
  { value: 'Dismissed', label: 'Dismissed' },
  { value: 'all', label: 'All statuses' },
];

const matchStatus = (f, s) =>
  s === 'all' ? true
    : s === 'all-active' ? f.status === 'Open' || f.status === 'In remediation'
      : s === 'Resolved' ? f.status.startsWith('Resolved')
        : f.status === s;

const rollupStatus = (fs) =>
  fs.some((f) => f.status === 'Open') ? 'Open' : fs.some((f) => f.status === 'In remediation') ? 'In remediation' : fs.find((f) => f.status.startsWith('Resolved'))?.status ?? fs[0]?.status;

const COLUMNS = [
  ['title', 'Finding', (r) => r.title],
  ['severity', 'Severity', (r) => SEV_RANK[r.severity] * 1e9 + Number(r.date.replace(/-/g, ''))],
  ['status', 'Status', (r) => r.status],
  ['transformation', 'Transformation', (r) => r.transformation ?? '~'],
  ['date', 'Date reported', (r) => r.date],
  ['type', 'Analysis type', (r) => r.typeLabel],
  ['repo', 'Repository', (r) => r.repoLabel],
];

export function FindingsGrouped({ query }) {
  const { state, dispatch, notify } = useStore();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState(query.status ?? 'Open');
  const [repo, setRepo] = useState(query.repo ?? '');
  const [source, setSource] = useState(query.analysis ?? (query.tab === 'ple' ? 'ple' : ''));
  const [grouped, setGrouped] = useState(true);
  const [fixableOnly, setFixableOnly] = useState(query.fixable === '1');
  const [selected, setSelected] = useState(() => (query.sel ? query.sel.split(',') : []));
  const [expanded, setExpanded] = useState(() => new Set());
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState({ by: 'severity', desc: true });
  const [modal, setModal] = useState(null);

  const q = search.trim().toLowerCase();
  const keep = (f) =>
    matchStatus(f, status) &&
    (!repo || f.repo === repo) &&
    (!fixableOnly || f.transformation || f.pleId) &&
    (!source || (source === 'ple' ? !!f.pleId : f.analysisId === source)) &&
    (!q || [f.title, f.repo, f.transformation ?? '', f.category, f.file ?? '', f.evidence ?? ''].some((x) => x.toLowerCase().includes(q)));

  const rows = useMemo(() => {
    const groupOf = new Map();
    // One-off groups created for standalone findings in a campaign still show as standalone.
    const listed = state.ple.groups.filter((g) => !g.adhoc);
    if (grouped) listed.forEach((g) => g.findingIds.forEach((id) => groupOf.set(id, g)));
    const out = [];
    if (grouped) {
      listed.forEach((g) => {
        const v = groupView(state, g);
        const children = v.findings.filter(keep);
        if (!children.length) return;
        const e = v.event;
        out.push({
          key: g.id,
          kind: 'group',
          g,
          v,
          children,
          title: groupTitle(g),
          severity: v.severity,
          status: rollupStatus(children),
          transformation: e ? (e.td ?? 'Specialized skill') : v.td,
          date: children.map((f) => f.date).sort().at(-1),
          typeLabel: typeLabel(children[0].analysisType),
          repoLabel: v.repos.length === 1 ? v.repos[0] : `${v.repos.length} repositories`,
          entry: !!e && state.ple.entryEventId === g.pleId,
        });
      });
    }
    state.findings
      .filter((f) => !groupOf.has(f.id) && keep(f))
      .forEach((f) => out.push({ key: f.id, kind: 'finding', f, title: f.title, severity: f.severity, status: f.status, transformation: f.transformation, date: f.date, typeLabel: typeLabel(f.analysisType), repoLabel: f.repo }));
    const col = COLUMNS.find((c) => c[0] === sort.by);
    out.sort((a, b) => {
      const x = col[2](a);
      const y = col[2](b);
      const r = x < y ? -1 : x > y ? 1 : 0;
      return sort.desc ? -r : r;
    });
    // First visit from AWS Health: the PLE you came for is pinned to the top.
    const pin = out.findIndex((r) => r.key === query.highlight);
    if (pin > 0) out.unshift(...out.splice(pin, 1));
    return out;
  }, [state, grouped, search, status, repo, source, fixableOnly, sort, query.highlight]); // eslint-disable-line react-hooks/exhaustive-deps

  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages);
  const pageRows = rows.slice((cur - 1) * PAGE, cur * PAGE);

  // Selection is by finding; selecting a group row selects its findings.
  const selFindings = state.findings.filter((f) => selected.includes(f.id));
  const canAct = selFindings.length > 0 && selFindings.every((f) => f.status === 'Open');
  const allDismissed = selFindings.length > 0 && selFindings.every((f) => f.status === 'Dismissed');
  const toggleSel = (ids) => {
    const all = ids.every((id) => selected.includes(id));
    setSelected(all ? selected.filter((x) => !ids.includes(x)) : [...new Set([...selected, ...ids])]);
  };
  const toggleExp = (key) => setExpanded((s) => { const n = new Set(s); n.has(key) ? n.delete(key) : n.add(key); return n; });
  const pageIds = pageRows.flatMap((r) => (r.kind === 'group' ? r.children.map((f) => f.id) : [r.f.id]));
  const allOnPage = pageIds.length > 0 && pageIds.every((id) => selected.includes(id));
  const onSort = (by) => setSort((s) => (s.by === by ? { by, desc: !s.desc } : { by, desc: false }));
  const reset = () => { setPage(1); setSelected([]); };

  const repos = [...new Set(state.findings.map((f) => f.repo))].sort();
  const analyses = state.analyses.filter((a) => a.status === 'Completed');
  const shortDate = (iso) => new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const groupCount = rows.filter((r) => r.kind === 'group').length;

  // Selection summary for the campaign bar: items are groups with any selected finding, plus selected standalone findings.
  const selItems = rows.filter((r) => (r.kind === 'group' ? r.children.some((f) => selected.includes(f.id)) : selected.includes(r.f.id)));
  const selOpen = selFindings.filter((f) => f.status === 'Open');
  const selRepos = new Set(selOpen.map((f) => f.repo));
  const crossRepo = selItems.some((r) => r.kind === 'group' && (r.v.safety.pairs ?? []).some(([a, b]) => selRepos.has(a) && selRepos.has(b)));
  const allRowIds = rows.flatMap((r) => (r.kind === 'group' ? r.children.map((f) => f.id) : [r.f.id]));
  const createCampaign = () => navigate('/app/cm/campaigns/new', { findings: selOpen.map((f) => f.id).join(',') });

  return (
    <div>
      <NewPleBanner />
      <NextStepBanner groupId={query.highlight} />
      {state.ple.onboarded && !state.ple.eventBridge && (
        <Alert type="info" action={<Button onClick={() => { dispatch({ type: 'PLE_ENABLE_EVENTBRIDGE' }); notify('EventBridge rule atx-health-ple-delivery created.'); }}>Turn on</Button>}>
          <PleTag /> Get new PLEs automatically. Turn on EventBridge delivery.
        </Alert>
      )}
      <div className="section-head">
        <h2>
          Findings <span className="muted">({rows.length > PAGE ? `${PAGE}+` : rows.length})</span>
          {grouped && groupCount > 0 && <span className="muted small heading-note"> · {groupCount} {groupCount === 1 ? 'group' : 'groups'}</span>}
        </h2>
        <div className="actions">
          {allDismissed ? (
            <Button onClick={() => { dispatch({ type: 'REOPEN_FINDINGS', ids: selected }); notify(`${selected.length} finding(s) reopened.`); setSelected([]); }}>Reopen</Button>
          ) : (
            <Button disabled={!canAct} onClick={() => setModal({ type: 'dismiss', ids: selected })}>Dismiss</Button>
          )}
          <Button disabled={!selFindings.length} onClick={() => setModal({ type: 'move', ids: selected })}>Move to group</Button>
          {!selected.length && <Button variant="primary" disabled>Create campaign</Button>}
        </div>
      </div>
      <div className="filters">
        <SearchInput value={search} onChange={(v) => { setSearch(v); reset(); }} placeholder="Find findings" width={200} />
        <Select compact width={210} value={status} onChange={(v) => { setStatus(v); reset(); }} options={STATUS_OPTIONS} />
        <Select compact width={260} value={repo} onChange={(v) => { setRepo(v); reset(); }} options={[{ value: '', label: 'All repositories' }, ...repos.map((r) => ({ value: r, label: r }))]} />
        <Select
          compact
          width={240}
          value={source}
          onChange={(v) => { setSource(v); reset(); }}
          options={[{ value: '', label: 'All sources' }, { value: 'ple', label: 'AWS Health PLEs' }, ...analyses.map((a) => ({ value: a.id, label: `${a.name} · ${shortDate(a.date)}` }))]}
        />
        <label className="checkbox">
          <input type="checkbox" checked={grouped} onChange={(e) => { setGrouped(e.target.checked); reset(); }} /> Group findings
        </label>
        <label className="checkbox">
          <input type="checkbox" checked={fixableOnly} onChange={(e) => { setFixableOnly(e.target.checked); reset(); }} /> Auto-fixable only
        </label>
        <span className="grow" />
        <Pagination page={cur} pages={pages} onChange={setPage} />
      </div>

      {selected.length > 0 && (
        <div className="selection-bar">
          <strong>{selItems.length} selected</strong>
          <span>{selOpen.length} {selOpen.length === 1 ? 'finding' : 'findings'} · {selRepos.size} {selRepos.size === 1 ? 'repository' : 'repositories'}</span>
          {crossRepo && <span className="tag tag-amber"><Icon.warn width={11} height={11} /> Cross-repo dependency</span>}
          <span className="sel-sep" />
          <span className="muted">Ordered by dependency, one pull request per repository</span>
          <span className="grow" />
          {allRowIds.some((id) => !selected.includes(id)) && <Link onClick={() => setSelected([...new Set([...selected, ...allRowIds])])}>Select all {rows.length}</Link>}
          <Link onClick={() => setSelected([])}>Clear selection</Link>
          <Button variant="primary" disabled={!selOpen.length} onClick={createCampaign}>Create campaign</Button>
        </div>
      )}
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="cb"><input type="checkbox" checked={allOnPage} onChange={() => toggleSel(pageIds)} aria-label="Select all" /></th>
              {COLUMNS.map(([id, header]) => (
                <th key={id} className="sortable" onClick={() => onSort(id)}>
                  <span className="th-inner">
                    {header}
                    {sort.by === id ? <Icon.caret className={sort.desc ? '' : 'up'} /> : <Icon.filterCaret />}
                  </span>
                </th>
              ))}
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) =>
              r.kind === 'group' ? (
                <GroupRows key={r.key} r={r} open={expanded.has(r.key)} toggle={() => toggleExp(r.key)} selected={selected} toggleSel={toggleSel} onNotes={(f) => setModal({ type: 'notes', f })} />
              ) : (
                <FindingRow key={r.key} f={r.f} selected={selected} toggleSel={toggleSel} onNotes={(f) => setModal({ type: 'notes', f })} />
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

      {modal?.type === 'notes' && <NotesModal finding={modal.f} onClose={() => setModal(null)} />}
      {modal?.type === 'dismiss' && <DismissModal ids={modal.ids} onClose={() => { setModal(null); setSelected([]); }} />}
      {modal?.type === 'move' && <MoveModal findingIds={modal.ids} onClose={() => { setModal(null); setSelected([]); }} />}

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
      AWS Transform found {v.found.length} of {v.resources.length} affected resources in {v.repos.length} {v.repos.length === 1 ? 'repository' : 'repositories'}.
      Review the code, then create a campaign: AWS Transform opens one pull request per repository for your teams to review and merge. Nothing changes until you approve the plan.
    </Alert>
  );
}

function GroupRows({ r, open, toggle, selected, toggleSel, onNotes }) {
  const { g, v, children } = r;
  const ids = children.map((f) => f.id);
  const sel = ids.every((id) => selected.includes(id));
  const partial = !sel && ids.some((id) => selected.includes(id));
  const e = v.event;
  return (
    <>
      <tr className={`group-row ${sel ? 'selected' : ''} ${r.entry ? 'entry' : ''}`}>
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
              {r.entry && <span className="came-tag">You came here for this</span>}
              {g.isNew && <span className="badge badge-green">New</span>}
              <div className="muted small">
                {e && <span className="aws-ple-tag">AWS Health PLE</span>} Group {g.type} · {children.length} {children.length === 1 ? 'finding' : 'findings'}
                {e && <> · due {fmtDate(e.changeDate)}</>}
                {v.safety.tone === 'warn' && e && <span className="tag tag-amber"><Icon.warn width={11} height={11} /> {v.safety.label.replace(/^\d+ warning: /, '')}</span>}
              </div>
            </div>
          </div>
        </td>
        <td><Severity value={r.severity} /></td>
        <td><Status value={r.status} /></td>
        <td>
          {e ? (
            <Link onClick={() => navigate(v.campaigns[0] ? `/app/cm/campaigns/${v.campaigns[0].id}` : remediatePath(g))}>
              {v.campaigns[0] ? 'View campaign' : e.td ?? 'Specialized skill'}
            </Link>
          ) : g.type === 'C' ? (
            <Link onClick={() => navigate(v.campaigns[0] ? `/app/cm/campaigns/${v.campaigns[0].id}` : skillPath(g))}>{v.campaigns[0] ? 'View campaign' : 'Specialized skill'}</Link>
          ) : (
            r.transformation ?? <span>No remediation available.</span>
          )}
        </td>
        <td>{fmtDate(r.date)}</td>
        <td>{r.typeLabel}</td>
        <td>{r.repoLabel}</td>
        <td><span className="muted">—</span></td>
      </tr>
      {open && children.map((f) => <FindingRow key={f.id} f={f} child selected={selected} toggleSel={toggleSel} onNotes={onNotes} />)}
    </>
  );
}

function FindingRow({ f, child, selected, toggleSel, onNotes }) {
  const sel = selected.includes(f.id);
  return (
    <tr className={`${child ? 'child-row' : ''} ${sel ? 'selected' : ''}`}>
      <td className="cb">
        <input type="checkbox" checked={sel} onChange={() => toggleSel([f.id])} aria-label={`Select ${f.id}`} />
      </td>
      <td>
        <div className={child ? 'child-cell' : ''}>
          <Link onClick={() => navigate(`/app/cm/findings/${f.id}`)}>{child && f.file ? <span className="mono small">{f.file}:{f.line}</span> : <strong>{f.title}</strong>}</Link>
          {child && f.evidence && <div className="muted small"><code>{f.evidence}</code></div>}
        </div>
      </td>
      <td><Severity value={f.severity} /></td>
      <td><Status value={f.status} /></td>
      <td>{f.transformation ?? <span>No remediation available.</span>}</td>
      <td>{fmtDate(f.date)}</td>
      <td>{typeLabel(f.analysisType)}</td>
      <td>{f.repo}</td>
      <td>
        <Link onClick={() => onNotes(f)} title={f.notes || undefined}>
          {f.notes ? (f.notes.length > 18 ? `${f.notes.slice(0, 18)}…` : f.notes) : 'Add notes'}
        </Link>
      </td>
    </tr>
  );
}
