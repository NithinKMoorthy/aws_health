import React, { useEffect, useState } from 'react';
import { fmtDate, TRANSFORMATIONS, typeLabel } from '../data';
import { navigate, useStore } from '../store';
import { Alert, Breadcrumbs, Button, Container, FormField, Icon, Input, Link, ProgressBar, Select } from '../components/ui';
import { NotFound } from '../cm/Findings';
import { continueInChat } from '../components/Chat';
import { CAMPAIGN_NAMES, MOCK_TODAY } from './data';
import { groupView, PleTag } from './common';
import { groupPath, groupTitle } from './Groups';

// Review specialized skill (type C groups): what AWS Transform generated, the
// decisions it picked, and how to run and publish it. Running tests the skill
// on held-out repositories first (R14), then starts a campaign on the group.

const ROWS = [
  ['target', 'Target'],
  ['approach', 'Approach'],
  ['validation', 'Validation'],
  ['guardrails', 'Guardrails'],
];

/** Default skill content for a group. Edits are stored on group.skill. */

// Skills generated for the seeded tech-debt groups: short names and concrete steps,
// the way AWS Transform words a skill it built from the analysis.
const GROUP_SKILLS = {
  'G-legacy-sec': (repos) => ({
    name: 'Vulnerable dependency and secret removal',
    target: 'jsonwebtoken, Express and body-parser on patched versions · secrets moved out of plaintext config',
    approach: 'Bump each vulnerable package to its nearest patched release, then move config secrets to AWS Secrets Manager',
    validation: `Dependency scan reports no known CVEs and secret scanning is clean in ${repos}`,
    guardrails: 'No major-version jumps without owner approval · rotated values are logged for audit',
    details: {
      target: ['jsonwebtoken 8 → 9.0.2', 'Express 4.16 → 4.21 with body-parser 1.20.3', 'config/default.json secrets → AWS Secrets Manager', 'Application code flagged by the security scan'],
      approach: ['Update package.json and the lockfile', 'Adjust jwt.verify calls for the v9 algorithm defaults', 'Load secrets at startup with the AWS SDK'],
      validation: ['npm audit reports no high or critical CVEs', 'Secret scanning finds no credentials', 'Unit and integration tests pass'],
      guardrails: ['Owner approval for major-version upgrades', 'Rotation logged for audit', 'One pull request per repository'],
    },
    decisions: [
      ['Secret store', 'AWS Secrets Manager', ['AWS Secrets Manager', 'SSM Parameter Store']],
      ['Upgrade policy', 'Nearest patched version', ['Nearest patched version', 'Latest major']],
      ['On missing secret', 'Fail closed at startup', ['Fail closed at startup', 'Log and continue']],
    ],
  }),
  'G-mkp-rn': (repos) => ({
    name: 'React Native and Expo upgrade',
    target: 'React Native 0.63 → 0.74 and Expo SDK 38 → 51, with unmaintained packages replaced',
    approach: 'Step through each breaking release with the upgrade helper, then swap deprecated packages for maintained ones',
    validation: `iOS and Android builds pass and the app launches on both simulators in ${repos}`,
    guardrails: 'Native module changes need owner approval · no UI changes beyond what the upgrade needs',
    details: {
      target: ['react-native 0.63.4 → 0.74', 'expo 38 → 51', 'Deprecated packages flagged by the analysis'],
      approach: ['Apply each React Native upgrade-helper diff in order', 'Run expo install --fix after each step', 'Replace unmaintained packages with maintained equivalents'],
      validation: ['iOS build passes', 'Android build passes', 'Smoke test launches on both simulators'],
      guardrails: ['Owner approval for native module changes', 'One pull request per repository'],
    },
    decisions: [
      ['Target version', 'React Native 0.74', ['React Native 0.74', 'React Native 0.73']],
      ['Workflow', 'Expo managed', ['Expo managed', 'Bare workflow']],
    ],
  }),
  'G-mkp-maint': (repos) => ({
    name: 'Mobile app hardening',
    target: 'Tokens in secure storage, endpoints in config, CI and onboarding docs in place',
    approach: 'Move tokens from AsyncStorage to expo-secure-store, lift hard-coded endpoints into environment config, add a CI workflow and README',
    validation: `Tests pass, no tokens in AsyncStorage, and the CI workflow runs green in ${repos}`,
    guardrails: 'Existing sessions migrate on first launch · no endpoint values change',
    details: {
      target: ['AsyncStorage token reads and writes', 'Hard-coded API endpoints', 'Missing CI/CD configuration', 'Missing README'],
      approach: ['Wrap token access in a secure-store helper', 'Read endpoints from app config per environment', 'Add a GitHub Actions workflow for lint, test and build', 'Generate a README from the project layout'],
      validation: ['Unit tests pass', 'Static check finds no token in AsyncStorage', 'CI workflow passes on the pull request'],
      guardrails: ['Migrate stored sessions on first launch', 'One pull request per repository'],
    },
    decisions: [
      ['Token storage', 'expo-secure-store', ['expo-secure-store', 'react-native-keychain']],
      ['CI provider', 'GitHub Actions', ['GitHub Actions', 'AWS CodeBuild']],
    ],
  }),
  'G-legacy-node': (repos) => ({
    name: 'Node.js 22 modernization',
    target: 'Node.js 16 → 22 with callback code moved to async/await and a current lockfile',
    approach: 'Bump the runtime and engines field, convert callback-style handlers to async/await, regenerate the lockfile',
    validation: `Build and tests pass on Node.js 22 and the analysis no longer reports the runtime in ${repos}`,
    guardrails: 'Behavior-preserving refactors only · one pull request per repository',
    details: {
      target: ['Node.js 16.x runtime', 'Callback-style async code', 'npm lockfile v1'],
      approach: ['Update .nvmrc, engines and the Dockerfile base image', 'Convert callbacks with util.promisify and async/await', 'Regenerate package-lock.json as lockfile v3'],
      validation: ['Build passes on Node.js 22', 'Unit tests pass with no regressions', 'Re-analysis no longer reports Node.js 16'],
      guardrails: ['No changes to public API responses', 'One pull request per repository'],
    },
    decisions: [
      ['Target version', 'Node.js 22', ['Node.js 22', 'Node.js 20']],
      ['Async style', 'async/await', ['async/await', 'Promises']],
    ],
  }),
  'G-demo-scaffold': (repos) => ({
    name: 'Node.js project scaffolding',
    target: 'package.json, source layout, .gitignore and a license added to the empty repository',
    approach: 'Generate a minimal Node.js project that matches your other repositories, then add standard ignore and license files',
    validation: `npm install and npm test run cleanly in ${repos}`,
    guardrails: 'No application logic added · license matches your organization default',
    details: {
      target: ['Missing package.json', 'Empty source tree', 'Missing .gitignore entries', 'Missing license file'],
      approach: ['Create package.json with your default scripts', 'Add src/ and test/ with a placeholder module', 'Add .gitignore for Node.js', 'Add the organization license'],
      validation: ['npm install succeeds', 'npm test runs the placeholder test', 'Re-analysis no longer reports the findings'],
      guardrails: ['No business logic generated', 'One pull request per repository'],
    },
    decisions: [
      ['Module system', 'ES modules', ['ES modules', 'CommonJS']],
      ['License', 'Apache-2.0', ['Apache-2.0', 'MIT', 'Proprietary']],
    ],
  }),
  'G-ml-quality': (repos) => ({
    name: 'Test and lint baseline',
    target: 'A test framework, one shared lint config and no console logging in production paths',
    approach: 'Add Jest with a starter test per module, consolidate ESLint configs, replace console calls with the logger',
    validation: `Tests and lint pass in CI in ${repos}`,
    guardrails: 'No behavior changes · existing lint rules kept unless they conflict',
    details: {
      target: ['No test framework or test files', 'Inconsistent lint configuration', 'Console logging in production paths', 'Unused dependencies'],
      approach: ['Add Jest and a starter test for each module', 'Merge lint configs into one .eslintrc', 'Swap console.* for the shared logger', 'Remove unused dependencies'],
      validation: ['npm test passes', 'npm run lint passes', 'Bundle builds with no console calls in production'],
      guardrails: ['No behavior changes', 'One pull request per repository'],
    },
    decisions: [
      ['Test framework', 'Jest', ['Jest', 'Vitest']],
      ['Lint preset', 'Keep existing rules', ['Keep existing rules', 'Adopt recommended preset']],
    ],
  }),
};

