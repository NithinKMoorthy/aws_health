import React, { useEffect, useState } from 'react';
import { fmtDate } from '../data';
import { navigate, useStore } from '../store';
import {
  Alert, Breadcrumbs, Button, Container, CopyText, FormField, Icon, Input, KeyValue, Link, Modal, ProgressBar, Radio, SearchInput, Select,
} from '../components/ui';
import { ACCOUNT_ENV, daysLeft, ORG, ORG_REPOS, UNREADABLE } from './data';
import { CM_CUSTOMER_KEY } from './reducer';
import { ContextStrip, DemoPanel, PleTag, shortTitle, unit } from './common';

// Screens 2–5: deep-link welcome with PLE context, then the setup wizard.

export function PleOnboarding({ step, query }) {
  if (step === 'welcome') return <Welcome query={query} />;
  return <SetupWizard step={step} />;
}

function useEntryEvent() {
  const { state } = useStore();
  return state.ple.events.find((e) => e.id === state.ple.entryEventId);
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
  const days = daysLeft(event.changeDate);
  const what = event.service === 'Lambda' ? 'a runtime that reaches end of support' : 'an engine version that reaches end of standard support';
  const g = state.ple.groups.find((x) => x.pleId === event.id);
  const mapped = g ? new Set(state.findings.filter((f) => g.findingIds.includes(f.id)).flatMap((f) => f.functions ?? [])).size : 0;
  const connected = state.ple.setup.repos.length > 0;
  const shown = showAll ? event.resources : event.resources.slice(0, 10);
  return (
    <div className="page home">
      <Breadcrumbs
        items={[
          { label: 'AWS Transform', onClick: () => navigate('/app/chat') },
          { label: 'Lifecycle events', onClick: () => navigate('/console/health') },
          { label: shortTitle(event) },
        ]}
      />
      <div className="home-head">
        <div>
          <div className="home-eyebrow"><span className="outline-chip">Planned lifecycle event</span> <span className="muted">From AWS Health</span></div>
          <h1 className="page-title">{event.title}</h1>
          <p className="home-desc">
            AWS Health found {n} {u} in {accounts.length} accounts on {what} on {fmtDate(event.changeDate)}. Connect the repositories that define them and
            AWS Transform will show you exactly what needs to change.
          </p>
        </div>
        <Button onClick={() => navigate(`/console/health/${event.id}`)} iconRight={<Icon.external style={{ marginLeft: 6 }} />}>View in AWS Health</Button>
      </div>

      <section className="container home-stats">
        <div>
          <div className="stat-label">Time remaining</div>
          <div className="stat-big">{days} days</div>
          <div className={days <= 120 ? 'stat-warn' : 'muted small'}>{days <= 120 && <Icon.warn />} Ends {fmtDate(event.changeDate)}</div>
        </div>
        <div>
          <div className="stat-label">Affected {u}</div>
          <div className="stat-big">{n}</div>
          <div className="muted small">Across {accounts.length} accounts</div>
        </div>
        <div>
          <div className="stat-label">Mapped to source code</div>
          <div className="stat-big">{mapped} <span className="stat-of">of {n}</span></div>
          <div className="muted small stat-wait">{g ? <><Icon.check /> Matched in connected repositories</> : <><ClockIcon /> {connected ? 'Checking repositories' : 'Waiting for repositories'}</>}</div>
        </div>
        <div>
          <div className="stat-label">Remediation</div>
          <div className="stat-mid">{event.td ? event.tdLabel : 'Specialized skill'}</div>
          <div className="muted small">{event.td ? 'AWS-managed transformation' : 'Generated by AWS Transform for this change'}</div>
        </div>
      </section>

      <div className="home-grid">
        <Container header="Get started" description="Three parts to see what needs to change.">
          <ol className="v-steps">
            <li className="current">
              <span className="v-num">1</span>
              <div>
                <strong>Connect repositories</strong>
                <p>Link the repositories that define these {n} {u}.</p>
                <Button variant="primary" onClick={() => navigate('/app/ple/provider')}>Connect repositories</Button>
              </div>
            </li>
            <li>
              <span className="v-num">2</span>
              <div>
                <strong>Allow AWS Health access</strong>
                <p>So each {u.replace(/s$/, '')} can be matched to its code.</p>
              </div>
            </li>
            <li>
              <span className="v-num">3</span>
              <div>
                <strong>Review affected code</strong>
                <p>Approve a plan before anything changes.</p>
              </div>
            </li>
          </ol>
          <p className="home-foot"><LockIcon /> Nothing runs on your code until you review and approve a plan.</p>
        </Container>

        <Container header={<>Affected {u} <span className="muted">({n})</span></>}>
          <table className="table plain">
            <thead>
              <tr><th>{U.replace(/s$/, '')} name</th><th>Account</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => (
                <tr key={r.arn}>
                  <td><Link onClick={() => navigate(`/console/health/${event.id}`, { tab: 'resources' })}><span className="underline">{r.name}</span></Link></td>
                  <td>{ACCOUNT_ENV[r.account] ? `${ACCOUNT_ENV[r.account]} · ` : ''}{r.account}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {n > 10 && <div style={{ marginTop: 10 }}><Link onClick={() => setShowAll((x) => !x)}>{showAll ? 'Show fewer' : `Show all ${n}`}</Link></div>}
        </Container>
      </div>
    </div>
  );
}

const ClockIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden><circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M8 4.5V8l2.5 1.5" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);
const LockIcon = () => (
  <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden><rect x="3" y="7" width="10" height="7" rx="1.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M5.5 7V5a2.5 2.5 0 0 1 5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" /></svg>
);

// ---- Screens 3–5: setup wizard ----------------------------------------------
// Cloudscape wizard layout (left step nav, Cancel · Previous · Next), modeled on
// CM's "Connect new source". Steps 1–4 connect repositories (Screen 3), step 5
// is AWS Health access (Screen 4), step 6 finds affected code (Screen 5).
// The access token lives only in this component's state and is cleared on
// connect; the mock never stores or sends it.

const STEPS = [
  { id: 'provider', title: 'Choose a provider', section: 'Connect repositories' },
  { id: 'token', title: 'Add an access token' },
  { id: 'source', title: 'Source details' },
  { id: 'review', title: 'Review and connect' },
  { id: 'health', title: 'Allow AWS Health access', section: 'Allow AWS Health access', ple: true },
  { id: 'analyze', title: 'Find affected code', section: 'Review affected code' },
];

const PROVIDERS = [
  { value: 'GitHub', label: 'GitHub', description: 'Repositories in a GitHub organization or user at github.com.' },
  { value: 'GitLab', label: 'GitLab', description: 'Repositories in a GitLab group or user, on GitLab.com or a self-managed instance.' },
  { value: 'Bitbucket', label: 'Bitbucket', description: 'Repositories in a Bitbucket Cloud workspace, or a Data Center project on a self-managed instance.' },
];

const TOKEN_HOWTO = {
  GitHub: {
    noun: 'access token',
    steps: [
      'In GitHub, open Settings, choose Developer settings, then Fine-grained tokens, and choose Generate new token.',
      'Set Resource owner to the organization you want to analyze, then choose the repositories AWS Transform can read.',
      'Grant the permissions listed under Permissions, set an expiration, and copy the token.',
    ],
    link: 'Create a fine-grained token in GitHub',
    perms: [['Metadata', 'Read-only. Required by GitHub for every token.'], ['Contents', 'Read-only. Read code for analysis.']],
    remPerms: [['Contents', 'Read and write. Push remediation branches.'], ['Pull requests', 'Read and write. Open pull requests with the changes.']],
  },
  GitLab: {
    noun: 'access token',
    steps: [
      'In GitLab, open your group, choose Settings, then Access tokens, and choose Add new token.',
      'Choose the Reporter role for analysis, or Developer if AWS Transform should open merge requests.',
      'Select the scopes listed under Permissions, set an expiration, and copy the token.',
    ],
    link: 'Create a group access token in GitLab',
    perms: [['read_api', 'Read-only. List projects and metadata.'], ['read_repository', 'Read-only. Read code for analysis.']],
    remPerms: [['write_repository', 'Push remediation branches.'], ['api', 'Open merge requests with the changes.']],
  },
  Bitbucket: {
    noun: 'access token',
    steps: [
      'In Bitbucket, open your workspace settings, choose Access tokens, and choose Create workspace access token.',
      'Name the token and select the scopes listed under Permissions.',
      'Create the token and copy it. Bitbucket shows it only once.',
    ],
    link: 'Create a workspace access token in Bitbucket',
    perms: [['Repositories: Read', 'Read code and metadata for analysis.']],
    remPerms: [['Repositories: Write', 'Push remediation branches.'], ['Pull requests: Write', 'Open pull requests with the changes.']],
  },
};

const ORG_NOUN = { GitHub: 'GitHub organization', GitLab: 'GitLab group', Bitbucket: 'Bitbucket workspace' };

// Repos that sit behind org admin approval in the "approval needed" state.
const NEEDS_APPROVAL = ORG_REPOS.filter((r) => /^(admin|billing|card|chargeback|config|customer|data|design|dev|docs|dispute)/.test(r));

const placeholderOk = (v) => !v.trim() || /\{[^}]*\}/.test(v);

