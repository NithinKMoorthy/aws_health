import React, { useState } from 'react';
import { fmtDate, fmtDateTime, TENANT, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import {
  Alert, Breadcrumbs, Button, ButtonDropdown, Container, CopyText, FormField, Icon, KeyValue, Link, Modal, Select, Severity, Status, Table, Tabs,
} from '../components/ui';
import { NotFound } from '../cm/Findings';
import { eventById } from './data';
import { ChangeDate, Drawer, groupTypeLabel, groupView, Meter, PleTag, SafetyBar, shortTitle, unit } from './common';

// Screen 7 (group detail + PLE details drawer), shared finding modals, and the
// Screen 11 banners shown on Findings.

export const groupTitle = (g) => (g.pleId ? `${g.shortName} end of support` : g.name);
export const groupPath = (g) => `/app/cm/findings/${g.id}`;
export const planPath = (g) => `/app/cm/findings/${g.id}/plan`;
export const skillPath = (g) => `/app/cm/findings/${g.id}/skill`;
/** Where "remediate" goes: type C groups review their specialized skill first. */
export const remediatePath = (g) => (g.type === 'C' && g.skill?.status !== 'ready' && !g.skill?.approved ? skillPath(g) : planPath(g));

export function GroupDetail({ id, query }) {
  const { state, dispatch, notify } = useStore();
  const g = state.ple.groups.find((x) => x.id === id);
  const [tab, setTab] = useState(query.tab ?? 'findings');
  const [selected, setSelected] = useState([]);
  const [drawer, setDrawer] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [dismiss, setDismiss] = useState(null);
  if (!g) return <NotFound what="Group" back="/app/cm/findings" />;
  const v = groupView(state, g);
  const e = v.event;
  const u = e ? unit(e, 2) : 'resources';
  const U = `${u.charAt(0).toUpperCase()}${u.slice(1)}`;
  const runFor = (repo) => v.runs.find((r) => r.repo === repo);
  const sel = selected.filter((x) => g.findingIds.includes(x));
  const remediateFinding = (f) => navigate(planPath(g), { finding: f.id });

  const findingCols = e
    ? [
        { id: 'repo', header: 'Repository', cell: (f) => <strong>{f.repo}</strong> },
        { id: 'file', header: 'File and line', cell: (f) => <span className="mono small">{f.file}:{f.line}</span> },
        { id: 'ev', header: 'Evidence', cell: (f) => <code>{f.evidence}</code> },
        { id: 'fn', header: `${U} covered`, cell: (f) => (f.functions?.length ? f.functions.length : <span className="muted">—</span>) },
        { id: 'sev', header: 'Severity', cell: (f) => <Severity value={f.severity} /> },
        { id: 'st', header: 'Status', cell: (f) => <Status value={f.status}>{f.status === 'Open' ? 'open' : f.status}</Status> },
      ]
    : [
        { id: 'repo', header: 'Repository', cell: (f) => <strong>{f.repo}</strong> },
        { id: 't', header: 'Finding', cell: (f) => <Link onClick={() => navigate(`/app/cm/findings/${f.id}`)}>{f.title}</Link> },
        { id: 'c', header: 'Category', cell: (f) => f.category },
        { id: 'x', header: 'Transformation', cell: (f) => f.transformation ?? <span className="muted">—</span> },
        { id: 'sev', header: 'Severity', cell: (f) => <Severity value={f.severity} /> },
        { id: 'st', header: 'Status', cell: (f) => <Status value={f.status} /> },
      ];
  findingCols.push({
    id: 'act',
    header: '',
    cell: (f) => (
      <ButtonDropdown
        label="Actions"
        variant="link"
        items={[
          { id: 'finding', label: 'Remediate this finding', disabled: f.status !== 'Open' },
          { id: 'repo', label: 'Remediate this repository', disabled: f.status !== 'Open' },
          { id: 'move', label: 'Move to group…' },
          { id: 'dismiss', label: 'Dismiss…', disabled: f.status !== 'Open' },
        ]}
        onItem={(a) => {
          if (a === 'finding') remediateFinding(f);
          if (a === 'repo') navigate(planPath(g), { repo: f.repo });
          if (a === 'move') { setSelected([f.id]); setMoveOpen(true); }
          if (a === 'dismiss') setDismiss([f.id]);
        }}
      />
    ),
  });

  const tabs = [
    { id: 'findings', label: `Findings (${v.findings.length})` },
    { id: 'repos', label: `Repositories (${v.repos.length})` },
    ...(e
      ? [
          { id: 'resources', label: <>Affected resources ({v.resources.length}) <PleTag /></> },
          { id: 'notfound', label: <>Not found ({v.notFound.length}) <PleTag /></> },
        ]
      : []),
  ];

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Findings', onClick: () => navigate('/app/cm/findings', e ? { tab: 'ple' } : { tab: 'groups' }) },
          { label: groupTitle(g) },
        ]}
      />
      <div className="section-head">
        <div>
          <h1 className="page-title">{groupTitle(g)}</h1>
          <div className="group-meta">
            {e && <span className="aws-ple-tag">AWS Health PLE</span>}
            <span>Group {g.type} · {groupTypeLabel(g.type).split(': ')[1]}</span>
            {e && (
              <>
                <span className="meta-sep" />
                <SafetyBar safety={v.safety} />
                <span className="meta-sep" />
                <span>change date {fmtDate(e.changeDate)} <PleTag /></span>
                <Button variant="link" onClick={() => setDrawer(true)}>PLE details <PleTag /></Button>
              </>
            )}
            {!e && <><span className="meta-sep" /><span>Detected by {typeLabel(v.live[0]?.analysisType)}</span></>}
          </div>
        </div>
        <div className="actions">
          {v.campaigns[0] && <Button onClick={() => navigate(`/app/cm/campaigns/${v.campaigns[0].id}`)}>View campaign</Button>}
          {g.type === 'C' && g.skill?.status !== 'ready' && <Button onClick={() => navigate(skillPath(g))}>Review skill</Button>}
          <Button variant="primary" disabled={!v.open.some((f) => f.status === 'Open')} onClick={() => navigate(planPath(g))}>Create campaign</Button>
        </div>
      </div>
      {e && (
        <Container>
          <Meter value={v.found.length} total={v.resources.length} label={<>{v.found.length} of {v.resources.length} affected {u} found in your code <PleTag /></>} tone="progress" />
          {v.safety.tone === 'warn' && <p className="warn-line small" style={{ marginTop: 10 }}><Icon.warn /> {v.safety.detail}</p>}
        </Container>
      )}
      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'findings' && (
        <>
          <div className="filters">
            <span className="muted small">{sel.length ? `${sel.length} selected` : 'Select findings to edit the group'}</span>
            <span className="grow" />
            <Button disabled={!sel.length} onClick={() => { dispatch({ type: 'PLE_MOVE_FINDINGS', findingIds: sel, toGroupId: null }); notify(`${sel.length} finding(s) removed from the group. They're now standalone.`); setSelected([]); }}>
              Remove from group
            </Button>
            <Button disabled={!sel.length || sel.length === g.findingIds.length} onClick={() => { dispatch({ type: 'PLE_GROUP_SPLIT', groupId: g.id, findingIds: sel }); notify(`Split ${sel.length} finding(s) into a new group.`); setSelected([]); }}>
              Split group
            </Button>
            <Button disabled={!sel.length} onClick={() => setMoveOpen(true)}>Merge with…</Button>
            <Button disabled={!sel.length} onClick={() => setDismiss(sel)}>Dismiss</Button>
          </div>
          <Table columns={findingCols} rows={v.findings} selectable selected={sel} onSelect={setSelected} empty="No findings in this group." />
        </>
      )}

      {tab === 'repos' && (
        <Table
          rowKey={(r) => r}
          columns={[
            { id: 'r', header: 'Repository', cell: (r) => <strong>{r}</strong> },
            { id: 'f', header: 'Findings', cell: (r) => v.live.filter((f) => f.repo === r).length },
            ...(e ? [{ id: 'fn', header: U, cell: (r) => v.found.filter((x) => x.repo === r).length }] : []),
            { id: 's', header: 'Status', cell: (r) => (runFor(r) ? <Status value={runFor(r).status} /> : <span className="muted">Not started</span>) },
            { id: 'a', header: '', cell: (r) => <Link onClick={() => navigate(planPath(g), { repo: r })}>Remediate this repository</Link> },
          ]}
          rows={v.repos}
        />
      )}

      {tab === 'resources' && e && (
        <Table
          rowKey={(r) => r.arn}
          columns={[
            { id: 'arn', header: 'Resource ARN', cell: (r) => <span className="mono small">{r.arn}</span> },
            { id: 'acct', header: 'Account', cell: (r) => r.account },
            { id: 'repo', header: 'Repository', cell: (r) => r.repo ?? <span className="muted">Not found</span> },
            { id: 'h', header: 'AWS Health status', cell: (r) => <Status value={r.status} /> },
          ]}
          rows={v.resources}
        />
      )}

      {tab === 'notfound' && e && (
        <Container
          header={`Not found in your code (${v.notFound.length})`}
          description="These resources are in the PLE but AWS Transform couldn't match them to code."
          actions={<Button onClick={() => navigate('/app/ple/provider')}>Connect more repositories</Button>}
        >
          <Table
            rowKey={(r) => r.arn}
            columns={[
              { id: 'arn', header: 'Resource ARN', cell: (r) => <span className="mono small">{r.arn}</span> },
              { id: 'why', header: 'Likely reason', cell: () => 'Deployed outside infrastructure-as-code, or repository not connected.' },
              { id: 'h', header: 'AWS Health status', cell: (r) => <Status value={r.status} /> },
            ]}
            rows={v.notFound}
            empty="Every affected resource was found in your code."
          />
        </Container>
      )}

      {drawer && e && <PleDrawer event={e} onClose={() => setDrawer(false)} />}
      {moveOpen && <MoveModal findingIds={sel} fromGroup={g} onClose={() => { setMoveOpen(false); setSelected([]); }} />}
      {dismiss && <DismissModal ids={dismiss} onClose={() => { setDismiss(null); setSelected([]); }} />}
    </div>
  );
}