export function skillSpec(g, v) {
  const n = v.repos.length;
  const repos = `${n} ${n === 1 ? 'repository' : 'repositories'}`;
  if (g.pleId === 'rds-pg14') {
    return {
      name: 'PostgreSQL 14 to 16 engine upgrade',
      target: `RDS for PostgreSQL instances defined in infrastructure-as-code move from 14 to ${g.target}`,
      approach: 'Bump engine_version, create a matching parameter group with non-default parameters carried over, then flag extensions that change behavior',
      validation: `Infrastructure plan shows only the engine and parameter-group change · pg_upgrade --check passes on a snapshot clone in all ${repos}`,
      guardrails: 'Major-version changes need owner approval · applied in the next maintenance window · snapshot taken first',
      details: {
        target: v.live.map((f) => `${f.repo}: ${f.file}:${f.line} (${f.evidence})`),
        approach: ['Update engine_version and family in each definition', 'Create the new parameter group and copy non-default values', 'List extensions (postgis, pg_stat_statements) and check their supported versions'],
        validation: ['Infrastructure plan diff is limited to engine, family and parameter group', 'pg_upgrade --check on a snapshot clone', 'Application smoke tests pass against the clone', 'No deprecated parameters remain'],
        guardrails: ['Owner approval on each pull request', 'apply_immediately stays false', 'Manual snapshot before the change'],
      },
      decisions: [
        ['Target version', g.target, ['PostgreSQL 16', 'PostgreSQL 17']],
        ['Parameter group', 'Create new, copy non-defaults', ['Create new, copy non-defaults', 'Use the default group']],
        ['Upgrade window', 'Next maintenance window', ['Next maintenance window', 'Apply immediately']],
      ],
    };
  }
  if (g.pleId === 'cache-redis6') {
    return {
      name: 'Redis OSS 6 to Valkey 8 engine upgrade',
      target: `ElastiCache replication groups move from Redis OSS 6 to ${g.target}`,
      approach: 'Switch engine and engine_version, swap the parameter group family, keep the endpoint names',
      validation: `Infrastructure plan shows only the engine change · client connection test passes in all ${repos}`,
      guardrails: 'Owner approval on each pull request · applied in the maintenance window',
      details: {
        target: v.live.map((f) => `${f.repo}: ${f.file}:${f.line} (${f.evidence})`),
        approach: ['Change engine to valkey and engine_version to 8.0', 'Create a valkey8 parameter group', 'Keep cluster and endpoint names'],
        validation: ['Plan diff is limited to engine and parameter group', 'Client library connects and runs PING, GET, SET', 'No deprecated commands in use'],
        guardrails: ['Owner approval on each pull request', 'Applied in the maintenance window'],
      },
      decisions: [
        ['Target engine', g.target, ['Valkey 8.0', 'Redis OSS 7.1']],
        ['Upgrade window', 'Next maintenance window', ['Next maintenance window', 'Apply immediately']],
      ],
    };
  }
  if (GROUP_SKILLS[g.id]) return GROUP_SKILLS[g.id](n === 1 ? v.repos[0] : `all ${repos}`);
  return {
    name: `${g.shortName} fix`,
    target: `${g.shortName} resolved in ${n === 1 ? v.repos[0] : `all ${repos}`}`,
    approach: "Apply the smallest change that resolves the finding, following each repository's conventions",
    validation: 'Build and unit tests pass · the analysis no longer reports the finding',
    guardrails: 'One pull request per repository · no public API changes without owner approval',
    details: {
      target: v.repos.slice(0, 8).map((r) => r).concat(n > 8 ? [`…and ${n - 8} more`] : []),
      approach: ['Read the finding evidence in each repository', 'Make the minimal change', 'Update lockfiles or configuration only where the change needs it'],
      validation: ['Build passes', 'Unit tests pass with no regressions', 'Re-analysis no longer reports the finding'],
      guardrails: ['One pull request per repository', 'Owner approval for public API changes'],
    },
    decisions: [
      ['Change scope', 'Minimal fix', ['Minimal fix', 'Fix and refactor nearby code']],
      ['Tests', 'Add a regression test', ['Add a regression test', 'No new tests']],
    ],
  };
}