export function SetupWizard({ step }) {
  const { state, dispatch, notify } = useStore();
  const event = useEntryEvent();
  const current = step === 'repos' ? 'provider' : STEPS.some((s) => s.id === step) ? step : 'provider';
  const idx = STEPS.findIndex((s) => s.id === current);
  const connected = state.ple.setup.repos.length > 0;

  // Wizard form state survives step changes because this component stays mounted.
  const [provider, setProvider] = useState(state.ple.setup.provider ?? 'GitHub');
  const [org, setOrg] = useState('');
  const [token, setToken] = useState('');
  const [verify, setVerify] = useState(null); // null | checking | ok | failed | approval | partial
  const [sim, setSim] = useState('ok');
  const [name, setName] = useState(state.sources.some((s) => s.name === ORG) ? '' : ORG);
  const [publicRepos, setPublicRepos] = useState(true);
  const [mode, setMode] = useState('all');
  const [picked, setPicked] = useState([]);
  const [search, setSearch] = useState('');
  const [push, setPush] = useState({ branch: '', commit: '', author: '', email: '' });
  const [pushOpen, setPushOpen] = useState(false);
  const [tried, setTried] = useState({});
  const [cliOpen, setCliOpen] = useState(false);
  const [maxIdx, setMaxIdx] = useState(connected ? 4 : 0);

  useEffect(() => setMaxIdx((m) => Math.max(m, idx)), [idx]);

  const available = verify === 'partial' ? ORG_REPOS.filter((r) => !NEEDS_APPROVAL.includes(r)) : ORG_REPOS;
  const chosen = mode === 'all' ? available : picked;
  const nameTaken = state.sources.some((s) => s.name === name.trim() && s.id !== 'src-ple');
  const errors = {
    token: !token.trim() ? 'Access token is required' : verify === 'failed' ? "We couldn't verify this token" : verify === 'approval' ? 'Waiting for admin approval' : null,
    name: !name.trim() ? 'Source name is required' : nameTaken ? 'A source with this name already exists' : !/^[A-Za-z0-9._-]+$/.test(name.trim()) ? 'Use letters, numbers, ".", "_" or "-"' : null,
    repos: chosen.length === 0 ? 'Select at least one repository' : null,
    branch: placeholderOk(push.branch) ? null : 'Include a {PLACEHOLDER}',
    commit: placeholderOk(push.commit) ? null : 'Must contain {} or {any text}',
    email: !push.email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(push.email) ? null : 'Enter a valid email address',
  };
  const stepErrors = {
    token: ['token'],
    source: ['name', 'repos', 'branch', 'commit', 'email'],
  };
  const err = (k) => (tried[current] ? errors[k] : null);
  const go = (id) => navigate(`/app/ple/${id}`);
  const next = () => {
    if ((stepErrors[current] ?? []).some((k) => errors[k])) {
      setTried({ ...tried, [current]: true });
      return;
    }
    go(STEPS[idx + 1].id);
  };

  const runVerify = () => {
    if (!token.trim()) {
      setTried({ ...tried, token: true });
      return;
    }
    setVerify('checking');
    setTimeout(() => setVerify(sim), 900);
  };

  const connect = () => {
    dispatch({ type: 'PLE_CONNECT_REPOS', provider, repos: chosen, name: name.trim(), org: org.trim() || ORG, push });
    setToken('');
    notify(`Source "${name.trim()}" connected. ${chosen.length} repositories discovered.`);
    go('health');
  };

  const cancel = () => navigate(event ? `/console/health/${event.id}` : '/app/cm/dashboard');
  const pushSet = Object.values(push).some((v) => v.trim());

  return (
    <div className="page">
      <Breadcrumbs
        items={[
          { label: 'Continuous modernization', onClick: () => navigate('/app/cm/dashboard') },
          { label: event ? `Remediate ${shortTitle(event)}` : 'Set up' },
        ]}
      />
      <div className="wizard">
        <nav className="wizard-nav" aria-label="Steps">
          {STEPS.map((s, i) => (
            <React.Fragment key={s.id}>
              {s.section && <div className="wizard-section">{s.section}{s.ple && <> <PleTag /></>}</div>}
              <button
                type="button"
                className={`wizard-step ${i === idx ? 'current' : i < idx ? 'done' : i <= maxIdx ? 'visited' : ''}`}
                disabled={i > maxIdx || (!connected && i >= 4)}
                onClick={() => go(s.id)}
              >
                <span className="wizard-dot" />
                <span>
                  <span className="wizard-num">Step {i + 1}</span>
                  <span className="wizard-title">{s.title}</span>
                </span>
              </button>
            </React.Fragment>
          ))}
        </nav>

        <div className="wizard-main">
          <ContextStrip event={event} />

          {current === 'provider' && (
            <>
              <WizardHead title="Choose a provider" desc="Choose where your repositories are hosted." />
              <Container>
                <div className="field-label">Provider</div>
                <div className="radio-cards">
                  {PROVIDERS.map((p) => (
                    <label key={p.value} className={`radio-card ${provider === p.value ? 'on' : ''}`}>
                      <input type="radio" name="provider" checked={provider === p.value} onChange={() => { setProvider(p.value); setVerify(null); }} />
                      <span>
                        <span className="radio-label">{p.label}</span>
                        <span className="radio-desc">{p.description}</span>
                      </span>
                    </label>
                  ))}
                </div>
                <p className="small" style={{ marginTop: 14 }}>
                  Repositories only on your machine? <Link onClick={() => setCliOpen(true)}>Use the CLI for local repositories</Link>
                </p>
              </Container>
            </>
          )}

          {current === 'token' && (
            <>
              <WizardHead title="Add an access token" desc={`Create an access token in ${provider} and paste it here. You can verify it before you continue.`} />
              <div className="token-grid">
                <Container header="How to create a token">
                  <ol className="howto">
                    {TOKEN_HOWTO[provider].steps.map((s) => <li key={s}>{s}</li>)}
                  </ol>
                  <Link external onClick={() => notify(`Opens ${provider} token settings in a new tab (mock).`, 'info')}>{TOKEN_HOWTO[provider].link}</Link>
                  <div style={{ marginTop: 16 }}>
                    <FormField label={<>Organization / group / workspace <em>- optional</em></>} description={`The ${ORG_NOUN[provider]} to discover repositories from. Leave blank to discover every repository the token can access.`}>
                      <Input value={org} onChange={(e) => setOrg(e.target.value)} placeholder="my-org" />
                    </FormField>
                    <FormField label="Access token" description={`A ${provider} access token with read access to your repositories. Stored securely and never shown again.`} error={err('token')}>
                      <Input type="password" autoComplete="off" spellCheck={false} value={token} onChange={(e) => { setToken(e.target.value); setVerify(null); }} placeholder="Paste your personal access token" invalid={!!err('token')} />
                    </FormField>
                  </div>
                  <div className="inline-gap">
                    <Button onClick={runVerify} disabled={verify === 'checking'}>{verify === 'checking' ? 'Verifying…' : 'Verify token'}</Button>
                    {verify === 'ok' && <span className="status status-success"><Icon.check /> Token verified · {ORG_REPOS.length} repositories visible{org.trim() ? ` in ${org.trim()}` : ''}</span>}
                    {verify === 'partial' && <span className="status status-success"><Icon.check /> Continuing with {available.length} available repositories</span>}
                  </div>
                  {verify === 'failed' && (
                    <Alert type="error" title={`We couldn't connect to ${provider}`} action={<Button variant="link" onClick={() => notify('Help article would open here (mock).', 'info')}>Get help</Button>}>
                      The token was rejected. Check that it hasn't expired and that your organization allows the AWS Transform app, then verify again.
                    </Alert>
                  )}
                  {verify === 'approval' && (
                    <Alert
                      type="warning"
                      title={`Your ${ORG_NOUN[provider]} needs an admin to approve AWS Transform`}
                      action={
                        <div className="actions">
                          <Button onClick={() => { navigator.clipboard?.writeText(`https://github.com/organizations/${org.trim() || ORG}/settings/personal-access-token-requests`).catch(() => {}); notify('Approval link copied.'); }}>Copy approval link</Button>
                          <Button onClick={() => setVerify('partial')}>Continue with available repositories</Button>
                        </div>
                      }
                    >
                      {NEEDS_APPROVAL.length} repositories need approval. You can continue with the {ORG_REPOS.length - NEEDS_APPROVAL.length} the token can read today and add the rest later.
                    </Alert>
                  )}
                  <DemoPanel title="Simulate verify result (mock only)">
                    <Select value={sim} onChange={setSim} options={[{ value: 'ok', label: 'Verified' }, { value: 'failed', label: 'Authorization fails' }, { value: 'approval', label: 'Admin approval needed' }]} />
                  </DemoPanel>
                </Container>
                <Container header="Permissions">
                  <Alert type="info">To fix this PLE, AWS Transform opens pull requests. Include both sets of permissions below, or the fixes can't be pushed.</Alert>
                  <h3 className="perm-h">Needed to connect and analyze</h3>
                  <ul className="perm-list stacked">
                    {TOKEN_HOWTO[provider].perms.map(([k, d]) => (
                      <li key={k}><Icon.check className="ok" /> <span><strong>{k}</strong><span className="muted small">{d}</span></span></li>
                    ))}
                  </ul>
                  <h3 className="perm-h">Needed only if you run remediations</h3>
                  <ul className="perm-list stacked">
                    {TOKEN_HOWTO[provider].remPerms.map(([k, d]) => (
                      <li key={k}><Icon.info className="info" /> <span><strong>{k}</strong><span className="muted small">{d}</span></span></li>
                    ))}
                  </ul>
                </Container>
              </div>
            </>
          )}

          {current === 'source' && (
            <>
              <WizardHead title="Source details" desc="Name the source and choose which repositories it discovers." />
              <Container>
                <FormField label="Source name" description="A unique name for this source connection." error={err('name')}>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="my-source" invalid={!!err('name')} />
                </FormField>
                <label className="checkbox block">
                  <input type="checkbox" checked={publicRepos} onChange={(e) => setPublicRepos(e.target.checked)} /> Include public repositories
                </label>
                <p className="field-desc indent">Any {provider} token has read-only access to public repositories by default. Turn this off to list only the private repositories this token is scoped to.</p>
                <div className="field-label" style={{ marginTop: 14 }}>Repositories</div>
                <Radio
                  name="repo-mode"
                  value={mode}
                  onChange={setMode}
                  options={[
                    { value: 'all', label: `All repositories (${available.length})`, description: 'Recommended. New repositories are included automatically.' },
                    { value: 'select', label: 'Select repositories' },
                  ]}
                />
                {event && (
                  <p className="hint"><Icon.info /> AWS Transform will check every connected repository for {event.service} {unit(event, 2)} on {event.from}.</p>
                )}
                {mode === 'select' && (
                  <>
                    <div className="filters">
                      <SearchInput value={search} onChange={setSearch} placeholder="Find repositories" />
                      <span className="muted small">{picked.length} selected</span>
                    </div>
                    <div className="repo-grid">
                      {available.filter((r) => !search || r.includes(search.toLowerCase())).map((r) => {
                        const on = picked.includes(r);
                        return (
                          <label key={r} className={`repo-pick ${on ? 'on' : ''}`}>
                            <input type="checkbox" checked={on} onChange={() => setPicked(on ? picked.filter((x) => x !== r) : [...picked, r])} /> {r}
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
                {err('repos') && <div className="field-error"><Icon.error /> {errors.repos}</div>}
              </Container>
              <section className="container collapsible">
                <button type="button" className="collapse-head" onClick={() => setPushOpen((o) => !o)}>
                  <Icon.caret className={pushOpen ? '' : 'rot'} />
                  <span>
                    Push settings
                    <span className="muted small block-desc">Only needed if your repositories enforce branch names, commit messages, or commit authors.</span>
                  </span>
                </button>
                {pushOpen && (
                  <div className="container-body">
                    <FormField label={<>Branch name template <em>- optional</em></>} description="Template for the branch AWS Transform pushes changes to. Include a {PLACEHOLDER} — replaced with the generated branch name." error={err('branch')}>
                      <Input value={push.branch} onChange={(e) => setPush({ ...push, branch: e.target.value })} placeholder="feature/atx/{PLACEHOLDER}" invalid={!!err('branch')} />
                      <div className="field-desc">Must match your team's branch-naming rule, or the push is rejected. Example: feature/atx/{'{PLACEHOLDER}'}</div>
                    </FormField>
                    <FormField label={<>Commit message template <em>- optional</em></>} description="Template for the commit messages AWS Transform creates. Include a {PLACEHOLDER} — the text inside the braces is replaced with the generated commit summary." error={err('commit')}>
                      <Input value={push.commit} onChange={(e) => setPush({ ...push, commit: e.target.value })} placeholder="fix: {PLACEHOLDER}" invalid={!!err('commit')} />
                      <div className="field-desc">Must contain {'{}'} or {'{any text}'}. Example: fix: {'{PLACEHOLDER}'}</div>
                    </FormField>
                    <FormField label={<>Git commit author name <em>- optional</em></>} description="Name used on commits AWS Transform pushes (git config user.name).">
                      <Input value={push.author} onChange={(e) => setPush({ ...push, author: e.target.value })} placeholder="AWS Transform" />
                      <div className="field-desc">Defaults to "ATX Bot". For example: AWS Transform</div>
                    </FormField>
                    <FormField label={<>Git commit author email <em>- optional</em></>} description="Email used on commits AWS Transform pushes (git config user.email)." error={err('email')}>
                      <Input value={push.email} onChange={(e) => setPush({ ...push, email: e.target.value })} placeholder="atx-bot@yourcompany.com" invalid={!!err('email')} />
                      <div className="field-desc">Must be an email your organization allows, or the push is rejected. Example: atx-bot@yourcompany.com</div>
                    </FormField>
                  </div>
                )}
              </section>
            </>
          )}

          {current === 'review' && (
            <>
              <WizardHead title="Review and connect" desc="Check the connection before AWS Transform stores the token and discovers repositories. No repository is changed by connecting or analyzing." />
              <Container header="Connection" actions={<Button onClick={() => go('provider')}>Edit</Button>}>
                <KeyValue columns={1} items={[['Provider', provider]]} />
              </Container>
              <Container header="Access" actions={<Button onClick={() => go('token')}>Edit</Button>}>
                <div className="two-col divided">
                  <KeyValue columns={1} items={[['Discovers from', org.trim() ? `${ORG_NOUN[provider]} ${org.trim()}` : 'Every repository the token can access']]} />
                  <KeyValue columns={1} items={[['Access token', token.trim() ? (verify === 'ok' || verify === 'partial' ? 'Provided · verified' : 'Provided') : 'Missing']]} />
                </div>
              </Container>
              <Container header="Source details" actions={<Button onClick={() => go('source')}>Edit</Button>}>
                <div className="two-col divided">
                  <KeyValue columns={1} items={[['Source name', name.trim()], ['Push settings', pushSet ? Object.entries(push).filter(([, v]) => v.trim()).map(([k, v]) => `${k}: ${v}`).join(' · ') : 'None. AWS Transform uses its defaults.']]} />
                  <KeyValue columns={1} items={[['Include public repositories', publicRepos ? 'Yes' : 'No'], ['Repositories', mode === 'all' ? `All repositories (${available.length})` : `${picked.length} selected`]]} />
                </div>
              </Container>
              <Alert type="warning" title={`Your access token is stored in AWS Secrets Manager`}>
                When you connect this source, your personal access token is stored as a secret in AWS Secrets Manager in this AWS account. Any user or role in the
                account with permission to read that secret can retrieve the token and use the repository access it grants. We recommend that you use a token with the
                narrowest repository access you need and revoke it when you no longer use this source.
              </Alert>
              {!token.trim() && <Alert type="error">Add an access token before you connect. Tokens aren't kept if you reload the page.</Alert>}
            </>
          )}

          {current === 'health' && <HealthAccessStep onCancel={cancel} />}
          {current === 'analyze' && <AnalyzeStep />}

          {idx <= 3 && (
            <div className="form-actions">
              <Button variant="link" onClick={cancel}>Cancel</Button>
              {idx > 0 && <Button onClick={() => go(STEPS[idx - 1].id)}>Previous</Button>}
              {current === 'review' ? (
                <Button variant="primary" disabled={!token.trim() || !!errors.name || !!errors.repos} onClick={connect}>Connect</Button>
              ) : (
                <Button variant="primary" onClick={next}>Next</Button>
              )}
            </div>
          )}
        </div>
      </div>

      {cliOpen && (
        <Modal title="Connect local repositories with the CLI" onClose={() => setCliOpen(false)} footer={<Button variant="primary" onClick={() => setCliOpen(false)}>Done</Button>}>
          <p>Run this from the root of each local repository. Results appear here when the CLI finishes.</p>
          <CopyText mono text={`atx cm connect --path . --event ${event?.arn ?? '<event-arn>'}`} notify={notify} />
        </Modal>
      )}
    </div>
  );
}

function WizardHead({ title, desc }) {
  return (
    <div className="wizard-head">
      <h1>{title}</h1>
      {desc && <p>{desc}</p>}
    </div>
  );
}

// ---- Step 5 (Screen 4) -------------------------------------------------------

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

function HealthAccessStep({ onCancel }) {
  const { state, dispatch, notify } = useStore();
  const [scope, setScope] = useState(state.ple.setup.scope && state.ple.setup.scope !== 'skipped' ? state.ple.setup.scope : 'org');
  const [eventBridge, setEventBridge] = useState(true);
  const [noApi, setNoApi] = useState(false);
  const [showPolicy, setShowPolicy] = useState(false);
  const [comprehensive, setComprehensive] = useState(state.ple.setup.comprehensive ?? true);
  const repoCount = state.ple.setup.repos.length;

  const go = (s) => {
    dispatch({ type: 'PLE_HEALTH_ACCESS', scope: s, eventBridge: s === 'skipped' ? false : eventBridge, comprehensive });
    if (s !== 'skipped' && eventBridge) notify('EventBridge rule atx-health-ple-delivery created.');
    navigate('/app/ple/analyze');
  };

  return (
    <>
      <WizardHead title="Allow AWS Health access" desc="AWS Transform reads your planned lifecycle events and affected resources to find them in your code. It doesn't change anything in AWS Health." />
      {noApi && (
        <Alert type="warning" title="Your support plan doesn't include the AWS Health API">
          AWS Transform can check this PLE only. Turn on EventBridge delivery to get new PLEs automatically.
        </Alert>
      )}
      <Container header="Let AWS Transform read your AWS Health events">
        <div className="field-label">Permissions</div>
        <ul className="perm-list">
          <li><Icon.check /> Read Health events <span className="muted small mono">health:DescribeEvents, health:DescribeEventDetails</span></li>
          <li><Icon.check /> Read affected resources <span className="muted small mono">health:DescribeAffectedEntities</span></li>
        </ul>
        <Link onClick={() => setShowPolicy((s) => !s)}>{showPolicy ? 'Hide' : 'View'} IAM policy</Link>
        {showPolicy && <pre className="code-block">{POLICY}</pre>}
      </Container>
      <Container header="Scope">
        <Radio
          name="scope"
          value={scope}
          onChange={setScope}
          options={[
            { value: 'account', label: 'This account only' },
            { value: 'org', label: 'All accounts in my organization', description: 'Needs organizational view turned on in AWS Health.' },
          ]}
        />
        <label className="checkbox block" style={{ marginTop: 14 }}>
          <input type="checkbox" checked={eventBridge} onChange={(e) => setEventBridge(e.target.checked)} />
          Send new PLEs to AWS Transform automatically (creates an EventBridge rule)
        </label>
      </Container>
      <Container header={<>Comprehensive analysis <span className="badge badge-blue">Recommended</span></>}>
        <label className="checkbox block">
          <input type="checkbox" checked={comprehensive} onChange={(e) => setComprehensive(e.target.checked)} />
          <strong>Also run a comprehensive tech-debt analysis on the {repoCount} connected repositories</strong>
        </label>
        <p className="field-desc indent">Runs in the background after the PLE check, so your PLE results are ready first.</p>
        <ul className="benefit-list">
          <li><Icon.check /> <span><strong>Catch upgrade blockers before the campaign runs.</strong> Outdated dependencies and missing tests that would fail AWS Transform validation show up before you start, not as failed pull requests.</span></li>
          <li><Icon.check /> <span><strong>Fix more with each change.</strong> Related findings in the same repositories, like deprecated SDKs, can join the PLE campaign so teams review fewer pull requests.</span></li>
          <li><Icon.check /> <span><strong>See your whole portfolio.</strong> Dependency, security, maintainability, infrastructure, code-quality and architecture findings, grouped so each issue shows once.</span></li>
          <li><Icon.check /> <span><strong>Start a baseline for continuous modernization.</strong> Later analyses show what's new, fixed or getting worse.</span></li>
        </ul>
        {!comprehensive && (
          <Alert type="info">AWS Transform checks your code for PLEs only. You can run a comprehensive analysis later from Analyses.</Alert>
        )}
      </Container>
      <div className="form-actions">
        <Button variant="link" onClick={onCancel}>Cancel</Button>
        <Button onClick={() => go('skipped')}>Skip for now (checks only this PLE)</Button>
        {noApi ? (
          <Button variant="primary" onClick={() => go('skipped')}>Continue with this PLE only</Button>
        ) : (
          <Button variant="primary" onClick={() => go(scope)}>Allow and continue</Button>
        )}
      </div>
      <DemoPanel>
        <label className="checkbox">
          <input type="checkbox" checked={noApi} onChange={(e) => setNoApi(e.target.checked)} /> Support plan without the AWS Health API
        </label>
      </DemoPanel>
    </>
  );
}

// ---- Step 6 (Screen 5) -------------------------------------------------------

function AnalyzeStep() {
  const { state, dispatch } = useStore();
  const event = useEntryEvent();
  const a = state.ple.analysis;
  const [details, setDetails] = useState(false);
  const repos = state.ple.setup.repos;
  const src = state.sources.find((s) => s.id === 'src-ple');
  const td = state.analyses.find((x) => x.autoGroup);

  useEffect(() => {
    if (a || !repos.length) return;
    dispatch({ type: 'PLE_START_ANALYSIS' });
    if (state.ple.setup.comprehensive) {
      const readable = repos.filter((r) => !UNREADABLE.includes(r));
      dispatch({ type: 'START_ANALYSIS', analysisType: 'td-comprehensive', name: 'Tech debt (comprehensive)', source: src?.name ?? ORG, repos: readable, infra: 'AWS managed', autoGroup: true });
    }
  }, [a, repos.length, dispatch]);

  const done = a?.status === 'done';
  const partial = done && a.unreadable.length > 0;
  // View findings: the PLEs tab, filtered to this analysis, with the clicked PLE pinned.
  const highlight = { tab: 'ple', analysis: 'A-PLE', ...(event ? { highlight: `G-${event.id}` } : {}) };

  useEffect(() => {
    if (!done) return;
    try {
      window.localStorage.setItem(CM_CUSTOMER_KEY, '1');
    } catch {
      /* storage unavailable */
    }
    if (!partial) navigate('/app/cm/findings', highlight);
  }, [done]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!repos.length) {
    return (
      <Alert type="warning" title="No repositories connected">
        <Link onClick={() => navigate('/app/ple/provider')}>Connect repositories</Link> first.
      </Alert>
    );
  }

  const total = repos.length;
  const checked = a?.done ?? 0;
  const seen = new Set([...repos].sort().slice(0, checked));
  const entryHits = event ? event.repos.filter((r) => seen.has(r.repo)).length : 0;
  const others = state.ple.setup.skipped ? 0 : state.ple.events.filter((e) => e.id !== event?.id).length;

  return (
    <>
      <WizardHead title="Find affected code" desc={`AWS Transform checks ${src?.name ?? ORG} for code behind the PLE. Nothing in your repositories changes.`} />
      <Container header={done ? `Checked ${total} repositories` : `Checking ${total} repositories…`}>
        <ProgressBar value={(checked / total) * 100} label={`${checked} of ${total}`} tone={done ? 'success' : 'progress'} />
        <ul className="live-lines">
          {event && (
            <li>
              {done ? <Icon.check className="ok" /> : <Icon.spinner />} {shortTitle(event)}: {entryHits} {entryHits === 1 ? 'repository' : 'repositories'}
              {done ? '' : ' so far'}
            </li>
          )}
          {others > 0 && (
            <li>
              {done ? <Icon.check className="ok" /> : <Icon.spinner />} {done ? 'Checked' : 'Checking'} {others} other open PLEs
            </li>
          )}
          {state.ple.setup.skipped && <li className="muted"><Icon.info /> Checking this PLE only. Allow AWS Health access to check the others.</li>}
          {td && (
            <li>
              {td.status === 'Completed' ? <Icon.check className="ok" /> : <Icon.spinner />} Tech debt (comprehensive): {td.status === 'Completed' ? `${td.findings} findings, grouped` : `${td.done} of ${td.repos.length} repositories · runs in the background`}{' '}
              <Link onClick={() => navigate(`/app/cm/analyses/${td.id}`)}>View in Analyses</Link>
            </li>
          )}
        </ul>
      </Container>
      {partial && (
        <>
          <Alert type="warning" action={<Button onClick={() => setDetails((d) => !d)}>{details ? 'Hide details' : 'View details'}</Button>}>
            {a.unreadable.length} repositories couldn't be read (access denied). Results exclude them.
          </Alert>
          {details && (
            <Container header="Repositories not read">
              <ul className="plain-list">
                {a.unreadable.map((r) => (
                  <li key={r}>
                    <span className="mono">{src?.org ?? ORG}/{r}</span> <span className="muted small">· 403: the token can't read this repository</span>
                  </li>
                ))}
              </ul>
            </Container>
          )}
          <div className="form-actions">
            <Button variant="primary" onClick={() => navigate('/app/cm/findings', highlight)}>View findings</Button>
          </div>
        </>
      )}
      {!done && <p className="muted small">You can leave this page. AWS Transform keeps checking and shows results under Continuous modernization › Findings.</p>}
      {done && !partial && <p className="muted small">Done. Opening findings…</p>}
    </>
  );
}
