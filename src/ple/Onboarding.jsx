import React, { useEffect, useState } from 'react';
import { fmtDate, TENANT, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import {
  Alert, Breadcrumbs, Button, FormField, Icon, Input, Link, Radio, Select,
} from '../components/ui';
import { ACCOUNT_ENV, CAMPAIGN_NAMES, ORG, ORG_REPOS, UNREADABLE } from './data';
import { CM_CUSTOMER_KEY } from './reducer';
import {
  byDeadline, deepLink, deepLinkMulti, DemoPanel, DueIn, EventHeader, eventsTitle, fixable, fromName, MultiEventHeader, noticeTitle, targetName, unit, unitFor,
} from './common';

// Screens 2–5: deep-link Get started page (one event or several), then the four-step setup.

export function PleOnboarding({ step, query }) {
  if (step === 'welcome') return query.events ? <MultiWelcome query={query} /> : <Welcome query={query} />;
  return <SetupWizard step={step} />;
}

// The event(s) the user came from AWS Health for, nearest deadline first.
function useEntryEvents() {
  const { state } = useStore();
  const ids = state.ple.entryEventIds?.length ? state.ple.entryEventIds : [state.ple.entryEventId].filter(Boolean);
  return byDeadline(state.ple.events.filter((e) => ids.includes(e.id)));
}

const groupIdFor = (eventId) => `G-${eventId}`;

// ---- Screen 2 --------------------------------------------------------------

function Welcome({ query }) {
  const { state, dispatch, notify } = useStore();
  const [showAll, setShowAll] = useState(false);
  const event = state.ple.events.find((e) => e.arn === query.event);
  const accounts = event ? [...new Set(event.resources.map((r) => r.account))] : [];
  const visible = event && accounts.includes(query.account);

  useEffect(() => {
    if (!visible) return;
    dispatch({ type: 'PLE_SET_ENTRY', eventId: event.id });
    // Existing CM customer: skip setup, land on this PLE's group.
    if (state.ple.onboarded) navigate('/app/cm/findings', { tab: 'ple', highlight: groupIdFor(event.id) });
  }, [visible, event?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!event) {
    return (
      <div className="page narrow-wide">
        <Alert type="error" title="We couldn't open this PLE">
          The link doesn't match a planned lifecycle event. <Link onClick={() => navigate('/console/health')}>Return to AWS Health</Link>
        </Alert>
      </div>
    );
  }
  if (!visible) {
    return (
      <div className="page narrow-wide">
        <h1 className="page-title">Remediate with AWS Transform</h1>
        <Alert
          type="error"
          title={`This PLE isn't available in account ${query.account}`}
          action={
            <div className="actions">
              <Button onClick={() => notify('Account switcher would open here (mock).', 'info')}>Switch accounts</Button>
              <Button onClick={() => navigate(`/console/health/${event.id}`)}>Return to AWS Health</Button>
            </div>
          }
        >
          Switch accounts or return to AWS Health and open the PLE from an account it affects ({accounts.join(', ')}).
        </Alert>
      </div>
    );
  }

  const n = event.resources.length;
  const u = unit(event, n);
  const U = `${u.charAt(0).toUpperCase()}${u.slice(1)}`;
  const g = state.ple.groups.find((x) => x.pleId === event.id);
  const mappedSet = g ? new Set(state.findings.filter((f) => g.findingIds.includes(f.id)).flatMap((f) => f.functions ?? [])) : new Set();
  const connected = state.ple.setup.repos.length > 0;
  const shown = showAll ? event.resources : event.resources.slice(0, 10);
  const deadline = new Date(`${event.changeDate}T12:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const statusOf = (r) =>
    r.status === 'RESOLVED' ? ['ok', 'Resolved'] : mappedSet.has(r.name) ? ['ok', 'Matched to code'] : g ? ['warn', 'Not found in code'] : connected ? ['wait', 'Checking code'] : ['wait', 'Waiting for code'];
  const acct = (a) => `${ACCOUNT_ENV[a] ? `${ACCOUNT_ENV[a]} · ` : ''}${a.slice(0, 4)}…${a.slice(-4)}`;
  const steps = [
    ['Connect your source', `GitHub, GitLab or Bitbucket. Only the organization behind these ${u}.`],
    ['We find the affected code', `Each ${u.replace(/s$/, '')} matched to its repository and file. Read-only. Takes minutes.`],
    ['Review the plan and keep it current', 'One pull request per repository. Nothing merges until your teams approve.'],
  ];
  return (
    <div className="page get-started">
      <Breadcrumbs items={[{ label: 'AWS Health', onClick: () => navigate(`/console/health/${event.id}`) }, { label: noticeTitle(event) }]} />
      <EventHeader event={event} />
      <section className="gs-card">
        <div className="gs-main">
          <div className="gs-eyebrow">Get started</div>
          <h1>
            Upgrade {n} {u} to {targetName(event)} before {deadline}
          </h1>
          <p className="gs-desc">
            Connect the repositories behind these {u}. AWS Transform finds the code for each one, shows exactly what needs to change, and opens pull requests once
            you approve.
          </p>
          <ol className="gs-steps">
            {steps.map(([t, d], i) => (
              <li key={t} className={i === (connected ? 1 : 0) ? 'current' : i < (connected ? 1 : 0) ? 'done' : ''}>
                <span className="gs-num">{i < (connected ? 1 : 0) ? <Icon.check /> : i + 1}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="primary" className="gs-cta" onClick={() => navigate(connected ? '/app/ple/analyze' : '/app/ple/connect')}>
            {connected ? 'Continue setup' : 'Connect and find code'}
          </Button>
        </div>
        <aside className="gs-side">
          <div className="gs-side-head">
            <span className="gs-eyebrow muted-eyebrow">Affected {u} ({n})</span>
            <span className="muted small">{mappedSet.size} of {n} matched to code</span>
          </div>
          <div className="gs-table">
            <table className="table plain">
              <thead>
                <tr><th>{U.replace(/s$/, '')}</th><th>Account</th><th>Status</th></tr>
              </thead>
              <tbody>
                {shown.map((r) => {
                  const [tone, label] = statusOf(r);
                  return (
                    <tr key={r.arn}>
                      <td><Link onClick={() => navigate(`/console/health/${event.id}`, { tab: 'resources' })}>{r.name}</Link></td>
                      <td>{acct(r.account)}</td>
                      <td><span className={`gs-status gs-${tone}`}><span className="dot" /> {label}</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {n > 10 && <div className="gs-more"><Link onClick={() => setShowAll((x) => !x)}>{showAll ? 'Show fewer' : `Show all ${n}`}</Link></div>}
        </aside>
      </section>
      <p className="gs-foot"><Icon.refresh /> Once these are upgraded, AWS Transform can keep them current, so the next end-of-support notice is handled before it reaches you.</p>
      {!connected && <OtherEvents event={event} />}
    </div>
  );
}

// Other fixable lifecycle events in the account, so one setup can cover them all.
function OtherEvents({ event }) {
  const { state } = useStore();
  const others = state.ple.events.filter((e) => e.id !== event.id && fixable(e));
  if (!others.length) return null;
  const byUnit = others.reduce((m, e) => {
    const u = unit(e, 2);
    m[u] = (m[u] ?? 0) + e.resources.length;
    return m;
  }, {});
  const same0 = Object.keys(byUnit).length === 1 && unit(event, 2) === Object.keys(byUnit)[0];
  const counts = Object.entries(byUnit).map(([u, n]) => `${n}${same0 ? ' other' : ''} ${n === 1 ? u.replace(/s$/, '') : u}`);
  const names = others.map(fromName);
  const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0]);
  const all = [event, ...others].reduce((n, e) => n + e.resources.length, 0);
  const same = same0;
  return (
    <div className="gs-others">
      <span>
        <strong>{others.length} more lifecycle {others.length === 1 ? 'event' : 'events'}</strong> from AWS Health affect {list(counts)} ({list(names)}).
      </span>
      <Link onClick={() => navigate(deepLinkMulti(byDeadline([event, ...others]), TENANT.account).slice(1))}><strong>Upgrade all {all}{same ? '' : ' resources'} instead</strong></Link>
    </div>
  );
}

// ---- Screen 2b: several events at once ---------------------------------------
// "Upgrade N" from AWS Health covers every fixable event: one setup, plans
// grouped by runtime and approved one at a time, nearest deadline first.

const CHIP_LIMIT = 10;

function MultiWelcome({ query }) {
  const { state, dispatch } = useStore();
  const [open, setOpen] = useState({});
  const ids = query.events.split(',');
  const events = byDeadline(state.ple.events.filter((e) => ids.includes(e.id) && fixable(e)));
  const first = events[0];

  useEffect(() => {
    if (!first) return;
    dispatch({ type: 'PLE_SET_ENTRY', eventId: first.id, eventIds: events.map((e) => e.id) });
    if (state.ple.onboarded) navigate('/app/cm/findings', { tab: 'ple' });
  }, [query.events]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!first) {
    return (
      <div className="page narrow-wide">
        <Alert type="error" title="We couldn't open these PLEs">
          The link doesn't match any planned lifecycle events AWS Transform can upgrade. <Link onClick={() => navigate('/console/health')}>Return to AWS Health</Link>
        </Alert>
      </div>
    );
  }

  const all = events.flatMap((e) => e.resources);
  const n = all.length;
  const u = unitFor(events, n);
  const one = unitFor(events, 1);
  const lambdaOnly = events.every((e) => e.service === 'Lambda');
  const groups = state.ple.groups.filter((g) => events.some((e) => e.id === g.pleId));
  const findingIds = new Set(groups.flatMap((g) => g.findingIds));
  const mapped = new Set(state.findings.filter((f) => findingIds.has(f.id)).flatMap((f) => f.functions ?? [])).size;
  const connected = state.ple.setup.repos.length > 0;
  const cur = connected ? 1 : 0;
  const steps = [
    ['Connect your source', `GitHub, GitLab or Bitbucket. Only the organization behind these ${u}.`],
    ['We find the affected code', `Each ${one} matched to its repository and file. Read-only. Takes minutes.`],
    ['Review the plan and keep it current', 'One pull request per repository, nearest deadline first. Nothing merges until your teams approve.'],
  ];
  return (
    <div className="page get-started">
      <Breadcrumbs items={[{ label: 'AWS Health', onClick: () => navigate('/console/health') }, { label: eventsTitle(events) }]} />
      <MultiEventHeader events={events} />
      <section className="gs-card">
        <div className="gs-main">
          <div className="gs-eyebrow">Get started</div>
          <h1>Upgrade {n} {u} before their {lambdaOnly ? 'runtimes' : 'versions'} reach end of support</h1>
          <p className="gs-desc">
            Connect the repositories behind these {u}. AWS Transform finds the code for each one and plans the upgrades together, nearest deadline first. Pull
            requests open only once you approve.
          </p>
          <ol className="gs-steps">
            {steps.map(([t, d], i) => (
              <li key={t} className={i === cur ? 'current' : i < cur ? 'done' : ''}>
                <span className="gs-num">{i < cur ? <Icon.check /> : i + 1}</span>
                <div>
                  <strong>{t}</strong>
                  <p>{d}</p>
                </div>
              </li>
            ))}
          </ol>
          <Button variant="primary" className="gs-cta" onClick={() => navigate(connected ? '/app/ple/analyze' : '/app/ple/connect')}>
            {connected ? 'Continue setup' : 'Connect and find code'}
          </Button>
        </div>
        <aside className="gs-side">
          <div className="gs-side-head">
            <span className="gs-eyebrow muted-eyebrow">Affected {u} ({n})</span>
            <span className="muted small">{mapped} of {n} matched to code</span>
          </div>
          <div className="rt-cards">
            {events.map((e, i) => {
              const k = e.resources.length;
              const shown = open[e.id] ? e.resources : e.resources.slice(0, CHIP_LIMIT);
              return (
                <div key={e.id} className={`rt-card ${i === 0 ? 'next' : ''}`}>
                  <div className="rt-card-head">
                    <span className="ver-old">{fromName(e)}</span> <span className="arrow">→</span> <span className="ver-new">{targetName(e)}</span>
                    <span className="muted">· {k} {unit(e, k)}</span>
                    <span className="grow" />
                    <span>{fmtDate(e.changeDate)}</span> <DueIn iso={e.changeDate} next={i === 0} />
                  </div>
                  <div className="rt-chips">
                    {shown.map((r) => (
                      <a key={r.arn} className={`rt-chip ${r.status === 'RESOLVED' ? 'done' : ''}`} onClick={() => navigate(`/console/health/${e.id}`, { tab: 'resources' })}>{r.name}</a>
                    ))}
                    {k > CHIP_LIMIT && (
                      <Link onClick={() => setOpen((o) => ({ ...o, [e.id]: !o[e.id] }))}>{open[e.id] ? 'Show fewer' : `+${k - CHIP_LIMIT} more`}</Link>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </aside>
      </section>
      <p className="gs-foot"><Icon.refresh /> Once these are upgraded, AWS Transform keeps them current, so the next end-of-support notice is handled before it reaches you.</p>
    </div>
  );
}

// ---- Screens 3–6: setup ------------------------------------------------------
// Four steps with the event(s) pinned on top: 1 connect source (provider, token
// and AWS Health access on one page), 2 find the affected code, 3 review the plan
// (read-only, generated from the search; nothing is created), 4 schedule
// continuous analysis and open pull requests. The access token lives only in
// ConnectStep's state and is cleared on connect; the mock never stores or sends it.

const SETUP_STEPS = [
  { id: 'connect', title: 'Connect source' },
  { id: 'analyze', title: 'Find affected code' },
  { id: 'plan', title: 'Review the plan' },
  { id: 'schedule', title: 'Schedule and open pull requests' },
];

const PROVIDERS = [
  { value: 'GitHub', label: 'GitHub', description: 'An organization or user on github.com.' },
  { value: 'GitLab', label: 'GitLab', description: 'A group or user on GitLab.com or self-managed.' },
  { value: 'Bitbucket', label: 'Bitbucket', description: 'A Cloud workspace or Data Center project.' },
];

const PROVIDER_COPY = {
  GitHub: {
    org: 'Organization', token: 'Personal access token', placeholder: 'Paste your personal access token',
    scopes: [['read:org', 'lists the repositories in your organization.'], ['repo', 'reads code for analysis, and opens pull requests only for remediations you start.']],
  },
  GitLab: {
    org: 'Group', token: 'Group access token', placeholder: 'Paste your group access token',
    scopes: [['read_api', 'lists the projects in your group.'], ['write_repository', 'reads code for analysis, and pushes branches only for remediations you start.']],
  },
  Bitbucket: {
    org: 'Workspace', token: 'Workspace access token', placeholder: 'Paste your workspace access token',
    scopes: [['repository:write', 'reads code for analysis, and pushes branches only for remediations you start.'], ['pullrequest:write', 'opens pull requests only for remediations you start.']],
  },
};

// Repos that sit behind org admin approval in the "approval needed" state.
const NEEDS_APPROVAL = ORG_REPOS.filter((r) => /^(admin|billing|card|chargeback|config|customer|data|design|dev|docs|dispute)/.test(r));

const shortAcct = (a) => `${ACCOUNT_ENV[a] ? `${ACCOUNT_ENV[a]} · ` : ''}${a.slice(0, 4)}…${a.slice(-4)}`;
const list = (xs) => (xs.length > 1 ? `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}` : xs[0] ?? '');

// Counts and nouns shared by every setup step.
function scopeOf(events) {
  const resources = events.flatMap((e) => e.resources);
  const n = resources.length;
  return {
    multi: events.length > 1,
    n,
    u: events.length ? unitFor(events, n) : 'resources',
    one: events.length ? unitFor(events, 1) : 'resource',
    accounts: new Set(resources.map((r) => r.account)).size,
    service: events.every((e) => e.service === events[0]?.service) ? events[0]?.service ?? 'AWS' : 'AWS',
  };
}

const getStartedPath = (events) =>
  events.length ? (events.length > 1 ? deepLinkMulti(events, TENANT.account) : deepLink(events[0], TENANT.account)).slice(1) : '/app/cm/dashboard';

export function SetupWizard({ step }) {
  const { state } = useStore();
  const events = useEntryEvents();
  const connected = state.ple.setup.repos.length > 0;
  const searched = state.ple.analysis?.status === 'done';
  // Older step ids (provider, token, source, repos, health, review) land on step 1.
  let current = SETUP_STEPS.some((s) => s.id === step) ? step : 'connect';
  if (current !== 'connect' && !connected) current = 'connect';
  if ((current === 'plan' || current === 'schedule') && !searched) current = 'analyze';
  const idx = SETUP_STEPS.findIndex((s) => s.id === current);
  const reached = !connected ? 0 : !searched ? 1 : 3;
  const { multi } = scopeOf(events);
  const back = getStartedPath(events);
  const title = events.length ? (multi ? eventsTitle(events) : noticeTitle(events[0])) : null;

  return (
    <div className="page get-started setup">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          ...(title ? [{ label: title, onClick: () => navigate(back) }] : []),
          { label: SETUP_STEPS[idx].title },
        ]}
      />
      {multi ? <MultiEventHeader events={events} compact /> : <EventHeader event={events[0]} />}
      <div className="setup-layout">
        <nav className="setup-nav step-list" aria-label="Steps">
          {SETUP_STEPS.map((s, i) => (
            <div key={s.id} className={`step-item ${i === idx ? 'current' : ''}`} aria-current={i === idx ? 'step' : undefined}>
              <span className="muted small">Step {i + 1}</span>
              {i !== idx && i <= reached ? <Link onClick={() => navigate(`/app/ple/${s.id}`)}>{s.title}</Link> : <span>{s.title}</span>}
            </div>
          ))}
        </nav>
        <div className="setup-main">
          {current === 'connect' && <ConnectStep events={events} back={back} />}
          {current === 'analyze' && <AnalyzeStep events={events} back={back} />}
          {current === 'plan' && <PlanStep events={events} back={back} />}
          {current === 'schedule' && <ScheduleStep events={events} back={back} />}
        </div>
      </div>
    </div>
  );
}

function SetupHead({ title, desc }) {
  return (
    <div className="setup-head">
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  );
}

function SetupActions({ note, back, previous, next, nextLabel, disabled }) {
  return (
    <div className="setup-actions">
      {note && <span className="muted">{note}</span>}
      <span className="grow" />
      <Button variant="link" onClick={() => navigate(back)}>Cancel</Button>
      {previous && <Button onClick={() => navigate(previous)}>Previous</Button>}
      <Button variant="primary" disabled={disabled} onClick={next}>{nextLabel}</Button>
    </div>
  );
}

// ---- Step 1: connect source ---------------------------------------------------

const POLICY = `{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Action": [
      "health:DescribeEvents",
      "health:DescribeEventDetails",
      "health:DescribeAffectedEntities",
      "health:DescribeEventsForOrganization",
      "health:DescribeAffectedEntitiesForOrganization"
    ],
    "Resource": "*"
  }]
}`;

function ConnectStep({ events, back }) {
  const { state, dispatch, notify } = useStore();
  const src = state.sources.find((s) => s.id === 'src-ple');
  const [provider, setProvider] = useState(state.ple.setup.provider ?? 'GitHub');
  const [org, setOrg] = useState(src?.org ?? '');
  const [token, setToken] = useState('');
  const [publicRepos, setPublicRepos] = useState(false);
  const [name, setName] = useState('');
  const [scope, setScope] = useState(state.ple.setup.scope && state.ple.setup.scope !== 'skipped' ? state.ple.setup.scope : 'org');
  const [editScope, setEditScope] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [infra, setInfra] = useState('managed');
  const [editInfra, setEditInfra] = useState(false);
  const [status, setStatus] = useState(null); // null | checking | failed | approval
  const [sim, setSim] = useState('ok');
  const [tried, setTried] = useState(false);
  const copy = PROVIDER_COPY[provider];
  const { multi, n, u, accounts } = scopeOf(events);
  const orgName = org.trim() || ORG;
  const suggested = `${orgName}-${provider.toLowerCase()}`;
  const sourceName = name.trim() || suggested;

  const nameTaken = state.sources.some((s) => s.name === sourceName && s.id !== 'src-ple');
  const errors = {
    token: !token.trim() ? `${copy.token} is required` : null,
    name: nameTaken ? 'A source with this name already exists' : !/^[A-Za-z0-9-]{1,64}$/.test(sourceName) ? 'Use 1–64 letters, numbers and hyphens' : null,
  };
  const err = (k) => (tried ? errors[k] : null);

  const finish = (repos) => {
    dispatch({ type: 'PLE_CONNECT_REPOS', provider, repos, name: sourceName, org: orgName, push: {} });
    dispatch({ type: 'PLE_HEALTH_ACCESS', scope, comprehensive: false });
    setToken('');
    notify(`${orgName} connected. ${repos.length} repositories found.`);
    navigate('/app/ple/analyze');
  };
  const connect = () => {
    setTried(true);
    if (errors.token || errors.name) return;
    setStatus('checking');
    setTimeout(() => (sim === 'ok' ? finish(ORG_REPOS) : setStatus(sim)), 900);
  };

  return (
    <>
      <SetupHead
        title="Connect your source code"
        desc={`Connect the organization that owns these ${n} ${u}. AWS Transform finds the code behind each one, then shows you the upgrade plan. Nothing in your repositories is changed.`}
      />
      <section className="setup-card">
        <h2>How this works</h2>
        <ol className="how-steps">
          {[
            ['Connect', `The organization that owns these ${u}. You can add more later.`],
            ['We find the affected code', `Each of the ${n} ${u} matched to its repository and file. Read-only. Takes minutes.`],
            ['Review the plan', 'One pull request per repository, and a schedule that catches the next event early.'],
          ].map(([t, d], i) => (
            <li key={t} className={i === 0 ? 'current' : ''}>
              <span className="gs-num">{i + 1}</span>
              <div>
                <strong>{t}</strong>
                <p className="muted">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
      <section className="setup-card">
        <h2>Provider</h2>
        <p className="muted card-desc">Where your repositories live.</p>
        <div className="radio-cards three">
          {PROVIDERS.map((p) => (
            <label key={p.value} className={`radio-card ${provider === p.value ? 'on' : ''}`}>
              <input type="radio" name="provider" checked={provider === p.value} onChange={() => { setProvider(p.value); setStatus(null); }} />
              <span>
                <span className="radio-label">{p.label}</span>
                <span className="radio-desc">{p.description}</span>
              </span>
            </label>
          ))}
        </div>
      </section>
      <section className="setup-card">
        <h2>Access</h2>
        <p className="muted card-desc">AWS Transform stores your token encrypted.</p>
        <div className="access-fields">
          <FormField label={copy.org}>
            <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder={ORG} />
          </FormField>
          <FormField label={copy.token} error={err('token')}>
            <Input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => { setToken(e.target.value); setStatus(null); }} placeholder={copy.placeholder} invalid={!!err('token')} />
          </FormField>
          <div className="scope-box">
            <Icon.info />
            <div>
              <strong>Why these scopes</strong>
              <ul>
                {copy.scopes.map(([k, v]) => (
                  <li key={k}><code>{k}</code> {v}</li>
                ))}
              </ul>
            </div>
          </div>
          <label className="checkbox block option">
            <input type="checkbox" checked={publicRepos} onChange={(e) => setPublicRepos(e.target.checked)} />
            <span>
              <span>Include public repositories</span>
              <span className="muted small">Off by default, so your first scan covers only the private repositories this token can see.</span>
            </span>
          </label>
          <FormField label="Source name" description="Suggested from your organization. 1–64 characters: letters, numbers and hyphens." error={err('name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={suggested} invalid={!!err('name')} />
          </FormField>
        </div>
        {status === 'failed' && (
          <Alert type="error" title={`We couldn't connect to ${provider}`}>
            The token was rejected. Check that it hasn't expired and has the scopes above, then connect again.
          </Alert>
        )}
        {status === 'approval' && (
          <Alert
            type="warning"
            title={`Your ${copy.org.toLowerCase()} needs an admin to approve AWS Transform`}
            action={<Button onClick={() => finish(ORG_REPOS.filter((r) => !NEEDS_APPROVAL.includes(r)))}>Continue with available repositories</Button>}
          >
            {NEEDS_APPROVAL.length} repositories need approval. You can continue with the {ORG_REPOS.length - NEEDS_APPROVAL.length} the token can read today and add the rest later.
          </Alert>
        )}
      </section>
      <section className="setup-card">
        <h2>AWS Health access</h2>
        <p className="muted card-desc">So AWS Transform can read {multi ? `these ${events.length} events’` : 'this event’s'} affected {u} and match them to your code. Read-only.</p>
        <div className="kv-rows">
          <div className="kv-row">
            <strong>Accounts</strong>
            <span>{scope === 'org' ? `All ${accounts} accounts with affected ${u}, through your organization` : `This account only (${shortAcct(TENANT.account)})`}</span>
            <Link onClick={() => setEditScope((x) => !x)}><strong>{editScope ? 'Done' : 'Change'}</strong></Link>
          </div>
          {editScope && (
            <div className="kv-edit">
              <Radio
                name="scope"
                value={scope}
                onChange={setScope}
                options={[
                  { value: 'org', label: 'All accounts in my organization', description: accounts > 1 ? `These ${n} ${u} are spread across ${accounts} accounts, so this is needed to find all of them.` : 'Needs organizational view turned on in AWS Health.' },
                  { value: 'account', label: 'This account only', description: `Only ${u} in this account are searched.` },
                ]}
              />
            </div>
          )}
          <div className="kv-row">
            <strong>Permissions</strong>
            <span>Read AWS Health events and affected resources</span>
            <Link onClick={() => setShowPolicy((x) => !x)}><strong>{showPolicy ? 'Hide policy' : 'View policy'}</strong></Link>
          </div>
          {showPolicy && <pre className="code-block">{POLICY}</pre>}
        </div>
      </section>
      <section className="setup-card slim">
        <div className="kv-row single">
          <span><strong>Where it runs</strong> <span className="muted">· {infra === 'managed' ? 'AWS managed. Nothing to deploy.' : 'In this AWS account. Deploys a CloudFormation stack.'}</span></span>
          <Link onClick={() => setEditInfra((x) => !x)}><strong>{editInfra ? 'Done' : 'Change'}</strong></Link>
        </div>
        {editInfra && (
          <div className="kv-edit">
            <Radio
              name="infra"
              value={infra}
              onChange={setInfra}
              options={[
                { value: 'managed', label: 'AWS managed', description: 'Nothing to deploy. AWS Transform runs the analysis for you.' },
                { value: 'account', label: 'In this AWS account', description: 'Deploys a CloudFormation stack, so code never leaves your account.' },
              ]}
            />
          </div>
        )}
      </section>
      <SetupActions
        note={`Next: we find the code behind these ${n} ${u}.`}
        back={back}
        next={connect}
        disabled={status === 'checking'}
        nextLabel={status === 'checking' ? 'Connecting…' : 'Connect and find code'}
      />
      <DemoPanel title="Simulate connect result (mock only)">
        <Select value={sim} onChange={setSim} options={[{ value: 'ok', label: 'Connects' }, { value: 'failed', label: 'Authorization fails' }, { value: 'approval', label: 'Admin approval needed' }]} />
      </DemoPanel>
    </>
  );
}