export const RUN_OPTIONS = [
  ['published', 'Run and publish', (r) => `Runs on ${r}, then publishes to the Skills Library once it passes validation.`, 'Run, then publish'],
  ['draft', 'Run and publish a draft now', () => 'Visible in the Skills Library right away, marked "Not yet validated".', 'Run and publish draft'],
  ['one-off', 'Run one-off', (r) => `Runs on ${r} only. Nothing is shared.`, 'Run one-off'],
];

// Existing TDs that could fix these findings instead of the generated skill, best match first.
function tdCandidates(g, v) {
  const n = v.live.length;
  const text = `${g.name} ${v.live.map((f) => `${f.title} ${f.category}`).join(' ')}`;
  const cov = [n, Math.max(1, n - 1), 1];
  const rows = /secret|credential|password|api key/i.test(text)
    ? [['Custom/acme-secrets-hygiene-v2', 'Custom TD in your registry · Config-file credentials and vault references · Security team'], ['Custom/secrets-manager-migration', 'Custom TD in your registry · Moves hard-coded credentials to AWS Secrets Manager and loads them at startup · Security team'], ['AWS/git-history-secret-purge', 'AWS-managed TD · Removes committed secrets from repository history after rotation']]
    : /react native|expo|mobile/i.test(text)
      ? [['Custom/react-native-upgrade-kit', 'Custom TD in your registry · Steps React Native through each breaking release · Mobile platform team'], ['AWS/nodejs-version-upgrade', 'AWS-managed TD · Upgrades the Node.js toolchain the build uses'], ['AWS/nodejs-aws-sdk-v2-to-v3', 'AWS-managed TD · Moves AWS SDK for JavaScript v2 calls to v3']]
      : /cve|vulnerab|dependenc/i.test(text)
        ? [['Custom/dependency-patch-policy', 'Custom TD in your registry · Bumps vulnerable packages to the nearest patched version · Security team'], ['AWS/nodejs-aws-sdk-v2-to-v3', 'AWS-managed TD · Moves AWS SDK for JavaScript v2 calls to v3'], ['AWS/nodejs-version-upgrade', 'AWS-managed TD · Upgrades the runtime and its engines field']]
        : [[`Custom/${g.shortName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 32)}`, 'Custom TD in your registry · Built by your platform team for findings like these'], ...TRANSFORMATIONS.slice(0, 2).map((t) => [t, 'AWS-managed TD'])];
  return rows.map((r, i) => [...r, cov[i]]);
}