export function PleDrawer({ event, onClose }) {
  const { state, notify } = useStore();
  const pending = event.resources.filter((r) => r.status === 'PENDING').length;
  const resolved = event.resources.length - pending;
  const accounts = new Set(event.resources.map((r) => r.account));
  const u = unit(event, 2);
  const syncedMin = Math.max(0, Math.round((Date.now() - new Date(state.ple.lastHealthSync).getTime()) / 60000));
  const ago = state.ple.lastHealthSync === '2026-10-26T07:40' ? '2 hours ago' : syncedMin < 1 ? 'just now' : `${syncedMin} min ago`;
  return (
    <Drawer title={event.title} onClose={onClose}>
      <div className="field-label">Event ARN</div>
      <CopyText mono text={event.arn} notify={notify} />
      <h3 className="drawer-h">Key facts</h3>
      <KeyValue
        columns={2}
        items={[
          ['Change date', <ChangeDate iso={event.changeDate} />],
          ['Regions', TENANT.region],
          ['Accounts', accounts.size],
          ['Affected resources', `${event.resources.length} (${pending} PENDING, ${resolved} RESOLVED)`],
        ]}
      />
      <p className="muted small" style={{ marginTop: 10 }}>Last updated from AWS Health: {ago}</p>
      <h3 className="drawer-h">What's changing</h3>
      <p className="pre">{event.description}</p>
      <h3 className="drawer-h">What AWS Transform will do</h3>
      <p>
        {event.td
          ? `Upgrade the code behind these ${u} using ${event.tdLabel} (AWS-managed transformation) and open pull requests.`
          : `Use a specialized skill for ${shortTitle(event)}, tested on held-out repositories, to upgrade the code behind these ${u} and open pull requests.`}
      </p>
      <Link onClick={() => navigate(`/console/health/${event.id}`)}>Open in AWS Health</Link>
      <p className="muted small" style={{ marginTop: 8 }}>Last checked {fmtDateTime(state.ple.lastHealthSync)}</p>
    </Drawer>
  );
}

