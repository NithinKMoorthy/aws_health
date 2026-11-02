import React, { useEffect, useState } from 'react';
import { fmtDate, TENANT, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import {
  Alert, Breadcrumbs, Button, FormField, Icon, Input, Link, Pagination, Radio, SearchInput, Select, Table,
} from '../components/ui';
import { daysLeft, MOCK_TODAY, ORG, ORG_REPOS, repoMeta, UNREADABLE } from './data';
import {
  byDeadline, deepLink, deepLinkMulti, DemoPanel, fixable, fromName, nextRunIso, targetName, unit, unitFor,
} from './common';

// Screens 2–5: deep-link Get started page (one event or several), then the three-step setup.

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

  return <GetStarted events={[event]} />;
}

// ---- Screen 2b: several events at once ---------------------------------------
// "Upgrade N" from the AWS Health banner covers every fixable event.

function MultiWelcome({ query }) {
  const { state, dispatch } = useStore();
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

  return <GetStarted events={events} />;
}

// The Get started page: why continuous modernization (left), and what AWS Health
// already lists on these accounts, nearest deadline first, then what's next (right).
const CHIPS = 3;

function GetStarted({ events }) {
  const { state } = useStore();
  const [layout, setLayout] = useSetupLayout();
  const all = events.flatMap((e) => e.resources);
  const n = all.length;
  const u = unitFor(events, n);
  const accountSet = new Set(all.map((r) => r.account));
  const inRequest = new Set(events.map((e) => e.id));
  // The requested events, then the other fixable events on the same accounts, by date.
  const coming = byDeadline([...events, ...state.ple.events.filter((e) => !inRequest.has(e.id) && fixable(e) && e.resources.some((r) => accountSet.has(r.account)))]);
  const total = coming.reduce((k, e) => k + e.resources.length, 0);
  const lambdaOnly = events.every((e) => e.service === 'Lambda');
  const connected = state.ple.setup.repos.length > 0;
  const cur = connected ? 1 : 0;
  const steps = [
    ['Connect your repositories', 'All of them, so the next change is covered too.'],
    ['Keep them continuously modern', 'Fix what’s due first. Weekly runs catch what’s next.'],
  ];
  return (
    <div className="page get-started">
      <Breadcrumbs
        items={[
          { label: 'AWS Health', onClick: () => navigate('/console/health') },
          { label: 'Scheduled changes', onClick: () => navigate('/console/health') },
          { label: 'Get started with AWS Transform' },
        ]}
      />
      <section className="gs-card">
        <div className="gs-main">
          <div className="gs-eyebrow">Get started</div>
          <h1>Keep your software estate continuously modern</h1>
          <p className="gs-desc">
            {n} of your {lambdaOnly ? `Lambda ${u} run on runtimes` : `${u} run on versions`} reaching end of support. AWS Transform upgrades them in code, nearest
            deadline first, then keeps watching for what’s next.
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
          <div className="gs-actions">
            <Button variant="primary" className="gs-cta" onClick={() => navigate(connected ? '/app/ple/analyze' : '/app/ple/connect')}>
              {connected ? 'Continue setup' : `Upgrade ${n} ${u}`}
            </Button>
            <Link external><strong>Learn more</strong></Link>
          </div>
          <p className="gs-foot">
            <Icon.refresh /> Beyond AWS Health, AWS Transform keeps every repository current on security, tech debt and modernization readiness.
          </p>
        </div>
        <aside className="gs-side">
          <div className="gs-side-head">
            <span className="gs-eyebrow muted-eyebrow">From AWS Health · {total} {unitFor(coming, total)}</span>
            <Link external onClick={() => navigate('/console/health')}><strong>View all</strong></Link>
          </div>
          <div className="gs-events">
            {coming.map((e, i) => (
              <EventCard key={e.id} event={e} first={i === 0} />
            ))}
            {UPCOMING.map((e) => (
              <EventCard key={e.id} event={e} upcoming />
            ))}
            <span className="gs-more-dots" aria-hidden="true" />
            <div className="gs-event future">
              <div>
                <strong>Every future AWS Health notice</strong>
                <p className="muted">Lambda runtimes, EKS versions, RDS engines, SDKs and more</p>
              </div>
              <span className="gs-badge gray">Code found automatically</span>
            </div>
          </div>
        </aside>
      </section>
      <DemoPanel>
        <LayoutToggle layout={layout} setLayout={setLayout} />
      </DemoPanel>
    </div>
  );
}

// Shown faded under the AWS Health events: the kind of change AWS Transform catches next.
const UPCOMING = [
  { id: 'eks-130', from: '1.30', target: '1.32', service: 'Amazon EKS', unitName: 'cluster', when: 'When announced', names: ['payments-prod', 'data-platform', 'risk-batch', 'ml-serving'], shown: 2 },
];

function EventCard({ event: e, first, upcoming }) {
  const names = upcoming ? e.names : e.resources.map((r) => r.name);
  const shown = upcoming ? names.slice(0, e.shown) : names.length > CHIPS ? names.slice(0, CHIPS) : names;
  const k = names.length;
  const d = upcoming ? null : daysLeft(e.changeDate);
  const badge = upcoming ? 'Upcoming' : first || d < 45 ? `${d} days left` : `In ${Math.round(d / 30.4)} months`;
  return (
    <div className={`gs-event ${first ? 'first' : ''} ${upcoming ? 'upcoming' : ''}`}>
      <div className="gs-event-head">
        <span className="ver-old">{upcoming ? e.from : fromName(e)}</span>
        <span className="arrow">→</span>
        <span className="ver-new">{upcoming ? e.target : targetName(e)}</span>
        <span className="muted">· {k} {unit(e, k)}</span>
        <span className="grow" />
        <span className={`gs-badge ${upcoming ? 'gray' : first ? 'orange' : 'blue'}`}>{badge}</span>
      </div>
      <div className="muted">{e.service} · {upcoming ? e.when : fmtDate(e.changeDate)}</div>
      <div className="gs-chips">
        {shown.map((name) => (
          <span key={name} className="gs-chip">{name}</span>
        ))}
        {!upcoming && k > shown.length && <span className="gs-chip">+{k - shown.length} more</span>}
      </div>
    </div>
  );
}

