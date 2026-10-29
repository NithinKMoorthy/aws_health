import React, { useState } from 'react';
import { fmtDate, fmtDateTime, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, Icon, Link, Status, Table, Tabs } from '../components/ui';
import { NotFound } from '../cm/Findings';
import { RESOLVED_HEALTH } from './reducer';
import { DemoPanel, EventHeader, eventsTitle, fromName, Meter, MultiEventHeader, noticeTitle, PleTag, Ring, shortTitle, targetName, unit, unitFor } from './common';
import { MOCK_TODAY, ORG } from './data';

// Screen 9 (campaign in progress) and Screen 10 (verification through AWS Health).

const STATUS_LABEL = {
  queued: 'Queued',
  running: 'Running',
  change_ready: 'Change ready',
  merged: 'Merged',
  failed: 'Failed',
  draft_pr: 'Draft PR',
  manual: 'Manual work',
};

const counts = (c) => {
  const by = (s) => c.repos.filter((r) => s.includes(r.status)).length;
  return { running: by(['queued', 'running']), ready: by(['change_ready']), merged: by(['merged']), failed: by(['failed']), total: c.repos.length };
};

export function Campaigns() {
  const { state } = useStore();
  const rows = state.ple.campaigns;
  return (
    <div>
      <div className="section-head">
        <h2>Campaigns <span className="muted">({rows.length})</span></h2>
        <Button variant="primary" onClick={() => navigate('/app/cm/findings', { tab: 'groups' })}>Plan a campaign</Button>
      </div>
      <Table
        columns={[
          { id: 'n', header: 'Campaign', cell: (c) => <Link onClick={() => navigate(`/app/cm/campaigns/${c.id}`)}><strong>{c.name}</strong></Link> },
          { id: 't', header: 'Target state', cell: (c) => c.target },
          { id: 'g', header: 'Groups', cell: (c) => c.groups.map((g) => g.name).join(', ') },
          { id: 'd', header: 'Due date', cell: (c) => fmtDate(c.dueDate) },
          { id: 'p', header: 'Merged', cell: (c) => { const k = counts(c); return `${k.merged} of ${k.total}`; } },
          { id: 's', header: 'Status', cell: (c) => { const k = counts(c); return <Status value={k.merged === k.total ? 'Complete' : 'In progress'} />; } },
        ]}
        rows={rows}
        empty={<><strong>No campaigns</strong><p className="muted">Review a plan from Findings to start one.</p></>}
      />
    </div>
  );
}