export function MoveModal({ findingIds, fromGroup, onClose }) {
  const { state, dispatch, notify } = useStore();
  const others = state.ple.groups.filter((o) => o.id !== fromGroup?.id && o.findingIds.length > 0);
  const [into, setInto] = useState(others[0]?.id ?? '__standalone');
  const target = others.find((o) => o.id === into);
  const pleIds = new Set(state.findings.filter((f) => findingIds.includes(f.id)).map((f) => f.pleId ?? null));
  const mismatch = target && [...pleIds].some((p) => p !== target.pleId);
  return (
    <Modal
      title={`Move ${findingIds.length} finding${findingIds.length > 1 ? 's' : ''} to a group`}
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            onClick={() => {
              dispatch({ type: 'PLE_MOVE_FINDINGS', findingIds, toGroupId: target ? target.id : null });
              notify(target ? `Moved to ${target.shortName}.` : 'Moved to standalone findings.');
              onClose();
            }}
          >
            Move
          </Button>
        </>
      }
    >
      <FormField label="Move to">
        <Select
          value={into}
          onChange={setInto}
          options={[...others.map((o) => ({ value: o.id, label: o.pleId ? `${o.shortName} (AWS Health PLE)` : o.shortName, description: groupTypeLabel(o.type) })), { value: '__standalone', label: 'Standalone (no group)' }]}
        />
      </FormField>
      {mismatch && <Alert type="warning">These findings come from a different source than the target group. The target group's transformation or skill will be applied to them.</Alert>}
    </Modal>
  );
}