// ---- Setup: one page -----------------------------------------------------------
// Connect the repositories (provider, token, which repositories), choose the analyses
// that keep them current, where they run and pull request settings, then begin. Pull
// requests come later, from the event's campaign. The access token lives only in
// ConnectStep's state and is cleared on begin; the mock never stores or sends it.

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

// Prototype toggle: one setup page, or connect then analyses on two steps.
const SETUP_LAYOUT_KEY = 'atx-mock-setup-layout';
const readLayout = () => {
  try {
    return window.localStorage.getItem(SETUP_LAYOUT_KEY) === 'two' ? 'two' : 'one';
  } catch {
    return 'one';
  }
};
function useSetupLayout() {
  const [layout, setLayoutState] = useState(readLayout);
  const setLayout = (v) => {
    try {
      window.localStorage.setItem(SETUP_LAYOUT_KEY, v);
    } catch {
      /* storage unavailable */
    }
    setLayoutState(v);
  };
  return [layout, setLayout];
}

function LayoutToggle({ layout, setLayout }) {
  return (
    <div className="demo-row">
      <span>Setup layout</span>
      <Select compact width={170} value={layout} onChange={setLayout} options={[{ value: 'one', label: 'One page' }, { value: 'two', label: 'Two steps' }]} />
    </div>
  );
}

export function SetupWizard({ step }) {
  const { state } = useStore();
  const events = useEntryEvents();
  const back = getStartedPath(events);
  const [layout, setLayout] = useSetupLayout();
  const connected = state.ple.setup.repos.length > 0;
  // One page: every step id opens it. Two steps: analyses (and older ids for it) once connected.
  const second = layout === 'two' && connected && ['analyze', 'schedule', 'plan', 'choose'].includes(step);
  const label = layout === 'one' ? 'Set up' : second ? 'Keep them continuously modern' : 'Connect your repositories';
  return (
    <div className="page get-started setup setup-narrow">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: 'Get started', onClick: () => navigate(back) },
          { label },
        ]}
      />
      {second ? (
        <ScheduleStep key="schedule" events={events} back={back} toggle={<LayoutToggle layout={layout} setLayout={setLayout} />} />
      ) : (
        <ConnectStep events={events} back={back} mode={layout} toggle={<LayoutToggle layout={layout} setLayout={setLayout} />} />
      )}
    </div>
  );
}

// ---- Set up: connect, choose analyses, begin ---------------------------------------------------

const Tick = () => (
  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
);

// Wraps children in a div only when `on`, with optional leading content (the step number).
function Wrap({ on, className, lead, children }) {
  if (!on) return children;
  return (
    <div className={className}>
      {lead}
      {children}
    </div>
  );
}

// Pull request settings: blank means AWS Transform's defaults.
const PR_FIELDS = [
  {
    id: 'branch', label: 'Branch name template', placeholder: 'feature/atx/{PLACEHOLDER}',
    desc: 'Template for the branch AWS Transform pushes changes to. Include a {PLACEHOLDER} — replaced with the generated branch name.',
    hint: 'Must match your team’s branch-naming rule, or the push is rejected. Example: feature/atx/{PLACEHOLDER}',
    check: (v) => (/\{[^{}]*\}/.test(v) ? null : 'Include a {PLACEHOLDER}'),
  },
  {
    id: 'commit', label: 'Commit message template', placeholder: 'fix: {PLACEHOLDER}',
    desc: 'Template for the commit messages AWS Transform creates. Include a {PLACEHOLDER} — the text inside the braces is replaced with the generated commit summary.',
    hint: 'Must contain {} or {any text}. Example: fix: {PLACEHOLDER}',
    check: (v) => (/\{[^{}]*\}/.test(v) ? null : 'Must contain {} or {any text}'),
  },
  {
    id: 'authorName', label: 'Git commit author name', placeholder: 'AWS Transform',
    desc: 'Name used on commits AWS Transform pushes (git config user.name).',
    hint: 'Defaults to “ATX Bot”. For example: AWS Transform',
    check: () => null,
  },
  {
    id: 'authorEmail', label: 'Git commit author email', placeholder: 'atx-bot@yourcompany.com',
    desc: 'Email used on commits AWS Transform pushes (git config user.email).',
    hint: 'Must be an email your organization allows, or the push is rejected. Example: atx-bot@yourcompany.com',
    check: (v) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : 'Enter a valid email address'),
  },
];