export function SkillReview({ id, query = {} }) {
  const { state, dispatch, notify } = useStore();
  const g = state.ple.groups.find((x) => x.id === id);
  const [mode, setMode] = useState('skill');
  const [editing, setEditing] = useState(false);
  const [open, setOpen] = useState(() => new Set());
  const [contextOpen, setContextOpen] = useState(false);
  const [pendingRun, setPendingRun] = useState(false);
  const [td, setTd] = useState(null);
  const [tdQuery, setTdQuery] = useState('');
  const [customPrompt, setCustomPrompt] = useState('');
  const [, force] = useState(0);
  const s = g?.skill ?? { status: 'proposed' };

  useEffect(() => {
    if (s.status !== 'generating') return undefined;
    const t = setInterval(() => force((n) => n + 1), 300);
    return () => clearInterval(t);
  }, [s.status]);

  const v = g && groupView(state, g);
  const spec = g && skillSpec(g, v);
  const edits = s.edits ?? {};
  const decisions = s.decisions ?? {};
  const name = s.name ?? spec?.name ?? '';
  const saveAs = s.saveAs === 'one-off' || s.saveAs === 'draft' || s.saveAs === 'published' ? s.saveAs : 'published';
  const update = (patch) => dispatch({ type: 'PLE_SKILL_UPDATE', groupId: g.id, patch });

  const startCampaign = () => {
    const names = CAMPAIGN_NAMES[g.pleId] ?? [`Remediate ${g.shortName}`, () => `"${g.shortName}" resolved in every repository`];
    const cid = `C-${state.seq}`;
    dispatch({
      type: 'PLE_START_CAMPAIGN',
      name: names[0],
      target: names[1](g.target),
      dueDate: v.event?.changeDate ?? null,
      groupIds: [g.id],
      checks: { equivalence: true, deps: true },
      now: Date.now(),
    });
    notify(saveAs === 'one-off' ? `Running "${name}" on ${v.repos.length} repositories.` : `Running "${name}". It publishes to the Skills Library ${saveAs === 'draft' ? 'now as a draft' : 'once it passes validation'}.`);
    navigate(`/app/cm/campaigns/${cid}`);
  };

  // Once the held-out test passes, continue the run the user asked for.
  useEffect(() => {
    if (pendingRun && s.status === 'ready') {
      setPendingRun(false);
      startCampaign();
    }
  }, [pendingRun, s.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!g) return <NotFound what="Specialized skill" back="/app/cm/findings" />;
  const e = v.event;
  const reposLabel = v.repos.length === 1 ? v.repos[0] : `the ${v.repos.length} repositories in this group`;
  const remediated = v.campaigns.length > 0;
  const pct = s.status === 'generating' ? Math.min(100, ((Date.now() - s.startedAt) / s.duration) * 100) : 0;
  const analysis = state.analyses.find((a) => a.id === v.live[0]?.analysisId);
  const statusBadge = s.status === 'ready' ? 'Tested · ready to run' : s.status === 'generating' ? 'Testing on held-out repositories' : 'Ready · requires review';
  const runLabel = RUN_OPTIONS.find((o) => o[0] === saveAs)[3];
  const edited = (k) => edits[k] != null && edits[k] !== spec[k];
  const toggleRow = (k) => setOpen((o) => { const n = new Set(o); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const run = () => {
    if (mode === 'td') {
      notify(`Switched to ${td === 'custom' ? 'a custom transformation' : td}. Review the plan to run it.`, 'info');
      navigate(groupPath(g));
      return;
    }
    if (s.status === 'ready') startCampaign();
    else {
      setPendingRun(true);
      dispatch({ type: 'PLE_SKILL_GENERATE', groupId: g.id, now: Date.now() });
    }
  };

  return (
    <div className="page sr">
      <Breadcrumbs
        items={[
          { label: 'Findings', onClick: () => navigate('/app/cm/findings', e ? { tab: 'ple' } : undefined) },
          { label: groupTitle(g), onClick: () => navigate(groupPath(g)) },
          { label: 'Review skill' },
        ]}
      />
      <h1 className="page-title">Review specialized skill</h1>
      <p className="page-desc">A specialized transformation skill is ready for this finding. Review it, run it, and publish it so other repositories can reuse it.</p>

      <Container>
        <div className="skill-callout">
          <span className="skill-callout-icon"><TransformGlyph /></span>
          <div>
            <strong>A specialized transformation skill is ready</strong>
            <p>
              Built from {e ? <>the AWS Health PLE and an analysis of {reposLabel}</> : <>an analysis of {reposLabel}</>}. No managed TD covers {e ? 'this change' : 'these findings'}, so AWS Transform generated a skill for
              {v.repos.length === 1 ? ' this repository' : ' these repositories'} and picked a recommended option for each decision. Use it as is, modify its decisions, or switch to a custom or managed TD.
            </p>
          </div>
        </div>
        <div className="skill-strip">
          <span className="strip-label">Finding · {remediated ? 'remediation started' : 'not yet remediated'}</span>
          <strong>{groupTitle(g)}</strong>
          {e && <span className="aws-ple-tag">AWS Health PLE</span>}
          <span className="pill">{v.repos.length === 1 ? <span className="mono">{v.repos[0]}</span> : `${v.repos.length} repositories`}</span>
          <span className="pill">Impact {v.severity.toLowerCase()}</span>
          <span className="pill">Effort {v.repos.length <= 3 ? '1–2 days' : '3–5 days'}</span>
          <span className="pill">{v.live.length} findings</span>
          {e && <span className="pill">Due {fmtDate(e.changeDate)} <PleTag /></span>}
        </div>
      </Container>

      <Container
        header="Specialized transformation skill"
        description={`Prepared from your analysis on ${fmtDate(analysis?.date?.slice(0, 10) ?? MOCK_TODAY)}. Review each step, then run it, publish it, or both.`}
        actions={<span className={`skill-badge ${s.status === 'ready' ? 'ok' : ''}`}>{statusBadge}</span>}
      >
        <ol className="skill-steps">
          <li>
            <span className="step-marker done"><svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true"><path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2.2" /></svg></span>
            <div className="step-card done">
              <div className="step-card-head">
                <h3>Analysis · {v.repos.length === 1 ? v.repos[0] : `${v.repos.length} repositories`} <span className="done-tag">Done</span></h3>
                <Link onClick={() => navigate(analysis ? `/app/cm/analyses/${analysis.id}` : '/app/cm/analyses')}><strong>View analysis</strong></Link>
              </div>
              <p>
                Analyzed <strong>{reposLabel}</strong> on {fmtDate(analysis?.date?.slice(0, 10) ?? MOCK_TODAY)}. No managed TD matched, so the specialized skill was derived from it.
              </p>
            </div>
          </li>

          <li>
            <span className="step-marker">2</span>
            <div className="step-card">
              <div className="step-card-head">
                <h3>Transformation</h3>
                <div className="seg-soft" role="radiogroup" aria-label="How to fix">
                  <button type="button" className={mode === 'skill' ? 'on' : ''} onClick={() => setMode('skill')}>Specialized skill</button>
                  <button type="button" className={mode === 'td' ? 'on' : ''} onClick={() => setMode('td')}>Managed or custom TD</button>
                </div>
              </div>
              {mode === 'skill' ? (
                <>
                  <div className="skill-head">
                    <span className="skill-icon">✦</span>
                    <div className="grow">
                      <strong>{name}</strong>
                      <div className="muted small">
                        Generated for {v.repos.length === 1 ? v.repos[0] : `${v.repos.length} repositories`} from your analysis · covers {v.live.length} of {v.live.length} findings · {spec.details.validation.length} of {spec.details.validation.length} validations
                      </div>
                    </div>
                    <Button onClick={() => setEditing((x) => !x)}>{editing ? 'Done editing' : 'Edit skill'}</Button>
                  </div>
                  <div className="skill-rows">
                    {ROWS.map(([k, label]) => (
                      <div key={k} className="skill-row">
                        {editing ? (
                          // Editing: the value becomes the field, in place, so it isn't shown twice.
                          <div className="skill-row-head editing">
                            <span className="sr-chev" aria-hidden="true">›</span>
                            <label className="skill-row-label" htmlFor={`edit-${k}`}>{label}</label>
                            <textarea id={`edit-${k}`} className="input textarea" rows={1} value={edits[k] ?? spec[k]} onChange={(x) => update({ edits: { ...edits, [k]: x.target.value } })} />
                            <span className={`tag ${edited(k) ? 'tag-blue' : ''}`}>{edited(k) ? 'Edited' : 'Default'}</span>
                          </div>
                        ) : (
                          <button type="button" className="skill-row-head" onClick={() => toggleRow(k)} aria-expanded={open.has(k)}>
                            <span className={`sr-chev ${open.has(k) ? 'open' : ''}`} aria-hidden="true">›</span>
                            <span className="skill-row-label">{label}</span>
                            <span className="skill-row-value">{edits[k] ?? spec[k]}</span>
                            <span className={`tag ${edited(k) ? 'tag-blue' : ''}`}>{edited(k) ? 'Edited' : 'Default'}</span>
                          </button>
                        )}
                        {open.has(k) && !editing && (
                          <div className="skill-row-body">
                            <ul className="plain-list">{spec.details[k].map((d) => <li key={d}>{d}</li>)}</ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="kv-line">
                    <span className="kv-line-label">Decisions</span>
                    {editing ? (
                      <div className="decision-edit">
                        {spec.decisions.map(([k, def, opts]) => (
                          <FormField key={k} label={k}>
                            <Select compact value={decisions[k] ?? def} onChange={(x) => update({ decisions: { ...decisions, [k]: x } })} options={opts.map((o) => ({ value: o, label: o, description: o === def ? 'Recommended' : undefined }))} />
                          </FormField>
                        ))}
                      </div>
                    ) : (
                      <span className="grow">{spec.decisions.map(([k, def]) => decisions[k] ?? def).join(' · ')}</span>
                    )}
                    <span className="muted small">{spec.decisions.every(([k, def]) => (decisions[k] ?? def) === def) ? 'Recommended' : 'Changed'}</span>
                  </div>
                  <div className="kv-line">
                    <span className="kv-line-label">Context</span>
                    {contextOpen ? (
                      <textarea className="input textarea grow" rows={3} value={s.context ?? ''} placeholder="Team conventions, links to runbooks, things the skill should avoid" onChange={(x) => update({ context: x.target.value })} />
                    ) : (
                      <span className="grow">{s.context ? s.context : 'None added'}</span>
                    )}
                    <Link onClick={() => setContextOpen((c) => !c)}><strong>{contextOpen ? 'Done' : s.context ? 'Edit context' : 'Add context'}</strong></Link>
                  </div>
                </>
              ) : (
                <div className="td-switch">
                  <p>Use an existing transformation definition instead of the generated skill.</p>
                  <div className="td-search">
                    <Icon.search />
                    <input className="input" value={tdQuery} onChange={(x) => setTdQuery(x.target.value)} placeholder="Search all transformation definitions, e.g. logging, Java, IAM" aria-label="Search transformation definitions" />
                  </div>
                  <h4 className="td-list-head">Recommended for these findings</h4>
                  <div className="td-list">
                    {tdCandidates(g, v).map(([id, desc, covers], i) => (
                      <label key={id} className={`td-option ${td === id ? 'on' : ''}`}>
                        <input type="radio" name="td" checked={td === id} onChange={() => setTd(id)} />
                        <span className="grow">
                          <span className="mono">{id}</span>
                          <span className="muted small td-option-desc">{desc}</span>
                        </span>
                        <span className={`small ${i === 0 ? 'td-cover ok' : 'muted'}`}>Covers {covers} of {v.live.length} findings</span>
                      </label>
                    ))}
                    {tdQuery.trim() && TRANSFORMATIONS.filter((t) => t.toLowerCase().includes(tdQuery.trim().toLowerCase())).map((t) => (
                      <label key={t} className={`td-option ${td === t ? 'on' : ''}`}>
                        <input type="radio" name="td" checked={td === t} onChange={() => setTd(t)} />
                        <span className="grow">
                          <span className="mono">{t}</span>
                          <span className="muted small td-option-desc">AWS-managed TD · search result</span>
                        </span>
                      </label>
                    ))}
                  </div>
                  <Link onClick={() => navigate('/app/cm/settings')}><strong>Browse all capabilities</strong></Link>
                </div>
              )}
            </div>
          </li>

          <li>
            <span className="step-marker">3</span>
            <div className="step-card">
              <h3>{mode === 'td' ? 'Review and run' : 'Run and publish'}</h3>
              {mode === 'td' ? (
                <>
                  <p className="muted">{td ? `${td} runs on ${reposLabel}, one pull request per repository. Nothing is published.` : 'Pick a transformation definition above to continue.'}</p>
                  <div className="inline-gap" style={{ marginTop: 12 }}>
                    <Button variant="primary" disabled={!td} onClick={run}>Continue with this TD</Button>
                    <Button onClick={() => setMode('skill')}>Use the specialized skill</Button>
                  </div>
                </>
              ) : (<>
              <div className="run-options">
                {RUN_OPTIONS.map(([val, label, desc]) => (
                  <label key={val} className={`radio-card wide ${saveAs === val ? 'on' : ''}`}>
                    <input type="radio" name="saveas" checked={saveAs === val} onChange={() => update({ saveAs: val })} disabled={mode === 'td'} />
                    <span>
                      <span className="radio-label">{label} {val === 'published' && <span className="rec-tag">Recommended</span>}</span>
                      <span className="radio-desc">{desc(reposLabel)}</span>
                    </span>
                  </label>
                ))}
              </div>
              {saveAs !== 'one-off' && (
                <div className="skill-name-row">
                  <FormField label="Skill name">
                    <Input value={name} onChange={(x) => update({ name: x.target.value })} />
                  </FormField>
                </div>
              )}
              <p className="muted small">
                {saveAs === 'one-off'
                  ? 'Nothing is published. The skill is kept with this campaign only.'
                  : `Publishes the skill definition, your decisions and context as defaults, and validation rules. No code from ${reposLabel}.`}
              </p>
              {s.status === 'generating' && <ProgressBar value={pct} label={pct < 50 ? 'Running build and test on held-out repositories…' : 'Checking for regressions…'} tone="progress" />}
              <div className="inline-gap" style={{ marginTop: 12 }}>
                {query.return ? (
                  <Button variant="primary" disabled={!name.trim()} onClick={() => { update({ approved: true }); notify(`"${name}" approved. It runs${saveAs === 'one-off' ? '' : ', then publishes,'} when the campaign starts.`); navigate(query.return); }}>
                    {runLabel}
                  </Button>
                ) : (
                  <Button variant="primary" disabled={s.status === 'generating' || !name.trim()} onClick={run}>
                    {mode === 'td' ? 'Use this transformation' : s.status === 'generating' ? 'Testing…' : runLabel}
                  </Button>
                )}
                <button type="button" className="btn btn-ai sr-walk" onClick={() => continueInChat(`Walk me through the "${name}" skill`, `skill:${g.id}`)}>
                  <span aria-hidden="true">✦</span> Walk me through it
                </button>
                {remediated && <Link onClick={() => navigate(`/app/cm/campaigns/${v.campaigns[0].id}`)}>View campaign</Link>}
              </div>
              </>)}
            </div>
          </li>
        </ol>
      </Container>
    </div>
  );
}

function TransformGlyph() {
  return (
    <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
      <path d="M10 2.5l6.5 3.75v7.5L10 17.5l-6.5-3.75v-7.5z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M6.8 11.2l2.2-2.4 1.8 1.6 2.4-2.8" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}