const DISMISS_REASONS = ['Accepted risk', 'False positive', 'Handled outside AWS Transform', 'Resource will be deleted'];

export function DismissModal({ ids, onClose }) {
  const { dispatch, notify } = useStore();
  const [reason, setReason] = useState('');
  const [note, setNote] = useState('');
  return (
    <Modal
      title={`Dismiss ${ids.length} finding${ids.length > 1 ? 's' : ''}`}
      onClose={onClose}
      footer={
        <>
          <Button variant="link" onClick={onClose}>Cancel</Button>
          <Button
            variant="primary"
            disabled={!reason}
            onClick={() => {
              dispatch({ type: 'DISMISS_FINDINGS', ids });
              ids.forEach((fid) => dispatch({ type: 'SET_NOTE', id: fid, notes: `Dismissed: ${reason}${note ? ` — ${note}` : ''}` }));
              notify(`${ids.length} finding(s) dismissed.`);
              onClose();
            }}
          >
            Dismiss
          </Button>
        </>
      }
    >
      <FormField label="Reason">
        <Select value={reason} onChange={setReason} placeholder="Choose a reason" options={DISMISS_REASONS.map((r) => ({ value: r, label: r }))} />
      </FormField>
      <FormField label="Note" secondary="optional">
        <textarea className="input textarea" rows={3} value={note} onChange={(ev) => setNote(ev.target.value)} />
      </FormField>
      <p className="muted small">Dismissing a PLE finding doesn't change AWS Health. The resource stays PENDING until it changes.</p>
    </Modal>
  );
}

/** Screen 11: a new PLE arrived (and may match an existing campaign). */
export function NewPleBanner() {
  const { state, dispatch, notify } = useStore();
  const n = state.ple.newEvent;
  if (!n) return null;
  const event = eventById(n.eventId);
  const g = state.ple.groups.find((x) => x.id === n.groupId);
  if (!event || !g) return null;
  const v = groupView(state, g);
  const camp = event.campaignMatch && state.ple.campaigns.find((c) => c.id === event.campaignMatch);
  return (
    <>
      <Alert
        type="success"
        title="New PLE found in your code"
        action={
          <div className="actions">
            <Button variant="primary" onClick={() => navigate(planPath(g))}>Create campaign</Button>
            <button type="button" className="icon-btn" aria-label="Dismiss" onClick={() => dispatch({ type: 'PLE_DISMISS_NEW' })}><Icon.close /></button>
          </div>
        }
      >
        {event.title} · due {fmtDate(event.changeDate)} · {v.repos.length} repositories
      </Alert>
      {camp && (
        <Alert
          type="info"
          title={`Add to campaign '${camp.name}'?`}
          action={
            <div className="actions">
              <Button onClick={() => { dispatch({ type: 'PLE_ADD_GROUP_TO_CAMPAIGN', campaignId: camp.id, groupId: g.id, now: Date.now() }); notify(`Added ${g.shortName} to '${camp.name}'.`); navigate(`/app/cm/campaigns/${camp.id}`); }}>Add</Button>
              <Button variant="link" onClick={() => navigate(planPath(g))}>New campaign</Button>
            </div>
          }
        >
          This PLE matches the campaign's target state: <em>{camp.target}</em>.
        </Alert>
      )}
    </>
  );
}