function ConnectStep({ events, back, mode, toggle }) {
  const { state, dispatch, notify } = useStore();
  const src = state.sources.find((s) => s.id === 'src-ple');
  const [provider, setProvider] = useState(state.ple.setup.provider ?? 'GitHub');
  const [name, setName] = useState(src?.name ?? '');
  const [org, setOrg] = useState(src?.org ?? '');
  const [token, setToken] = useState('');
  const prior = state.ple.setup.repos;
  const [verify, setVerify] = useState(prior.length ? 'ok' : null); // null | missing | checking | ok | failed | approval
  const [repos, setRepos] = useState(prior.length ? ORG_REPOS : []); // what the token can see
  const [pick, setPick] = useState(prior.length && prior.length < ORG_REPOS.length ? 'choose' : 'all');
  const [includePrivate, setIncludePrivate] = useState(true);
  const [chosen, setChosen] = useState(prior.length ? prior : []);
  const [editRepos, setEditRepos] = useState(false);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [prOpen, setPrOpen] = useState(false);
  const [pr, setPr] = useState(state.ple.setup.push ?? {});
  const [sim, setSim] = useState('ok');
  const [tried, setTried] = useState(false);
  const copy = PROVIDER_COPY[provider];
  const { n, u } = scopeOf(events);
  const first = events[0];
  const orgName = org.trim() || ORG;

  const nameTaken = state.sources.some((s) => s.name === name.trim() && s.id !== 'src-ple');
  const errors = {
    name: !name.trim() ? 'Source name is required' : nameTaken ? 'A source with this name already exists' : !/^[A-Za-z0-9-]{1,64}$/.test(name.trim()) ? 'Use 1–64 letters, numbers and hyphens' : null,
    ...Object.fromEntries(PR_FIELDS.map((f) => [f.id, pr[f.id]?.trim() ? f.check(pr[f.id].trim()) : null])),
  };
  const err = (k) => (tried ? errors[k] : null);
  const prInvalid = PR_FIELDS.some((f) => errors[f.id]);

  const reset = () => {
    setVerify(null);
    setRepos([]);
    setEditRepos(false);
  };
  const changeToken = () => {
    setToken('');
    reset();
  };
  // Which repositories get searched and watched.
  const verified = ['ok', 'approval'].includes(verify);
  const visible = repos.filter((r) => includePrivate || repoMeta(r).visibility === 'Public');
  const privateCount = repos.filter((r) => repoMeta(r).visibility === 'Private').length;
  const selected = pick === 'all' ? visible : chosen.filter((r) => visible.includes(r));
  const affected = [...new Set(events.flatMap((e) => e.resources.map((r) => r.repo)).filter(Boolean))];
  const missing = verified ? affected.filter((r) => repos.includes(r) && !selected.includes(r)) : [];
  const PAGE = 10;
  const matches = visible.filter((r) => r.includes(q.trim().toLowerCase())).map(repoMeta);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE));
  const shown = matches.slice((Math.min(page, pages) - 1) * PAGE, Math.min(page, pages) * PAGE);
  const runVerify = () => {
    if (!token.trim()) return setVerify('missing');
    setVerify('checking');
    setTimeout(() => {
      const found = sim === 'ok' ? ORG_REPOS : sim === 'approval' ? ORG_REPOS.filter((r) => !NEEDS_APPROVAL.includes(r)) : [];
      setVerify(sim);
      setRepos(found);
      setChosen(found);
    }, 900);
  };
  const plan = useAnalysesPlan(events);
  const [srcOpen, setSrcOpen] = useState(true);
  const [whereOpen, setWhereOpen] = useState(false);
  // Open whatever blocks Begin, so the error is visible.
  const srcShown = mode === 'two' || !verified || srcOpen || (tried && !!errors.name);
  const whereShown = whereOpen || (tried && (plan.roleMissing || plan.stackMissing));
  const [moreOpen, setMoreOpen] = useState(false);
  const moreShown = moreOpen || whereShown || (tried && prInvalid);
  const prSummary = PR_FIELDS.some((f) => pr[f.id]?.trim())
    ? `${pr.branch?.trim() ? `Branches ${pr.branch.trim()}` : 'Default branch names'}, ${pr.commit?.trim() ? `commits “${pr.commit.trim()}”` : 'default commit messages'}, signed by ${pr.authorName?.trim() || 'ATX Bot'}.`
    : 'Default branch names and commit messages, signed by ATX Bot.';
  const begin = () => {
    setTried(true);
    if (errors.name || prInvalid) {
      if (prInvalid) setPrOpen(true);
      return;
    }
    if (plan.roleMissing || plan.stackMissing || plan.dateMissing) return;
    const push = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    dispatch({ type: 'PLE_CONNECT_REPOS', provider, repos: selected, name: name.trim(), org: orgName, push });
    dispatch({ type: 'PLE_HEALTH_ACCESS', scope: 'org', comprehensive: false, estate: true });
    // Health analysis finds the code behind these notices right away.
    if (plan.health) dispatch({ type: 'PLE_START_ANALYSIS' });
    setToken('');
    startAnalyses({ plan, state, dispatch, notify, repos: selected, sourceName: name.trim() });
  };
  // Two steps: connect only, then the analyses page.
  const next = () => {
    setTried(true);
    if (errors.name || prInvalid) {
      if (prInvalid) setPrOpen(true);
      return;
    }
    const push = Object.fromEntries(Object.entries(pr).map(([k, v]) => [k, v.trim()]).filter(([, v]) => v));
    dispatch({ type: 'PLE_CONNECT_REPOS', provider, repos: selected, name: name.trim(), org: orgName, push });
    dispatch({ type: 'PLE_HEALTH_ACCESS', scope: 'org', comprehensive: false, estate: true });
    setToken('');
    notify(`${name.trim()} connected. ${selected.length} ${selected.length === 1 ? 'repository' : 'repositories'} included.`);
    navigate('/app/ple/schedule');
  };
  const one = mode !== 'two';

  return (
    <>
      <div className="setup-head">
        {!one && <div className="muted">Step 1 of 2</div>}
        <h1>{one ? 'Set up continuous modernization' : 'Connect your repositories'}</h1>
        <p>
          {first && (
            <>
              AWS Health flagged {n} {u} on {list(events.map(fromName))}, which {events.length === 1 ? `reaches end of support on ${fmtDate(first.changeDate)}` : `reach end of support starting ${fmtDate(first.changeDate)}`}.
              <br />
            </>
          )}
          {one
            ? 'Connect the repositories behind them. AWS Transform finds and upgrades that code, then keeps the rest of your estate current.'
            : 'Connect the repositories behind them so AWS Transform can upgrade them, and catch the next notice too.'}{' '}
          <Link external onClick={() => navigate('/console/health')}><strong>View in AWS Health</strong></Link>
        </p>
      </div>
      <Wrap on={one} className="stepper">
      <Wrap on={one} className={`sp-item ${verified ? 'done' : 'current'}`} lead={<span className="sp-num">{verified ? <Tick /> : 1}</span>}>
      <section className="setup-card connect-card">
        <div className="group-head-row">
          <div>
            <h2>{one ? 'Connect your repositories' : 'Source'}</h2>
            <p className="muted card-desc">Where your repositories live. Your token is stored encrypted.</p>
          </div>
          {one && verified && <Link onClick={() => setSrcOpen((x) => !x)}><strong>{srcShown ? 'Done' : 'Change'}</strong></Link>}
        </div>
        {one && !srcShown && (
          <p className="src-summary">
            <span className="gs-ok"><Icon.check /></span> {name.trim() || 'Unnamed source'} · {provider}{org.trim() ? ` · ${org.trim()}` : ''} · {selected.length} {selected.length === 1 ? 'repository' : 'repositories'}
          </p>
        )}
        {srcShown && (
        <div className="access-fields">
          <FormField label="Provider">
            <div className="segmented" role="radiogroup" aria-label="Provider">
              {PROVIDERS.map((p) => (
                <button key={p.value} type="button" role="radio" aria-checked={provider === p.value} className={provider === p.value ? 'on' : ''} onClick={() => { setProvider(p.value); reset(); }}>
                  {p.label}
                </button>
              ))}
            </div>
          </FormField>
          <FormField label="Source name" description="How this connection appears in AWS Transform." error={err('name')}>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={`e.g. acme-${provider.toLowerCase()}`} invalid={!!err('name')} />
          </FormField>
          <FormField label={copy.org} secondary={<em>optional</em>} description="Leave blank to use every repository the token can access.">
            <Input value={org} onChange={(e) => { setOrg(e.target.value); reset(); }} placeholder={`e.g. ${ORG}`} />
          </FormField>
          <FormField label={copy.token} description="Needs read access to code and write access to pull requests." error={verify === 'missing' ? `Paste a ${copy.token.toLowerCase()} to verify` : null}>
            <div className="token-row">
              <Input type="password" autoComplete="off" spellCheck={false} value={verified && !token ? '••••••••••••••••••••••••' : token} disabled={verified} onChange={(e) => { setToken(e.target.value); reset(); }} placeholder={copy.placeholder} invalid={verify === 'missing'} />
              {verified ? (
                <Button className="verify-btn" onClick={changeToken}>Change</Button>
              ) : (
                <Button className="verify-btn" disabled={verify === 'checking'} onClick={runVerify}>{verify === 'checking' ? 'Verifying…' : 'Verify'}</Button>
              )}
            </div>
            {verified && <div className="token-ok">Verified. This token can access {repos.length} repositories.</div>}
          </FormField>
          <div className="field repos-field">
            <div className="repos-head">
              <label className="field-label">Repositories</label>
              {verified && <Link onClick={() => setEditRepos((x) => !x)}><strong>{editRepos ? 'Done' : 'Edit'}</strong></Link>}
            </div>
            {(verify === null || verify === 'missing') && <p className="muted repo-hint">Available once the token is verified.</p>}
            {verify === 'checking' && <p className="muted repo-hint"><Icon.spinner /> Listing repositories{org.trim() ? ` in ${orgName}` : ''}…</p>}
            {verified && !editRepos && (
              <p className="repo-hint">
                {pick === 'all'
                  ? `All ${visible.length} ${includePrivate ? '' : 'public '}repositories this token can see.`
                  : `${selected.length} of ${visible.length} repositories selected.`}
              </p>
            )}
            {verified && editRepos && (
              <div className="repos-edit">
                <Radio
                  name="pick"
                  value={pick}
                  onChange={setPick}
                  options={[
                    { value: 'all', label: `All ${visible.length} repositories`, description: 'Finds every affected function, and covers the next notice automatically.' },
                    { value: 'choose', label: 'Choose repositories', description: 'Only the ones you pick are searched and watched.' },
                  ]}
                />
                <label className="checkbox block option repos-private">
                  <input type="checkbox" checked={includePrivate} onChange={(e) => { setIncludePrivate(e.target.checked); setPage(1); }} />
                  <span>
                    <span>Include private repositories <span className="muted">({privateCount})</span></span>
                    <span className="muted small">The code behind these notices is in private repositories, so it won’t be found without them.</span>
                  </span>
                </label>
                {pick === 'choose' && (
                  <div className="repos-table">
                    <div className="repos-toolbar">
                      <SearchInput value={q} onChange={(v) => { setQ(v); setPage(1); }} placeholder="Find repositories" width="100%" />
                      <span className="muted">{selected.length} of {visible.length} selected</span>
                    </div>
                    <Table
                      selectable
                      selected={chosen}
                      onSelect={setChosen}
                      rowKey={(r) => r.repo}
                      rows={shown}
                      empty="No repositories match."
                      columns={[
                        { id: 'repo', header: 'Repository', cell: (r) => <strong>{r.repo}</strong> },
                        { id: 'vis', header: 'Visibility', width: 120, cell: (r) => r.visibility },
                        { id: 'lang', header: 'Language', width: 140, cell: (r) => r.language },
                      ]}
                    />
                    <div className="repos-foot">
                      <span className="muted">{matches.length ? `${(Math.min(page, pages) - 1) * PAGE + 1}–${Math.min(Math.min(page, pages) * PAGE, matches.length)} of ${matches.length}` : '0 of 0'}</span>
                      <Pagination page={Math.min(page, pages)} pages={pages} onChange={setPage} />
                    </div>
                  </div>
                )}
              </div>
            )}
            {missing.length > 0 && (
              <Alert type="warning" title={`${missing.length} ${missing.length === 1 ? 'repository' : 'repositories'} behind these notices ${missing.length === 1 ? 'isn’t' : 'aren’t'} included`}>
                {list(missing)} {missing.length === 1 ? 'defines' : 'define'} affected {u}. AWS Transform can’t find or upgrade them until {missing.length === 1 ? 'it’s' : 'they’re'} included.
              </Alert>
            )}
            {verify === 'failed' && (
              <Alert type="error" title={`We couldn't verify this token with ${provider}`}>
                The token was rejected. Check that it hasn't expired and has read access to code and write access to pull requests, then verify again.
              </Alert>
            )}
            {verify === 'approval' && (
              <Alert type="warning" title={`Your ${copy.org.toLowerCase()} needs an admin to approve AWS Transform`}>
                {NEEDS_APPROVAL.length} repositories need approval. You can continue with the {repos.length} the token can read today and add the rest later.
              </Alert>
            )}
          </div>
        </div>
        )}
      </section>
      </Wrap>
      {one && <AnalysesSections plan={plan} tried={tried} layout="stepper" available={verified} />}
      </Wrap>
      {one ? (
        <section className="setup-card group-card">
          <button type="button" className="pr-toggle group-head" aria-expanded={moreShown} onClick={() => setMoreOpen((x) => !x)}>
            <svg className={`pr-caret ${moreShown ? 'open' : ''}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
            <span>
              <h2>Additional settings <span className="h-note muted"><em>- optional</em></span></h2>
              <p className="muted">Where analyses run, and how pull requests are named and signed. The defaults work for most teams.</p>
            </span>
          </button>
          {moreShown && (
          <>
          <div className="group-row">
            <div className="group-row-head">
              <div>
                <strong>Where it runs</strong>
                <p className="muted">{whereSummary(plan.draft)}</p>
              </div>
              <Link onClick={() => setWhereOpen((x) => !x)}><strong>{whereShown ? 'Done' : 'Change'}</strong></Link>
            </div>
            {whereShown && <div className="sub-edit"><WhereEditor plan={plan} tried={tried} /></div>}
          </div>
          <div className="group-row" data-tour="pr-settings">
            <div className="group-row-head">
              <div>
                <strong>Pull requests</strong>
                <p className="muted">{prSummary}</p>
              </div>
              <Link onClick={() => setPrOpen((x) => !x)}><strong>{prOpen ? 'Done' : 'Change'}</strong></Link>
            </div>
            {prOpen && (
              <div className="sub-edit pr-fields bare">
                {PR_FIELDS.map((f) => (
                  <FormField key={f.id} label={f.label} description={f.desc} error={err(f.id)}>
                    <Input value={pr[f.id] ?? ''} onChange={(e) => setPr((p) => ({ ...p, [f.id]: e.target.value }))} placeholder={f.placeholder} invalid={!!err(f.id)} />
                    {!err(f.id) && <div className="field-hint">{f.hint}</div>}
                  </FormField>
                ))}
              </div>
            )}
          </div>
          </>
          )}
        </section>
      ) : (
      <section className="setup-card pr-card" data-tour="pr-settings">
        <button type="button" className="pr-toggle" aria-expanded={prOpen} onClick={() => setPrOpen((x) => !x)}>
          <svg className={`pr-caret ${prOpen ? 'open' : ''}`} viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><path d="M6 3l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="2" /></svg>
          <span>
            <h2>Pull request settings <span className="h-note muted"><em>- optional</em></span></h2>
            <p className="muted">How AWS Transform names branches and signs commits on the pull requests it opens. The defaults work for most teams.</p>
          </span>
        </button>
        {prOpen && (
          <div className="pr-fields">
            {PR_FIELDS.map((f) => (
              <FormField key={f.id} label={f.label} secondary={<em>optional</em>} description={f.desc} error={err(f.id)}>
                <Input value={pr[f.id] ?? ''} onChange={(e) => setPr((p) => ({ ...p, [f.id]: e.target.value }))} placeholder={f.placeholder} invalid={!!err(f.id)} />
                {!err(f.id) && <div className="field-hint">{f.hint}</div>}
              </FormField>
            ))}
          </div>
        )}
      </section>
      )}
      <div className="setup-actions">
        <span className="grow" />
        <Button variant="link" onClick={() => navigate(back)}>Cancel</Button>
        {one ? (
          <Button variant="primary" disabled={!verified || !selected.length || !plan.analyses.length} onClick={begin}>{plan.later ? 'Schedule continuous analysis' : 'Begin continuous analysis'}</Button>
        ) : (
          <Button variant="primary" disabled={!verified || !selected.length} onClick={next}>Next</Button>
        )}
      </div>
      <DemoPanel>
        {toggle}
        <div className="demo-row">
          <span>Verify result</span>
          <Select compact width={220} value={sim} onChange={setSim} options={[{ value: 'ok', label: 'Verifies' }, { value: 'failed', label: 'Token rejected' }, { value: 'approval', label: 'Admin approval needed' }]} />
        </div>
      </DemoPanel>
    </>
  );
}

// ---- Analyses ------------------------------------------------------------------
// Health analysis runs when the source connects; the rest run across every connected
// repository. The picks live in ple.draft so they survive leaving the page.

const DEFAULT_DRAFT = {
  analyses: [
    { type: 'ple', cadence: 'weekly' },
    { type: 'td-comprehensive', cadence: 'weekly' },
    { type: 'modernization', cadence: 'monthly' },
  ],
  start: 'now', // now | date
  startDate: null,
  day: 'Mondays',
  time: '06:00 PT',
  infra: 'managed',
  role: 'create',
  roleName: null,
  stack: 'none', // customer owned: none | deploying | deployed
};
const ROLES = ['AWSTransformExecutionRole', 'ATX-ContinuousModernization-Role', 'platform-eng-transform-role'].map((r) => ({ value: r, label: r }));
// What "Add an analysis" offers; custom ones can be added more than once.
const ADDABLE = ['ple', 'security', 'td-comprehensive', 'modernization', 'agentic'];
const DEFAULT_CADENCE = { ple: 'weekly', 'td-comprehensive': 'weekly', 'td-quick': 'weekly', security: 'weekly', modernization: 'monthly', agentic: 'monthly', custom: 'once' };
const LABELS = { ple: 'Health analysis', security: 'Security', 'td-comprehensive': 'Tech debt (comprehensive)', 'td-quick': 'Tech debt (quick)', modernization: 'Modernization readiness', agentic: 'Agentic readiness' };
const keyOf = (a) => a.key ?? a.type;

function useDraft() {
  const { state, dispatch } = useStore();
  const draft = { ...DEFAULT_DRAFT, ...state.ple.draft };
  const set = (patch) => dispatch({ type: 'PLE_SET_DRAFT', patch });
  const has = (t) => draft.analyses.some((a) => a.type === t);
  const add = (t) => {
    const key = t === 'custom' ? `custom-${draft.analyses.filter((a) => a.type === 'custom').length + 1}-${Date.now() % 10000}` : t;
    set({ analyses: [...draft.analyses, { key, type: t, cadence: DEFAULT_CADENCE[t], ...(t === 'custom' ? { name: '', prompt: '' } : {}) }] });
  };
  const remove = (key) => set({ analyses: draft.analyses.filter((a) => keyOf(a) !== key) });
  const update = (key, patch) => set({ analyses: draft.analyses.map((a) => (keyOf(a) === key ? { ...a, ...patch } : a)) });
  return { draft, set, has, add, remove, update };
}

const RUNS = ['Once', 'Daily', 'Weekly', 'Monthly'].map((v) => ({ value: v.toLowerCase(), label: v }));
const DAYS = ['Mondays', 'Tuesdays', 'Wednesdays', 'Thursdays', 'Fridays', 'Saturdays', 'Sundays'].map((v) => ({ value: v, label: v }));
const TIMES = ['00:00 PT', '06:00 PT', '09:00 PT', '12:00 PT', '18:00 PT'].map((v) => ({ value: v, label: v }));

// Analyses, schedule and where it runs: three summary cards that open to edit.
// Returns the picks for begin(); validation shows once `tried` is set.
function useAnalysesPlan(events) {
  const { draft, set, has, add, remove, update } = useDraft();
  const { n, u } = scopeOf(events);
  const health = draft.analyses.find((a) => a.type === 'ple');
  const estate = draft.analyses.filter((a) => a.type !== 'ple');
  const analyses = [health, ...estate].filter(Boolean);
  const firstDate = draft.startDate ?? nextRunIso('weekly', draft.day);
  const later = draft.start === 'date';
  const named = (a) => (a.type === 'custom' ? a.name.trim() || 'Custom analysis' : LABELS[a.type] ?? typeLabel(a.type));
  const roleMissing = draft.infra === 'managed' && draft.role === 'existing' && !draft.roleName;
  const stackMissing = draft.infra === 'account' && draft.stack !== 'deployed';
  const dateMissing = later && !draft.startDate;
  return { draft, set, has, add, remove, update, n, u, health, estate, analyses, firstDate, later, named, roleMissing, stackMissing, dateMissing };
}

const ANALYSIS_DESC = {
  ple: 'Traces each AWS Health event to the code behind it, so a deadline never starts with a hunt across repositories.',
  security: 'Finds CVEs, exposed secrets and insecure code, including deep in dependencies. New CVEs land every day.',
  'td-comprehensive': 'Finds deprecated APIs, outdated dependencies and test gaps that turn simple upgrades into multi-week projects.',
  'td-quick': 'A fast pass over runtimes and dependencies, for a quick read between comprehensive runs.',
  modernization: 'Shows what else can move with each upgrade, like newer SDKs or Graviton, so you modernize on your schedule.',
  agentic: 'Checks builds, tests and docs, so AWS Transform can make and verify more changes on its own.',
};
const CADENCE_WORD = { once: 'once', daily: 'daily', weekly: 'weekly', monthly: 'monthly' };


const whereSummary = (draft) =>
  draft.infra === 'account'
    ? `Customer owned, on a stack in your account${draft.stack === 'deployed' ? '' : draft.stack === 'deploying' ? ' (deploying)' : ' (not deployed yet)'}`
    : draft.role === 'existing'
      ? `AWS managed, using ${draft.roleName ? `the ${draft.roleName} role` : 'your existing execution role'}`
      : 'AWS managed. Nothing to deploy; we create the execution role.';

function WhereEditor({ plan, tried }) {
  const { notify } = useStore();
  const { draft, set, roleMissing, stackMissing } = plan;
  const deploy = () => {
    notify('Opens CloudFormation with the AWS Transform stack template (mock).', 'info');
    set({ stack: 'deploying' });
    // Mock: the stack finishes a few seconds after the customer launches it.
    setTimeout(() => set({ stack: 'deployed' }), 4000);
  };
  return (
    <div className="where-edit">
      <div className="radio-cards two">
        {[
          ['managed', 'AWS managed', 'Runs on infrastructure AWS Transform manages. Nothing to deploy.'],
          ['account', 'Customer owned', 'Runs on a stack in your own AWS account, so code never leaves it.'],
        ].map(([v, label, d]) => (
          <label key={v} className={`radio-card ${draft.infra === v ? 'on' : ''}`}>
            <input type="radio" name="infra" checked={draft.infra === v} onChange={() => set({ infra: v })} />
            <span>
              <span className="radio-label">{label}</span>
              <span className="radio-desc">{d}</span>
            </span>
          </label>
        ))}
      </div>
      {draft.infra === 'account' ? (
        <div className="field">
          <label className="field-label">
            Stack in this account{' '}
            <span className={`stack-state ${draft.stack ?? 'none'}`}>{draft.stack === 'deployed' ? 'Deployed' : draft.stack === 'deploying' ? 'Deploying' : 'Not deployed'}</span>
          </label>
          <div className="field-desc">Deploy it once with CloudFormation, about 10 minutes. The first scan and every scheduled run use it.</div>
          {draft.stack !== 'deployed' && (
            <Button className="deploy-btn" disabled={draft.stack === 'deploying'} onClick={deploy}>
              {draft.stack === 'deploying' ? 'Deploying…' : <>Deploy stack in CloudFormation <Icon.external /></>}
            </Button>
          )}
          {tried && stackMissing && <div className="field-error"><Icon.error /> Deploy the stack before the first run, or choose AWS managed.</div>}
        </div>
      ) : (
        <div className="field">
          <label className="field-label">Execution role</label>
          <div className="field-desc">The role AWS Transform uses to read your source connection and open pull requests.</div>
          <div className="inline-radios" role="radiogroup" aria-label="Execution role">
            {[['create', 'Create one for me'], ['existing', 'Use an existing role']].map(([v, label]) => (
              <label key={v}>
                <input type="radio" name="role" checked={draft.role === v} onChange={() => set({ role: v })} /> {label}
              </label>
            ))}
          </div>
          {draft.role === 'existing' ? (
            <>
              <Select width={300} value={draft.roleName} onChange={(v) => set({ roleName: v })} options={ROLES} placeholder="Choose a role" invalid={tried && roleMissing} />
              <div className={tried && roleMissing ? 'field-error' : 'field-hint'}>{tried && roleMissing ? 'Choose a role, or let AWS Transform create one.' : 'It must trust AWS Transform and allow reading your source connection.'}</div>
            </>
          ) : (
            <div className="field-hint">AWS Transform creates a role that trusts it, with only the permissions these runs need.</div>
          )}
        </div>
      )}
    </div>
  );
}

function AnalysesSections({ plan, tried, layout = 'cards', available = true }) {
  const { draft, set, has, add, remove, update, n, u, health, estate, firstDate, later, named, roleMissing, stackMissing, dateMissing } = plan;
  const [open, setOpen] = useState({});
  const setHealth = (c) =>
    c === 'off' ? remove('ple') : health ? update('ple', { cadence: c }) : set({ analyses: [{ type: 'ple', cadence: c }, ...draft.analyses] });
  const toggle = (k) => setOpen((o) => ({ ...o, [k]: !o[k] }));
  const isOpen = (k) => open[k] || (k === 'estate' && tried && dateMissing) || (k === 'where' && tried && (roleMissing || stackMissing));
  const these = `these ${n} ${u}`;
  const estateAddable = ADDABLE.filter((t) => t !== 'ple' && !has(t));

  const row = (a) => {
    const key = keyOf(a);
    const custom = a.type === 'custom';
    return (
      <div key={key} className={`sched-row ${custom ? 'custom' : ''}`}>
        <span className="grow">
          {custom ? (
            <>
              <Input className="sched-name" value={a.name} onChange={(e) => update(key, { name: e.target.value })} placeholder="Name, e.g. Deprecated payments SDK" aria-label="Custom analysis name" />
              <Input value={a.prompt} onChange={(e) => update(key, { prompt: e.target.value })} placeholder="What should it look for? e.g. Calls to payments-sdk v2 that need v3" aria-label="What the custom analysis looks for" />
            </>
          ) : (
            <>
              <strong>{named(a)}</strong>
              <span className="muted">{ANALYSIS_DESC[a.type]}</span>
            </>
          )}
        </span>
        <span className="sched-cadence"><Select compact value={a.cadence} onChange={(c) => update(key, { cadence: c })} options={RUNS} /></span>
        <button type="button" className="icon-btn sched-x" aria-label={`Remove ${named(a)}`} onClick={() => remove(key)}><Icon.close /></button>
      </div>
    );
  };

  const runsLine = estate.length
    ? `${list(estate.map((a) => `${named(a).replace(/ \(comprehensive\)$/, '')} ${CADENCE_WORD[a.cadence]}`))}, across every connected repository.`
    : 'No analyses across your repositories yet.';
  const startLine = later ? ` First run ${fmtDate(firstDate)}, then ${draft.day} at ${draft.time}.` : ` Runs start ${draft.day} at ${draft.time}.`;

  const whereCard = (
    <section className="setup-card slim">
      <div className="kv-row single">
        <span><strong>Where it runs</strong> <span>· {whereSummary(draft)}</span></span>
        <Link onClick={() => toggle('where')}><strong>{isOpen('where') ? 'Done' : 'Change'}</strong></Link>
      </div>
      {isOpen('where') && <WhereEditor plan={plan} tried={tried} />}
    </section>
  );
  const runsStart = (
    <div className={`runs-start ${layout === 'stepper' ? 'plain' : ''}`}>
      {layout === 'stepper' ? <strong>Runs start</strong> : <span>Runs start</span>}
      {layout !== 'stepper' && <span className="grow" />}
      <Select compact width={130} value={later ? 'date' : 'now'} onChange={(v) => set({ start: v, startDate: v === 'date' ? firstDate : null })} options={[{ value: 'now', label: 'Now' }, { value: 'date', label: 'On a date' }]} />
      {later && <Input type="date" className="sched-date" value={draft.startDate ?? ''} min={MOCK_TODAY} onChange={(e) => set({ startDate: e.target.value || null })} aria-label="First run date" invalid={tried && dateMissing} />}
      <span className="muted">then</span>
      <Select compact width={140} value={draft.day} onChange={(v) => set({ day: v })} options={DAYS} />
      <span className="muted">at</span>
      <Select compact width={120} value={draft.time} onChange={(v) => set({ time: v })} options={TIMES} />
    </div>
  );
  const addRow = (types) => (
    <div className="add-analysis">
      <span className="muted">Add</span>
      {types.map((t) => (
        <button key={t} type="button" className="add-link" onClick={() => add(t)}>+ {LABELS[t]}</button>
      ))}
      <button type="button" className="add-link" onClick={() => add('custom')}>+ Custom</button>
    </div>
  );

  // One page (stepper): step 2, with AWS Health and the estate as two rows that open to edit.
  if (layout === 'stepper') {
    const healthLine = health
      ? `Finds the code behind ${these} now, then each new notice. Runs ${CADENCE_WORD[health.cadence]}.`
      : `Off. The code behind ${these} won’t be found, and new notices won’t be watched.`;
    return (
      <div className={`sp-item ${available ? 'current' : 'locked'}`}>
        <span className="sp-num">2</span>
        <section className="setup-card group-card" data-tour="analyses">
          <div className="group-head">
            <h2>Keep them continuously modern</h2>
            <p className="muted">{available ? 'Two things AWS Transform watches for you. The defaults work for most teams.' : 'Available once your repositories are connected.'}</p>
          </div>
          {available && (
            <>
              <div className="group-row" data-tour="health-analysis">
                <div className="group-row-head">
                  <div>
                    <strong>AWS Health</strong>
                    <p className="muted">{healthLine}</p>
                  </div>
                  <Link onClick={() => toggle('health')}><strong>{isOpen('health') ? 'Done' : 'Change'}</strong></Link>
                </div>
                {isOpen('health') && (
                  <div className="sub-edit">
                    <div className="runs-start plain">
                      <strong>Runs</strong>
                      <Select compact width={130} value={health?.cadence ?? 'off'} onChange={setHealth} options={[...RUNS, { value: 'off', label: 'Off' }]} />
                    </div>
                  </div>
                )}
              </div>
              <div className="group-row">
                <div className="group-row-head">
                  <div>
                    <strong>Your estate</strong>
                    <p className="muted">{estate.length ? runsLine.replace('every connected repository', 'every repository') : 'Nothing yet. Add an analysis to keep your repositories current.'}</p>
                  </div>
                  <Link onClick={() => toggle('estate')}><strong>{isOpen('estate') ? 'Done' : 'Change'}</strong></Link>
                </div>
                {isOpen('estate') && (
                  <div className="sub-edit">
                    {estate.map(row)}
                    <div className="add-analysis bare">
                      {estateAddable.map((t) => (
                        <button key={t} type="button" className="add-link" onClick={() => add(t)}>+ Add {LABELS[t]}</button>
                      ))}
                      <button type="button" className="add-link" onClick={() => add('custom')}>+ Add custom</button>
                    </div>
                    {runsStart}
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    );
  }

  // Two steps: one Analyses card with both groups, then where it runs.
  if (layout === 'list') {
    return (
      <>
        <section className="setup-card sched-card" data-tour="analyses">
          <div className="sched-body">
            <h2>Analyses</h2>
            <p className="muted card-desc">Each runs on every connected repository, starting {later ? fmtDate(firstDate) : 'today'}.</p>
            <div className="sched-label">For these events</div>
            {health ? row(health) : <p className="muted sched-empty">No Health analysis. The code behind {these} won’t be found, and new AWS Health notices won’t be watched.</p>}
            <div className="sched-label">Across your repositories</div>
            {estate.map(row)}
            {!estate.length && <p className="muted sched-empty">None yet. Add an analysis to keep your repositories current.</p>}
            {addRow(ADDABLE.filter((t) => !has(t)))}
          </div>
          <div className="sched-foot">
            <div className="kv-row single">
              <span><strong>Schedule</strong> <span>·{startLine}</span></span>
              <Link onClick={() => toggle('estate')}><strong>{isOpen('estate') ? 'Done' : 'Change'}</strong></Link>
            </div>
            {isOpen('estate') && <div className="sched-foot-edit">{runsStart}</div>}
          </div>
        </section>
        {whereCard}
      </>
    );
  }

  return (
    <>
      <section className="setup-card sum-card" data-tour="health-analysis">
        <div className="sum-head">
          <div>
            <h2>Stay ahead of AWS Health</h2>
            <p className="muted">
              {health
                ? `Health analysis runs ${CADENCE_WORD[health.cadence]}. It finds the code behind ${these} now, then each new notice as AWS Health publishes it.`
                : `Off. The code behind ${these} won’t be found, and new AWS Health notices won’t be watched.`}
            </p>
          </div>
          <Link onClick={() => toggle('health')}><strong>{isOpen('health') ? 'Done' : 'Change'}</strong></Link>
        </div>
        {isOpen('health') && (
          <div className="sum-body">
            {health ? row(health) : (
              <div className="add-analysis">
                <span className="muted">Add</span>
                <button type="button" className="add-link" onClick={() => add('ple')}>+ Health analysis</button>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="setup-card sum-card" data-tour="analyses">
        <div className="sum-head">
          <div>
            <h2>Keep your whole estate current</h2>
            <p className="muted">{runsLine}{estate.length ? startLine : ''}</p>
          </div>
          <Link onClick={() => toggle('estate')}><strong>{isOpen('estate') ? 'Done' : 'Change'}</strong></Link>
        </div>
        {isOpen('estate') && (
          <div className="sum-body">
            {estate.map(row)}
            {addRow(estateAddable)}
            {runsStart}
          </div>
        )}
      </section>

      {whereCard}
    </>
  );
}

// Two steps, step 2: the analyses, schedule and where it runs, then begin.
function ScheduleStep({ events, back, toggle }) {
  const { state, dispatch, notify } = useStore();
  const plan = useAnalysesPlan(events);
  const [tried, setTried] = useState(false);
  const { health, analyses, later, firstDate, n, u } = plan;
  const src = state.sources.find((s) => s.id === 'src-ple');
  const repos = state.ple.setup.repos;
  const begin = () => {
    setTried(true);
    if (plan.roleMissing || plan.stackMissing || plan.dateMissing) return;
    if (health) dispatch({ type: 'PLE_START_ANALYSIS' });
    startAnalyses({ plan, state, dispatch, notify, repos, sourceName: src?.name });
  };
  return (
    <>
      <div className="setup-head">
        <div className="muted">Step 2 of 2</div>
        <h1>Keep them continuously modern</h1>
        <p>
          {health ? `Health analysis finds the code behind these ${n} ${u} first, then keeps watching for the next notice. ` : ''}Add analyses to keep
          {health ? ' the rest of' : ''} your repositories current{health ? ' too' : ''}.
        </p>
      </div>
      <AnalysesSections plan={plan} tried={tried} layout="list" />
      <div className="setup-actions">
        <span className="muted">{analyses.length} {analyses.length === 1 ? 'analysis' : 'analyses'} across {repos.length} repositories, starting {later ? fmtDate(firstDate) : 'now'}.</span>
        <span className="grow" />
        <Button variant="link" onClick={() => navigate(back)}>Cancel</Button>
        <Button onClick={() => navigate('/app/ple/connect')}>Previous</Button>
        <Button variant="primary" disabled={!analyses.length} onClick={begin}>{later ? 'Schedule continuous analysis' : 'Begin continuous analysis'}</Button>
      </div>
      <DemoPanel>{toggle}</DemoPanel>
    </>
  );
}

/** Saves the schedule and starts (or schedules) every picked analysis except Health analysis, which runs on connect. */
function startAnalyses({ plan, state, dispatch, notify, repos, sourceName }) {
  const { draft, analyses, later, named } = plan;
  const picked = analyses.map((a) => ({ ...a, name: named(a) }));
  const start = later ? draft.startDate : null;
  dispatch({ type: 'PLE_SET_SCHEDULE', schedule: { analyses: picked, start, day: draft.day, time: draft.time, infra: draft.infra, role: draft.infra === 'managed' && draft.role === 'existing' ? draft.roleName : null } });
  const readable = repos.filter((r) => !UNREADABLE.includes(r));
  const infra = draft.infra === 'managed' ? 'AWS managed' : 'Customer owned';
  picked
    .filter((a) => a.type !== 'ple' && !start)
    .forEach((a) => dispatch({ type: 'START_ANALYSIS', analysisType: a.type, name: a.name, source: sourceName ?? ORG, repos: readable, infra, autoGroup: a.type.startsWith('td') }));
  notify(start ? `Continuous analysis scheduled: the first run starts ${fmtDate(start)}.` : `Continuous analysis started: ${picked.length} ${picked.length === 1 ? 'analysis' : 'analyses'} across ${repos.length} repositories.`);
  navigate('/app/cm/analyses/A-PLE');
}