export function CampaignDetail({ id, query }) {
  const { state, dispatch, notify } = useStore();
  const c = state.ple.campaigns.find((x) => x.id === id);
  const [tab, setTab] = useState(query.tab ?? 'progress');
  const [trackBy, setTrackBy] = useState('repo');
  const [open, setOpen] = useState(null);
  if (!c) return <NotFound what="Campaign" back="/app/cm/campaigns" />;
  const k = counts(c);
  const pleIds = [...new Set(c.groups.map((g) => g.pleId).filter(Boolean))];
  const multiGroup = c.groups.length > 1;
  const groupName = (gid) => c.groups.find((g) => g.id === gid)?.name ?? gid;
  const act = (type, repo, msg) => {
    dispatch({ type, campaignId: c.id, repo, now: Date.now() });
    if (msg) notify(msg);
  };
  // A campaign for one lifecycle event is tracked against that event.
  // Campaigns for one lifecycle event (alone, or launched together as a set) are tracked against their events.
  const eventOf = (x) => (x.groups.length === 1 && x.groups[0].pleId ? state.ple.events.find((e) => e.id === x.groups[0].pleId) : null);
  const peers = c.setId ? state.ple.campaigns.filter((x) => x.setId === c.setId) : [c];
  const items = peers.map((x) => ({ c: x, event: eventOf(x) })).filter((x) => x.event).sort((a, b) => a.event.changeDate.localeCompare(b.event.changeDate));
  if (items.length === peers.length && items.length) return <EventCampaign items={items} />;

  const repoCols = [
    { id: 'r', header: 'Repository', cell: (r) => <strong>{r.repo}</strong> },
    ...(multiGroup ? [{ id: 'g', header: 'Group', cell: (r) => groupName(r.groupId) }] : []),
    { id: 's', header: 'Status', cell: (r) => <Status value={r.status}>{STATUS_LABEL[r.status] ?? r.status}</Status> },
    { id: 'pr', header: 'Pull request', cell: (r) => (r.pr ? <Link external onClick={() => notify(`Opens ${r.repo} pull request #${r.pr} on GitHub (mock).`, 'info')}>#{r.pr}{r.status === 'draft_pr' ? ' (draft)' : ''}</Link> : '—') },
    { id: 'v', header: 'AWS Transform validation', cell: (r) => (r.validation ? <span className={r.validation === 'Passed' ? 'status status-success' : 'status status-error'}>{r.validation}</span> : r.status === 'running' ? <span className="muted">Running…</span> : '—') },
    { id: 'o', header: 'Owner', cell: (r) => r.owner },
    {
      id: 'a',
      header: '',
      cell: (r) =>
        r.status === 'failed' ? (
          <Link onClick={() => setOpen(open === r.repo ? null : r.repo)}>{open === r.repo ? 'Hide details' : 'Details'}</Link>
        ) : r.status === 'change_ready' ? (
          <Link onClick={() => act('PLE_MERGE_PR', r.repo, `${r.repo} #${r.pr} merged by ${r.owner}.`)}>Mark merged</Link>
        ) : null,
    },
  ];

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Campaigns', onClick: () => navigate('/app/cm/campaigns') },
          { label: c.name },
        ]}
      />
      <div className="campaign-head">
        <div>
          <h1 className="page-title">{c.name}</h1>
          <div className="group-meta">
            <span>target <strong>{c.target}</strong></span>
            <span className="meta-sep" />
            <span>due {fmtDate(c.dueDate)} {pleIds.length > 0 && <PleTag />}</span>
          </div>
        </div>
        <Ring value={k.merged} total={k.total} label="merged" />
      </div>

      <Tabs
        tabs={[
          { id: 'progress', label: 'Progress' },
          ...(pleIds.length ? [{ id: 'verify', label: <>Verification <PleTag /></> }] : []),
        ]}
        active={tab}
        onChange={setTab}
      />

      {tab === 'progress' && (
        <>
          <div className="tiles-row four">
            <div className="tile-stat"><div className="tile-value">{k.running}</div><div className="muted small">Running</div></div>
            <div className="tile-stat"><div className="tile-value">{k.ready}</div><div className="muted small">Change ready</div></div>
            <div className="tile-stat"><div className="tile-value ok">{k.merged}</div><div className="muted small">Merged</div></div>
            <div className="tile-stat"><div className={`tile-value ${k.failed ? 'bad' : ''}`}>{k.failed}</div><div className="muted small">Failed</div></div>
          </div>
          <div className="filters">
            <span className="field-label" style={{ margin: 0 }}>Track by</span>
            <div className="segmented">
              {[['group', 'Group'], ['repo', 'Repository'], ['finding', 'Finding']].map(([key, label]) => (
                <button key={key} type="button" className={trackBy === key ? 'on' : ''} onClick={() => setTrackBy(key)}>{label}</button>
              ))}
            </div>
          </div>
          {trackBy === 'repo' && (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>{repoCols.map((col) => <th key={col.id}>{col.header}</th>)}</tr>
                </thead>
                <tbody>
                  {c.repos.map((r) => (
                    <React.Fragment key={`${r.groupId}-${r.repo}`}>
                      <tr className={r.status === 'failed' ? 'row-failed' : ''}>{repoCols.map((col) => <td key={col.id}>{col.cell(r)}</td>)}</tr>
                      {r.status === 'failed' && open === r.repo && (
                        <tr className="row-expand">
                          <td colSpan={repoCols.length}>
                            <p><strong>Why it failed:</strong> {r.failure?.reason ?? 'AWS Transform validation failed.'}</p>
                            {r.failure?.log && <pre className="code-block">{r.failure.log.join('\n')}</pre>}
                            <div className="inline-gap">
                              <Button onClick={() => { act('PLE_RETRY', r.repo, `Retrying ${r.repo}.`); setOpen(null); }}>Retry</Button>
                              <Button onClick={() => act('PLE_DRAFT_PR', r.repo, `Draft PR opened on ${r.repo}. It won't count as complete.`)}>Open as draft PR</Button>
                              <Button variant="link" onClick={() => act('PLE_MANUAL', r.repo, `${r.repo} marked for manual work; ${r.owner} notified.`)}>Mark for manual work</Button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {trackBy === 'group' && <ByGroup c={c} />}
          {trackBy === 'finding' && <ByFinding c={c} />}
          <p className="muted small rule-note">
            <Icon.info /> A repository shows Change ready only after it passes AWS Transform validation. Failed validation never shows as complete.
          </p>
          <DemoPanel>
            <div className="demo-row">
              <span>Owners merge every ready pull request</span>
              <Button disabled={!k.ready} onClick={() => c.repos.filter((r) => r.status === 'change_ready').forEach((r) => act('PLE_MERGE_PR', r.repo))}>Merge {k.ready} ready</Button>
            </div>
          </DemoPanel>
        </>
      )}

      {tab === 'verify' && pleIds.map((pid) => <Verification key={pid} c={c} pleId={pid} onFailures={() => { setTab('progress'); setTrackBy('repo'); }} />)}
    </div>
  );
}

// ---- Campaigns tracked against their lifecycle events ---------------------------
// One campaign per event. Campaigns launched together from several events (same
// setId) share one page, one section per event, nearest deadline first.

const shortDate = (iso) => new Date(`${iso}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
const addDays = (iso, d) => new Date(new Date(`${iso}T12:00`).getTime() + d * 86400000).toISOString().slice(0, 10);
const CADENCE_DAYS = { daily: 1, weekly: 7, monthly: 30 };
const cap = (x) => x.charAt(0).toUpperCase() + x.slice(1);

function EventCampaign({ items }) {
  const { state, dispatch, notify } = useStore();
  const [open, setOpen] = useState(null);
  const multi = items.length > 1;
  const events = items.map((x) => x.event);
  const act = (type, cid, repo, msg) => {
    dispatch({ type, campaignId: cid, repo, now: Date.now() });
    if (msg) notify(msg);
  };
  const org = state.sources.find((s) => s.id === 'src-ple')?.org ?? ORG;
  const all = events.flatMap((e) => e.resources);
  const n = all.length;
  const u = unitFor(events, n);
  const one = unitFor(events, 1);
  const service = events.every((e) => e.service === events[0].service) ? events[0].service : 'AWS';
  const resolved = all.filter((r) => r.status === 'RESOLVED').length;
  const runs = items.flatMap(({ c }) => c.repos);
  const k = counts({ repos: runs });
  const opened = runs.filter((r) => r.pr).length;
  const started = shortDate(items[0].c.createdAt);

  const rowState = (r, e) => {
    const fns = e.resources.filter((x) => x.repo === r.repo);
    if (r.status === 'merged' && fns.length && fns.every((f) => f.status === 'RESOLVED')) return ['resolved', 'Resolved', `Running ${e.target}`];
    if (r.status === 'merged') return ['merged', 'Merged', r.deployed ? 'Deployed · waiting for AWS Health' : 'Waiting for your next deploy'];
    if (r.status === 'change_ready') return ['review', 'In review', `Opened ${started} · approval needed`];
    if (r.status === 'failed') return ['failed', 'Failed validation', r.validation ?? 'AWS Transform validation failed'];
    if (r.status === 'draft_pr') return ['merged', 'Draft PR', "Doesn't count as complete"];
    if (r.status === 'manual') return ['merged', 'Manual work', `${r.owner} notified`];
    return ['running', r.status === 'queued' ? 'Queued' : 'Validating', 'AWS Transform is preparing the change'];
  };
  const states = items.flatMap(({ c, event }) => c.repos.map((r) => rowState(r, event)[0]));
  const has = (st) => states.includes(st);
  const stage = resolved === n ? ['resolved', 'All resolved'] : has('running') ? ['running', 'Validating'] : has('review') || has('failed') ? ['review', 'In review'] : ['merged', 'Deploying'];
  const cur = resolved === n ? 4 : has('running') || has('review') ? 0 : runs.some((r) => r.status === 'merged' && !r.deployed) ? 1 : 2;
  const prNote = k.failed ? `${k.failed} failed validation` : k.running ? `${k.running} still validating` : 'All passed validation';
  const first = events[0];

  const next = [
    ['Your teams review and merge', 'Each pull request already passed AWS Transform validation. Nothing merges without approval.'],
    ['You deploy as usual', 'AWS Transform doesn’t deploy. Use your own pipeline.'],
    [`We confirm each ${one}`, `Resolved updates when ${service} shows the ${one} on its new runtime.`],
    multi ? ['The events close', `AWS Health marks each event resolved once its ${u} are upgraded.`] : ['The event closes', `AWS Health marks it resolved once all ${n} are upgraded.`],
  ];

  // Continuous analysis chosen at setup (step 4).
  const schedule = state.ple.schedule;
  const continuous = (schedule?.analyses ?? []).map((a) => {
    if (a.type === 'ple') return { key: a.type, label: 'Lifecycle events', value: <>{cap(a.cadence)} · next {shortDate(addDays(MOCK_TODAY, CADENCE_DAYS[a.cadence] ?? 7))}</> };
    const run = state.analyses.find((x) => x.type === a.type);
    return {
      key: a.type,
      label: typeLabel(a.type),
      value: (
        <>
          {cap(a.cadence)} ·{' '}
          {run ? (
            <Link onClick={() => navigate(`/app/cm/analyses/${run.id}`)}><strong>{run.status === 'Completed' ? `${run.findings} findings` : 'running'}</strong></Link>
          ) : (
            'starts after the pull requests open'
          )}
        </>
      ),
    };
  });

  const table = (c, event) => (
    <table className="table plain">
      <thead>
        <tr><th>Repository</th><th>{cap(unit(event, 2))}</th><th>Pull request</th><th>Status</th></tr>
      </thead>
      <tbody>
        {c.repos.map((r) => {
          const [tone, label, sub] = rowState(r, event);
          const key = `${c.id}:${r.repo}`;
          return (
            <React.Fragment key={key}>
              <tr>
                <td><strong>{r.repo}</strong></td>
                <td>{event.resources.filter((x) => x.repo === r.repo).map((f) => f.name).join(', ') || <span className="muted">—</span>}</td>
                <td>{r.pr ? <Link external onClick={() => notify(`Opens ${r.repo} pull request #${r.pr} on GitHub (mock).`, 'info')}>#{r.pr}</Link> : <span className="muted">—</span>}</td>
                <td>
                  <span className={`stage stage-${tone}`}>{label}</span>
                  <div className="muted small">
                    {sub}
                    {tone === 'failed' && <> · <Link onClick={() => setOpen(open === key ? null : key)}>{open === key ? 'Hide details' : 'Details'}</Link></>}
                  </div>
                </td>
              </tr>
              {tone === 'failed' && open === key && (
                <tr className="row-expand">
                  <td colSpan={4}>
                    <p><strong>Why it failed:</strong> {r.failure?.reason ?? 'AWS Transform validation failed.'}</p>
                    {r.failure?.log && <pre className="code-block">{r.failure.log.join('\n')}</pre>}
                    <div className="inline-gap">
                      <Button onClick={() => { act('PLE_RETRY', c.id, r.repo, `Retrying ${r.repo}.`); setOpen(null); }}>Retry</Button>
                      <Button onClick={() => act('PLE_DRAFT_PR', c.id, r.repo, `Draft PR opened on ${r.repo}. It won't count as complete.`)}>Open as draft PR</Button>
                      <Button variant="link" onClick={() => act('PLE_MANUAL', c.id, r.repo, `${r.repo} marked for manual work; ${r.owner} notified.`)}>Mark for manual work</Button>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          );
        })}
      </tbody>
    </table>
  );

  return (
    <div className="page get-started">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          multi ? { label: eventsTitle(events), onClick: () => navigate('/app/cm/findings', { tab: 'ple' }) } : { label: noticeTitle(first), onClick: () => navigate(`/app/cm/findings/G-${first.id}`) },
          { label: 'Campaign' },
        ]}
      />
      {multi ? <MultiEventHeader events={events} compact /> : <EventHeader event={first} />}
      <div className="ec-title">
        <h1>{multi ? `${service} runtime upgrades` : items[0].c.name}</h1>
        <span className={`stage stage-${stage[0]}`}>{stage[1]}</span>
      </div>
      <p className="muted ec-sub">
        {multi ? `${items.length} campaigns, one per event` : `Campaign · ${fromName(first)} → ${first.target}`} · {k.total} pull {k.total === 1 ? 'request' : 'requests'} in {org} · started {started}
      </p>
      <section className="ec-stats">
        <div><span>Pull requests opened</span><strong>{opened} <small>of {k.total}</small></strong><span className="muted">{prNote}</span></div>
        <div><span>Merged</span><strong>{k.merged} <small>of {k.total}</small></strong><span className="muted">By your teams</span></div>
        <div>
          <span>{multi ? `${cap(u)} upgraded` : `${cap(u)} on ${targetName(first)}`}</span>
          <strong className="blue">{resolved} <small>of {n}</small></strong>
          <span className="muted">Confirmed in {service} after deploy</span>
        </div>
      </section>
      <div className="ec-layout">
        <div className="ec-table">
          {items.map(({ c, event }) => {
            const k2 = event.resources.length;
            const done2 = event.resources.filter((r) => r.status === 'RESOLVED').length;
            return (
              <React.Fragment key={c.id}>
                {multi && (
                  <div className="ec-section">
                    <strong>{fromName(event)} → {event.target}</strong>
                    <span className="muted small">Due {fmtDate(event.changeDate)}</span>
                    <span className="grow" />
                    <span className="muted small">{done2} of {k2} {unit(event, k2)} upgraded</span>
                  </div>
                )}
                {table(c, event)}
              </React.Fragment>
            );
          })}
        </div>
        <aside className="ec-side">
          <section className="ec-card">
            <h2>What happens next</h2>
            <ol className="ec-next">
              {next.map(([t, d], i) => (
                <li key={t} className={i < cur ? 'done' : i === cur ? 'current' : ''}>
                  <span className="ec-dot">{i < cur && <Icon.check />}</span>
                  <div><strong>{t}</strong><p className="muted">{d}</p></div>
                </li>
              ))}
            </ol>
          </section>
          {continuous.length > 0 && (
            <section className="ec-card">
              <h2>Running continuously</h2>
              <dl className="ec-cont">
                {continuous.map((x) => (
                  <React.Fragment key={x.key}>
                    <dt>{x.label}</dt>
                    <dd className="muted">{x.value}</dd>
                  </React.Fragment>
                ))}
              </dl>
            </section>
          )}
        </aside>
      </div>
      <DemoPanel>
        <div className="demo-row">
          <span>Owners merge every ready pull request</span>
          <Button disabled={!k.ready} onClick={() => items.forEach(({ c }) => c.repos.filter((r) => r.status === 'change_ready').forEach((r) => act('PLE_MERGE_PR', c.id, r.repo)))}>Merge {k.ready} ready</Button>
        </div>
        <div className="demo-row">
          <span>Teams deploy, and AWS Health refreshes (skips its ~72-hour delay)</span>
          <Button onClick={() => { dispatch({ type: 'PLE_HEALTH_REFRESH', now: Date.now() }); notify('AWS Health refreshed.', 'info'); }}>Fast-forward AWS Health</Button>
        </div>
      </DemoPanel>
    </div>
  );
}

function ByGroup({ c }) {
  return (
    <Table
      columns={[
        { id: 'g', header: 'Group', cell: (g) => <Link onClick={() => navigate(`/app/cm/findings/${g.id}`)}>{g.name}</Link> },
        { id: 'r', header: 'Repositories', cell: (g) => c.repos.filter((r) => r.groupId === g.id).length },
        { id: 'm', header: 'Merged', cell: (g) => c.repos.filter((r) => r.groupId === g.id && r.status === 'merged').length },
        { id: 'f', header: 'Failed', cell: (g) => c.repos.filter((r) => r.groupId === g.id && r.status === 'failed').length },
      ]}
      rows={c.groups}
    />
  );
}

function ByFinding({ c }) {
  const { state } = useStore();
  const runOf = (fid) => c.repos.find((r) => r.findingIds.includes(fid));
  const rows = state.findings.filter((f) => runOf(f.id));
  return (
    <Table
      columns={[
        { id: 'r', header: 'Repository', cell: (f) => f.repo },
        { id: 'file', header: 'File and line', cell: (f) => <span className="mono small">{f.file}:{f.line}</span> },
        { id: 'e', header: 'Evidence', cell: (f) => <code>{f.evidence}</code> },
        { id: 'run', header: 'Repository status', cell: (f) => <Status value={runOf(f.id).status}>{STATUS_LABEL[runOf(f.id).status]}</Status> },
        { id: 's', header: 'Finding status', cell: (f) => <Status value={f.status} /> },
      ]}
      rows={rows}
      empty="No findings tracked in this campaign."
    />
  );
}

function Verification({ c, pleId, onFailures }) {
  const { state, dispatch, notify } = useStore();
  const event = state.ple.events.find((e) => e.id === pleId);
  const groupIds = c.groups.filter((g) => g.pleId === pleId).map((g) => g.id);
  const runs = c.repos.filter((r) => groupIds.includes(r.groupId));
  const runFor = (repo) => runs.find((r) => r.repo === repo);
  const res = event.resources;
  const resolved = res.filter((r) => r.status === 'RESOLVED').length;
  const merged = runs.filter((r) => r.status === 'merged').length;
  const notFound = res.filter((r) => !r.repo && r.status === 'PENDING');
  const failed = runs.filter((r) => r.status === 'failed');
  const n = res.length;
  const u = unit(event, n);
  const done = resolved === n;
  const findings = state.findings.filter((f) => f.pleId === pleId && runs.some((r) => r.findingIds.includes(f.id)));
  const fResolved = findings.filter((f) => f.status === RESOLVED_HEALTH).length;

  return (
    <>
      {done ? (
        <Alert type="success" title="This PLE is closed">
          All {n} {u} are on a supported runtime. {shortTitle(event)} is RESOLVED in AWS Health.
        </Alert>
      ) : (
        <div className="verify-banner">
          <strong>{resolved} of {n} {u} RESOLVED in AWS Health</strong>
          <span className="muted small"> · {event.title}</span>
        </div>
      )}
      <Container>
        <div className="two-col">
          <Meter value={merged} total={runs.length} label="Merged" />
          <Meter value={resolved} total={n} label={<>AWS Health <PleTag /></>} />
        </div>
        {!done && merged > 0 && (
          <Alert type="info" title="Next: deploy the merged changes">
            Merging isn't enough. AWS Health marks a resource RESOLVED only after the updated code is deployed to it.
          </Alert>
        )}
        <p className="muted small" style={{ marginTop: 12 }}>
          <Icon.info /> AWS Health updates status after you deploy, usually within 72 hours. Last checked {fmtDateTime(state.ple.lastHealthSync)}.
        </p>
      </Container>

      {!done && (notFound.length > 0 || failed.length > 0) && (
        <Container header={`Open items (${notFound.length + failed.reduce((s, r) => s + res.filter((x) => x.repo === r.repo && x.status === 'PENDING').length, 0)})`}>
          <ul className="open-items">
            {notFound.length > 0 && (
              <li>
                <span><Icon.warn className="warn" /> {notFound.length} {unit(event, notFound.length)} not found in your code{notFound.every((x) => x.manual) ? ' · marked for manual work' : ''}</span>
                <span className="inline-gap">
                  <Link onClick={() => navigate('/app/ple/repos')}>Connect more repositories</Link>
                  {!notFound.every((x) => x.manual) && <Link onClick={() => { dispatch({ type: 'PLE_MARK_NOT_FOUND_MANUAL', eventId: pleId }); notify('Marked for manual work; owners notified.'); }}>Mark for manual work</Link>}
                </span>
              </li>
            )}
            {failed.length > 0 && (
              <li>
                <span><Icon.error className="bad" /> {failed.length} {failed.length === 1 ? 'repository' : 'repositories'} failed checks ({failed.map((r) => r.repo).join(', ')})</span>
                <Link onClick={onFailures}>View failures</Link>
              </li>
            )}
          </ul>
        </Container>
      )}

      <Container header={`Affected resources (${n})`} description={`Findings resolved (AWS Health): ${fResolved} of ${findings.length}. A finding moves to resolved (AWS Health) when every resource it covers is RESOLVED.`}>
        <Table
          rowKey={(r) => r.arn}
          columns={[
            { id: 'arn', header: 'Function ARN', cell: (r) => <span className="mono small">{r.arn}</span> },
            { id: 'repo', header: 'Repository', cell: (r) => r.repo ?? <span className="muted">Not found</span> },
            { id: 'dep', header: 'Deployed', cell: (r) => (r.repo && runFor(r.repo)?.deployed ? <span className="status status-success"><Icon.check /> Yes</span> : r.status === 'RESOLVED' ? <span className="muted">Before campaign</span> : <span className="muted">No</span>) },
            { id: 'h', header: 'Health status', cell: (r) => <Status value={r.status} /> },
            { id: 'u', header: 'Last updated', cell: (r) => fmtDateTime(r.updated) },
          ]}
          rows={res}
        />
      </Container>
      <DemoPanel>
        <div className="demo-row">
          <span>Skip AWS Health's ~72-hour refresh (also resolves resources marked for manual work)</span>
          <Button onClick={() => { dispatch({ type: 'PLE_HEALTH_REFRESH', now: Date.now() }); notify('AWS Health refreshed.', 'info'); }}>Fast-forward AWS Health</Button>
        </div>
      </DemoPanel>
    </>
  );
}