// ---- Step 2: find the affected code ---------------------------------------------

function AnalyzeStep({ events, back }) {
  const { state, dispatch } = useStore();
  const a = state.ple.analysis;
  const [details, setDetails] = useState(false);
  const repos = state.ple.setup.repos;
  const src = state.sources.find((s) => s.id === 'src-ple');

  useEffect(() => {
    if (a || !repos.length) return;
    dispatch({ type: 'PLE_START_ANALYSIS' });
  }, [a, repos.length, dispatch]);

  const done = a?.status === 'done';
  useEffect(() => {
    if (!done) return;
    try {
      window.localStorage.setItem(CM_CUSTOMER_KEY, '1');
    } catch {
      /* storage unavailable */
    }
  }, [done]);

  const { multi, n, u } = scopeOf(events);
  const orgName = src?.org ?? ORG;
  const total = repos.length;
  const checked = a?.done ?? 0;
  const seen = new Set([...repos].sort().slice(0, checked));
  const rows = events.flatMap((e) =>
    e.resources.map((r) => {
      const fx = r.repo ? e.repos.find((x) => x.repo === r.repo) : null;
      const found = fx && (done || seen.has(fx.repo)) && !a?.unreadable.includes(fx.repo);
      return { r, e, fx, state: found ? 'found' : done ? 'missing' : 'searching' };
    }),
  );
  const found = rows.filter((x) => x.state === 'found');
  const foundRepos = new Set(found.map((x) => x.fx.repo)).size;
  const covered = events.filter((e) => found.some((x) => x.e.id === e.id)).length;
  const others = byDeadline(state.ple.events.filter((e) => fixable(e) && !events.some((x) => x.id === e.id)));
  const reviewable = done && events.some((e) => state.ple.groups.some((g) => g.pleId === e.id));

  const desc = done
    ? `${found.length === n ? `All ${n}` : `${found.length} of ${n}`} found in ${foundRepos} ${foundRepos === 1 ? 'repository' : 'repositories'} in ${orgName}. Next, review the upgrade AWS Transform will make in each one.`
    : `Searching ${checked} of ${total} repositories in ${orgName}. Read-only: nothing in your repositories changes.`;
  const note = multi
    ? `The plan is ordered by deadline: ${events.map((e, i) => `${fromName(e)}${i === 0 ? ' first' : ''} (${fmtDate(e.changeDate)})`).join(', then ')}.`
    : others.length
      ? `${others.length} other lifecycle ${others.length === 1 ? 'event affects' : 'events affect'} these repositories: ${list(others.map((e) => `${fromName(e)} (${e.resources.length} ${unit(e, e.resources.length)}, ${fmtDate(e.changeDate)})`))}. You can resolve ${others.length === 1 ? 'it' : 'them'} after this one.`
      : null;

  return (
    <>
      <SetupHead title={`${done ? 'Here’s the code behind' : 'Finding the code behind'} these ${n} ${u}`} desc={desc} />
      <section className="ec-stats">
        <div><span>{u.charAt(0).toUpperCase() + u.slice(1)} found</span><strong>{found.length} <small>of {n}</small></strong></div>
        <div><span>Repositories</span><strong>{foundRepos}</strong></div>
        {multi ? (
          <div><span>Lifecycle events</span><strong>{covered} <small>{covered === events.length ? 'all covered' : `of ${events.length} covered`}</small></strong></div>
        ) : (
          <div><span>Also affected</span><strong>{others.length} <small>other {others.length === 1 ? 'event' : 'events'}</small></strong></div>
        )}
      </section>
      <section className="setup-card">
        <div className="search-head inline">
          <h2>Affected {u} ({n})</h2>
          {!done && <span className="search-bar"><span style={{ width: `${(checked / Math.max(total, 1)) * 100}%` }} /></span>}
        </div>
        <table className="table plain search-table">
          <thead>
            <tr>
              <th>{unitFor(events, 1).replace(/^./, (c) => c.toUpperCase())}</th>
              {multi && <th>Runtime</th>}
              <th>Account</th>
              <th>Code</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ r, e, fx, state: st }) => (
              <tr key={r.arn}>
                <td><strong>{r.name}</strong></td>
                {multi && <td>{fromName(e)}</td>}
                <td>{shortAcct(r.account)}</td>
                <td>
                  {st === 'found' && (
                    <span className="code-hit"><span className="hit-check"><Icon.check /></span> <Link>{orgName}/{fx.repo}</Link> <span className="muted">· {fx.file}</span></span>
                  )}
                  {st === 'searching' && <span className="muted code-hit"><Icon.spinner /> Searching…</span>}
                  {st === 'missing' && <span className="code-hit warn"><Icon.warn /> Not found in connected repositories</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
      {done && a.unreadable.length > 0 && (
        <>
          <Alert type="warning" action={<Button onClick={() => setDetails((d) => !d)}>{details ? 'Hide details' : 'View details'}</Button>}>
            {a.unreadable.length} repositories couldn't be read (access denied). Results exclude them.
          </Alert>
          {details && (
            <ul className="plain-list">
              {a.unreadable.map((r) => (
                <li key={r}><span className="mono">{orgName}/{r}</span> <span className="muted small">· 403: the token can't read this repository</span></li>
              ))}
            </ul>
          )}
        </>
      )}
      {done && note && <p className="info-note"><Icon.info /> {note}</p>}
      <SetupActions
        note={done ? null : 'You can leave this page. Progress stays under Continuous modernization.'}
        back={back}
        previous="/app/ple/connect"
        next={() => navigate('/app/ple/plan')}
        disabled={!reviewable}
        nextLabel="Review the plan"
      />
    </>
  );
}

