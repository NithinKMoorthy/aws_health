import React, { useState } from 'react';
import { fmtDate, fmtDateTime } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, Icon, Link, Status, Table, Tabs } from '../components/ui';
import { NotFound } from '../cm/Findings';
import { RESOLVED_HEALTH } from './reducer';
import { DemoPanel, Meter, PleTag, Ring, shortTitle, unit } from './common';

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