// ---- Step 3: review the plan ------------------------------------------------------
// Generated from the search. Read-only: nothing is created until step 4.

const upgraded = (evidence, e) => {
  const from = { 'Node.js': ['16.x', '"16"', ' 16'], Python: ['3.10'], Java: ['11'] }[e.technology] ?? [];
  if (evidence.includes(e.from)) return evidence.replace(e.from, e.target);
  const to = { 'Node.js': '22', Python: '3.13', Java: '21' }[e.technology];
  const hit = from.find((f) => evidence.includes(f.trim()));
  return hit && to ? evidence.replace(hit.trim().replace('.x', '').replace(/"/g, ''), to) : null;
};

function usePlans(events) {
  const { state } = useStore();
  return events
    .map((e) => {
      const g = state.ple.groups.find((x) => x.pleId === e.id);
      const fs = g ? state.findings.filter((f) => g.findingIds.includes(f.id) && f.status !== 'Dismissed') : [];
      const repos = [...new Set(fs.map((f) => f.repo))].map((repo) => ({ repo, fns: e.resources.filter((r) => r.repo === repo).map((r) => r.name), changes: fs.filter((f) => f.repo === repo) }));
      return { e, g, repos, fns: repos.reduce((k, r) => k + r.fns.length, 0) };
    })
    .filter((p) => p.g && p.repos.length);
}

function PlanStep({ events, back }) {
  const plans = usePlans(events);
  const { multi, u } = scopeOf(events);
  const prs = plans.reduce((k, p) => k + p.repos.length, 0);
  const fns = plans.reduce((k, p) => k + p.fns, 0);
  return (
    <>
      <SetupHead
        title="Review the plan"
        desc={`${prs} pull requests for ${fns} ${u}, one per repository${multi ? ', nearest deadline first' : ''}. This is what AWS Transform will change. Nothing is created yet; pull requests open in the next step.`}
      />
      {plans.map(({ e, repos, fns: k }) => (
        <section key={e.id} className="setup-card flush">
          <div className="plan-head">
            <span className="ver-old">{fromName(e)}</span> <span className="arrow">→</span> <span className="ver-new">{targetName(e)}</span>
            <span className="muted">· {e.td ? <><code>{e.td}</code> (AWS-managed)</> : 'Specialized skill'} · due {fmtDate(e.changeDate)}</span>
            <span className="grow" />
            <span className="muted">{repos.length} pull {repos.length === 1 ? 'request' : 'requests'} · {k} {unit(e, k)}</span>
          </div>
          <table className="table plain plan-table">
            <thead>
              <tr><th>Repository</th><th>{unit(e, 2).replace(/^./, (c) => c.toUpperCase())}</th><th>What changes</th></tr>
            </thead>
            <tbody>
              {repos.map((r) => (
                <tr key={r.repo}>
                  <td><strong>{r.repo}</strong></td>
                  <td>{r.fns.join(', ') || <span className="muted">Supporting files</span>}</td>
                  <td>
                    {r.changes.map((f) => {
                      const to = upgraded(f.evidence, e);
                      return (
                        <div key={f.id} className="change-line">
                          <span className="mono small muted">{f.file}:{f.line}</span> <code>{f.evidence}</code>
                          {to && <> <span className="arrow">→</span> <code className="code-new">{to}</code></>}
                        </div>
                      );
                    })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
      <p className="info-note"><Icon.info /> Each change is validated by AWS Transform (build and unit tests) before its pull request opens. Nothing merges until your teams approve.</p>
      <SetupActions back={back} previous="/app/ple/analyze" next={() => navigate('/app/ple/schedule')} nextLabel="Schedule pull requests" />
    </>
  );
}

// ---- Step 4: schedule and open pull requests ---------------------------------------

const PlayIcon = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" strokeWidth="1.5" /><path d="M6.5 5.2v5.6L11 8z" fill="currentColor" /></svg>
);

const SCHEDULE_ORDER = ['ple', 'td-comprehensive', 'security', 'modernization', 'agentic'];
const scheduleLabel = (t) => (t === 'ple' ? 'Lifecycle events (AWS Health)' : typeLabel(t));
const RUNS = ['Daily', 'Weekly', 'Monthly'].map((v) => ({ value: v.toLowerCase(), label: v }));
const DAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'].map((v) => ({ value: v, label: v }));
const TIMES = ['00:00 PT', '06:00 PT', '09:00 PT', '12:00 PT', '18:00 PT'].map((v) => ({ value: v, label: v }));
const branchFor = (e) => `aws-transform/${e.target.replace(/\.x$/, '')}`;

function ScheduleStep({ events, back }) {
  const { state, dispatch, notify } = useStore();
  const plans = usePlans(events);
  const { multi, n, u, service } = scopeOf(events);
  const src = state.sources.find((s) => s.id === 'src-ple');
  const orgName = src?.org ?? ORG;
  const repoCount = state.ple.setup.repos.length;
  const [analyses, setAnalyses] = useState(state.ple.schedule?.analyses ?? [{ type: 'ple', cadence: 'weekly' }, { type: 'td-comprehensive', cadence: 'weekly' }]);
  const [day, setDay] = useState(state.ple.schedule?.day ?? 'Mondays');
  const [time, setTime] = useState(state.ple.schedule?.time ?? '06:00 PT');
  const [names, setNames] = useState(() => Object.fromEntries(plans.map(({ e }) => [e.id, CAMPAIGN_NAMES[e.id]?.[0] ?? `Upgrade ${fromName(e)}`])));
  const [editNames, setEditNames] = useState(false);
  const prs = plans.reduce((k, p) => k + p.repos.length, 0);
  const first = events[0];

  const why = (t) =>
    ({
      ple: [multi ? `These ${events.length} events needed a manual search.` : 'This event needed a manual search.', 'Staying connected to AWS Health means the next end-of-support notice arrives with its code already found and an upgrade plan ready.'],
      'td-comprehensive': [`${repoCount} repositories never analyzed.`, `Finds outdated dependencies and missing tests that would block ${multi ? 'these upgrades' : `the ${targetName(first)} pull requests`}, so they pass the first time.`],
      'td-quick': [`${repoCount} repositories never analyzed.`, 'A fast scan for outdated runtimes and dependencies.'],
      security: ['Not yet scanned.', 'Catches known CVEs, secrets and insecure code patterns before they reach production.'],
      modernization: ['Not yet assessed.', 'Shows which repositories are ready to move to modern runtimes, frameworks and AWS services.'],
      agentic: ['Not yet assessed.', 'Shows how well each repository supports agent-driven development and change.'],
    })[t] ?? ['', ''];
  const addable = SCHEDULE_ORDER.filter((t) => !analyses.some((a) => a.type === t));
  const setCadence = (type, cadence) => setAnalyses((xs) => xs.map((a) => (a.type === type ? { ...a, cadence } : a)));
  const summary = analyses.length ? `${analyses.map((a) => `${scheduleLabel(a.type)} ${a.cadence}`).join(', ')}, on ${day} at ${time}.` : 'None. You can schedule analyses later in Settings.';

  const launch = () => {
    const seq = state.seq;
    const setId = multi ? `S-${seq}` : null;
    plans.forEach(({ e, g }) =>
      dispatch({ type: 'PLE_START_CAMPAIGN', name: names[e.id], target: CAMPAIGN_NAMES[e.id]?.[1](e.target) ?? e.target, dueDate: e.changeDate, groupIds: [g.id], setId }),
    );
    dispatch({ type: 'PLE_SET_SCHEDULE', schedule: { analyses, day, time } });
    const readable = state.ple.setup.repos.filter((r) => !UNREADABLE.includes(r));
    analyses
      .filter((a) => a.type !== 'ple')
      .forEach((a) => dispatch({ type: 'START_ANALYSIS', analysisType: a.type, name: typeLabel(a.type), source: src?.name ?? ORG, repos: readable, infra: 'AWS managed', autoGroup: a.type.startsWith('td') }));
    notify(`${prs} pull requests are being prepared.${analyses.length ? ' Continuous analysis scheduled.' : ''}`);
    navigate(`/app/cm/campaigns/C-${seq}`);
  };

  return (
    <>
      <SetupHead
        title="Schedule and open pull requests"
        desc={`Here’s how we’ll resolve ${multi ? `these ${events.length} events` : 'this event'} and keep ${orgName} ahead of the next one. Change anything you need to.`}
      />
      <section className="setup-card">
        <h2>Continuous analysis for {orgName}</h2>
        <p className="muted card-desc">
          {multi ? 'These events' : 'This event'} won’t be the last. These start once the pull requests open, then re-run on their own, so the next notice arrives with its
          code already found and nothing blocks the fix. You’ll only hear about what’s new.
        </p>
        <table className="table plain sched-table">
          <thead>
            <tr><th>Analysis</th><th>Runs</th><th>Why this frequency</th><th aria-label="Remove" /></tr>
          </thead>
          <tbody>
            {analyses.map((a) => {
              const [lead, rest] = why(a.type);
              return (
                <tr key={a.type}>
                  <td><strong>{scheduleLabel(a.type)}</strong></td>
                  <td><Select compact width={120} value={a.cadence} onChange={(v) => setCadence(a.type, v)} options={RUNS} /></td>
                  <td className="wrap"><strong>{lead}</strong> {rest}</td>
                  <td><button type="button" className="icon-btn" aria-label={`Remove ${scheduleLabel(a.type)}`} onClick={() => setAnalyses((xs) => xs.filter((x) => x.type !== a.type))}>×</button></td>
                </tr>
              );
            })}
            {!analyses.length && (
              <tr><td colSpan={4} className="muted">No continuous analysis. The next notice will need a manual search again.</td></tr>
            )}
          </tbody>
        </table>
        {addable.length > 0 && (
          <div className="add-analysis">
            <span className="muted">Add an analysis:</span>
            {addable.map((t) => (
              <button key={t} type="button" className="add-chip" onClick={() => setAnalyses((xs) => [...xs, { type: t, cadence: 'weekly' }])}>+ {scheduleLabel(t)}</button>
            ))}
          </div>
        )}
        <div className="repeat-row">
          <strong>Repeat runs on</strong>
          <Select compact width={150} value={day} onChange={setDay} options={DAYS} />
          <span>at</span>
          <Select compact width={120} value={time} onChange={setTime} options={TIMES} />
          <span className="muted">· applies to every scheduled analysis</span>
        </div>
      </section>
      <section className="setup-card">
        <h2>Review</h2>
        <div className="starts-note">
          <PlayIcon />
          <span>
            <strong>Starts right away.</strong> The {prs} pull requests open as soon as each passes validation.
            {analyses.length > 0 && ' Continuous analysis starts after, then repeats on schedule.'}
          </span>
        </div>
        <dl className="review-grid">
          <div><dt>Source</dt><dd>{orgName} ({state.ple.setup.provider ?? 'GitHub'})</dd></div>
          <div><dt>Pull requests</dt><dd>{prs}, for all {n} {u}</dd></div>
          <div><dt>{multi ? 'Branches' : 'Branch'}</dt><dd className="mono">{multi ? 'aws-transform/<runtime>' : branchFor(first)}</dd></div>
          <div>
            <dt>{multi ? 'Campaigns' : 'Campaign'}</dt>
            <dd>
              {editNames ? (
                <div className="name-edits">
                  {plans.map(({ e }) => (
                    <Input key={e.id} value={names[e.id] ?? ''} onChange={(ev) => setNames((m) => ({ ...m, [e.id]: ev.target.value }))} />
                  ))}
                  <Link onClick={() => setEditNames(false)}><strong>Done</strong></Link>
                </div>
              ) : (
                <>
                  {multi ? `${plans.length}, one per event, nearest deadline first` : names[first.id]}{' '}
                  <Link onClick={() => setEditNames(true)}><strong>Edit</strong></Link>
                </>
              )}
            </dd>
          </div>
          <div className="span2">
            <dt>Done when</dt>
            <dd>
              {multi
                ? `${service} shows all ${n} ${u} on supported runtimes, and AWS Health marks all ${events.length} events resolved`
                : `${service} shows all ${n} ${u} on ${first.target}, and AWS Health marks the event resolved`}
            </dd>
          </div>
          <div className="span3"><dt>Continuous analysis</dt><dd>{summary}</dd></div>
        </dl>
      </section>
      <SetupActions
        back={back}
        previous="/app/ple/plan"
        next={launch}
        disabled={!plans.length || plans.some(({ e }) => !names[e.id]?.trim())}
        nextLabel={analyses.length ? 'Open pull requests and start analysis' : 'Open pull requests'}
      />
    </>
  );
}
